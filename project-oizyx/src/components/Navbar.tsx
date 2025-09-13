"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function Navbar() {
    const pathname = usePathname();

    // Helper to determine if tab is active
    const isActive = (path: string) => pathname === path;

    return (
        <header className="fixed top-0 left-0 w-full z-50 bg-white dark:bg-zinc-900 border-b shadow-sm">
            <nav className="flex items-center justify-between h-16 px-8 max-w-8xl mx-auto">
                {/* Left side: Logo and Team Name */}
                <Link href="/" className="flex items-center gap-3">
                    {/* <img src="/logo.png" alt="Team Logo" className="w-10 h-10 rounded-full" /> */}
                    <span className="text-2xl font-extrabold text-orange-600 dark:text-orange-400">
                        Oizyx
                    </span>
                </Link>

                {/* Right side: Nav Tabs */}
                <div className="flex items-center space-x-4">
                    <Link href="/project" passHref legacyBehavior>
                        <Button
                            variant={isActive("/project") ? "default" : "ghost"}
                            className={isActive("/project") ? "bg-indigo-600 text-white shadow-lg" : ""}
                        >
                            Project
                        </Button>
                    </Link>

                    <Link href="/team" passHref legacyBehavior>
                        <Button
                            variant={isActive("/team") ? "default" : "ghost"}
                            className={isActive("/team") ? "bg-indigo-600 text-white shadow-lg" : ""}
                        >
                            Team
                        </Button>
                    </Link>
                </div>
            </nav>
        </header>
    );
}
