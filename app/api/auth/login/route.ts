import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { RowDataPacket } from "mysql2/promise";
import pool from "@/src/lib/db";
import { createSession } from "@/src/lib/auth";

type UserRow = RowDataPacket & {
  user_id: number;
  name: string;
  email: string;
  role: "Student" | "Staff" | "Admin";
  password_hash: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password =
      typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute<UserRow[]>(
      `SELECT user_id, name, email, role, password_hash
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    const user = rows[0];

    // Do not accept existing passwords until they have been migrated to bcrypt.
    if (
      !user ||
      !["Student", "Staff", "Admin"].includes(user.role) ||
      !user.password_hash.startsWith("$2") ||
      !(await compare(password, user.password_hash))
    ) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    await createSession({
      userId: Number(user.user_id),
      email: user.email,
      role: user.role,
    });

    return NextResponse.json({
      message: "Login successful.",
      user: {
        user_id: Number(user.user_id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login failed:", error);

    return NextResponse.json(
      { error: "Unable to process login." },
      { status: 500 }
    );
  }
}