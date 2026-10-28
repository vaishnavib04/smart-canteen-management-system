import clientPromise from "@/src/lib/mongodb";

export interface ActivityLog {
  action: string;
  entity: string;
  entity_id: number;
  details: Record<string, unknown>;
  timestamp: Date;
}

export async function logActivity(
  activity: Omit<ActivityLog, "timestamp">
) {
  try {
    const client = await clientPromise;

    const databaseName =
      process.env.MONGODB_DATABASE || "smart_canteen_logs";

    const collection = client
      .db(databaseName)
      .collection<ActivityLog>("activity_logs");

    await collection.insertOne({
      ...activity,
      timestamp: new Date(),
    });
  } catch (error) {
    // Logging failure should not hide whether the main operation succeeded.
    console.error("Failed to save activity log:", error);
  }
}