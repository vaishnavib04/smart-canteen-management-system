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
      { error: "Only Staff or Admin can view activity logs." },
      { status: 403 }
    );
  }

  await connection();

  try {
    const { searchParams } = new URL(request.url);

    const action = searchParams.get("action");
    const entity = searchParams.get("entity");
    const entityIdParam = searchParams.get("entity_id");
    const summary = searchParams.get("summary") === "true";

    const filter: Record<string, unknown> = {};

    if (action) filter.action = action;
    if (entity) filter.entity = entity;

    if (entityIdParam !== null) {
      const entityId = Number(entityIdParam);

      if (!Number.isSafeInteger(entityId) || entityId <= 0) {
        return NextResponse.json(
          { error: "Invalid entity_id" },
          { status: 400 }
        );
      }

      filter.entity_id = entityId;
    }

    const client = await clientPromise;
    const collection = client
      .db(process.env.MONGODB_DATABASE || "smart_canteen_logs")
      .collection("activity_logs");

    if (summary) {
      const results = await collection
        .aggregate([
          { $match: filter },
          {
            $group: {
              _id: "$action",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ])
        .toArray();

      return NextResponse.json({
        message: "Activity summary retrieved successfully",
        summary: results,
      });
    }

    const logs = await collection
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error("Failed to retrieve activity logs:", error);

    return NextResponse.json(
      { error: "Failed to retrieve activity logs" },
      { status: 500 }
    );
  }
}