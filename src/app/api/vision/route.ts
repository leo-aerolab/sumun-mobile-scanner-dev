import z from "zod";
import {
  callOpenAI,
  ExamPersonalInfoSchema,
  ExamPersonalInfoType,
} from "./libs";

// Request body schema
const RequestBodySchema = z.object({
  image: z.string(), // base64 encoded JPG image
});

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { image } = RequestBodySchema.parse(body);

    // Call OpenAI with the provided image
    const result = await callOpenAI<ExamPersonalInfoType>(
      [
        {
          role: "system",
          content: `You are an OCR system that extracts handwritten text from an exam.
The student is from a latin-american, spanish-speaking country

Rules:
- Only extract text from the specified fields.
- The labels for the fields are below the handwritten area.
- The labels are: "NOMBRE", "APELLIDO".
- The confidence field goes from 0.0 to 1.0, where 0.0 is completely unreadable and 1.0 is completely readable.
- Do not include any explanation, just the JSON object
- Focus on handwritten text recognition`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract the students info (first_name, last_name)`,
            },
            {
              type: "image_url",
              image_url: {
                url: `${image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      ExamPersonalInfoSchema
    );

    console.log(result);
    return Response.json(result);
  } catch (error) {
    console.error("Error processing vision request:", error);
    return Response.json(
      { error: "Failed to process the image" },
      { status: 500 }
    );
  }
}
