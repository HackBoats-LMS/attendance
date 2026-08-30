import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "AttendanceIQ | Staff Attendance & Leave Management",
  description: "Face-recognition attendance and leave management system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${plusJakarta.variable} min-h-screen flex flex-col md:flex-row bg-bg text-ink antialiased`}>
        {children}
      </body>
    </html>
  );
}
