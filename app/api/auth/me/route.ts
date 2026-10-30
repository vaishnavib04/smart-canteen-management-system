import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import pool from "@/src/lib/db";
import { getSession } from "@/src/lib/auth";

interface UserRow extends RowDataPacket {
  user_id: number;
  name: string;
  email: string;
  role: "Student" | "Staff" | "Admin";
}

// GET /api/auth/me - who is logged in (read from the signed cookie).
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Please log in first." },
      { status: 401 }
    );
  }

  try {
    const [rows] = await pool.execute<UserRow[]>(
      "SELECT user_id, name, email, role FROM users WHERE user_id = ? LIMIT 1",
      [session.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const user = rows[0];

    return NextResponse.json({
      user: {
        user_id: Number(user.user_id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Failed to load current user:", error);

    return NextResponse.json(
      { error: "Unable to load current user." },
      { status: 500 }
    );
  }
}