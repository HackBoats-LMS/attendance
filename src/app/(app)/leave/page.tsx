"use client";

import { useEffect, useReducer, useCallback, FormEvent } from "react";
import StatusChip, { getLeaveChipVariant } from "@/components/ui/StatusChip";
import { applyForLeave, getUserLeaves, checkLeaveConflicts, cancelLeaveGroup, cancelLeaveSingle } from "@/features/leave/actions";

type DayResult = { date: string; available: boolean; occupiedBy: string | null };

type SingleLeave = { type: "single"; id: string; date: string; reason: string | null; status: string; appliedAt: Date };
type RangeLeave = { type: "range"; groupId: string; startDate: string; endDate: string; days: number; reason: string | null; status: string; appliedAt: Date };
type LeaveEntry = SingleLeave | RangeLeave;

type State = {
  startDate: string;
  endDate: string;
  reason: string;
  availability: { available: boolean; days?: DayResult[] } | null;
  checking: boolean;
  loading: boolean;
  error: string;
  success: string;
  leaves: LeaveEntry[];
  fetchingLeaves: boolean;
};

type Action =
  | { type: "SET_FIELD"; field: string; value: string }
  | { type: "CHECK_START" }
  | { type: "CHECK_DONE"; availability: { available: boolean; days?: DayResult[] } | null }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_OK"; message: string }
  | { type: "SUBMIT_ERR"; message: string }
  | { type: "LEAVES_LOADED"; leaves: LeaveEntry[] }
  | { type: "LEAVES_FETCH_DONE" }
  | { type: "CLEAR_MESSAGES" };

const initialState: State = {
  startDate: "", endDate: "", reason: "",
  availability: null, checking: false, loading: false,
  error: "", success: "",
  leaves: [], fetchingLeaves: true,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value, error: "", success: "" };
    case "CHECK_START":
      return { ...state, checking: true };
    case "CHECK_DONE":
      return { ...state, availability: action.availability, checking: false };
    case "SUBMIT_START":
      return { ...state, loading: true, error: "", success: "" };
    case "SUBMIT_OK":
      return { ...state, loading: false, success: action.message, startDate: "", endDate: "", reason: "", availability: null };
    case "SUBMIT_ERR":
      return { ...state, loading: false, error: action.message };
    case "LEAVES_LOADED":
      return { ...state, leaves: action.leaves, fetchingLeaves: false };
    case "LEAVES_FETCH_DONE":
      return { ...state, fetchingLeaves: false };
    case "CLEAR_MESSAGES":
      return { ...state, error: "", success: "" };
  }
}

export default function LeavePage() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchLeaves = useCallback(() => {
    getUserLeaves()
      .then((d) => {
        if ("error" in d) throw new Error(d.error);
        dispatch({ type: "LEAVES_LOADED", leaves: d.leaves as LeaveEntry[] });
      })
      .catch(() => dispatch({ type: "LEAVES_FETCH_DONE" }));
  }, []);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  useEffect(() => {
    if (!state.startDate) { dispatch({ type: "CHECK_DONE", availability: null }); return; }
    const end = state.endDate || state.startDate;
    if (end < state.startDate) return;

    dispatch({ type: "CHECK_START" });
    const t = setTimeout(() => {
      checkLeaveConflicts({ startDate: state.startDate, endDate: end })
        .then((d) => {
          if ("error" in d) throw new Error(d.error);
          dispatch({ type: "CHECK_DONE", availability: d as { available: boolean; days?: DayResult[] } });
        })
        .catch(() => dispatch({ type: "CHECK_DONE", availability: null }));
    }, 300);
    return () => clearTimeout(t);
  }, [state.startDate, state.endDate]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!state.availability?.available) {
      dispatch({ type: "SUBMIT_ERR", message: "One or more dates in this range are unavailable." });
      return;
    }
    dispatch({ type: "SUBMIT_START" });
    try {
      const res = await applyForLeave({ startDate: state.startDate, endDate: state.endDate || state.startDate, reason: state.reason });
      if (res.ok) {
        dispatch({ type: "SUBMIT_OK", message: `Leave applied for ${res.days} day${res.days! > 1 ? "s" : ""}!` });
        fetchLeaves();
      } else {
        dispatch({ type: "SUBMIT_ERR", message: res.error ?? "Failed to apply leave." });
      }
    } catch {
      dispatch({ type: "SUBMIT_ERR", message: "Network error. Please try again." });
    }
  }, [state.startDate, state.endDate, state.reason, state.availability, fetchLeaves]);

  const handleCancelGroup = useCallback(async (groupId: string) => {
    if (!confirm("Cancel all days in this leave period?")) return;
    const res = await cancelLeaveGroup(groupId);
    if (res.ok) { fetchLeaves(); }
  }, [fetchLeaves]);

  const handleCancelSingle = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to cancel this leave?")) return;
    const res = await cancelLeaveSingle(id);
    if (res.ok) { fetchLeaves(); }
  }, [fetchLeaves]);

  const hasRange = state.startDate && state.endDate && state.endDate > state.startDate;

  return (
    <div className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full">
      <div className="mb-6 md:mb-8">
        <h1 className="text-3xl font-heading font-bold text-ink tracking-tight">Leave Management</h1>
        <p className="text-ink-muted mt-1">Apply for leave and manage your history.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="card">
            <h2 className="text-lg font-heading font-semibold text-ink mb-4">Apply for Leave</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {state.error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{state.error}</div>
              )}
              {state.success && (
                <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm">{state.success}</div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label" htmlFor="startDate">Start Date</label>
                  <input type="date" id="startDate" required value={state.startDate}
                    onChange={(e) => dispatch({ type: "SET_FIELD", field: "startDate", value: e.target.value })}
                    className="form-input" min={new Date().toISOString().split("T")[0]} disabled={state.loading} />
                </div>
                <div>
                  <label className="form-label" htmlFor="endDate">End Date (optional)</label>
                  <input type="date" id="endDate" value={state.endDate}
                    onChange={(e) => dispatch({ type: "SET_FIELD", field: "endDate", value: e.target.value })}
                    className="form-input" min={state.startDate || new Date().toISOString().split("T")[0]} disabled={state.loading || !state.startDate} />
                </div>
              </div>

              {state.checking && (
                <div className="text-sm text-ink-muted flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-200 border-t-primary rounded-full animate-spin" />
                  Checking availability...
                </div>
              )}

              {state.availability?.days && hasRange && !state.checking && (
                <div className="text-sm space-y-1">
                  <div className={`font-medium ${state.availability.available ? "text-primary" : "text-red-600"}`}>
                    {state.availability.available ? `All ${state.availability.days.length} days available` : "Some dates are unavailable"}
                  </div>
                  {state.availability.days.map((d) => (
                    <div key={d.date} className="flex items-center gap-2 ml-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${d.available ? "bg-primary" : "bg-red-500"}`} />
                      <span className={d.available ? "text-ink-muted" : "text-red-600"}>
                        {d.date}{d.occupiedBy ? ` — ${d.occupiedBy}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {state.availability && !state.availability.days && !state.checking && (
                <div className={`text-sm flex items-center gap-2 ${state.availability.available ? "text-primary" : "text-red-600"}`}>
                  <div className={`w-2 h-2 rounded-full ${state.availability.available ? "bg-primary" : "bg-red-500"}`} />
                  {state.availability.available ? "Date is available for your role." : "Date is unavailable."}
                </div>
              )}

              <div>
                <label className="form-label" htmlFor="reason">Reason (Optional)</label>
                <textarea id="reason" value={state.reason}
                  onChange={(e) => dispatch({ type: "SET_FIELD", field: "reason", value: e.target.value })}
                  className="form-input min-h-[100px] resize-none" placeholder="Enter reason for leave..." disabled={state.loading} />
              </div>

              <button type="submit" disabled={state.loading || !!(state.availability && !state.availability.available)}
                className="btn-primary mt-2 flex items-center justify-center h-10">
                {state.loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Submit Application"}
              </button>
            </form>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-heading font-semibold text-ink mb-4">My Leave History</h2>
          <div className="flex flex-col gap-3">
            {state.fetchingLeaves ? (
              <div className="card flex justify-center">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-primary rounded-full animate-spin" />
              </div>
            ) : state.leaves.length === 0 ? (
              <div className="card text-center text-ink-muted text-sm">No leave records found.</div>
            ) : (
              state.leaves.map((entry) => (
                <div key={entry.type === "single" ? entry.id : entry.groupId} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="font-heading font-semibold text-ink">
                      {entry.type === "single" ? entry.date : `${entry.startDate} → ${entry.endDate}`}
                    </div>
                    {entry.type === "range" && <div className="text-xs text-ink-muted mt-0.5 font-mono">{entry.days} days</div>}
                    {entry.reason && <div className="text-sm text-ink-muted mt-1 line-clamp-2">{entry.reason}</div>}
                  </div>
                  <div className="flex items-center gap-4 justify-between sm:justify-end shrink-0">
                    <StatusChip label={entry.status === "cancelled" ? "Cancelled" : entry.status === "pending" ? "Pending" : "Approved"} variant={getLeaveChipVariant(entry.status)} />
                    {entry.status !== "cancelled" && (
                      <button
                        onClick={() => entry.type === "single" ? handleCancelSingle(entry.id) : handleCancelGroup(entry.groupId)}
                        className="text-red-600 hover:text-red-500 text-sm font-medium transition-colors p-1"
                        title="Cancel Leave">Cancel</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
