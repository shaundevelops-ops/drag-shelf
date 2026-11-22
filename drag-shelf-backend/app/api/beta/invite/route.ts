import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const inviteCode =
      typeof body.inviteCode === "string"
        ? body.inviteCode.trim().toUpperCase()
        : "";

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^DRAGSHELF-[A-F0-9]{16}$/.test(inviteCode)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Enter a valid email and invitation code.",
        },
        { status: 400 }
      );
    }

    // Hash the invitation code
    const codeHash = createHash("sha256")
      .update(inviteCode)
      .digest("hex");

    // Check invitation
    const { data: invite, error: inviteError } =
      await supabaseAdmin
        .from("beta_invites")
        .select("*")
        .eq("code_hash", codeHash)
        .eq("is_used", false)
        .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or already-used invitation code.",
        },
        { status: 400 }
      );
    }

    if (
      invite.expires_at &&
      new Date(invite.expires_at) <= new Date()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "This invitation has expired.",
        },
        { status: 400 }
      );
    }

    // Reserve the code atomically before sending the invitation.
    const { data: claimedInvite, error: claimError } =
      await supabaseAdmin
        .from("beta_invites")
        .update({
          is_used: true,
          invited_email: email,
          redeemed_at: new Date().toISOString(),
        })
        .eq("id", invite.id)
        .eq("is_used", false)
        .select("id")
        .maybeSingle();

    if (claimError || !claimedInvite) {
      return NextResponse.json(
        {
          success: false,
          error: "This invitation has already been claimed.",
        },
        { status: 409 }
      );
    }

    // Send invitation email
    const { data, error: authError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/set-password`,
          data: {
            beta_tester: true,
          },
        }
      );

    if (authError || !data.user) {
      // Release code if invitation fails
      await supabaseAdmin
        .from("beta_invites")
        .update({
          is_used: false,
          invited_email: null,
          redeemed_at: null,
        })
        .eq("id", invite.id);

      console.error("BETA INVITATION ERROR:", authError);

      return NextResponse.json(
        {
          success: false,
          error: "Unable to send invitation. Please try again.",
        },
        { status: 500 }
      );
    }

    const accessDays = Number(
      process.env.BETA_ACCESS_DAYS || 60
    );

    const expiresAt = new Date();

    expiresAt.setDate(
      expiresAt.getDate() + accessDays
    );

    // Create beta entitlement
    const { error: accessError } = await supabaseAdmin
      .from("beta_access")
      .upsert(
        {
          user_id: data.user.id,
          plan_id: "pro",
          status: "active",
          starts_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

    if (accessError) {
      console.error("BETA ACCESS ERROR:", accessError);

      return NextResponse.json(
        {
          success: false,
          error: "Invitation sent, but beta access setup needs attention.",
        },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("beta_invites")
      .update({
        redeemed_by: data.user.id,
      })
      .eq("id", invite.id);

    return NextResponse.json({
      success: true,
      message: "Your Drag Shelf Beta invitation has been sent!",
    });
  } catch (error) {
    console.error("BETA INVITE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong.",
      },
      { status: 500 }
    );
  }
}