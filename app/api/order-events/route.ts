import { NextResponse } from "next/server";
import clientPromise from "@/src/lib/mongodb";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const orderId = Number(body.order_id);
    const event = body.event;
    const details = body.details ?? {};

    if (
      !Number.isInteger(orderId) ||
      orderId <= 0 ||
      typeof event !== "string" ||
      event.trim().length === 0 ||
      event.length > 100
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

    const databaseName =
      process.env.MONGODB_DATABASE || "smart_canteen_logs";

    await client.db(databaseName).collection("order_events").insertOne({
      order_id: orderId,
      event: event.trim(),
      details,
      timestamp: new Date(),
    });

    return NextResponse.json(
      { message: "Order event logged successfully", order_id: orderId },
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