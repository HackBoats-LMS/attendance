import { NextResponse } from "next/server";
import { executePhotoPurge } from "@/lib/purge";

const RETENTION_DAYS = parseInt(process.env.PHOTO_RETENTION_DAYS ?? "30", 10);

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("x-cron-secret");

  if (!cronSecret || authHeader !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { deleted, cutoff } = await executePhotoPurge(RETENTION_DAYS);
    return NextResponse.json({ ok: true, deleted, cutoff });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
