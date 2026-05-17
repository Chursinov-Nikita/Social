"use client";

import { useLang } from "@/app/context/language";
import useTheme from "@/app/hooks/useTheme";
import { useUnreadCounts } from "@/app/hooks/useUnreadCounts";
import { t } from "@/app/translation/translation";
import { MoonIcon } from "@heroicons/react/24/solid";
import { SunIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getLinks } from "./links";

const Header = () => {
  const { data: session } = useSession();
  const user = session?.user ?? null;
  const pathname = usePathname();
  const {
    messages: countUnreadMessages,
    notifications: countUnreadNotifications,
  } = useUnreadCounts();
  const { toggle, theme } = useTheme();
  const { lang, toggle: toggleLang } = useLang();
  const tr = t[lang];
  const links = getLinks(tr);

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

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative px-4 py-1.5 rounded-xl text-sm transition-all duration-200 ${
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
            onClick={toggleLang}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-(--text-primary)/40 hover:text-(--text-primary) hover:bg-(--bg-card) transition-all duration-200 text-xs font-bold tracking-wider"
          >
            {lang === "en" ? "RU" : "EN"}
          </button>

          <button
            onClick={toggle}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-(--text-primary)/40 hover:text-(--text-primary) hover:bg-(--bg-card) transition-all duration-200"
          >
            {theme === "dark" ? (
              <MoonIcon className="w-4 h-4" />
            ) : (
              <SunIcon className="w-4 h-4" />
            )}
          </button>

          {!user ? (
            <Link
              href="/components/login"
              className="px-4 py-1.5 rounded-xl text-sm font-bold text-(--text-primary) bg-(--bg-card) hover:opacity-80 transition-all duration-200"
            >
              {tr.signIn}
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/components/profile"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold text-(--text-primary)/60 hover:text-(--text-primary) hover:bg-(--bg-card) transition-all duration-200"
              >
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt="avatar"
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-(--bg-card) flex items-center justify-center text-xs font-bold text-(--text-primary)">
                    {user.name?.[0].toUpperCase() ??
                      user.email?.[0].toUpperCase()}
                  </div>
                )}
                {user.name ?? tr.profile}
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
