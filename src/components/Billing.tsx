import { useState } from "react";
import { KeyRound, Check, Loader2, ExternalLink, Copy } from "lucide-react";
import type { BillingConfig, AccountInfo } from "../lib/billingClient";
import { signup, startCheckout, openPortal, setApiKey } from "../lib/billingClient";
import { trackEvent } from "../analytics";

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
      trackEvent("generate_lead", { tool: "billing_signup", plan: acct.plan });
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
      trackEvent("checkout_start", { plan: planId });
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
        <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-4">Pricing</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          Every generation draws on the shared model engine. Pick a plan that matches your monthly output.
        </p>
      </div>

      {error && (
        <div className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
      )}
      {notice && (
        <div className="mb-6 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">{notice}</div>
      )}

      {account ? (
        <div className="mb-12 border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-gray-800 text-sm font-medium">
              <KeyRound className="w-4 h-4" /> Your account
            </div>
            <span className="text-xs uppercase tracking-widest text-gray-500 border border-gray-200 px-3 py-1 rounded">
              {account.planName} plan
            </span>
          </div>

          <div className="flex items-center gap-2 mb-5">
            <code className="flex-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2 truncate">
              {account.apiKey}
            </code>
            <button
              onClick={copyKey}
              className="text-xs uppercase tracking-widest text-gray-600 border border-gray-200 px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-1"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
            <span>Usage this month</span>
            <span>
              {account.used} / {account.limit}
            </span>
          </div>
          <div className="h-1.5 w-full bg-gray-100 rounded overflow-hidden mb-5">
            <div
              className={`h-full ${usagePct >= 100 ? "bg-red-400" : "bg-emerald-500"}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {account.plan !== "free" && config.checkout && (
              <button
                onClick={handlePortal}
                disabled={busy === "portal"}
                className="text-xs uppercase tracking-widest text-gray-700 border border-gray-200 px-4 py-2 rounded hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
              >
                {busy === "portal" ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                Manage billing
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="text-xs uppercase tracking-widest text-gray-400 px-4 py-2 rounded hover:text-gray-700"
            >
              Sign out of billing
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-12 border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
          <div className="flex items-center gap-2 text-gray-800 text-sm font-medium mb-4">
            <KeyRound className="w-4 h-4" /> Get a free API key
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com (optional)"
              className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={handleSignup}
              disabled={busy === "signup"}
              className="bg-gray-900 text-white text-sm font-medium px-6 py-3 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy === "signup" && <Loader2 className="w-3 h-3 animate-spin" />} Create key
            </button>
          </div>
          {config.ephemeral && (
            <p className="mt-3 text-xs text-amber-700">
              Note: this deployment has no persistent store configured, so keys may reset.
            </p>
          )}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-5">
        {config.plans.map((plan) => {
          const current = account?.plan === plan.id;
          return (
            <div
              key={plan.id}
              className={`border rounded-2xl p-6 flex flex-col bg-white ${current ? "border-emerald-500 ring-1 ring-emerald-500" : "border-gray-200"}`}
            >
              <div className="text-xs uppercase tracking-widest text-gray-400 mb-3">{plan.name}</div>
              <div className="text-2xl font-light text-gray-900 mb-1">{plan.priceLabel}</div>
              <div className="text-xs text-gray-500 mb-6">{plan.monthlyQuota.toLocaleString()} generations / mo</div>

              <div className="mt-auto">
                {current ? (
                  <div className="text-xs uppercase tracking-widest text-emerald-700 border border-emerald-200 px-4 py-2 rounded text-center flex items-center justify-center gap-2">
                    <Check className="w-3 h-3" /> Current
                  </div>
                ) : plan.purchasable && config.checkout ? (
                  <button
                    onClick={() => handleCheckout(plan.id)}
                    disabled={!account || busy === plan.id}
                    title={!account ? "Create a key first" : undefined}
                    className="w-full bg-gray-900 text-white text-xs uppercase tracking-widest font-medium px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {busy === plan.id && <Loader2 className="w-3 h-3 animate-spin" />} Upgrade
                  </button>
                ) : plan.purchasable ? (
                  <div className="text-xs uppercase tracking-widest text-gray-400 text-center py-2">
                    Checkout offline
                  </div>
                ) : (
                  <div className="text-xs uppercase tracking-widest text-gray-400 text-center py-2">Included</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
