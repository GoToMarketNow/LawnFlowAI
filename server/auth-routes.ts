import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { twilioConnector } from "./connectors/twilio-mock";
import { normalizePhoneToE164 } from "./utils/phone";
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  getOtpExpiryTime,
  isOtpExpired,
  isMaxAttemptsReached,
  isMaxSendsReached,
  isWithinSendWindow,
  maskPhone,
  OTP_CONFIG,
} from "./utils/otp";
import bcrypt from "bcrypt";
import { z } from "zod";
import { audit } from "./tools";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().min(10, "Invalid phone number"),
});

const sendOtpSchema = z.object({
  userId: z.number(),
});

const verifyOtpSchema = z.object({
  userId: z.number(),
  code: z.string().length(6, "Code must be 6 digits"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const SALT_ROUNDS = 10;

export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: parsed.error.issues,
        });
      }

      const { email, password, phone } = parsed.data;

      const phoneE164 = normalizePhoneToE164(phone);
      if (!phoneE164) {
        return res.status(400).json({
          error: "Invalid phone number format",
        });
      }

      const existingUserByEmail = await storage.getUserByEmail(email);
      if (existingUserByEmail) {
        return res.status(200).json({
          ok: true,
          message: "If this email is available, you will receive a verification code.",
          userId: null,
        });
      }

      const existingUserByPhone = await storage.getUserByPhone(phoneE164);
      if (existingUserByPhone) {
        return res.status(200).json({
          ok: true,
          message: "If this email is available, you will receive a verification code.",
          userId: null,
        });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      const user = await storage.createUser({
        email,
        passwordHash,
        phoneE164,
      });

      const { count: sendCount, windowStart } = await storage.getPhoneVerificationSendCount(phoneE164);
      
      if (sendCount >= OTP_CONFIG.maxSendsPerHour && windowStart && isWithinSendWindow(windowStart)) {
        return res.status(429).json({
          error: "Too many verification attempts. Please try again later.",
        });
      }

      const otp = generateOtp();
      const otpHash = await hashOtp(otp);
      const expiresAt = getOtpExpiryTime();
      const now = new Date();

      await storage.createPhoneVerification({
        userId: user.id,
        phoneE164,
        otpHash,
        expiresAt,
        attemptsUsed: 0,
        sendsUsedHour: sendCount + 1,
        sendWindowStart: windowStart && isWithinSendWindow(windowStart) ? windowStart : now,
      });

      const smsResult = await twilioConnector.sendOtpSMS(phoneE164, otp);
      
      if (!smsResult.success) {
        await audit.logEvent({
          action: "auth.register.otpSendFailed",
          actor: "system",
          payload: { userId: user.id, error: smsResult.error },
        });
      }

      await audit.logEvent({
        action: "auth.register.success",
        actor: "system",
        payload: { userId: user.id, phone: maskPhone(phoneE164) },
      });

      res.json({
        ok: true,
        userId: user.id,
        maskedPhone: maskPhone(phoneE164),
        message: "Verification code sent. Please check your phone.",
      });
    } catch (error) {
      console.error("Registration error:", error);
      await audit.logEvent({
        action: "auth.register.error",
        actor: "system",
        payload: { error: error instanceof Error ? error.message : "Unknown error" },
      });
      res.status(500).json({ error: "Registration failed. Please try again." });
    }
  });

  app.post("/api/auth/send-otp", async (req: Request, res: Response) => {
    try {
      const parsed = sendOtpSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request" });
      }

      const { userId } = parsed.data;

      const user = await storage.getUserById(userId);
      if (!user || !user.phoneE164) {
        return res.status(200).json({
          ok: true,
          message: "If valid, a verification code will be sent.",
        });
      }

      if (user.phoneVerifiedAt) {
        return res.status(400).json({ error: "Phone already verified" });
      }

      const { count: sendCount, windowStart } = await storage.getPhoneVerificationSendCount(user.phoneE164);
      
      if (sendCount >= OTP_CONFIG.maxSendsPerHour && windowStart && isWithinSendWindow(windowStart)) {
        return res.status(429).json({
          error: "Too many verification attempts. Please try again later.",
        });
      }

      await storage.expirePhoneVerifications(userId);

      const otp = generateOtp();
      const otpHash = await hashOtp(otp);
      const expiresAt = getOtpExpiryTime();
      const now = new Date();

      await storage.createPhoneVerification({
        userId,
        phoneE164: user.phoneE164,
        otpHash,
        expiresAt,
        attemptsUsed: 0,
        sendsUsedHour: sendCount + 1,
        sendWindowStart: windowStart && isWithinSendWindow(windowStart) ? windowStart : now,
      });

      const smsResult = await twilioConnector.sendOtpSMS(user.phoneE164, otp);

      await audit.logEvent({
        action: "auth.sendOtp",
        actor: "system",
        payload: { userId, success: smsResult.success, phone: maskPhone(user.phoneE164) },
      });

      res.json({
        ok: true,
        message: "If valid, a verification code will be sent.",
      });
    } catch (error) {
      console.error("Send OTP error:", error);
      res.status(500).json({ error: "Failed to send verification code." });
    }
  });

  app.post("/api/auth/verify-otp", async (req: Request, res: Response) => {
    try {
      const parsed = verifyOtpSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid code format" });
      }

      const { userId, code } = parsed.data;

      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(400).json({
          error: "Invalid or expired verification code.",
        });
      }

      if (user.phoneVerifiedAt) {
        return res.status(200).json({
          ok: true,
          message: "Phone already verified.",
          verified: true,
        });
      }

      const verification = await storage.getActivePhoneVerification(userId);
      if (!verification) {
        return res.status(400).json({
          error: "Invalid or expired verification code.",
        });
      }

      if (isOtpExpired(verification.expiresAt)) {
        return res.status(400).json({
          error: "Verification code has expired. Please request a new one.",
        });
      }

      if (isMaxAttemptsReached(verification.attemptsUsed)) {
        return res.status(400).json({
          error: "Too many incorrect attempts. Please request a new code.",
        });
      }

      const isValid = await verifyOtp(code, verification.otpHash);

      if (!isValid) {
        await storage.updatePhoneVerification(verification.id, {
          attemptsUsed: verification.attemptsUsed + 1,
        });

        await audit.logEvent({
          action: "auth.verifyOtp.failed",
          actor: "system",
          payload: { userId, attempts: verification.attemptsUsed + 1 },
        });

        const remainingAttempts = OTP_CONFIG.maxVerifyAttempts - (verification.attemptsUsed + 1);
        return res.status(400).json({
          error: `Invalid verification code. ${remainingAttempts} attempts remaining.`,
        });
      }

      await storage.updatePhoneVerification(verification.id, {
        verifiedAt: new Date(),
      });

      await storage.updateUser(userId, {
        phoneVerifiedAt: new Date(),
      });

      req.session.userId = user.id;
      req.session.email = user.email;

      await audit.logEvent({
        action: "auth.verifyOtp.success",
        actor: "system",
        payload: { userId },
      });

      res.json({
        ok: true,
        verified: true,
        message: "Phone verified successfully.",
      });
    } catch (error) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ error: "Verification failed. Please try again." });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid credentials" });
      }

      const { email, password } = parsed.data;

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (!user.phoneVerifiedAt) {
        return res.json({
          ok: true,
          requiresVerification: true,
          userId: user.id,
          maskedPhone: user.phoneE164 ? maskPhone(user.phoneE164) : null,
          message: "Phone verification required",
        });
      }

      req.session.userId = user.id;
      req.session.email = user.email;

      await audit.logEvent({
        action: "auth.login.success",
        actor: "user",
        payload: { userId: user.id },
      });

      res.json({
        ok: true,
        verified: true,
        userId: user.id,
        email: user.email,
        message: "Login successful",
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ authenticated: false });
      }

      const user = await storage.getUserById(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ authenticated: false });
      }

      res.json({
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          phoneVerified: !!user.phoneVerifiedAt,
          role: user.role || "owner",
        },
      });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ error: "Failed to check auth status" });
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const userId = req.session.userId;
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Logout failed" });
      }

      if (userId) {
        audit.logEvent({
          action: "auth.logout.success",
          actor: "user",
          payload: { userId },
        });
      }

      res.json({ ok: true, message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/status", async (req: Request, res: Response) => {
    const twilioStatus = {
      messagingServiceConfigured: twilioConnector.isMessagingServiceReady(),
      realTwilioConfigured: twilioConnector.isRealTwilioConfigured(),
    };

    res.json({
      otpConfig: {
        length: OTP_CONFIG.length,
        expiryMinutes: OTP_CONFIG.expiryMinutes,
        maxAttempts: OTP_CONFIG.maxVerifyAttempts,
        maxSendsPerHour: OTP_CONFIG.maxSendsPerHour,
      },
      twilioStatus,
    });
  });
}
