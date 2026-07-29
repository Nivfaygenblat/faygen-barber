"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "לוח ראשי", key: "dashboard" },
  { href: "/admin/calendar", label: "פתיחת יומן", key: "calendar" },
  { href: "/admin/appointments", label: "תורים", key: "appointments" },
  { href: "/admin/customers", label: "לקוחות", key: "customers" },
  { href: "/admin/services", label: "שירותים", key: "services" },
  { href: "/admin/gallery", label: "גלריה", key: "gallery" },
  { href: "/admin/content", label: "תוכן האתר", key: "content" },
  { href: "/admin/users", label: "מנהלים ומשתמשים", key: "users" },
  { href: "/admin/activity", label: "יומן פעילות", key: "activity" },
  { href: "/admin/settings", label: "הגדרות העסק", key: "settings" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin") {
      return pathname === "/admin";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="admin-shell" dir="rtl">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2>FAYGEN BARBER</h2>
          <p>מערכת ניהול</p>
        </div>

        <nav className="admin-nav" aria-label="ניווט אזור הניהול">
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`admin-nav-link ${
                isActive(item.href) ? "active" : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}