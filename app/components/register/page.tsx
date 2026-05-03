"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLang } from "@/app/context/language";
import { t } from "@/app/translation/translation";

const Register = () => {
  const { lang } = useLang();
  const tr = t[lang];
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError(tr.passwordsDoNotMatch);
      return;
    }
    if (password.length < 6) {
      setError(tr.passwordLeast);
      return;
    }

    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    // Автологин после регистрации
    await signIn("credentials", { email, password, callbackUrl: "/" });
    router.push("/");
  };

  return (
    <div className="flex min-h-screen bg-(--bg-primary) text-(--text-primary)">
      <aside className="hidden lg:flex w-1/2 flex-col justify-center px-16">
        <h1 className="text-6xl font-black leading-tight mb-4">
          {tr.yourWorld}
          <br />
          <span className="text-(--text-primary)/40">{tr.yourRules}</span>
        </h1>
        <p className="text-sm text-(--text-primary)/20 max-w-xs leading-relaxed">
          {tr.authDesc}
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl bg-(--bg-secondary) p-6 mb-4">
            <h2 className="text-base font-semibold mb-5 text-(--text-primary)">
              {tr.createAccount}
            </h2>

            <form onSubmit={handleRegister} className="space-y-3">
              {error && <p className="text-red-400 text-xs">{error}</p>}

              <div>
                <label className="block text-[11px] font-medium text-(--text-primary)/40 uppercase tracking-widest mb-1.5">
                  {tr.name}
                </label>
                <input
                  type="text"
                  placeholder={tr.name2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-xl bg-(--bg-card) border border-(--border) focus:border-(--text-primary)/20 px-4 py-2.5 text-sm text-(--text-primary) placeholder:text-(--text-primary)/20 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-(--text-primary)/40 uppercase tracking-widest mb-1.5">
                  {tr.email}
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl bg-(--bg-card) border border-(--border) focus:border-(--text-primary)/20 px-4 py-2.5 text-sm text-(--text-primary) placeholder:text-(--text-primary)/20 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-(--text-primary)/40 uppercase tracking-widest mb-1.5">
                  {tr.password}
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl bg-(--bg-card) border border-(--border) focus:border-(--text-primary)/20 px-4 py-2.5 text-sm text-(--text-primary) placeholder:text-(--text-primary)/20 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-(--text-primary)/40 uppercase tracking-widest mb-1.5">
                  {tr.confirmPassword}
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className={`w-full rounded-xl bg-(--bg-card) border px-4 py-2.5 text-sm text-(--text-primary) placeholder:text-(--text-primary)/20 outline-none transition-colors ${
                    confirm && password !== confirm
                      ? "border-red-500/50"
                      : "border-(--border) focus:border-(--text-primary)/20"
                  }`}
                />
                {confirm && password !== confirm && (
                  <p className="text-red-400 text-[11px] mt-1">
                    {tr.passwordsDoNotMatch}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-(--bg-card) hover:opacity-80 py-2.5 text-sm font-semibold text-(--text-primary) transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? tr.creating : tr.createAccount}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-(--border)" />
              <span className="text-[11px] text-(--text-primary)/20">
                {tr.or}
              </span>
              <div className="h-px flex-1 bg-(--border)" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => signIn("google", { callbackUrl: "/" })}
                className="flex items-center justify-center gap-2 rounded-xl bg-(--bg-card) hover:opacity-80 py-2.5 text-xs font-medium text-(--text-primary)/50 hover:text-(--text-primary) transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </button>

              <button
                onClick={() => signIn("github", { callbackUrl: "/" })}
                className="flex items-center justify-center gap-2 rounded-xl bg-(--bg-card) hover:opacity-80 py-2.5 text-xs font-medium text-(--text-primary)/50 hover:text-(--text-primary) transition-colors"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                GitHub
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-(--text-primary)/30">
            {tr.haveAccount}{" "}
            <Link
              href="/components/login"
              className="font-semibold text-(--text-primary)/60 hover:text-(--text-primary) transition-colors"
            >
              {tr.signIn}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Register;
