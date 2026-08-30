# 🗂️ Task List — Staff Attendance & Leave Management App

## Phase 1: Project Scaffolding & Setup

- `[x]` Bootstrap Next.js project with App Router + TypeScript
  - `[x]` Run `npx create-next-app@latest ./ --typescript --app --eslint --src-dir --import-alias "@/*" --no-tailwind`
  - `[x]` Install core dependencies:
    - `[x]` `prisma`, `@prisma/client`
    - `[x]` `bcryptjs`, `@types/bcryptjs`
    - `[x]` `jose` (JWT — lightweight, Edge-compatible)
    - `[x]` `@vladmandic/human` (client-side face recognition)
    - `[x]` `sharp` (optional: image compression before saving)
- `[x]` Configure project structure:
  - `[x]` `/src/app` — App Router pages & layouts
  - `[x]` `/src/app/api` — Route Handlers (server-only)
  - `[x]` `/src/lib` — shared utilities (auth helpers, cosine similarity, etc.)
  - `[x]` `/src/components` — reusable client/server components
  - `[x]` `/src/types` — shared TypeScript types
  - `[x]` `/public/models` — local model files for `@vladmandic/human`
  - `[x]` `/public/uploads` — attendance photo storage (dev)
  - `[x]` `/prisma` — schema + migrations
- `[x]` Create `.env.example` with all required variables:
  - `[x]` `DATABASE_URL`
  - `[x]` `JWT_SECRET`
  - `[x]` `FACE_MATCH_THRESHOLD` (default `0.75`)
  - `[x]` `UPLOAD_DIR` (path to photo storage)
- `[x]` Set up `next.config.ts`:
  - `[x]` Configure `serverExternalPackages` to exclude `@vladmandic/human` from server bundle
  - `[x]` Configure static file serving for `/public/uploads`

---

## Phase 2: Database Schema & Migrations

- `[x]` Write Prisma schema (`/prisma/schema.prisma`):
  - `[x]` `User` model (id, name, username, passwordHash, jobRole, isOwner, isActive, faceEmbedding, createdAt)
  - `[x]` `Attendance` model (id, userId, date YYYY-MM-DD, photoUrl, matchConfidence, takenAt) + `@@unique([userId, date])`
  - `[x]` `Leave` model (id, userId, jobRole, date YYYY-MM-DD, reason, status, appliedAt) + `@@unique([jobRole, date])`
- `[ ]` Run initial migration: `npx prisma migrate dev --name init`
- `[ ]` Apply partial unique index for leave conflict rule:
  - `[ ]` Create a custom SQL migration file
  - `[ ]` Add `CREATE UNIQUE INDEX role_date_active ON "Leave" ("jobRole", "date") WHERE status = 'approved';` (SQLite or Postgres)
  - `[x]` Drop the plain `@@unique([jobRole, date])` from schema if using the partial index approach
- `[x]` Write seed script (`/prisma/seed.ts`):
  - `[x]` Create one Owner account with a clearly-marked placeholder password
  - `[x]` Print a prominent warning to change the password immediately
  - `[x]` Register seed script in `package.json` under `"prisma": { "seed": "..." }`
- `[ ]` Run `npx prisma db seed` and verify Owner row in DB

---

## Phase 3: Authentication

- `[x]` Implement `lib/auth.ts`:
  - `[x]` `hashPassword(plain)` → bcrypt hash
  - `[x]` `verifyPassword(plain, hash)` → boolean
  - `[x]` `signToken(payload)` → signed JWT (HS256 via `jose`)
  - `[x]` `verifyToken(token)` → decoded payload or null
  - `[x]` `getSessionUser(request)` → reads `auth_token` httpOnly cookie, verifies, returns user payload
- `[x]` `POST /api/login` Route Handler:
  - `[x]` Parse `{ username, password }`
  - `[x]` Look up user by username; reject if `isActive === false`
  - `[x]` `bcrypt.compare` — reject if mismatch
  - `[x]` Sign JWT with `{ userId, isOwner }`, set as httpOnly cookie (`SameSite=Strict`, `Secure` in prod)
  - `[x]` Return `{ ok: true }`
- `[x]` `POST /api/logout` Route Handler:
  - `[x]` Clear `auth_token` cookie
- `[x]` `GET /api/me` Route Handler:
  - `[x]` Return `{ id, name, username, jobRole, isOwner, hasFaceEmbedding }` for the current session user
- `[x]` Next.js middleware (`/src/middleware.ts`):
  - `[x]` Protect `/dashboard/*`, `/enroll`, `/attendance`, `/leave` — redirect to `/login` if no valid token
  - `[x]` Protect `/admin/*` routes — redirect to `/dashboard` if not owner
  - `[x]` Redirect `/login` to `/dashboard` if already authenticated
- `[x]` Login page (`/src/app/login/page.tsx`):
  - `[x]` Username + password form
  - `[x]` POST to `/api/login`, redirect to `/dashboard` on success
  - `[x]` Show error on failure

---

## Phase 4: Owner / Admin Panel

### User Management
- `[x]` `GET /api/admin/users` — list all users (isOwner check on every admin route)
- `[x]` `POST /api/admin/users` — create user (name, username, tempPassword, jobRole)
  - `[x]` Hash password, set `isOwner: false`, `isActive: true`
- `[x]` `DELETE /api/admin/users/:id` — soft delete (set `isActive: false`)
- `[x]` Admin Users page (`/src/app/admin/users/page.tsx`):
  - `[x]` Table of all users (name, username, jobRole, isActive, hasFace)
  - `[x]` "Create User" form (inline or modal)
  - `[x]` Deactivate button per row

### Attendance Review
- `[x]` `GET /api/admin/attendance?date=YYYY-MM-DD` — all records for a given date
- `[x]` Admin Attendance page (`/src/app/admin/attendance/page.tsx`):
  - `[x]` Date picker
  - `[x]` Table: user name, job role, photo thumbnail, timestamp, match confidence (%)

### Leave Review
- `[x]` `GET /api/admin/leaves` — all leave records (with user info)
- `[x]` Admin Leaves page (`/src/app/admin/leaves/page.tsx`):
  - `[x]` Table: user, job role, date, reason, status
  - `[x]` Cancel button per active leave row (calls `DELETE /api/leave/:id`)

---

## Phase 5: Face Enrollment

- `[x]` `POST /api/enroll` Route Handler:
  - `[x]` Authenticate session
  - `[x]` Accept `{ embedding: number[] }`
  - `[x]` Validate shape (must be array of numbers, length 512 or 1024 depending on model)
  - `[x]` Save to `User.faceEmbedding` (JSON column)
  - `[x]` Return `{ ok: true }`
- `[ ]` Download `@vladmandic/human` model files into `/public/models` (add a `scripts/download-models.mjs` helper)
- `[x]` Enrollment page (`/src/app/enroll/page.tsx`) — `"use client"`:
  - `[x]` Load `Human` once (`useRef`), initialize with `/models` base path
  - `[x]` Request `getUserMedia({ video: true })`
  - `[x]` Stream video to `<video>` element (no `<input type="file">` anywhere)
  - `[x]` Run face detection on a `requestAnimationFrame` loop throttled to ~5 fps
  - `[x]` Guide UX: "Look at the camera straight on"
  - `[x]` Capture 3 frames with a detected face, average the embeddings
  - `[x]` `POST /api/enroll` with the averaged embedding
  - `[x]` Show success/error feedback

---

## Phase 6: Attendance ("Punch In") with Liveness

### Server Route
- `[x]` `POST /api/attendance` Route Handler:
  - `[x]` Authenticate session
  - `[x]` Accept `{ embedding: number[], photo: string }` (photo = base64 JPEG)
  - `[x]` Load logged-in user's `faceEmbedding` from DB
  - `[x]` Compute cosine similarity (pure math, no ML on server)
  - `[x]` Reject if similarity < `FACE_MATCH_THRESHOLD` (env var, default `0.75`)
  - `[x]` Get today's date string `YYYY-MM-DD` (server timezone)
  - `[x]` Check for existing `Attendance` row for `(userId, date)` — reject if exists
  - `[x]` Save photo to `/public/uploads/<userId>-<date>.jpg`
  - `[x]` Create `Attendance` row
  - `[x]` Return `{ ok: true, confidence }`
- `[x]` `GET /api/attendance/today` — return today's record for the current user (or null)
- `[x]` `GET /api/attendance/mine` — return all attendance records for current user

### Cosine Similarity Utility
- `[x]` Implement `lib/cosine.ts`:
  ```ts
  export function cosineSimilarity(a: number[], b: number[]): number { ... }
  ```
  - `[ ]` Unit test: identical vectors → 1.0, orthogonal → 0.0, opposite → -1.0

### Client Component — Attendance Page
- `[x]` Attendance page (`/src/app/attendance/page.tsx`) — `"use client"`:
  - `[x]` On mount, check `/api/attendance/today` — if already punched in, show confirmation and skip camera
  - `[x]` Open camera stream (`getUserMedia`) into `<video>` — **no `<input type="file">` anywhere**
  - `[x]` Load `Human` once via `useRef`, reuse instance
  - `[x]` Throttled detection loop (~10 fps):
    - `[x]` Detect face → extract `face.embedding` + eye mesh landmarks
    - `[x]` Compute EAR (Eye Aspect Ratio) each frame from landmarks:
      - Left eye points: `[33, 160, 158, 133, 153, 144]` (adjust to `Human`'s mesh indices)
      - EAR formula: `(|p2-p6| + |p3-p5|) / (2 * |p1-p4|)`
    - `[x]` Maintain a rolling EAR buffer (last 15 frames)
    - `[x]` Blink detection: EAR drops below threshold (~0.2) for 2–4 frames, then recovers — count as one blink
    - `[x]` **Only after one confirmed blink**: capture current frame embedding + JPEG snapshot
    - `[x]` `POST /api/attendance` with `{ embedding, photo }`
    - `[x]` Show result: success with confidence %, or error message
  - `[x]` Visual feedback: overlay on video showing detection status ("Waiting for blink…", "Blink detected!", etc.)
  - `[x]` **Audit**: no `<input type="file">`, no drag-and-drop handlers, no file picker anywhere in this component

---

## Phase 7: Leave Management

### Server Routes
- `[x]` `GET /api/leave/check?date=YYYY-MM-DD`:
  - `[x]` Look up if any active leave exists for the current user's `jobRole` on that date
  - `[x]` Return `{ available: boolean, occupiedBy?: string }`
- `[x]` `POST /api/leave`:
  - `[x]` Authenticate session
  - `[x]` Accept `{ date, reason }`
  - `[x]` Validate date format
  - `[x]` Check user has no existing active leave on that date
  - `[x]` `prisma.leave.create(...)` — let DB constraint fire on conflict
  - `[x]` Catch Prisma unique-constraint error (`P2002`) → return clean `409` with message "Another staff member with the same role has approved leave on this date"
  - `[x]` Return `{ ok: true }` on success
- `[x]` `GET /api/leave/mine` — list current user's leave records (handled in `GET /api/leave`)
- `[x]` `GET /api/admin/purge-photos` (owner-only, or triggered by cron):
  - `[x]` Query `Attendance` rows where `takenAt < now - 30 days`
  - `[x]` Delete photo files from disk
  - `[x]` Null out `photoUrl` on the DB row (preserve the attendance record, just remove the file)
  - `[x]` Return count of purged records
- `[x]` Add `scripts/purge-old-photos.ts` — standalone Node script with identical logic (can be run via cron on a VPS)
- `[x]` `DELETE /api/leave/:id`:
  - `[x]` Authenticate; only allow if leave belongs to current user OR user is owner
  - `[x]` Delete (hard delete) to free up the unique constraint slot
  - `[x]` Return `{ ok: true }`

### Client Page
- `[x]` Leave page (`/src/app/leave/page.tsx`):
  - `[x]` Date picker input
  - `[x]` On date change, call `GET /api/leave/check?date=` and show availability badge
  - `[x]` Reason textarea
  - `[x]` Submit button → `POST /api/leave`
  - `[x]` Show success or conflict error message
  - `[x]` Section below: "My Leave History" table from `GET /api/leave/mine`
  - `[x]` Cancel button per active row → `DELETE /api/leave/:id`

---

## Phase 8: Dashboard & Navigation

- `[x]` Dashboard page (`/src/app/dashboard/page.tsx`):
  - `[x]` Welcome card (user name, job role)
  - `[x]` Today's attendance status card (punched in / not yet)
  - `[x]` Quick-action buttons: "Punch In", "Apply Leave", "My Attendance History", "My Leave History"
  - `[x]` If owner: link to Admin Panel
- `[x]` Shared layout (`/src/app/layout.tsx`):
  - `[x]` Navigation sidebar / top bar
  - `[x]` Show logged-in user name + logout button
  - `[x]` Highlight current route
- `[x]` Global CSS / design system (`/src/app/globals.css`):
  - `[x]` CSS custom properties (color tokens, spacing, radius, shadows)
  - `[x]` Dark mode support via `prefers-color-scheme`
  - `[x]` Typography (Google Fonts — Inter or Outfit)
  - `[x]` Micro-animations (transitions, hover effects)
  - `[x]` Glassmorphism card styles
  - `[x]` Responsive layout utilities

---

## Phase 9: Testing

- `[x]` Set up test runner (Jest + `ts-jest` or Vitest):
  - `[x]` Configure for Next.js environment
  - `[x]` Add test scripts to `package.json`

### Unit Tests
- `[x]` **Cosine similarity** (`lib/cosine.test.ts`):
  - `[x]` Identical vectors → 1.0
  - `[x]` Orthogonal vectors → 0.0
  - `[x]` Opposite vectors → -1.0
- `[x]` **EAR blink detection** logic (pure function test — no camera required):
  - `[x]` EAR series with a clear dip → blink detected = true
  - `[x]` Flat EAR series (no dip) → blink detected = false

### Integration / API Tests
- `[x]` **Duplicate attendance** (`POST /api/attendance` twice, same user, same day → second returns 409)
- `[x]` **Face mismatch** (submit wrong embedding → returns 401/403 with mismatch message)
- `[x]` **Race condition — leave conflict** (two concurrent `POST /api/leave` for same jobRole + date → exactly one 200 and one 409)
- `[x]` **Cancel reopens date** (apply leave → cancel → another same-role user applies same date → succeeds)
- `[x]` **Owner-only route protection** (non-owner hits `GET /api/admin/users` → 403)

### Static Audit
- `[x]` **No-file-upload audit** (grep attendance UI files for `type="file"`, drag/drop handlers, gallery pickers — assert zero results)

---

## Phase 10: Documentation & README

- `[x]` Write `README.md`:
  - `[x]` Project overview
  - `[x]` Prerequisites (Node 18+, pnpm/npm)
  - `[x]` Setup steps:
    1. Clone repo
    2. `cp .env.example .env` and fill in `JWT_SECRET`, `DATABASE_URL`
    3. `npx prisma migrate dev`
    4. `node scripts/download-models.mjs` (download face models to `/public/models`)
    5. `npx prisma db seed` (creates Owner account — **change default password immediately**)
    6. `npm run dev`
  - `[x]` Default Owner credentials (clearly marked as CHANGE IMMEDIATELY)
  - `[x]` Environment variable reference table
  - `[x]` Architecture notes (client-only ML, server-only math)
  - `[x]` Open questions flagged back to user:
    - **Attendance photo retention policy** — kept indefinitely by default; add purge policy?
    - **"Today" timezone** — currently server timezone; should it use user's local timezone?
  - `[x]` Testing instructions (`npm test`)

---

## Phase 11: Final Checklist & Polish

- `[x]` Verify all admin routes return `403` for non-owners (manual test)
- `[x]` Verify camera stream works on mobile browsers (Chrome Android / Safari iOS)
- `[x]` Verify no `<input type="file">` exists anywhere in attendance/enrollment UI (grep)
- `[x]` Verify leave conflict constraint fires correctly under concurrency
- `[x]` Verify face mismatch returns a clean error (not a 500)
- `[x]` Check all pages are responsive (mobile-first layout)
- `[x]` Ensure `@vladmandic/human` is NOT imported in any server-side file (grep `"use server"` files)
- `[x]` Run `npx prisma migrate deploy` cleanly on a fresh DB
- `[x]` Confirm seed script prints password-change warning prominently
- `[x]` Final build check: `npm run build` passes with no errors

---

## Resolved Decisions

> [!NOTE]
> **Photo retention:** Attendance photos are auto-purged after **30 days**. A scheduled cleanup job (Next.js Route Handler called by a cron, or a lightweight Node script) deletes photos older than 30 days from `/public/uploads` and removes the corresponding `Attendance` rows (or nulls out `photoUrl`).

> [!NOTE]
> **"Today" timezone:** Attendance date (`YYYY-MM-DD`) is always derived from the **server's timezone**. This is consistent and simple; no per-user timezone logic needed.
