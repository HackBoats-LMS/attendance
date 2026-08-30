"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function enrollUserFace(embedding: number[]) {
  const session = await getSessionUser();
  if (!session) return { error: "Unauthorized", status: 401 };

  if (!Array.isArray(embedding) || embedding.length < 10) {
    return { error: "Invalid embedding: must be a non-empty numeric array", status: 400 };
  }

  if (!embedding.every((v) => typeof v === "number" && isFinite(v))) {
    return { error: "Embedding must contain only finite numbers", status: 400 };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { faceEmbedding: true },
  });

  if (user?.faceEmbedding) {
    return { error: "Face already enrolled. Please contact an administrator to reset your enrollment.", status: 409 };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { faceEmbedding: JSON.stringify(embedding) },
  });

  return { ok: true };
}
