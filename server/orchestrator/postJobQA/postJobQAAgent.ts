import { db } from "../../db";
import { jobs, jobPhotos, csatRecords, insertJobPhotoSchema, insertCsatRecordSchema } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Twilio client (placeholder - requires actual Twilio setup)
// import twilio from "twilio";
// const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// ============================================
// Type Definitions
// ============================================

export interface PostJobQAInput {
  jobId: number;
  businessId: number;
  crewMemberId?: number;
  photoUrls?: string[];
  crewNotes?: string;
}

export interface PostJobQAResult {
  success: boolean;
  csatRecordId?: number;
  jobUpdated: boolean;
  photosProcessed: number;
  satisfactionPromptSent: boolean;
  error?: string;
}

export interface SatisfactionResponseResult {
  success: boolean;
  nextAction: "rating_prompt" | "escalate" | "none";
  csatRecordId?: number;
  isSatisfied?: boolean;
}

// ============================================
// Main Post-Job QA Agent
// ============================================

/**
 * Post-Job QA Agent
 * Runs immediately after job completion to:
 * 1. Update job status to completed
 * 2. Process and store crew photos with AI captions
 * 3. Send satisfaction prompt via SMS
 * 4. Create CSAT record for tracking
 */
export async function runPostJobQAAgent(input: PostJobQAInput): Promise<PostJobQAResult> {
  try {
    console.log(`[PostJobQAAgent] Starting for job ${input.jobId}`);

    // Step 1: Update job status to completed (non-blocking)
    const jobUpdateResult = await db
      .update(jobs)
      .set({ status: "completed" })
      .where(eq(jobs.id, input.jobId))
      .returning();

    if (!jobUpdateResult || jobUpdateResult.length === 0) {
      throw new Error(`Job ${input.jobId} not found`);
    }

    const job = jobUpdateResult[0];
    console.log(`[PostJobQAAgent] Job ${input.jobId} marked as completed`);

    // Step 2: Process job photos if provided
    let photosProcessed = 0;
    if (input.photoUrls && input.photoUrls.length > 0) {
      photosProcessed = await processJobPhotos(input.jobId, input.photoUrls, input.crewMemberId);
      console.log(`[PostJobQAAgent] Processed ${photosProcessed} photos`);
    }

    // Step 3: Create CSAT record
    const csatRecord = await db
      .insert(csatRecords)
      .values({
        jobId: input.jobId,
        businessId: input.businessId,
        customerPhone: job.customerPhone,
        customerName: job.customerName,
        status: "satisfaction_prompt_sent",
        satisfactionPromptSentAt: new Date(),
      })
      .returning();

    const csatRecordId = csatRecord[0].id;
    console.log(`[PostJobQAAgent] Created CSAT record ${csatRecordId}`);

    // Step 4: Send satisfaction prompt via SMS
    const satisfactionPromptSent = await sendSatisfactionPrompt(
      job.customerPhone,
      job.customerName || "Customer",
      input.businessId
    );

    console.log(`[PostJobQAAgent] Satisfaction prompt sent: ${satisfactionPromptSent}`);

    // Step 5: Schedule 24h timeout for rating prompt (would use BullMQ in production)
    // await scheduleRatingPromptTimeout(csatRecordId, 24 * 60 * 60 * 1000);

    return {
      success: true,
      csatRecordId,
      jobUpdated: true,
      photosProcessed,
      satisfactionPromptSent,
    };
  } catch (error) {
    console.error(`[PostJobQAAgent] Error:`, error);
    return {
      success: false,
      jobUpdated: false,
      photosProcessed: 0,
      satisfactionPromptSent: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Photo Processing
// ============================================

/**
 * Process job photos with AI caption generation
 */
async function processJobPhotos(
  jobId: number,
  photoUrls: string[],
  crewMemberId?: number
): Promise<number> {
  let processedCount = 0;

  for (const photoUrl of photoUrls) {
    try {
      // Generate AI caption using GPT-4 Vision
      const aiCaption = await generatePhotoCaption(photoUrl);
      const aiTags = extractTagsFromCaption(aiCaption);

      // Insert photo record
      await db.insert(jobPhotos).values({
        jobId,
        photoUrl,
        aiCaption,
        aiTags,
        uploadedByCrewMemberId: crewMemberId,
        status: "uploaded",
      });

      processedCount++;
      console.log(`[PostJobQAAgent] Processed photo: ${photoUrl.substring(0, 50)}...`);
    } catch (error) {
      console.error(`[PostJobQAAgent] Failed to process photo ${photoUrl}:`, error);
      // Continue processing other photos even if one fails
    }
  }

  return processedCount;
}

/**
 * Generate AI caption for a job photo using GPT-4 Vision
 */
async function generatePhotoCaption(photoUrl: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this lawn care/landscaping job completion photo in 1-2 sentences. Focus on what work was completed, the quality, and any notable details.",
            },
            {
              type: "image_url",
              image_url: {
                url: photoUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 100,
    });

    return response.choices[0]?.message?.content || "Photo of completed lawn care work.";
  } catch (error) {
    console.error(`[PostJobQAAgent] Error generating AI caption:`, error);
    return "Photo of completed work.";
  }
}

/**
 * Extract searchable tags from photo caption
 */
function extractTagsFromCaption(caption: string): string[] {
  const tags: string[] = [];
  const keywords = [
    "mowing",
    "edging",
    "trimming",
    "mulch",
    "cleanup",
    "blowing",
    "hedges",
    "bushes",
    "lawn",
    "grass",
    "leaves",
    "debris",
  ];

  const lowerCaption = caption.toLowerCase();
  for (const keyword of keywords) {
    if (lowerCaption.includes(keyword)) {
      tags.push(keyword);
    }
  }

  return tags;
}

// ============================================
// SMS Communication
// ============================================

/**
 * Send satisfaction prompt via SMS
 */
async function sendSatisfactionPrompt(
  customerPhone: string,
  customerName: string,
  businessId: number
): Promise<boolean> {
  try {
    const message = `Hi ${customerName}, we just completed your lawn service! Are you satisfied with the work? Reply YES or NO.`;

    // TODO: Integrate with actual Twilio API
    // await twilioClient.messages.create({
    //   body: message,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: customerPhone,
    // });

    console.log(`[PostJobQAAgent] Would send SMS to ${customerPhone}: ${message}`);
    return true;
  } catch (error) {
    console.error(`[PostJobQAAgent] Failed to send satisfaction prompt:`, error);
    return false;
  }
}

// ============================================
// Inbound Response Handler
// ============================================

/**
 * Handle customer satisfaction response (YES/NO)
 */
export async function handleSatisfactionResponse(
  from: string,
  body: string,
  receivedAt: Date
): Promise<SatisfactionResponseResult> {
  try {
    console.log(`[PostJobQAAgent] Received satisfaction response from ${from}: ${body}`);

    // Find the most recent CSAT record for this customer phone
    const csatRecord = await db.query.csatRecords.findFirst({
      where: (csat, { eq, and, isNull }) =>
        and(eq(csat.customerPhone, from), isNull(csat.satisfactionResponse)),
      orderBy: (csat, { desc }) => [desc(csat.createdAt)],
    });

    if (!csatRecord) {
      console.log(`[PostJobQAAgent] No pending CSAT record found for ${from}`);
      return { success: false, nextAction: "none" };
    }

    // Parse sentiment (YES/NO)
    const sentiment = parseSatisfactionSentiment(body);

    // Update CSAT record
    await db
      .update(csatRecords)
      .set({
        satisfactionResponse: body,
        satisfactionResponseAt: receivedAt,
        isSatisfied: sentiment === "YES",
        status: sentiment === "YES" ? "rating_prompt_sent" : "escalated",
        escalatedAt: sentiment === "NO" ? receivedAt : undefined,
        escalationReason: sentiment === "NO" ? "Customer reported dissatisfaction" : undefined,
      })
      .where(eq(csatRecords.id, csatRecord.id));

    console.log(
      `[PostJobQAAgent] Updated CSAT record ${csatRecord.id} with sentiment: ${sentiment}`
    );

    // Determine next action
    if (sentiment === "YES") {
      // Trigger rating prompt (would be handled by Review Management Agent)
      return {
        success: true,
        nextAction: "rating_prompt",
        csatRecordId: csatRecord.id,
        isSatisfied: true,
      };
    } else if (sentiment === "NO") {
      // Escalate to human for resolution
      return {
        success: true,
        nextAction: "escalate",
        csatRecordId: csatRecord.id,
        isSatisfied: false,
      };
    } else {
      // Unclear response - may need clarification
      return {
        success: true,
        nextAction: "none",
        csatRecordId: csatRecord.id,
      };
    }
  } catch (error) {
    console.error(`[PostJobQAAgent] Error handling satisfaction response:`, error);
    return { success: false, nextAction: "none" };
  }
}

/**
 * Parse YES/NO sentiment from customer response
 */
function parseSatisfactionSentiment(body: string): "YES" | "NO" | "UNCLEAR" {
  const normalized = body.toLowerCase().trim();

  // Positive responses
  if (
    normalized.includes("yes") ||
    normalized.includes("yeah") ||
    normalized.includes("yep") ||
    normalized.includes("sure") ||
    normalized.includes("good") ||
    normalized.includes("great") ||
    normalized.includes("perfect") ||
    normalized.includes("satisfied") ||
    normalized.includes("happy")
  ) {
    return "YES";
  }

  // Negative responses
  if (
    normalized.includes("no") ||
    normalized.includes("nope") ||
    normalized.includes("not satisfied") ||
    normalized.includes("unhappy") ||
    normalized.includes("disappointed") ||
    normalized.includes("bad") ||
    normalized.includes("poor")
  ) {
    return "NO";
  }

  return "UNCLEAR";
}