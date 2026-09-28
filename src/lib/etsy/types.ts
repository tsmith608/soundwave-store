/**
 * Etsy API v3 TypeScript Interfaces and Types
 * Defines data structures for OAuth, Receipts, Transactions, Variations, and Personalizations.
 */

import { OrderStatus } from "@/lib/db";

export interface EtsyMoney {
  amount: number;
  divisor: number;
  currency_code: string;
}

export interface EtsyVariation {
  property_id?: number;
  formatted_name: string;
  formatted_value: string;
  value_id?: number;
}

export interface EtsyPersonalization {
  question_id?: number;
  question_text: string;
  value: string;
}

export interface EtsyTransaction {
  transaction_id: number | string;
  title?: string;
  description?: string;
  seller_user_id?: number | string;
  buyer_user_id?: number | string;
  receipt_id: number | string;
  listing_id?: number | string;
  price?: EtsyMoney;
  quantity?: number;
  variations?: EtsyVariation[];
  personalizations?: EtsyPersonalization[];
  buyer_email?: string;
}

export interface EtsyReceipt {
  receipt_id: number | string;
  receipt_type?: number;
  seller_user_id?: number | string;
  buyer_user_id?: number | string;
  buyer_email: string;
  name: string;
  first_line: string;
  second_line?: string | null;
  city: string;
  state?: string | null;
  zip: string;
  country_iso: string;
  formatted_address?: string;
  payment_method?: string;
  payment_email?: string;
  message_from_buyer?: string | null;
  was_paid?: boolean;
  was_shipped?: boolean;
  is_dead?: boolean;
  is_gift?: boolean;
  gift_message?: string | null;
  grandtotal: EtsyMoney;
  subtotal?: EtsyMoney;
  total_shipping_cost?: EtsyMoney;
  total_tax_cost?: EtsyMoney;
  total_vat_cost?: EtsyMoney;
  discount_amt?: EtsyMoney;
  transactions: EtsyTransaction[];
  created_timestamp?: number;
  updated_timestamp?: number;
}

export interface EtsyReceiptsResponse {
  count: number;
  results: EtsyReceipt[];
}

export interface EtsyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

export interface MappedEtsyOrder {
  partnerOrderId: string;
  externalOrderId: string;
  receiptId: string;
  transactionId: string;
  customerEmail: string;
  shippingName: string;
  shippingAddress: string;
  frameSize: string;
  palette: string;
  decorativeTheme: string;
  caption: string;
  audioPath: string;
  audioSourceUrl?: string | null;
  personalizationData: string;
  etsyListingId?: string | null;
  etsyReceiptId: string;
  totalAmount: number;
  source: "etsy";
  status: OrderStatus;
}
