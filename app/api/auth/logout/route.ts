import { NextResponse } from "next/server";
import { destroySession } from "@/src/lib/auth";

export async function POST() {
  try {
    await destroySession();

    return NextResponse.json({
      message: "Logout successful.",
    });
  } catch (error) {
    console.error("Logout failed:", error);

    return NextResponse.json(
      { error: "Unable to process logout." },
      { status: 500 }
    );
  }
}