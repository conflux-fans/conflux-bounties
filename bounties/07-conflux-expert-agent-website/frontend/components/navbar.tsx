"use client";

import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect x="6" y="2" width="4" height="4" rx="0.5" fill="#2563EB" />
            <rect x="11" y="2" width="4" height="4" rx="0.5" fill="#3B82F6" />
            <rect x="16" y="2" width="4" height="4" rx="0.5" fill="#60A5FA" />

            <rect x="2" y="6" width="4" height="4" rx="0.5" fill="#1D4ED8" />

            <rect x="2" y="10" width="4" height="4" rx="0.5" fill="#1D4ED8" />

            <rect x="2" y="14" width="4" height="4" rx="0.5" fill="#1D4ED8" />

            <rect x="6" y="18" width="4" height="4" rx="0.5" fill="#2563EB" />
            <rect x="11" y="18" width="4" height="4" rx="0.5" fill="#3B82F6" />
            <rect x="16" y="18" width="4" height="4" rx="0.5" fill="#60A5FA" />
          </svg>
            <span className="font-bold inline-block">Conflux Expert</span>
          </Link>
        </div>
        
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link
              href="/chat"
              className={cn(
                "transition-colors hover:text-foreground/80",
                pathname === "/chat"
                  ? "text-foreground"
                  : "text-foreground/60"
              )}
            >
              Chat
            </Link>
            <Link
              href="/admin"
              className={cn(
                "transition-colors hover:text-foreground/80",
                pathname === "/admin"
                  ? "text-foreground"
                  : "text-foreground/60"
              )}
            >
              Admin
            </Link>
          </nav>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
