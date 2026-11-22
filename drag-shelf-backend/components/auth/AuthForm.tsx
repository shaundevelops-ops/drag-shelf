"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Layers3,
  Loader2,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";

type AuthMode = "login" | "register";

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isRegister = mode === "register";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const supabase = createClient();

      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              display_name: name.trim(),
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;

        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setSuccess(
            "Account created! Check your email to verify your account."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error) throw error;

        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-glow" />

      <section className="auth-card">
        <Link href="/" className="brand">
          <div className="brand-icon">
            <Layers3 size={23} />
          </div>

          <span>
            DRAG<span className="brand-accent">SHELF</span>
          </span>
        </Link>

        <div className="auth-heading">
          <div className="eyebrow">YOUR WORKSPACE, CONNECTED</div>

          <h1>
            {isRegister ? "Create your account." : "Welcome back."}
          </h1>

          <p>
            {isRegister
              ? "Create your Drag Shelf account and keep your workflow organized."
              : "Sign in to continue to your Drag Shelf account."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <label className="input-group">
              <span>Full name</span>

              <div className="input-wrapper">
                <UserRound size={18} />

                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </label>
          )}

          <label className="input-group">
            <span>Email address</span>

            <div className="input-wrapper">
              <Mail size={18} />

              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </label>

          <label className="input-group">
            <span>Password</span>

            <div className="input-wrapper">
              <LockKeyhole size={18} />

              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </label>

          {!isRegister && (
            <div className="forgot-row">
              <Link href="/forgot-password">Forgot password?</Link>
            </div>
          )}

          {error && <div className="message error">{error}</div>}

          {success && (
            <div className="message success">{success}</div>
          )}

          <button className="submit-button" disabled={loading}>
            {loading ? (
              <Loader2 size={19} className="spin" />
            ) : (
              <>
                {isRegister ? "Create account" : "Sign in"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-switch">
          {isRegister ? "Already have an account?" : "New to Drag Shelf?"}

          <Link href={isRegister ? "/login" : "/register"}>
            {isRegister ? "Sign in" : "Create account"}
          </Link>
        </div>

        <div className="auth-footer">
          LOCAL-FIRST. BUILT FOR YOUR WORKFLOW.
        </div>
      </section>
    </main>
  );
}