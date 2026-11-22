import { NextResponse } from "next/server";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  await connection();

  try {
    const supabase = await createClient();

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date().toISOString();

    // 2. Check active beta access
    const { data: betaAccess, error: betaError } = await supabase
      .from("beta_access")
      .select("id, plan_id, status, starts_at, expires_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("expires_at", now)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (betaError) {
      console.error("BETA ACCESS ERROR:", betaError);

      return NextResponse.json(
        { success: false, error: "Unable to verify account access" },
        { status: 500 }
      );
    }

    // 3. Fetch normal subscription
    const { data: subscription, error: subscriptionError } =
      await supabase
        .from("subscriptions")
        .select(`
          id,
          plan_id,
          status,
          billing_cycle,
          current_period_start,
          current_period_end,
          cancel_at_period_end
        `)
        .eq("user_id", user.id)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (subscriptionError) {
      console.error("SUBSCRIPTION ERROR:", subscriptionError);

      return NextResponse.json(
        { success: false, error: "Unable to load subscription information" },
        { status: 500 }
      );
    }

    // 4. Resolve entitlement priority
    const isBetaUser = !!betaAccess;

    const planId = isBetaUser
      ? betaAccess.plan_id
      : subscription?.plan_id || "free";

    // 5. Fetch applicable plan
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select(`
        id,
        name,
        max_items,
        max_collections,
        max_devices,
        monthly_price_paise,
        yearly_price_paise,
        full_previews,
        advanced_thumbnails,
        browser_extension,
        cloud_sync,
        priority_support
      `)
      .eq("id", planId)
      .eq("active", true)
      .single();

    if (planError || !plan) {
      console.error("PLAN ERROR:", planError);

      return NextResponse.json(
        { success: false, error: "Plan configuration unavailable" },
        { status: 500 }
      );
    }

    // 6. Count activated devices
    const { count: deviceCount, error: deviceError } =
      await supabase
        .from("devices")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("revoked_at", null);

    if (deviceError) {
      console.error("DEVICE ERROR:", deviceError);

      return NextResponse.json(
        { success: false, error: "Unable to load device information" },
        { status: 500 }
      );
    }

    // 7. Prepare entitlement response
    const response = {
      success: true,

      account: {
        id: user.id,
        email: user.email,
        displayName: user.user_metadata?.display_name || null,
      },

      entitlement: {
        source: isBetaUser ? "beta" : subscription ? "subscription" : "free",
        isBetaUser,
        betaExpiresAt: isBetaUser ? betaAccess.expires_at : null,
      },

      subscription: {
        id: isBetaUser
          ? betaAccess.id
          : subscription?.id || null,

        status: isBetaUser
          ? "active"
          : subscription?.status || "active",

        billingCycle: isBetaUser
          ? "beta"
          : subscription?.billing_cycle || null,

        currentPeriodStart: isBetaUser
          ? betaAccess.starts_at
          : subscription?.current_period_start || null,

        currentPeriodEnd: isBetaUser
          ? betaAccess.expires_at
          : subscription?.current_period_end || null,

        cancelAtPeriodEnd: isBetaUser
          ? false
          : subscription?.cancel_at_period_end || false,
      },

      plan: {
        id: plan.id,
        name: plan.name,
        monthlyPricePaise: plan.monthly_price_paise,
        yearlyPricePaise: plan.yearly_price_paise,
      },

      limits: {
        maxItems: plan.max_items,
        maxCollections: plan.max_collections,
        maxDevices: plan.max_devices,
      },

      usage: {
        activeDevices: deviceCount || 0,
      },

      features: {
        fullPreviews: plan.full_previews,
        advancedThumbnails: plan.advanced_thumbnails,
        browserExtension: plan.browser_extension,
        cloudSync: plan.cloud_sync,
        prioritySupport: plan.priority_support,
      },
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });

  } catch (error) {
    console.error("ENTITLEMENTS API ERROR:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}