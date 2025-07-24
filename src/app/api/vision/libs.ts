import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import z, { ZodSchema } from "zod";

export const ExamPersonalInfoSchema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  student_id: z.string(),
  evaluation_number: z.string(),
  confidence: z.number(),
});

export type ExamPersonalInfoType = z.infer<typeof ExamPersonalInfoSchema>;

// Initialize OpenAI client with lazy evaluation
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * Makes a call to OpenAI with the given system and user prompts
 * @param systemPrompt The system prompt to use
 * @param userPrompt The user prompt to use
 * @param options Additional options for the OpenAI API call
 * @returns The parsed response from OpenAI
 */
export async function callOpenAI<T>(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  responseSchema?: ZodSchema,
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<T> {
  const { model = "gpt-4o", maxTokens, temperature } = options;

  const openai = getOpenAIClient(); // Check for API key here instead

  const completion = await openai.chat.completions.parse({
    model,
    messages,
    ...(responseSchema && {
      response_format: zodResponseFormat(responseSchema, typeof responseSchema),
    }),
    ...(maxTokens && { max_tokens: maxTokens }),
    ...(temperature !== undefined && { temperature }),
  });

  const content = completion.choices[0].message.parsed || {};

  return content as T;
}
