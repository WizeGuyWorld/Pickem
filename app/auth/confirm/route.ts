import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);

    const token_hash = requestUrl.searchParams.get("token_hash");
    const type = requestUrl.searchParams.get("type");

    if (!token_hash || !type) {
        return NextResponse.redirect(
            new URL("/login?error=invalid_invite", request.url)
        );
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options);
                        });
                    } catch {
                        // Ignore cookie errors during server rendering
                    }
                },
            },
        }
    );

    const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as
            | "invite"
            | "signup"
            | "magiclink"
            | "recovery"
            | "email_change",
    });

    if (error) {
        console.error("Invite verification error:", error.message);

        return NextResponse.redirect(
            new URL(
                `/login?error=${encodeURIComponent(error.message)}`,
                request.url
            )
        );
    }

    if (type === "invite") {
        return NextResponse.redirect(
            new URL("/set-password", request.url)
        );
    }

    if (type === "recovery") {
        return NextResponse.redirect(
            new URL("/reset-password", request.url)
        );
    }

    return NextResponse.redirect(
        new URL("/", request.url)
    );
}