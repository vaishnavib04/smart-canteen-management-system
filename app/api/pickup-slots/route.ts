import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import pool from "@/src/lib/db";
import { getSession } from "@/src/lib/auth";

interface SlotRow extends RowDataPacket {
  slot_id: number;
  slot_time: string;
  max_capacity: number;
  booked: number;
}

// GET /api/pickup-slots
// Lists slots with remaining capacity. Uses the same rule as POST /api/orders:
// every order that is not Cancelled counts toward the slot's capacity.
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Please log in first." },
      { status: 401 }
    );
  }

  try {
    const [rows] = await pool.execute<SlotRow[]>(
      `SELECT
         ps.slot_id,
         TIME_FORMAT(ps.slot_time, '%H:%i') AS slot_time,
         ps.max_capacity,
         COUNT(o.order_id) AS booked
       FROM pickup_slot ps
       LEFT JOIN orders o
         ON o.slot_id = ps.slot_id AND o.status <> 'Cancelled'
       GROUP BY ps.slot_id, ps.slot_time, ps.max_capacity
       ORDER BY ps.slot_time`
    );

    const slots = rows.map((row) => {
      const booked = Number(row.booked);
      const maxCapacity = Number(row.max_capacity);

      return {
        slot_id: Number(row.slot_id),
        slot_time: row.slot_time,
        max_capacity: maxCapacity,
        booked,
        remaining: Math.max(maxCapacity - booked, 0),
        is_full: booked >= maxCapacity,
      };
    });

    return NextResponse.json({ count: slots.length, slots });
  } catch (error) {
    console.error("Failed to fetch pickup slots:", error);

    return NextResponse.json(
      { error: "Failed to fetch pickup slots" },
      { status: 500 }
    );
  }
}