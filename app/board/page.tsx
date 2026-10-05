"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/AppHeader";

type BoardRow = {
    participant_id: number;
    participant_name: string;
    turn_number: number;
    turn_status: string;
    selection_id: number | null;
    display_name: string | null;
};

export default function BoardPage() {
    const [rows, setRows] = useState<BoardRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [weekNumber, setWeekNumber] = useState<number | null>(null);

    async function loadBoard() {
        setLoading(true);
        setError("");

        try {
            const { data: week, error: weekError } = await supabase
                .from("weeks")
                .select("id, week_number")
                .eq("is_active", true)
                .single();

            if (weekError || !week) {
                throw new Error(
                    weekError?.message ?? "Active week could not be loaded."
                );
            }

            setWeekNumber(week.week_number);

            const { data: boardData, error: boardError } =
                await supabase.rpc("get_week_board", {
                    p_week_id: week.id,
                });

            if (boardError) {
                throw new Error(boardError.message);
            }

            setRows((boardData as BoardRow[]) ?? []);
        } catch (err) {
            console.error("LOAD BOARD ERROR:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load the draft board."
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadBoard();
    }, []);

    function statusStyle(status: string) {
        if (status === "picked") {
            return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        }

        if (status === "on_clock") {
            return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
        }

        if (status === "skipped") {
            return "bg-red-500/10 text-red-400 border-red-500/20";
        }

        return "bg-zinc-800 text-zinc-400 border-zinc-700";
    }

    function statusLabel(status: string) {
        if (status === "picked") return "PICKED";
        if (status === "on_clock") return "ON CLOCK";
        if (status === "skipped") return "SKIPPED";
        return "WAITING";
    }

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
                <p className="text-zinc-400">
                    Loading board...
                </p>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-zinc-950 pb-24 text-white">
            <div className="mx-auto max-w-md px-4 py-6">
                <AppHeader />

                <header className="mb-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                        Week {weekNumber}
                    </p>

                    <h1 className="mt-2 text-3xl font-bold">
                        Draft Board
                    </h1>

                    <p className="mt-1 text-sm text-zinc-400">
                        Live order and pick status
                    </p>
                </header>

                {error && (
                    <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                        {error}
                    </div>
                )}

                <section className="space-y-3">
                    {rows.map((row) => (
                        <div
                            key={row.participant_id}
                            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs text-zinc-500">
                                        Pick #{row.turn_number}
                                    </p>

                                    <p className="font-bold">
                                        {row.participant_name}
                                    </p>
                                </div>

                                <span
                                    className={`rounded-full border px-2 py-1 text-[10px] font-bold ${statusStyle(
                                        row.turn_status
                                    )}`}
                                >
                                    {statusLabel(row.turn_status)}
                                </span>
                            </div>

                            {row.display_name && (
                                <p className="mt-3 text-sm font-semibold text-emerald-400">
                                    {row.display_name}
                                </p>
                            )}
                        </div>
                    ))}
                </section>
            </div>

            <nav className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
                <div className="mx-auto grid max-w-md grid-cols-4">
                    <Link
                        href="/"
                        className="py-4 text-center text-xs font-bold text-zinc-500"
                    >
                        Draft
                    </Link>

                    <Link
                        href="/board"
                        className="py-4 text-center text-xs font-bold text-emerald-400"
                    >
                        Board
                    </Link>

                    <Link
                        href="/standings"
                        className="py-4 text-center text-xs font-bold text-zinc-500"
                    >
                        Standings
                    </Link>

                    <Link
                        href="/my-pick"
                        className="py-4 text-center text-xs font-bold text-zinc-500"
                    >
                        My Pick
                    </Link>
                </div>
            </nav>
        </main>
    );
}