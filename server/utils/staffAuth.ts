import type { H3Event } from "h3";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const COOKIE_NAME = "sr_staff";
const MAX_AGE = 60 * 60 * 8;

export type StaffSession = {
  id: string;
  name: string;
  merchantId: string;
};

function getSecret() {
  const config = useRuntimeConfig();
  const secret = config.sessionSecret || process.env.SESSION_SECRET;
  if (!secret) {
    throw createError({ statusCode: 500, statusMessage: "SESSION_SECRET is not set" });
  }
  return new TextEncoder().encode(`${secret}:staff`);
}

export async function hashStaffPin(pin: string) {
  return bcrypt.hash(pin, 10);
}

export async function verifyStaffPin(pin: string, hash: string) {
  return bcrypt.compare(pin, hash);
}

export async function createStaffSession(event: H3Event, staff: StaffSession) {
  const token = await new SignJWT({
    id: staff.id,
    name: staff.name,
    merchantId: staff.merchantId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());

  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearStaffSession(event: H3Event) {
  deleteCookie(event, COOKIE_NAME, { path: "/" });
}

export async function getStaffSession(event: H3Event): Promise<StaffSession | null> {
  const token = getCookie(event, COOKIE_NAME);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      id: String(payload.id),
      name: String(payload.name),
      merchantId: String(payload.merchantId),
    };
  } catch {
    return null;
  }
}

export async function requireStaffIfConfigured(event: H3Event, merchantId: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { features: true },
  });
  if (!hasFeature(normalizeFeatures(merchant?.features), "staffPin")) {
    return null;
  }

  const activeCount = await prisma.staff.count({
    where: { merchantId, active: true },
  });
  if (activeCount === 0) return null;

  const staff = await getStaffSession(event);
  if (!staff || staff.merchantId !== merchantId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Staff PIN required",
      data: { code: "STAFF_PIN_REQUIRED" },
    });
  }

  const row = await prisma.staff.findFirst({
    where: { id: staff.id, merchantId, active: true },
  });
  if (!row) {
    clearStaffSession(event);
    throw createError({
      statusCode: 403,
      statusMessage: "Staff PIN required",
      data: { code: "STAFF_PIN_REQUIRED" },
    });
  }

  return staff;
}
