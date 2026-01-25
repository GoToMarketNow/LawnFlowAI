import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

const router = Router();

// JWT secret for QR code tokens (in production, use proper env var)
const QR_CODE_SECRET = process.env.QR_CODE_SECRET || 'lawnflow-onboarding-secret-change-in-prod';

// Validation schemas
const bindDeviceSchema = z.object({
  qrCodeToken: z.string(),
  deviceId: z.string(),
  deviceType: z.enum(['ios', 'android']),
  deviceName: z.string().optional(),
});

const verifyBindingSchema = z.object({
  bindingId: z.number(),
});

/**
 * POST /api/mobile-binding/bind
 * Bind a mobile device using QR code token
 */
router.post('/bind', async (req: Request, res: Response) => {
  try {
    const parsed = bindDeviceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const { qrCodeToken, deviceId, deviceType, deviceName } = parsed.data;

    // Verify JWT token
    let decoded: any;
    try {
      decoded = jwt.verify(qrCodeToken, QR_CODE_SECRET);
    } catch (error) {
      return res.status(401).json({
        error: 'Invalid or expired QR code token',
      });
    }

    // Validate token type
    if (decoded.type !== 'onboarding_mobile_binding') {
      return res.status(400).json({
        error: 'Invalid token type',
      });
    }

    const { sessionId, userId } = decoded;

    // Check if device is already bound
    // In production, query mobile_device_bindings table
    // const existingBinding = await storage.getMobileDeviceBinding(userId, deviceId);
    // if (existingBinding) {
    //   return res.status(409).json({
    //     error: 'Device already bound',
    //     binding: existingBinding,
    //   });
    // }

    // Create device binding
    // In production, insert into mobile_device_bindings table
    const binding = {
      id: Date.now(), // Mock ID
      userId,
      businessId: decoded.businessId || 0,
      qrCodeToken,
      deviceId,
      deviceType,
      deviceName: deviceName || `${deviceType} Device`,
      bindingVerifiedAt: null, // Will be set after 2FA
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      createdAt: new Date().toISOString(),
    };

    // await storage.createMobileDeviceBinding(binding);

    return res.status(200).json({
      ok: true,
      binding: {
        id: binding.id,
        userId,
        deviceType,
        deviceName: binding.deviceName,
        requires_2fa: true, // Must complete 2FA next
        created_at: binding.createdAt,
      },
    });
  } catch (error) {
    console.error('Error binding device:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/mobile-binding/verify
 * Verify device binding is complete (after 2FA)
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const parsed = verifyBindingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const { bindingId } = parsed.data;

    // In production, update mobile_device_bindings table
    // await storage.updateMobileDeviceBinding(bindingId, {
    //   bindingVerifiedAt: new Date(),
    // });

    // Also update onboarding_sessions table
    // await storage.updateOnboardingSession(sessionId, {
    //   mobileVerified: true,
    // });

    return res.status(200).json({
      ok: true,
      verified: true,
      verified_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error verifying binding:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/mobile-binding/status/:userId
 * Get mobile binding status for a user
 */
router.get('/status/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // In production, query mobile_device_bindings table
    // const bindings = await storage.getMobileDeviceBindings(userId);

    const mockBindings = [
      // {
      //   id: 1,
      //   deviceType: 'ios',
      //   deviceName: 'iPhone 14',
      //   verified: true,
      //   verifiedAt: new Date().toISOString(),
      // }
    ];

    return res.status(200).json({
      ok: true,
      has_mobile_binding: mockBindings.length > 0,
      bindings: mockBindings,
    });
  } catch (error) {
    console.error('Error getting binding status:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/mobile-binding/:bindingId
 * Unbind a mobile device
 */
router.delete('/:bindingId', async (req: Request, res: Response) => {
  try {
    const bindingId = parseInt(req.params.bindingId, 10);
    if (isNaN(bindingId)) {
      return res.status(400).json({ error: 'Invalid binding ID' });
    }

    // Verify user owns this binding
    // In production, check userId matches

    // Delete binding
    // In production, soft delete or hard delete from mobile_device_bindings
    // await storage.deleteMobileDeviceBinding(bindingId);

    return res.status(200).json({
      ok: true,
      message: 'Device unbound successfully',
    });
  } catch (error) {
    console.error('Error unbinding device:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
