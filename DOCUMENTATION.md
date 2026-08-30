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
9. [API Routes Reference](#9-api-routes-reference)
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
│   │   ├── (app)/
│   │   │   ├── layout.tsx             # App layout — adds Navigation sidebar
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx           # Dashboard home (client component)
│   │   │   ├── attendance/
│   │   │   │   └── page.tsx           # Face punch-in (client component)
│   │   │   ├── leave/
│   │   │   │   └── page.tsx           # Leave application + history (client component)
│   │   │   ├── enroll/
│   │   │   │   └── page.tsx           # Face enrollment — 3-embedding average (client component)
│   │   │   └── admin/
│   │   │       ├── users/
│   │   │       │   └── page.tsx       # Staff management (client component)
│   │   │       ├── attendance/
│   │   │       │   └── page.tsx       # Attendance review by date (client component)
│   │   │       └── leaves/
│   │   │           └── page.tsx       # All leaves overview (client component)
│   │   └── api/
│   │       ├── login/
│   │       │   └── route.ts           # POST: authenticate, set JWT cookie
│   │       ├── logout/
│   │       │   └── route.ts           # POST: clear auth cookie
│   │       ├── me/
│   │       │   └── route.ts           # GET: current user profile
│   │       ├── enroll/
│   │       │   └── route.ts           # POST: save face embedding
│   │       ├── attendance/
│   │       │   ├── route.ts           # POST: punch-in with face matching
│   │       │   └── today/
│   │       │       └── route.ts       # GET: today's attendance record
│   │       ├── leave/
│   │       │   ├── route.ts           # POST: apply leave + GET: my leaves
│   │       │   ├── check/
│   │       │   │   └── route.ts       # GET: check date availability by role
│   │       │   └── [id]/
│   │       │       └── route.ts       # DELETE: soft-cancel leave (status → "cancelled")
│   │       └── admin/
│   │           ├── users/
│   │           │   ├── route.ts       # GET: list all users + POST: create user
│   │           │   └── [id]/
│   │           │       └── route.ts   # DELETE: deactivate user (soft delete)
│   │           ├── attendance/
│   │           │   └── route.ts       # GET: attendance records by date
│   │           ├── leaves/
│   │           │   └── route.ts       # GET: all leaves across organization
│   │           └── purge-photos/
│   │               └── route.ts       # POST: delete old photos (dual auth: cookie OR cron secret)
│   ├── components/
│   │   └── Navigation.tsx             # Sidebar navigation (client component)
│   └── lib/
│       ├── auth.ts                    # JWT, bcrypt, session, HOF wrappers, startup guards
│       ├── prisma.ts                  # Singleton Prisma client
│       ├── cosine.ts                  # Cosine similarity for face matching
│       └── ear.ts                     # Eye Aspect Ratio for blink detection
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
| `createdAt` | DateTime | Auto-set on creation |
| `attendance` | Attendance[] | Relation |
| `leaves` | Leave[] | Relation |

### Attendance

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key |
| `userId` | String | FK to User |
| `date` | String | `YYYY-MM-DD` format |
| `photoUrl` | String? | Base64 string of attendance photo (nulled after 30-day purge) |
| `matchConfidence` | Float | Cosine similarity score (0 to 1) |
| `takenAt` | DateTime | Timestamp of punch-in |
| **Unique** | `[userId, date]` | One punch-in per user per day |

### Leave

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Primary key |
| `userId` | String | FK to User |
| `jobRole` | String | Denormalized from User at creation |
| `date` | String | `YYYY-MM-DD` |
| `reason` | String? | Optional reason |
| `status` | String | `"approved"` or `"cancelled"` (default: `"approved"`) |
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
2. POST /api/login looks up user, verifies password
3. JWT signed with { userId, isOwner } — 7-day expiry
4. Cookie set: auth_token=<token>; HttpOnly; SameSite=Strict; Path=/
5. Subsequent requests include cookie automatically
6. withAuth/withAdminAuth verify the JWT on each API call
7. POST /api/logout clears the cookie (Max-Age=0)
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
| `withAuth(handler)` | HOF: wraps route handler, returns 401 if unauthenticated |
| `withAdminAuth(handler)` | HOF: wraps route handler, returns 403 if not owner |

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
  ├── Is it a public path? (/login, /api/login, /api/logout)
  │   ├── YES, and user IS authenticated -> redirect to /dashboard
  │   ├── YES, and user is NOT authenticated -> proceed
  │   └── NO -> continue
  ├── Is user authenticated? (check auth_token cookie)
  │   ├── NO, and it's an API route -> return 401 JSON
  │   ├── NO, and it's a page -> redirect to /login
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
2. `POST /api/login` with `{ username, password }`
3. On success: `router.push("/dashboard")`
4. On failure: displays error message

**API calls:** `POST /api/login`

### 8.2 Dashboard (/dashboard)

**File:** `src/app/(app)/dashboard/page.tsx`
**Type:** Client component

**What it does:** Shows today's attendance status and quick actions.

**Flow:**

1. Fetches `GET /api/me` and `GET /api/attendance/today` in parallel
2. Displays welcome message with user name and job role
3. Shows **Today's Status**:
   - Checked in: green checkmark with time
   - Not checked in: "Punch In Now" button (or "Complete Face Enrollment" if no face enrolled)
4. Shows **Quick Actions** — links to Leave Requests and Admin Panel (if owner)
5. Sign Out button: `POST /api/logout` then redirect to `/login`

**API calls:** `GET /api/me`, `GET /api/attendance/today`, `POST /api/logout`

### 8.3 Attendance / Punch In (/attendance)

**File:** `src/app/(app)/attendance/page.tsx`
**Type:** Client component
**Complexity:** Most complex page in the app (~330 lines)

**What it does:** Live face-recognition punch-in.

**Status State Machine:**

```
idle -> loading-model -> camera-starting -> detecting -> submitting -> success | error | already-done
```

**Flow:**

1. Checks if already punched in today (`GET /api/attendance/today`)
2. Loads `@vladmandic/human` model dynamically
3. Starts webcam (front-facing, 640x480)
4. Detection loop (~10 FPS):
   - Runs face detection on each frame
   - Waits for 15 consecutive frames of stable face detection
5. On stable detection:
   - Captures photo (JPEG data URL from canvas)
   - Extracts face embedding (descriptor from human.js)
   - Sends `POST /api/attendance` with `{ embedding, photo }`
6. Server-side:
   - Computes cosine similarity between live and stored embedding
   - If confidence >= 0.75: saves attendance record (with base64 photo) to database
   - If confidence < 0.75: returns 403 (face mismatch — authenticated but verification failed)
   - If already punched in: returns 409

**Key constants:**

- `DETECTION_THROTTLE_MS = 100` — ~10 FPS detection rate

**API calls:** `GET /api/attendance/today`, `POST /api/attendance`

### 8.4 Leave Requests (/leave)

**File:** `src/app/(app)/leave/page.tsx`
**Type:** Client component

**What it does:** Apply for leave and view leave history.

**Flow:**

1. Fetches `GET /api/leave` to load leave history
2. When a date is selected, fetches `GET /api/leave/check?date=...` to check availability
3. Availability response:
   - `{ available: true }` — date is open
   - `{ available: false, occupiedBy: "Name" }` — another staff member with same role already has leave
4. On submit: `POST /api/leave` with `{ date, reason }`
5. Each leave has a "Cancel" button: `DELETE /api/leave/{id}` (soft-cancel — sets status to "cancelled", row preserved)
6. Cancelled leaves display a grey "Cancelled" badge; approved leaves show green "Approved" badge with a Cancel button

**API calls:** `GET /api/leave`, `GET /api/leave/check`, `POST /api/leave`, `DELETE /api/leave/{id}`

### 8.5 Face Enrollment (/enroll)

**File:** `src/app/(app)/enroll/page.tsx`
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
5. Sends `POST /api/enroll` with `{ embedding: averagedArray }`
6. On success: redirects to `/dashboard` after 2 seconds

**Key difference from attendance page:** Collects 3 embeddings and averages them for robustness. No blink detection needed (enrollment is a one-time deliberate action).

**API calls:** `POST /api/enroll`

### 8.6 Admin — Staff Management (/admin/users)

**File:** `src/app/(app)/admin/users/page.tsx`
**Type:** Client component

**What it does:** List, create, and deactivate staff members.

**Flow:**

1. Fetches `GET /api/admin/users`
2. Displays table: Name (with Owner badge), Username, Role, Face Profile, Status, Actions
3. "Add New Staff" opens modal form: `POST /api/admin/users` with `{ name, username, password, jobRole }`
4. "Deactivate": `DELETE /api/admin/users/{id}` (cannot deactivate yourself)

**API calls:** `GET /api/admin/users`, `POST /api/admin/users`, `DELETE /api/admin/users/{id}`

### 8.7 Admin — Attendance Review (/admin/attendance)

**File:** `src/app/(app)/admin/attendance/page.tsx`
**Type:** Client component

**What it does:** Review attendance records by date.

**Flow:**

1. Date picker defaults to today
2. Fetches `GET /api/admin/attendance?date=YYYY-MM-DD`
3. Displays table: Staff Member, Role, Punch Time, Match Confidence (color-coded), Snapshot

**API calls:** `GET /api/admin/attendance`

### 8.8 Admin — Leave Overview (/admin/leaves)

**File:** `src/app/(app)/admin/leaves/page.tsx`
**Type:** Client component

**What it does:** View and manage all leaves across the organization (both approved and cancelled).

**Flow:**

1. Fetches `GET /api/admin/leaves`
2. Displays table: Date, Staff Member, Role, Reason, Status (Approved/Cancelled), Actions
3. "Cancel Leave": `DELETE /api/leave/{id}` (soft-cancel — only shown for approved leaves)
4. Cancelled leaves display a grey "Cancelled" badge with no cancel button

**API calls:** `GET /api/admin/leaves`, `DELETE /api/leave/{id}`

---

## 9. API Routes Reference

### Public Routes

#### POST /api/login

Authenticates a user and sets the auth cookie.

| | |
|---|---|
| **Auth** | None |
| **Body** | `{ username: string, password: string }` |
| **Success** | `200 { ok: true }` + Set-Cookie header |
| **Errors** | `400` missing fields, `401` invalid credentials, `500` server error |

#### POST /api/logout

Clears the auth cookie.

| | |
|---|---|
| **Auth** | None |
| **Success** | `200 { ok: true }` + cookie cleared |

### User Routes (require withAuth)

#### GET /api/me

Returns the current user's profile.

| | |
|---|---|
| **Auth** | `withAuth` |
| **Success** | `200 { id, name, username, jobRole, isOwner, hasFaceEmbedding, createdAt }` |
| **Errors** | `401` unauthorized, `404` user not found |

Note: The actual face embedding is never exposed — only `hasFaceEmbedding: boolean`.

#### POST /api/enroll

Saves a face embedding for the current user.

| | |
|---|---|
| **Auth** | `withAuth` |
| **Body** | `{ embedding: number[] }` (at least 10 finite numbers) |
| **Success** | `200 { ok: true }` |
| **Errors** | `400` invalid embedding |

#### POST /api/attendance

Punch-in with face matching.

| | |
|---|---|
| **Auth** | `withAuth` |
| **Body** | `{ embedding: number[], photo: string }` (base64 JPEG) |
| **Success** | `200 { ok: true, confidence: number, attendanceId: string }` |
| **Errors** | `400` invalid input, `403` face mismatch (returns confidence), `409` already punched in, `422` face not enrolled |

#### GET /api/attendance/today

Dedicated endpoint for today's record.

| | |
|---|---|
| **Auth** | `withAuth` |
| **Success** | `200 { record: { id, date, photoUrl, matchConfidence, takenAt } \| null }` |

#### POST /api/leave

Apply for leave.

| | |
|---|---|
| **Auth** | `withAuth` |
| **Body** | `{ date: string (YYYY-MM-DD), reason?: string }` |
| **Success** | `200 { ok: true, leaveId: string }` |
| **Errors** | `400` invalid date, `404` user not found, `409` already have leave or role conflict |

The role conflict check works via a partial unique index at the database level. If another user with the same `jobRole` already has approved leave on that date, Prisma throws a P2002 error which is caught and returned as a user-friendly message.

#### GET /api/leave

Returns all leaves for the current user.

| | |
|---|---|
| **Auth** | `withAuth` |
| **Success** | `200 { leaves: Leave[] }` |

#### GET /api/leave/check

Check if a date is available for leave.

| | |
|---|---|
| **Auth** | `withAuth` |
| **Query** | `?date=YYYY-MM-DD` |
| **Success** | `200 { available: true }` or `{ available: false, occupiedBy: "Name" }` |

#### DELETE /api/leave/[id]

Cancel a leave record (soft-cancel: sets status to "cancelled", preserving audit trail).

| | |
|---|---|
| **Auth** | `withAuth` |
| **Authorization** | Must be the leave owner OR an admin |
| **Behavior** | Sets `status: "cancelled"` (does NOT delete the row) |
| **Success** | `200 { ok: true }` |
| **Errors** | `403` forbidden, `404` not found |

### Admin Routes (require withAdminAuth)

#### GET /api/admin/users

List all users.

| | |
|---|---|
| **Auth** | `withAdminAuth` |
| **Success** | `200 { users: Array<{ id, name, username, jobRole, isOwner, isActive, hasFaceEmbedding, createdAt }> }` |

#### POST /api/admin/users

Create a new staff member.

| | |
|---|---|
| **Auth** | `withAdminAuth` |
| **Body** | `{ name, username, password, jobRole }` (all required) |
| **Success** | `201 { ok: true, user: { id, name, username, jobRole, createdAt } }` |
| **Errors** | `400` missing fields, `409` username taken |

#### DELETE /api/admin/users/[id]

Deactivate a user (soft delete).

| | |
|---|---|
| **Auth** | `withAdminAuth` |
| **Authorization** | Cannot deactivate yourself |
| **Success** | `200 { ok: true }` |
| **Errors** | `400` self-deactivation, `404` not found |

#### GET /api/admin/attendance

Get attendance records by date.

| | |
|---|---|
| **Auth** | `withAdminAuth` |
| **Query** | `?date=YYYY-MM-DD` |
| **Success** | `200 { records: Array<Attendance & { user: {...} }> }` |

#### GET /api/admin/leaves

Get all leaves across the organization.

| | |
|---|---|
| **Auth** | `withAdminAuth` |
| **Success** | `200 { leaves: Array<Leave & { user: {...} }> }` |

#### POST /api/admin/purge-photos

Delete attendance photos older than the retention period.

| | |
|---|---|
| **Auth** | `withAdminAuth` (admin session cookie) OR `x-cron-secret` header matching `CRON_SECRET` env var |
| **Method** | `POST` (not GET — destructive action must not be GET) |
| **Cron Auth** | Send `x-cron-secret: <CRON_SECRET>` header (no cookie needed) |
| **Success** | `200 { ok: true, deleted: number, errors: number, cutoff: Date }` |

Supports two authentication paths: (1) admin session cookie for manual UI triggers, (2) shared secret header for automated cron/scheduler execution. Uses timing-safe comparison for the secret check. Not called by any UI page.

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
    -> POST /api/enroll -> save as JSON string in user.faceEmbedding
```

The 3-embedding average creates a more stable template that is robust to slight variations in angle, lighting, and expression.

### Punch-In Flow

```
Camera -> @vladmandic/human detect -> extract face descriptor (embedding)
    -> wait for 15 consecutive frames of face detection
    -> on stable detection: capture photo + embedding
    -> POST /api/attendance
    -> Server: cosineSimilarity(live, stored)
    -> if confidence >= 0.75 -> save attendance (base64 photo directly in DB)
    -> if confidence < 0.75 -> return 403 with confidence score
```

### Cosine Similarity (src/lib/cosine.ts)

Computes the cosine of the angle between two vectors:

```
similarity = (a . b) / (||a|| * ||b||)
```

Result ranges from -1 (opposite) to 1 (identical). The threshold is 0.75 by default (configurable via `FACE_MATCH_THRESHOLD` env var).

### Human.js Configuration

```typescript
{
  modelBasePath: "/models",
  face: {
    enabled: true,
    detector: { rotation: true, return: true },
    mesh: { enabled: false },           // Not needed since we removed blink detection
    description: { enabled: true },     // Face embedding extraction (NOT "descriptor")
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

1. **UI level:** The `/leave` page calls `GET /api/leave/check?date=...` when a date is selected. If another user with the same role already has leave on that date, the response shows `{ available: false, occupiedBy: "Name" }`.

2. **API level:** `POST /api/leave` catches Prisma error code P2002 (unique constraint violation) and returns a user-friendly message.

3. **Database level:** A partial unique index on the `Leave` table:
   ```sql
   CREATE UNIQUE INDEX idx_leave_role_date_approved
     ON Leave(jobRole, date)
     WHERE status = 'approved';
   ```
   This is the ultimate safety net — even if the API logic fails, the database rejects duplicate role leaves.

### Data Flow

```
User selects date -> GET /api/leave/check?date=2025-01-15
  -> Server looks up: any other user with same jobRole + approved leave on that date?
  -> If yes: { available: false, occupiedBy: "Dr. Smith" }
  -> If no: { available: true }

User submits -> POST /api/leave { date: "2025-01-15", reason: "..." }
  -> Server creates Leave record with status="approved" and user's jobRole
  -> If another user with same role already has approved leave:
     -> Prisma P2002 error -> caught -> 409 { error: "Another staff member..." }
  -> If success: 200 { ok: true, leaveId: "..." }
```

### Cancellation

- Users can cancel their own leave via `DELETE /api/leave/[id]`
- Admins can cancel any user's leave via the same endpoint
- Cancellation performs a **soft-cancel**: sets `status: "cancelled"` (does NOT delete the row)
- The cancelled row remains in the database for audit purposes (who applied, who cancelled, when)
- The partial unique index only applies to `status = 'approved'`, so cancelling frees the slot for another same-role user to apply for that date

---

## 12. Styling and Design System

### Global Styles (src/app/globals.css)

Built on Tailwind CSS v4 with custom component classes:

**CSS Variables:**

- `--background: #0f111a` (very dark blue-black)
- `--foreground: #f8fafc` (near-white)
- `--primary: #6366f1` (indigo-500)
- `--surface: #1e1e2e` (dark surface)
- `--border: #334155` (slate-700)

**Custom Component Classes:**

| Class | Description |
|-------|-------------|
| `.btn-primary` | Indigo button with glow shadow effect, hover states |
| `.glass-card` | Glassmorphism card: semi-transparent white background, backdrop blur, subtle border, rounded corners |
| `.form-input` | Dark-themed form input with focus ring |
| `.form-label` | Form label styling |

### Design Theme

The app uses a dark theme with glassmorphism effects:

- Background: Very dark blue-black (`#0f111a`)
- Cards: Semi-transparent with backdrop blur
- Accents: Indigo (`#6366f1`) for primary actions, cyan for secondary decorative elements
- Text: Light slate colors on dark backgrounds
- Decorative: Blurred gradient circles (indigo and cyan) in the background

---

## 13. Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (with pgbouncer) | Required |
| `DIRECT_URL` | Direct PostgreSQL connection (for migrations) | Required |
| `JWT_SECRET` | Secret key for JWT signing. **Required.** In production, the app throws at startup if missing or set to the placeholder value. | `CHANGE_ME_IN_PRODUCTION_PLEASE` (dev only) |
| `FACE_MATCH_THRESHOLD` | Cosine similarity cutoff for face matching | `0.75` |
| `UPLOAD_DIR` | Directory for attendance photos | `./public/uploads` |
| `PHOTO_RETENTION_DAYS` | Days before photos are purged | `30` |
| `CRON_SECRET` | Shared secret for authenticating external scheduler calls to admin maintenance endpoints (e.g. `purge-photos`). Sent via `x-cron-secret` header. In production, a warning is logged at startup if not set. | None (optional) |

---

## 14. Data Flow Diagrams

### End-to-End Login Flow

```
Browser                          Server                         Database
  |                               |                               |
  |-- POST /api/login ----------->|                               |
  |   { username, password }      |-- findUnique(username) ------>|
  |                               |<-- User record ---------------|
  |                               |-- verifyPassword(hash)        |
  |                               |-- signToken({userId,isOwner}) |
  |<-- 200 { ok: true } ---------|                               |
  |    Set-Cookie: auth_token=... |                               |
```

### End-to-End Punch-In Flow

```
Browser (Client)                 Server                         Database
  |                               |                               |
  |-- GET /api/attendance/today ->|                               |
  |                               |-- findUnique(userId+date) --->|
  |<-- 200 { record: null } -----|                               |
  |                               |                               |
  [Camera starts, human.js loads] |                               |
  [Stable face detected]          |                               |
  [Photo captured, embedding]     |                               |
  |                               |                               |
  |-- POST /api/attendance ------>|                               |
  |   { embedding, photo }        |-- findUnique(userId) -------->|
  |                               |<-- user.faceEmbedding --------|
  |                               |-- cosineSimilarity(...)       |
  |                               |-- if confidence >= 0.75:      |
  |                               |   create(Attendance) -------->|
  |<-- 200 { ok: true, conf } ---|                               |
```

### End-to-End Leave Application Flow

```
Browser                          Server                         Database
  |                               |                               |
  [User selects date]             |                               |
  |-- GET /api/leave/check ------>|                               |
  |   ?date=2025-01-15            |-- findFirst(jobRole+date) --->|
  |<-- 200 { available: true } --|                               |
  |                               |                               |
  [User submits form]             |                               |
  |-- POST /api/leave ----------->|                               |
  |   { date, reason }            |-- findUnique(userId) -------->|
  |                               |-- findFirst(own leave) ------>|
  |                               |-- create(Leave) ------------->|
  |                               |   (P2002 = role conflict)     |
  |<-- 200 { ok: true } ---------|                               |
```

### Authentication Chain

```
Request -> proxy.ts (check cookie)
  -> No cookie? -> Redirect to /login (or 401 for API)
  -> Has cookie? -> Route handler
    -> withAuth / withAdminAuth
      -> getSessionUser()
        -> Read cookie -> verifyToken(jose.jwtVerify)
          -> Return SessionPayload { userId, isOwner }
      -> If null -> 401/403
      -> If valid -> Execute handler(request, session)
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

### Source Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/proxy.ts` | 40 | Route protection middleware |
| `src/app/layout.tsx` | 26 | Root HTML shell |
| `src/app/page.tsx` | 5 | Root redirect to /login |
| `src/app/globals.css` | 39 | Global styles |
| `src/app/(app)/layout.tsx` | 12 | App layout with sidebar |
| `src/app/(auth)/login/page.tsx` | 123 | Login form |
| `src/app/(app)/dashboard/page.tsx` | 135 | Dashboard |
| `src/app/(app)/attendance/page.tsx` | 331 | Face punch-in |
| `src/app/(app)/leave/page.tsx` | 225 | Leave management |
| `src/app/(app)/enroll/page.tsx` | 252 | Face enrollment |
| `src/app/(app)/admin/users/page.tsx` | 196 | Staff management |
| `src/app/(app)/admin/attendance/page.tsx` | 107 | Attendance review |
| `src/app/(app)/admin/leaves/page.tsx` | 109 | Leave overview |
| `src/components/Navigation.tsx` | 79 | Sidebar navigation |
| `src/lib/auth.ts` | 113 | Auth system |
| `src/lib/prisma.ts` | 13 | Database client |
| `src/lib/cosine.ts` | 23 | Face similarity |
| `src/lib/ear.ts` | 14 | Blink detection |

### API Route Files

| File | Methods | Auth |
|------|---------|------|
| `api/login/route.ts` | POST | None |
| `api/logout/route.ts` | POST | None |
| `api/me/route.ts` | GET | withAuth |
| `api/enroll/route.ts` | POST | withAuth |
| `api/attendance/route.ts` | POST | withAuth |
| `api/attendance/today/route.ts` | GET | withAuth |
| `api/leave/route.ts` | POST, GET | withAuth |
| `api/leave/check/route.ts` | GET | withAuth |
| `api/leave/[id]/route.ts` | DELETE | withAuth |
| `api/admin/users/route.ts` | GET, POST | withAdminAuth |
| `api/admin/users/[id]/route.ts` | DELETE | withAdminAuth |
| `api/admin/attendance/route.ts` | GET | withAdminAuth |
| `api/admin/leaves/route.ts` | GET | withAdminAuth |
| `api/admin/purge-photos/route.ts` | POST | withAdminAuth OR x-cron-secret |

### Total

- **40 source files**
- **~2,800 lines of code** (excluding config and node_modules)
- **8 pages**, **1 component**, **4 library files**, **14 API routes**, **1 middleware**
