"use client";

import { useEffect, useReducer, useCallback } from "react";
import StatusChip, { getLeaveChipVariant } from "@/components/ui/StatusChip";
import { getAdminLeaves, approveLeave, approveLeaveGroup, cancelLeaveGroupAdmin, cancelLeaveSingleAdmin } from "@/features/admin/actions";

type LeaveEntry = {
  id: string;
  type: "single" | "range";
  groupId: string | null;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  appliedAt: Date;
  user: { id: string; name: string; username: string; jobRole: string };
  hasConflict?: boolean;
  allDates: string[];
};

type State = {
  leaves: LeaveEntry[];
  loading: boolean;
};

type Action = 
  | { type: "LOADED"; leaves: LeaveEntry[] }
  | { type: "DONE" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOADED": return { ...state, leaves: action.leaves, loading: false };
    case "DONE": return { ...state, loading: false };
    default: return state;
  }
}

export default function AdminLeavesPage() {
  const [state, dispatch] = useReducer(reducer, { leaves: [], loading: true });

  const fetchLeaves = useCallback(() => {
    getAdminLeaves()
      .then((d) => {
        if ("error" in d) throw new Error(d.error);
        dispatch({ type: "LOADED", leaves: d.leaves as LeaveEntry[] });
      })
      .catch(() => dispatch({ type: "DONE" }));
  }, []);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  const handleApprove = useCallback(async (entry: LeaveEntry) => {
    const msg = entry.type === "range"
      ? `Approve all ${entry.days} days of leave for ${entry.user.name}?`
      : `Approve leave for ${entry.user.name} on ${entry.startDate}?`;
    if (!confirm(msg)) return;
    try {
      const res = entry.type === "range" && entry.groupId
        ? await approveLeaveGroup(entry.groupId)
        : await approveLeave(entry.id);
      if (res.ok) { fetchLeaves(); }
      else { alert(res.error ?? "Failed to approve leave"); }
    } catch (e) { console.error(e); alert("Network error"); }
  }, [fetchLeaves]);

  const handleCancel = useCallback(async (entry: LeaveEntry) => {
    const msg = entry.type === "range"
      ? `Cancel all ${entry.days} days of leave for ${entry.user.name}?`
      : `Cancel leave for ${entry.user.name} on ${entry.startDate}?`;
    if (!confirm(msg)) return;
    try {
      const res = entry.type === "range" && entry.groupId
        ? await cancelLeaveGroupAdmin(entry.groupId)
        : await cancelLeaveSingleAdmin(entry.id);
      if (res.ok) { fetchLeaves(); }
      else alert("Failed to cancel leave");
    } catch (e) { console.error(e); alert("Network error"); }
  }, [fetchLeaves]);

  return (
    <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full z-10 relative">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-ink tracking-tight">Leave Overview</h1>
        <p className="text-ink-muted mt-1">Review all staff leaves across the organization.</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-ink">
            <thead className="bg-surface text-[10px] md:text-xs uppercase text-ink-muted border-b border-surface-border font-mono">
              <tr>
                <th className="px-3 md:px-6 py-3 md:py-4">Period</th>
                <th className="px-3 md:px-6 py-3 md:py-4">Staff Member</th>
                <th className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell">Role</th>
                <th className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell">Reason</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-center">Status</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center">
                  <div className="inline-block w-8 h-8 border-2 border-surface-border border-t-primary rounded-full animate-spin" />
                </td></tr>
              ) : state.leaves.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-ink-muted">No leave records found.</td></tr>
              ) : (
                state.leaves.map((leave) => (
                  <tr key={leave.id} className="border-b border-surface-border hover:bg-bg transition-colors">
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <div className="font-heading font-semibold text-ink font-mono">
                        {leave.type === "range" ? `${leave.startDate} → ${leave.endDate}` : leave.startDate}
                      </div>
                      {leave.type === "range" && <div className="text-xs text-ink-muted mt-0.5">{leave.days} days</div>}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 font-medium text-ink">{leave.user.name}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell">
                      <span className="bg-bg px-2 py-1 rounded text-xs text-ink-muted">{leave.user.jobRole}</span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-ink-muted max-w-xs truncate hidden md:table-cell" title={leave.reason ?? undefined}>
                      {leave.reason || <span className="italic text-ink-muted/50">None provided</span>}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <StatusChip label={leave.status} variant={getLeaveChipVariant(leave.status)} />
                        {leave.status === "pending" && leave.hasConflict && (
                          <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium shadow-sm border border-red-200">
                            Role Conflict
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {leave.status === "pending" && (
                          <button onClick={() => handleApprove(leave)}
                            className="text-green-600 hover:text-green-700 text-sm font-medium transition-colors">Approve</button>
                        )}
                        {leave.status === "pending" && (
                          <button onClick={() => handleCancel(leave)}
                            className="text-red-500 hover:text-red-600 text-sm font-medium transition-colors">Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
