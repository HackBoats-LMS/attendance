"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  FingerPrintIcon,
  ExclamationCircleIcon,
  UserIcon,
  LockClosedIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

import { loginUser } from "@/features/auth/actions";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setLocked(false);

    try {
      const res = await loginUser({ username, password });

      if (res.ok) {
        router.push("/dashboard");
      } else {
        setError(res.error ?? "Login failed");
        if (res.status === 423) {
          setLocked(true);
        }
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-bg">
      <div className="card w-full max-w-md p-8 sm:p-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-full mb-4">
            <FingerPrintIcon className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight mb-1">
            AttendanceIQ
          </h1>
          <p className="text-ink-muted text-sm">Sign in to your workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <div
              className={`p-3 rounded-lg flex items-center gap-3 text-sm font-medium ${
                locked
                  ? "bg-amber-50 border border-amber-200 text-amber-700"
                  : "bg-red-50 border border-red-200 text-red-600"
              }`}
              role="alert"
            >
              {locked ? (
                <LockClosedIcon className="w-5 h-5 text-amber-500 shrink-0" />
              ) : (
                <ExclamationCircleIcon className="w-5 h-5 text-red-500 shrink-0" />
              )}
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="form-label">
              Username
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted pointer-events-none" />
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="form-input pl-10"
                placeholder="Enter your username"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="relative">
              <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted pointer-events-none" />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input pl-10"
                placeholder="Enter your password"
                required
                disabled={loading}
              />
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn-primary w-full mt-2 flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p className="text-center mt-8 text-xs text-ink-muted font-medium font-mono">
          Staff Attendance &amp; Leave Management System
        </p>
      </div>
    </div>
  );
}
