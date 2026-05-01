"use client";

import { createClient } from "@/app/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";

const LogOut = () => {
  const supabase = createClient();
  const router = useRouter();
  const { lang } = useLang();
  const tr = t[lang];

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    router.push("/components/login");
  };
  return (
    <button
      onClick={handleLogOut}
      className="mt-8 w-full rounded-xl border border-red-500/30 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-all"
    >
      {tr.logOut}
    </button>
  );
};

export default LogOut;
