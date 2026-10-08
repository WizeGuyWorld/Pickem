"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";

type Week = {
    id: number;
    week_number: number;
    status: string;
    reveal_pick_names: boolean;
};

type Turn = {
    participant_id: number;
    turn_number: number;
    status: string;
    started_at: string | null;
    expires_at: string | null;
    participants: {
        name: string;
    } | null;
};

type LockedPick = {
    id: number;
    participant_id: number;
    pick_status: string;
    participants: {
        name: string;
    } | null;
    selections: {
        display_name: string;
    } | null;
};

type WeekOption = {
    id: number;
    week_number: number;
    status: string;
    is_active: boolean;
};

type OddsGame = {
    external_id: string;
    league: string;
    away_team: string;
    home_team: string;
    commence_time: string;
    bookmaker: string;
    away_spread: number | null;
    home_spread: number | null;
    total: number | null;
};

type ImportedGame = {
    id: number;
    away_team: string;
    home_team: string;
    league: string;
    external_id: string | null;
    game_time: string | null;
};

type InviteParticipant = {
    id: number;
    name: string;
    email: string | null;
    auth_user_id: string | null;
    is_admin: boolean;
};

type AdminPickParticipant = {
    participant_id: number;
    turn_number: number;
    status: string;
    participants: {
        name: string;
    } | null;
};

type AdminPickSelection = {
    selection_id: number;
    display_name: string;
    league: string;
    away_team: string;
    home_team: string;
    game_time: string | null;
};

export default function AdminPage() {
    const [week, setWeek] = useState<Week | null>(null);
    const [turns, setTurns] = useState<Turn[]>([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [league, setLeague] = useState("NFL");
    const [awayTeam, setAwayTeam] = useState("");
    const [homeTeam, setHomeTeam] = useState("");
    const [awaySpread, setAwaySpread] = useState("");
    const [homeSpread, setHomeSpread] = useState("");
    const [total, setTotal] = useState("");
    const [gameTime, setGameTime] = useState("");
    const [lockedPicks, setLockedPicks] = useState<LockedPick[]>([]);
    const router = useRouter();
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [weeks, setWeeks] = useState<WeekOption[]>([]);
    const [newWeekNumber, setNewWeekNumber] = useState("");
    const [oddsGames, setOddsGames] = useState<OddsGame[]>([]);
    const [selectedOddsGames, setSelectedOddsGames] = useState<string[]>([]);
    const [oddsLoading, setOddsLoading] = useState(false);
    const [oddsLeagueFilter, setOddsLeagueFilter] = useState("ALL");
    const [oddsDateFilter, setOddsDateFilter] = useState("");
    const [importedGames, setImportedGames] = useState<ImportedGame[]>([]);
    const [inviteParticipants, setInviteParticipants] = useState<InviteParticipant[]>([]);
    const [inviteParticipantId, setInviteParticipantId] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteLoading, setInviteLoading] = useState(false);
    const [adminPickParticipants, setAdminPickParticipants] = useState<
        AdminPickParticipant[]
    >([]);

    const [adminPickSelections, setAdminPickSelections] = useState<
        AdminPickSelection[]
    >([]);

    const [adminPickParticipantId, setAdminPickParticipantId] = useState("");
    const [adminPickSelectionId, setAdminPickSelectionId] = useState("");
    const [adminPickSubmitting, setAdminPickSubmitting] = useState(false);
    const [adminWeekId, setAdminWeekId] = useState<number | null>(null);
    const selectedAdminWeek =
        weeks.find((item) => item.id === adminWeekId) ?? week;

    const onClock = turns.find(
        (turn) => turn.status === "on_clock"
    );

    const filteredOddsGames = oddsGames.filter((game) => {
        const leagueMatches =
            oddsLeagueFilter === "ALL" ||
            game.league === oddsLeagueFilter;

        const dateMatches =
            !oddsDateFilter ||
            new Date(game.commence_time)
                .toISOString()
                .startsWith(oddsDateFilter);


        return leagueMatches && dateMatches;
    });

    useEffect(() => {
        loadAdmin();
    }, []);

    async function loadAdmin(selectedWeekId?: number) {
        setLoading(true);
        setError("");

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user) {
                setAuthorized(false);
                router.replace("/login");
                return;
            }

            const { data: adminParticipant, error: adminError } =
                await supabase
                    .from("participants")
                    .select("id, name, is_admin")
                    .eq("auth_user_id", user.id)
                    .single();

            if (adminError || !adminParticipant?.is_admin) {
                setAuthorized(false);
                router.replace("/");
                return;
            }

            setAuthorized(true);

            // -----------------------------------------
            // LOAD THE PUBLIC / LIVE WEEK
            // -----------------------------------------

            const { data: weekData, error: weekError } =
                await supabase
                    .from("weeks")
                    .select(
                        "id, week_number, status, reveal_pick_names, is_active"
                    )
                    .eq("is_active", true)
                    .single();

            if (weekError || !weekData) {
                throw new Error(
                    weekError?.message ??
                    "Active week could not be loaded."
                );
            }

            // Keep this as the actual public/live week
            setWeek(weekData as Week);

            // -----------------------------------------
            // LOAD ALL WEEKS
            // -----------------------------------------

            const { data: weeksData, error: weeksError } =
                await supabase
                    .from("weeks")
                    .select(
                        "id, week_number, status, is_active"
                    )
                    .order("week_number");

            if (weeksError) {
                throw new Error(weeksError.message);
            }

            const loadedWeeks =
                (weeksData as WeekOption[]) ?? [];

            setWeeks(loadedWeeks);

            // -----------------------------------------
            // DECIDE WHICH WEEK ADMIN IS EDITING
            // -----------------------------------------

            const effectiveAdminWeekId =
                selectedWeekId ??
                adminWeekId ??
                weekData.id;

            const adminWeek =
                loadedWeeks.find(
                    (item) =>
                        item.id === effectiveAdminWeekId
                ) ??
                loadedWeeks.find(
                    (item) => item.id === weekData.id
                );

            if (!adminWeek) {
                throw new Error(
                    "Admin week could not be loaded."
                );
            }

            setAdminWeekId(adminWeek.id);

            // -----------------------------------------
            // ADMIN PICK PARTICIPANTS
            // -----------------------------------------

            const {
                data: adminTurnData,
                error: adminTurnError,
            } = await supabase
                .from("draft_turns")
                .select(`
                participant_id,
                turn_number,
                status,
                participants (
                    name
                )
            `)
                .eq("week_id", adminWeek.id)
                .order("turn_number");

            if (adminTurnError) {
                throw new Error(adminTurnError.message);
            }

            setAdminPickParticipants(
                (adminTurnData as unknown as AdminPickParticipant[]) ??
                []
            );

            // -----------------------------------------
            // AVAILABLE SELECTIONS FOR ADMIN PICK ENTRY
            // -----------------------------------------

            const {
                data: availableSelectionData,
                error: availableSelectionError,
            } = await supabase.rpc(
                "admin_get_available_selections",
                {
                    p_week_id: adminWeek.id,
                }
            );

            if (availableSelectionError) {
                throw new Error(
                    availableSelectionError.message
                );
            }

            setAdminPickSelections(
                (availableSelectionData as AdminPickSelection[]) ??
                []
            );

            // -----------------------------------------
            // DRAFT TURNS FOR SELECTED ADMIN WEEK
            // -----------------------------------------

            const { data: turnData, error: turnError } =
                await supabase
                    .from("draft_turns")
                    .select(`
                    participant_id,
                    turn_number,
                    status,
                    started_at,
                    expires_at,
                    participants (
                        name
                    )
                `)
                    .eq("week_id", adminWeek.id)
                    .order("turn_number");

            if (turnError) {
                throw new Error(turnError.message);
            }

            setTurns(
                (turnData as unknown as Turn[]) ?? []
            );

            // -----------------------------------------
            // PICKS FOR SELECTED ADMIN WEEK
            // -----------------------------------------

            const { data: pickData, error: pickError } =
                await supabase
                    .from("picks")
                    .select(`
                    id,
                    participant_id,
                    pick_status,
                    participants (
                        name
                    ),
                    selections (
                        display_name
                    )
                `)
                    .eq("week_id", adminWeek.id)
                    .order("id");

            if (pickError) {
                throw new Error(pickError.message);
            }

            setLockedPicks(
                (pickData as unknown as LockedPick[]) ?? []
            );

            // -----------------------------------------
            // PARTICIPANT INVITES
            // -----------------------------------------

            const {
                data: inviteData,
                error: inviteError,
            } = await supabase
                .from("participants")
                .select(
                    "id, name, email, auth_user_id, is_admin"
                )
                .eq("active", true)
                .order("draft_position");

            if (inviteError) {
                throw new Error(inviteError.message);
            }

            setInviteParticipants(
                (inviteData as InviteParticipant[]) ?? []
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load admin page."
            );
        } finally {
            setLoading(false);
        }
    }

    async function startDraft() {
        if (!week) return;

        setWorking(true);
        setMessage("");
        setError("");

        const { error } = await supabase.rpc(
            "start_week_draft",
            {
                p_week_id: week.id,
            }
        );

        if (error) {
            setError(error.message);
        } else {
            setMessage("Draft started.");
            await loadAdmin();
        }

        setWorking(false);
    }

    async function toggleReveal() {
        if (!week) return;

        setWorking(true);
        setMessage("");
        setError("");

        const newValue = !week.reveal_pick_names;

        const { error } = await supabase.rpc(
            "admin_set_reveal_pick_names",
            {
                p_week_id: week.id,
                p_reveal: newValue,
            }
        );

        if (error) {
            setError(error.message);
        } else {
            setMessage(
                newValue
                    ? "Pick names are now visible."
                    : "Pick names are now hidden."
            );

            await loadAdmin();
        }

        setWorking(false);
    }

    async function resetClock() {
        if (!week) return;

        setWorking(true);
        setMessage("");
        setError("");

        const { error } = await supabase.rpc(
            "admin_reset_turn_clock",
            {
                p_week_id: week.id,
            }
        );

        if (error) {
            setError(error.message);
        } else {
            setMessage("15-minute clock reset.");
            await loadAdmin();
        }

        setWorking(false);
    }

    async function forceSkip() {
        if (!week) return;

        const confirmed = window.confirm(
            `Skip ${onClock?.participants?.name ?? "the current participant"}?`
        );

        if (!confirmed) return;

        setWorking(true);
        setMessage("");
        setError("");

        const { error } = await supabase.rpc(
            "admin_force_skip",
            {
                p_week_id: week.id,
            }
        );

        if (error) {
            setError(error.message);
        } else {
            setMessage("Participant skipped.");
            await loadAdmin();
        }

        setWorking(false);
    }

    async function addGame() {
        if (
            !awayTeam ||
            !homeTeam ||
            !awaySpread ||
            !homeSpread ||
            !selectedAdminWeek ||
            !total
        ) {
            setError("Please fill in all game and line fields.");
            return;
        }

        setWorking(true);
        setMessage("");
        setError("");

        const { error } = await supabase.rpc("add_game_with_lines", {
            p_week_number: selectedAdminWeek.week_number,
            p_league: league,
            p_away_team: awayTeam,
            p_home_team: homeTeam,
            p_away_spread: Number(awaySpread),
            p_home_spread: Number(homeSpread),
            p_total: Number(total),
            p_game_time: gameTime
                ? new Date(gameTime).toISOString()
                : null,
        });

        if (error) {
            setError(error.message);
        } else {
            setMessage(
                `${awayTeam} @ ${homeTeam} added to Week ${selectedAdminWeek.week_number}.`
            );

            setAwayTeam("");
            setHomeTeam("");
            setAwaySpread("");
            setHomeSpread("");
            setTotal("");
            setGameTime("");

            await loadAdmin(selectedAdminWeek.id);
        }

        setWorking(false);
    }

    async function setPickResult(
        pickId: number,
        result: "win" | "loss" | "push"
    ) {
        setWorking(true);
        setMessage("");
        setError("");

        const { error } = await supabase.rpc(
            "admin_set_pick_result",
            {
                p_pick_id: pickId,
                p_result: result,
            }
        );

        if (error) {
            setError(error.message);
        } else {
            setMessage(`Result updated to ${result.toUpperCase()}.`);
            await loadAdmin();
        }

        setWorking(false);
    }

    async function createNextWeek() {
        const highestWeek = weeks.length
            ? Math.max(...weeks.map((w) => w.week_number))
            : 0;

        const nextWeek = highestWeek + 1;

        setWorking(true);
        setMessage("");
        setError("");

        const { data, error } = await supabase.rpc("create_week_draft", {
            p_week_number: nextWeek,
            p_week_name: `Week ${nextWeek}`,
            p_draft_date: null,
        });

        if (error) {
            setError(error.message);
            setWorking(false);
            return;
        }

        setMessage(`Week ${nextWeek} created.`);
        await loadAdmin();
        setWorking(false);
    }

    async function setActiveWeek(weekId: number) {
        setWorking(true);
        setMessage("");
        setError("");

        const { error } = await supabase.rpc("admin_set_active_week", {
            p_week_id: weekId,
        });

        if (error) {
            setError(error.message);
        } else {
            setMessage("Active week changed.");
            await loadAdmin();
        }

        setWorking(false);
    }

    async function closeWeek() {
        if (!week) return;

        const confirmed = window.confirm(
            `Close Week ${week.week_number}?\n\nNo more picks will be allowed for this week.`
        );

        if (!confirmed) return;

        setWorking(true);
        setMessage("");
        setError("");

        const { error } = await supabase.rpc(
            "admin_close_week",
            {
                p_week_id: week.id,
            }
        );

        if (error) {
            setError(error.message);
        } else {
            setMessage(`Week ${week.week_number} is now complete.`);
            await loadAdmin();
        }

        setWorking(false);
    }

    async function rolloverWeek() {
        if (!week) return;

        const confirmed = window.confirm(
            `Move from Week ${week.week_number} to Week ${week.week_number + 1}?`
        );

        if (!confirmed) return;

        setWorking(true);
        setMessage("");
        setError("");

        const { error } = await supabase.rpc(
            "admin_rollover_week"
        );

        if (error) {
            setError(error.message);
        } else {
            setMessage("Next week created and made active.");
            await loadAdmin();
        }

        setWorking(false);
    }

    async function refreshOdds() {
        setOddsLoading(true);
        setMessage("");
        setError("");

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session) {
                throw new Error("You are not signed in.");
            }

            const response = await fetch("/api/odds", {
                cache: "no-store",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ?? "Unable to load odds."
                );
            }

            setOddsGames(data.games ?? []);
            setSelectedOddsGames([]);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to refresh odds."
            );
        } finally {
            setOddsLoading(false);
        }
    }

    function toggleOddsGame(externalId: string) {
        setSelectedOddsGames((current) =>
            current.includes(externalId)
                ? current.filter((id) => id !== externalId)
                : [...current, externalId]
        );
    }

    async function importSelectedOdds() {
        if (!selectedAdminWeek) return;

        const adminWeek = selectedAdminWeek;

        const selected = oddsGames.filter((game) =>
            selectedOddsGames.includes(game.external_id)
        );

        if (selected.length === 0) {
            setError("Select at least one game.");
            return;
        }

        setWorking(true);
        setMessage("");
        setError("");

        let imported = 0;

        try {
            for (const game of selected) {
                if (
                    game.away_spread === null ||
                    game.home_spread === null ||
                    game.total === null
                ) {
                    continue;
                }

                const { error } = await supabase.rpc(
                    "admin_import_odds_game",
                    {
                        p_week_id: adminWeek.id,
                        p_external_id: game.external_id,
                        p_league: game.league,
                        p_away_team: game.away_team,
                        p_home_team: game.home_team,
                        p_away_spread: game.away_spread,
                        p_home_spread: game.home_spread,
                        p_total: game.total,
                        p_game_time: game.commence_time,
                    }
                );

                if (error) {
                    throw new Error(
                        `${game.away_team} @ ${game.home_team}: ${error.message}`
                    );
                }

                imported++;
            }

            setMessage(
                `${imported} game(s) imported into Week ${adminWeek.week_number}.`
            );
            setSelectedOddsGames([]);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to import odds."
            );
        } finally {
            setWorking(false);
        }
    }

    async function refreshImportedLines() {
        if (!selectedAdminWeek) return;

        const adminWeek = selectedAdminWeek;

        if (adminWeek.status !== "setup") {
            setError("Lines are frozen after the draft starts.");
            return;
        }

        setWorking(true);
        setMessage("");
        setError("");

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session) {
                throw new Error("You are not signed in.");
            }

            const response = await fetch("/api/odds", {
                cache: "no-store",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ?? "Unable to refresh odds."
                );
            }

            const freshGames = (data.games ?? []) as OddsGame[];

            const { data: importedGameData, error: importedGameError } =
                await supabase
                    .from("games")
                    .select("id, away_team, home_team, league, external_id, game_time")
                    .eq("week_id", adminWeek.id)
                    .order("game_time", { ascending: true });

            if (importedGameError) {
                throw new Error(importedGameError.message);
            }

            setImportedGames(
                (importedGameData as ImportedGame[]) ?? []
            );

            async function removeGame(gameId: number) {
                const confirmed = window.confirm(
                    "Remove this game from the active week?"
                );

                if (!confirmed) return;

                setWorking(true);
                setError("");
                setMessage("");

                const { error } = await supabase.rpc(
                    "admin_remove_game",
                    {
                        p_game_id: gameId,
                    }
                );

                if (error) {
                    setError(error.message);
                } else {
                    setMessage("Game removed.");
                    await loadAdmin();
                }

                setWorking(false);
            }

            let updated = 0;

            for (const imported of importedGames ?? []) {
                const fresh = freshGames.find(
                    (game) => game.external_id === imported.external_id
                );

                if (!fresh) continue;

                if (
                    fresh.away_spread === null ||
                    fresh.home_spread === null ||
                    fresh.total === null
                ) {
                    continue;
                }

                const { error } = await supabase.rpc(
                    "admin_refresh_odds_game",
                    {
                        p_week_id: adminWeek.id,
                        p_external_id: fresh.external_id,
                        p_away_spread: fresh.away_spread,
                        p_home_spread: fresh.home_spread,
                        p_total: fresh.total,
                        p_game_time: fresh.commence_time,
                    }
                );

                if (error) {
                    throw new Error(
                        `${fresh.away_team} @ ${fresh.home_team}: ${error.message}`
                    );
                }

                updated++;
            }

            setMessage(`${updated} imported game(s) refreshed.`);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to refresh imported lines."
            );
        } finally {
            setWorking(false);
        }
    }

    async function importAllFilteredOdds() {
        if (!selectedAdminWeek) return;

        const adminWeek = selectedAdminWeek;

        const importableGames = filteredOddsGames.filter(
            (game) =>
                game.away_spread !== null &&
                game.home_spread !== null &&
                game.total !== null
        );

        if (importableGames.length === 0) {
            setError("No complete games are available to import.");
            return;
        }

        const confirmed = window.confirm(
            `Import all ${importableGames.length} currently filtered games into Week ${adminWeek.week_number}?`
        );

        if (!confirmed) return;

        setWorking(true);
        setMessage("");
        setError("");

        let imported = 0;
        let skipped = 0;

        try {
            for (const game of importableGames) {
                const { error } = await supabase.rpc(
                    "admin_import_odds_game",
                    {
                        p_week_id: adminWeek.id,
                        p_external_id: game.external_id,
                        p_league: game.league,
                        p_away_team: game.away_team,
                        p_home_team: game.home_team,
                        p_away_spread: game.away_spread,
                        p_home_spread: game.home_spread,
                        p_total: game.total,
                        p_game_time: game.commence_time,
                    }
                );

                if (error) {
                    if (
                        error.message
                            .toLowerCase()
                            .includes("already been imported")
                    ) {
                        skipped++;
                        continue;
                    }

                    throw new Error(
                        `${game.away_team} @ ${game.home_team}: ${error.message}`
                    );
                }

                imported++;
            }

            setMessage(
                `${imported} game(s) imported into Week ${adminWeek.week_number}.`
            );

            await loadAdmin();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to import all games."
            );
        } finally {
            setWorking(false);
        }
    }

    async function sendParticipantInvite() {
        if (!inviteParticipantId || !inviteEmail) {
            setError("Choose a participant and enter an email.");
            return;
        }

        setInviteLoading(true);
        setMessage("");
        setError("");

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session) {
                throw new Error("You are not signed in.");
            }

            const response = await fetch(
                "/api/invite-participant",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        participantId: Number(inviteParticipantId),
                        email: inviteEmail,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ?? "Unable to send invite."
                );
            }

            setMessage(data.message ?? "Invite sent.");
            setInviteEmail("");
            setInviteParticipantId("");

            await loadAdmin();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to send invite."
            );
        } finally {
            setInviteLoading(false);
        }
    }

    async function unlinkParticipant(
        participantId: number,
        participantName: string
    ) {
        const confirmed = window.confirm(
            `Unlink ${participantName} from their login account?`
        );

        if (!confirmed) return;

        setWorking(true);
        setError("");
        setMessage("");

        const { error } = await supabase.rpc(
            "admin_unlink_participant",
            {
                p_participant_id: participantId,
            }
        );

        if (error) {
            setError(error.message);
        } else {
            setMessage(`${participantName} has been unlinked.`);
            await loadAdmin();
        }

        setWorking(false);
    }

    async function adminSubmitParticipantPick() {
        if (!selectedAdminWeek) return;

        if (!adminPickParticipantId) {
            setError("Choose a participant.");
            return;
        }

        if (!adminPickSelectionId) {
            setError("Choose a selection.");
            return;
        }

        const participant = adminPickParticipants.find(
            (item) =>
                item.participant_id === Number(adminPickParticipantId)
        );

        const selection = adminPickSelections.find(
            (item) =>
                item.selection_id === Number(adminPickSelectionId)
        );

        if (!participant || !selection) {
            setError("Participant or selection could not be found.");
            return;
        }

        const participantName =
            participant.participants?.name ?? "Participant";

        const isHistorical =
            selectedAdminWeek.status !== "drafting";

        const confirmed = window.confirm(
            isHistorical
                ? `Change Week ${selectedAdminWeek.week_number} pick for ${participantName} to ${selection.display_name}?`
                : `Lock ${selection.display_name} for ${participantName}?`
        );

        if (!confirmed) return;

        setAdminPickSubmitting(true);
        setError("");
        setMessage("");

        try {
            let rpcError;

            if (isHistorical) {
                const { error } = await supabase.rpc(
                    "admin_correct_participant_pick",
                    {
                        p_week_id: selectedAdminWeek.id,
                        p_participant_id: Number(adminPickParticipantId),
                        p_selection_id: Number(adminPickSelectionId),
                    }
                );

                rpcError = error;
            } else {
                const { error } = await supabase.rpc(
                    "admin_lock_pick_for_participant",
                    {
                        p_week_id: selectedAdminWeek.id,
                        p_participant_id: Number(adminPickParticipantId),
                        p_selection_id: Number(adminPickSelectionId),
                    }
                );

                rpcError = error;
            }

            if (rpcError) {
                throw new Error(rpcError.message);
            }

            setMessage(
                isHistorical
                    ? `Week ${selectedAdminWeek.week_number} pick updated for ${participantName}. Enter the correct result below.`
                    : `${selection.display_name} locked for ${participantName}.`
            );

            setAdminPickParticipantId("");
            setAdminPickSelectionId("");

            await loadAdmin(selectedAdminWeek.id);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to update participant pick."
            );
        } finally {
            setAdminPickSubmitting(false);
        }
    }

    async function deleteParticipantLogin(
        participantId: number,
        participantName: string
    ) {
        const confirmed = window.confirm(
            `Completely reset ${participantName}'s login?\n\n` +
            "This will unlink the participant and delete their Supabase login. " +
            "You will then be able to send them a fresh invite."
        );

        if (!confirmed) return;

        setWorking(true);
        setMessage("");
        setError("");

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session) {
                throw new Error("You are not signed in.");
            }

            const response = await fetch(
                "/api/delete-participant-login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        participantId,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ?? "Unable to reset participant login."
                );
            }

            setMessage(
                data.message ??
                `${participantName}'s login has been reset.`
            );

            await loadAdmin();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to reset participant login."
            );
        } finally {
            setWorking(false);
        }
    }

    if (loading || authorized === null) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
                <p className="text-zinc-400">
                    Loading admin...
                </p>
            </main>
        );
    }

    if (authorized === false) {
        return null;
    }

    return (
        <main className="min-h-screen bg-zinc-950 pb-24 text-white">
            <div className="mx-auto max-w-7x1 px-4 py-6">
                <AppHeader /> 
                <header className="mb-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                        Commissioner
                    </p>

                    <h1 className="mt-2 text-3xl font-bold">
                        Admin
                    </h1>

                    <p className="mt-1 text-sm text-zinc-400">
                        Editing Week {selectedAdminWeek?.week_number}
                        {selectedAdminWeek?.id === week?.id ? " - LIVE" : ""}
                    </p>
                </header>

                {error && (
                    <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                        {message}
                    </div>
                )}

                <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                        Participant Invites
                    </p>

                    <div className="mt-4 space-y-3">
                        <select
                            value={inviteParticipantId}
                            onChange={(e) => setInviteParticipantId(e.target.value)}
                            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-white"
                        >
                            <option value="">Choose participant</option>

                            {inviteParticipants.map((participant) => (
                                <option
                                    key={participant.id}
                                    value={participant.id}
                                    disabled={Boolean(participant.auth_user_id)}
                                >
                                    {participant.name}
                                    {participant.auth_user_id ? " - linked" : ""}
                                </option>
                            ))}
                        </select>

                        <input
                            type="email"
                            placeholder="Participant email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-white"
                        />

                        <button
                            onClick={sendParticipantInvite}
                            disabled={inviteLoading}
                            className="w-full rounded-2xl bg-emerald-500 py-3 font-bold text-black disabled:opacity-50"
                        >
                            {inviteLoading ? "Sending..." : "Send Invite"}
                        </button>
                    </div>



                    {inviteParticipants.map((participant) => (
                        <div
                            key={participant.id}
                            className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                        >
                            <div>
                                <p className="font-bold">{participant.name}</p>

                                <p className="mt-1 text-xs text-zinc-500">
                                    {participant.auth_user_id
                                        ? participant.email ?? "Linked"
                                        : "Not linked"}
                                </p>
                            </div>

                            {participant.auth_user_id && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() =>
                                            unlinkParticipant(
                                                participant.id,
                                                participant.name
                                            )
                                        }
                                        disabled={working}
                                        className="rounded-xl bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-400 disabled:opacity-50"
                                    >
                                        Unlink
                                    </button>

                                    {!participant.is_admin && (
                                        <button
                                            onClick={() =>
                                                deleteParticipantLogin(
                                                    participant.id,
                                                    participant.name
                                                )
                                            }
                                            disabled={working}
                                            className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 disabled:opacity-50"
                                        >
                                            Reset Login
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    
                </section>

                <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                        Admin Week
                    </p>

                    <p className="mt-2 text-sm text-zinc-400">
                        Choose a week to edit. This does not change the public active week.
                    </p>

                    <select
                        value={adminWeekId ?? ""}
                        onChange={(e) => {
                            const id = Number(e.target.value);
                            setAdminWeekId(id);
                            loadAdmin(id);
                        }}
                        className="mt-4 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-white"
                    >
                        {weeks.map((item) => (
                            <option key={item.id} value={item.id}>
                                Week {item.week_number}
                                {item.is_active ? " - LIVE" : ""}
                            </option>
                        ))}
                    </select>
                </section>

                <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                        Week Management
                    </p>

                    <div className="mt-4 space-y-3">
                        {weeks.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-3"
                            >
                                <div>
                                    <p className="font-bold">
                                        Week {item.week_number}
                                    </p>

                                    <p className="text-xs text-zinc-500">
                                        {item.status.toUpperCase()}
                                    </p>
                                </div>

                                {item.is_active ? (
                                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                                        ACTIVE
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => setActiveWeek(item.id)}
                                        disabled={working}
                                        className="rounded-xl bg-zinc-800 px-3 py-2 text-xs font-bold text-zinc-300"
                                    >
                                        Make Active
                                    </button>
                                )}
                            </div>
                        ))}

                        <button
                            onClick={createNextWeek}
                            disabled={working}
                            className="w-full rounded-2xl bg-emerald-500 py-3 font-bold text-black disabled:opacity-50"
                        >
                            Create Next Week
                        </button>
                    </div>
                </section>

                <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                        Week Status
                    </p>

                    <div className="mt-3 flex items-center justify-between">
                        <div>
                            <p className="text-xl font-bold">
                                Week {week?.week_number}
                            </p>

                            <p className="mt-1 text-sm text-zinc-400">
                                Status: {week?.status?.toUpperCase()}
                            </p>
                        </div>

                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                            {week?.status?.toUpperCase()}
                        </span>
                    </div>

                    <button
                        onClick={startDraft}
                        disabled={working || week?.status !== "setup"}
                        className="mt-5 w-full rounded-2xl bg-emerald-500 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-30"
                    >
                        {working
                            ? "Working..."
                            : week?.status === "setup"
                                ? "Start Week 6 Draft / Clock"
                                : "Draft Already Started"}
                    </button>

                    {week?.status === "drafting" && (
                        <button
                            onClick={closeWeek}
                            disabled={working}
                            className="mt-3 w-full rounded-2xl border border-red-500/30 bg-red-500/10 py-3 font-bold text-red-400 disabled:opacity-50"
                        >
                            Close Week
                        </button>
                    )}

                    {week?.status === "complete" && (
                        <div className="mt-4 rounded-2xl bg-zinc-950 p-3 text-center text-sm font-bold text-zinc-400">
                            WEEK COMPLETE
                        </div>
                    )}

                    {week?.status === "complete" && (
                        <button
                            onClick={rolloverWeek}
                            disabled={working}
                            className="mt-3 w-full rounded-2xl bg-emerald-500 py-3 font-bold text-black disabled:opacity-50"
                        >
                            Start Next Week Setup
                        </button>
                    )}
                </section>

                <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                        On The Clock
                    </p>

                    {onClock ? (
                        <>
                            <h2 className="mt-3 text-2xl font-bold">
                                {onClock.participants?.name}
                            </h2>

                            <p className="mt-1 text-sm text-zinc-400">
                                Pick #{onClock.turn_number}
                            </p>

                            <div className="mt-5 grid grid-cols-2 gap-3">
                                <button
                                    onClick={resetClock}
                                    disabled={working}
                                    className="rounded-2xl bg-zinc-800 px-3 py-3 font-bold text-white disabled:opacity-50"
                                >
                                    Reset 15 Min
                                </button>

                                <button
                                    onClick={forceSkip}
                                    disabled={working}
                                    className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-3 font-bold text-red-400 disabled:opacity-50"
                                >
                                    Force Skip
                                </button>
                            </div>
                        </>
                    ) : (
                        <p className="mt-3 text-zinc-500">
                            Nobody is currently on the clock.
                        </p>
                    )}
                </section>

                <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold">
                                Reveal Pick Names
                            </p>

                            <p className="mt-1 text-sm text-zinc-500">
                                Show who selected each line
                            </p>
                        </div>

                        <button
                            onClick={toggleReveal}
                            disabled={working}
                            className={`rounded-full px-4 py-2 text-sm font-bold ${week?.reveal_pick_names
                                    ? "bg-emerald-500 text-black"
                                    : "bg-zinc-800 text-zinc-300"
                                }`}
                        >
                            {week?.reveal_pick_names ? "ON" : "OFF"}
                        </button>
                    </div>
                </section>

                <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                                Live Odds
                            </p>

                            <p className="mt-1 text-sm text-zinc-400">
                                NFL + College
                            </p>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <select
                                value={oddsLeagueFilter}
                                onChange={(e) => setOddsLeagueFilter(e.target.value)}
                                className="rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-white"
                            >
                                <option value="ALL">All</option>
                                <option value="NFL">NFL</option>
                                <option value="COLLEGE">College</option>
                            </select>

                            <input
                                type="date"
                                value={oddsDateFilter}
                                onChange={(e) => setOddsDateFilter(e.target.value)}
                                className="rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-white"
                            />
                        </div>

                        <button
                            onClick={refreshOdds}
                            disabled={oddsLoading || working}
                            className="rounded-xl bg-zinc-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                        >
                            {oddsLoading ? "Loading..." : "Refresh Odds"}
                        </button>
                    </div>

                    {oddsGames.length > 0 && (
                        <>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {filteredOddsGames.map((game) => {
                                    const selected = selectedOddsGames.includes(
                                        game.external_id
                                    );

                                    const complete =
                                        game.away_spread !== null &&
                                        game.home_spread !== null &&
                                        game.total !== null;

                                    return (
                                        <button
                                            key={game.external_id}
                                            type="button"
                                            disabled={!complete}
                                            onClick={() =>
                                                toggleOddsGame(game.external_id)
                                            }
                                            className={`w-full rounded-2xl border p-4 text-left ${selected
                                                    ? "border-emerald-500 bg-emerald-500/10"
                                                    : "border-zinc-800 bg-zinc-950"
                                                } ${!complete
                                                    ? "cursor-not-allowed opacity-40"
                                                    : ""
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <span className="text-xs font-bold text-emerald-400">
                                                        {game.league}
                                                    </span>

                                                    <p className="mt-1 font-bold">
                                                        {game.away_team} @ {game.home_team}
                                                    </p>

                                                    <p className="mt-1 text-xs text-zinc-500">
                                                        {new Date(
                                                            game.commence_time
                                                        ).toLocaleString()}
                                                    </p>
                                                </div>

                                                <div
                                                    className={`h-5 w-5 rounded-full border ${selected
                                                            ? "border-emerald-500 bg-emerald-500"
                                                            : "border-zinc-600"
                                                        }`}
                                                />
                                            </div>

                                            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                                                <div className="rounded-xl bg-zinc-900 p-2">
                                                    <p className="text-xs text-zinc-500">
                                                        Away
                                                    </p>
                                                    <p className="font-bold">
                                                        {game.away_spread !== null &&
                                                            game.away_spread > 0
                                                            ? "+"
                                                            : ""}
                                                        {game.away_spread ?? "-"}
                                                    </p>
                                                </div>

                                                <div className="rounded-xl bg-zinc-900 p-2">
                                                    <p className="text-xs text-zinc-500">
                                                        Home
                                                    </p>
                                                    <p className="font-bold">
                                                        {game.home_spread !== null &&
                                                            game.home_spread > 0
                                                            ? "+"
                                                            : ""}
                                                        {game.home_spread ?? "-"}
                                                    </p>
                                                </div>

                                                <div className="rounded-xl bg-zinc-900 p-2">
                                                    <p className="text-xs text-zinc-500">
                                                        Total
                                                    </p>
                                                    <p className="font-bold">
                                                        {game.total ?? "-"}
                                                    </p>
                                                </div>
                                            </div>

                                            <p className="mt-3 text-xs text-zinc-600">
                                                Source: {game.bookmaker}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={importSelectedOdds}
                                disabled={
                                    working ||
                                    selectedOddsGames.length === 0 ||
                                    week?.status !== "setup"
                                }
                                className="mt-4 w-full rounded-2xl bg-emerald-500 py-3 font-bold text-black disabled:opacity-40"
                            >
                                Import Selected ({selectedOddsGames.length})
                            </button>

                            <button
                                onClick={importAllFilteredOdds}
                                disabled={
                                    working ||
                                    filteredOddsGames.length === 0 ||
                                    week?.status !== "setup"
                                }
                                className="mt-3 w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 py-3 font-bold text-emerald-400 disabled:opacity-40"
                            >
                                Import All Filtered ({filteredOddsGames.length})
                            </button>

                            <button
                                onClick={refreshImportedLines}
                                disabled={working || week?.status !== "setup"}
                                className="mt-3 w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 py-3 font-bold text-emerald-400 disabled:opacity-40"
                            >
                                Refresh Imported Lines
                            </button>

                            {week?.status !== "setup" && (
                                <p className="mt-2 text-center text-xs text-yellow-400">
                                    Odds imports are locked after the draft starts.
                                </p>
                            )}
                        </>
                    )}
                </section>

                <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                        Add Game
                    </p>

                    <div className="mt-4 space-y-3">
                        <select
                            value={league}
                            onChange={(e) => setLeague(e.target.value)}
                            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-white"
                        >
                            <option value="NFL">NFL</option>
                            <option value="COLLEGE">College</option>
                        </select>

                        <input
                            type="text"
                            placeholder="Away team"
                            value={awayTeam}
                            onChange={(e) => setAwayTeam(e.target.value)}
                            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-white"
                        />

                        <input
                            type="text"
                            placeholder="Home team"
                            value={homeTeam}
                            onChange={(e) => setHomeTeam(e.target.value)}
                            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-white"
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <input
                                type="number"
                                step="0.5"
                                placeholder="Away spread"
                                value={awaySpread}
                                onChange={(e) => setAwaySpread(e.target.value)}
                                className="rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-white"
                            />

                            <input
                                type="number"
                                step="0.5"
                                placeholder="Home spread"
                                value={homeSpread}
                                onChange={(e) => setHomeSpread(e.target.value)}
                                className="rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-white"
                            />
                        </div>

                        <input
                            type="number"
                            step="0.5"
                            placeholder="Game total"
                            value={total}
                            onChange={(e) => setTotal(e.target.value)}
                            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-white"
                        />

                        <input
                            type="datetime-local"
                            value={gameTime}
                            onChange={(e) => setGameTime(e.target.value)}
                            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-white"
                        />

                        <button
                            onClick={addGame}
                            disabled={working}
                            className="w-full rounded-2xl bg-emerald-500 py-3 font-bold text-black disabled:opacity-50"
                        >
                            Add Game + 4 Picks
                        </button>
                    </div>
                </section>

                <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                            Commissioner Pick Entry
                        </p>

                        <p className="mt-2 text-sm text-zinc-400">
                            Enter a pick for the participant on the clock or a skipped participant.
                        </p>
                    </div>

                    <div className="mt-5 space-y-4">
                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
                                Participant
                            </label>

                            <select
                                value={adminPickParticipantId}
                                onChange={(e) =>
                                    setAdminPickParticipantId(e.target.value)
                                }
                                className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-white"
                            >
                                <option value="">
                                    Choose participant
                                </option>

                                {adminPickParticipants
                                    .filter((participant) => {
                                        if (selectedAdminWeek?.status !== "drafting") {
                                            return true;
                                        }

                                        return (
                                            participant.status === "on_clock" ||
                                            participant.status === "skipped"
                                        );
                                    })
                                    .map((participant) => (
                                        <option
                                            key={participant.participant_id}
                                            value={participant.participant_id}
                                        >
                                            {participant.participants?.name ??
                                                "Participant"}{" "}
                                             {" "}
                                            {participant.status === "on_clock"
                                                ? "ON CLOCK"
                                                : "SKIPPED / MAKEUP"}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-zinc-500">
                                Selection
                            </label>

                            <select
                                value={adminPickSelectionId}
                                onChange={(e) =>
                                    setAdminPickSelectionId(e.target.value)
                                }
                                className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-white"
                            >
                                <option value="">
                                    Choose available selection
                                </option>

                                {adminPickSelections.map((selection) => (
                                    <option
                                        key={selection.selection_id}
                                        value={selection.selection_id}
                                    >
                                        {selection.league} |{" "}
                                        {selection.away_team} @{" "}
                                        {selection.home_team} |{" "}
                                        {selection.display_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={adminSubmitParticipantPick}
                            disabled={
                                adminPickSubmitting ||
                                !selectedAdminWeek ||
                                !adminPickParticipantId ||
                                !adminPickSelectionId
                            }
                            className="w-full rounded-2xl bg-emerald-500 py-3 font-bold text-black disabled:opacity-40"
                        >
                            {adminPickSubmitting
                                ? "Saving Pick..."
                                : selectedAdminWeek?.status === "drafting"
                                    ? "Lock Pick for Participant"
                                    : "Update Historical Pick"}
                        </button>

                        {selectedAdminWeek?.status !== "drafting" && (
                            <p className="text-center text-xs text-yellow-400">
                                Historical correction mode. Changing a pick will clear its old result so you can enter the correct result below.
                            </p>
                        )}
                    </div>
                </section>

                <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                        Enter Results
                    </p>

                    <div className="mt-4 space-y-4">
                        {lockedPicks.length === 0 && (
                            <p className="text-sm text-zinc-500">
                                No locked picks yet.
                            </p>
                        )}

                        {lockedPicks.map((pick) => (
                            <div
                                key={pick.id}
                                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                            >
                                <p className="font-bold">
                                    {pick.participants?.name}
                                </p>

                                <p className="mt-1 text-sm text-zinc-400">
                                    {pick.selections?.display_name}
                                </p>

                                <p className="mt-2 text-xs font-bold uppercase text-zinc-500">
                                    Current: {pick.pick_status}
                                </p>

                                <div className="mt-4 grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => setPickResult(pick.id, "win")}
                                        disabled={working}
                                        className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-400 disabled:opacity-50"
                                    >
                                        Win
                                    </button>

                                    <button
                                        onClick={() => setPickResult(pick.id, "loss")}
                                        disabled={working}
                                        className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-bold text-red-400 disabled:opacity-50"
                                    >
                                        Loss
                                    </button>

                                    <button
                                        onClick={() => setPickResult(pick.id, "push")}
                                        disabled={working}
                                        className="rounded-xl bg-yellow-500/10 px-3 py-2 text-sm font-bold text-yellow-400 disabled:opacity-50"
                                    >
                                        Push
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                        Draft Progress
                    </p>

                    <div className="mt-4 space-y-3">
                        {turns.map((turn) => (
                            <div
                                key={turn.participant_id}
                                className="flex items-center justify-between border-b border-zinc-800 pb-3 last:border-0"
                            >
                                <div>
                                    <p className="font-semibold">
                                        #{turn.turn_number}{" "}
                                        {turn.participants?.name}
                                    </p>
                                </div>

                                <span className="text-xs font-bold uppercase text-zinc-500">
                                    {turn.status.replace("_", " ")}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                        Imported Games
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {importedGames.map((game) => (
                            <div
                                key={game.id}
                                className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-bold text-emerald-400">
                                        {game.league}
                                    </p>

                                    <p className="text-sm font-bold text-white">
                                        {game.game_time
                                            ? new Date(game.game_time).toLocaleString([], {
                                                weekday: "short",
                                                hour: "numeric",
                                                minute: "2-digit",
                                            })
                                            : "NO TIME"}
                                    </p>
                                </div>

                                <h3 className="mt-2 font-bold">
                                    {game.away_team} @ {game.home_team}
                                </h3>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <div className="fixed bottom-4 right-4">
                <Link
                    href="/"
                    className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-bold text-black shadow-lg"
                >
                    Back to Draft
                </Link>
            </div>
        </main>
    );
}