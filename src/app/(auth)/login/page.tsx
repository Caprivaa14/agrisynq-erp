"use client";

import { useFormState, useFormStatus } from "react-dom";
import Image from "next/image";
import { signInAction, type AuthActionState } from "@/actions/auth";
import { Leaf, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const initialState: AuthActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      id="btn-signin"
      type="submit"
      disabled={pending}
      className={cn(
        "w-full flex items-center justify-center gap-2",
        "px-4 py-2.5 rounded-md text-sm font-medium",
        "bg-leaf-600 text-white",
        "hover:bg-leaf-700 active:bg-leaf-800",
        "transition-colors shadow-sm",
        "disabled:opacity-60 disabled:cursor-not-allowed"
      )}
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Signing in…
        </>
      ) : (
        "Sign in"
      )}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(signInAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-md animate-fade-in">
      {/* Logo & brand */}
      <div className="text-center mb-8 flex flex-col items-center">
        <Image 
          src="/logos/agrisynq_full.jpg" 
          alt="AgriSynq ERP"
          width={400}
          height={267}
          priority
          className="h-24 w-auto object-contain rounded-xl shadow-panel border border-surface-border bg-black"
        />
      </div>

      {/* Card */}
      <div className="card p-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-ink">Sign in</h2>
          <p className="text-sm text-ink-muted mt-0.5">
            Enter your credentials to access the ERP
          </p>
        </div>

        <form action={formAction} className="space-y-5" noValidate>
          {/* Global error */}
          {state.error && (
            <div
              role="alert"
              className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-100 rounded-md px-3 py-2.5"
            >
              <span className="mt-px">⚠</span>
              <span>{state.error}</span>
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="email" className="form-label">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              className={cn(
                "w-full px-3 py-2 text-sm rounded-md border shadow-input",
                "bg-surface-card text-ink placeholder:text-ink-faint",
                "transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-leaf-500 focus:border-transparent",
                state.fieldErrors?.email
                  ? "border-danger-500"
                  : "border-surface-border hover:border-ink-faint"
              )}
              placeholder="you@company.com"
            />
            {state.fieldErrors?.email && (
              <p className="form-error">{state.fieldErrors.email[0]}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className={cn(
                  "w-full px-3 py-2 pr-10 text-sm rounded-md border shadow-input",
                  "bg-surface-card text-ink placeholder:text-ink-faint",
                  "transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-leaf-500 focus:border-transparent",
                  state.fieldErrors?.password
                    ? "border-danger-500"
                    : "border-surface-border hover:border-ink-faint"
                )}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-muted transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {state.fieldErrors?.password && (
              <p className="form-error">{state.fieldErrors.password[0]}</p>
            )}
          </div>

          {/* Submit */}
          <SubmitButton />
        </form>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-ink-faint mt-6">
        AgriSynq ERP · Agricultural Trade &amp; Compliance System
      </p>
    </div>
  );
}
