import { requireStaffOrAdmin } from "@/src/lib/auth";
import { connection, NextResponse } from "next/server";
import clientPromise from "@/src/lib/mongodb";

export async function GET(request: Request) {
  const auth = await requireStaffOrAdmin();

  if (auth.error === "UNAUTHENTICATED") {
    return NextResponse.json(
      { error: "Please log in first." },
      { status: 401 }
    );
  }

  if (auth.error === "FORBIDDEN") {
    return NextResponse.json(
      { error: "Only Staff or Admin can view order events." },
      { status: 403 }
    );
  }

  await connection();

  try {
    const { searchParams } = new URL(request.url);
    const orderIdParam = searchParams.get("order_id");
    const event = searchParams.get("event");
    const summary = searchParams.get("summary") === "true";

    const filter: Record<string, unknown> = {};

    if (orderIdParam !== null) {
      const orderId = Number(orderIdParam);

      if (!Number.isSafeInteger(orderId) || orderId <= 0) {
        return NextResponse.json(
          { error: "Invalid order_id" },
          { status: 400 }
        );
      }

      filter.order_id = orderId;
    }

    if (event) {
      filter.event = event.trim();
    }

    const client = await clientPromise;
    const database = client.db(
      process.env.MONGODB_DATABASE || "smart_canteen_logs"
    );
    const collection = database.collection("order_events");

    if (summary) {
      const results = await collection
        .aggregate([
          { $match: filter },
          {
            $group: {
              _id: "$event",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ])
        .toArray();

      return NextResponse.json({
        message: "Order event summary retrieved successfully",
        summary: results,
      });
    }

    const events = await collection
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({
      count: events.length,
      events,
    });
  } catch (error) {
    console.error("Failed to retrieve order events:", error);

    return NextResponse.json(
      { error: "Failed to retrieve order events" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireStaffOrAdmin();

  if (auth.error === "UNAUTHENTICATED") {
    return NextResponse.json(
      { error: "Please log in first." },
      { status: 401 }
    );
  }

  if (auth.error === "FORBIDDEN") {
    return NextResponse.json(
      { error: "Only Staff or Admin can create order events." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    const orderId = Number(body.order_id);
    const event = body.event;
    const details = body.details ?? {};

    if (
      !Number.isSafeInteger(orderId) ||
      orderId <= 0 ||
      typeof event !== "string" ||
      event.trim().length === 0 ||
      event.trim().length > 100
    ) {
      return NextResponse.json(
        { error: "Valid order_id and event are required" },
        { status: 400 }
      );
    }

    if (
      details === null ||
      typeof details !== "object" ||
      Array.isArray(details)
    ) {
      return NextResponse.json(
        { error: "details must be an object" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const database = client.db(
      process.env.MONGODB_DATABASE || "smart_canteen_logs"
    );

    await database.collection("order_events").insertOne({
      order_id: orderId,
      event: event.trim(),
      details,
      timestamp: new Date(),
    });

    return NextResponse.json(
      {
        message: "Order event logged successfully",
        order_id: orderId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to log order event:", error);

    return NextResponse.json(
      { error: "Failed to log order event" },
      { status: 500 }
    );
  }
}