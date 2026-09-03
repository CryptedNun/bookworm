"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  GitBranch,
  ArrowRight,
  Lock,
  Mail,
  User as UserIcon,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

export function AuthCard() {
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [usernameOrEmail, setUsernameOrEmail] = useState("alice@bookworm.dev");
  const [password, setPassword] = useState("password");
  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { signIn } = await import('@/actions/auth');
      const result = await signIn(usernameOrEmail, password);

      if (result.success) {
        router.push('/dashboard');
      } else {
        setError(result.error || 'Sign in failed');
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      setError('Network error. Check your database connection.');
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { signUp } = await import('@/actions/auth');
      const result = await signUp({
        username: signupUsername,
        email: signupEmail,
        password: signupPassword,
      });

      if (result.success) {
        setSuccessMessage('Account created successfully! Redirecting...');
        setTimeout(() => {
          router.push("/dashboard");
        }, 300);
      } else {
        setError(result.error || 'Registration failed');
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'An unexpected error occurred during registration.');
      setIsLoading(false);
    }
  };

  const handleSelectDemoUser = (userEmail: string) => {
    setUsernameOrEmail(userEmail);
    setPassword("password");
    setError(null);
  };

  const handleQuickDemo = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { signIn } = await import('@/actions/auth');
      const result = await signIn('alice@bookworm.dev', 'password');
      
      if (result.success) {
        router.push("/dashboard");
      } else {
        setError('Demo login failed: ' + result.error);
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error('Demo login error:', error);
      setError('Network error during demo login');
      setIsLoading(false);
    }
  };

  const clearSession = async () => {
    try {
      const { signOut } = await import('@/actions/auth');
      await signOut();
      alert('✅ Session cleared! You can test login again.');
    } catch (error: any) {
      // If signOut fails, manually clear cookies
      document.cookie = 'user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      alert('✅ Session cleared! You can test login again.');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl shadow-emerald-950/20 text-emerald-400 mb-4 ring-1 ring-emerald-500/20">
          <div className="relative">
            <BookOpen className="w-8 h-8" />
            <GitBranch className="w-4 h-4 absolute -bottom-1 -right-1 text-emerald-300 bg-zinc-900 rounded-full p-0.5" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          BookWorm
        </h1>
        <p className="text-zinc-400 text-sm mt-1.5 font-normal">
          Branch, collaborate & version-control your notes
        </p>
      </div>

      {/* Main Container */}
      <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden ring-1 ring-white/5">
        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/50 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setTab("signin")}
            className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tab === "signin"
                ? "bg-zinc-800 text-zinc-100 shadow-sm shadow-black/40 border border-zinc-700/60"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setTab("signup")}
            className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tab === "signup"
                ? "bg-zinc-800 text-zinc-100 shadow-sm shadow-black/40 border border-zinc-700/60"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Tab 1: Sign In */}
        {tab === "signin" && (
          <form onSubmit={handleSignIn} className="p-6 sm:p-7 space-y-4">
            {/* Error Display */}
            {error && (
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
                <span className="shrink-0">⚠️</span>
                <div className="flex-1">
                  <p className="font-semibold">Sign In Failed</p>
                  <p className="text-xs mt-0.5 text-red-300">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="shrink-0 text-red-400 hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Quick Demo User Switcher */}
            <div className="space-y-2 pt-1 pb-2">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span className="font-medium">Demo Accounts</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { name: "Alice", email: "alice@bookworm.dev", role: "Owner" },
                  { name: "Bob", email: "bob@bookworm.dev", role: "Maintainer" },
                  { name: "Charlie", email: "charlie@bookworm.dev", role: "Contributor" },
                  { name: "Diana", email: "diana@bookworm.dev", role: "Author" },
                ].map((demoUser) => (
                  <button
                    key={demoUser.email}
                    type="button"
                    onClick={() => handleSelectDemoUser(demoUser.email)}
                    className={`px-2.5 py-1.5 rounded-lg border text-left flex items-center justify-between gap-1.5 transition-all text-xs cursor-pointer ${
                      usernameOrEmail === demoUser.email
                        ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-semibold"
                        : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/80"
                    }`}
                  >
                    <span className="truncate">{demoUser.name}</span>
                    <span className="text-[9px] font-mono text-zinc-500 px-1 py-0.2 bg-zinc-800/80 rounded">
                      {demoUser.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Username or Email */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Username or Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="alice@bookworm.dev or @alice"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-zinc-950/70 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-zinc-950/70 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-colors"
                />
              </div>
            </div>



            <div className="pt-2 space-y-2.5">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                    <span>Verifying credentials...</span>
                  </>
                ) : (
                  <>
                    Sign In to BookWorm
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleQuickDemo}
                disabled={isLoading}
                className="w-full py-2 px-4 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 font-medium text-xs border border-zinc-700/60 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Instant Demo Sign In (as @alice)
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Create Account */}
        {tab === "signup" && (
          <form onSubmit={handleSignUp} className="p-6 sm:p-7 space-y-3.5">
            {/* Error / Success Display */}
            {error && (
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
                <span className="shrink-0">⚠️</span>
                <div className="flex-1">
                  <p className="font-semibold">Registration Failed</p>
                  <p className="text-xs mt-0.5 text-red-300">{error}</p>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <p className="text-xs text-emerald-300">{successMessage}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <span className="text-xs font-mono">@</span>
                </div>
                <input
                  type="text"
                  required
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  placeholder="e.g. grace_hopper"
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-zinc-950/70 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="grace@example.com"
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-zinc-950/70 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-zinc-950/70 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50"
                />
              </div>

            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-70"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Create BookWorm Account
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Feature Highlights Footer */}
        <div className="bg-zinc-950/80 border-t border-zinc-800/80 px-6 py-3.5">
          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Secure Authentication</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Zero-Cost Forking</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Branch & Merge</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Block-Level Collaboration</span>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen w-full flex flex-col justify-center items-center px-4 py-12 bg-zinc-950 text-zinc-100 relative overflow-hidden selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Background Decorative Gradients & Mesh Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Auth Content */}
      <div className="relative z-10 w-full flex flex-col items-center">
        <AuthCard />
      </div>
    </main>
  );
}
