"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser, hashPassword } from "@/lib/auth";

const RETENTION_DAYS = parseInt(process.env.PHOTO_RETENTION_DAYS ?? "30", 10);

export async function getAdminAttendance(date: string) {
  const session = await getSessionUser();
  if (!session || !session.isOwner) return { error: "Forbidden", status: 403 };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "Valid date parameter required (YYYY-MM-DD)", status: 400 };
  }

  const records = await prisma.attendance.findMany({
    where: { date },
    include: {
      user: {
        select: { id: true, name: true, username: true, jobRole: true },
      },
    },
    orderBy: { takenAt: "asc" },
  });

  return { records };
}

export async function getAdminLeaves() {
  const session = await getSessionUser();
  if (!session || !session.isOwner) return { error: "Forbidden", status: 403 };

  const leaves = await prisma.leave.findMany({
    include: {
      user: {
        select: { id: true, name: true, username: true, jobRole: true },
      },
    },
    orderBy: { appliedAt: "desc" },
  });

  const groups: Record<string, typeof leaves> = {};
  for (const leave of leaves) {
    const key = leave.groupId ?? leave.id;
    if (!groups[key]) groups[key] = [];
    groups[key].push(leave);
  }

  const result = Object.entries(groups).map(([, group]) => {
    const sorted = group.sort((a, b) => a.date.localeCompare(b.date));
    const isMultiDay = sorted.length > 1 && sorted[0].groupId;

    return {
      id: sorted[0].id,           // actual primary key — needed by approveLeave
      type: isMultiDay ? "range" : "single",
      groupId: sorted[0].groupId ?? null,
      startDate: sorted[0].date,
      endDate: sorted[sorted.length - 1].date,
      days: sorted.length,
      reason: sorted[0].reason,
      status: sorted[0].status,
      appliedAt: sorted[0].appliedAt,
      user: sorted[0].user,
    };
  });

  return { leaves: result };
}

export async function approveLeave(id: string) {
  const session = await getSessionUser();
  if (!session || !session.isOwner) return { error: "Forbidden", status: 403 };

  const leave = await prisma.leave.findUnique({ where: { id } });
  if (!leave) return { error: "Leave not found", status: 404 };
  if (leave.status !== "pending") return { error: "Only pending leaves can be approved", status: 400 };

  const conflict = await prisma.leave.findFirst({
    where: {
      jobRole: leave.jobRole,
      date: leave.date,
      status: "approved",
      NOT: { userId: leave.userId },
    },
  });

  if (conflict) {
    return { error: `Another staff member already has approved leave on ${leave.date}`, status: 409 };
  }

  if (leave.groupId) {
    const groupLeaves = await prisma.leave.findMany({
      where: { groupId: leave.groupId, status: "pending" },
    });

    const dates = groupLeaves.map((l) => l.date);
    const conflicts = await prisma.leave.findMany({
      where: {
        jobRole: leave.jobRole,
        date: { in: dates },
        status: "approved",
        NOT: { userId: leave.userId },
      },
    });

    if (conflicts.length > 0) {
      const conflictDates = [...new Set(conflicts.map((l) => l.date))].join(", ");
      return { error: `Conflicts on: ${conflictDates}`, status: 409 };
    }

    try {
      await prisma.$transaction(async (tx) => {
        const checkConflicts = await tx.leave.findMany({
          where: {
            jobRole: leave.jobRole,
            date: { in: dates },
            status: "approved",
            NOT: { userId: leave.userId },
          },
        });
        
        if (checkConflicts.length > 0) throw new Error("Conflict");

        await tx.leave.updateMany({
          where: { groupId: leave.groupId, status: "pending" },
          data: { status: "approved" },
        });
      });
    } catch (error: unknown) {
      if (
        (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002") ||
        (error instanceof Error && error.message === "Conflict")
      ) {
        return { error: "Another staff member already has approved leave on one or more of these dates.", status: 409 };
      }
      throw error;
    }

    return { ok: true, approved: groupLeaves.length };
  }

  await prisma.leave.update({
    where: { id },
    data: { status: "approved" },
  });

  return { ok: true, approved: 1 };
}

export async function purgePhotosAdmin() {
  const session = await getSessionUser();
  if (!session || !session.isOwner) return { error: "Forbidden", status: 403 };

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const oldRecords = await prisma.attendance.findMany({
    where: { 
      takenAt: { lt: cutoff }, 
      OR: [
        { photoUrl: { not: null } },
        { checkOutPhotoUrl: { not: null } }
      ]
    },
    select: { id: true },
  });

  let deleted = 0;

  for (const record of oldRecords) {
    await prisma.attendance.update({
      where: { id: record.id },
      data: { 
        photoUrl: null,
        checkOutPhotoUrl: null
      },
    });
    deleted++;
  }

  return { ok: true, deleted, errors: 0, cutoff };
}

export async function getUsers() {
  const session = await getSessionUser();
  if (!session || !session.isOwner) return { error: "Forbidden", status: 403 };

  const users = await prisma.user.findMany({
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
    orderBy: { createdAt: "asc" },
  });

  const safeUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    jobRole: u.jobRole,
    isOwner: u.isOwner,
    isActive: u.isActive,
    hasFaceEmbedding: !!u.faceEmbedding,
    createdAt: u.createdAt,
  }));

  return { users: safeUsers };
}

export async function createUser(payload: { name: string; username: string; password: string; jobRole: string }) {
  const session = await getSessionUser();
  if (!session || !session.isOwner) return { error: "Forbidden", status: 403 };

  const { name, username, password, jobRole } = payload;

  if (!name || !username || !password || !jobRole) {
    return { error: "name, username, password, and jobRole are all required", status: 400 };
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return { error: "Username already taken", status: 409 };
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { name, username, passwordHash, jobRole, isOwner: false, isActive: true },
    select: { id: true, name: true, username: true, jobRole: true, createdAt: true },
  });

  return { ok: true, user };
}

export async function deactivateUser(id: string) {
  const session = await getSessionUser();
  if (!session || !session.isOwner) return { error: "Forbidden", status: 403 };

  if (id === session.userId) {
    return { error: "Cannot deactivate your own account", status: 400 };
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return { error: "User not found", status: 404 };
  }

  await prisma.user.update({ where: { id }, data: { isActive: false } });

  return { ok: true };
}

export async function cancelLeaveGroupAdmin(groupId: string) {
  const session = await getSessionUser();
  if (!session || !session.isOwner) return { error: "Forbidden", status: 403 };

  // Admin cancel: no userId restriction — can cancel any user's pending leaves
  await prisma.leave.updateMany({
    where: { groupId, status: "pending" },
    data: { status: "cancelled" },
  });
  return { ok: true };
}

export async function cancelLeaveSingleAdmin(id: string) {
  const session = await getSessionUser();
  if (!session || !session.isOwner) return { error: "Forbidden", status: 403 };

  // Admin cancel: no userId restriction — can cancel any user's pending leave
  await prisma.leave.updateMany({
    where: { id, status: "pending" },
    data: { status: "cancelled" },
  });
  return { ok: true };
}
