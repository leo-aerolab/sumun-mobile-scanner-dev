import { NextRequest, NextResponse } from "next/server";

const FLASK_SERVER_URL =
  process.env.FLASK_SERVER_URL || "http://localhost:4000";

export async function POST(request: NextRequest) {
  try {
    // Get the form data from the request
    const formData = await request.formData();

    // Validate required fields
    const examId = formData.get("exam_id") as string;
    const imageFile = formData.get("image") as File;

    if (!examId || !imageFile) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: exam_id and image are required",
        },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid file type. Only PNG, JPG, and JPEG files are allowed.",
        },
        { status: 400 }
      );
    }

    // Validate file size (16MB limit)
    const maxSize = 16 * 1024 * 1024; // 16MB
    if (imageFile.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: "File too large. Maximum size is 16MB.",
        },
        { status: 400 }
      );
    }

    // Forward the request to the Flask server
    const flaskFormData = new FormData();
    flaskFormData.append("exam_id", examId);
    flaskFormData.append("image", imageFile);

    const response = await fetch(`${FLASK_SERVER_URL}/process-exam`, {
      method: "POST",
      body: flaskFormData,
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error processing exam:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error while processing exam",
      },
      { status: 500 }
    );
  }
}
