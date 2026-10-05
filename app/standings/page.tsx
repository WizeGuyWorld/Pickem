"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/AppHeader";

type Standing = {
    participant_id: number;
    name: string;
    wins: number;
    losses: number;
    pushes: number;
    current_losing_streak: number;
    total_penalties: number;
    current_rank: number;
};

type Financials = {
    active_participants: number;
    participation_fees: number;
    total_penalty_money: number;
    penalty_money_to_prize_pool: number;
    total_prize_pool: number;
    projected_first_place: number;
    projected_second_place: number;
    projected_third_place: number;
};

export default function StandingsPage() {
    const [standings, setStandings] = useState<Standing[]>([]);
    const [financials, setFinancials] = useState<Financials | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        loadStandings();
    }, []);

    async function loadStandings() {
        setLoading(true);
        setError("");

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (user) {
                const { data: participant } = await supabase
                    .from("participants")
                    .select("is_admin")
                    .eq("auth_user_id", user.id)
                    .maybeSingle();

                setIsAdmin(Boolean(participant?.is_admin));
            }

            const { data: standingsData, error: standingsError } =
                await supabase
                    .from("standings_full")
                    .select("*")
                    .order("current_rank")
                    .order("name");

            if (standingsError) {
                throw new Error(standingsError.message);
            }

            const { data: financialData, error: financialError } =
                await supabase
                    .from("competition_financials")
                    .select("*")
                    .single();

            if (financialError) {
                throw new Error(financialError.message);
            }

            setStandings((standingsData as Standing[]) ?? []);
            setFinancials(financialData as Financials);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load standings."
            );
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
                <p className="text-zinc-400">Loading standings...</p>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-zinc-950 pb-24 text-white">
            <div className="mx-auto max-w-md px-4 py-6">
                <AppHeader /> 
                <header className="mb-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                        Season
                    </p>

                    <h1 className="mt-2 text-3xl font-bold">
                        Standings
                    </h1>

                    <p className="mt-1 text-sm text-zinc-400">
                        Record, penalties, and projected payouts
                    </p>
                </header>

                {error && (
                    <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                        {error}
                    </div>
                )}

                {financials && (
                    <section className="mb-6 rounded-3xl border border-emerald-500/20 bg-zinc-900 p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                            Current Prize Pool
                        </p>

                        <p className="mt-2 text-4xl font-bold text-emerald-400">
                            ${Number(financials.total_prize_pool).toFixed(2)}
                        </p>

                        <div className="mt-5 grid grid-cols-3 gap-3">
                            <div className="rounded-2xl bg-zinc-950 p-3">
                                <p className="text-xs text-zinc-500">1st</p>
                                <p className="mt-1 font-bold">
                                    ${Number(financials.projected_first_place).toFixed(2)}
                                </p>
                            </div>

                            <div className="rounded-2xl bg-zinc-950 p-3">
                                <p className="text-xs text-zinc-500">2nd</p>
                                <p className="mt-1 font-bold">
                                    ${Number(financials.projected_second_place).toFixed(2)}
                                </p>
                            </div>

                            <div className="rounded-2xl bg-zinc-950 p-3">
                                <p className="text-xs text-zinc-500">3rd</p>
                                <p className="mt-1 font-bold">
                                    ${Number(financials.projected_third_place).toFixed(2)}
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 border-t border-zinc-800 pt-4 text-sm text-zinc-400">
                            {isAdmin ? (
                                <>
                                    <p>
                                        Penalties collected: $
                                        {Number(financials.total_penalty_money).toFixed(2)}
                                    </p>

                                    <p className="mt-1">
                                        75% penalty contribution: $
                                        {Number(
                                            financials.penalty_money_to_prize_pool
                                        ).toFixed(2)}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p>
                                        Entry fees: $
                                        {Number(financials.participation_fees).toFixed(2)}
                                    </p>

                                    <p className="mt-1">
                                        Penalty contribution: $
                                        {Number(
                                            financials.penalty_money_to_prize_pool
                                        ).toFixed(2)}
                                    </p>
                                </>
                            )}
                        </div>
                    </section>
                )}

                <section className="space-y-3">
                    {standings.map((standing) => (
                        <div
                            key={standing.participant_id}
                            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 font-bold">
                                        {standing.current_rank}
                                    </div>

                                    <div>
                                        <p className="font-bold">{standing.name}</p>

                                        <p className="mt-1 text-sm text-zinc-400">
                                            {standing.wins}-{standing.losses}
                                            {standing.pushes > 0
                                                ? ` • ${standing.pushes} push`
                                                : ""}
                                        </p>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="font-bold text-red-400">
                                        ${Number(standing.total_penalties).toFixed(2)}
                                    </p>
                                    <p className="text-xs text-zinc-500">
                                        penalties
                                    </p>
                                </div>
                            </div>

                            {standing.current_losing_streak > 0 && (
                                <p className="mt-3 text-xs text-yellow-400">
                                    Current non-win streak: {standing.current_losing_streak}
                                </p>
                            )}
                        </div>
                    ))}
                </section>
            </div>

            <nav className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
                <div className="mx-auto grid max-w-md grid-cols-4">
                    <Link href="/" className="py-4 text-center text-xs font-bold text-zinc-500">
                        Draft
                    </Link>

                    <Link href="/board" className="py-4 text-center text-xs font-bold text-zinc-500">
                        Board
                    </Link>

                    <Link href="/standings" className="py-4 text-center text-xs font-bold text-emerald-400">
                        Standings
                    </Link>

                    <Link href="/my-pick" className="py-4 text-center text-xs font-bold text-zinc-500">
                        My Pick
                    </Link>
                </div>
            </nav>
        </main>
    );
}