"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/AppHeader";
import Link from "next/link";

type MyPick = {
    id: number;
    pick_status: string;
    picked_at: string;
    selections: {
        display_name: string;
        games: {
            away_team: string;
            home_team: string;
            game_time: string | null;
            league: string;
        };
    };
};

export default function MyPickPage() {
    const router = useRouter();

    const [pick, setPick] = useState<MyPick | null>(null);
    const [participantName, setParticipantName] = useState("");
    const [weekNumber, setWeekNumber] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        loadMyPick();
    }, []);

    async function loadMyPick() {
        setLoading(true);
        setError("");

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                router.replace("/login");
                return;
            }

            const { data: participant, error: participantError } =
                await supabase
                    .from("participants")
                    .select("id, name")
                    .eq("auth_user_id", user.id)
                    .single();

            if (participantError || !participant) {
                throw new Error("Participant account not found.");
            }

            setParticipantName(participant.name);

            const { data: week, error: weekError } = await supabase
                .from("weeks")
                .select("id, week_number")
                .eq("is_active", true)
                .single();

            if (weekError || !week) {
                throw new Error("No active week found.");
            }

            setWeekNumber(week.week_number);

            const { data: pickData, error: pickError } = await supabase
                .from("picks")
                .select(`
          id,
          pick_status,
          picked_at,
          selections (
            display_name,
            games (
              away_team,
              home_team,
              game_time,
              league
            )
          )
        `)
                .eq("week_id", week.id)
                .eq("participant_id", participant.id)
                .maybeSingle();

            if (pickError) {
                throw new Error(pickError.message);
            }

            setPick((pickData as MyPick | null) ?? null);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load your pick."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-zinc-950 text-white">
            <AppHeader />

            <div className="mx-auto max-w-xl px-4 py-6 pb-24">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
                    Week {weekNumber ?? "-"}
                </p>

                <h1 className="mt-2 text-3xl font-bold">
                    My Pick
                </h1>

                <p className="mt-1 text-sm text-zinc-500">
                    {participantName}
                </p>

                {loading && (
                    <p className="mt-6 text-zinc-400">
                        Loading your pick...
                    </p>
                )}

                {error && (
                    <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                        {error}
                    </div>
                )}

                {!loading && !error && !pick && (
                    <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                        <p className="font-bold">
                            No pick locked yet.
                        </p>

                        <p className="mt-2 text-sm text-zinc-500">
                            Your Week {weekNumber} selection will appear here after you make your pick.
                        </p>
                    </div>
                )}

                {!loading && pick && (
                    <div className="mt-6 rounded-3xl border border-emerald-500/30 bg-zinc-900 p-5">
                        <div className="flex items-center justify-between gap-3">
                            <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs font-bold text-emerald-400">
                                {pick.selections.games.league}
                            </span>

                            <span className="text-xs font-bold uppercase text-zinc-500">
                                {pick.pick_status}
                            </span>
                        </div>

                        <h2 className="mt-4 text-xl font-bold">
                            {pick.selections.display_name}
                        </h2>

                        <p className="mt-2 text-sm text-zinc-400">
                            {pick.selections.games.away_team} @{" "}
                            {pick.selections.games.home_team}
                        </p>

                        {pick.selections.games.game_time && (
                            <p className="mt-2 text-sm text-zinc-500">
                                {new Date(
                                    pick.selections.games.game_time
                                ).toLocaleString([], {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                })}
                            </p>
                        )}
                    </div>
                )}
            </div>
            <nav className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
                <div className="mx-auto grid max-w-xl grid-cols-4">
                    <Link
                        href="/"
                        className="px-3 py-4 text-center text-xs font-bold text-zinc-400"
                    >
                        Draft
                    </Link>

                    <Link
                        href="/board"
                        className="px-3 py-4 text-center text-xs font-bold text-zinc-400"
                    >
                        Board
                    </Link>

                    <Link
                        href="/standings"
                        className="px-3 py-4 text-center text-xs font-bold text-zinc-400"
                    >
                        Standings
                    </Link>

                    <Link
                        href="/my-pick"
                        className="border-t-2 border-emerald-500 px-3 py-4 text-center text-xs font-bold text-emerald-400"
                    >
                        My Pick
                    </Link>
                </div>
            </nav>
        </main>
    );
}