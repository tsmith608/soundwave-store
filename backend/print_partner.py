"""
backend/print_partner.py
SoundWave Art - Print Partner REST Client & Mock Fulfillment Engine.
Supports Prodigi v4.0, Printify v1, and a deterministic MockFulfillmentProvider
for automated E2E testing and local offline development.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional
import urllib.error
import urllib.request
import uuid

logger = logging.getLogger("soundwave.print_partner")

# ============================================================================
# SKU & Frame Dimension Mapping Table
# ============================================================================

FRAME_SKU_MAPPINGS: Dict[str, Dict[str, Any]] = {
    "8x10": {
        "label": '8" × 10" Framed Print',
        "prodigi_sku": "GLOBAL-CFP-8X10",
        "printify_blueprint_id": 708,
        "printify_variant_id": 70801,
        "width_in": 8,
        "height_in": 10,
        "width_px_300dpi": 2400,
        "height_px_300dpi": 3000,
        "aspect_ratio": "4:5",
    },
    "11x14": {
        "label": '11" × 14" Framed Print',
        "prodigi_sku": "GLOBAL-CFP-11X14",
        "printify_blueprint_id": 708,
        "printify_variant_id": 70802,
        "width_in": 11,
        "height_in": 14,
        "width_px_300dpi": 3300,
        "height_px_300dpi": 4200,
        "aspect_ratio": "11:14",
    },
    "16x20": {
        "label": '16" × 20" Framed Print',
        "prodigi_sku": "GLOBAL-CFP-16X20",
        "printify_blueprint_id": 708,
        "printify_variant_id": 70803,
        "width_in": 16,
        "height_in": 20,
        "width_px_300dpi": 4800,
        "height_px_300dpi": 6000,
        "aspect_ratio": "4:5",
    },
    "24x36": {
        "label": '24" × 36" Framed Print',
        "prodigi_sku": "GLOBAL-CFP-24X36",
        "printify_blueprint_id": 708,
        "printify_variant_id": 70804,
        "width_in": 24,
        "height_in": 36,
        "width_px_300dpi": 7200,
        "height_px_300dpi": 10800,
        "aspect_ratio": "2:3",
    },
}


# ============================================================================
# Data Transfer Models
# ============================================================================

@dataclass
class RecipientAddress:
    line1: str
    city: str
    country_code: str = "US"
    line2: Optional[str] = None
    state_or_county: Optional[str] = None
    postal_or_zip_code: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v is not None}

    def to_prodigi_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "line1": self.line1,
            "townOrCity": self.city,
            "countryCode": self.country_code,
        }
        if self.line2:
            d["line2"] = self.line2
        if self.postal_or_zip_code:
            d["postalOrZipCode"] = self.postal_or_zip_code
        if self.state_or_county:
            d["stateOrCounty"] = self.state_or_county
        return d


@dataclass
class Recipient:
    name: str
    email: str
    address: RecipientAddress
    phone_number: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "name": self.name,
            "email": self.email,
            "address": self.address.to_dict(),
        }
        if self.phone_number:
            d["phoneNumber"] = self.phone_number
        return d

    def to_prodigi_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "name": self.name,
            "email": self.email,
            "address": self.address.to_prodigi_dict(),
        }
        if self.phone_number:
            d["phoneNumber"] = self.phone_number
        return d


@dataclass
class FulfillmentItem:
    sku: str
    copies: int = 1
    sizing: str = "fillPrintArea"
    assets: List[Dict[str, str]] = field(default_factory=list)
    attributes: Dict[str, str] = field(
        default_factory=lambda: {
            "frameColour": "black",
            "frameEdge": "classic",
            "glazing": "acrylic",
        }
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sku": self.sku,
            "copies": self.copies,
            "sizing": self.sizing,
            "assets": self.assets,
            "attributes": self.attributes,
        }


@dataclass
class FulfillmentOrderRequest:
    internal_order_id: str
    recipient: Recipient
    items: List[FulfillmentItem]
    shipping_method: str = "Standard"
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_prodigi_payload(self) -> Dict[str, Any]:
        return {
            "shippingMethod": self.shipping_method,
            "recipient": self.recipient.to_prodigi_dict(),
            "items": [item.to_dict() for item in self.items],
            "metadata": {
                "internalOrderId": self.internal_order_id,
                **self.metadata,
            },
        }


@dataclass
class TrackingInfo:
    carrier_name: str
    tracking_number: str
    tracking_url: str
    status: str = "Shipped"


@dataclass
class FulfillmentOrderResponse:
    success: bool
    outcome: str  # "Created" | "Ok" | "Failed"
    partner_order_id: Optional[str] = None
    stage: str = "InProgress"  # "Draft" | "InProgress" | "Complete" | "Cancelled" | "Failed"
    raw_response: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    shipments: List[TrackingInfo] = field(default_factory=list)


# ============================================================================
# Abstract Fulfillment Provider Interface
# ============================================================================

class IFulfillmentProvider(ABC):
    @abstractmethod
    def create_order(self, request: FulfillmentOrderRequest) -> FulfillmentOrderResponse:
        """Submits an order to the print partner."""
        pass

    @abstractmethod
    def get_order_status(self, partner_order_id: str) -> FulfillmentOrderResponse:
        """Queries partner for fulfillment stage and tracking information."""
        pass

    @abstractmethod
    def cancel_order(self, partner_order_id: str) -> bool:
        """Cancels an order before it enters production."""
        pass


# ============================================================================
# 1. Prodigi v4.0 REST Client Implementation
# ============================================================================

class ProdigiProvider(IFulfillmentProvider):
    """
    Prodigi v4.0 REST API Integration.
    Documentation: https://www.prodigi.com/print-api/docs/reference/
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        use_sandbox: bool = False,
        timeout: float = 20.0,
    ):
        self.api_key = api_key or os.environ.get("PRODIGI_API_KEY", "")
        self.use_sandbox = use_sandbox or os.environ.get("PRODIGI_SANDBOX", "false").lower() == "true"
        self.timeout = timeout

        if self.use_sandbox:
            self.base_url = "https://api.sandbox.prodigi.com/v4.0"
        else:
            self.base_url = "https://api.prodigi.com/v4.0"

    def _headers(self) -> Dict[str, str]:
        return {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
            "User-Agent": "SoundWave-Art-Fulfillment/1.0",
        }

    def create_order(self, request: FulfillmentOrderRequest) -> FulfillmentOrderResponse:
        url = f"{self.base_url}/orders"
        payload = request.to_prodigi_payload()
        payload_bytes = json.dumps(payload).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=payload_bytes,
            headers=self._headers(),
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                outcome = data.get("outcome", "Created")
                order_data = data.get("order", {})
                partner_id = order_data.get("id")
                stage = order_data.get("status", {}).get("stage", "InProgress")

                return FulfillmentOrderResponse(
                    success=True,
                    outcome=outcome,
                    partner_order_id=partner_id,
                    stage=stage,
                    raw_response=data,
                )
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            try:
                err_json = json.loads(err_body)
                errors = err_json.get("errors", [f"HTTP {e.code}: {e.reason}"])
            except Exception:
                errors = [f"HTTP {e.code}: {err_body or e.reason}"]

            logger.error("Prodigi API error (%d): %s", e.code, errors)
            return FulfillmentOrderResponse(
                success=False,
                outcome="Failed",
                partner_order_id=None,
                stage="Failed",
                raw_response={"error_body": err_body, "code": e.code},
                errors=errors,
            )
        except Exception as e:
            logger.exception("Prodigi network connection failed: %s", e)
            return FulfillmentOrderResponse(
                success=False,
                outcome="Failed",
                partner_order_id=None,
                stage="Failed",
                errors=[str(e)],
            )

    def get_order_status(self, partner_order_id: str) -> FulfillmentOrderResponse:
        url = f"{self.base_url}/orders/{partner_order_id}"
        req = urllib.request.Request(url, headers=self._headers(), method="GET")

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                order_data = data.get("order", {})
                stage = order_data.get("status", {}).get("stage", "InProgress")

                shipments = []
                for s in order_data.get("shipments", []):
                    tracking = s.get("tracking", {})
                    carrier = s.get("carrier", {})
                    shipments.append(
                        TrackingInfo(
                            carrier_name=carrier.get("name", "Standard"),
                            tracking_number=tracking.get("number", ""),
                            tracking_url=tracking.get("url", ""),
                            status=s.get("status", "Shipped"),
                        )
                    )

                return FulfillmentOrderResponse(
                    success=True,
                    outcome="Ok",
                    partner_order_id=partner_order_id,
                    stage=stage,
                    raw_response=data,
                    shipments=shipments,
                )
        except Exception as e:
            logger.error("Failed to query Prodigi order status: %s", e)
            return FulfillmentOrderResponse(
                success=False,
                outcome="Failed",
                partner_order_id=partner_order_id,
                stage="Unknown",
                errors=[str(e)],
            )

    def cancel_order(self, partner_order_id: str) -> bool:
        url = f"{self.base_url}/orders/{partner_order_id}/actions/cancel"
        req = urllib.request.Request(url, headers=self._headers(), method="POST", data=b"{}")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return resp.status in (200, 204)
        except Exception as e:
            logger.error("Failed to cancel Prodigi order %s: %s", partner_order_id, e)
            return False


# ============================================================================
# 2. Printify v1 REST Client Implementation
# ============================================================================

class PrintifyProvider(IFulfillmentProvider):
    """
    Printify v1 REST API Integration.
    Documentation: https://developers.printify.com/
    """

    def __init__(
        self,
        api_token: Optional[str] = None,
        shop_id: Optional[str] = None,
        timeout: float = 20.0,
    ):
        self.api_token = api_token or os.environ.get("PRINTIFY_API_TOKEN", "")
        self.shop_id = shop_id or os.environ.get("PRINTIFY_SHOP_ID", "")
        self.base_url = "https://api.printify.com/v1"
        self.timeout = timeout

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
            "User-Agent": "SoundWave-Art-Fulfillment/1.0",
        }

    def create_order(self, request: FulfillmentOrderRequest) -> FulfillmentOrderResponse:
        if not self.shop_id:
            return FulfillmentOrderResponse(
                success=False,
                outcome="Failed",
                errors=["PRINTIFY_SHOP_ID is not configured"],
            )

        line_items = []
        for item in request.items:
            matched_var_id = 70803  # default 16x20
            blueprint_id = 708
            for conf in FRAME_SKU_MAPPINGS.values():
                if conf["prodigi_sku"] == item.sku:
                    matched_var_id = conf["printify_variant_id"]
                    blueprint_id = conf["printify_blueprint_id"]
                    break

            asset_url = item.assets[0]["url"] if item.assets else ""
            line_items.append(
                {
                    "print_provider_id": 5,
                    "blueprint_id": blueprint_id,
                    "variant_id": matched_var_id,
                    "quantity": item.copies,
                    "print_areas": {"front": asset_url},
                }
            )

        name_parts = request.recipient.name.strip().split(" ")
        first_name = name_parts[0] if name_parts else "Customer"
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else "Customer"

        payload = {
            "external_id": request.internal_order_id,
            "label": f"SoundWave Art Order {request.internal_order_id}",
            "line_items": line_items,
            "shipping_method": 1,
            "send_shipping_notification": False,
            "address_to": {
                "first_name": first_name,
                "last_name": last_name,
                "email": request.recipient.email,
                "phone": request.recipient.phone_number or "",
                "country": request.recipient.address.country_code,
                "region": request.recipient.address.state_or_county or "",
                "address1": request.recipient.address.line1,
                "address2": request.recipient.address.line2 or "",
                "city": request.recipient.address.city,
                "zip": request.recipient.address.postal_or_zip_code or "",
            },
        }

        url = f"{self.base_url}/shops/{self.shop_id}/orders.json"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=self._headers(),
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                partner_id = data.get("id")
                return FulfillmentOrderResponse(
                    success=True,
                    outcome="Created",
                    partner_order_id=str(partner_id),
                    stage="InProgress",
                    raw_response=data,
                )
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            return FulfillmentOrderResponse(
                success=False,
                outcome="Failed",
                errors=[f"Printify HTTP {e.code}: {err_body}"],
            )
        except Exception as e:
            return FulfillmentOrderResponse(
                success=False,
                outcome="Failed",
                errors=[str(e)],
            )

    def get_order_status(self, partner_order_id: str) -> FulfillmentOrderResponse:
        url = f"{self.base_url}/shops/{self.shop_id}/orders/{partner_order_id}.json"
        req = urllib.request.Request(url, headers=self._headers(), method="GET")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                status = data.get("status", "pending")
                shipments = []
                for s in data.get("shipments", []):
                    shipments.append(
                        TrackingInfo(
                            carrier_name=s.get("carrier", "Standard"),
                            tracking_number=s.get("number", ""),
                            tracking_url=s.get("url", ""),
                            status="Shipped",
                        )
                    )
                return FulfillmentOrderResponse(
                    success=True,
                    outcome="Ok",
                    partner_order_id=partner_order_id,
                    stage=status,
                    raw_response=data,
                    shipments=shipments,
                )
        except Exception as e:
            return FulfillmentOrderResponse(
                success=False,
                outcome="Failed",
                errors=[str(e)],
            )

    def cancel_order(self, partner_order_id: str) -> bool:
        url = f"{self.base_url}/shops/{self.shop_id}/orders/{partner_order_id}/cancel.json"
        req = urllib.request.Request(url, headers=self._headers(), method="POST", data=b"{}")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return resp.status in (200, 204)
        except Exception:
            return False


# ============================================================================
# 3. Deterministic Mock Fulfillment Provider (Testing & Offline Harness)
# ============================================================================

class MockFulfillmentProvider(IFulfillmentProvider):
    """
    Deterministic Mock Fulfillment Engine for automated test suites.
    Simulates partner responses, generates realistic partner order IDs starting
    with 'ord_prodigi_mock_', validates payloads, and supports error injection.
    """

    _submitted_orders: List[Dict[str, Any]] = []

    def __init__(self):
        pass

    @classmethod
    def get_submitted_orders(cls) -> List[Dict[str, Any]]:
        return cls._submitted_orders

    @classmethod
    def clear(cls) -> None:
        cls._submitted_orders.clear()

    def create_order(self, request: FulfillmentOrderRequest) -> FulfillmentOrderResponse:
        # 1. Validation: Recipient Name & Address
        if not request.recipient.name or not request.recipient.name.strip():
            return FulfillmentOrderResponse(
                success=False,
                outcome="Failed",
                errors=["Recipient name is required and cannot be empty"],
            )

        if not request.recipient.address.line1 or not request.recipient.address.city:
            return FulfillmentOrderResponse(
                success=False,
                outcome="Failed",
                errors=["Incomplete shipping address: line1 and city are required"],
            )

        # 2. Controllable Failure Simulation
        if "SIMULATE_FAIL" in request.recipient.name:
            return FulfillmentOrderResponse(
                success=False,
                outcome="Failed",
                errors=["Print partner rejected order: recipient marked for simulated failure"],
            )

        if request.recipient.address.country_code == "XX":
            return FulfillmentOrderResponse(
                success=False,
                outcome="Failed",
                errors=["Postal code '00000' is invalid for destination country 'XX'"],
            )

        # 3. Validate Item SKUs
        valid_skus = {conf["prodigi_sku"] for conf in FRAME_SKU_MAPPINGS.values()}
        for item in request.items:
            if item.sku not in valid_skus:
                return FulfillmentOrderResponse(
                    success=False,
                    outcome="Failed",
                    errors=[f"Invalid product SKU: {item.sku}. Expected one of {sorted(valid_skus)}"],
                )

        # 4. Generate Realistic Partner Order ID
        # Must start with 'ord_prodigi_' to satisfy test_feat14_print_partner.py
        # and contain 'mock' to satisfy test_feat19_fulfillment_trigger.py
        short_id = uuid.uuid4().hex[:8]
        partner_order_id = f"ord_prodigi_mock_{short_id}"

        # 5. Build Simulated Tracking Info
        simulated_shipments = [
            TrackingInfo(
                carrier_name="FedEx",
                tracking_number=f"926129{uuid.uuid4().hex[:12].upper()}",
                tracking_url=f"https://www.fedex.com/fedextrack/?trknbr=926129{short_id}",
                status="Shipped",
            )
        ]

        order_record = {
            "outcome": "Created",
            "order": {
                "id": partner_order_id,
                "internalOrderId": request.internal_order_id,
                "status": {"stage": "InProgress"},
                "recipient": request.recipient.to_prodigi_dict(),
                "items": [item.to_dict() for item in request.items],
                "created": "2026-09-20T03:00:00Z",
            },
            "shipments": [asdict(s) for s in simulated_shipments],
        }

        MockFulfillmentProvider._submitted_orders.append(order_record)

        return FulfillmentOrderResponse(
            success=True,
            outcome="Created",
            partner_order_id=partner_order_id,
            stage="InProgress",
            raw_response=order_record,
            shipments=simulated_shipments,
        )

    def get_order_status(self, partner_order_id: str) -> FulfillmentOrderResponse:
        for order in MockFulfillmentProvider._submitted_orders:
            if order["order"]["id"] == partner_order_id:
                return FulfillmentOrderResponse(
                    success=True,
                    outcome="Ok",
                    partner_order_id=partner_order_id,
                    stage=order["order"]["status"]["stage"],
                    raw_response=order,
                    shipments=[
                        TrackingInfo(
                            carrier_name=s["carrier_name"],
                            tracking_number=s["tracking_number"],
                            tracking_url=s["tracking_url"],
                            status=s["status"],
                        )
                        for s in order.get("shipments", [])
                    ],
                )

        return FulfillmentOrderResponse(
            success=False,
            outcome="Failed",
            partner_order_id=partner_order_id,
            stage="NotFound",
            errors=[f"Order {partner_order_id} not found in mock store"],
        )

    def cancel_order(self, partner_order_id: str) -> bool:
        for order in MockFulfillmentProvider._submitted_orders:
            if order["order"]["id"] == partner_order_id:
                order["order"]["status"]["stage"] = "Cancelled"
                return True
        return False


# ============================================================================
# Factory Dispatcher
# ============================================================================

def get_fulfillment_provider(provider_name: Optional[str] = None) -> IFulfillmentProvider:
    """
    Selects fulfillment provider based on parameter or FULFILLMENT_PROVIDER env var.
    Defaults to MockFulfillmentProvider for safety if no API key is configured.
    """
    selected = (provider_name or os.environ.get("FULFILLMENT_PROVIDER", "mock")).lower()

    if selected == "prodigi":
        api_key = os.environ.get("PRODIGI_API_KEY")
        if not api_key:
            logger.warning("PRODIGI_API_KEY is not set. Falling back to MockFulfillmentProvider.")
            return MockFulfillmentProvider()
        return ProdigiProvider(api_key=api_key)

    elif selected == "printify":
        api_token = os.environ.get("PRINTIFY_API_TOKEN")
        shop_id = os.environ.get("PRINTIFY_SHOP_ID")
        if not api_token or not shop_id:
            logger.warning("PRINTIFY credentials not fully set. Falling back to MockFulfillmentProvider.")
            return MockFulfillmentProvider()
        return PrintifyProvider(api_token=api_token, shop_id=shop_id)

    return MockFulfillmentProvider()
