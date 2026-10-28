import { NextResponse } from "next/server";
import pool from "@/src/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { logActivity } from "@/src/lib/activity-log";

export const runtime = "nodejs";

interface InventoryRow extends RowDataPacket {
  inventory_id: number;
  item_id: number;
  name: string;
  quantity_available: number;
  reorder_level: number;
  is_available: number;
  low_stock: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lowStockOnly = searchParams.get("low_stock") === "true";

    let sql = `
      SELECT
        i.inventory_id,
        f.item_id,
        f.name,
        i.quantity_available,
        i.reorder_level,
        f.is_available,
        CASE
          WHEN i.quantity_available <= i.reorder_level THEN 1
          ELSE 0
        END AS low_stock
      FROM inventory i
      JOIN food_item f ON f.inventory_id = i.inventory_id
    `;

    if (lowStockOnly) {
      sql += " WHERE i.quantity_available <= i.reorder_level";
    }

    sql += " ORDER BY f.name";

    const [items] = await pool.query<InventoryRow[]>(sql);

    return NextResponse.json({
      count: items.length,
      inventory: items,
    });
  } catch (error) {
    console.error("Failed to fetch inventory:", error);

    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const inventoryId = Number(body.inventory_id);
    const quantity = body.quantity_available;
    const reorderLevel = body.reorder_level;

    if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
      return NextResponse.json(
        { error: "A valid inventory_id is required" },
        { status: 400 }
      );
    }

    if (
      (quantity !== undefined &&
        (!Number.isInteger(quantity) || quantity < 0)) ||
      (reorderLevel !== undefined &&
        (!Number.isInteger(reorderLevel) || reorderLevel < 0))
    ) {
      return NextResponse.json(
        { error: "Stock quantity and reorder level must be non-negative integers" },
        { status: 400 }
      );
    }

    if (quantity === undefined && reorderLevel === undefined) {
      return NextResponse.json(
        { error: "Provide quantity_available or reorder_level to update" },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [existing] = await connection.execute<RowDataPacket[]>(
        "SELECT inventory_id FROM inventory WHERE inventory_id = ? FOR UPDATE",
        [inventoryId]
      );

      if (existing.length === 0) {
        await connection.rollback();

        return NextResponse.json(
          { error: "Inventory record not found" },
          { status: 404 }
        );
      }

      const updates: string[] = [];
      const values: number[] = [];

      if (quantity !== undefined) {
        updates.push("quantity_available = ?");
        values.push(quantity);
      }

      if (reorderLevel !== undefined) {
        updates.push("reorder_level = ?");
        values.push(reorderLevel);
      }

      values.push(inventoryId);

      await connection.execute<ResultSetHeader>(
        `UPDATE inventory SET ${updates.join(", ")} WHERE inventory_id = ?`,
        values
      );

      await connection.commit();
      await logActivity({
        action: "INVENTORY_UPDATED",
        entity: "inventory",
        entity_id: inventoryId,
        details: {
          quantity_available: quantity ?? null,
          reorder_level: reorderLevel ?? null,
        },
       });

      return NextResponse.json({
        message: "Inventory updated successfully",
        inventory_id: inventoryId,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Failed to update inventory:", error);

    return NextResponse.json(
      { error: "Failed to update inventory" },
      { status: 500 }
    );
  }
}