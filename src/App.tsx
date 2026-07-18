import React, { useState, useEffect } from "react";
import { PRODUCTS, PRESET_NICHES } from "./constants";
import { ProductType, ManufactureResult, NICHE_TREND_DATA } from "./types";
import { ArchiveView } from "./components/ArchiveView";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { 
  Sparkles, Download, Check, AlertCircle, Calendar, Brain, Mail, BookOpen, 
  CheckSquare, Layers, Search, Mic, MicOff, Globe, RefreshCw, Loader2, ArrowRight
} from "lucide-react";
import { auth, signInWithGoogle, logout } from "./firebase";
import { useAuthState } from "react-firebase-hooks/auth";

export default function App() {
  const [user, loadingAuth] = useAuthState(auth);

  const [selectedProduct, setSelectedProduct] = useState<ProductType>(PRODUCTS[0]);
  const [niche, setNiche] = useState("");
  const [angle, setAngle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [batchResults, setBatchResults] = useState<ManufactureResult[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);

  const [archiveView, setArchiveView] = useState(false);
  const [archivedItems, setArchivedItems] = useState<ManufactureResult[]>([]);
  const [selectedArchiveIndices, setSelectedArchiveIndices] = useState<number[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const [language, setLanguage] = useState("English");
  const [watermarkText, setWatermarkText] = useState("");

  const [trendsSearchQuery, setTrendsSearchQuery] = useState("");
  const [trendsResults, setTrendsResults] = useState<any[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsError, setTrendsError] = useState<string | null>(null);

  const [isDetecting, setIsDetecting] = useState(false);

  // Sync with Firestore when auth state changes
  useEffect(() => {
    import('./firebase').then(async ({ db }) => {
      const { doc, getDoc, setDoc } = await import('firebase/firestore');
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            if (data.archivedItems) {
              setArchivedItems(data.archivedItems);
            }
          }
        } catch (err) {
          console.error("Firestore read error", err);
        }
      } else {
        const localSaved = localStorage.getItem('dropkit_archive');
        if (localSaved) {
          try { setArchivedItems(JSON.parse(localSaved)); } catch (e) {}
        }
      }
    });
  }, [user]);

  const saveArchiveState = async (newArchive: ManufactureResult[]) => {
    setArchivedItems(newArchive);
    localStorage.setItem('dropkit_archive', JSON.stringify(newArchive));
    if (user) {
      import('./firebase').then(async ({ db }) => {
        const { doc, setDoc } = await import('firebase/firestore');
        try {
          await setDoc(doc(db, "users", user.uid), { archivedItems: newArchive }, { merge: true });
        } catch (err) {
          console.error("Firestore write error", err);
        }
      });
    }
  };

  useEffect(() => {
    if (isBatchMode || archiveView) {
      setSuggestions([]);
      return;
    }
    if (!niche || niche.length < 3) {
      setSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch("/api/suggest-tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: niche })
        });
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.tags || []);
        }
      } catch (err) {
        console.error(err);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [niche, isBatchMode, archiveView]);

  const handleSearchTrends = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTrendsLoading(true);
    setTrendsError(null);
    try {
      const qParam = encodeURIComponent(trendsSearchQuery.trim() || "currently trending digital product niches 2026");
      const res = await fetch(`/api/trending-niches?q=${qParam}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch live trends.");
      }
      setTrendsResults(data.trends || []);
    } catch (err: any) {
      setTrendsError(err.message || "An error occurred while fetching trends.");
    } finally {
      setTrendsLoading(false);
    }
  };

  const handleAutoDetect = async () => {
    if (!niche.trim()) {
      setError("Please enter a niche first to detect format.");
      return;
    }
    setIsDetecting(true);
    setError(null);
    try {
      const res = await fetch("/api/detect-format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche })
      });
      const data = await res.json();
      if (data.format) {
        const match = PRODUCTS.find(p => p.id === data.format);
        if (match) {
          setSelectedProduct(match);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDetecting(false);
    }
  };

  const triggerSubmit = async () => {
    const nichesToProcess = isBatchMode 
      ? niche.split('\\n').map(n => n.trim()).filter(Boolean)
      : [niche.trim()];

    if (nichesToProcess.length === 0) {
      setError("Please insert a target audience parameter to proceed.");
      return;
    }

    setError(null);
    setLoading(true);
    setBatchResults([]);

    try {
      const newResults: ManufactureResult[] = [];
      for (let i = 0; i < nichesToProcess.length; i++) {
        const currentNiche = nichesToProcess[i];
        const response = await fetch("/api/manufacture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: selectedProduct.id,
            niche: currentNiche,
            angle: angle.trim() || undefined,
            language: language !== "English" ? language : undefined,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Failed to process synthesis for: ${currentNiche}`);
        }
        
        const result = { ...data, originalNiche: currentNiche };
        newResults.push(result);
        setBatchResults([...newResults]);
        
        // Auto archive
        const updatedArchive = [...archivedItems, result];
        saveArchiveState(updatedArchive);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during synthesis.");
    } finally {
      setLoading(false);
    }
  };

  const toggleArchiveSelection = (idx: number) => {
    setSelectedArchiveIndices(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleRemoveFromArchive = (idx: number) => {
    const updated = archivedItems.filter((_, i) => i !== idx);
    saveArchiveState(updated);
    setSelectedArchiveIndices(prev => prev.filter(i => i !== idx).map(i => i > idx ? i - 1 : i));
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-sm font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              DropKit Factory
            </h1>
            <div className="hidden lg:flex flex-col w-24 pl-6 border-l border-gray-200">
              <span className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Niche Trend</span>
              <div className="h-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={NICHE_TREND_DATA}>
                    <YAxis domain={['dataMin', 'dataMax']} hide />
                    <Line type="monotone" dataKey="intensity" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          <nav className="flex gap-8 text-sm font-medium text-gray-500">
            <button 
              onClick={() => setArchiveView(false)}
              className={`transition-colors ${!archiveView ? 'text-gray-900' : 'hover:text-gray-900'}`}
            >
              Manufacture
            </button>
            <button 
              onClick={() => setArchiveView(true)}
              className={`transition-colors ${archiveView ? 'text-gray-900' : 'hover:text-gray-900'}`}
            >
              Archive ({archivedItems.length})
            </button>
            {!loadingAuth && user ? (
              <button onClick={logout} className="text-gray-500 hover:text-gray-900">Sign Out</button>
            ) : (
              <button onClick={signInWithGoogle} className="text-emerald-600 hover:text-emerald-700">Sign In</button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 py-12">
        {archiveView ? (
          <ArchiveView 
            archivedItems={archivedItems}
            selectedArchiveIndices={selectedArchiveIndices}
            toggleArchiveSelection={toggleArchiveSelection}
            handleRemoveFromArchive={handleRemoveFromArchive}
            setSelectedArchiveIndices={setSelectedArchiveIndices}
            watermarkText={watermarkText}
            setArchivedItems={saveArchiveState}
          />
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 mb-4">
                Digital Assets on Demand
              </h2>
              <p className="text-lg text-gray-500 font-light max-w-2xl mx-auto">
                Generate complete product cores perfectly aligned for your target audience, ready to sell.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-12">
              <div className="p-8 border-b border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900">1. Select Format</h3>
                  <button 
                    onClick={handleAutoDetect} 
                    disabled={isDetecting || !niche}
                    className="flex items-center gap-2 text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                  >
                    {isDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                    Auto-Detect Format
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {PRODUCTS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProduct(p)}
                      className={`text-left p-6 rounded-xl transition-all border ${
                        selectedProduct.id === p.id 
                          ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
                        selectedProduct.id === p.id ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {p.ico}
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-1">{p.name}</h4>
                      <p className="text-xs text-gray-500 leading-relaxed">{p.spec}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900">2. Target Audience</h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Batch Mode</span>
                    <input 
                      type="checkbox" 
                      checked={isBatchMode} 
                      onChange={(e) => setIsBatchMode(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${isBatchMode ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isBatchMode ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="relative">
                    <label className="block text-xs font-medium text-gray-700 mb-2">Primary Niche *</label>
                    {isBatchMode ? (
                      <textarea
                        className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        rows={4}
                        placeholder="Independent Developers\\nVegan Meal Prep Beginners"
                        value={niche}
                        onChange={(e) => setNiche(e.target.value)}
                      />
                    ) : (
                      <input
                        className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        placeholder="e.g., Notion Template Designers"
                        value={niche}
                        onChange={(e) => setNiche(e.target.value)}
                      />
                    )}
                    
                    {suggestions.length > 0 && !isBatchMode && (
                      <div className="absolute top-[70px] left-0 w-full bg-white border border-gray-200 shadow-xl rounded-lg z-20 overflow-hidden">
                        <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                          Suggested Micro-Niches
                        </div>
                        {suggestions.map((s, idx) => (
                          <button
                            key={idx}
                            onClick={() => { setNiche(s); setSuggestions([]); }}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors border-b border-gray-100 last:border-0"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Creative Angle (Optional)</label>
                    <input
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="e.g., Academic lens, Faith-based..."
                      value={angle}
                      onChange={(e) => setAngle(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-8 p-6 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="w-5 h-5 text-emerald-600" />
                    <h4 className="font-semibold text-emerald-900">Google Search Trend Radar</h4>
                  </div>
                  <div className="flex gap-3 mb-4">
                    <input
                      type="text"
                      className="flex-1 bg-white border border-emerald-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Search live trends..."
                      value={trendsSearchQuery}
                      onChange={(e) => setTrendsSearchQuery(e.target.value)}
                    />
                    <button
                      onClick={handleSearchTrends}
                      disabled={trendsLoading}
                      className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {trendsLoading ? "Scanning..." : "Scan"}
                    </button>
                  </div>
                  {trendsResults.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                      {trendsResults.map((item, i) => (
                        <div key={i} className="bg-white p-4 rounded-lg border border-emerald-100 shadow-sm cursor-pointer hover:border-emerald-300" onClick={() => setNiche(item.niche)}>
                          <div className="text-sm font-semibold text-emerald-800 mb-1">{item.niche}</div>
                          <div className="text-xs text-emerald-600/80 mb-2">{item.exampleConcept}</div>
                          <div className="text-[10px] text-gray-500 line-clamp-2">{item.whyTrending}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={triggerSubmit}
                    disabled={loading || !niche}
                    className="flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-sm hover:shadow-md"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    Manufacture Assets
                  </button>
                </div>
                
                {error && (
                  <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {error}
                  </div>
                )}
              </div>
            </div>

            {batchResults.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Generation Complete</h3>
                <p className="text-gray-500 mb-6">Your {batchResults.length} asset(s) have been manufactured and saved to the Archive.</p>
                <button 
                  onClick={() => setArchiveView(true)}
                  className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 flex items-center gap-2 mx-auto"
                >
                  View in Archive <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
