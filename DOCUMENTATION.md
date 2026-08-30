# AttendanceIQ — Complete Technical Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Authentication System](#5-authentication-system)
6. [Route Protection and Middleware](#6-route-protection-and-middleware)
7. [Layout Hierarchy](#7-layout-hierarchy)
8. [Page-by-Page Breakdown](#8-page-by-page-breakdown)
9. [Server Actions Reference](#9-server-actions-reference)
10. [Face Recognition System](#10-face-recognition-system)
11. [Leave Conflict System](#11-leave-conflict-system)
12. [Styling and Design System](#12-styling-and-design-system)
13. [Environment Variables](#13-environment-variables)
14. [Data Flow Diagrams](#14-data-flow-diagrams)
15. [File Inventory](#15-file-inventory)

---

## 1. Project Overview

**AttendanceIQ** is a staff attendance and leave management system built for organizations that need:

- **Face-recognition-based punch-in** for quick and secure attendance tracking
- **Role-based leave management** where only one person per job role can be on leave on any given day, ensuring continuous shift coverage
- **Admin panel** for managing staff, reviewing attendance, and overseeing leaves

The app runs as a Next.js 16 application with a PostgreSQL database (via Prisma ORM) and uses client-side machine learning (`@vladmandic/human`) for face detection and embedding extraction.

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.3.2 |
| Language | TypeScript | 5.x |
| UI Library | React | 19.2.8 |
| Styling | Tailwind CSS | 4.3.3 |
| Database | PostgreSQL (via Supabase) | — |
| ORM | Prisma | 5.22.0 |
| Auth | jose (JWT) + bcryptjs | 6.2.10 / 3.0.3 |
| Face Detection | @vladmandic/human | 3.3.6 |
| Icons | @heroicons/react | 2.2.0 |
| Testing | Jest + Testing Library | 30.x / 16.x (configured, no tests yet) |

---

## 3. Project Structure

```
attendance/
├── prisma/
│   └── schema.prisma                  # Database models (User, Attendance, Leave)
├── src/
│   ├── proxy.ts                       # Next.js 16 middleware — route protection
│   ├── app/
│   │   ├── layout.tsx                 # Root layout (HTML shell, fonts, background)
│   │   ├── page.tsx                   # Root "/" — redirects to /login
│   │   ├── globals.css                # Global styles + Tailwind + custom components
│   │   ├── favicon.ico                # App icon
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx           # Login form (client component)
│   │   └── (app)/
│   │       ├── layout.tsx             # App layout — fetches user, renders Navigation sidebar
│   │       ├── dashboard/
│   │       │   └── page.tsx           # Dashboard home (SERVER component)
│   │       ├── attendance/
│   │       │   └── page.tsx           # Thin shell — renders AttendanceCamera
│   │       ├── leave/
│   │       │   └── page.tsx           # Leave application + history (client component)
│   │       ├── enroll/
│   │       │   └── page.tsx           # Thin shell — renders EnrollmentCamera
│   │       └── admin/
│   │           ├── users/
│   │           │   └── page.tsx       # Staff management (client component)
│   │           ├── attendance/
│   │           │   └── page.tsx       # Attendance review by date (client component)
│   │           └── leaves/
│   │               └── page.tsx       # All leaves overview (client component)
│   ├── components/
│   │   ├── layout/
│   │   │   └── Navigation.tsx         # Sidebar + mobile bottom nav (client component)
│   │   └── ui/
│   │       ├── StatCard.tsx           # Stat number card
│   │       └── StatusChip.tsx         # Coloured status badge
│   ├── features/                      # Domain-specific business logic (Next.js Server Actions)
│   │   ├── admin/
│   │   │   └── actions.ts             # getAdminAttendance, getAdminLeaves, getUsers, createUser, deactivateUser, purgePhotosAdmin
│   │   ├── attendance/
│   │   │   ├── actions.ts             # recordAttendance, checkoutAttendance, getTodayAttendance
│   │   │   └── components/
│   │   │       └── AttendanceCamera.tsx  # Face detection + punch-in/out UI (client)
│   │   ├── auth/
│   │   │   └── actions.ts             # loginUser, logoutUser, getMe
│   │   ├── enrollment/
│   │   │   ├── actions.ts             # enrollUserFace
│   │   │   └── components/
│   │   │       └── EnrollmentCamera.tsx  # Face enrollment UI (client)
│   │   └── leave/
│   │       └── actions.ts             # applyForLeave, getUserLeaves, checkLeaveConflicts, cancelLeaveGroup, cancelLeaveSingle
│   ├── hooks/                         # (empty — reserved for custom React hooks)
│   └── lib/
│       ├── auth.ts                    # JWT, bcrypt, session helpers, startup guards
│       ├── prisma.ts                  # Singleton Prisma client
│       ├── cosine.ts                  # Cosine similarity for face matching
│       ├── cache.ts                   # In-memory fetch deduplication cache (client-side)
│       └── ear.ts                     # Eye Aspect Ratio utility (unused — blink detection removed)
├── public/
│   ├── models/                        # @vladmandic/human ML model files
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── .env                               # Environment variables (gitignored)
├── .env.example                       # Documented env var template
├── .gitignore
├── DOCUMENTATION.md                   # This file
├── README.md
├── eslint.config.mjs                  # ESLint config
├── next.config.ts                     # Next.js config (serverExternalPackages for human.js)
├── package.json                       # Dependencies and scripts
├── package-lock.json
├── postcss.config.js                  # PostCSS plugins (Tailwind + autoprefixer)
├── tailwind.config.ts                 # Tailwind CSS configuration
├── tsconfig.json                      # TypeScript config (strict, path aliases)
└── tsconfig.tsbuildinfo               # TypeScript build cache
```

---

## 4. Database Schema

### User

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key |
| `name` | String | Full name |
| `username` | String | Unique login identifier |
| `passwordHash` | String | bcrypt hash (12 rounds) |
| `jobRole` | String | e.g. "Nurse", "Doctor" — used for leave conflict checks |
| `isOwner` | Boolean | Admin flag (default: `false`) |
| `isActive` | Boolean | Soft-delete flag (default: `true`) |
| `faceEmbedding` | String? | JSON-serialized float array (nullable until enrolled) |
| `failedLoginAttempts` | Int | Incremented on bad password; resets on success (default: `0`) |
| `lockedUntil` | DateTime? | Account lockout expiry — set after 5 failed logins (15-min lock) |
| `createdAt` | DateTime | Auto-set on creation |
| `attendance` | Attendance[] | Relation |
| `leaves` | Leave[] | Relation |

### Attendance

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key |
| `userId` | String | FK to User |
| `date` | String | `YYYY-MM-DD` format |
| `photoUrl` | String? | Base64 JPEG of check-in photo (nulled after 30-day purge) |
| `matchConfidence` | Float | Cosine similarity score for check-in (0 to 1) |
| `takenAt` | DateTime | Timestamp of punch-in |
| `checkOutAt` | DateTime? | Timestamp of check-out (null if not yet checked out) |
| `checkOutPhotoUrl` | String? | Base64 JPEG of check-out photo (nulled after purge) |
| `checkOutConfidence` | Float? | Cosine similarity score for check-out |
| **Unique** | `[userId, date]` | One punch-in per user per day |

### Leave

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key |
| `userId` | String | FK to User |
| `jobRole` | String | Denormalized from User at creation |
| `date` | String | `YYYY-MM-DD` |
| `reason` | String? | Optional reason |
| `status` | String | `"pending"`, `"approved"`, or `"cancelled"` (default: `"pending"`) |
| `groupId` | String? | UUID linking multi-day leave rows together |
| `appliedAt` | DateTime | Timestamp |
| **Partial Unique Index** | `[jobRole, date] WHERE status = 'approved'` | Enforces one approved leave per role per day |

The partial unique index is the key enforcement mechanism: it prevents two staff members with the same job role from having approved leave on the same date, ensuring operational continuity.

---

## 5. Authentication System

### Overview

Authentication uses **JWT tokens** stored in **HttpOnly cookies** (`auth_token`). The system provides:

- Password hashing with bcrypt (12 salt rounds)
- JWT signing with HS256 (7-day expiry)
- Session extraction from cookies
- Higher-order function (HOF) wrappers for route protection

### Auth Flow

```
1. User submits username + password
2. loginUser() Server Action looks up user, verifies password
3. JWT signed with { userId, isOwner } — 7-day expiry
4. Cookie set: auth_token=<token>; HttpOnly; SameSite=Strict; Path=/
5. Subsequent requests include cookie automatically
6. getSessionUser() verifies the JWT on each Server Action call
7. logoutUser() Server Action clears the cookie (Max-Age=0)
```

### Key Functions in src/lib/auth.ts

| Function | Purpose |
|----------|---------|
| `hashPassword(plain)` | bcrypt hash with 12 rounds |
| `verifyPassword(plain, hash)` | Compare plaintext to hash |
| `signToken(payload)` | Create HS256 JWT with 7-day expiry |
| `verifyToken(token)` | Decode + verify JWT; returns `SessionPayload \| null` |
| `getSessionUser()` | Read cookie, verify token, return `{ userId, isOwner }` |
| `setAuthCookie(response, token)` | Set HttpOnly cookie (adds `Secure` in production) |
| `clearAuthCookie(response)` | Clear cookie (Max-Age=0) |

**Startup guard:** If `JWT_SECRET` is missing or equals the placeholder value in production, the app throws an error at startup rather than silently running with a weak secret.

### Session Payload

```typescript
interface SessionPayload {
  userId: string;   // User's database ID
  isOwner: boolean; // Admin flag
}
```

---

## 6. Route Protection and Middleware

### Proxy (Middleware) — src/proxy.ts

In Next.js 16, middleware is defined in `src/proxy.ts` and exports a `proxy` function. This runs on every matching request before the page loads.

**Logic:**

```
Request arrives
  │   └── YES -> proceed
  └── Response goes to client
```

**Matcher:** Runs on all routes except static assets (`_next/static`, `_next/image`, `favicon.ico`, `*.png`).

### API Route Protection

Every API route is wrapped with either `withAuth` or `withAdminAuth`:

```typescript
// Regular authenticated route
export const GET = withAuth(async (request, session) => {
  // session.userId is available
  // Returns 401 if no valid session
});

// Admin-only route
export const GET = withAdminAuth(async (request, session) => {
  // session.userId and session.isOwner are available
  // Returns 403 if not an owner
});
```

### Route Protection Summary

| Route | Protection Level |
|-------|-----------------|
| `/login` | Public (redirects to `/dashboard` if already logged in) |
| `/api/login`, `/api/logout` | Public |
| `/api/me`, `/api/enroll`, `/api/attendance/*`, `/api/leave/*` | `withAuth` — requires valid JWT |
| `/api/admin/*` | `withAdminAuth` — requires valid JWT + `isOwner: true` (except `purge-photos`, which also accepts `x-cron-secret` — see Section 9) |
| `/dashboard`, `/attendance`, `/leave`, `/enroll` | Proxy: requires auth cookie |
| `/admin/*` | Proxy: requires auth cookie (owner check at API level) |

---

## 7. Layout Hierarchy

### Root Layout (src/app/layout.tsx)

The outermost HTML shell. Contains:

- Inter Google font
- Page metadata (title, description)
- `<body>` with dark background, flex layout, gradient glow effects
- Renders `{children}` — all page content goes here
- Does **NOT** include the Navigation sidebar

### App Layout (src/app/(app)/layout.tsx)

Wraps all authenticated pages. Contains:

- `<Navigation />` — the sidebar
- `<main>` — content area with overflow scroll

**This layout only applies to pages inside the `(app)/` route group.** The login page lives in `(auth)/` and does not get this layout.

### Route Grouping

| Route Group | Layout | Sidebar? | Pages |
|-------------|--------|----------|-------|
| `(auth)` | Root layout only | No | `/login` |
| `(app)` | Root layout + App layout | Yes | `/dashboard`, `/attendance`, `/leave`, `/enroll`, `/admin/*` |

The URL `/dashboard` maps to `src/app/(app)/dashboard/page.tsx`. The `(app)` segment does not appear in the URL.

---

## 8. Page-by-Page Breakdown

### 8.1 Login Page (/login)

**File:** `src/app/(auth)/login/page.tsx`
**Type:** Client component

**What it does:** Renders a glass-card login form with username/password fields.

**Flow:**

1. User enters credentials
2. `loginUser({ username, password })` Server Action is called
3. On success: `router.push("/dashboard")`
4. On failure: displays error message

**Server Action called:** `loginUser`

### 8.2 Dashboard (/dashboard)

**File:** `src/app/(app)/dashboard/page.tsx`
**Type:** SERVER component (calls Server Actions directly, no client-side fetch)

**What it does:** Shows today's clock-in/out status, leave summary stats, and recent leave activity.

**Flow:**

1. Calls `getMe()`, `getTodayAttendance()`, and `getUserLeaves()` Server Actions in parallel
2. Displays today's date and welcome message with user name
3. Shows **Today's Summary** card:
   - Clock-in time (or `—` if not yet clocked in)
   - Clock-out time (or `—` if not yet checked out)
   - "Clock In Now" → `/attendance` button (if not clocked in)
   - "Check Out" → `/attendance` button (if clocked in but not out)
   - "Done" badge (if both clocked in and out)
4. Shows **Leave Summary** stats: Total Applied, Approved, Cancelled counts
5. Shows **Recent Activity** — last 6 leave entries as cards

**Server Actions called:** `getMe`, `getTodayAttendance`, `getUserLeaves`

### 8.3 Attendance / Punch In + Out (/attendance)

**File:** `src/app/(app)/attendance/page.tsx` (thin shell)
**Component:** `src/features/attendance/components/AttendanceCamera.tsx`
**Type:** Client component (~440 lines)

**What it does:** Live face-recognition check-in AND check-out in a single page.

**Status State Machine:**

```
idle -> loading-model -> camera-starting -> detecting -> submitting -> success | error | already-done | checked-out
```

**Mode:** `"check-in"` or `"check-out"` — determined automatically from today's record.

**Flow:**

1. Calls `getTodayAttendance()` Server Action on mount to determine mode
2. Loads `@vladmandic/human` model dynamically (client-side)
3. Starts webcam (front-facing, 640x480)
4. Detection loop (~10 FPS):
   - Runs face detection on each frame
   - Waits for 15 consecutive frames of stable face detection
5. On stable detection:
   - Captures JPEG photo from canvas
   - Extracts face embedding from human.js
   - Calls `recordAttendance` or `checkoutAttendance` Server Action
6. Server Action:
   - Computes cosine similarity between live and stored embedding
   - If confidence >= 0.75: creates/updates Attendance row with base64 photo
   - If confidence < 0.75: returns 403
   - Calls `revalidatePath('/dashboard')` to bust the dashboard cache

**Key constants:**

- `DETECTION_THROTTLE_MS = 100` — ~10 FPS detection rate

**Server Actions called:** `getTodayAttendance`, `recordAttendance`, `checkoutAttendance`

### 8.4 Leave Requests (/leave)

**File:** `src/app/(app)/leave/page.tsx`
**Type:** Client component (uses `useReducer` for state management)

**What it does:** Apply for single-day or multi-day leave ranges, and view/cancel leave history.

**Flow:**

1. Calls `getUserLeaves()` Server Action on mount to load leave history
2. User picks a Start Date (and optional End Date for multi-day ranges)
3. After 300ms debounce, calls `checkLeaveConflicts()` to check date availability
4. Availability response:
   - `{ available: true }` — all dates open
   - `{ available: false, days: [...] }` — per-day conflict breakdown with occupant names
5. On submit: calls `applyForLeave({ startDate, endDate, reason })` Server Action
   - Single-day: creates 1 Leave row
   - Multi-day: creates N Leave rows linked by a shared `groupId` UUID
6. Leave status starts as `"pending"`. Cancel options:
   - Single leave: `cancelLeaveSingle(id)`
   - Multi-day group: `cancelLeaveGroup(groupId)` — cancels all rows in the group

**Server Actions called:** `getUserLeaves`, `checkLeaveConflicts`, `applyForLeave`, `cancelLeaveSingle`, `cancelLeaveGroup`

### 8.5 Face Enrollment (/enroll)

**File:** `src/app/(app)/enroll/page.tsx` (thin shell)
**Component:** `src/features/enrollment/components/EnrollmentCamera.tsx`
**Type:** Client component

**What it does:** Capture and save a face embedding for future punch-in matching.

**Flow:**

1. Loads `@vladmandic/human` model
2. Starts webcam
3. Detection loop (500ms intervals):
   - Detects face with `boxScore > 0.7`
   - Captures embedding
   - Increments progress (needs 3 captures)
4. After 3 captures: averages the embeddings into a stable template
5. Calls `enrollUserFace(averagedArray)` Server Action
6. On success: redirects to `/dashboard` after 2 seconds

**Key difference from attendance page:** Collects 3 embeddings and averages them for robustness. No blink detection needed (enrollment is a one-time deliberate action).

**Server Actions called:** `enrollUserFace`

### 8.6 Admin — Staff Management (/admin/users)

**File:** `src/app/(app)/admin/users/page.tsx`
**Type:** Client component

**What it does:** List, create, and deactivate staff members.

**Flow:**

1. Calls `getUsers()` Server Action on mount
2. Displays table: Name (with Owner badge), Username, Role, Face Profile, Status, Actions
3. "Add New Staff" opens modal form: calls `createUser({ name, username, password, jobRole })`
4. "Deactivate": calls `deactivateUser(id)` (cannot deactivate yourself)

**Server Actions called:** `getUsers`, `createUser`, `deactivateUser`

### 8.7 Admin — Attendance Review (/admin/attendance)

**File:** `src/app/(app)/admin/attendance/page.tsx`
**Type:** Client component

**What it does:** Review attendance records by date — shows check-in time, check-out time, duration, match confidence, and snapshot photo.

**Flow:**

1. Date picker defaults to today
2. Calls `getAdminAttendance(date)` Server Action
3. Displays table: Staff Member, Role, Check-In, Check-Out, Duration, Match Confidence (color-coded), Snapshot

**Server Actions called:** `getAdminAttendance`

### 8.8 Admin — Leave Overview (/admin/leaves)

**File:** `src/app/(app)/admin/leaves/page.tsx`
**Type:** Client component

**What it does:** View and manage all leaves across the organization, grouped by leave period.

**Flow:**

1. Calls `getAdminLeaves()` Server Action on mount
2. Displays grouped leave entries: Date/Range, Staff Member, Role, Days, Reason, Status, Actions
3. Admins can approve pending leaves: single-day via `approveLeave(id)`, multi-day ranges via `approveLeaveGroup(groupId)`
4. Admins can cancel pending leaves: single-day via `cancelLeaveSingle(id)`, multi-day ranges via `cancelLeaveGroup(groupId)`

**Server Actions called:** `getAdminLeaves`, `approveLeave`, `approveLeaveGroup`, `cancelLeaveGroup`

---

## 9. Server Actions Reference

This app uses **Next.js Server Actions** instead of traditional REST API routes. All data mutations and queries are performed via typed async functions in `src/features/*/actions.ts` files. There is no `src/app/api/` directory.

### Auth (`src/features/auth/actions.ts`)

| Function | Auth | Description |
|----------|------|-------------|
| `loginUser({ username, password })` | None | Verifies credentials, sets JWT cookie. Returns `{ ok: true }` or `{ error, status }`. Implements account lockout after 5 failed attempts (15-min lock). |
| `logoutUser()` | None | Clears the `auth_token` cookie. |
| `getMe()` | Session cookie | Returns `{ user: { id, name, username, jobRole, isOwner, hasFaceEmbedding, createdAt } }` or `{ error }`. Never exposes the raw `faceEmbedding`. |

### Attendance (`src/features/attendance/actions.ts`)

| Function | Auth | Description |
|----------|------|-------------|
| `recordAttendance({ embedding, photo, localDate? })` | Session | Verifies face match (cosine ≥ threshold). Creates Attendance row. Saves base64 photo in DB. Calls `revalidatePath('/dashboard')`. |
| `checkoutAttendance({ embedding, photo, localDate? })` | Session | Verifies face match. Updates existing Attendance row with `checkOutAt`, `checkOutPhotoUrl`, `checkOutConfidence`. |
| `getTodayAttendance()` | Session | Returns today's attendance record (timestamps only — excludes photo blobs for performance). Uses `noStore()`. |

### Enrollment (`src/features/enrollment/actions.ts`)

| Function | Auth | Description |
|----------|------|-------------|
| `enrollUserFace(embedding: number[])` | Session | Validates embedding (min 10 finite numbers). Saves JSON-stringified array to `user.faceEmbedding`. Returns 409 if already enrolled. |

### Leave (`src/features/leave/actions.ts`)

| Function | Auth | Description |
|----------|------|-------------|
| `applyForLeave({ startDate, endDate, reason? })` | Session | Creates Leave rows (one per day, linked by `groupId` UUID). Checks own conflicts and role conflicts before creating. Max 31 days. |
| `getUserLeaves()` | Session | Returns all leaves for the current user, grouped into single/range entries. Uses `noStore()`. |
| `checkLeaveConflicts({ startDate, endDate?, date? })` | Session | Checks all dates in the range for role conflicts. Returns per-day availability breakdown. |
| `cancelLeaveSingle(id)` | Session | Sets a single `pending` leave to `cancelled`. |
| `cancelLeaveGroup(groupId)` | Session | Sets all `pending` leaves in a group to `cancelled`. |

### Admin (`src/features/admin/actions.ts`)

| Function | Auth | Description |
|----------|------|-------------|
| `getAdminAttendance(date)` | Owner | Returns all attendance records for a given date, including user info. |
| `getAdminLeaves()` | Owner | Returns all leaves across the organisation, grouped by leave period. |
| `approveLeave(id)` | Owner | Approves a pending leave, checking for role conflicts first. |
| `cancelLeaveGroup(groupId)` | Owner | Cancels all leaves in a group. |
| `purgePhotosAdmin()` | Owner | Nulls `photoUrl` and `checkOutPhotoUrl` on all attendance records older than `PHOTO_RETENTION_DAYS`. (Photos are in the DB — no disk deletion needed.) |
| `getUsers()` | Owner | Returns all users with `hasFaceEmbedding` (never raw embedding). |
| `createUser({ name, username, password, jobRole })` | Owner | Creates a new staff account with bcrypt-hashed password. Returns 409 if username taken. |
| `deactivateUser(id)` | Owner | Sets `isActive: false`. Cannot deactivate your own account. |

---

## 10. Face Recognition System

### Overview

The face recognition system uses a **client-side ML pipeline** with server-side verification:

1. **Client:** `@vladmandic/human` runs face detection, mesh extraction, and embedding generation in the browser
2. **Server:** Cosine similarity comparison between the live embedding and the stored enrollment embedding

### Enrollment Flow

```
Camera -> @vladmandic/human detect -> extract face descriptor (embedding)
    -> repeat 3 times -> average the 3 embeddings
    -> enrollUserFace(averagedArray) Server Action -> save as JSON string in user.faceEmbedding
```

The 3-embedding average creates a more stable template that is robust to slight variations in angle, lighting, and expression.

### Punch-In Flow

```
Camera -> @vladmandic/human detect -> extract face descriptor (embedding)
    -> wait for 15 consecutive frames of face detection
    -> on stable detection: capture photo + embedding
    -> recordAttendance({embedding, photo}) Server Action
    -> Server: cosineSimilarity(live, stored)
    -> if confidence >= 0.75 -> save attendance (base64 photo directly in DB)
    -> if confidence < 0.75 -> return { error, status: 403 }
```

### Cosine Similarity (src/lib/cosine.ts)

Computes the cosine of the angle between two vectors:

```
similarity = (a . b) / (||a|| * ||b||)
```

Result ranges from -1 (opposite) to 1 (identical). The threshold is 0.75 by default (configurable via `FACE_MATCH_THRESHOLD` env var).

### Human.js Configuration

The config differs slightly between the two camera components:

**AttendanceCamera** (`src/features/attendance/components/AttendanceCamera.tsx`):
```typescript
{
  modelBasePath: "/models",
  face: {
    enabled: true,
    detector: { rotation: true, return: true },
    mesh: { enabled: true },            // Enabled in attendance camera
    description: { enabled: true },     // Face embedding extraction
    iris: { enabled: false },
    emotion: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
}
```

**EnrollmentCamera** (`src/features/enrollment/components/EnrollmentCamera.tsx`):
```typescript
{
  modelBasePath: "/models",
  face: {
    enabled: true,
    detector: { rotation: true, return: true },
    mesh: { enabled: false },           // Not needed for enrollment
    description: { enabled: true },     // Face embedding extraction
    iris: { enabled: false },
    emotion: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
}
```

---

## 11. Leave Conflict System

### The Problem

In shift-based workplaces, if two nurses both take leave on the same day, there may not be enough coverage. The system enforces that **only one person per job role can have approved leave on any given day**.

### How It Works

**Three layers of enforcement:**

1. **UI level:** The `/leave` page calls `checkLeaveConflicts()` Server Action when a date is selected. If another user with the same role already has approved leave on that date, the response shows `{ available: false, occupiedBy: "Name" }`.

2. **Server Action level:** `applyForLeave()` re-checks role conflicts before creating Leave rows. If a same-role conflict is found, it returns `{ error: "Role occupied on: ...", status: 409 }`. The function also catches Prisma error code P2002 (unique constraint violation) as an ultimate fallback.

3. **Database level:** A partial unique index on the `Leave` table:
   ```sql
   CREATE UNIQUE INDEX role_date_active
     ON "Leave" ("jobRole", "date")
     WHERE status = 'approved';
   ```
   This is the ultimate safety net — even if the action logic fails, the database rejects duplicate role leaves.

### Data Flow

```
User selects date range
  -> checkLeaveConflicts({ startDate, endDate }) Server Action
  -> Looks up: any other user with same jobRole + approved leave on those dates?
  -> If yes: { available: false, days: [{ date, available: false, occupiedBy: "Dr. Smith" }] }
  -> If no:  { available: true }

User submits form
  -> applyForLeave({ startDate, endDate, reason }) Server Action
  -> Re-checks own + role conflicts
  -> Creates N Leave rows with status="pending" linked by a groupId UUID
  -> If success: { ok: true, groupId, days: N }
  -> If role conflict: { error: "Role occupied on: ...", status: 409 }
```

### Cancellation

- Users can cancel their own **pending** leave via `cancelLeaveSingle(id)` or `cancelLeaveGroup(groupId)` Server Actions
- Admins can cancel any pending leave via `cancelLeaveGroup(groupId)` in admin actions
- Cancellation performs a **soft-cancel**: sets `status: "cancelled"` (does NOT delete the row)
- The cancelled row remains in the database for audit purposes (who applied, who cancelled, when)
- The partial unique index only applies to `status = 'approved'`, so cancelling frees the slot for another same-role user to apply for that date

---

## 12. Styling and Design System

### Global Styles (src/app/globals.css)

Built on Tailwind CSS v4 with custom component classes:

**CSS Variables:**

- `--background: #F4F5F3` (off-white)
- `--foreground: #111318` (ink)
- `--primary: #15803D` (green-700)
- `--surface: #FFFFFF` (white cards)
- `--border: #D9DBD6` (light gray border)
- `--scan-accent: #B8941F` (amber for camera UI)

**Custom Component Classes:**

| Class | Description |
|-------|-------------|
| `.btn-primary` | Solid green button with subtle shadow, hover scaling |
| `.card` | Clean white surface: rounded corners, soft shadow, light border |
| `.form-input` | Light-themed form input with transition effects |
| `.form-label` | Form label styling |

### Design Theme

The app uses a light, clean theme optimized for clinical/professional environments:

- Background: Soft off-white (`#F4F5F3`)
- Cards: Solid white (`#FFFFFF`) to pop against the background
- Accents: Green (`#15803D`) for primary actions (punching, submitting)
- Camera UI: Amber-tinted overlays (`#B8941F`) and targeting reticles
- Navigation: Floating pill-shaped bottom nav for mobile ergonomics
- Components: `StatCard` and `StatusChip` use minimalist "punch stamp" styling rather than heavy gradients

---

## 13. Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (with pgbouncer) | Required |
| `DIRECT_URL` | Direct PostgreSQL connection (for migrations) | Required |
| `JWT_SECRET` | Secret key for JWT signing. **Required.** In production, the app throws at startup if missing or set to the placeholder value. | `CHANGE_ME_IN_PRODUCTION_PLEASE` (dev only) |
| `FACE_MATCH_THRESHOLD` | Cosine similarity cutoff for face matching | `0.75` |
| `PHOTO_RETENTION_DAYS` | Days before photos are purged from the database | `30` |
| `CRON_SECRET` | Shared secret for authenticating external scheduler calls to the `purgePhotosAdmin` action. In production, a warning is logged at startup if not set. | None (optional) |

---

## 14. Data Flow Diagrams

### End-to-End Login Flow

```
Browser (Client)                 Server Action (loginUser)       Database
  |                               |                               |
  [User submits form]             |                               |
  |-- loginUser({ u, p }) ------->|                               |
  |                               |-- findUnique(username) ------>|
  |                               |<-- User record ---------------|
  |                               |-- verifyPassword(hash)        |
  |                               |-- check lockout               |
  |                               |-- signToken({userId,isOwner}) |
  |                               |-- cookies().set(auth_token)   |
  |<-- { ok: true } -------------|                               |
  [router.push('/dashboard')]     |                               |
```

### End-to-End Punch-In Flow

```
Browser (Client)                 Server Action                   Database
  |                               |                               |
  [Camera starts, human.js loads] |                               |
  |-- getTodayAttendance() ------>|                               |
  |                               |-- findUnique(userId+date) --->|
  |<-- { record: null } ---------|                               |
  |                               |                               |
  [15 stable face frames]         |                               |
  [Photo + embedding captured]    |                               |
  |-- recordAttendance({...}) --->|                               |
  |                               |-- findUnique(userId) -------->|
  |                               |<-- user.faceEmbedding --------|
  |                               |-- cosineSimilarity(...)       |
  |                               |-- if confidence >= 0.75:      |
  |                               |   create(Attendance) -------->|
  |                               |   revalidatePath('/dashboard')|
  |<-- { ok: true, confidence } -|                               |
```

### End-to-End Leave Application Flow

```
Browser (Client)                 Server Action                   Database
  |                               |                               |
  [User selects date range]       |                               |
  |-- checkLeaveConflicts({}) --->|                               |
  |                               |-- findMany(jobRole+dates) --->|
  |<-- { available: true } ------|                               |
  |                               |                               |
  [User submits form]             |                               |
  |-- applyForLeave({...}) ------>|                               |
  |                               |-- findUnique(userId) -------->|
  |                               |-- check own conflicts ------->|
  |                               |-- createMany(Leave rows) ---->|
  |<-- { ok: true, days: N } ----|                               |
```

### Authentication Chain

```
Request -> proxy.ts (check cookie)
  -> No cookie? -> Redirect to /login
  -> Has cookie? -> Page/Layout renders
    -> Server Action called
      -> getSessionUser()
        -> Read cookie -> verifyToken(jose.jwtVerify)
          -> Return SessionPayload { userId, isOwner }
      -> If null -> return { error, status: 401/403 }
      -> If valid -> execute business logic
```

---

## 15. File Inventory

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts |
| `next.config.ts` | Next.js config (serverExternalPackages for human.js) |
| `tailwind.config.ts` | Tailwind CSS configuration |
| `postcss.config.js` | PostCSS plugins |
| `tsconfig.json` | TypeScript config (strict mode, path aliases) |
| `.env.example` | Environment variable documentation |
| `prisma/schema.prisma` | Database schema (3 models) |

### Page Files

| File | Purpose |
|------|---------|
| `src/proxy.ts` | Route protection middleware |
| `src/app/layout.tsx` | Root HTML shell |
| `src/app/page.tsx` | Root redirect to /login |
| `src/app/globals.css` | Global styles |
| `src/app/(app)/layout.tsx` | App layout — fetches user, renders Navigation |
| `src/app/(auth)/login/page.tsx` | Login form (client) |
| `src/app/(app)/dashboard/page.tsx` | Dashboard (server component) |
| `src/app/(app)/attendance/page.tsx` | Thin shell → AttendanceCamera |
| `src/app/(app)/leave/page.tsx` | Leave management (client) |
| `src/app/(app)/enroll/page.tsx` | Thin shell → EnrollmentCamera |
| `src/app/(app)/admin/users/page.tsx` | Staff management (client) |
| `src/app/(app)/admin/attendance/page.tsx` | Attendance review (client) |
| `src/app/(app)/admin/leaves/page.tsx` | Leave overview (client) |

### Component Files

| File | Purpose |
|------|---------|
| `src/components/layout/Navigation.tsx` | Sidebar + mobile bottom nav |
| `src/components/ui/StatCard.tsx` | Stat number display card |
| `src/components/ui/StatusChip.tsx` | Coloured status badge |
| `src/features/attendance/components/AttendanceCamera.tsx` | Camera UI for check-in/out |
| `src/features/enrollment/components/EnrollmentCamera.tsx` | Camera UI for face enrollment |

### Server Action Files

| File | Functions |
|------|-----------|
| `src/features/auth/actions.ts` | `loginUser`, `logoutUser`, `getMe` |
| `src/features/attendance/actions.ts` | `recordAttendance`, `checkoutAttendance`, `getTodayAttendance` |
| `src/features/enrollment/actions.ts` | `enrollUserFace` |
| `src/features/leave/actions.ts` | `applyForLeave`, `getUserLeaves`, `checkLeaveConflicts`, `cancelLeaveSingle`, `cancelLeaveGroup` |
| `src/features/admin/actions.ts` | `getAdminAttendance`, `getAdminLeaves`, `approveLeave`, `approveLeaveGroup`, `purgePhotosAdmin`, `getUsers`, `createUser`, `deactivateUser` |

### Library Files

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | JWT sign/verify, bcrypt, session helpers, startup guards |
| `src/lib/prisma.ts` | Singleton Prisma client |
| `src/lib/cosine.ts` | Cosine similarity for face matching |
| `src/lib/cache.ts` | Client-side in-memory fetch deduplication |
| `src/lib/ear.ts` | Eye Aspect Ratio utility — computes blink pattern from face mesh points, used by AttendanceCamera for liveness verification |

### Total

- **~2,800 lines of code** (excluding config and node_modules)
- **8 pages**, **5 components**, **5 library files**, **5 Server Action files**, **1 middleware**
- **1 API route file** (`/api/admin/purge-photos` — cron-secret authenticated), remaining data operations use Next.js Server Actions
