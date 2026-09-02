import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (
  !JWT_SECRET_RAW ||
  (process.env.NODE_ENV === "production" &&
    JWT_SECRET_RAW === "CHANGE_ME_IN_PRODUCTION_PLEASE")
) {
  throw new Error(
    "JWT_SECRET must be set to a strong, unique value in production."
  );
}
const JWT_SECRET = new TextEncoder().encode(
  JWT_SECRET_RAW ?? "CHANGE_ME_IN_PRODUCTION_PLEASE"
);

if (
  process.env.NODE_ENV === "production" &&
  !process.env.CRON_SECRET
) {
  // Intentional startup warning — not debug logging.
  // This alerts operators that the cron purge endpoint is unreachable.
  console.warn(
    "[AttendanceIQ] CRON_SECRET is not set. Scheduled maintenance endpoints (e.g. purge-photos) will not be reachable via cron until it is configured."
  );
}

const COOKIE_NAME = "auth_token";

export interface SessionPayload {
  userId: string;
  isOwner: boolean;
}

// ── Password helpers ──────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ── JWT helpers ───────────────────────────────────────────────────────────────

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// ── Session helpers (server components / route handlers) ─────────────────────

export async function getSessionUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function setAuthCookie(response: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  response.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${
      60 * 60 * 24 * 7
    }${isProduction ? "; Secure" : ""}`
  );
}

export function clearAuthCookie(response: Response): void {
  response.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
  );
}

// ── Higher-order route wrappers ─────────────────────────────────────────────

type AuthenticatedHandler<TContext = { params: Promise<unknown> }> = (
  request: NextRequest,
  session: SessionPayload,
  context: TContext
) => Promise<NextResponse>;

export function withAuth<TContext = { params: Promise<unknown> }>(handler: AuthenticatedHandler<TContext>) {
  return async (request: NextRequest, context: TContext) => {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(request, session, context);
  };
}

export function withAdminAuth<TContext = { params: Promise<unknown> }>(handler: AuthenticatedHandler<TContext>) {
  return async (request: NextRequest, context: TContext) => {
    const session = await getSessionUser();
    if (!session || !session.isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(request, session, context);
  };
}
