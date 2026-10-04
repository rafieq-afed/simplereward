import type { H3Event } from "h3";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";

const COOKIE_NAME = "sr_session";
const MAX_AGE = 60 * 60 * 24 * 14;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  merchantId: string | null;
};

function getSecret() {
  const config = useRuntimeConfig();
  const secret = config.sessionSecret || process.env.SESSION_SECRET;
  if (!secret) {
    throw createError({ statusCode: 500, statusMessage: "SESSION_SECRET is not set" });
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(event: H3Event, user: SessionUser) {
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    merchantId: user.merchantId,
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

export function clearAuthSession(event: H3Event) {
  deleteCookie(event, COOKIE_NAME, { path: "/" });
}

export async function getAuthSession(event: H3Event): Promise<SessionUser | null> {
  const token = getCookie(event, COOKIE_NAME);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      id: String(payload.id),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
      merchantId: (payload.merchantId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireSession(event: H3Event, role?: Role) {
  const session = await getAuthSession(event);
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  if (role && session.role !== role) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  }
  return session;
}

export async function loginWithCredentials(
  event: H3Event,
  email: string,
  password: string,
) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  const session: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    merchantId: user.merchantId,
  };

  await createSession(event, session);
  return session;
}
