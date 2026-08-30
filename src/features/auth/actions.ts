"use server";

import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken, getSessionUser } from "@/lib/auth";
import { cookies } from "next/headers";

const COOKIE_NAME = "auth_token";

export async function loginUser(payload: { username: string; password: string }) {
  try {
    const { username, password } = payload;
    if (!username || !password) {
      return { error: "Username and password are required", status: 400 };
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) {
      return { error: "Invalid credentials", status: 401 };
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMs = user.lockedUntil.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      return { error: `Account is locked. Try again in ${remainingMin} minute${remainingMin > 1 ? "s" : ""}.`, status: 423 };
    }

    // Clear lockout if expired
    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const updates: { failedLoginAttempts: number; lockedUntil?: Date } = {
        failedLoginAttempts: attempts,
      };
      if (attempts >= 5) {
        updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await prisma.user.update({ where: { id: user.id }, data: updates });

      if (attempts >= 5) {
        return { error: "Too many failed attempts. Account locked for 15 minutes.", status: 423 };
      }
      return { error: "Invalid credentials", status: 401 };
    }

    // Successful login — reset lockout state
    if (user.failedLoginAttempts > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const token = await signToken({ userId: user.id, isOwner: user.isOwner });
    
    const isProduction = process.env.NODE_ENV === "production";
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return { ok: true };
  } catch (error) {
    console.error("Login error:", error);
    return { error: "Internal server error", status: 500 };
  }
}

export async function logoutUser() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return { ok: true };
}

export async function getMe() {
  const session = await getSessionUser();
  if (!session) return { error: "Unauthorized", status: 401 };

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      username: true,
      jobRole: true,
      isOwner: true,
      isActive: true,
      faceEmbedding: true,
      createdAt: true,
    },
  });

  if (!user || !user.isActive) {
    return { error: "User not found", status: 404 };
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      jobRole: user.jobRole,
      isOwner: user.isOwner,
      hasFaceEmbedding: !!user.faceEmbedding,
      createdAt: user.createdAt,
    }
  };
}
