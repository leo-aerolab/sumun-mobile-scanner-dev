import z from "zod";
import {
  callOpenAI,
  ExamPersonalInfoSchema,
  ExamPersonalInfoType,
} from "./libs";

// Request body schema
const RequestBodySchema = z.object({
  image: z.string(), // base64 encoded JPG image
  students: z
    .array(
      z.object({
        name: z.string(),
        lastname: z.string(),
        id: z.string(),
      })
    )
    .optional(),
});

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { image, students } = RequestBodySchema.parse(body);

    // Build students list text for the prompt
    let studentsListText = "";
    if (students && students.length > 0) {
      const studentsNames = students
        .map((s) => `${s.name} ${s.lastname}`)
        .join(", ");
      studentsListText = `\n\nPossible students in this exam:\n${studentsNames}\n\nIf the extracted text matches one of these students, use that exact name and lastname. Otherwise, use the extracted text as-is.`;
    }

    // Call OpenAI with the provided image
    // OpenAI only returns first_name, last_name, and confidence
    // student_id is added after matching
    const result = await callOpenAI<Omit<ExamPersonalInfoType, "student_id">>(
      [
        {
          role: "system",
          content: `You are an OCR system that extracts handwritten text from an exam.
The student is from a latin-american, spanish-speaking country

Rules:
- Only extract text from the specified fields.
- The labels for the fields are below the handwritten area.
- The labels are: "NOMBRE COMPLETO", "APELLIDO COMPLETO".
- The confidence field goes from 0.0 to 1.0, where 0.0 is completely unreadable and 1.0 is completely readable.
- Do not include any explanation, just the JSON object
- Focus on handwritten text recognition${studentsListText}`,
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
      ExamPersonalInfoSchema.omit({
        student_id: true,
      })
    );

    // Match extracted name with students list to get student_id
    let studentId = "";

    if (
      students &&
      students.length > 0 &&
      result.first_name &&
      result.last_name
    ) {
      // Normalize strings for comparison (trim, lowercase, remove accents)
      const normalizeString = (str: string) =>
        str
          .toLowerCase()
          .trim()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, ""); // Remove accents

      const extractedFirstName = normalizeString(result.first_name);
      const extractedLastName = normalizeString(result.last_name);

      const matchedStudent = students.find((student) => {
        const studentFirstName = normalizeString(student.name);
        const studentLastName = normalizeString(student.lastname);
        return (
          studentFirstName === extractedFirstName &&
          studentLastName === extractedLastName
        );
      });

      if (matchedStudent) {
        studentId = matchedStudent.id;
      }
    }

    // Combine OpenAI result with matched student_id
    const finalResult: ExamPersonalInfoType = {
      ...result,
      student_id: studentId,
    };

    console.log(finalResult);
    return Response.json(finalResult);
  } catch (error) {
    console.error("Error processing vision request:", error);
    return Response.json(
      { error: "Failed to process the image" },
      { status: 500 }
    );
  }
}
