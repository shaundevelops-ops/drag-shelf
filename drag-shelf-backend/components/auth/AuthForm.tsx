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
  Ticket,
} from "lucide-react";

type AuthMode = "login" | "register";

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");

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

    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (isRegister) {
        // 1. Register using beta invitation
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
            displayName: name.trim(),
            inviteCode: inviteCode.trim().toUpperCase(),
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Registration failed. Please try again."
          );
        }

        // 2. Automatically sign in
        const supabase = createClient();

        const { error: loginError } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

        if (loginError) {
          setSuccess(
            "Your account and 60-day Pro beta access have been created! Please sign in."
          );

          return;
        }

        // 3. Redirect to dashboard
        router.push("/dashboard");
        router.refresh();

      } else {
        // Normal login
        const supabase = createClient();

        const { error: loginError } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

        if (loginError) throw loginError;

        router.push("/dashboard");
        router.refresh();
      }

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
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
          <div className="eyebrow">
            {isRegister
              ? "EXCLUSIVE CLOSED BETA"
              : "YOUR WORKSPACE, CONNECTED"}
          </div>

          <h1>
            {isRegister
              ? "Claim your workspace."
              : "Welcome back."}
          </h1>

          <p>
            {isRegister
              ? "Join the Drag Shelf beta and experience your 60-day Pro access."
              : "Sign in to continue to your Drag Shelf account."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">

          {/* Display Name */}
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
                  autoComplete="name"
                />
              </div>
            </label>
          )}

          {/* Email */}
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
                autoComplete="email"
              />
            </div>
          </label>

          {/* Password */}
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
                autoComplete={
                  isRegister ? "new-password" : "current-password"
                }
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

          {/* Beta Invitation Code */}
          {isRegister && (
            <label className="input-group">
              <span>Beta invitation code</span>

              <div className="input-wrapper">
                <Ticket size={18} />

                <input
                  type="text"
                  placeholder="DRAGSHELF-XXXXXXXXXXXXXXXX"
                  value={inviteCode}
                  onChange={(e) =>
                    setInviteCode(e.target.value.toUpperCase())
                  }
                  required
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <small className="input-hint">
                Your exclusive invitation code is required to join.
              </small>
            </label>
          )}

          {/* Forgot Password */}
          {!isRegister && (
            <div className="forgot-row">
              <Link href="/forgot-password">
                Forgot password?
              </Link>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="message error">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="message success">
              {success}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? (
              <Loader2 size={19} className="spin" />
            ) : (
              <>
                {isRegister
                  ? "Claim beta access"
                  : "Sign in"}

                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-switch">
          {isRegister
            ? "Already have an account?"
            : "New to Drag Shelf?"}

          <Link href={isRegister ? "/login" : "/register"}>
            {isRegister ? "Sign in" : "Create account"}
          </Link>
        </div>

        {isRegister && (
          <div className="beta-notice">
            60 DAYS OF PRO ACCESS · INVITE ONLY
          </div>
        )}

        <div className="auth-footer">
          LOCAL-FIRST. BUILT FOR YOUR WORKFLOW.
        </div>
      </section>
    </main>
  );
}