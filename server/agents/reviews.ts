import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI();

const reviewResponseSchema = z.object({
  message: z.string(),
  includeLink: z.boolean(),
});

export async function generateReviewRequest(
  businessName: string,
  customerName?: string,
  serviceType?: string
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a friendly customer service assistant for ${businessName}, a landscaping company.
Generate a brief, warm SMS message asking the customer to leave a review after their service.
Keep it under 160 characters if possible.
Be genuine and appreciative, not pushy.
Return JSON: { "message": "string", "includeLink": boolean }`,
        },
        {
          role: "user",
          content: `Customer: ${customerName || "Valued customer"}
Service completed: ${serviceType || "landscaping service"}
Generate a review request message.`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 256,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = reviewResponseSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      throw new Error("Invalid response format");
    }

    return parsed.data.message;
  } catch (error) {
    console.error("[Reviews Agent] Error:", error);
    const greeting = customerName ? `Hi ${customerName}! ` : "";
    return `${greeting}Thanks for choosing ${businessName}! We hope you loved your ${serviceType || "service"}. If you have a moment, we'd really appreciate a review. Thank you!`;
  }
}
