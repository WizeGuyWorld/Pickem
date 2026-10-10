"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
    const router = useRouter();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [ready, setReady] = useState(false);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event) => {
            if (event === "PASSWORD_RECOVERY") {
                setReady(true);
            }
        });

        supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
                setReady(true);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    async function updatePassword() {
        setError("");

        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setWorking(true);

        const { error } = await supabase.auth.updateUser({
            password,
        });

        if (error) {
            setError(error.message);
            setWorking(false);
            return;
        }

        router.replace("/login");
    }

    if (!ready) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
                <p className="text-zinc-400">
                    Validating password reset link...
                </p>
            </main>
        );
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-white">
            <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
                <h1 className="text-2xl font-bold">
                    Reset Password
                </h1>

                <p className="mt-2 text-sm text-zinc-400">
                    Enter your new password.
                </p>

                {error && (
                    <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                        {error}
                    </div>
                )}

                <div className="mt-5 space-y-3">
                    <input
                        type="password"
                        placeholder="New password"
                        value={password}
                        onChange={(e) =>
                            setPassword(e.target.value)
                        }
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-white"
                    />

                    <input
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) =>
                            setConfirmPassword(e.target.value)
                        }
                        className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-white"
                    />

                    <button
                        onClick={updatePassword}
                        disabled={working}
                        className="w-full rounded-2xl bg-emerald-500 py-3 font-bold text-black disabled:opacity-50"
                    >
                        {working
                            ? "Updating..."
                            : "Update Password"}
                    </button>
                </div>
            </div>
        </main>
    );

}