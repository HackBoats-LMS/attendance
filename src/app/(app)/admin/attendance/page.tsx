"use client";

import { useEffect, useReducer, useCallback } from "react";
import { getAdminAttendance } from "@/features/admin/actions";

type AttendanceRecord = {
  id: string;
  takenAt: Date;
  checkOutAt: Date | null;
  matchConfidence: number;
  photoUrl: string | null;
  user: { name: string; jobRole: string };
};

type State = { date: string; records: AttendanceRecord[]; loading: boolean };
type Action =
  | { type: "SET_DATE"; date: string }
  | { type: "LOADED"; records: AttendanceRecord[] }
  | { type: "DONE" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_DATE": return { ...state, date: action.date, loading: true };
    case "LOADED": return { ...state, records: action.records, loading: false };
    case "DONE": return { ...state, loading: false };
  }
}

export default function AdminAttendancePage() {
  const [state, dispatch] = useReducer(reducer, {
    date: new Date().toLocaleDateString("en-CA"),
    records: [],
    loading: true,
  });

  const fetchRecords = useCallback((targetDate: string) => {
    getAdminAttendance(targetDate)
      .then((d) => {
        if ("error" in d) throw new Error(d.error);
        dispatch({ type: "LOADED", records: d.records as AttendanceRecord[] });
      })
      .catch(() => dispatch({ type: "DONE" }));
  }, []);

  useEffect(() => { fetchRecords(state.date); }, [state.date, fetchRecords]);

  const handleDateChange = useCallback((date: string) => {
    dispatch({ type: "SET_DATE", date });
  }, []);

  return (
    <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full z-10 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-ink tracking-tight">Attendance Review</h1>
          <p className="text-ink-muted mt-1">Review daily staff punch-ins and photos.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-ink-muted">Select Date</label>
          <input type="date" value={state.date} onChange={(e) => handleDateChange(e.target.value)} className="form-input" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-ink">
            <thead className="bg-surface text-[10px] md:text-xs uppercase text-ink-muted border-b border-surface-border font-mono">
              <tr>
                <th className="px-3 md:px-6 py-3 md:py-4">Staff Member</th>
                <th className="px-3 md:px-6 py-3 md:py-4 hidden sm:table-cell">Role</th>
                <th className="px-3 md:px-6 py-3 md:py-4">Check-In</th>
                <th className="px-3 md:px-6 py-3 md:py-4">Check-Out</th>
                <th className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell">Duration</th>
                <th className="px-3 md:px-6 py-3 md:py-4 hidden lg:table-cell">Match</th>
                <th className="px-3 md:px-6 py-3 md:py-4 hidden lg:table-cell">Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {state.loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center">
                  <div className="inline-block w-8 h-8 border-2 border-surface-border border-t-primary rounded-full animate-spin" />
                </td></tr>
              ) : state.records.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-ink-muted">No attendance records for this date.</td></tr>
              ) : (
                state.records.map((r) => {
                  const checkIn = new Date(r.takenAt);
                  const checkOut = r.checkOutAt ? new Date(r.checkOutAt) : null;
                  const durationMs = checkOut ? checkOut.getTime() - checkIn.getTime() : null;
                  const durationHr = durationMs !== null ? Math.floor(durationMs / 3600000) : null;
                  const durationMin = durationMs !== null ? Math.floor((durationMs % 3600000) / 60000) : null;
                  return (
                    <tr key={r.id} className="border-b border-surface-border hover:bg-bg transition-colors">
                      <td className="px-3 md:px-6 py-3 md:py-4 font-medium text-ink">{r.user.name}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 hidden sm:table-cell">
                        <span className="bg-bg px-2 py-1 rounded text-xs">{r.user.jobRole}</span>
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-ink-muted font-mono">{checkIn.toLocaleTimeString([], { timeZone: "Asia/Kolkata" })}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-ink-muted font-mono">
                        {checkOut ? checkOut.toLocaleTimeString([], { timeZone: "Asia/Kolkata" }) : <span className="text-xs text-amber-600 font-medium">Active</span>}
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 text-ink-muted font-mono hidden md:table-cell">
                        {durationHr !== null ? (
                          <span className="text-xs font-medium">{durationHr}h {durationMin}m</span>
                        ) : <span className="text-xs text-ink-muted/50">—</span>}
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 hidden lg:table-cell">
                        <span className={`font-semibold font-mono ${r.matchConfidence > 0.85 ? 'text-green-600' : 'text-amber-600'}`}>
                          {(r.matchConfidence * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-4 hidden lg:table-cell">
                        {r.photoUrl ? (
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-surface-border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={r.photoUrl} alt={`Photo of ${r.user.name}`} className="w-full h-full object-cover" />
                          </div>
                        ) : <span className="text-xs text-ink-muted/50 italic">Purged</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
