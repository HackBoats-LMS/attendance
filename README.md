# 🗂️ AttendanceIQ — Staff Attendance & Leave Management

An advanced face-recognition attendance and leave management system built with Next.js (App Router).

## 🚀 Features
- **Face Liveness Attendance**: Clock in via the browser. Enforces a real, live photo by requiring an eye blink, preventing spoofing via photos. 
- **Pure Client-Side ML**: Powered by `@vladmandic/human`. No server-side ML needed.
- **Leave Management**: Smart job-role conflict rules backed by database-level constraints. Only one person per job role can take leave on a given day to ensure continuous shift coverage.
- **Admin Dashboard**: Manage staff access, review daily punch-in snapshots and match confidence, and organization-wide leave oversight.

---

## 🛠️ Tech Stack
- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (Supabase) via Prisma ORM
- **Auth**: Custom JWT-based stateless sessions (`jose` + `bcryptjs`)
- **Face Recognition**: `@vladmandic/human`

---

## 📦 Prerequisites
- Node.js 18+
- npm, yarn, or pnpm

## 🔧 Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd attendance
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   ```
   Fill in `JWT_SECRET` with a secure random string (e.g. `openssl rand -base64 32`).

4. **Initialize Database:**
   Apply the database schema and custom migrations:
   ```bash
   npx prisma migrate dev
   ```

5. **Download AI Models:**
   Download the required models to the `/public/models` directory:
   ```bash
   node scripts/download-models.mjs
   ```

6. **Seed the Database:**
   Create the initial Owner (Admin) account.
   ```bash
   npx prisma db seed
   ```
   > **⚠️ CRITICAL**: The seed script will create an Owner account with a placeholder password. You **MUST** log in and change this password immediately in production.

7. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to access the application.

---

## 🧪 Testing

The project uses Jest for unit and integration testing. Run the suite using:
```bash
npm run test
```

## 📝 Open Questions / Configs
- **Photo Retention Policy**: The system automatically purges attendance photos older than 30 days to save disk space via the `GET /api/admin/purge-photos` API endpoint (which can be triggered via cron).
- **Timezones**: The system uses the **server timezone** to resolve the "current date" for attendance and leave requests. Ensure your deployment environment's timezone is configured to match your organization's operating region.
