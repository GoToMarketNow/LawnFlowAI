import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { apiLimiter } from "./middleware/rate-limit.js";

/**
 * Register notification routes
 */
export function registerNotificationRoutes(app: Express): void {
  // Get all notifications for current user
  app.get("/api/notifications", apiLimiter, async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const notifications = await storage.getNotifications(userId);
      res.json({ notifications });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Mark notification as read (or acked)
  app.post("/api/notifications/:id/read", apiLimiter, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userId = (req.session as any).userId;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      await storage.markNotificationsSeen(userId, [id]);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to update notification" });
    }
  });

  // Register device token for push notifications
  app.post("/api/notifications/device", apiLimiter, async (req: Request, res: Response) => {
    try {
      const { deviceToken, platform, keys } = req.body;
      const userId = (req.session as any).userId;
      
      if (!userId || !deviceToken) {
        return res.status(400).json({ error: "User ID and device token required" });
      }
      
      console.log(`[Notifications] Registering device for user ${userId}:`, { deviceToken, platform });
      
      await storage.createPushSubscription({
        userId,
        endpoint: deviceToken,
        keysJson: keys || { p256dh: "", auth: "" },
        userAgent: platform || "mobile",
        isActive: true,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error registering device token:", error);
      res.status(500).json({ error: "Failed to register device" });
    }
  });
}
