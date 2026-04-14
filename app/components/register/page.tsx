"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase/client";

const Register = () => {
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [twicePassword, setTwicePassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (password !== twicePassword) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1c1c1e] text-white">
        <div className="rounded-2xl bg-[#2c2c2e] p-8 text-center max-w-sm">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="font-semibold text-base mb-2">Check your email</h2>
          <p className="text-white/40 text-sm">
            We sent a confirmation link to{" "}
            <span className="text-white/70">{email}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#1c1c1e] text-white">
      {/* Left panel */}
      <aside className="hidden lg:flex w-1/2 flex-col justify-center px-16">
        <h1 className="text-5xl font-black leading-tight mb-4">
          Your world,
          <br />
          <span className="text-white/40">your rules.</span>
        </h1>
        <p className="text-sm text-white/30 max-w-xs leading-relaxed">
          Chat, share, and discover new things with millions of people around
          the world.
        </p>
      </aside>

      {/* Right panel */}
      <main className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl bg-[#2c2c2e] p-6 mb-4">
            <h2 className="text-base font-semibold mb-5">Create account</h2>
            <form onSubmit={handleRegister} className="space-y-3">
              {error && <p className="text-red-400 text-xs">{error}</p>}

              {[
                {
                  label: "Name",
                  type: "text",
                  value: name,
                  onChange: setName,
                  placeholder: "your name",
                },
                {
                  label: "Email",
                  type: "email",
                  value: email,
                  onChange: setEmail,
                  placeholder: "you@example.com",
                },
                {
                  label: "Password",
                  type: "password",
                  value: password,
                  onChange: setPassword,
                  placeholder: "••••••••",
                },
              ].map(({ label, type, value, onChange, placeholder }) => (
                <div key={label}>
                  <label className="block text-[11px] font-medium text-white/40 uppercase tracking-widest mb-1.5">
                    {label}
                  </label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    required
                    className="w-full rounded-xl bg-[#3a3a3c] border border-white/5 focus:border-white/20 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors"
                  />
                </div>
              ))}

              <div>
                <label className="block text-[11px] font-medium text-white/40 uppercase tracking-widest mb-1.5">
                  Confirm password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={twicePassword}
                  onChange={(e) => setTwicePassword(e.target.value)}
                  required
                  className={`w-full rounded-xl bg-[#3a3a3c] border px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors
                    ${twicePassword && password !== twicePassword ? "border-red-500/50" : "border-white/5 focus:border-white/20"}`}
                />
                {twicePassword && password !== twicePassword && (
                  <p className="text-red-400 text-[11px] mt-1">
                    Passwords don&apos;t match
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#3a3a3c] hover:bg-[#48484a] py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              >
                {loading ? "Creating..." : "Create Account"}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/5" />
              <span className="text-[11px] text-white/20">or</span>
              <div className="h-px flex-1 bg-white/5" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: "Google",
                  icon: (
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
                  ),
                },
                {
                  label: "GitHub",
                  icon: (
                    <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24">
                      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                  ),
                },
              ].map(({ label, icon }) => (
                <button
                  key={label}
                  type="button"
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#3a3a3c] hover:bg-[#48484a] py-2.5 text-xs font-medium text-white/50 hover:text-white transition-colors"
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-white/30">
            Have account?{" "}
            <Link
              href="/components/login"
              className="text-white/60 hover:text-white transition-colors"
            >
              Sign In
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Register;
