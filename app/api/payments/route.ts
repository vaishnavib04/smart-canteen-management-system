import { getSession, requireStaffOrAdmin } from "@/src/lib/auth";
import { NextResponse } from "next/server";
import pool from "@/src/lib/db";
import type {
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { logActivity } from "@/src/lib/activity-log";

interface PaymentRow extends RowDataPacket {
  payment_id: number;
  amount: string;
  payment_mode: string;
  payment_status: string;
  order_id: number;
}

interface OrderRow extends RowDataPacket {
  order_id: number;
  total_amount: string;
  status: string;
}

const PAYMENT_MODES = ["Cash", "Card", "UPI", "Wallet"];

// GET /api/payments
// Optional filter: /api/payments?order_id=8
export async function GET(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Please log in first." },
        { status: 401 }
      );
    }
    const { searchParams } = new URL(request.url);
    const orderIdParam = searchParams.get("order_id");

    let sql = `
      SELECT
        p.payment_id,
        p.amount,
        p.payment_mode,
        p.payment_status,
        p.order_id
      FROM payment p
    `;

    const params: number[] = [];

    if (orderIdParam !== null) {
      const orderId = Number(orderIdParam);

      if (!Number.isSafeInteger(orderId) || orderId <= 0) {
        return NextResponse.json(
          { error: "A valid order_id is required" },
          { status: 400 }
        );
      }

      sql += " WHERE p.order_id = ?";
      params.push(orderId);
    }

    sql += " ORDER BY p.payment_id DESC";

    if (session.role === "Student") {
      sql += sql.includes("WHERE")
        ? " AND EXISTS (SELECT 1 FROM orders o WHERE o.order_id = p.order_id AND o.user_id = ?)"
        : " WHERE EXISTS (SELECT 1 FROM orders o WHERE o.order_id = p.order_id AND o.user_id = ?)";

      params.push(session.userId);
    }

    const [payments] = await pool.execute<PaymentRow[]>(sql, params);

    return NextResponse.json({
      count: payments.length,
      payments,
    });
  } catch (error) {
    console.error("Failed to fetch payments:", error);

    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}

// POST /api/payments
// Body: { "order_id": 8, "payment_mode": "UPI" }
export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Please log in first." },
      { status: 401 }
    );
  }
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const data = body as Record<string, unknown>;
  const orderId = data.order_id;
  const paymentMode = data.payment_mode;

  if (
    typeof orderId !== "number" ||
    !Number.isSafeInteger(orderId) ||
    orderId <= 0
  ) {
    return NextResponse.json(
      { error: "A valid order_id is required" },
      { status: 400 }
    );
  }

  if (
    typeof paymentMode !== "string" ||
    !PAYMENT_MODES.includes(paymentMode)
  ) {
    return NextResponse.json(
      { error: "payment_mode must be Cash, Card, UPI, or Wallet" },
      { status: 400 }
    );
  }

  const connection = await pool.getConnection();

  let paymentId: number;
  let amount: string;

  try {
    await connection.beginTransaction();

    // Lock the order so two requests cannot create payments simultaneously.
    const [orders] = await connection.execute<OrderRow[]>(
      `SELECT order_id, total_amount, status
       FROM orders
       WHERE order_id = ?
       FOR UPDATE`,
      [orderId]
    );

    if (orders.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const order = orders[0];

    if (session.role === "Student") {
      const [ownedOrders] = await connection.execute<RowDataPacket[]>(
        "SELECT order_id FROM orders WHERE order_id = ? AND user_id = ?",
        [orderId, session.userId]
      );

      if (ownedOrders.length === 0) {
        await connection.rollback();

        return NextResponse.json(
          { error: "You can only pay for your own orders." },
          { status: 403 }
        );
      }
    }

    if (order.status === "Cancelled") {
      await connection.rollback();

      return NextResponse.json(
        { error: "Cannot record payment for a cancelled order" },
        { status: 409 }
      );
    }

    // The amount comes from MySQL, never from the request body.
    amount = Number(order.total_amount).toFixed(2);

    const [existing] = await connection.execute<PaymentRow[]>(
      "SELECT payment_id FROM payment WHERE order_id = ? FOR UPDATE",
      [orderId]
    );

    if (existing.length > 0) {
      await connection.rollback();

      return NextResponse.json(
        { error: "A payment record already exists for this order" },
        { status: 409 }
      );
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO payment (amount, payment_mode, payment_status, order_id)
       VALUES (?, ?, 'Success', ?)`,
      [amount, paymentMode, orderId]
    );

    paymentId = result.insertId;

    // Mark the order as confirmed after recording the payment.
    if (order.status === "Pending") {
      await connection.execute(
        "UPDATE orders SET status = 'Confirmed' WHERE order_id = ?",
        [orderId]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error("Failed to record payment:", error);

    return NextResponse.json(
      { error: "Failed to record payment" },
      { status: 500 }
    );
  } finally {
    connection.release();
  }

  try {
    await logActivity({
      action: "PAYMENT_RECORDED",
      entity: "payment",
      entity_id: paymentId,
      details: {
        order_id: orderId,
        amount,
        payment_mode: paymentMode,
        payment_status: "Success",
      },
    });
  } catch (error) {
    console.error("Payment recorded, but activity logging failed:", error);
  }

  return NextResponse.json(
    {
      message: "Payment recorded successfully",
      payment_id: paymentId,
      order_id: orderId,
      amount,
      payment_mode: paymentMode,
      payment_status: "Success",
    },
    { status: 201 }
  );
}