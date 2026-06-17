"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Oggi" },
  { href: "/manage", label: "Gestione" },
];

/** Navigazione con evidenziazione della voce corrente. */
export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 text-sm">
      {LINKS.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center rounded-md px-3 py-2 transition-colors",
              active
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
