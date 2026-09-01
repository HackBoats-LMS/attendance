"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { getUsers, createUser, deactivateUser, reactivateUser, resetUserFaceEmbedding } from "@/features/admin/actions";

type User = {
  id: string;
  name: string;
  username: string;
  jobRole: string;
  hasFaceEmbedding: boolean;
  isActive: boolean;
  isOwner: boolean;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", password: "", jobRole: "" });
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const res = await getUsers();
      if ("error" in res) throw new Error(res.error);
      setUsers(res.users as User[]);
    } catch {
      setFetchError("Failed to load users. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError("");
    try {
      const res = await createUser(form);
      if (res.ok) {
        setShowModal(false);
        setForm({ name: "", username: "", password: "", jobRole: "" });
        fetchUsers();
      } else {
        setError(res.error ?? "Failed to create user");
      }
    } catch { setError("Network error"); } finally { setFormLoading(false); }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to deactivate ${name}?`)) return;
    setActionError("");
    try {
      const res = await deactivateUser(id);
      if (res.ok) fetchUsers();
      else setActionError(res.error ?? "Failed to deactivate user");
    } catch { setActionError("Network error. Please try again."); }
  };

  const handleReactivate = async (id: string, name: string) => {
    if (!confirm(`Reactivate ${name}?`)) return;
    setActionError("");
    try {
      const res = await reactivateUser(id);
      if (res.ok) fetchUsers();
      else setActionError(res.error ?? "Failed to reactivate user");
    } catch { setActionError("Network error. Please try again."); }
  };

  const handleResetFace = async (id: string, name: string) => {
    if (!confirm(`Reset face enrollment for ${name}? They will need to re-enroll.`)) return;
    setActionError("");
    try {
      const res = await resetUserFaceEmbedding(id);
      if (res.ok) fetchUsers();
      else setActionError(res.error ?? "Failed to reset face enrollment");
    } catch { setActionError("Network error. Please try again."); }
  };

  return (
    <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full z-10 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-ink tracking-tight">Staff Management</h1>
          <p className="text-ink-muted mt-1">Manage user accounts and access.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">+ Add New Staff</button>
      </div>

      {actionError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError("")} className="text-red-400 hover:text-red-600 ml-4 text-xs font-medium">Dismiss</button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-ink">
            <thead className="bg-surface text-[10px] md:text-xs uppercase text-ink-muted border-b border-surface-border font-mono">
              <tr>
                <th className="px-3 md:px-6 py-3 md:py-4">Name</th>
                <th className="px-3 md:px-6 py-3 md:py-4 hidden sm:table-cell">Username</th>
                <th className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell">Role</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-center hidden sm:table-cell">Face Profile</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-center hidden sm:table-cell">Status</th>
                <th className="px-3 md:px-6 py-3 md:py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center">
                  <div className="inline-block w-8 h-8 border-2 border-surface-border border-t-primary rounded-full animate-spin" />
                </td></tr>
              ) : fetchError ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center">
                  <p className="text-red-600 text-sm mb-3">{fetchError}</p>
                  <button onClick={fetchUsers} className="btn-primary text-sm py-1.5 px-4">Retry</button>
                </td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-ink-muted">No users found.</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className={`border-b border-surface-border hover:bg-bg transition-colors ${!u.isActive ? "opacity-60" : ""}`}>
                    <td className="px-3 md:px-6 py-3 md:py-4 font-medium text-ink">
                      {u.name} {u.isOwner && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 font-mono">Owner</span>}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-ink-muted font-mono hidden sm:table-cell">{u.username}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell">
                      <span className="bg-bg px-2 py-1 rounded text-xs">{u.jobRole}</span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-center hidden sm:table-cell">
                      {u.hasFaceEmbedding ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600" title="Enrolled">✓</span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-600" title="Not Enrolled">!</span>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-center hidden sm:table-cell">
                      {u.isActive ? (
                        <span className="text-green-600 text-xs font-medium">Active</span>
                      ) : (
                        <span className="text-red-500 text-xs font-medium">Deactivated</span>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                      <div className="flex items-center justify-end gap-3 flex-wrap">
                        {u.isActive && u.hasFaceEmbedding && !u.isOwner && (
                          <button onClick={() => handleResetFace(u.id, u.name)}
                            className="text-amber-600 hover:text-amber-700 text-sm font-medium transition-colors whitespace-nowrap">Reset Face</button>
                        )}
                        {u.isActive && !u.isOwner && (
                          <button onClick={() => handleDeactivate(u.id, u.name)}
                            className="text-red-500 hover:text-red-600 text-sm font-medium transition-colors">Deactivate</button>
                        )}
                        {!u.isActive && !u.isOwner && (
                          <button onClick={() => handleReactivate(u.id, u.name)}
                            className="text-green-600 hover:text-green-700 text-sm font-medium transition-colors">Reactivate</button>
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

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-xl font-heading font-bold text-ink mb-6">Add New Staff</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100">{error}</div>}
              <div><label className="form-label">Full Name</label>
                <input required className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Jane Doe" /></div>
              <div><label className="form-label">Username</label>
                <input required className="form-input" value={form.username} onChange={e => setForm({...form, username: e.target.value})} placeholder="janedoe" /></div>
              <div><label className="form-label">Job Role</label>
                <input required className="form-input" value={form.jobRole} onChange={e => setForm({...form, jobRole: e.target.value})} placeholder="e.g. Nurse" /></div>
              <div><label className="form-label">Initial Password</label>
                <input required type="password" className="form-input" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Temporary password" /></div>
              <div className="flex gap-3 justify-end mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-ink-muted hover:bg-bg transition-colors">Cancel</button>
                <button type="submit" disabled={formLoading} className="btn-primary">{formLoading ? "Creating..." : "Create Account"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
