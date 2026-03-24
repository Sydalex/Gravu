import { randomUUID, createHash } from "crypto";
import { getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { prisma } from "../prisma";

const TRIAL_DEVICE_COOKIE = "trial_device_id";
const TRIAL_DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export function hashTrialDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getOrCreateTrialDeviceToken(c: Context): string {
  const existing = getCookie(c, TRIAL_DEVICE_COOKIE);
  if (existing) return existing;

  const token = randomUUID();
  setCookie(c, TRIAL_DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TRIAL_DEVICE_MAX_AGE_SECONDS,
  });
  return token;
}

export async function getDeviceTrialUsed(deviceHash: string): Promise<boolean> {
  const device = await prisma.trialDevice.findUnique({
    where: { deviceHash },
    select: { freeTrialUsed: true },
  });

  return device?.freeTrialUsed ?? false;
}
