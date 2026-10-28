import { NextResponse } from "next/server";
import pool from "@/src/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { logActivity } from "@/src/lib/activity-log";

interface OrderRow extends RowDataPacket {
  order_id: number;
  order_date: Date;
  status: string;
  total_amount: string;
  user_id: number;
  user_name: string;
  slot_id: number | null;
}

interface OrderItemRow extends RowDataPacket {
  item_id: number;
  name: string;
  quantity: number;
  price_at_order: string;
}

interface UserRow extends RowDataPacket {
  user_id: number;
}

interface SlotRow extends RowDataPacket {
  slot_id: number;
  max_capacity: number;
}

interface FoodRow extends RowDataPacket {
  item_id: number;
  name: string;
  price: string;
  inventory_id: number;
  quantity_available: number;
  is_available: number;
}

interface InventoryRow extends RowDataPacket {
  inventory_id: number;
  quantity_available: number;
}

interface CountRow extends RowDataPacket {
  order_count: number;
}

interface CreatedOrderRow extends RowDataPacket {
  order_id: number;
}

// GET /api/orders
// Optional: /api/orders?user_id=1
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get("user_id");

    let sql = `
      SELECT
        o.order_id,
        o.order_date,
        o.status,
        o.total_amount,
        o.user_id,
        u.name AS user_name,
        o.slot_id
      FROM orders o
      JOIN users u ON u.user_id = o.user_id
    `;

    const params: number[] = [];

    if (userIdParam !== null) {
      const userId = Number(userIdParam);

      if (!Number.isInteger(userId) || userId <= 0) {
        return NextResponse.json(
          { error: "A valid user_id is required" },
          { status: 400 }
        );
      }

      sql += " WHERE o.user_id = ?";
      params.push(userId);
    }

    sql += " ORDER BY o.order_date DESC, o.order_id DESC";

    const [orders] = await pool.execute<OrderRow[]>(sql, params);

    const result = [];

    for (const order of orders) {
      const [items] = await pool.execute<OrderItemRow[]>(
        `SELECT oi.item_id, f.name, oi.quantity, oi.price_at_order
         FROM order_item oi
         JOIN food_item f ON f.item_id = oi.item_id
         WHERE oi.order_id = ?
         ORDER BY oi.item_id`,
        [order.order_id]
      );

      result.push({
        ...order,
        items,
      });
    }

    return NextResponse.json({
      count: result.length,
      orders: result,
    });
  } catch (error) {
    console.error("Failed to fetch orders:", error);

    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

// POST /api/orders
//
// Example body:
// {
//   "user_id": 1,
//   "slot_id": 2,
//   "items": [
//     { "item_id": 1, "quantity": 2 },
//     { "item_id": 3, "quantity": 1 }
//   ]
// }
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

  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const data = body as Record<string, unknown>;
  const userIdValue = data.user_id;
  const slotIdValue = data.slot_id;
  const requestedItems = data.items;

  if (
    typeof userIdValue !== "number" ||
    !Number.isSafeInteger(userIdValue) ||
    userIdValue <= 0
  ) {
    return NextResponse.json(
      { error: "A valid user_id is required" },
      { status: 400 }
    );
  }

  const userId: number = userIdValue;

  if (
    slotIdValue !== undefined &&
    slotIdValue !== null &&
    (
      typeof slotIdValue !== "number" ||
      !Number.isSafeInteger(slotIdValue) ||
      slotIdValue <= 0
    )
  ) {
    return NextResponse.json(
      { error: "slot_id must be a positive integer" },
      { status: 400 }
    );
  }

  const slotId: number | null | undefined =
    slotIdValue as number | null | undefined;

  if (
    !Array.isArray(requestedItems) ||
    requestedItems.length === 0 ||
    requestedItems.length > 50
  ) {
    return NextResponse.json(
      { error: "Provide between 1 and 50 order items" },
      { status: 400 }
    );
  }

  const quantities = new Map<number, number>();

  for (const item of requestedItems) {
    if (
      item === null ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      return NextResponse.json(
        { error: "Each item must be an object" },
        { status: 400 }
      );
    }

    const line = item as Record<string, unknown>;
    const itemId = line.item_id;
    const quantity = line.quantity;

    if (
        typeof itemId !== "number" ||
        !Number.isSafeInteger(itemId) ||
        itemId <= 0 ||
        typeof quantity !== "number" ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0 ||
        quantity > 1000
    ) {
      return NextResponse.json(
        {
          error:
            "Each item needs a positive integer item_id and quantity (maximum 1000)",
        },
        { status: 400 }
      );
    }

    // Combine repeated item IDs instead of creating duplicate lines.
    const id = Number(itemId);
    const totalQuantity = (quantities.get(id) ?? 0) + Number(quantity);

    if (totalQuantity > 1000) {
      return NextResponse.json(
        { error: "Total quantity per item cannot exceed 1000" },
        { status: 400 }
      );
    }

    quantities.set(id, totalQuantity);
  }

  const connection = await pool.getConnection();

  let orderId: number | undefined;
  let totalAmount = 0;

  try {
    await connection.beginTransaction();

    // Validate that the user exists.
    const [users] = await connection.execute<UserRow[]>(
      "SELECT user_id FROM users WHERE user_id = ?",
      [userId]
    );

    if (users.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Lock the selected pickup slot while checking capacity.
    if (slotId !== undefined && slotId !== null) {
      const [slots] = await connection.execute<SlotRow[]>(
        "SELECT slot_id, max_capacity FROM pickup_slot WHERE slot_id = ? FOR UPDATE",
        [slotId]
      );

      if (slots.length === 0) {
        await connection.rollback();

        return NextResponse.json(
          { error: "Pickup slot not found" },
          { status: 404 }
        );
      }

      const [counts] = await connection.execute<CountRow[]>(
        `SELECT COUNT(*) AS order_count
         FROM orders
         WHERE slot_id = ?
           AND status <> 'Cancelled'`,
        [slotId]
      );

      if (Number(counts[0].order_count) >= slots[0].max_capacity) {
        await connection.rollback();

        return NextResponse.json(
          { error: "Pickup slot is full" },
          { status: 409 }
        );
      }
    }

    // Sort item IDs to keep the locking order consistent.
    const itemIds = [...quantities.keys()].sort((a, b) => a - b);
    const placeholders = itemIds.map(() => "?").join(", ");

    // Fetch the food items and their inventory references.
    const [foodRows] = await connection.execute<FoodRow[]>(
      `SELECT
         f.item_id,
         f.name,
         f.price,
         f.inventory_id,
         f.is_available,
         i.quantity_available
       FROM food_item f
       JOIN inventory i ON i.inventory_id = f.inventory_id
       WHERE f.item_id IN (${placeholders})
       ORDER BY i.inventory_id, f.item_id`,
      itemIds
    );

    if (foodRows.length !== itemIds.length) {
      await connection.rollback();

      return NextResponse.json(
        { error: "One or more food items do not exist" },
        { status: 404 }
      );
    }

    // Explicitly lock inventory rows in ascending inventory_id order.
    const inventoryIds = [
      ...new Set(foodRows.map((food) => Number(food.inventory_id))),
    ].sort((a, b) => a - b);

    for (const inventoryId of inventoryIds) {
      const [inventoryRows] = await connection.execute<InventoryRow[]>(
        `SELECT inventory_id, quantity_available
         FROM inventory
         WHERE inventory_id = ?
         FOR UPDATE`,
        [inventoryId]
      );

      if (inventoryRows.length === 0) {
        await connection.rollback();

        return NextResponse.json(
          { error: `Inventory record ${inventoryId} not found` },
          { status: 404 }
        );
      }
    }

    // Validate availability, stock and calculate the total using DB prices.
    const totalCents = 0;
    let calculatedCents = totalCents;

    for (const food of foodRows) {
      if (Number(food.is_available) !== 1) {
        await connection.rollback();

        return NextResponse.json(
          { error: `${food.name} is currently unavailable` },
          { status: 409 }
        );
      }

      const quantity = quantities.get(Number(food.item_id))!;
      const stock = Number(food.quantity_available);

      if (stock < quantity) {
        await connection.rollback();

        return NextResponse.json(
          {
            error: `Insufficient stock for ${food.name}`,
            available: stock,
            requested: quantity,
          },
          { status: 409 }
        );
      }

      const priceCents = Math.round(Number(food.price) * 100);

      if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
        throw new Error(`Invalid database price for item ${food.item_id}`);
      }

      calculatedCents += priceCents * quantity;
    }

    totalAmount = calculatedCents / 100;

    // Create the order.
    const [orderResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO orders (user_id, slot_id, status, total_amount)
       VALUES (?, ?, 'Pending', ?)`,
      [userId, slotId ?? null, totalAmount.toFixed(2)]
    );

    orderId = orderResult.insertId;

    // Insert each order line and deduct stock through the stored procedure.
    for (const food of foodRows) {
      const itemId = Number(food.item_id);
      const inventoryId = Number(food.inventory_id);
      const quantity = quantities.get(itemId)!;
      const price = Number(food.price);
      const newStock = Number(food.quantity_available) - quantity;

      await connection.execute(
        `INSERT INTO order_item
           (order_id, item_id, quantity, price_at_order)
         VALUES (?, ?, ?, ?)`,
        [orderId, itemId, quantity, price.toFixed(2)]
      );

      await connection.execute(
        "CALL UpdateInventoryStock(?, ?)",
        [inventoryId, newStock]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();

    console.error("Failed to create order:", error);

    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  } finally {
    connection.release();
  }

  // Log activity after the SQL transaction commits.
  // Logging failure must not turn a successfully created order into a failed response.
  try {
    await logActivity({
      action: "ORDER_CREATED",
      entity: "orders",
      entity_id: orderId!,
      details: {
        user_id: userId,
        slot_id: slotId ?? null,
        items: [...quantities.entries()].map(([item_id, quantity]) => ({
          item_id,
          quantity,
        })),
        total_amount: totalAmount,
      },
    });
  } catch (error) {
    console.error("Order created, but activity logging failed:", error);
  }

  return NextResponse.json(
    {
      message: "Order created successfully",
      order_id: orderId,
      user_id: userId,
      slot_id: slotId ?? null,
      total_amount: totalAmount.toFixed(2),
      status: "Pending",
    },
    { status: 201 }
  );
}