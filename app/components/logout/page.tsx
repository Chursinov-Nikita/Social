"use client";

import { signOut } from "next-auth/react";
import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";

const LogOut = () => {
  const { lang } = useLang();
  const tr = t[lang];

  return (
    <button
      onClick={() => signOut({ callbackUrl: "/components/login" })}
      className="mt-8 w-full rounded-xl border border-red-500/30 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-all"
    >
      {tr.logOut}
    </button>
  );
};

export default LogOut;
