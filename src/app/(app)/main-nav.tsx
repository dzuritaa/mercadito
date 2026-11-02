"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName =
  | "home"
  | "pantry"
  | "book"
  | "flame"
  | "calendar"
  | "basket"
  | "chart"
  | "gear";

export type NavLabels = {
  main: string;
  dashboard: string;
  inventory: string;
  recipes: string;
  cookNow: string;
  mealPlanner: string;
  shoppingList: string;
  reports: string;
  settings: string;
};

const navItems: { href: string; label: keyof Omit<NavLabels, "main">; icon: IconName }[] = [
  { href: "/", label: "dashboard", icon: "home" },
  { href: "/inventory", label: "inventory", icon: "pantry" },
  { href: "/recipes", label: "recipes", icon: "book" },
  { href: "/cook-now", label: "cookNow", icon: "flame" },
  { href: "/meal-planner", label: "mealPlanner", icon: "calendar" },
  { href: "/shopping-list", label: "shoppingList", icon: "basket" },
  { href: "/reports", label: "reports", icon: "chart" },
  { href: "/settings", label: "settings", icon: "gear" }
];

const iconPaths: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  pantry: (
    <>
      <rect height="16" rx="2" width="14" x="5" y="4" />
      <path d="M5 10h14M5 15h14M9 7h2M9 12.5h2M9 17.5h2" />
    </>
  ),
  book: (
    <>
      <path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" />
      <path d="M9 8h6" />
    </>
  ),
  flame: (
    <path d="M12 21c-3.6 0-6-2.4-6-5.6 0-2.6 1.6-4.3 3-5.8.4 1.4 1.2 2.3 2 2.6-.4-2.9.9-5.6 3.4-7.2-.2 2.4.8 4 2 5.4 1 1.2 1.6 2.6 1.6 4.4C18 18.6 15.6 21 12 21Z" />
  ),
  calendar: (
    <>
      <rect height="15" rx="2" width="16" x="4" y="5" />
      <path d="M4 10h16M8 3v4M16 3v4M8 14h2M14 14h2" />
    </>
  ),
  basket: (
    <>
      <path d="M3.5 9h17l-1.8 9.2a2 2 0 0 1-2 1.8H7.3a2 2 0 0 1-2-1.8z" />
      <path d="m8 9 3-5M16 9l-3-5M9.5 13v3M14.5 13v3" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20h16" />
      <path d="M7 16v-4M12 16V7M17 16v-6" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  )
};

export function NavIcon({ name }: { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      className="nav-icon"
      fill="none"
      height="20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width="20"
    >
      {iconPaths[name]}
    </svg>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav({ labels }: { labels: NavLabels }) {
  const pathname = usePathname() ?? "/";

  return (
    <nav aria-label={labels.main} className="nav-list">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className="nav-link"
            href={item.href}
            key={item.href}
          >
            <NavIcon name={item.icon} />
            <span>{labels[item.label]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
