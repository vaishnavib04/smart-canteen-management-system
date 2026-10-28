import { requireStaffOrAdmin } from "@/src/lib/auth";
import { connection, NextResponse } from "next/server";
import pool from "@/src/lib/db";
import type { RowDataPacket } from "mysql2/promise";

interface SalesTotalsRow extends RowDataPacket {
  successful_payments: number;
  total_sales: string | null;
}

interface StatusSummaryRow extends RowDataPacket {
  status: string;
  order_count: number;
}

interface DailySalesRow extends RowDataPacket {
  sale_date: string;
  order_count: number;
  total_sales: string;
}

interface PaymentModeRow extends RowDataPacket {
  payment_mode: string;
  payment_count: number;
  total_amount: string;
}

export async function GET() {
  const auth = await requireStaffOrAdmin();

  if (auth.error === "UNAUTHENTICATED") {
    return NextResponse.json(
      { error: "Please log in first." },
      { status: 401 }
    );
  }

  if (auth.error === "FORBIDDEN") {
    return NextResponse.json(
      { error: "Only Staff or Admin can view sales reports." },
      { status: 403 }
    );
  }

  await connection();

  try {
    // 1. Read the overall summary from the MySQL view.
    const [viewRows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM vw_sales_summary`
    );

    const viewSummary = viewRows[0];

    if (!viewSummary) {
    throw new Error("Sales summary view returned no rows");
    }

    // 2. Count successful payments, excluding cancelled orders.
    const [salesTotals] = await pool.execute<SalesTotalsRow[]>(
    `SELECT
        COUNT(*) AS successful_payments,
        COALESCE(SUM(p.amount), 0) AS total_sales
    FROM payment p
    JOIN orders o ON o.order_id = p.order_id
    WHERE p.payment_status = 'Success'
        AND o.status <> 'Cancelled'`
    );

    // 3. Count orders grouped by status.
    const [statusSummary] = await pool.execute<StatusSummaryRow[]>(
      `SELECT
         status,
         COUNT(*) AS order_count
       FROM orders
       GROUP BY status
       ORDER BY status`
    );

    // 4. Group successful paid sales by order date.
    // The payment table does not have a payment timestamp,
    // so order_date is used for this daily breakdown.
    const [dailySales] = await pool.execute<DailySalesRow[]>(
    `SELECT
        DATE_FORMAT(DATE(o.order_date), '%Y-%m-%d') AS sale_date,
        COUNT(*) AS order_count,
        COALESCE(SUM(p.amount), 0) AS total_sales
    FROM payment p
    JOIN orders o ON o.order_id = p.order_id
    WHERE p.payment_status = 'Success'
        AND o.status <> 'Cancelled'
    GROUP BY DATE_FORMAT(DATE(o.order_date), '%Y-%m-%d')
    ORDER BY sale_date DESC`
    );

    // 5. Group successful paid sales by payment mode.
    const [paymentModes] = await pool.execute<PaymentModeRow[]>(
      `SELECT
         p.payment_mode,
         COUNT(*) AS payment_count,
         COALESCE(SUM(p.amount), 0) AS total_amount
       FROM payment p
       JOIN orders o ON o.order_id = p.order_id
       WHERE p.payment_status = 'Success'
         AND o.status <> 'Cancelled'
       GROUP BY p.payment_mode
       ORDER BY total_amount DESC`
    );

    return NextResponse.json({
      summary: {
        total_orders: Number(viewSummary.total_orders),
        successful_payments: Number(
            salesTotals[0].successful_payments
        ),
        total_sales: Number(viewSummary.total_sales ?? 0),
    },
      orders_by_status: statusSummary.map((row) => ({
        status: row.status,
        order_count: Number(row.order_count),
      })),
      daily_sales: dailySales.map((row) => ({
        sale_date: row.sale_date,
        order_count: Number(row.order_count),
        total_sales: Number(row.total_sales),
      })),
      sales_by_payment_mode: paymentModes.map((row) => ({
        payment_mode: row.payment_mode,
        payment_count: Number(row.payment_count),
        total_amount: Number(row.total_amount),
      })),
    });
  } catch (error) {
  console.error("Sales summary diagnostic:", error);

  return NextResponse.json(
    {
      error: "Failed to generate sales summary",
      diagnostic:
        error instanceof Error ? error.message : String(error),
    },
    { status: 500 }
  );
  }
}