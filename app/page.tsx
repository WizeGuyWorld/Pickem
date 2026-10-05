"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/AppHeader";
import Link from "next/link";

type Selection = {
    id: number;
    display_name: string;
};

type Game = {
    id: number;
    league: string;
    away_team: string;
    home_team: string;
    selections: Selection[];
    game_time: string | null;
};

type Pick = {
    selection_id: number;
    taken_by: string | null;
};

type Turn = {
    participant_id: number;
    turn_number: number;
    status: string;
    expires_at: string | null;
    participants: {
        name: string;
    } | null;
};

type CurrentParticipant = {
  id: number;
  name: string;
};

export default function Home() {
    const [games, setGames] = useState<Game[]>([]);
    const [picks, setPicks] = useState<Pick[]>([]);
    const [turns, setTurns] = useState<Turn[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("All");
    const [error, setError] = useState("");
    const [timeRemaining, setTimeRemaining] = useState("00:00");
    const [submittingPick, setSubmittingPick] = useState(false);
    const [revealPickNames, setRevealPickNames] = useState(false);
    const processedExpiration = useRef<string | null>(null);
    const [currentParticipant, setCurrentParticipant] =
        useState<CurrentParticipant | null>(null);
    const [weekId, setWeekId] = useState<number | null>(null);
    const [weekNumber, setWeekNumber] = useState<number | null>(null);

    useEffect(() => {
        loadDraft();
    }, []);

    async function loadDraft() {
        setLoading(true);
        setError("");

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                window.location.href = "/login";
                return;
            }

            const { data: participantData, error: participantError } =
                await supabase
                    .from("participants")
                    .select("id, name")
                    .eq("auth_user_id", user.id)
                    .single();

            if (participantError || !participantData) {
                throw new Error(
                    "Your login is not linked to a participant."
                );
            }

            setCurrentParticipant(
                participantData as CurrentParticipant
            );

            const { data: week, error: weekError } = await supabase
                .from("weeks")
                .select("id, week_number, reveal_pick_names")
                .eq("is_active", true)
                .single();

            if (weekError || !week) {
                throw new Error(
                    weekError?.message ?? "No active week found."
                );
            }

            setWeekId(week.id);
            setWeekNumber(week.week_number);
            setRevealPickNames(Boolean(week.reveal_pick_names));


            if (!week) {
                throw new Error("Week{weekNumber} was not returned.");
            }

            setRevealPickNames(Boolean(week.reveal_pick_names));

            const { data: gamesData, error: gamesError } = await supabase
                .from("games")
                .select(`
    id,
    week_id,
    league,
    away_team,
    home_team,
    game_time,
    selections (
      id,
      selection_type,
      team,
      line,
      display_name
    )
  `)
                .eq("week_id", week.id)
                .order("game_time", { ascending: true });

            if (gamesError) {
                throw new Error(`Games error: ${gamesError.message}`);
            }

            const { data: picksData, error: picksError } = await supabase.rpc(
                "get_week_taken_selections",
                {
                    p_week_id: week.id,
                }
            );

            if (picksError) {
                throw new Error(`Picks error: ${picksError.message}`);
            }

            const { data: turnsData, error: turnsError } = await supabase
                .from("draft_turns")
                .select(`
          participant_id,  
          turn_number,
          status,
          expires_at,
          participants (
            name
          )
        `)
                .eq("week_id", week.id)
                .order("turn_number");

            if (turnsError) {
                throw new Error(`Turns error: ${turnsError.message}`);
            }

            setGames((gamesData as Game[]) ?? []);
            setPicks((picksData as Pick[]) ?? []);
            setTurns((turnsData as unknown as Turn[]) ?? []);
        } catch (err) {
            console.error("LOAD DRAFT ERROR:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unknown error loading draft."
            );
        } finally {
            setLoading(false);
        }
    }

    const onClock = turns.find(
        (turn) => turn.status === "on_clock"
    );

    const myTurn = currentParticipant
        ? turns.find(
            (turn) =>
                turn.participant_id === currentParticipant.id
        )
        : undefined;

    const canMakeNormalPick =
        myTurn?.status === "on_clock";

    const canMakeMakeupPick =
        myTurn?.status === "skipped";

    const canMakePick =
        canMakeNormalPick || canMakeMakeupPick;

    useEffect(() => {
        if (!onClock?.expires_at) {
            setTimeRemaining("00:00");
            return;
        }

        let stopped = false;

        async function updateClock() {
            if (!onClock?.expires_at || stopped) return;

            const expiresAt = new Date(onClock.expires_at).getTime();
            const difference = Math.max(0, expiresAt - Date.now());
            const totalSeconds = Math.floor(difference / 1000);

            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;

            setTimeRemaining(
                `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
            );

            // Clock expired
            if (
                difference <= 0 &&
                processedExpiration.current !== onClock.expires_at
            ) {
                processedExpiration.current = onClock.expires_at;

                const { error: timeoutError } = await supabase.rpc(
                    "process_expired_turn",
                    {
                        p_week_id: weekId,
                    }
                );

                if (timeoutError) {
                    console.error("TIMEOUT ERROR:", timeoutError);
                    setError(`Timeout error: ${timeoutError.message}`);
                    return;
                }

                await loadDraft();
            }
        }

        updateClock();

        const timer = setInterval(updateClock, 1000);

        return () => {
            stopped = true;
            clearInterval(timer);
        };
    }, [onClock?.expires_at]);

    const nextTurn = turns.find(
        (turn) =>
            turn.status === "waiting" &&
            turn.turn_number >
            (onClock?.turn_number ?? 0)
    );

    const completedCount = turns.filter(
        (turn) => turn.status === "picked"
    ).length;

    const filteredGames = useMemo(() => {
        if (filter === "NFL") {
            return games.filter(
                (game) => game.league === "NFL"
            );
        }

        if (filter === "College") {
            return games.filter(
                (game) => game.league === "COLLEGE"
            );
        }

        if (filter === "Available") {
            return games.filter((game) =>
                game.selections.some(
                    (selection) =>
                        !picks.some(
                            (pick) =>
                                pick.selection_id === selection.id
                        )
                )
            );
        }

        return games;
    }, [games, picks, filter]);

    function getTakenBy(selectionId: number) {
        const pick = picks.find(
            (pick) => pick.selection_id === selectionId
        );

        if (!pick) {
            return null;
        }

        return pick.taken_by ?? "Taken";
    }

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
                <p className="text-zinc-400">
                    Loading draft...
                </p>
            </main>
        );
    }

    const gamesByDay = filteredGames.reduce<Record<string, Game[]>>(
        (groups, game) => {
            const key = game.game_time
                ? new Date(game.game_time).toLocaleDateString([], {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                })
                : "Time TBD";

            if (!groups[key]) {
                groups[key] = [];
            }

            groups[key].push(game);
            return groups;
        },
        {}
    );

    return (
        <main className="min-h-screen bg-zinc-950 pb-24 text-white">
            <div className="mx-auto max-w-7x1 px-4 py-6">
                <AppHeader />
                <header className="mb-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                        Week {weekNumber} Draft
                    </p>

                    <div className="mt-2 flex items-end justify-between">
                        <div>
                            <h1 className="text-3xl font-bold">
                                Pick Draft
                            </h1>

                            <p className="mt-1 text-sm text-zinc-400">
                                {completedCount} of 15 picks complete
                            </p>
                        </div>

                        <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-400">
                            LIVE
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                        {error}
                    </div>
                )}

                <section className="mb-6 rounded-3xl border border-emerald-500/20 bg-zinc-900 p-5 shadow-2xl">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                        On the clock
                    </p>

                    {onClock ? (
                        <>
                            <div className="mt-3 flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold">
                                        {onClock.participants?.name}
                                    </h2>

                                    <p className="text-sm text-zinc-400">
                                        Pick #{onClock.turn_number}
                                    </p>
                                </div>

                                <div className="text-right">
                                    <p
                                        className={`font-mono text-3xl font-bold ${timeRemaining === "00:00"
                                                ? "text-red-500"
                                                : "text-emerald-400"
                                            }`}
                                    >
                                        {timeRemaining}
                                    </p>

                                    <p className="text-xs text-zinc-500">
                                        remaining
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 border-t border-zinc-800 pt-4">
                                <p className="text-xs uppercase tracking-wider text-zinc-500">
                                    Up next
                                </p>

                                <p className="mt-1 font-semibold">
                                    {nextTurn?.participants?.name ??
                                        "No one"}
                                </p>
                            </div>
                        </>
                    ) : (
                        <p className="mt-3 text-zinc-400">
                            No participant is currently on the
                            clock.
                        </p>
                    )}
                </section>

                <div className="mb-5 grid grid-cols-4 gap-2 text-sm">
                    {[
                        "All",
                        "NFL",
                        "College",
                        "Available",
                    ].map((item) => (
                        <button
                            key={item}
                            onClick={() => setFilter(item)}
                            className={`rounded-xl px-3 py-2 font-semibold ${filter === item
                                    ? "bg-emerald-500 text-black"
                                    : "bg-zinc-900 text-zinc-300"
                                }`}
                        >
                            {item}
                        </button>
                    ))}
                </div>

                <div className="space-y-8">
                    {Object.entries(gamesByDay).map(([day, dayGames]) => (
                        <section key={day}>
                            <div className="mb-3 flex items-center gap-3">
                                <h2 className="text-lg font-bold text-white">
                                    {day}
                                </h2>

                                <div className="h-px flex-1 bg-zinc-800" />

                                <span className="text-xs text-zinc-500">
                                    {dayGames.length} game{dayGames.length === 1 ? "" : "s"}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {dayGames.map((game) => (
                                    <article
                                        key={game.id}
                                        className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4"
                                    >
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="rounded-full bg-zinc-800 px-2 py-1 text-[10px] font-bold tracking-widest text-zinc-400">
                                                    {game.league}
                                                </span>

                                                <span className="text-xs font-semibold text-zinc-400">
                                                    {game.game_time
                                                        ? new Date(game.game_time).toLocaleTimeString([], {
                                                            hour: "numeric",
                                                            minute: "2-digit",
                                                        })
                                                        : "Time TBD"}
                                                </span>
                                            </div>

                                            <h3 className="mt-3 text-lg font-bold">
                                                {game.away_team} @ {game.home_team}
                                            </h3>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            {game.selections.map((selection) => {
                                                const takenBy = getTakenBy(selection.id);

                                                return (
                                                    <button
                                                        key={selection.id}
                                                        onClick={() => submitPick(selection)}
                                                        disabled={
                                                            Boolean(takenBy) ||
                                                            submittingPick ||
                                                            !canMakePick
                                                        }
                                                        className={`min-h-20 rounded-2xl border p-3 text-left ${takenBy
                                                                ? "cursor-not-allowed border-zinc-800 bg-zinc-950 text-zinc-600"
                                                                : "border-zinc-700 bg-zinc-800 text-white hover:border-emerald-500"
                                                            }`}
                                                    >
                                                        <p className="font-bold">
                                                            {selection.display_name}
                                                        </p>

                                                        {takenBy ? (
                                                            <p className="mt-1 text-xs text-zinc-600">
                                                                {takenBy !== "Taken"
                                                                    ? `Taken by ${takenBy}`
                                                                    : "Taken"}
                                                            </p>
                                                        ) : canMakePick ? (
                                                            <p className="mt-1 text-xs text-emerald-400">
                                                                {canMakeMakeupPick
                                                                    ? "Tap for makeup pick"
                                                                    : "Tap to select"}
                                                            </p>
                                                        ) : (
                                                            <p className="mt-1 text-xs text-zinc-500">
                                                                Available
                                                            </p>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                {filteredGames.length === 0 && (
                    <p className="mt-10 text-center text-zinc-500">
                        No games found.
                    </p>
                )}
            </div>

            <nav className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
                <div className="mx-auto grid max-w-md grid-cols-4">
                    <Link
                        href="/"
                        className="py-4 text-center text-xs font-bold text-emerald-400"
                    >
                        Draft
                    </Link>

                    <Link
                        href="/board"
                        className="py-4 text-center text-xs font-bold text-zinc-500"
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
    async function submitPick(selection: Selection) {
        if (!currentParticipant) {
            setError("Your account is not linked to a participant.");
            return;
        }

        if (!canMakePick) {
            setError(
                "You cannot make a pick right now."
            );
            return;
        }

        const isMakeup = canMakeMakeupPick;

        const confirmed = window.confirm(
            `${currentParticipant.name}, confirm your pick:\n\n` +
            `${selection.display_name}\n\n` +
            `${isMakeup ? "MAKEUP PICK" : "REGULAR PICK"}\n\n` +
            `This pick will be locked.`
        );

        if (!confirmed) return;

        setSubmittingPick(true);
        setError("");

        const { error: pickError } = await supabase.rpc(
            "lock_pick",
            {
                p_week_id: weekId,
                p_participant_id: currentParticipant.id,
                p_selection_id: selection.id,
                p_is_makeup: isMakeup,
            }
        );

        if (pickError) {
            setError(`Pick error: ${pickError.message}`);
            setSubmittingPick(false);
            return;
        }

        await loadDraft();
        setSubmittingPick(false);
    }
}