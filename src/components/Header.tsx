// App header: brand, trend sparkline, and the Manufacture/Queue/Archive nav.
// Extracted from App.tsx; presentational — view state is passed in via props.
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { Sparkles } from "lucide-react";
import { NICHE_TREND_DATA } from "../constants";

interface HeaderProps {
  archiveView: boolean;
  queueView: boolean;
  pricingView?: boolean;
  showPricing?: boolean;
  pendingCount: number;
  archiveCount: number;
  onManufacture: () => void;
  onQueue: () => void;
  onArchive: () => void;
  onPricing?: () => void;
}

export function Header({
  archiveView,
  queueView,
  pricingView,
  showPricing,
  pendingCount,
  archiveCount,
  onManufacture,
  onQueue,
  onArchive,
  onPricing,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/10 flex-shrink-0">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-6 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">
        <div className="flex items-center gap-8">
          <div className="text-[10px] sm:text-xs tracking-[0.4em] font-medium uppercase text-white/90 flex items-center gap-4">
            <span>DropKit</span>
            <span className="text-white/30 hidden sm:inline">/ The Factory</span>
          </div>
          {/* Trending Niche Intensity Sparkline */}
          <div className="hidden lg:flex flex-col w-24 opacity-80 border-l border-white/10 pl-6 ml-2">
            <span className="text-[8px] uppercase tracking-widest text-white/40 mb-1 flex items-center gap-1">Trend <Sparkles className="w-2 h-2"/></span>
            <div className="h-4 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={NICHE_TREND_DATA}>
                  <YAxis domain={['dataMin', 'dataMax']} hide />
                  <Line type="monotone" dataKey="intensity" stroke="#ffffff" strokeWidth={1} dot={false} strokeOpacity={0.6} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="flex gap-10 text-[9px] uppercase tracking-[0.3em] text-white/50">
          <span
            onClick={onManufacture}
            className={`pb-1 cursor-pointer transition-colors ${!archiveView && !queueView && !pricingView ? 'text-white border-b border-white/40' : 'hover:text-white'}`}
          >
            Manufacture
          </span>
          <span
            onClick={onQueue}
            className={`pb-1 cursor-pointer transition-colors ${queueView ? 'text-white border-b border-white/40' : 'hover:text-white'}`}
          >
            Queue ({pendingCount})
          </span>
          <span
            onClick={onArchive}
            className={`pb-1 cursor-pointer transition-colors ${archiveView ? 'text-white border-b border-white/40' : 'hover:text-white'}`}
          >
            Archive ({archiveCount})
          </span>
          {showPricing && (
            <span
              onClick={onPricing}
              className={`pb-1 cursor-pointer transition-colors ${pricingView ? 'text-white border-b border-white/40' : 'hover:text-white'}`}
            >
              Pricing
            </span>
          )}
        </div>
        <div className="hidden sm:flex text-[9px] uppercase tracking-widest text-white/40 border border-white/10 px-4 py-2 items-center justify-center hover:bg-white/5 transition-colors">
          Mk I. System
        </div>
      </div>
    </header>
  );
}
