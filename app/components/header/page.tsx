"use client";

import { useAuth } from "@/app/context/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { links } from "./links";
import { useEffect, useState } from "react";
import { createClient } from "@/app/lib/supabase/client";

const Header = () => {
  const { user } = useAuth();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;

    const loadUnread = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      setUnreadCount(count ?? 0);
    };

    loadUnread();

    const channel = supabase
      .channel("notifications-header")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => loadUnread(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        () => loadUnread(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#2c2c2e] border-b border-white/5">
      <nav className="max-w-5xl mx-auto flex items-center justify-between px-6 py-3">
        {/* Лого */}
        <Link href="/" className="text-sm font-black text-white">
          NEBL
        </Link>

        {/* Ссылки */}
        <div className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200
                ${
                  pathname === link.href
                    ? "text-white bg-[#3a3a3c]"
                    : "text-white/40 hover:text-white hover:bg-[#3a3a3c]"
                }`}
            >
              {link.label}
              {link.href === "/components/notifications" && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Авторизация */}
        {!user ? (
          <Link
            href="/components/login"
            className="px-4 py-1.5 rounded-xl text-sm font-semibold text-white bg-[#3a3a3c] hover:bg-[#48484a] transition-all duration-200"
          >
            Sign In
          </Link>
        ) : (
          <Link
            href="/components/profile"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-[#3a3a3c] transition-all duration-200"
          >
            <div className="w-6 h-6 rounded-full bg-[#48484a] flex items-center justify-center text-xs font-bold text-white">
              {user.email?.[0].toUpperCase()}
            </div>
            {user.user_metadata?.name ?? "Profile"}
          </Link>
        )}
      </nav>
    </header>
  );
};

export default Header;
