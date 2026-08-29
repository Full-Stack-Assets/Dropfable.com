import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { Sparkles } from "lucide-react";
import { NICHE_TREND_DATA } from "../constants";

interface HeaderProps {
  archiveView: boolean;
  queueView: boolean;
  showQueue: boolean;
  pricingView?: boolean;
  showPricing?: boolean;
  pendingCount: number;
  archiveCount: number;
  signedIn: boolean;
  authLoading: boolean;
  onManufacture: () => void;
  onQueue: () => void;
  onArchive: () => void;
  onPricing?: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function Header({
  archiveView,
  queueView,
  showQueue,
  pricingView,
  showPricing,
  pendingCount,
  archiveCount,
  signedIn,
  authLoading,
  onManufacture,
  onQueue,
  onArchive,
  onPricing,
  onSignIn,
  onSignOut,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-6 shrink-0">
          <h1 className="text-sm font-bold tracking-tight text-gray-900 flex items-center gap-2 whitespace-nowrap">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            DropKit Factory
          </h1>
          <div className="hidden lg:flex flex-col w-24 pl-6 border-l border-gray-200">
            <span className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Niche Trend</span>
            <div className="h-4 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={NICHE_TREND_DATA}>
                  <YAxis domain={["dataMin", "dataMax"]} hide />
                  <Line type="monotone" dataKey="intensity" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <nav className="w-full sm:w-auto flex items-center justify-start sm:justify-end gap-4 sm:gap-6 text-xs sm:text-sm font-medium text-gray-500 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={onManufacture}
            className={`transition-colors ${!archiveView && !queueView && !pricingView ? "text-gray-900" : "hover:text-gray-900"}`}
          >
            Manufacture
          </button>
          {showQueue && (
            <button
              onClick={onQueue}
              className={`transition-colors ${queueView ? "text-gray-900" : "hover:text-gray-900"}`}
            >
              Queue ({pendingCount})
            </button>
          )}
          <button
            onClick={onArchive}
            className={`transition-colors ${archiveView ? "text-gray-900" : "hover:text-gray-900"}`}
          >
            Archive ({archiveCount})
          </button>
          {showPricing && (
            <button
              onClick={onPricing}
              className={`transition-colors ${pricingView ? "text-gray-900" : "hover:text-gray-900"}`}
            >
              Pricing
            </button>
          )}
          {!authLoading && signedIn ? (
            <button onClick={onSignOut} className="text-gray-500 hover:text-gray-900">Sign Out</button>
          ) : (
            <button onClick={onSignIn} className="text-emerald-600 hover:text-emerald-700">Sign In</button>
          )}
        </nav>
      </div>
    </header>
  );
}
