import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";


export async function GET() {
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

    // 2. Fetch the user's active subscription
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
           {
             success: false,
             error: subscriptionError.message,
             code: subscriptionError.code,
             details: subscriptionError.details,
             hint: subscriptionError.hint,
           },
           { status: 500 }
       );
    }

    // 3. Resolve the plan
    // Fall back to Free if no active subscription exists.
    const planId = subscription?.plan_id || "free";

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
      console.error("Plan error:", planError);

      return NextResponse.json(
        { success: false, error: "Plan configuration unavailable" },
        { status: 500 }
      );
    }

    // 4. Count activated devices
    const { count: deviceCount, error: deviceError } =
      await supabase
        .from("devices")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("revoked_at", null);

    if (deviceError) {
      console.error("Device error:", deviceError);

      return NextResponse.json(
        { success: false, error: "Unable to load device information" },
        { status: 500 }
      );
    }

    // 5. Prepare entitlement response
    const response = {
      success: true,

      account: {
        id: user.id,
        email: user.email,
        displayName: user.user_metadata?.display_name || null,
      },

      subscription: {
        id: subscription?.id || null,
        status: subscription?.status || "active",
        billingCycle: subscription?.billing_cycle || null,
        currentPeriodStart: subscription?.current_period_start || null,
        currentPeriodEnd: subscription?.current_period_end || null,
        cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
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
    console.error("Entitlements API error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}