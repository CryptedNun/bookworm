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
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export function AuthCard() {
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [usernameOrEmail, setUsernameOrEmail] = useState("alice@bookworm.dev");
  const [password, setPassword] = useState("••••••••••••");
  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Import dynamically to avoid server/client boundary issues
      const { signIn } = await import('@/actions/auth');
      const result = await signIn(usernameOrEmail, password);

      if (result.success) {
        router.push('/dashboard');
      } else {
        alert(result.error || 'Sign in failed');
        setIsLoading(false);
      }
    } catch (error: any) {
      alert('Sign in error: ' + error.message);
      setIsLoading(false);
    }
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 150);
  };

  const handleQuickDemo = async () => {
    setIsLoading(true);
    
    try {
      const { signIn } = await import('@/actions/auth');
      // Use alice's credentials for quick demo
      const result = await signIn('alice@bookworm.dev', 'demo');
      
      if (result.success) {
        router.push("/dashboard");
      } else {
        alert('Demo login failed: ' + result.error);
        setIsLoading(false);
      }
    } catch (error: any) {
      alert('Demo login error: ' + error.message);
      setIsLoading(false);
    }
  };

  const checkDatabase = async () => {
    try {
      const { verifyDatabase } = await import('@/actions/verify-db');
      const result = await verifyDatabase();
      
      if (result.success && result.users) {
        const status = `✅ Database Connected!\n\n` +
          `Users: ${result.users.length}\n` +
          result.users.map((u: any) => `  - ${u.username} (${u.email}) ${u.is_active ? '✓' : '✗'}`).join('\n') +
          `\n\nNotebooks: ${result.notebooks_count}\n` +
          `Notes: ${result.notes_count}`;
        setDbStatus(status);
        alert(status);
      } else {
        const status = `❌ Database Error:\n${result.error}`;
        setDbStatus(status);
        alert(status);
      }
    } catch (error: any) {
      const status = `❌ Connection Error:\n${error.message}`;
      setDbStatus(status);
      alert(status);
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
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100 flex items-center justify-center gap-2">
          BookWorm
          <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
            v0.1 Local
          </span>
        </h1>
        <p className="text-zinc-400 text-sm mt-1.5 font-normal">
          GitHub for Notes • Branch, Collaborate & Version Control
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
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
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

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => alert("Password reset will be enabled when database auth is configured.")}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Forgot password?
                </button>
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

            <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-0 focus:ring-offset-0 accent-emerald-500"
                />
                Remember this device
              </label>
              <span className="flex items-center gap-1 text-zinc-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Localhost Mode
              </span>
            </div>

            <div className="pt-2 space-y-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-70"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
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
                className="w-full py-2 px-4 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 font-medium text-xs border border-zinc-700/60 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Instant Demo Access (as @alice)
              </button>

              <button
                type="button"
                onClick={checkDatabase}
                className="w-full py-2 px-4 rounded-xl bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 font-medium text-xs border border-blue-700/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                🔍 Verify Database Connection
              </button>

              <button
                type="button"
                onClick={clearSession}
                className="w-full py-2 px-4 rounded-xl bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 font-medium text-xs border border-amber-700/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                🔄 Clear Session (Test Login Again)
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Create Account */}
        {tab === "signup" && (
          <form onSubmit={handleSignUp} className="p-6 sm:p-7 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alice Walker"
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-zinc-950/70 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50"
                />
              </div>
            </div>

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
                  placeholder="alice"
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
                  placeholder="alice@example.com"
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-zinc-950/70 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Create Password
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
                  placeholder="Choose a strong password"
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
        <div className="bg-zinc-950/80 border-t border-zinc-800/80 px-6 py-4">
          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>LexoRank Block Ordering</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Zero-Cost Forking (CAS)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Branch & Merge Edits</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Granular Block Issues</span>
            </div>
          </div>
        </div>
      </div>

      {/* Localhost Note */}
      <p className="text-center text-xs text-zinc-500 mt-6">
        Localhost development environment • Authentication simulation mode
      </p>
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
