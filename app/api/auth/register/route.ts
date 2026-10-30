import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import type { ResultSetHeader } from "mysql2/promise";
import pool from "@/src/lib/db";
import { createSession } from "@/src/lib/auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// POST /api/auth/register
// Body: { name, email, password, roll_no?, department? }
// Always creates a Student. Any "role" in the body is ignored.
export async function POST(request: Request) {
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
  const name = text(data.name);
  const email = text(data.email).toLowerCase();
  const password = typeof data.password === "string" ? data.password : "";
  const rollNo = text(data.roll_no) || null;
  const department = text(data.department) || null;

  if (!name || name.length > 100) {
    return NextResponse.json(
      { error: "Name is required (maximum 100 characters)." },
      { status: 400 }
    );
  }

  if (!EMAIL_PATTERN.test(email) || email.length > 150) {
    return NextResponse.json(
      { error: "A valid email address is required." },
      { status: 400 }
    );
  }

  if (password.length < 8 || password.length > 72) {
    return NextResponse.json(
      { error: "Password must be between 8 and 72 characters." },
      { status: 400 }
    );
  }

  if ((rollNo && rollNo.length > 20) || (department && department.length > 100)) {
    return NextResponse.json(
      { error: "Roll number or department is too long." },
      { status: 400 }
    );
  }

  try {
    const passwordHash = await hash(password, 10);

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO users (name, email, roll_no, department, role, password_hash)
       VALUES (?, ?, ?, ?, 'Student', ?)`,
      [name, email, rollNo, department, passwordHash]
    );

    const userId = Number(result.insertId);

    await createSession({ userId, email, role: "Student" });

    return NextResponse.json(
      {
        message: "Registration successful.",
        user: { user_id: userId, name, email, role: "Student" },
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    console.error("Registration failed:", error);

    return NextResponse.json(
      { error: "Unable to process registration." },
      { status: 500 }
    );
  }
}