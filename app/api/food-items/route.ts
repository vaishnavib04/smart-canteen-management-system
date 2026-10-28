import { NextResponse } from "next/server";
import pool from "@/src/lib/db";
import type {
  RowDataPacket,
  ResultSetHeader,
  PoolConnection,
} from "mysql2/promise";

export const runtime = "nodejs";

interface FoodItemRow extends RowDataPacket {
  item_id: number;
  name: string;
  description: string | null;
  price: string;
  is_available: number;
  category_id: number;
  category_name: string;
  inventory_id: number;
  quantity_available: number;
  reorder_level: number;
}

export async function GET() {
  try {
    const [items] = await pool.query<FoodItemRow[]>(`
      SELECT
        f.item_id,
        f.name,
        f.description,
        f.price,
        f.is_available,
        f.category_id,
        c.category_name,
        f.inventory_id,
        i.quantity_available,
        i.reorder_level
      FROM food_item f
      JOIN category c ON c.category_id = f.category_id
      JOIN inventory i ON i.inventory_id = f.inventory_id
      ORDER BY f.name
    `);

    return NextResponse.json({ food_items: items });
  } catch (error) {
    console.error("Failed to fetch food items:", error);

    return NextResponse.json(
      { error: "Failed to fetch food items" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let connection: PoolConnection | undefined;

  try {
    const body = await request.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : null;
    const price = Number(body.price);
    const categoryId = Number(body.category_id);
    const quantity = Number(body.quantity_available ?? 0);
    const reorderLevel = Number(body.reorder_level ?? 10);
    const managerId = Number(body.manager_id);

    if (
      !name ||
      name.length > 150 ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isInteger(categoryId) ||
      categoryId <= 0 ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      !Number.isInteger(reorderLevel) ||
      reorderLevel < 0 ||
      !Number.isInteger(managerId) ||
      managerId <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid food item or inventory details" },
        { status: 400 }
      );
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [categories] = await connection.execute<RowDataPacket[]>(
      "SELECT category_id FROM category WHERE category_id = ?",
      [categoryId]
    );

    if (categories.length === 0) {
      await connection.rollback();
      return NextResponse.json(
        { error: "Category not found" },
        { status: 400 }
      );
    }

    const [managers] = await connection.execute<RowDataPacket[]>(
      "SELECT user_id FROM users WHERE user_id = ? AND role IN ('Staff', 'Admin')",
      [managerId]
    );

    if (managers.length === 0) {
      await connection.rollback();
      return NextResponse.json(
        { error: "Manager must be an existing Staff or Admin user" },
        { status: 400 }
      );
    }

    const [inventoryResult] = await connection.execute<ResultSetHeader>(
      "INSERT INTO inventory (quantity_available, reorder_level) VALUES (?, ?)",
      [quantity, reorderLevel]
    );

    const inventoryId = inventoryResult.insertId;

    const [foodResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO food_item
        (name, description, price, is_available, category_id, manager_id, inventory_id)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
      [
        name,
        description || null,
        price,
        categoryId,
        managerId,
        inventoryId,
      ]
    );

    await connection.commit();

    return NextResponse.json(
      {
        message: "Food item created successfully",
        item_id: foodResult.insertId,
        inventory_id: inventoryId,
      },
      { status: 201 }
    );
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Failed to create food item:", error);

    return NextResponse.json(
      { error: "Failed to create food item" },
      { status: 500 }
    );
  } finally {
    connection?.release();
  }
}