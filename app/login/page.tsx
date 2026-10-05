"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function login() {
        setLoading(true);
        setError("");

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        router.push("/");
        router.refresh();
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
            <div className="w-full max-w-md">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                    Pick Em Group 2026
                </p>

                <h1 className="mt-2 text-3xl font-bold">
                    Sign In
                </h1>

                <p className="mt-2 text-sm text-zinc-400">
                    Sign in to access the weekly locks!
                </p>

                {error && (
                    <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                        {error}
                    </div>
                )}

                <div className="mt-6 space-y-4">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-white"
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-white"
                    />

                    <button
                        onClick={login}
                        disabled={loading}
                        className="w-full rounded-2xl bg-emerald-500 py-4 font-bold text-black disabled:opacity-50"
                    >
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </div>
            </div>
        </main>
    );
}