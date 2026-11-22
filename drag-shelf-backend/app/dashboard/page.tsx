import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import LogoutButton from "@/components/dashboard/LogoutButton";
import EntitlementPanel from "@/components/dashboard/EntitlementPanel";
import DeviceManager from "@/components/dashboard/DeviceManager";

import {
  Layers3,
  LayoutDashboard,
  CreditCard,
  Monitor,
  Settings,
  ShieldCheck,
  HardDrive,
  Zap,
  ArrowUpRight,
} from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Authenticate user
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // User information
  const displayName =
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    "User";

  const firstName = displayName.trim().split(" ")[0] || "User";

  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word: string) => word.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  return (
    <main className="dashboard-layout">
      {/* SIDEBAR */}
      <aside className="dashboard-sidebar">
        <Link href="/dashboard" className="dashboard-brand">
          <div className="dashboard-brand-icon">
            <Layers3 size={23} />
          </div>

          <span>
            DRAG<span>SHELF</span>
          </span>
        </Link>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="sidebar-nav">
          <Link href="/dashboard" className="sidebar-link active">
            <LayoutDashboard size={18} />
            Overview
          </Link>

          <Link
            href="/dashboard#subscription"
            className="sidebar-link"
          >
            <CreditCard size={18} />
            Subscription
          </Link>

          <Link href="/dashboard#devices" className="sidebar-link">
            <Monitor size={18} />
            Devices
          </Link>

          <Link href="/dashboard#storage" className="sidebar-link">
            <HardDrive size={18} />
            Storage
          </Link>

          <Link href="/dashboard#settings" className="sidebar-link">
            <Settings size={18} />
            Settings
          </Link>
        </nav>

        {/* SIDEBAR USER */}
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="user-avatar">{initials}</div>

            <div className="user-details">
              <strong>{displayName}</strong>
              <span>{user.email}</span>
            </div>
          </div>

          <LogoutButton />
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <section className="dashboard-main">
        {/* TOPBAR */}
        <header className="dashboard-topbar">
          <div>
            <span className="breadcrumb">
              Workspace / Overview
            </span>
          </div>

          <div className="account-status">
            <span className="status-dot" />
            Account active
          </div>
        </header>

        <div className="dashboard-content">
          {/* WELCOME SECTION */}
          <section className="welcome-section">
            <div>
              <div className="eyebrow">YOUR WORKSPACE</div>

              <h1>Welcome back, {firstName}.</h1>

              <p>
                Manage your Drag Shelf account, subscription
                and connected devices.
              </p>
            </div>

            <div className="welcome-icon">
              <Layers3 size={35} />
            </div>
          </section>

          {/* SUBSCRIPTION */}
          <section
            id="subscription"
            className="dashboard-subscription"
          >
            <EntitlementPanel />
          </section>

          {/* ACCOUNT INFORMATION */}
          <section className="dashboard-grid" id="settings">
            <article className="dashboard-panel account-panel">
              <span className="panel-label">
                ACCOUNT INFORMATION
              </span>

              <h2>Profile details</h2>

              <div className="profile-field">
                <span>Display name</span>
                <strong>{displayName}</strong>
              </div>

              <div className="profile-field">
                <span>Email address</span>
                <strong>{user.email || "Not available"}</strong>
              </div>

              <div className="profile-field">
                <span>Account ID</span>

                <strong className="account-id">
                  {user.id.slice(0, 13)}...
                </strong>
              </div>

              <div className="verified-label">
                <ShieldCheck size={16} />
                Authenticated account
              </div>
            </article>

            {/* ACCOUNT SECURITY */}
            <article className="dashboard-panel account-panel">
              <span className="panel-label">
                ACCOUNT SECURITY
              </span>

              <div className="device-heading-icon">
                <ShieldCheck size={23} />
              </div>

              <h2>Your account is protected.</h2>

              <p>
                Your account is authenticated through
                Supabase. Manage your connected devices
                and subscription from this dashboard.
              </p>

              <div className="plan-divider" />

              <div className="device-status">
                <div>
                  <span className="status-dot" />
                  Authentication active
                </div>

                <span className="coming-badge">
                  VERIFIED
                </span>
              </div>
            </article>
          </section>

          {/* DEVICE MANAGEMENT */}
          <section
            id="devices"
            className="dashboard-device-section"
          >
            <DeviceManager />
          </section>

          {/* STORAGE SECTION */}
          <section
            className="dashboard-panel coming-soon"
            id="storage"
          >
            <div className="coming-icon">
              <HardDrive size={22} />
            </div>

            <div>
              <span className="panel-label">
                LOCAL-FIRST STORAGE
              </span>

              <h2>Your files stay yours.</h2>

              <p>
                Drag Shelf keeps your local files on your
                computer. Cloud synchronization will be
                available with Premium.
              </p>
            </div>

            <span className="coming-badge">
              LOCAL-FIRST
            </span>
          </section>

          {/* UPGRADE BANNER */}
          <section className="upgrade-banner">
            <div className="upgrade-banner-icon">
              <Zap size={24} />
            </div>

            <div className="upgrade-banner-content">
              <span className="panel-label">
                UNLOCK MORE POSSIBILITIES
              </span>

              <h2>Take your workflow further.</h2>

              <p>
                Explore Pro and Premium features for
                your Drag Shelf workspace.
              </p>
            </div>

            <Link href="/pricing" className="upgrade-button">
              Explore plans
              <ArrowUpRight size={17} />
            </Link>
          </section>

          {/* FOOTER */}
          <footer className="dashboard-footer">
            <span>
              DRAG SHELF · YOUR WORKSPACE, CONNECTED.
            </span>

            <span>LOCAL-FIRST BY DESIGN.</span>
          </footer>
        </div>
      </section>
    </main>
  );
}