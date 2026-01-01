import bcrypt from "bcrypt";
import crypto from "crypto";

const OTP_LENGTH = 6;
const SALT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;

export function generateOtp(): string {
  const min = Math.pow(10, OTP_LENGTH - 1);
  const max = Math.pow(10, OTP_LENGTH) - 1;
  const otp = crypto.randomInt(min, max + 1);
  return otp.toString().padStart(OTP_LENGTH, "0");
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, SALT_ROUNDS);
}

export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

export function getOtpExpiryTime(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + OTP_EXPIRY_MINUTES);
  return expiry;
}

export function isOtpExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

export function isMaxAttemptsReached(attemptsUsed: number): boolean {
  return attemptsUsed >= MAX_VERIFY_ATTEMPTS;
}

export function isMaxSendsReached(sendsUsedHour: number): boolean {
  return sendsUsedHour >= MAX_SENDS_PER_HOUR;
}

export function isWithinSendWindow(sendWindowStart: Date): boolean {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  return sendWindowStart > oneHourAgo;
}

export function maskPhone(phoneE164: string): string {
  if (phoneE164.length < 4) return "***";
  const last4 = phoneE164.slice(-4);
  const masked = phoneE164.slice(0, -4).replace(/\d/g, "*");
  return masked + last4;
}

export const OTP_CONFIG = {
  length: OTP_LENGTH,
  expiryMinutes: OTP_EXPIRY_MINUTES,
  maxVerifyAttempts: MAX_VERIFY_ATTEMPTS,
  maxSendsPerHour: MAX_SENDS_PER_HOUR,
};
