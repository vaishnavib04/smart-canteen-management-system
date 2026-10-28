import { requireStaffOrAdmin } from "@/src/lib/auth";
import { connection, NextResponse } from "next/server";
import pool from "@/src/lib/db";
import type { RowDataPacket } from "mysql2/promise";

const allowedStatuses = [
  "Pending",
  "Confirmed",
  "Preparing",
  "Ready",
  "Completed",
  "Cancelled",
] as const;

interface OrderRow extends RowDataPacket {
  order_id: number;
  status: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
      const auth = await requireStaffOrAdmin();

  if (auth.error === "UNAUTHENTICATED") {
    return NextResponse.json(
      { error: "Please log in first." },
      { status: 401 }
    );
  }

  if (auth.error === "FORBIDDEN") {
    return NextResponse.json(
      { error: "Only Staff or Admin can update order statuses." },
      { status: 403 }
    );
  }
  try {
    await connection();

    const { id } = await params;
    const orderId = Number(id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: "Invalid order ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const newStatus = body.status;

    if (!allowedStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: "Invalid order status" },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute<OrderRow[]>(
      "SELECT order_id, status FROM orders WHERE order_id = ?",
      [orderId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

        const oldStatus = rows[0].status;

    const allowedTransitions: Record<string, string[]> = {
      Pending: ["Confirmed", "Cancelled"],
      Confirmed: ["Preparing", "Cancelled"],
      Preparing: ["Ready", "Cancelled"],
      Ready: ["Completed"],
      Completed: [],
      Cancelled: [],
    };

    if (!allowedTransitions[oldStatus]?.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Order cannot transition from ${oldStatus} to ${newStatus}`,
        },
        { status: 400 }
      );
    }

    await pool.execute(
      "UPDATE orders SET status = ? WHERE order_id = ?",
      [newStatus, orderId]
    );

    return NextResponse.json({
      message: "Order status updated successfully",
      order_id: orderId,
      previous_status: oldStatus,
      status: newStatus,
    });
  } catch (error) {
    console.error("Order status update failed:", error);
    return NextResponse.json(
      { error: "Failed to update order status" },
      { status: 500 }
    );
  }
}