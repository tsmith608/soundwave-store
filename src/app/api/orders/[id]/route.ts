import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getStatusLabel } from "@/lib/db";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      );
    }

    const order = await getOrderById(id);

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Return sanitized public order DTO
    return NextResponse.json({
      id: order.id,
      orderId: order.id,
      status: order.status,
      statusLabel: getStatusLabel(order.status),
      previewUrl: order.previewUrl,
      frameSize: order.frameSize,
      palette: order.palette,
      caption: order.caption,
      partnerOrderId: order.partnerOrderId,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error("Order lookup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
