"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { randomUUID } from "crypto";

function datesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + "T00:00:00Z");
  const last = new Date(end + "T00:00:00Z");
  while (current <= last) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, "0");
    const d = String(current.getUTCDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export async function applyForLeave(payload: { startDate: string; endDate: string; reason?: string }) {
  const session = await getSessionUser();
  if (!session) return { error: "Unauthorized", status: 401 };

  const { startDate, endDate, reason } = payload;

  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { error: "Invalid start date format", status: 400 };
  }
  if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { error: "Invalid end date format", status: 400 };
  }
  if (startDate > endDate) {
    return { error: "Start date must be before end date", status: 400 };
  }

  const dates = datesInRange(startDate, endDate);
  if (dates.length > 31) {
    return { error: "Leave range cannot exceed 31 days", status: 400 };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { jobRole: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return { error: "User not found", status: 404 };
  }

  // Check own existing approved or pending leave in range
  const ownExisting = await prisma.leave.findMany({
    where: { userId: session.userId, status: { in: ["approved", "pending"] }, date: { in: dates } },
  });
  if (ownExisting.length > 0) {
    const conflictDates = ownExisting.map((l) => l.date).join(", ");
    return { error: `You already have approved leave on: ${conflictDates}`, status: 409 };
  }

  // Check role conflicts for each date
  const roleConflicts = await prisma.leave.findMany({
    where: {
      jobRole: user.jobRole,
      date: { in: dates },
      status: "approved",
      NOT: { userId: session.userId },
    },
    include: { user: { select: { name: true } } },
  });

  if (roleConflicts.length > 0) {
    const conflictDates = [...new Set(roleConflicts.map((l) => l.date))].join(", ");
    return { error: `Role occupied on: ${conflictDates}`, status: 409 };
  }

  const groupId = randomUUID();

  await prisma.leave.createMany({
    data: dates.map((date) => ({
      userId: session.userId,
      jobRole: user.jobRole,
      date,
      reason: reason ?? null,
      status: "pending",
      groupId,
    })),
  });

  return { ok: true, groupId, days: dates.length };
}

export async function getUserLeaves() {
  const session = await getSessionUser();
  if (!session) return { error: "Unauthorized", status: 401 };

  const leaves = await prisma.leave.findMany({
    where: { userId: session.userId },
    orderBy: { appliedAt: "desc" },
  });

  // Group by groupId (single-day leaves have no groupId, treat as their own group)
  const grouped: Record<string, typeof leaves> = {};
  for (const leave of leaves) {
    const key = leave.groupId ?? leave.id;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(leave);
  }

  // Build grouped response
  const result = Object.values(grouped).map((group) => {
    if (group.length === 1 && !group[0].groupId) {
      // Single-day leave
      return {
        type: "single" as const,
        id: group[0].id,
        date: group[0].date,
        reason: group[0].reason,
        status: group[0].status,
        appliedAt: group[0].appliedAt,
      };
    }
    // Multi-day leave
    const sorted = group.sort((a, b) => a.date.localeCompare(b.date));
    return {
      type: "range" as const,
      groupId: sorted[0].groupId,
      startDate: sorted[0].date,
      endDate: sorted[sorted.length - 1].date,
      days: sorted.length,
      reason: sorted[0].reason,
      status: sorted[0].status,
      appliedAt: sorted[0].appliedAt,
    };
  });

  return { leaves: result };
}

export async function checkLeaveConflicts(payload: { startDate?: string; endDate?: string; date?: string }) {
  const session = await getSessionUser();
  if (!session) return { error: "Unauthorized", status: 401 };

  const { startDate, endDate, date } = payload;
  let dates: string[];

  if (startDate && endDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return { error: "Invalid date format", status: 400 };
    }
    if (startDate > endDate) {
      return { error: "Start date must be before end date", status: 400 };
    }
    dates = datesInRange(startDate, endDate);
  } else if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { error: "Valid date parameter required", status: 400 };
    }
    dates = [date];
  } else {
    return { error: "Provide date or startDate+endDate", status: 400 };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { jobRole: true },
  });
  if (!user) return { error: "User not found", status: 404 };

  const conflicts = await prisma.leave.findMany({
    where: {
      jobRole: user.jobRole,
      date: { in: dates },
      status: "approved",
      NOT: { userId: session.userId },
    },
    include: { user: { select: { name: true } } },
  });

  if (dates.length === 1) {
    const conflict = conflicts[0];
    if (conflict) {
      return { available: false, occupiedBy: conflict.user.name };
    }
    return { available: true };
  }

  const conflictMap: Record<string, string> = {};
  for (const c of conflicts) {
    conflictMap[c.date] = c.user.name;
  }

  const dayResults = dates.map((d) => ({
    date: d,
    available: !conflictMap[d],
    occupiedBy: conflictMap[d] ?? null,
  }));

  return {
    available: dayResults.every((d) => d.available),
    days: dayResults,
  };
}

export async function cancelLeaveGroup(groupId: string) {
  const session = await getSessionUser();
  if (!session) return { error: "Unauthorized", status: 401 };

  await prisma.leave.updateMany({
    where: { groupId, userId: session.userId, status: "pending" },
    data: { status: "cancelled" },
  });
  return { ok: true };
}

export async function cancelLeaveSingle(id: string) {
  const session = await getSessionUser();
  if (!session) return { error: "Unauthorized", status: 401 };

  await prisma.leave.updateMany({
    where: { id, userId: session.userId, status: "pending" },
    data: { status: "cancelled" },
  });
  return { ok: true };
}

