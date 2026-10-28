import { NextResponse } from "next/server";
import pool from "@/src/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

type RouteContext = {
  params: Promise<{ id: string }>;
};

interface FoodItemRow extends RowDataPacket {
  item_id: number;
  name: string;
  description: string | null;
  price: number;
  is_available: number | boolean;
  category_id: number;
  manager_id: number;
}

interface CategoryRow extends RowDataPacket {
  category_id: number;
}

interface ManagerRow extends RowDataPacket {
  user_id: number;
  role: string;
}

async function parseId(context: RouteContext): Promise<number | null> {
  const { id } = await context.params;
  const itemId = Number(id);

  return Number.isSafeInteger(itemId) && itemId > 0 ? itemId : null;
}

function isDatabaseError(
  error: unknown,
  code: string
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

// PATCH /api/food-items/1
export async function PATCH(request: Request, context: RouteContext) {
  const itemId = await parseId(context);

  if (itemId === null) {
    return NextResponse.json(
      { error: "A valid food item ID is required" },
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
  const allowedFields = [
    "name",
    "description",
    "price",
    "category_id",
    "is_available",
    "manager_id",
  ];

  if (!allowedFields.some((field) => field in data)) {
    return NextResponse.json(
      { error: "Provide at least one supported field to update" },
      { status: 400 }
    );
  }

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if ("name" in data) {
    if (
      typeof data.name !== "string" ||
      data.name.trim().length === 0 ||
      data.name.trim().length > 150
    ) {
      return NextResponse.json(
        { error: "Name must be between 1 and 150 characters" },
        { status: 400 }
      );
    }

    updates.push("name = ?");
    values.push(data.name.trim());
  }

  if ("description" in data) {
    if (
      data.description !== null &&
      typeof data.description !== "string"
    ) {
      return NextResponse.json(
        { error: "Description must be a string or null" },
        { status: 400 }
      );
    }

    updates.push("description = ?");
    values.push(
      typeof data.description === "string"
        ? data.description.trim()
        : null
    );
  }

  if ("price" in data) {
    if (
      typeof data.price !== "number" ||
      !Number.isFinite(data.price) ||
      data.price < 0
    ) {
      return NextResponse.json(
        { error: "Price must be a non-negative number" },
        { status: 400 }
      );
    }

    updates.push("price = ?");
    values.push(data.price);
  }

  if ("category_id" in data) {
    const categoryId = Number(data.category_id);

    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
      return NextResponse.json(
        { error: "A valid category_id is required" },
        { status: 400 }
      );
    }

    const [categories] = await pool.execute<CategoryRow[]>(
      "SELECT category_id FROM category WHERE category_id = ?",
      [categoryId]
    );

    if (categories.length === 0) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    updates.push("category_id = ?");
    values.push(categoryId);
  }

  if ("is_available" in data) {
    const available = data.is_available;

    if (
      !(
        available === true ||
        available === false ||
        available === 1 ||
        available === 0
      )
    ) {
      return NextResponse.json(
        { error: "is_available must be true, false, 1, or 0" },
        { status: 400 }
      );
    }

    updates.push("is_available = ?");
    values.push(available === true || available === 1 ? 1 : 0);
  }

  if ("manager_id" in data) {
    const managerId = Number(data.manager_id);

    if (!Number.isSafeInteger(managerId) || managerId <= 0) {
      return NextResponse.json(
        { error: "A valid manager_id is required" },
        { status: 400 }
      );
    }

    const [managers] = await pool.execute<ManagerRow[]>(
      "SELECT user_id, role FROM users WHERE user_id = ?",
      [managerId]
    );

    if (
      managers.length === 0 ||
      !["Staff", "Admin"].includes(managers[0].role)
    ) {
      return NextResponse.json(
        { error: "Manager must be an existing Staff or Admin user" },
        { status: 400 }
      );
    }

    updates.push("manager_id = ?");
    values.push(managerId);
  }

  try {
    const [existing] = await pool.execute<FoodItemRow[]>(
      "SELECT item_id FROM food_item WHERE item_id = ?",
      [itemId]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Food item not found" },
        { status: 404 }
      );
    }

    values.push(itemId);

    await pool.execute<ResultSetHeader>(
      `UPDATE food_item SET ${updates.join(", ")} WHERE item_id = ?`,
      values
    );

    const [updated] = await pool.execute<FoodItemRow[]>(
      `SELECT item_id, name, description, price, is_available,
              category_id, manager_id
       FROM food_item WHERE item_id = ?`,
      [itemId]
    );

    return NextResponse.json({
      message: "Food item updated successfully",
      food_item: updated[0],
    });
  } catch (error) {
    if (isDatabaseError(error, "ER_NO_REFERENCED_ROW_2")) {
      return NextResponse.json(
        { error: "The selected category or manager is invalid" },
        { status: 400 }
      );
    }

    console.error("Failed to update food item:", error);

    return NextResponse.json(
      { error: "Failed to update food item" },
      { status: 500 }
    );
  }
}

// DELETE /api/food-items/1
// Soft delete: preserve the item and its historical order references.
export async function DELETE(_request: Request, context: RouteContext) {
  const itemId = await parseId(context);

  if (itemId === null) {
    return NextResponse.json(
      { error: "A valid food item ID is required" },
      { status: 400 }
    );
  }

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      "UPDATE food_item SET is_available = 0 WHERE item_id = ?",
      [itemId]
    );

    if (result.affectedRows === 0) {
      const [existing] = await pool.execute<FoodItemRow[]>(
        "SELECT item_id FROM food_item WHERE item_id = ?",
        [itemId]
      );

      if (existing.length === 0) {
        return NextResponse.json(
          { error: "Food item not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({
      message: "Food item deactivated successfully",
      item_id: itemId,
      is_available: 0,
    });
  } catch (error) {
    console.error("Failed to deactivate food item:", error);

    return NextResponse.json(
      { error: "Failed to deactivate food item" },
      { status: 500 }
    );
  }
}