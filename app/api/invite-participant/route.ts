import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
    try {
        const authorization = request.headers.get("authorization");

        if (!authorization?.startsWith("Bearer ")) {
            return NextResponse.json(
                { error: "Not signed in." },
                { status: 401 }
            );
        }

        const accessToken = authorization.replace("Bearer ", "");

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

        const body = await request.json();

        const participantId = Number(body.participantId);
        const email = String(body.email ?? "")
            .trim()
            .toLowerCase();

        if (!participantId || !email) {
            return NextResponse.json(
                { error: "Participant and email are required." },
                { status: 400 }
            );
        }

        const { data: participant, error: participantError } =
            await supabaseAdmin
                .from("participants")
                .select("id, name, auth_user_id")
                .eq("id", participantId)
                .single();

        if (participantError || !participant) {
            return NextResponse.json(
                { error: "Participant not found." },
                { status: 404 }
            );
        }

        if (participant.auth_user_id) {
            return NextResponse.json(
                {
                    error:
                        "This participant is already linked to an account.",
                },
                { status: 400 }
            );
        }

        const { data: inviteData, error: inviteError } =
            await supabaseAdmin.auth.admin.inviteUserByEmail(
                email,
                {
                    data: {
                        participant_id: participant.id,
                        participant_name: participant.name,
                    },
                    redirectTo:
                        "http://localhost:3000/set-password",
                }
            );

        if (inviteError || !inviteData.user) {
            return NextResponse.json(
                {
                    error:
                        inviteError?.message ??
                        "Unable to send invitation.",
                },
                { status: 400 }
            );
        }

        const { error: linkError } = await supabaseAdmin
            .from("participants")
            .update({
                email,
                auth_user_id: inviteData.user.id,
            })
            .eq("id", participant.id);

        if (linkError) {
            return NextResponse.json(
                {
                    error:
                        "Invite sent, but participant linking failed: " +
                        linkError.message,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Invite sent to ${email}.`,
        });
    } catch (error) {
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unable to invite participant.",
            },
            { status: 500 }
        );
    }
}