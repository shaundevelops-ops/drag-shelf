"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Layers3,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  Zap,
  Crown,
  Sparkles,
} from "lucide-react";

type BillingCycle = "monthly" | "yearly";

const plans = [
  {
    id: "free",
    name: "Free",
    description: "Everything you need to get started.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    icon: Layers3,
    popular: false,
    features: [
      "15 shelf items",
      "2 collections",
      "Basic file previews",
      "Limited thumbnail previews",
      "1 device activation",
      "Local-first storage",
    ],
    unavailable: [
      "Browser extension",
      "Cloud synchronization",
      "Advanced thumbnails",
      "Priority support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For people who want more from their workflow.",
    monthlyPrice: 99,
    yearlyPrice: 999,
    icon: Zap,
    popular: true,
    features: [
      "150 shelf items",
      "10 collections",
      "Full file previews",
      "Advanced thumbnails",
      "Browser extension",
      "2 device activations",
      "Local-first storage",
    ],
    unavailable: [
      "Cloud synchronization",
      "Priority support",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    description: "The complete Drag Shelf experience.",
    monthlyPrice: 199,
    yearlyPrice: 1999,
    icon: Crown,
    popular: false,
    features: [
      "Unlimited shelf items",
      "Unlimited collections",
      "Full file previews",
      "Advanced thumbnails",
      "Browser extension",
      "Cloud synchronization",
      "5 device activations",
      "Priority support",
    ],
    unavailable: [],
  },
];

const comparison = [
  { name: "Shelf items", free: "15", pro: "150", premium: "Unlimited" },
  { name: "Collections", free: "2", pro: "10", premium: "Unlimited" },
  { name: "File previews", free: "Basic", pro: "Full", premium: "Full" },
  { name: "Thumbnail previews", free: "Limited", pro: "Advanced", premium: "Advanced" },
  { name: "Browser extension", free: false, pro: true, premium: true },
  { name: "Cloud synchronization", free: false, pro: false, premium: true },
  { name: "Device activations", free: "1", pro: "2", premium: "5" },
  { name: "Priority support", free: false, pro: false, premium: true },
];

export default function PricingPage() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN").format(price);

  return (
    <main className="pricing-page">
      {/* NAVIGATION */}
      <nav className="pricing-nav">
        <Link href="/dashboard" className="pricing-brand">
          <div className="pricing-brand-icon">
            <Layers3 size={22} />
          </div>

          <span>
            DRAG<span>SHELF</span>
          </span>
        </Link>

        <Link href="/dashboard" className="pricing-back">
          <ArrowLeft size={16} />
          Dashboard
        </Link>
      </nav>

      {/* HERO */}
      <section className="pricing-hero">
        <div className="pricing-eyebrow">
          <Sparkles size={14} />
          SIMPLE, TRANSPARENT PRICING
        </div>

        <h1>
          More control.
          <br />
          <span>Less friction.</span>
        </h1>

        <p>
          Choose the Drag Shelf plan that fits your workflow.
          Keep your files close and your productivity closer.
        </p>

        {/* BILLING TOGGLE */}
        <div className="billing-toggle">
          <button
            className={billing === "monthly" ? "selected" : ""}
            onClick={() => setBilling("monthly")}
          >
            Monthly
          </button>

          <button
            className={billing === "yearly" ? "selected" : ""}
            onClick={() => setBilling("yearly")}
          >
            Yearly
            <span>Save more</span>
          </button>
        </div>
      </section>

      {/* PRICING CARDS */}
      <section className="pricing-cards">
        {plans.map((plan) => {
          const Icon = plan.icon;

          const price =
            billing === "monthly"
              ? plan.monthlyPrice
              : plan.yearlyPrice;

          return (
            <article
              key={plan.id}
              className={`pricing-card ${plan.popular ? "popular" : ""}`}
            >
              {plan.popular && (
                <div className="popular-label">
                  MOST POPULAR
                </div>
              )}

              <div className="pricing-card-header">
                <div className="pricing-plan-icon">
                  <Icon size={21} />
                </div>

                <h2>{plan.name}</h2>

                <p>{plan.description}</p>
              </div>

              <div className="pricing-price">
                <span className="currency">₹</span>
                <strong>{formatPrice(price)}</strong>

                <span className="price-period">
                  /{billing === "monthly" ? "month" : "year"}
                </span>
              </div>

              <p className="billing-note">
                {price === 0
                  ? "Free forever"
                  : billing === "yearly"
                    ? "Billed annually"
                    : "Billed monthly"}
              </p>

              <Link
                href={
                  plan.id === "free"
                    ? "/dashboard"
                    : `/checkout?plan=${plan.id}&cycle=${billing}`
                }
                className={`pricing-cta ${plan.popular ? "primary" : ""}`}
                aria-disabled={plan.id !== "free"}
                onClick={
                  plan.id !== "free"
                    ? (event) => {
                        event.preventDefault();
                        alert("Secure checkout is coming soon!");
                      }
                    : undefined
                }
              >
                {plan.id === "free"
                  ? "Go to dashboard"
                  : "Get started"}

                <ArrowRight size={16} />
              </Link>

              <div className="pricing-divider" />

              <span className="feature-heading">
                WHAT&apos;S INCLUDED
              </span>

              <ul className="pricing-features">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check size={15} />
                    {feature}
                  </li>
                ))}

                {plan.unavailable.map((feature) => (
                  <li className="disabled-feature" key={feature}>
                    <X size={15} />
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>

      {/* COMPARISON TABLE */}
      <section className="comparison-section">
        <div className="comparison-heading">
          <span className="pricing-eyebrow">
            PLAN COMPARISON
          </span>

          <h2>Find your perfect fit.</h2>

          <p>Everything compared, nothing hidden.</p>
        </div>

        <div className="comparison-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Features</th>
                <th>Free</th>
                <th>Pro</th>
                <th>Premium</th>
              </tr>
            </thead>

            <tbody>
              {comparison.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>

                  {[row.free, row.pro, row.premium].map(
                    (value, index) => (
                      <td key={index}>
                        {typeof value === "boolean" ? (
                          value ? (
                            <Check className="comparison-check" size={17} />
                          ) : (
                            <X className="comparison-cross" size={17} />
                          )
                        ) : (
                          value
                        )}
                      </td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="pricing-footer">
        <Link href="/dashboard" className="pricing-brand">
          <Layers3 size={18} />
          <span>DRAG<span>SHELF</span></span>
        </Link>

        <p>YOUR WORKSPACE. YOUR RULES.</p>
      </footer>
    </main>
  );
}