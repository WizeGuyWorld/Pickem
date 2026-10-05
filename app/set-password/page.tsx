"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SetPasswordPage() {
    const router = useRouter();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [checkingSession, setCheckingSession] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        checkSession();
    }, []);

    async function checkSession() {
        const {
            data: { session },
            error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
            setError(sessionError.message);
        }

        if (!session) {
            setError(
                "This invitation is invalid or expired. Please ask the commissioner for a new invite."
            );
        }

        setCheckingSession(false);
    }

    async function setNewPassword() {
        setError("");
        setMessage("");

        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setSaving(true);

        const { error: updateError } =
            await supabase.auth.updateUser({
                password,
            });

        if (updateError) {
            setError(updateError.message);
            setSaving(false);
            return;
        }

        setMessage("Password created successfully.");

        setTimeout(() => {
            router.replace("/");
            router.refresh();
        }, 1000);
    }

    if (checkingSession) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
                <p className="text-zinc-400">
                    Checking invitation...
                </p>
            </main>
        );
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
            <div className="w-full max-w-md">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                    Pick Draft
                </p>

                <h1 className="mt-2 text-3xl font-bold">
                    Create Password
                </h1>

                <p className="mt-2 text-sm text-zinc-400">
                    Finish setting up your account.
                </p>

                {error && (
                    <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                        {message}
                    </div>
                )}

                <div className="mt-6 space-y-4">
                    <input
                        type="password"
                        placeholder="New password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-white"
                    />

                    <input
                        type="password"
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChange={(e) =>
                            setConfirmPassword(e.target.value)
                        }
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 p-4 text-white"
                    />

                    <button
                        onClick={setNewPassword}
                        disabled={saving}
                        className="w-full rounded-2xl bg-emerald-500 py-4 font-bold text-black disabled:opacity-50"
                    >
                        {saving
                            ? "Saving..."
                            : "Create Password"}
                    </button>
                </div>
            </div>
        </main>
    );
}