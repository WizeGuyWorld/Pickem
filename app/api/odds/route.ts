import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const sports = [
    {
        key: "americanfootball_nfl",
        league: "NFL",
    },
    {
        key: "americanfootball_ncaaf",
        league: "COLLEGE",
    },
];

export async function GET(request: NextRequest) {
    try {
        // 1. Require logged-in user
        const authorization = request.headers.get("authorization");

        if (!authorization?.startsWith("Bearer ")) {
            return NextResponse.json(
                { error: "Not signed in." },
                { status: 401 }
            );
        }

        const accessToken = authorization.replace("Bearer ", "");

        // 2. Verify the Supabase session
        const {
            data: { user },
            error: userError,
        } = await supabaseAdmin.auth.getUser(accessToken);

        if (userError || !user) {
            return NextResponse.json(
                { error: "Invalid login session." },
                { status: 401 }
            );
        }

        // 3. Verify commissioner/admin
        const { data: adminParticipant, error: adminError } =
            await supabaseAdmin
                .from("participants")
                .select("id")
                .eq("auth_user_id", user.id)
                .eq("is_admin", true)
                .maybeSingle();

        if (adminError || !adminParticipant) {
            return NextResponse.json(
                { error: "Admin access required." },
                { status: 403 }
            );
        }

        // 4. Make sure Odds API key exists
        const apiKey = process.env.ODDS_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: "ODDS_API_KEY is not configured." },
                { status: 500 }
            );
        }

        const allGames = [];

        // 5. Fetch NFL + College odds
        for (const sport of sports) {
            const url =
                `https://api.the-odds-api.com/v4/sports/` +
                `${sport.key}/odds/` +
                `?apiKey=${apiKey}` +
                `&regions=us` +
                `&markets=spreads,totals` +
                `&oddsFormat=american`;

            const response = await fetch(url, {
                cache: "no-store",
            });

            if (!response.ok) {
                const errorText = await response.text();

                throw new Error(
                    `Odds API error for ${sport.league}: ${errorText}`
                );
            }

            const games = await response.json();

            for (const game of games) {
                const bookmakers = game.bookmakers ?? [];

                if (bookmakers.length === 0) {
                    continue;
                }

                // Prefer Caesars when available
                const bookmaker =
                    bookmakers.find(
                        (book: any) => book.key === "caesars"
                    ) ?? bookmakers[0];

                const spreadMarket = bookmaker.markets?.find(
                    (market: any) => market.key === "spreads"
                );

                const totalMarket = bookmaker.markets?.find(
                    (market: any) => market.key === "totals"
                );

                const awaySpreadOutcome =
                    spreadMarket?.outcomes?.find(
                        (outcome: any) =>
                            outcome.name === game.away_team
                    );

                const homeSpreadOutcome =
                    spreadMarket?.outcomes?.find(
                        (outcome: any) =>
                            outcome.name === game.home_team
                    );

                const overOutcome =
                    totalMarket?.outcomes?.find(
                        (outcome: any) => outcome.name === "Over"
                    );

                allGames.push({
                    external_id: game.id,
                    league: sport.league,
                    away_team: game.away_team,
                    home_team: game.home_team,
                    commence_time: game.commence_time,

                    bookmaker: bookmaker.title,
                    bookmaker_key: bookmaker.key,

                    away_spread:
                        awaySpreadOutcome?.point ?? null,

                    home_spread:
                        homeSpreadOutcome?.point ?? null,

                    total:
                        overOutcome?.point ?? null,
                });
            }
        }

        allGames.sort(
            (a, b) =>
                new Date(a.commence_time).getTime() -
                new Date(b.commence_time).getTime()
        );

        return NextResponse.json({
            games: allGames,
        });
    } catch (error) {
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unable to load odds.",
            },
            { status: 500 }
        );
    }
}