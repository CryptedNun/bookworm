import React from 'react';
import Link from 'next/link';
import { FileQuestion, ArrowRight, Home, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-100 selection:bg-emerald-500/30 selection:text-emerald-200">
      <div className="w-full max-w-md p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-2xl backdrop-blur-xl text-center space-y-5 animate-in fade-in duration-200">
        <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
          <FileQuestion className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
            404 Not Found
          </span>
          <h1 className="text-xl font-bold text-zinc-100 pt-1">Resource Not Found</h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The requested note, notebook, or edition snapshot either does not exist or has been relocated.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Go to Dashboard</span>
          </Link>

          <Link
            href="/explore"
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Explore Notes</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
