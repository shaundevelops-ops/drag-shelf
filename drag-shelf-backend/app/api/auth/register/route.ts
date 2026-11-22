import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  let claimedInviteId: string | null = null;
  let createdUserId: string | null = null;

  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const displayName =
      typeof body.displayName === "string"
        ? body.displayName.trim()
        : "";

    const inviteCode =
      typeof body.inviteCode === "string"
        ? body.inviteCode.trim().toUpperCase()
        : "";

    // 1. Validate input
    if (!email || !password || !displayName || !inviteCode) {
      return NextResponse.json(
        { success: false, error: "All fields are required." },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: "Password must contain at least 8 characters.",
        },
        { status: 400 }
      );
    }

    if (!/^DRAGSHELF-[A-F0-9]{16}$/.test(inviteCode)) {
      return NextResponse.json(
        { success: false, error: "Invalid invitation code." },
        { status: 400 }
      );
    }

    // 2. Hash invitation code
    const codeHash = createHash("sha256")
      .update(inviteCode)
      .digest("hex");

    // 3. Find invitation
    const { data: invite, error: inviteError } =
      await supabaseAdmin
        .from("beta_invites")
        .select("id, expires_at")
        .eq("code_hash", codeHash)
        .eq("is_used", false)
        .maybeSingle();

    if (inviteError) {
  console.error("INVITE DATABASE ERROR:", inviteError);

  return NextResponse.json(
    {
      success: false,
      error: "Invitation lookup failed.",
      debug: {
        code: inviteError.code,
        message: inviteError.message,
      },
    },
    { status: 500 }
  );
}

if (!invite) {
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

    // 4. Claim invitation atomically
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

    claimedInviteId = invite.id;

    // 5. Create Supabase account without email verification
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          beta_tester: true,
        },
      });

    if (authError || !authData.user) {
      console.error("BETA ACCOUNT CREATION ERROR:", authError);

      throw new Error("ACCOUNT_CREATION_FAILED");
    }

    createdUserId = authData.user.id;

    // 6. Grant 60 days of Pro beta access
    const accessDays = Number(process.env.BETA_ACCESS_DAYS || 60);

    if (!Number.isInteger(accessDays) || accessDays <= 0) {
      throw new Error("INVALID_BETA_ACCESS_DAYS");
    }

    const startsAt = new Date();
    const expiresAt = new Date(
      startsAt.getTime() + accessDays * 24 * 60 * 60 * 1000
    );

    const { error: accessError } = await supabaseAdmin
      .from("beta_access")
      .upsert(
        {
          user_id: createdUserId,
          plan_id: "pro",
          status: "active",
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

    if (accessError) {
      console.error("BETA ACCESS CREATION ERROR:", accessError);

      throw new Error("BETA_ACCESS_FAILED");
    }

    // 7. Record redeemed user
    const { error: redemptionError } = await supabaseAdmin
      .from("beta_invites")
      .update({
        redeemed_by: createdUserId,
      })
      .eq("id", invite.id);

    if (redemptionError) {
      console.error("INVITE REDEMPTION UPDATE ERROR:", redemptionError);

      throw new Error("INVITE_REDEMPTION_FAILED");
    }

    // 8. Success
    return NextResponse.json({
      success: true,
      message: "Your Drag Shelf Beta account has been created!",
      user: {
        id: createdUserId,
        email,
        displayName,
      },
      beta: {
        plan: "pro",
        accessDays,
        expiresAt: expiresAt.toISOString(),
      },
    });

  } catch (error) {
    console.error("BETA REGISTRATION ERROR:", error);

    // Roll back account if registration failed after creation
    if (createdUserId) {
      const { error: deleteError } =
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);

      if (deleteError) {
        console.error("ACCOUNT ROLLBACK ERROR:", deleteError);
      }
    }

    // Release invitation if registration failed
    if (claimedInviteId) {
      const { error: releaseError } = await supabaseAdmin
        .from("beta_invites")
        .update({
          is_used: false,
          invited_email: null,
          redeemed_at: null,
          redeemed_by: null,
        })
        .eq("id", claimedInviteId);

      if (releaseError) {
        console.error("INVITE ROLLBACK ERROR:", releaseError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Registration failed. Please try again.",
      },
      { status: 500 }
    );
  }
}