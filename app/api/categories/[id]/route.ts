import { NextResponse } from "next/server";
import pool from "@/src/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

interface CategoryRow extends RowDataPacket {
  category_id: number;
  category_name: string;
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getCategoryId(context: RouteContext) {
  const { id } = await context.params;
  const categoryId = Number(id);

  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
    return null;
  }

  return categoryId;
}

// PATCH /api/categories/1
export async function PATCH(request: Request, context: RouteContext) {
  const categoryId = await getCategoryId(context);

  if (categoryId === null) {
    return NextResponse.json(
      { error: "A valid category ID is required" },
      { status: 400 }
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
  const categoryName =
    typeof data.category_name === "string" ? data.category_name.trim() : "";

  if (!categoryName || categoryName.length > 100) {
    return NextResponse.json(
      { error: "Category name must be between 1 and 100 characters" },
      { status: 400 }
    );
  }

  try {
    const [existing] = await pool.execute<CategoryRow[]>(
      "SELECT category_id FROM category WHERE category_id = ?",
      [categoryId]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE category SET category_name = ? WHERE category_id = ?",
      [categoryName, categoryId]
    );

    return NextResponse.json({
      message: "Category updated successfully",
      category_id: categoryId,
      category_name: categoryName,
      changed: result.affectedRows > 0,
    });
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

    console.error("Failed to update category:", error);

    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}

// DELETE /api/categories/1
export async function DELETE(_request: Request, context: RouteContext) {
  const categoryId = await getCategoryId(context);

  if (categoryId === null) {
    return NextResponse.json(
      { error: "A valid category ID is required" },
      { status: 400 }
    );
  }

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM category WHERE category_id = ?",
      [categoryId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Category deleted successfully",
      category_id: categoryId,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_ROW_IS_REFERENCED_2"
    ) {
      return NextResponse.json(
        {
          error:
            "Cannot delete this category because food items are assigned to it",
        },
        { status: 409 }
      );
    }

    console.error("Failed to delete category:", error);

    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}