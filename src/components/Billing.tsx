// Pricing + account panel for the SaaS billing layer. Only mounted when the
// server reports billing is enabled (App fetches /api/billing/config first), so
// the default self-hosted app never shows it. Presentational state is local;
// all persistence goes through src/lib/billingClient.
import { useState } from "react";
import { KeyRound, Check, Loader2, ExternalLink, Copy } from "lucide-react";
import type { BillingConfig, AccountInfo } from "../lib/billingClient";
import { signup, startCheckout, openPortal, setApiKey } from "../lib/billingClient";

interface BillingProps {
  config: BillingConfig;
  account: AccountInfo | null;
  onAccountChange: (account: AccountInfo | null) => void;
}

export function Billing({ config, account, onAccountChange }: BillingProps) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSignup = async () => {
    setError(null);
    setNotice(null);
    setBusy("signup");
    try {
      const { account: acct, warning } = await signup(email.trim() || undefined);
      onAccountChange(acct);
      if (warning) setNotice(warning);
    } catch (e: any) {
      setError(e?.message || "Sign up failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleCheckout = async (planId: string) => {
    setError(null);
    setBusy(planId);
    try {
      const url = await startCheckout(planId);
      window.location.href = url;
    } catch (e: any) {
      setError(e?.message || "Could not start checkout.");
      setBusy(null);
    }
  };

  const handlePortal = async () => {
    setError(null);
    setBusy("portal");
    try {
      const url = await openPortal();
      window.location.href = url;
    } catch (e: any) {
      setError(e?.message || "Could not open billing portal.");
      setBusy(null);
    }
  };

  const handleSignOut = () => {
    setApiKey(null);
    onAccountChange(null);
  };

  const copyKey = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const usagePct = account && account.limit > 0 ? Math.min(100, Math.round((account.used / account.limit) * 100)) : 0;

  return (
    <section className="max-w-3xl mx-auto">
      <div className="text-center mb-14">
        <div className="text-[9px] uppercase tracking-[0.4em] text-white/30 mb-6">Plans &amp; Access</div>
        <h2 className="text-4xl sm:text-5xl font-light tracking-tight text-white/90 mb-4">Pricing</h2>
        <p className="text-white/40 text-sm max-w-md mx-auto">
          Every generation draws on the shared model engine. Pick a plan that matches your monthly output.
        </p>
      </div>

      {error && (
        <div className="mb-6 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded px-4 py-3">{error}</div>
      )}
      {notice && (
        <div className="mb-6 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded px-4 py-3">{notice}</div>
      )}

      {/* Account / key panel */}
      {account ? (
        <div className="mb-12 border border-white/10 rounded-lg p-6 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <KeyRound className="w-4 h-4" /> Your account
            </div>
            <span className="text-[9px] uppercase tracking-widest text-white/40 border border-white/10 px-3 py-1 rounded">
              {account.planName} plan
            </span>
          </div>

          <div className="flex items-center gap-2 mb-5">
            <code className="flex-1 text-xs text-white/60 bg-black/40 border border-white/10 rounded px-3 py-2 truncate">
              {account.apiKey}
            </code>
            <button
              onClick={copyKey}
              className="text-[9px] uppercase tracking-widest text-white/60 border border-white/10 px-3 py-2 rounded hover:bg-white/5 flex items-center gap-1"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mb-2 flex items-center justify-between text-xs text-white/50">
            <span>Usage this month</span>
            <span>
              {account.used} / {account.limit}
            </span>
          </div>
          <div className="h-1.5 w-full bg-white/10 rounded overflow-hidden mb-5">
            <div
              className={`h-full ${usagePct >= 100 ? "bg-red-400" : "bg-white/60"}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {account.plan !== "free" && config.checkout && (
              <button
                onClick={handlePortal}
                disabled={busy === "portal"}
                className="text-[9px] uppercase tracking-widest text-white/70 border border-white/10 px-4 py-2 rounded hover:bg-white/5 flex items-center gap-2 disabled:opacity-50"
              >
                {busy === "portal" ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                Manage billing
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="text-[9px] uppercase tracking-widest text-white/40 px-4 py-2 rounded hover:text-white/70"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-12 border border-white/10 rounded-lg p-6 bg-white/[0.02]">
          <div className="flex items-center gap-2 text-white/80 text-sm mb-4">
            <KeyRound className="w-4 h-4" /> Get a free API key
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com (optional)"
              className="flex-1 bg-black/40 border border-white/10 rounded px-4 py-3 text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-white/30"
            />
            <button
              onClick={handleSignup}
              disabled={busy === "signup"}
              className="bg-white text-black text-[10px] uppercase tracking-[0.3em] font-medium px-6 py-3 rounded hover:bg-white/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy === "signup" && <Loader2 className="w-3 h-3 animate-spin" />} Create key
            </button>
          </div>
          {config.ephemeral && (
            <p className="mt-3 text-[11px] text-amber-200/70">
              Note: this deployment has no persistent store configured, so keys may reset.
            </p>
          )}
        </div>
      )}

      {/* Plan cards */}
      <div className="grid sm:grid-cols-3 gap-5">
        {config.plans.map((plan) => {
          const current = account?.plan === plan.id;
          return (
            <div
              key={plan.id}
              className={`border rounded-lg p-6 flex flex-col ${current ? "border-white/40 bg-white/[0.04]" : "border-white/10 bg-white/[0.02]"}`}
            >
              <div className="text-[9px] uppercase tracking-[0.3em] text-white/40 mb-3">{plan.name}</div>
              <div className="text-2xl font-light text-white/90 mb-1">{plan.priceLabel}</div>
              <div className="text-xs text-white/40 mb-6">{plan.monthlyQuota.toLocaleString()} generations / mo</div>

              <div className="mt-auto">
                {current ? (
                  <div className="text-[9px] uppercase tracking-widest text-white/60 border border-white/10 px-4 py-2 rounded text-center flex items-center justify-center gap-2">
                    <Check className="w-3 h-3" /> Current
                  </div>
                ) : plan.purchasable && config.checkout ? (
                  <button
                    onClick={() => handleCheckout(plan.id)}
                    disabled={!account || busy === plan.id}
                    title={!account ? "Create a key first" : undefined}
                    className="w-full bg-white text-black text-[9px] uppercase tracking-[0.3em] font-medium px-4 py-2 rounded hover:bg-white/90 disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {busy === plan.id && <Loader2 className="w-3 h-3 animate-spin" />} Upgrade
                  </button>
                ) : plan.purchasable ? (
                  <div className="text-[9px] uppercase tracking-widest text-white/30 text-center py-2">
                    Checkout offline
                  </div>
                ) : (
                  <div className="text-[9px] uppercase tracking-widest text-white/30 text-center py-2">Included</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
