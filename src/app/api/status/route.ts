import { NextResponse } from "next/server";

const FLASK_SERVER_URL =
  process.env.FLASK_SERVER_URL || "http://localhost:4000";

export async function GET() {
  try {
    // Test connection to Flask server
    const healthResponse = await fetch(`${FLASK_SERVER_URL}/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const flaskHealth = await healthResponse.json();
    const isFlaskHealthy =
      healthResponse.ok && flaskHealth.status === "healthy";

    return NextResponse.json({
      nextjs: {
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
      },
      flask: {
        status: isFlaskHealthy ? "healthy" : "unhealthy",
        url: FLASK_SERVER_URL,
        response: flaskHealth,
        reachable: healthResponse.ok,
      },
      connection: {
        status: isFlaskHealthy ? "connected" : "disconnected",
        message: isFlaskHealthy
          ? "Successfully connected to Flask processing server"
          : "Unable to reach Flask processing server",
      },
    });
  } catch (error) {
    console.error("Error checking Flask server status:", error);

    return NextResponse.json(
      {
        nextjs: {
          status: "healthy",
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || "development",
        },
        flask: {
          status: "unreachable",
          url: FLASK_SERVER_URL,
          error: error instanceof Error ? error.message : "Unknown error",
          reachable: false,
        },
        connection: {
          status: "disconnected",
          message: "Flask processing server is not reachable",
        },
      },
      { status: 503 }
    );
  }
}
