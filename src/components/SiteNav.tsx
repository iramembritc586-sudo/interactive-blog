"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "首页" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/projects", label: "Projects" },
  { href: "/contact", label: "Contact" },
  { href: "/login", label: "Login" },
] as const;

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200/80 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
        >
          Interactive Blog
        </Link>
        <ul className="flex flex-wrap items-center justify-end gap-1 text-sm">
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`rounded-md px-2.5 py-1.5 transition-colors ${
                    active
                      ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
