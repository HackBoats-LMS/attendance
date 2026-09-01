import Link from "next/link";
import { redirect } from "next/navigation";
import StatusChip, { getLeaveChipVariant } from "@/components/ui/StatusChip";
import StatCard from "@/components/ui/StatCard";
import { getMe } from "@/features/auth/actions";
import { getTodayAttendance } from "@/features/attendance/actions";
import { getUserLeaves } from "@/features/leave/actions";

type DashAttendance = {
  id: string; date: string; takenAt: Date; matchConfidence: number;
  checkOutAt: Date | null; checkOutConfidence: number | null; userId: string;
};

type DashLeave =
  | { type: "single"; id: string; groupId: string | null; date: string; reason: string | null; status: string; appliedAt: Date }
  | { type: "range"; groupId: string; startDate: string; endDate: string; days: number; reason: string | null; status: string; appliedAt: Date };

export default async function DashboardPage() {
  const [userRes, attRes, leaveRes] = await Promise.all([
    getMe(),
    getTodayAttendance(),
    getUserLeaves()
  ]);

  if ("error" in userRes || !userRes.user) {
    redirect("/login");
  }

  const user = userRes.user;
  const attendance = ("record" in attRes ? attRes.record : null) as DashAttendance | null;
  const leaves = ("leaves" in leaveRes ? leaveRes.leaves : []) as DashLeave[];

  const checkedIn = !!attendance;
  const checkedOut = !!attendance?.checkOutAt;

  const totalApplied = leaves.length;
  const approvedCount = leaves.filter((l) => l.status === "approved").length;
  const cancelledCount = leaves.filter((l) => l.status === "cancelled").length;

  const recentLeaves = [...leaves]
    .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())
    .slice(0, 6);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex-1 bg-bg min-h-screen">
      <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm text-ink-muted font-medium">{dateStr}</p>
            <h1 className="text-2xl md:text-3xl font-bold text-ink mt-0.5">
              Welcome, {user.name}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
              {user.name?.charAt(0)?.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Today's Summary */}
        <h2 className="text-2xl font-bold text-ink mb-4">Today&apos;s Summary</h2>

        {/* Clock-in card */}
        <div className="card mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-1">Clock In</p>
                <p className="text-lg font-bold text-ink tabular-nums">
                  {checkedIn ? new Date(attendance.takenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—"}
                </p>
              </div>
              <div className="w-px h-8 bg-surface-border" />
              <div>
                <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-1">Clock Out</p>
                <p className="text-lg font-bold text-ink tabular-nums">
                  {checkedOut && attendance?.checkOutAt ? new Date(attendance.checkOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—"}
                </p>
              </div>
            </div>
            <div>
              {!user.hasFaceEmbedding ? (
                <Link href="/enroll" className="btn-primary inline-block text-sm">
                  Enroll Face First
                </Link>
              ) : checkedIn && checkedOut ? (
                <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary font-semibold rounded-full text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Done
                </span>
              ) : checkedIn && !checkedOut ? (
                <Link href="/attendance" className="btn-primary inline-block text-sm">
                  Check Out
                </Link>
              ) : (
                <Link href="/attendance" className="btn-primary inline-block text-sm">
                  Clock In Now
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Leave Summary */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-ink">Leave Summary</h2>
          <Link href="/leave" className="text-sm font-medium text-primary hover:text-primary-dark transition-colors">
            See All →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-8">
          <StatCard value={totalApplied} label="Total Applied" />
          <StatCard value={approvedCount} label="Approved" color="text-primary" />
          <StatCard value={cancelledCount} label="Cancelled" color="text-chip-red-text" />
        </div>

        {/* Recent Activity */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-ink">Recent Activity</h2>
          <Link href="/leave" className="text-sm font-medium text-primary hover:text-primary-dark transition-colors">
            See All →
          </Link>
        </div>
        {recentLeaves.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-ink-muted text-sm">No recent leave activity</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {recentLeaves.map((leave) => (
              <div key={leave.type === "single" ? leave.id : leave.groupId} className="card relative">
                <div className="absolute top-4 right-4">
                  <StatusChip
                    label={leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                    variant={getLeaveChipVariant(leave.status)}
                  />
                </div>
                <p className="text-sm font-bold text-ink pr-20 mb-1">
                  {leave.type === "single"
                    ? new Date(leave.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : `${new Date(leave.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(leave.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                  }
                </p>
                <p className="text-xs text-ink-muted line-clamp-1">{leave.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
