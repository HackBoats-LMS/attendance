"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  HomeIcon,
  CameraIcon,
  CalendarIcon,
  UserCircleIcon,
  UsersIcon,
  ClipboardDocumentCheckIcon,
  CalendarDaysIcon,
  ArrowRightStartOnRectangleIcon,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeIconSolid,
  CameraIcon as CameraIconSolid,
  CalendarIcon as CalendarIconSolid,
  UserCircleIcon as UserCircleIconSolid,
  UsersIcon as UsersIconSolid,
  ClipboardDocumentCheckIcon as ClipboardDocumentCheckIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
} from "@heroicons/react/24/solid";
import { logoutUser } from "@/features/auth/actions";

const staffItems = [
  { href: "/dashboard", label: "Home", icon: HomeIcon, iconSolid: HomeIconSolid },
  { href: "/attendance", label: "Check In", icon: CameraIcon, iconSolid: CameraIconSolid },
  { href: "/leave", label: "Leave", icon: CalendarIcon, iconSolid: CalendarIconSolid },
  { href: "/enroll", label: "Profile", icon: UserCircleIcon, iconSolid: UserCircleIconSolid },
];

const adminItems = [
  { href: "/dashboard", label: "Home", icon: HomeIcon, iconSolid: HomeIconSolid },
  { href: "/admin/users", label: "Staff", icon: UsersIcon, iconSolid: UsersIconSolid },
  { href: "/admin/attendance", label: "Review", icon: ClipboardDocumentCheckIcon, iconSolid: ClipboardDocumentCheckIconSolid },
  { href: "/admin/leaves", label: "Leaves", icon: CalendarDaysIcon, iconSolid: CalendarDaysIconSolid },
];

export default function Navigation({ initialUser }: { initialUser: { name: string; jobRole: string; isOwner: boolean; hasFaceEmbedding?: boolean } }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = initialUser;
  const [loggingOut, setLoggingOut] = useState(false);

  const items = user?.isOwner
    ? adminItems
    : staffItems.filter(item => {
        if (item.href === "/enroll" && user?.hasFaceEmbedding) return false;
        if (item.href === "/attendance" && !user?.hasFaceEmbedding) return false;
        return true;
      });

  const handleLogout = async () => {
    setLoggingOut(true);
    await logoutUser();
    router.push("/login");
  };

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex w-64 bg-surface flex-shrink-0 flex-col z-20 border-r border-surface-border">
        <div className="p-6 border-b border-surface-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="font-bold text-lg text-ink tracking-tight">AttendanceIQ</span>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-1">
          <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider px-3 mb-2">
            {user?.isOwner ? "Admin" : "Menu"}
          </div>
          {items.map((item) => (
            <SidebarItem key={item.href} {...item} current={pathname} />
          ))}
        </div>

        {user && (
          <div className="p-4 border-t border-surface-border">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-bg mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink truncate">{user.name}</div>
                <div className="text-xs text-ink-muted truncate">{user.jobRole}</div>
              </div>
            </div>
            <button
              id="btn-logout-desktop"
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium text-ink-muted hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <ArrowRightStartOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
              {loggingOut ? "Signing out…" : "Sign Out"}
            </button>
          </div>
        )}
      </nav>

      {/* Mobile floating pill nav */}
      <nav
        className="md:hidden fixed bottom-4 left-4 right-4 bg-surface rounded-full z-30 px-2 py-2"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center justify-around">
          {items.map((item) => (
            <BottomNavItem key={item.href} {...item} current={pathname} />
          ))}
          {/* Logout button in mobile nav */}
          <button
            id="btn-logout-mobile"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex flex-col items-center justify-center gap-0.5 w-16 py-1 disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-ink-muted hover:text-red-600 hover:bg-red-50 transition-colors">
              <ArrowRightStartOnRectangleIcon className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium text-ink-muted">Sign Out</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function SidebarItem({ href, label, icon: Icon, iconSolid: IconSolid, current }: {
  href: string; label: string; icon: React.ElementType; iconSolid: React.ElementType; current: string;
}) {
  const active = current === href || (href !== "/dashboard" && current.startsWith(href));
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : "text-ink-muted hover:text-ink hover:bg-bg"
      }`}
    >
      {active ? <IconSolid className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
      {label}
    </Link>
  );
}

function BottomNavItem({ href, label, icon: Icon, iconSolid: IconSolid, current }: {
  href: string; label: string; icon: React.ElementType; iconSolid: React.ElementType; current: string;
}) {
  const active = current === href || (href !== "/dashboard" && current.startsWith(href));
  return (
    <Link href={href} className="flex flex-col items-center justify-center gap-0.5 w-16 py-1">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
        active ? "bg-primary text-white" : "text-ink-muted"
      }`}>
        {active ? <IconSolid className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
      </div>
      <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-ink-muted"}`}>{label}</span>
    </Link>
  );
}
