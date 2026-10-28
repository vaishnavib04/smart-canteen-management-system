import { NextResponse } from "next/server";
import pool from "@/src/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

interface CategoryRow extends RowDataPacket {
  category_id: number;
  category_name: string;
}

export async function GET() {
  try {
    const [categories] = await pool.query<CategoryRow[]>(
      "SELECT category_id, category_name FROM category ORDER BY category_name"
    );

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Failed to fetch categories:", error);

    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const categoryName =
      typeof body.category_name === "string"
        ? body.category_name.trim()
        : "";

    if (!categoryName || categoryName.length > 100) {
      return NextResponse.json(
        { error: "Category name must be between 1 and 100 characters" },
        { status: 400 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO category (category_name) VALUES (?)",
      [categoryName]
    );

    return NextResponse.json(
      {
        message: "Category created successfully",
        category_id: result.insertId,
        category_name: categoryName,
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
        { error: "This category already exists" },
        { status: 409 }
      );
    }

    console.error("Failed to create category:", error);

    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}