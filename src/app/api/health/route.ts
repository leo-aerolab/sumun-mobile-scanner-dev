import { NextResponse } from "next/server";

const FLASK_SERVER_URL =
  process.env.FLASK_SERVER_URL || "http://localhost:4000";

export async function GET() {
  try {
    const response = await fetch(`${FLASK_SERVER_URL}/health`);
    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error connecting to Flask server:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Unable to connect to processing server",
        status: "unhealthy",
      },
      { status: 503 }
    );
  }
}
