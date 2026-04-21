"use client";

import { useAuth } from "@/app/context/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { links } from "./links";
import useUnreadMessages from "@/app/hooks/useUnreadMessages";
import useUnreadNotifications from "@/app/hooks/useUnreadNotification";
import useTheme from "@/app/hooks/useTheme";

const Header = () => {
  const { user } = useAuth();
  const pathname = usePathname();
  const countUnreadMessages = useUnreadMessages();
  const countUnreadNotifications = useUnreadNotifications();
  const { toggle, theme } = useTheme();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-(--bg-secondary) border-b border-(--border) h-14">
      <nav className="max-w-5xl mx-auto flex items-center justify-between px-6 h-full relative">
        {/* Лого */}
        <Link
          href="/"
          className="text-sm font-extrabold tracking-wide text-(--text-primary)"
        >
          NEBL
        </Link>

        {/* Навигация по центру */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative px-4 py-1.5 rounded-xl text-sm transition-all duration-200
                ${
                  pathname === link.href
                    ? "text-(--text-primary) bg-(--bg-card) font-extrabold"
                    : "text-(--text-primary)/40 font-bold hover:text-(--text-primary) hover:bg-(--bg-card)"
                }`}
            >
              {link.label}

              {link.href === "/components/chat" && countUnreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {countUnreadMessages > 9 ? "9+" : countUnreadMessages}
                </span>
              )}

              {link.href === "/components/notifications" &&
                countUnreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {countUnreadNotifications > 9
                      ? "9+"
                      : countUnreadNotifications}
                  </span>
                )}
            </Link>
          ))}
        </div>

        {/* Правая часть */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-(--text-primary)/40 hover:text-(--text-primary) hover:bg-(--bg-card) transition-all duration-200"
          >
            {theme === "dark" ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7zM2 13h2a1 1 0 0 0 0-2H2a1 1 0 0 0 0 2zm18 0h2a1 1 0 0 0 0-2h-2a1 1 0 0 0 0 2zM11 2v2a1 1 0 0 0 2 0V2a1 1 0 0 0-2 0zm0 18v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-2 0zM5.99 4.58a1 1 0 0 0-1.41 1.41l1.06 1.06a1 1 0 0 0 1.41-1.41L5.99 4.58zm12.37 12.37a1 1 0 0 0-1.41 1.41l1.06 1.06a1 1 0 0 0 1.41-1.41l-1.06-1.06zm1.06-10.96a1 1 0 0 0-1.41-1.41l-1.06 1.06a1 1 0 0 0 1.41 1.41l1.06-1.06zM7.05 18.36a1 1 0 0 0-1.41-1.41l-1.06 1.06a1 1 0 0 0 1.41 1.41l1.06-1.06z" />
              </svg>
            )}
          </button>

          {!user ? (
            <Link
              href="/components/login"
              className="px-4 py-1.5 rounded-xl text-sm font-bold text-(--text-primary) bg-(--bg-card) hover:opacity-80 transition-all duration-200"
            >
              Sign In
            </Link>
          ) : (
            <Link
              href="/components/profile"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold text-(--text-primary)/60 hover:text-(--text-primary) hover:bg-(--bg-card) transition-all duration-200"
            >
              <div className="w-6 h-6 rounded-full bg-(--bg-card) flex items-center justify-center text-xs font-bold text-(--text-primary)">
                {user.email?.[0].toUpperCase()}
              </div>
              {user.user_metadata?.name ?? "Profile"}
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
