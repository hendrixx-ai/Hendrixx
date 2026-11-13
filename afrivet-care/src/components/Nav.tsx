"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const ITEMS = [
  { href: "/", label: "Home", icon: icon("M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10") },
  { href: "/pets", label: "Pets", icon: icon("M12 21c-4 0-7-1.5-7-4.5 0-2.5 3-5.5 7-5.5s7 3 7 5.5c0 3-3 4.5-7 4.5ZM5 9.5a1.6 2 0 1 0 .01 0M9.5 5.5a1.6 2 0 1 0 .01 0M14.5 5.5a1.6 2 0 1 0 .01 0M19 9.5a1.6 2 0 1 0 .01 0") },
  { href: "/records", label: "Records", icon: icon("M7 3.5h7l4 4V20.5H7zM14 3.5v4h4M10 12h5M10 16h5") },
  { href: "/treatments", label: "Vaccines", icon: icon("m14.5 4 5.5 5.5M17 6.5 8 15.5l-3.5 1 1-3.5 9-9M11 9l4 4M4.5 19.5 6 18") },
  { href: "/appointments", label: "Visits", icon: icon("M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4") },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className="nav-item" aria-current={active ? "page" : undefined}>
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
