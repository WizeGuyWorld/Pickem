import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    // 1. Read the logged-in user's access token
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Not signed in." },
        { status: 401 }
      );
    }

    const accessToken = authorization.replace("Bearer ", "");

    // 2. Verify the authenticated user
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

    // 3. Make sure this user is an admin
    const { data: adminParticipant, error: adminError } =
      await supabaseAdmin
        .from("participants")
        .select("id, is_admin")
        .eq("auth_user_id", user.id)
        .eq("is_admin", true)
        .maybeSingle();

    if (adminError || !adminParticipant) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    // 4. Get participant being reset
    const body = await request.json();
    const participantId = Number(body.participantId);

    if (!participantId) {
      return NextResponse.json(
        { error: "Participant is required." },
        { status: 400 }
      );
    }

    const { data: participant, error: participantError } =
      await supabaseAdmin
        .from("participants")
        .select("id, name, email, auth_user_id, is_admin")
        .eq("id", participantId)
        .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: "Participant not found." },
        { status: 404 }
      );
    }

    // Prevent accidentally deleting the commissioner login
    if (participant.is_admin) {
      return NextResponse.json(
        {
          error:
            "Admin accounts cannot be deleted from this control.",
        },
        { status: 400 }
      );
    }

    const authUserId = participant.auth_user_id;

    // 5. Clear participant link first
    const { error: unlinkError } = await supabaseAdmin
      .from("participants")
      .update({
        auth_user_id: null,
        email: null,
      })
      .eq("id", participant.id);

    if (unlinkError) {
      return NextResponse.json(
        { error: unlinkError.message },
        { status: 500 }
      );
    }

    // 6. Delete their Supabase Auth login
    if (authUserId) {
      const { error: deleteError } =
        await supabaseAdmin.auth.admin.deleteUser(authUserId);

      if (deleteError) {
        return NextResponse.json(
          {
            error:
              "Participant was unlinked, but the Auth account could not be deleted: " +
              deleteError.message,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `${participant.name}'s login was deleted and reset.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to reset participant login.",
      },
      { status: 500 }
    );
  }
}