"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { cosineSimilarity } from "@/lib/cosine";
import { revalidatePath } from "next/cache";

const FACE_MATCH_THRESHOLD = parseFloat(
  process.env.FACE_MATCH_THRESHOLD ?? "0.75"
);

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function recordAttendance(payload: { embedding: number[]; photo: string; localDate?: string }) {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Unauthorized", status: 401 };
  }

  const { embedding, photo, localDate } = payload;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    return { error: "Invalid embedding", status: 400 };
  }
  if (!photo || typeof photo !== "string") {
    return { error: "Photo is required", status: 400 };
  }
  if (localDate && !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    return { error: "Invalid date format", status: 400 };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { faceEmbedding: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return { error: "User not found", status: 404 };
  }

  if (!user.faceEmbedding) {
    return { error: "Face not enrolled. Please complete enrollment first.", status: 422 };
  }

  const storedEmbedding: number[] = JSON.parse(user.faceEmbedding as string);
  const confidence = cosineSimilarity(embedding, storedEmbedding);

  if (confidence < FACE_MATCH_THRESHOLD) {
    return {
      error: "Face does not match. Please try again.",
      confidence,
      threshold: FACE_MATCH_THRESHOLD,
      status: 403,
    };
  }

  const today = localDate || getTodayString();

  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId: session.userId, date: today } },
  });
  if (existing) {
    return { error: "Attendance already recorded for today.", status: 409 };
  }

  const attendance = await prisma.attendance.create({
    data: {
      userId: session.userId,
      date: today,
      photoUrl: photo,
      matchConfidence: confidence,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/attendance");

  return {
    ok: true,
    confidence,
    attendanceId: attendance.id,
  };
}

export async function checkoutAttendance(payload: { embedding: number[]; photo: string; localDate?: string }) {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Unauthorized", status: 401 };
  }

  const { embedding, photo, localDate } = payload;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    return { error: "Invalid embedding", status: 400 };
  }
  if (!photo || typeof photo !== "string") {
    return { error: "Photo is required", status: 400 };
  }
  if (localDate && !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    return { error: "Invalid date format", status: 400 };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { faceEmbedding: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return { error: "User not found", status: 404 };
  }

  if (!user.faceEmbedding) {
    return { error: "Face not enrolled. Please complete enrollment first.", status: 422 };
  }

  const storedEmbedding: number[] = JSON.parse(user.faceEmbedding as string);
  const confidence = cosineSimilarity(embedding, storedEmbedding);

  if (confidence < FACE_MATCH_THRESHOLD) {
    return {
      error: "Face does not match. Please try again.",
      confidence,
      threshold: FACE_MATCH_THRESHOLD,
      status: 403,
    };
  }

  const today = localDate || getTodayString();

  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId: session.userId, date: today } },
  });
  if (!existing) {
    return { error: "No check-in found for today.", status: 404 };
  }
  if (existing.checkOutAt) {
    return { error: "Already checked out today.", status: 409 };
  }

  const updated = await prisma.attendance.update({
    where: { id: existing.id },
    data: {
      checkOutAt: new Date(),
      checkOutPhotoUrl: photo, // Save base64 directly to database
      checkOutConfidence: confidence,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/attendance");

  return {
    ok: true,
    confidence,
    checkOutAt: updated.checkOutAt?.toISOString(),
  };
}

export async function getTodayAttendance() {
  const session = await getSessionUser();
  if (!session) {
    return { error: "Unauthorized", status: 401 };
  }
  
  const today = getTodayString();
  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId: session.userId, date: today } },
  });

  return { record: existing };
}
