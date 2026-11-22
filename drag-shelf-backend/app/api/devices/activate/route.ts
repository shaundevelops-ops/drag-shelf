import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authorization.slice(7);

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const fingerprint = body.deviceFingerprintHash;
    const deviceName = body.deviceName;
    const appVersion = body.appVersion;

    if (
      typeof fingerprint !== "string" ||
      typeof deviceName !== "string" ||
      typeof appVersion !== "string"
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid request data" },
        { status: 400 }
      );
    }

    if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
      return NextResponse.json(
        { success: false, error: "Invalid device fingerprint" },
        { status: 400 }
      );
    }

    if (
      deviceName.length < 1 ||
      deviceName.length > 100 ||
      appVersion.length > 30
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid device details" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("activate_device", {
      p_device_fingerprint_hash: fingerprint,
      p_device_name: deviceName,
      p_app_version: appVersion,
    });

    if (error) {
      console.error("DEVICE ACTIVATION ERROR:", error);

      return NextResponse.json(
        { success: false, error: "Device activation failed" },
        { status: 500 }
      );
    }

    if (!data.success) {
      return NextResponse.json(data, { status: 403 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("DEVICE API ERROR:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}