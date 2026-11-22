"use client";

import { useEffect, useState } from "react";
import {
  Crown,
  Monitor,
  Layers3,
  ShieldCheck,
  ArrowUpRight,
  Loader2,
} from "lucide-react";

interface Entitlements {
  success: boolean;
  plan: {
    id: string;
    name: string;
    monthlyPricePaise: number;
    yearlyPricePaise: number;
  };
  limits: {
    maxItems: number;
    maxCollections: number;
    maxDevices: number;
  };
  usage: {
    activeDevices: number;
  };
  features: {
    fullPreviews: boolean;
    advancedThumbnails: boolean;
    browserExtension: boolean;
    cloudSync: boolean;
    prioritySupport: boolean;
  };
}

export default function EntitlementPanel() {
  const [data, setData] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEntitlements() {
      try {
        const response = await fetch("/api/entitlements", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Unable to load subscription.");
        }

        setData(result);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong."
        );
      } finally {
        setLoading(false);
      }
    }

    loadEntitlements();
  }, []);

  if (loading) {
    return (
      <div className="entitlement-loading">
        <Loader2 className="spin" size={22} />
        Loading subscription...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="message error">
        {error || "Subscription information unavailable."}
      </div>
    );
  }

  const formatLimit = (value: number) =>
    value === -1 ? "Unlimited" : value.toString();

  const monthlyPrice = data.plan.monthlyPricePaise / 100;

  return (
    <>
      <section className="dashboard-stats">
        <article className="stat-card">
          <div className="stat-icon">
            <Crown size={20} />
          </div>

          <span>Current plan</span>
          <h2>{data.plan.name}</h2>
          <small>
            {monthlyPrice === 0 ? "Free forever" : `₹${monthlyPrice}/month`}
          </small>
        </article>

        <article className="stat-card">
          <div className="stat-icon">
            <Monitor size={20} />
          </div>

          <span>Device activations</span>
          <h2>
            {data.usage.activeDevices} / {formatLimit(data.limits.maxDevices)}
          </h2>
          <small>Active devices</small>
        </article>

        <article className="stat-card">
          <div className="stat-icon">
            <ShieldCheck size={20} />
          </div>

          <span>Account security</span>
          <h2>Protected</h2>
          <small>Authenticated account</small>
        </article>
      </section>

      <section className="dashboard-panel subscription-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-label">YOUR SUBSCRIPTION</span>
            <h2>{data.plan.name} Plan</h2>
          </div>

          <div className="plan-badge">CURRENT PLAN</div>
        </div>

        <p>
          Your Drag Shelf subscription and available feature limits.
        </p>

        <div className="plan-divider" />

        <div className="plan-features">
          <div>
            <Layers3 size={17} />
            {formatLimit(data.limits.maxItems)} shelf items
          </div>

          <div>
            <Layers3 size={17} />
            {formatLimit(data.limits.maxCollections)} collections
          </div>

          <div>
            <Monitor size={17} />
            {formatLimit(data.limits.maxDevices)} devices
          </div>

          <div>
            <ShieldCheck size={17} />
            {data.features.fullPreviews ? "Full previews enabled" : "Basic previews"}
          </div>

          <div>
            <Crown size={17} />
            {data.features.browserExtension
              ? "Browser extension enabled"
              : "Browser extension unavailable"}
          </div>
        </div>

        <a href="/pricing" className="upgrade-button">
          Explore upgrade options
          <ArrowUpRight size={17} />
        </a>
      </section>
    </>
  );
}