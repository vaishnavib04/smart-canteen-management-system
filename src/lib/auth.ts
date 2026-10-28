import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "canteen_session";
const SESSION_DURATION = 60 * 60 * 8; // 8 hours

function getSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }

  return new TextEncoder().encode(secret);
}

export type SessionUser = {
  userId: number;
  email: string;
  role: "Student" | "Staff" | "Admin";
};

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());

  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) return null;

    const { payload } = await jwtVerify(token, getSecret());

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      !["Student", "Staff", "Admin"].includes(String(payload.role))
    ) {
      return null;
    }

    return {
      userId: Number(payload.sub),
      email: payload.email,
      role: payload.role as SessionUser["role"],
    };
  } catch {
    return null;
  }
}

export async function requireStaffOrAdmin() {
  const user = await getSession();

  if (!user) {
    return { user: null, error: "UNAUTHENTICATED" as const };
  }

  if (user.role !== "Staff" && user.role !== "Admin") {
    return { user: null, error: "FORBIDDEN" as const };
  }

  return { user, error: null };
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}