import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import {
  users,
  crews,
  crewMembers,
  jobs,
  jobCrewAssignments,
  crewStatusUpdates,
  dailyScheduleAcceptances,
  workRequests,
  payrollPreferences,
  eventOutbox,
} from "@shared/schema";
import { eq, and, desc, gte, sql, or } from "drizzle-orm";
import { z } from "zod";

// ============================================
// Mobile API Authentication Middleware
// ============================================

interface MobileAuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    businessId: number | null;
    crewId: number | null;
  };
}

// Middleware to require mobile authentication
export function requireMobileAuth(
  req: MobileAuthRequest,
  res: Response,
  next: NextFunction
) {
  // Check if user is authenticated (from session middleware)
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Verify user has mobile crew role
  const allowedRoles = ["crew_lead", "crew_leader", "staff", "crew_member", "owner", "admin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: "Forbidden: Mobile access requires crew role" });
  }

  next();
}

// Helper to get user's crew ID
async function getUserCrewId(userId: number): Promise<number | null> {
  const member = await db
    .select()
    .from(crewMembers)
    .where(and(eq(crewMembers.userId, userId), eq(crewMembers.isActive, true)))
    .limit(1);

  return member[0]?.crewId || null;
}

// ============================================
// Mobile Routes Registration
// ============================================

export function registerMobileRoutes(app: Express) {
  // ============================================
  // GET /api/mobile/dashboard/today
  // ============================================
  app.get("/api/mobile/dashboard/today", requireMobileAuth, async (req: MobileAuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const { since } = req.query;

      // Get user's crew
      const crewId = await getUserCrewId(userId);

      // Build base query for today's jobs
      const today = new Date().toISOString().split('T')[0];

      // Get jobs for today (crew-filtered)
      let jobsToday: any[] = [];

      if (crewId) {
        // Build query with crew filter
        const baseConditions = [sql`DATE(${jobs.scheduledDate}) = ${today}`];

        if (since && typeof since === 'string') {
          baseConditions.push(gte(jobs.updatedAt, new Date(since)));
        }

        jobsToday = await db
          .select({
            id: jobs.id,
            conversationId: jobs.conversationId,
            businessId: jobs.businessId,
            customerName: jobs.customerName,
            customerPhone: jobs.customerPhone,
            customerAddress: jobs.customerAddress,
            serviceType: jobs.serviceType,
            scheduledDate: jobs.scheduledDate,
            estimatedPrice: jobs.estimatedPrice,
            status: jobs.status,
            notes: jobs.notes,
            customerNotes: jobs.customerNotes,
            accessInstructions: jobs.accessInstructions,
            whatWereDoing: jobs.whatWereDoing,
            timeWindow: jobs.timeWindow,
            lat: jobs.lat,
            lng: jobs.lng,
            createdAt: jobs.createdAt,
            updatedAt: jobs.updatedAt,
          })
          .from(jobs)
          .innerJoin(jobCrewAssignments, eq(jobCrewAssignments.jobId, jobs.id))
          .where(and(eq(jobCrewAssignments.crewId, crewId), ...baseConditions))
          .orderBy(jobs.scheduledDate);
      }

      // Get acceptance state for today
      const acceptanceState = await db
        .select()
        .from(dailyScheduleAcceptances)
        .where(
          and(
            eq(dailyScheduleAcceptances.userId, userId),
            eq(dailyScheduleAcceptances.date, today)
          )
        )
        .limit(1);

      // Get crew snapshot (for leaders)
      let crewSnapshot = null;
      if ((userRole === 'crew_lead' || userRole === 'crew_leader') && crewId) {
        const crewData = await db
          .select()
          .from(crews)
          .where(eq(crews.id, crewId))
          .limit(1);

        const members = await db
          .select()
          .from(crewMembers)
          .where(and(eq(crewMembers.crewId, crewId), eq(crewMembers.isActive, true)));

        if (crewData[0]) {
          crewSnapshot = {
            crewName: crewData[0].name,
            memberCount: members.length,
          };
        }
      }

      // Get notifications (placeholder - implement notification system separately)
      const notifications: any[] = [];

      // Get latest crew status
      const latestStatus = await db
        .select()
        .from(crewStatusUpdates)
        .where(eq(crewStatusUpdates.userId, userId))
        .orderBy(desc(crewStatusUpdates.createdAt))
        .limit(1);

      const response = {
        jobsToday,
        notifications,
        crewSnapshot,
        acceptanceState: acceptanceState[0] || null,
        currentCrewStatus: latestStatus[0]?.status || null,
        serverTime: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching dashboard:", error);
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  // ============================================
  // GET /api/mobile/jobs
  // ============================================
  app.get("/api/mobile/jobs", requireMobileAuth, async (req: MobileAuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { since, status, date } = req.query;

      const crewId = await getUserCrewId(userId);
      if (!crewId) {
        return res.json({ jobs: [], serverTime: new Date().toISOString() });
      }

      // Build conditions
      const conditions = [eq(jobCrewAssignments.crewId, crewId)];

      if (status && typeof status === 'string') {
        conditions.push(eq(jobs.status, status));
      }

      if (date && typeof date === 'string') {
        conditions.push(sql`DATE(${jobs.scheduledDate}) = ${date}`);
      }

      if (since && typeof since === 'string') {
        conditions.push(gte(jobs.updatedAt, new Date(since)));
      }

      const jobsList = await db
        .select({
          id: jobs.id,
          conversationId: jobs.conversationId,
          businessId: jobs.businessId,
          customerName: jobs.customerName,
          customerPhone: jobs.customerPhone,
          customerAddress: jobs.customerAddress,
          serviceType: jobs.serviceType,
          scheduledDate: jobs.scheduledDate,
          estimatedPrice: jobs.estimatedPrice,
          status: jobs.status,
          notes: jobs.notes,
          customerNotes: jobs.customerNotes,
          accessInstructions: jobs.accessInstructions,
          whatWereDoing: jobs.whatWereDoing,
          timeWindow: jobs.timeWindow,
          lat: jobs.lat,
          lng: jobs.lng,
          createdAt: jobs.createdAt,
          updatedAt: jobs.updatedAt,
        })
        .from(jobs)
        .innerJoin(jobCrewAssignments, eq(jobCrewAssignments.jobId, jobs.id))
        .where(and(...conditions))
        .orderBy(jobs.scheduledDate);

      res.json({
        jobs: jobsList,
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  // ============================================
  // GET /api/mobile/jobs/:id
  // ============================================
  app.get("/api/mobile/jobs/:id", requireMobileAuth, async (req: MobileAuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const jobId = parseInt(req.params.id);

      if (isNaN(jobId)) {
        return res.status(400).json({ error: "Invalid job ID" });
      }

      const crewId = await getUserCrewId(userId);

      // Get job with permission check
      const job = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);

      if (!job[0]) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify crew access (or owner/admin)
      const userRole = req.user!.role;
      if (userRole !== 'owner' && userRole !== 'admin' && crewId) {
        // Check if job is assigned to this crew
        const assignment = await db
          .select()
          .from(jobCrewAssignments)
          .where(and(eq(jobCrewAssignments.jobId, jobId), eq(jobCrewAssignments.crewId, crewId)))
          .limit(1);

        if (assignment.length === 0) {
          return res.status(403).json({ error: "Forbidden: Job not assigned to your crew" });
        }
      }

      res.json({
        job: job[0],
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  // ============================================
  // GET /api/mobile/crew/me
  // ============================================
  app.get("/api/mobile/crew/me", requireMobileAuth, async (req: MobileAuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const crewId = await getUserCrewId(userId);
      if (!crewId) {
        return res.status(404).json({ error: "Not assigned to any crew" });
      }

      // Get crew info
      const crewData = await db
        .select()
        .from(crews)
        .where(eq(crews.id, crewId))
        .limit(1);

      if (!crewData[0]) {
        return res.status(404).json({ error: "Crew not found" });
      }

      // Get crew members with user details
      const members = await db
        .select({
          id: crewMembers.id,
          userId: crewMembers.userId,
          displayName: crewMembers.displayName,
          role: crewMembers.role,
          isActive: crewMembers.isActive,
          phoneE164: users.phoneE164,
        })
        .from(crewMembers)
        .leftJoin(users, eq(crewMembers.userId, users.id))
        .where(and(eq(crewMembers.crewId, crewId), eq(crewMembers.isActive, true)));

      res.json({
        crew: {
          id: crewData[0].id,
          name: crewData[0].name,
          status: crewData[0].status,
          members: members.map(m => ({
            id: m.id,
            name: m.displayName,
            role: m.role,
            isActive: m.isActive,
            phoneE164: m.phoneE164,
          })),
        },
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching crew:", error);
      res.status(500).json({ error: "Failed to fetch crew data" });
    }
  });

  // ============================================
  // GET /api/mobile/schedule/today
  // ============================================
  app.get("/api/mobile/schedule/today", requireMobileAuth, async (req: MobileAuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const today = new Date().toISOString().split('T')[0];

      const crewId = await getUserCrewId(userId);

      // Get today's jobs
      let todayJobs: any[] = [];

      if (crewId) {
        todayJobs = await db
          .select({
            id: jobs.id,
            conversationId: jobs.conversationId,
            businessId: jobs.businessId,
            customerName: jobs.customerName,
            customerPhone: jobs.customerPhone,
            customerAddress: jobs.customerAddress,
            serviceType: jobs.serviceType,
            scheduledDate: jobs.scheduledDate,
            estimatedPrice: jobs.estimatedPrice,
            status: jobs.status,
            notes: jobs.notes,
            customerNotes: jobs.customerNotes,
            accessInstructions: jobs.accessInstructions,
            whatWereDoing: jobs.whatWereDoing,
            timeWindow: jobs.timeWindow,
            lat: jobs.lat,
            lng: jobs.lng,
            createdAt: jobs.createdAt,
            updatedAt: jobs.updatedAt,
          })
          .from(jobs)
          .innerJoin(jobCrewAssignments, eq(jobCrewAssignments.jobId, jobs.id))
          .where(and(
            eq(jobCrewAssignments.crewId, crewId),
            sql`DATE(${jobs.scheduledDate}) = ${today}`
          ))
          .orderBy(jobs.scheduledDate);
      }

      // Get acceptance state
      const acceptance = await db
        .select()
        .from(dailyScheduleAcceptances)
        .where(
          and(
            eq(dailyScheduleAcceptances.userId, userId),
            eq(dailyScheduleAcceptances.date, today)
          )
        )
        .limit(1);

      res.json({
        date: today,
        jobs: todayJobs,
        acceptance: acceptance[0] || null,
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching schedule:", error);
      res.status(500).json({ error: "Failed to fetch schedule" });
    }
  });

  // ============================================
  // GET /api/mobile/work-requests
  // ============================================
  app.get("/api/mobile/work-requests", requireMobileAuth, async (req: MobileAuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { since } = req.query;

      let query = db
        .select()
        .from(workRequests)
        .where(eq(workRequests.userId, userId))
        .orderBy(desc(workRequests.createdAt));

      if (since && typeof since === 'string') {
        query = query.where(gte(workRequests.updatedAt, new Date(since)));
      }

      const requests = await query;

      res.json({
        requests,
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching work requests:", error);
      res.status(500).json({ error: "Failed to fetch work requests" });
    }
  });

  // ============================================
  // GET /api/mobile/payroll/preferences
  // ============================================
  app.get("/api/mobile/payroll/preferences", requireMobileAuth, async (req: MobileAuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const prefs = await db
        .select()
        .from(payrollPreferences)
        .where(eq(payrollPreferences.userId, userId))
        .limit(1);

      // Don't return encrypted field to client
      const sanitized = prefs[0] ? {
        ...prefs[0],
        payoutDetailsEncrypted: undefined,
        hasPayoutDetails: !!prefs[0].payoutDetailsEncrypted,
      } : null;

      res.json({
        preferences: sanitized,
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching payroll preferences:", error);
      res.status(500).json({ error: "Failed to fetch payroll preferences" });
    }
  });

  // ============================================
  // GET /api/mobile/notifications
  // ============================================
  app.get("/api/mobile/notifications", requireMobileAuth, async (req: MobileAuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { since } = req.query;

      // Placeholder - implement notification system
      // For now, return empty array with server time for polling
      const notifications: any[] = [];

      res.json({
        notifications,
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // ============================================
  // MUTATION ENDPOINTS
  // ============================================

  // Helper function to write to event outbox
  async function writeEventOutbox(eventType: string, entityType: string, entityId: number, payload: any) {
    await db.insert(eventOutbox).values({
      eventType,
      entityType,
      entityId,
      payload,
      processed: false,
    });
  }

  // ============================================
  // PATCH /api/mobile/jobs/:id/status
  // ============================================
  app.patch("/api/mobile/jobs/:id/status", requireMobileAuth, async (req: MobileAuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const jobId = parseInt(req.params.id);
      const { status } = req.body;

      if (isNaN(jobId)) {
        return res.status(400).json({ error: "Invalid job ID" });
      }

      if (!status || typeof status !== 'string') {
        return res.status(400).json({ error: "Status is required" });
      }

      const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled', 'delayed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const crewId = await getUserCrewId(userId);

      // Verify job access
      const job = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1);

      if (!job[0]) {
        return res.status(404).json({ error: "Job not found" });
      }

      const userRole = req.user!.role;
      if (userRole !== 'owner' && userRole !== 'admin' && crewId) {
        const assignment = await db
          .select()
          .from(jobCrewAssignments)
          .where(and(eq(jobCrewAssignments.jobId, jobId), eq(jobCrewAssignments.crewId, crewId)))
          .limit(1);

        if (assignment.length === 0) {
          return res.status(403).json({ error: "Forbidden: Job not assigned to your crew" });
        }
      }

      // Update job status
      await db
        .update(jobs)
        .set({ status, updatedAt: new Date() })
        .where(eq(jobs.id, jobId));

      // Write to event outbox for agent integration
      await writeEventOutbox('job_status_changed', 'job', jobId, {
        jobId,
        oldStatus: job[0].status,
        newStatus: status,
        changedBy: userId,
        changedAt: new Date().toISOString(),
      });

      res.json({
        success: true,
        status,
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error updating job status:", error);
      res.status(500).json({ error: "Failed to update job status" });
    }
  });

  // ============================================
  // PATCH /api/mobile/crew/status
  // ============================================
  app.patch("/api/mobile/crew/status", requireMobileAuth, async (req: MobileAuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { status, jobId, lat, lng } = req.body;

      if (!status || typeof status !== 'string') {
        return res.status(400).json({ error: "Status is required" });
      }

      const validStatuses = ['ON_SITE', 'EN_ROUTE', 'ON_BREAK'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const crewId = await getUserCrewId(userId);
      if (!crewId) {
        return res.status(400).json({ error: "User not assigned to any crew" });
      }

      // Insert status update
      const result = await db.insert(crewStatusUpdates).values({
        userId,
        crewId,
        status,
        jobId: jobId || null,
        lat: lat || null,
        lng: lng || null,
      }).returning();

      // Write to event outbox
      await writeEventOutbox('crew_status_changed', 'crew_status', result[0].id, {
        userId,
        crewId,
        status,
        jobId: jobId || null,
        lat: lat || null,
        lng: lng || null,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        status,
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error updating crew status:", error);
      res.status(500).json({ error: "Failed to update crew status" });
    }
  });

  // ============================================
  // POST /api/mobile/schedule/accept
  // ============================================
  app.post("/api/mobile/schedule/accept", requireMobileAuth, async (req: MobileAuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { date, accepted, requestedChanges } = req.body;

      if (!date || typeof date !== 'string') {
        return res.status(400).json({ error: "Date is required (YYYY-MM-DD format)" });
      }

      if (typeof accepted !== 'boolean') {
        return res.status(400).json({ error: "Accepted must be a boolean" });
      }

      // Upsert acceptance
      const existing = await db
        .select()
        .from(dailyScheduleAcceptances)
        .where(and(eq(dailyScheduleAcceptances.userId, userId), eq(dailyScheduleAcceptances.date, date)))
        .limit(1);

      let result;
      if (existing[0]) {
        result = await db
          .update(dailyScheduleAcceptances)
          .set({
            accepted,
            acceptedAt: accepted ? new Date() : null,
            requestedChanges: requestedChanges || null,
            updatedAt: new Date(),
          })
          .where(eq(dailyScheduleAcceptances.id, existing[0].id))
          .returning();
      } else {
        result = await db.insert(dailyScheduleAcceptances).values({
          userId,
          date,
          accepted,
          acceptedAt: accepted ? new Date() : null,
          requestedChanges: requestedChanges || null,
        }).returning();
      }

      // Write to event outbox
      await writeEventOutbox('schedule_accepted', 'schedule_acceptance', result[0].id, {
        userId,
        date,
        accepted,
        requestedChanges: requestedChanges || null,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        acceptance: result[0],
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error accepting schedule:", error);
      res.status(500).json({ error: "Failed to accept schedule" });
    }
  });

  // ============================================
  // PATCH /api/mobile/schedule
  // ============================================
  app.patch("/api/mobile/schedule", requireMobileAuth, async (req: MobileAuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { date, requestedChanges } = req.body;

      if (!date || typeof date !== 'string') {
        return res.status(400).json({ error: "Date is required (YYYY-MM-DD format)" });
      }

      if (!requestedChanges || typeof requestedChanges !== 'string') {
        return res.status(400).json({ error: "Requested changes are required" });
      }

      // Upsert with accepted=false and requested changes
      const existing = await db
        .select()
        .from(dailyScheduleAcceptances)
        .where(and(eq(dailyScheduleAcceptances.userId, userId), eq(dailyScheduleAcceptances.date, date)))
        .limit(1);

      let result;
      if (existing[0]) {
        result = await db
          .update(dailyScheduleAcceptances)
          .set({
            accepted: false,
            requestedChanges,
            updatedAt: new Date(),
          })
          .where(eq(dailyScheduleAcceptances.id, existing[0].id))
          .returning();
      } else {
        result = await db.insert(dailyScheduleAcceptances).values({
          userId,
          date,
          accepted: false,
          requestedChanges,
        }).returning();
      }

      // Write to event outbox
      await writeEventOutbox('schedule_change_requested', 'schedule_acceptance', result[0].id, {
        userId,
        date,
        requestedChanges,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        acceptance: result[0],
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error requesting schedule change:", error);
      res.status(500).json({ error: "Failed to request schedule change" });
    }
  });

  // ============================================
  // POST /api/mobile/work-requests
  // ============================================
  app.post("/api/mobile/work-requests", requireMobileAuth, async (req: MobileAuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { timeframe, note } = req.body;

      if (!timeframe || !['today', 'this_week'].includes(timeframe)) {
        return res.status(400).json({ error: "Invalid timeframe (must be 'today' or 'this_week')" });
      }

      const crewId = await getUserCrewId(userId);

      const result = await db.insert(workRequests).values({
        userId,
        crewId: crewId || null,
        timeframe,
        note: note || null,
        status: 'pending',
      }).returning();

      // Write to event outbox
      await writeEventOutbox('work_request_submitted', 'work_request', result[0].id, {
        userId,
        crewId: crewId || null,
        timeframe,
        note: note || null,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        request: result[0],
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error submitting work request:", error);
      res.status(500).json({ error: "Failed to submit work request" });
    }
  });

  // ============================================
  // PUT /api/mobile/payroll/preferences
  // ============================================
  app.put("/api/mobile/payroll/preferences", requireMobileAuth, async (req: MobileAuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { payFrequency, payMethods, preferredMethod, payoutDetails } = req.body;

      if (!payFrequency || !['per_job', 'daily', 'weekly', 'scheduled'].includes(payFrequency)) {
        return res.status(400).json({ error: "Invalid pay frequency" });
      }

      if (!payMethods || !Array.isArray(payMethods) || payMethods.length === 0) {
        return res.status(400).json({ error: "Pay methods must be a non-empty array" });
      }

      if (!preferredMethod || !payMethods.includes(preferredMethod)) {
        return res.status(400).json({ error: "Preferred method must be one of the pay methods" });
      }

      // Encrypt payout details (placeholder - implement proper encryption)
      let payoutDetailsEncrypted = null;
      if (payoutDetails && typeof payoutDetails === 'object') {
        // TODO: Implement proper encryption using crypto module
        payoutDetailsEncrypted = Buffer.from(JSON.stringify(payoutDetails)).toString('base64');
      }

      // Upsert preferences
      const existing = await db
        .select()
        .from(payrollPreferences)
        .where(eq(payrollPreferences.userId, userId))
        .limit(1);

      let result;
      if (existing[0]) {
        result = await db
          .update(payrollPreferences)
          .set({
            payFrequency,
            payMethods,
            preferredMethod,
            payoutDetailsEncrypted,
            updatedAt: new Date(),
          })
          .where(eq(payrollPreferences.id, existing[0].id))
          .returning();
      } else {
        result = await db.insert(payrollPreferences).values({
          userId,
          payFrequency,
          payMethods,
          preferredMethod,
          payoutDetailsEncrypted,
        }).returning();
      }

      // Write to event outbox
      await writeEventOutbox('payroll_preferences_updated', 'payroll_preference', result[0].id, {
        userId,
        payFrequency,
        payMethods,
        preferredMethod,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        preferences: {
          ...result[0],
          payoutDetailsEncrypted: undefined,
          hasPayoutDetails: !!result[0].payoutDetailsEncrypted,
        },
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error updating payroll preferences:", error);
      res.status(500).json({ error: "Failed to update payroll preferences" });
    }
  });

  // ============================================
  // PATCH /api/mobile/notifications/:id/read
  // ============================================
  app.patch("/api/mobile/notifications/:id/read", requireMobileAuth, async (req: MobileAuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const notificationId = parseInt(req.params.id);

      if (isNaN(notificationId)) {
        return res.status(400).json({ error: "Invalid notification ID" });
      }

      // Placeholder - implement notification system
      res.json({
        success: true,
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // ============================================
  // AGENT INTEGRATION ENDPOINTS
  // ============================================

  // ============================================
  // GET /api/agents/mobile-events/pull
  // ============================================
  app.get("/api/agents/mobile-events/pull", async (req: Request, res: Response) => {
    try {
      const { since, limit } = req.query;

      // Build query for unprocessed events
      let query = db
        .select()
        .from(eventOutbox)
        .where(eq(eventOutbox.processed, false))
        .orderBy(eventOutbox.createdAt);

      // Apply time filter if provided
      if (since && typeof since === 'string') {
        query = query.where(and(
          eq(eventOutbox.processed, false),
          gte(eventOutbox.createdAt, new Date(since))
        ));
      }

      // Apply limit
      const limitNum = limit && typeof limit === 'string' ? parseInt(limit) : 100;
      query = query.limit(Math.min(limitNum, 1000)); // Max 1000 events per pull

      const events = await query;

      // Mark as processed
      if (events.length > 0) {
        const eventIds = events.map(e => e.id);
        await db
          .update(eventOutbox)
          .set({
            processed: true,
            processedAt: new Date(),
          })
          .where(sql`${eventOutbox.id} IN (${sql.join(eventIds.map(id => sql`${id}`), sql`, `)})`);
      }

      res.json({
        events: events.map(e => ({
          id: e.id,
          eventType: e.eventType,
          entityType: e.entityType,
          entityId: e.entityId,
          payload: e.payload,
          createdAt: e.createdAt,
        })),
        count: events.length,
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error pulling mobile events:", error);
      res.status(500).json({ error: "Failed to pull mobile events" });
    }
  });

  // ============================================
  // POST /api/agents/mobile-events/ack
  // ============================================
  app.post("/api/agents/mobile-events/ack", async (req: Request, res: Response) => {
    try {
      const { eventIds, agentId } = req.body;

      if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
        return res.status(400).json({ error: "Event IDs array is required" });
      }

      if (!agentId || typeof agentId !== 'string') {
        return res.status(400).json({ error: "Agent ID is required" });
      }

      // Update events with acknowledgment
      await db
        .update(eventOutbox)
        .set({
          acknowledgedBy: agentId,
          acknowledgedAt: new Date(),
        })
        .where(sql`${eventOutbox.id} IN (${sql.join(eventIds.map((id: number) => sql`${id}`), sql`, `)})`);

      res.json({
        success: true,
        acknowledgedCount: eventIds.length,
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error acknowledging mobile events:", error);
      res.status(500).json({ error: "Failed to acknowledge mobile events" });
    }
  });
}
