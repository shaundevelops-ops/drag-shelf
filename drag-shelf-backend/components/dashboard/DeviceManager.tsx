"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Monitor,
  Laptop,
  Smartphone,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Clock,
} from "lucide-react";

interface Device {
  id: string;
  device_name: string;
  app_version: string | null;
  last_seen_at: string | null;
  activated_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export default function DeviceManager() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Please sign in again.");
        return;
      }

      const response = await fetch("/api/devices", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to load devices.");
      }

      setDevices(result.devices || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  async function revokeDevice(deviceId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to revoke this device?"
    );

    if (!confirmed) return;

    setRevoking(deviceId);
    setError("");

    try {
      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Please sign in again.");
      }

      const response = await fetch("/api/devices/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ deviceId }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to revoke device.");
      }

      await loadDevices();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setRevoking(null);
    }
  }

  const activeCount = devices.filter(
    (device) => !device.revoked_at
  ).length;

  function formatDate(value: string | null) {
    if (!value) return "Not available";

    return new Date(value).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return (
    <section className="device-manager">
      <div className="device-manager-header">
        <div>
          <div className="device-manager-title">
            <div className="device-manager-icon">
              <Monitor size={19} />
            </div>

            <div>
              <h2>Device Management</h2>
              <p>Manage devices connected to your account.</p>
            </div>
          </div>

          <div className="device-count">
            {activeCount} active device{activeCount !== 1 ? "s" : ""}
          </div>
        </div>

        <button
          className="device-refresh"
          onClick={loadDevices}
          disabled={loading}
          aria-label="Refresh devices"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {error && <div className="device-error">{error}</div>}

      {loading ? (
        <div className="device-empty">Loading your devices...</div>
      ) : devices.length === 0 ? (
        <div className="device-empty">
          <Laptop size={30} />
          <p>No devices have been activated yet.</p>
        </div>
      ) : (
        <div className="device-list">
          {devices.map((device) => {
            const active = !device.revoked_at;

            return (
              <div className="device-item" key={device.id}>
                <div className="device-item-icon">
                  <Laptop size={21} />
                </div>

                <div className="device-item-info">
                  <div className="device-item-name">
                    <h3>{device.device_name}</h3>

                    <span
                      className={
                        active
                          ? "device-badge active"
                          : "device-badge revoked"
                      }
                    >
                      {active ? (
                        <ShieldCheck size={12} />
                      ) : (
                        <ShieldOff size={12} />
                      )}

                      {active ? "Active" : "Revoked"}
                    </span>
                  </div>

                  <p>
                    Drag Shelf {device.app_version || "Version unknown"}
                  </p>

                  <div className="device-last-seen">
                    <Clock size={12} />
                    Last active: {formatDate(device.last_seen_at)}
                  </div>
                </div>

                {active && (
                  <button
                    className="device-revoke"
                    onClick={() => revokeDevice(device.id)}
                    disabled={revoking === device.id}
                  >
                    {revoking === device.id ? "Revoking..." : "Revoke"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}