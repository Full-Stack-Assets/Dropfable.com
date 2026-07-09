import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";
import ReactMarkdown from "react-markdown";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { 
  Sparkles, 
  Download, 
  Copy, 
  Check, 
  AlertCircle, 
  Calendar, 
  Brain, 
  Mail, 
  BookOpen, 
  CheckSquare, 
  Layers, 
  Coins, 
  Clock, 
  ArrowRight, 
  Volume2, 
  Info,
  ExternalLink,
  Plus,
  Save,
  Trash2,
  FileText,
  RefreshCw,
  Play,
  CheckCircle2,
  Mic,
  MicOff,
  Globe,
  Search
} from "lucide-react";

interface ProductType {
  id: string;
  ico: React.ReactNode;
  name: string;
  code: string;
  spec: string;
}

const PRODUCTS: ProductType[] = [
  {
    id: "planner",
    ico: <Calendar className="w-5 h-5" />,
    name: "Planner / Workbook",
    code: "30-day structure",
    spec: "30 daily interactive entries, weekly reflection reviews & comprehensive introduction"
  },
  {
    id: "prompts",
    ico: <Brain className="w-5 h-5" />,
    name: "Prompt Pack",
    code: "50 copy-paste prompts",
    spec: "50 high-value ready-to-use bracketed prompts across 5 key niche categories"
  },
  {
    id: "templates",
    ico: <Mail className="w-5 h-5" />,
    name: "Template Pack",
    code: "25 fill-in scripts",
    spec: "25 customizable captions, templates or message logs with custom blanks and strategies"
  },
  {
    id: "guide",
    ico: <BookOpen className="w-5 h-5" />,
    name: "Mini-Guide / Book",
    code: "~3k word deep-dive",
    spec: "A complete non-fiction playbook including 6-8 chapters loaded with specific guidance"
  },
  {
    id: "checklist",
    ico: <CheckSquare className="w-5 h-5" />,
    name: "Checklist System",
    code: "10-part checklist package",
    spec: "A synchronized set of 10 related checklists with sequential tasks and trigger index"
  },
  {
    id: "swipe",
    ico: <Layers className="w-5 h-5" />,
    name: "Swipe File",
    code: "75 creative hooks",
    spec: "75 highly converting lines, email headers or openers with sectioned applicability guidance"
  }
];

const PRESET_NICHES = [
  "ADHD College Students",
  "New Real Estate Agents",
  "Pet Shop Owners",
  "Self-Taught Indie Hackers",
  "Vegan Meal Prep Beginners"
];

interface ManufactureResult {
  productTitle: string;
  productContent: string;
  etsyTitle: string;
  priceRecommendationValue: string;
  listingDescription: string;
  etsyTags: string[];
  gumroadBlurb: string;
  originalNiche?: string;
}

const NICHE_TREND_DATA = [
  { intensity: 20 },
  { intensity: 24 },
  { intensity: 30 },
  { intensity: 28 },
  { intensity: 45 },
  { intensity: 60 },
  { intensity: 58 },
  { intensity: 80 },
  { intensity: 85 },
  { intensity: 100 }
];

const LOADER_MESSAGES = [
  "Setting up architecture...",
  "Initiating high-value synthesis...",
  "Conceptualizing structual solutions...",
  "Drafting tailored expert content...",
  "Formatting precise layout boundaries...",
  "Aligning semantic search models...",
  "Calibrating optimal price vectors...",
  "Preparing final delivery payload..."
];

export default function App() {
  const [selectedProduct, setSelectedProduct] = useState<ProductType>(PRODUCTS[0]);
  const [niche, setNiche] = useState("");
  const [angle, setAngle] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const [batchResults, setBatchResults] = useState<ManufactureResult[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{current: number, total: number} | null>(null);

  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  
  const [archiveView, setArchiveView] = useState(false);
  const [archivedItems, setArchivedItems] = useState<ManufactureResult[]>([]);
  const [selectedArchiveIndices, setSelectedArchiveIndices] = useState<number[]>([]);
  const [useMarkdown, setUseMarkdown] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const [quickViewItem, setQuickViewItem] = useState<ManufactureResult | null>(null);
  const [calculatorState, setCalculatorState] = useState<Record<string, { traffic: string, conversion: string }>>({});
  
  const [language, setLanguage] = useState("English");
  const [watermarkText, setWatermarkText] = useState("");

  const [queueView, setQueueView] = useState(false);
  const [queueTasks, setQueueTasks] = useState<any[]>([]);
  const [isQueueSubmitting, setIsQueueSubmitting] = useState(false);

  const [autonomousStatus, setAutonomousStatus] = useState<any>(null);
  const [isTriggeringAutonomous, setIsTriggeringAutonomous] = useState(false);

  // Voice Speech Transcription & Live Trends States
  const [isListeningNiche, setIsListeningNiche] = useState(false);
  const [isListeningAngle, setIsListeningAngle] = useState(false);
  const [trendsSearchQuery, setTrendsSearchQuery] = useState("");
  const [trendsResults, setTrendsResults] = useState<any[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsError, setTrendsError] = useState<string | null>(null);

  const startSpeechRecognition = (target: "niche" | "angle") => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition is not supported by your browser. Please try Google Chrome or Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language === "English" ? "en-US" : 
                       language === "Spanish" ? "es-ES" :
                       language === "French" ? "fr-FR" :
                       language === "German" ? "de-DE" :
                       language === "Italian" ? "it-IT" :
                       language === "Portuguese" ? "pt-PT" :
                       language === "Dutch" ? "nl-NL" :
                       language === "Japanese" ? "ja-JP" : "en-US";

    if (target === "niche") {
      setIsListeningNiche(true);
    } else {
      setIsListeningAngle(true);
    }

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (target === "niche") {
        setNiche(prev => {
          if (isBatchMode) {
            return prev ? `${prev}\n${transcript}` : transcript;
          } else {
            return prev ? `${prev} ${transcript}` : transcript;
          }
        });
      } else {
        setAngle(prev => prev ? `${prev} ${transcript}` : transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
    };

    recognition.onend = () => {
      if (target === "niche") {
        setIsListeningNiche(false);
      } else {
        setIsListeningAngle(false);
      }
    };

    recognition.start();
  };

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

  const fetchAutonomousStatus = async () => {
    try {
      const res = await fetch("/api/autonomous-status");
      if (res.ok) {
        const data = await res.json();
        setAutonomousStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch autonomous status:", err);
    }
  };

  const handleTriggerAutonomous = async () => {
    setIsTriggeringAutonomous(true);
    try {
      const res = await fetch("/api/autonomous-trigger", { method: "POST" });
      if (res.ok) {
        await fetchAutonomousStatus();
      }
    } catch (err) {
      console.error("Failed to trigger autonomous generator:", err);
    } finally {
      setIsTriggeringAutonomous(false);
    }
  };

  const fetchQueue = async () => {
    try {
      const res = await fetch("/api/queue");
      if (res.ok) {
        const data = await res.json();
        setQueueTasks(data.tasks || []);
      }
    } catch (err) {
      console.error("Failed to fetch queue:", err);
    }
  };

  const handleAddToQueue = async () => {
    const nichesToProcess = isBatchMode 
      ? niche.split('\n').map(n => n.trim()).filter(Boolean)
      : [niche.trim()];

    if (nichesToProcess.length === 0) {
      setError("Please insert a target audience parameter to proceed.");
      return;
    }

    setError(null);
    setIsQueueSubmitting(true);

    try {
      const response = await fetch("/api/queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          niches: nichesToProcess,
          angle: angle.trim() || undefined,
          language,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to add items to queue.");
      }

      await fetchQueue();
      setQueueView(true);
      setArchiveView(false);
      setNiche(""); // clear inputs for smooth UX
    } catch (err: any) {
      setError(err.message || "Failed to queue requests.");
    } finally {
      setIsQueueSubmitting(false);
    }
  };

  const handleDeleteQueueTask = async (id: string) => {
    try {
      await fetch(`/api/queue/tasks/${id}`, { method: "DELETE" });
      fetchQueue();
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  const handleClearFinishedQueue = async () => {
    try {
      await fetch(`/api/queue/clear`, { method: "POST" });
      fetchQueue();
    } catch (err) {
      console.error("Failed to clear queue:", err);
    }
  };

  const syncArchive = async () => {
    try {
      const res = await fetch("/api/archive");
      if (res.ok) {
        const { archive: serverArchive } = await res.json();
        const localSaved = localStorage.getItem('dropkit_archive');
        let localArchive: ManufactureResult[] = [];
        if (localSaved) {
          try { localArchive = JSON.parse(localSaved); } catch (e) {}
        }
        
        const response = await fetch("/api/archive/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: localArchive })
        });
        
        if (response.ok) {
          const { archive: mergedArchive } = await response.json();
          setArchivedItems(mergedArchive);
          localStorage.setItem('dropkit_archive', JSON.stringify(mergedArchive));
        } else {
          setArchivedItems(serverArchive);
          localStorage.setItem('dropkit_archive', JSON.stringify(serverArchive));
        }
      }
    } catch (err) {
      console.error("Failed to sync archive:", err);
      const localSaved = localStorage.getItem('dropkit_archive');
      if (localSaved) {
        try { setArchivedItems(JSON.parse(localSaved)); } catch (e) {}
      }
    }
  };

  useEffect(() => {
    fetchQueue();
    fetchAutonomousStatus();
    syncArchive();
  }, []);

  useEffect(() => {
    const hasActiveQueue = queueTasks.some(t => t.status === "pending" || t.status === "processing");
    const hasActiveAutonomous = autonomousStatus?.isRunning;
    
    if (hasActiveQueue || hasActiveAutonomous) {
      const interval = setInterval(() => {
        if (hasActiveQueue) fetchQueue();
        if (hasActiveAutonomous) fetchAutonomousStatus();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [queueTasks, autonomousStatus]);

  const updateCalculator = (id: string, field: 'traffic' | 'conversion', value: string) => {
    setCalculatorState(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { traffic: "1000", conversion: "2.5" }),
        [field]: value
      }
    }));
  };

  const getComplexityLevel = (text: string) => {
    if (!text) return "Beginner";
    const len = text.split(/\s+/).length;
    const sample = text.substring(0, 2000).toLowerCase();
    if (len > 1500 || sample.includes("expert") || sample.includes("advanced") || sample.includes("comprehensive")) return "Expert";
    if (len > 800 || sample.includes("intermediate") || sample.includes("detailed") || sample.includes("pro")) return "Advanced";
    return "Beginner";
  };

  const handleSaveToArchive = async (item: ManufactureResult) => {
    const isAlreadySaved = archivedItems.some((cached) => cached.productTitle === item.productTitle);
    if (!isAlreadySaved) {
      const updated = [...archivedItems, item];
      setArchivedItems(updated);
      localStorage.setItem('dropkit_archive', JSON.stringify(updated));
      
      try {
        await fetch("/api/archive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item })
        });
      } catch (err) {
        console.error("Failed to save to server archive:", err);
      }
    }
  };

  const handleRemoveFromArchive = async (index: number) => {
    const item = archivedItems[index];
    const updated = archivedItems.filter((_, i) => i !== index);
    setArchivedItems(updated);
    localStorage.setItem('dropkit_archive', JSON.stringify(updated));
    setSelectedArchiveIndices(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i));
    
    if (item && item.productTitle) {
      try {
        await fetch("/api/archive/remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: item.productTitle })
        });
      } catch (err) {
        console.error("Failed to remove from server archive:", err);
      }
    }
  };

  const toggleArchiveSelection = (idx: number) => {
    setSelectedArchiveIndices(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  useEffect(() => {
    let intervalId: any = null;
    if (loading) {
      setLoadingMsgIdx(0);
      intervalId = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADER_MESSAGES.length);
      }, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [loading]);

  useEffect(() => {
    if (isBatchMode || archiveView) {
      setSuggestions([]);
      return;
    }
    if (!niche || niche.length < 2) {
      setSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      const mockTrending = [
        "AI Content Creators",
        "Digital Nomads",
        "Notion Template Designers",
        "SaaS Founders",
        "Fitness Coaches",
        "Real Estate Investors",
        "No-Code Enthusiasts",
        "Remote Work Managers",
        "Indie Game Developers"
      ];
      const results = mockTrending.filter(t => t.toLowerCase().includes(niche.toLowerCase()) && t.toLowerCase() !== niche.toLowerCase());
      setSuggestions(results);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [niche, isBatchMode, archiveView]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (!archiveView && niche.trim() !== "" && !loading) {
          e.preventDefault();
          triggerSubmit();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (!archiveView && batchResults.length > 0) {
          batchResults.forEach(res => handleSaveToArchive(res));
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleCopyText = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(identifier);
    setTimeout(() => {
      setCopiedSection((current) => current === identifier ? null : current);
    }, 2000);
  };

  const handleDownloadProduct = (item: ManufactureResult) => {
    const fileContent = `=== DIGITAL PRODUCT ===
TITLE: ${item.productTitle}
TYPE: ${selectedProduct.name}
AUDIENCE: ${item.originalNiche || niche}
${angle ? `ANGLE: ${angle}` : ""}
========================

${item.productContent}

========================
© Manufactured by DropKit Digital Factory.`;

    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const safeTitle = item.productTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    
    link.download = `${safeTitle || "dropkit-product"}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadHTML = (item: ManufactureResult) => {
    const safeTitle = item.productTitle.replace(/<[^>]*>?/gm, '') || "dropkit-product";
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>\${safeTitle}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; }
        h1 { font-size: 2.25rem; font-weight: 800; margin-bottom: 1rem; }
        .niche { color: #6b7280; font-size: 1rem; margin-bottom: 2rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .content { background: white; padding: 2.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); white-space: pre-wrap; font-size: 1.125rem; }
        .footer { margin-top: 3rem; text-align: center; color: #9ca3af; font-size: 0.875rem; }
    </style>
</head>
<body>
    <h1>\${safeTitle}</h1>
    <div class="niche">Target Audience: \${item.originalNiche || "General"}</div>
    <div class="content">\${item.productContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
    <div class="footer">Manufactured by DropKit Digital Factory</div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `\${safeTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = (item: ManufactureResult) => {
    const doc = new jsPDF();
    
    const addFooter = () => {
      doc.setFontSize(10);
      doc.setTextColor(150);
      const footerText = watermarkText.trim() ? `Manufactured by DropKit • ${watermarkText}` : "Manufactured by DropKit Digital Factory";
      doc.text(footerText, 105, 285, { align: "center" });
      doc.setTextColor(0);
      doc.setFontSize(11);
    };

    // Title Page
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    
    // Use splitTextToSize to handle very long titles
    const titleLines = doc.splitTextToSize(item.productTitle, 180);
    doc.text(titleLines, 105, 100, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.text(`Target Audience: ${item.originalNiche || niche || "General"}`, 105, 130 + (titleLines.length * 10), { align: "center" });

    addFooter();

    // Content Pages
    doc.addPage();
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    addFooter();
    
    const textLines = doc.splitTextToSize(item.productContent, 180);
    
    let y = 20;
    for (let i = 0; i < textLines.length; i++) {
      if (y > 275) {
        doc.addPage();
        addFooter();
        y = 20;
      }
      doc.text(textLines[i], 15, y);
      y += 6;
    }
    
    const safeTitle = item.productTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    doc.save(`${safeTitle || "dropkit-product"}.pdf`);
  };

  const handleDownloadMultiPDF = () => {
    if (selectedArchiveIndices.length === 0) return;
    const doc = new jsPDF();
    let isFirst = true;

    const addFooter = () => {
      doc.setFontSize(10);
      doc.setTextColor(150);
      const footerText = watermarkText.trim() ? `Manufactured by DropKit • ${watermarkText}` : "Manufactured by DropKit Digital Factory";
      doc.text(footerText, 105, 285, { align: "center" });
      doc.setTextColor(0);
      doc.setFontSize(11);
    };

    selectedArchiveIndices.forEach((idx) => {
      const item = archivedItems[idx];
      if (!isFirst) doc.addPage();
      isFirst = false;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      const titleLines = doc.splitTextToSize(item.productTitle, 180);
      doc.text(titleLines, 105, 100, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(14);
      doc.text(`Target Audience: ${item.originalNiche || item.productTitle || "General"}`, 105, 130 + (titleLines.length * 10), { align: "center" });

      addFooter();

      doc.addPage();
      doc.setTextColor(0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      addFooter();

      let y = 20;
      const textLines = doc.splitTextToSize(item.productContent, 180);
      for (let i = 0; i < textLines.length; i++) {
        if (y > 275) {
          doc.addPage();
          addFooter();
          y = 20;
        }
        doc.text(textLines[i], 15, y);
        y += 6;
      }
    });

    doc.save("dropkit-batch-archive.pdf");
    setSelectedArchiveIndices([]);
  };

  const handleDownloadMetadataCSV = () => {
    if (archivedItems.length === 0) return;
    const headers = ["Title", "Niche", "Price", "Gumroad Blurb"];
    const rows = archivedItems.map(item => [
      `"${item.productTitle.replace(/"/g, '""')}"`,
      `"${item.originalNiche || ""}"`,
      `"${item.priceRecommendationValue}"`,
      `"${item.gumroadBlurb.replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = "dropkit_metadata.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const triggerSubmit = async () => {
    const nichesToProcess = isBatchMode 
      ? niche.split('\n').map(n => n.trim()).filter(Boolean)
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
        setBatchProgress({ current: i + 1, total: nichesToProcess.length });
        const currentNiche = nichesToProcess[i];

        const response = await fetch("/api/manufacture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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

        newResults.push({ ...data, originalNiche: currentNiche });
        setBatchResults([...newResults]);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during synthesis.");
    } finally {
      setLoading(false);
      setBatchProgress(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerSubmit();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E0E0E0] font-sans flex flex-col selection:bg-white/10 selection:text-white">
      {/* Header Sticky Bar */}
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
              onClick={() => { setArchiveView(false); setQueueView(false); }}
              className={`pb-1 cursor-pointer transition-colors ${!archiveView && !queueView ? 'text-white border-b border-white/40' : 'hover:text-white'}`}
            >
              Manufacture
            </span>
            <span 
              onClick={() => { setArchiveView(false); setQueueView(true); }}
              className={`pb-1 cursor-pointer transition-colors ${queueView ? 'text-white border-b border-white/40' : 'hover:text-white'}`}
            >
              Queue ({queueTasks.filter(t => t.status === 'pending' || t.status === 'processing').length})
            </span>
            <span 
              onClick={() => { setArchiveView(true); setQueueView(false); }}
              className={`pb-1 cursor-pointer transition-colors ${archiveView ? 'text-white border-b border-white/40' : 'hover:text-white'}`}
            >
              Archive ({archivedItems.length})
            </span>
          </div>
          <div className="hidden sm:flex text-[9px] uppercase tracking-widest text-white/40 border border-white/10 px-4 py-2 items-center justify-center hover:bg-white/5 transition-colors">
            Mk I. System
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 py-16 sm:py-24">
        
        {/* Pitch Hero */}
        {!archiveView && !queueView && (
          <>
            <section className="flex flex-col items-center text-center max-w-3xl mx-auto mb-20 sm:mb-32">
              <div className="w-px h-16 bg-gradient-to-b from-transparent to-white/20 mb-8 pb-4"></div>
              <div className="text-[9px] uppercase tracking-[0.4em] text-white/30 mb-8">
                Digital Provisioning Services
              </div>
              <motion.h1 
                className="text-5xl sm:text-7xl font-light tracking-tight leading-[1] mb-8 text-white/90"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                Manufacture assets <br className="hidden sm:block" />
                <span className="italic font-serif opacity-80 text-white">you can scale eternally.</span>
              </motion.h1>
              
              <motion.p 
                className="text-sm font-light text-white/50 leading-relaxed max-w-xl mx-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.8 }}
              >
                A high-fidelity pipeline generating complete product cores — 30-day planners, 50-prompt suites, or vast strategic guides — natively aligned with comprehensive marketing telemetry for immediate distribution.
              </motion.p>
            </section>

            {/* The Machine Controls */}
            <section className="mb-20 sm:mb-32">
          <div className="w-full max-w-5xl mx-auto border border-white/10 bg-[#0A0A0A] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 text-[9px] uppercase tracking-[0.5em] text-white/10 pointer-events-none hidden sm:block">
              Module A.01 // Input Config
            </div>

            <div className="p-8 sm:p-14">
              
              {/* Step 1 */}
              <div className="mb-14">
                <div className="text-[9px] uppercase tracking-[0.4em] text-white/40 mb-8 flex items-center gap-4">
                  <span>01</span> <div className="h-px bg-white/10 w-8"></div> <span>Architecture Spec</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-px bg-white/10 border border-white/10">
                  {PRODUCTS.map((p) => {
                    const isSelected = selectedProduct.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProduct(p);
                          setBatchResults([]);
                        }}
                        className={`text-left p-8 bg-[#0A0A0A] transition-colors duration-500 relative flex flex-col group ${
                          isSelected ? "bg-[#111111]" : "hover:bg-[#111111]/50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-8">
                          <div className={`p-3 border rounded-full transition-colors flex items-center justify-center ${
                            isSelected ? 'border-white/50 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'border-white/10 text-white/30 group-hover:text-white/60'
                          }`}>
                            {p.ico}
                          </div>
                          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">
                            {p.code}
                          </span>
                        </div>
                        <h3 className="text-lg font-light tracking-wide text-white/90 mb-2">{p.name}</h3>
                        <p className="text-xs text-white/40 font-light leading-relaxed">
                          {p.spec}
                        </p>
                        
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/60" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2 Inputs */}
              <div className="border-t border-white/10 pt-14">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                  <div className="text-[9px] uppercase tracking-[0.4em] text-white/40 flex items-center gap-4">
                    <span>02</span> <div className="h-px bg-white/10 w-8"></div> <span>Boundary Definitions</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] uppercase tracking-[0.3em] text-white/50">Batch Mode</span>
                    <button
                      type="button"
                      onClick={() => setIsBatchMode(!isBatchMode)}
                      className={`w-10 h-5 rounded-full p-1 transition-colors ${isBatchMode ? 'bg-white/90' : 'bg-[#111111] border border-white/20'}`}
                    >
                      <div className={`w-3 h-3 rounded-full bg-[#0A0A0A] transition-transform ${isBatchMode ? 'translate-x-5' : 'translate-x-0 bg-white/50'}`} />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* Niche Input */}
                    <div className="relative">
                      <div className="flex items-center justify-between mb-4">
                        <label htmlFor="niche" className="block text-[9px] uppercase tracking-[0.3em] text-white/40 transition-colors focus-within:text-white/70">
                          Primary Target Audience * {isBatchMode && <span className="text-white/30 lowercase tracking-normal ml-2">(one per line)</span>}
                        </label>
                        <button
                          type="button"
                          onClick={() => startSpeechRecognition("niche")}
                          className={`flex items-center gap-1.5 text-[8px] font-mono uppercase tracking-wider px-2 py-1 border transition-all rounded-sm cursor-pointer ${
                            isListeningNiche 
                              ? "border-red-500/50 bg-red-500/10 text-red-400 animate-pulse" 
                              : "border-white/10 hover:border-white/30 text-white/40 hover:text-white"
                          }`}
                          title="Transcribe Voice Input"
                        >
                          {isListeningNiche ? <MicOff className="w-2.5 h-2.5" /> : <Mic className="w-2.5 h-2.5" />}
                          <span>{isListeningNiche ? "Listening..." : "Voice Input"}</span>
                        </button>
                      </div>

                      {isBatchMode ? (
                        <textarea
                          id="niche"
                          rows={4}
                          className="w-full bg-transparent border border-white/20 px-4 py-3 text-sm font-light text-white/90 placeholder:text-white/20 focus:outline-none focus:border-white transition-colors scrollbar-thin"
                          placeholder={`E.g.,\nIndependent Developers\nCorporate Executives\nVegan Meal Prep Beginners`}
                          value={niche}
                          onChange={(e) => setNiche(e.target.value)}
                          required
                        />
                      ) : (
                        <div className="relative">
                          <input
                            id="niche"
                            type="text"
                            className="w-full bg-transparent border-b border-white/20 px-0 py-3 text-sm font-light text-white/90 placeholder:text-white/20 focus:outline-none focus:border-white transition-colors"
                            placeholder="E.g., Independent Developers, Corporate Executives..."
                            value={niche}
                            onChange={(e) => setNiche(e.target.value)}
                            required
                          />
                          {suggestions.length > 0 && (
                            <div className="absolute top-14 left-0 w-full bg-[#111111] border border-white/10 shadow-2xl z-20 max-h-48 overflow-y-auto scrollbar-thin">
                              {suggestions.map((s, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setNiche(s);
                                    setSuggestions([]);
                                  }}
                                  className="w-full text-left px-4 py-3 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="mt-6 flex flex-wrap gap-2 items-center">
                        <span className="text-[9px] uppercase tracking-[0.3em] text-white/20 mr-2">Preset Index:</span>
                        {PRESET_NICHES.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              if (isBatchMode) {
                                setNiche(prev => prev ? `${prev}\n${preset}` : preset);
                              } else {
                                setNiche(preset);
                              }
                            }}
                            className="text-[9px] px-3 py-1.5 border border-white/10 hover:bg-white/5 hover:text-white text-white/40 transition-colors uppercase tracking-widest cursor-pointer"
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Angle Input */}
                    <div className="relative">
                      <div className="flex items-center justify-between mb-4">
                        <label htmlFor="angle" className="block text-[9px] uppercase tracking-[0.3em] text-white/40 transition-colors focus-within:text-white/70">
                          Creative Vector (Optional)
                        </label>
                        <button
                          type="button"
                          onClick={() => startSpeechRecognition("angle")}
                          className={`flex items-center gap-1.5 text-[8px] font-mono uppercase tracking-wider px-2 py-1 border transition-all rounded-sm cursor-pointer ${
                            isListeningAngle 
                              ? "border-red-500/50 bg-red-500/10 text-red-400 animate-pulse" 
                              : "border-white/10 hover:border-white/30 text-white/40 hover:text-white"
                          }`}
                          title="Transcribe Voice Input"
                        >
                          {isListeningAngle ? <MicOff className="w-2.5 h-2.5" /> : <Mic className="w-2.5 h-2.5" />}
                          <span>{isListeningAngle ? "Listening..." : "Voice Input"}</span>
                        </button>
                      </div>

                      <input
                        id="angle"
                        type="text"
                        className="w-full bg-transparent border-b border-white/20 px-0 py-3 text-sm font-light text-white/90 placeholder:text-white/20 focus:outline-none focus:border-white transition-colors"
                        placeholder="E.g., Academic lens, Notion aesthetics, Faith-based..."
                        value={angle}
                        onChange={(e) => setAngle(e.target.value)}
                      />
                      <p className="mt-4 text-[10px] text-white/30 font-light tracking-wide">
                        Modulates voice, tone, and strategic positioning frameworks.
                      </p>
                    </div>

                    {/* Google Search Live Trend Radar */}
                    <div className="border border-white/10 bg-[#0E0E0E] p-6 sm:p-8 relative overflow-hidden rounded-sm mt-8 col-span-1 md:col-span-2">
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <Globe className="w-24 h-24" />
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                          <h3 className="text-xs uppercase tracking-widest font-mono text-white/90 flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Google Search Live Trend Radar</span>
                          </h3>
                          <p className="text-[10px] text-white/40 mt-1 font-light">
                            Search for real-time trending niches using Google Search grounding.
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-mono uppercase tracking-widest text-emerald-400 px-2 py-0.5 border border-emerald-500/20 bg-emerald-500/5">
                            Search Grounding Enabled
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-3 mb-6">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            className="w-full bg-[#0A0A0A] border border-white/10 focus:border-white/40 px-4 py-2.5 text-xs text-white/90 placeholder:text-white/30 focus:outline-none transition-colors"
                            placeholder="Query, e.g. 'hot digital products for creators', 'ai templates demand', 'micro saas niches'..."
                            value={trendsSearchQuery}
                            onChange={(e) => setTrendsSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSearchTrends();
                              }
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSearchTrends()}
                          disabled={trendsLoading}
                          className="px-5 py-2.5 bg-white text-black hover:bg-white/90 disabled:opacity-50 transition-colors text-[10px] font-mono uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                        >
                          {trendsLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                          <span>{trendsLoading ? "Scanning..." : "Scan Trends"}</span>
                        </button>
                      </div>

                      {trendsError && (
                        <div className="text-xs text-red-400/90 font-mono bg-red-500/5 border border-red-500/20 p-4 mb-6">
                          {trendsError}
                        </div>
                      )}

                      {trendsResults.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                          {trendsResults.map((item, idx) => (
                            <div key={idx} className="border border-white/5 bg-[#0A0A0A] p-4 flex flex-col justify-between hover:border-white/20 transition-all group">
                              <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <h4 className="text-xs font-medium text-white group-hover:text-emerald-400 transition-colors leading-tight">
                                    {item.niche}
                                  </h4>
                                  <span className="text-[8px] font-mono text-white/30">#{idx + 1}</span>
                                </div>
                                <p className="text-[10px] text-white/50 leading-relaxed font-light mb-3">
                                  {item.whyTrending}
                                </p>
                                <div className="border-t border-white/5 pt-2.5 mt-2">
                                  <span className="text-[8px] uppercase tracking-widest text-emerald-400/60 block font-mono mb-1">Concept:</span>
                                  <span className="text-[9px] text-white/70 italic font-serif leading-tight block">
                                    {item.exampleConcept}
                                  </span>
                                </div>
                              </div>
                              
                              <button
                                type="button"
                                onClick={() => {
                                  if (isBatchMode) {
                                    setNiche(prev => prev ? `${prev}\n${item.niche}` : item.niche);
                                  } else {
                                    setNiche(item.niche);
                                  }
                                  if (item.exampleConcept) {
                                    setAngle(item.exampleConcept);
                                  }
                                }}
                                className="w-full text-center mt-4 py-1.5 bg-white/5 hover:bg-white hover:text-black border border-white/10 hover:border-transparent text-[8px] uppercase tracking-widest font-mono text-white/60 transition-all cursor-pointer"
                              >
                                + Deploy Niche
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        !trendsLoading && (
                          <div className="text-center py-6 border border-dashed border-white/5 bg-[#0A0A0A]/50 text-white/30 text-[10px] uppercase tracking-widest font-mono">
                            Scan the radar to discover high-intensity Google Search trends
                          </div>
                        )
                      )}
                    </div>

                    {/* Language Dropdown */}
                    <div className="relative">
                      <label htmlFor="language" className="block text-[9px] uppercase tracking-[0.3em] text-white/40 mb-4 transition-colors focus-within:text-white/70">
                        Output Language
                      </label>
                      <select
                        id="language"
                        className="w-full bg-transparent border-b border-white/20 px-0 py-3 text-sm font-light text-white/90 focus:outline-none focus:border-white transition-colors appearance-none cursor-pointer"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                      >
                        <option value="English" className="bg-[#111]">English</option>
                        <option value="Spanish" className="bg-[#111]">Spanish</option>
                        <option value="French" className="bg-[#111]">French</option>
                        <option value="German" className="bg-[#111]">German</option>
                        <option value="Italian" className="bg-[#111]">Italian</option>
                        <option value="Portuguese" className="bg-[#111]">Portuguese</option>
                        <option value="Dutch" className="bg-[#111]">Dutch</option>
                        <option value="Japanese" className="bg-[#111]">Japanese</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 pt-8 text-white/40">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>

                    {/* PDF Watermark Input */}
                    <div className="relative">
                      <label htmlFor="watermark" className="block text-[9px] uppercase tracking-[0.3em] text-white/40 mb-4 transition-colors focus-within:text-white/70">
                        Global PDF Watermark (Optional)
                      </label>
                      <input
                        id="watermark"
                        type="text"
                        className="w-full bg-transparent border-b border-white/20 px-0 py-3 text-sm font-light text-white/90 placeholder:text-white/20 focus:outline-none focus:border-white transition-colors"
                        placeholder="E.g., Acuity Brand Solutions..."
                        value={watermarkText}
                        onChange={(e) => setWatermarkText(e.target.value)}
                      />
                      <p className="mt-4 text-[10px] text-white/30 font-light tracking-wide">
                        Injected into the footer of all exported payload layers.
                      </p>
                    </div>
                  </div>

                  <div className="pt-10 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-1 bg-white/40 shadow-[0_0_8px_rgba(255,255,255,0.4)]"></div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                        Generates deployment payload sequence.
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                      <button
                        type="submit"
                        disabled={loading || isQueueSubmitting}
                        className="w-full sm:w-auto px-8 py-5 border border-white/20 hover:bg-white hover:text-black transition-all duration-300 text-[10px] uppercase tracking-[0.3em] font-medium disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-4 bg-[#0A0A0A]/50 cursor-pointer"
                      >
                        {loading ? (
                          <>
                            <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                            {isBatchMode && batchProgress ? `Processing ${batchProgress.current}/${batchProgress.total}` : 'Processing...'}
                          </>
                        ) : (
                          <>
                            Instant Synthesis
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleAddToQueue}
                        disabled={loading || isQueueSubmitting}
                        className="w-full sm:w-auto px-8 py-5 border border-white/10 hover:border-white/40 hover:bg-white/5 text-white transition-all duration-300 text-[10px] uppercase tracking-[0.3em] font-medium disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-4 bg-[#111111]/80 cursor-pointer"
                      >
                        {isQueueSubmitting ? (
                          <>
                            <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                            Queueing...
                          </>
                        ) : (
                          <>
                            Queue Background
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Error Notification */}
              {error && (
                <div className="mt-10 p-6 border border-red-900/50 bg-[#1A0505] flex items-start gap-4">
                  <AlertCircle className="w-4 h-4 mt-0.5 text-red-500/80" />
                  <div>
                    <h4 className="text-[10px] uppercase tracking-[0.3em] text-red-400/80 mb-2">System Interruption</h4>
                    <p className="text-xs font-light text-red-200/60 leading-relaxed">{error}</p>
                  </div>
                </div>
              )}

              {/* Loader Panel */}
              <AnimatePresence>
                {loading && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-10 border border-white/5 bg-[#111111] p-16 flex flex-col items-center justify-center text-center">
                      <div className="relative w-10 h-10 mb-8 flex items-center justify-center">
                        <span className="absolute inset-0 border border-white/10 border-t-white/80 rounded-full animate-spin duration-1000" />
                        <div className="w-1 h-1 bg-white/60 rounded-full animate-pulse"></div>
                      </div>
                      <h4 className="text-[10px] uppercase tracking-[0.4em] text-white/80 mb-4">Neural Assembly Active</h4>
                      {isBatchMode && batchProgress && (
                        <div className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-3">
                          Batch: <span className="text-white/90">{batchProgress.current}</span> / <span className="text-white/90">{batchProgress.total}</span>
                        </div>
                      )}
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 animate-pulse font-mono">
                        {LOADER_MESSAGES[loadingMsgIdx]}
                      </p>
                      <div className="w-full max-w-[200px] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mt-8"></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>
        </section>
        </>
        )}


        {/* Task Queue Dashboard */}
        {queueView && (
          <section className="mb-20 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
              <div>
                <h2 className="text-3xl font-light tracking-tight text-white/90 font-serif italic mb-2">
                  Synthesis Task Queue
                </h2>
                <p className="text-sm font-light text-white/50 leading-relaxed max-w-xl">
                  Decentralized background pipeline executing high-fidelity product cores sequentially. Keep this workspace active or exit; operations persist seamlessly.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={fetchQueue}
                  className="text-[9px] uppercase tracking-widest text-white/60 hover:text-white transition-colors flex items-center justify-center gap-2 border border-white/10 px-4 py-2 hover:bg-white/5 cursor-pointer h-9 w-full sm:w-auto"
                >
                  <RefreshCw className="w-3 h-3 animate-[spin_4s_linear_infinite]" /> Refresh
                </button>
                <button
                  onClick={handleClearFinishedQueue}
                  className="text-[9px] uppercase tracking-widest text-red-400/80 hover:text-red-400 transition-colors flex items-center justify-center gap-2 border border-red-900/30 px-4 py-2 hover:bg-red-900/10 cursor-pointer h-9 w-full sm:w-auto whitespace-nowrap"
                >
                  <Trash2 className="w-3 h-3" /> Clear Finished
                </button>
              </div>
            </div>

            {/* Autonomous Scheduled Batch Dashboard */}
            <div className="border border-white/10 bg-[#0E0E0E] p-6 mb-10 relative overflow-hidden">
              {autonomousStatus?.hasApiKey === false && (
                <div className="mb-6 border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-amber-400 tracking-wider uppercase font-mono">GEMINI_API_KEY Missing</h4>
                    <p className="text-[11px] text-white/70 leading-relaxed mt-1">
                      No API Key was detected in your Secrets. Please click the <strong>Settings &gt; Secrets</strong> menu at the top of the workspace editor to add your <strong>GEMINI_API_KEY</strong>, then restart the application.
                    </p>
                  </div>
                </div>
              )}
              <div className="absolute top-0 right-0 p-4">
                <span className="text-[9px] px-2.5 py-1 border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 uppercase tracking-widest font-mono rounded-sm flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${autonomousStatus?.isRunning ? 'animate-ping' : 'animate-pulse'}`} />
                  Hourly Autonomous AI Active
                </span>
              </div>
              
              <div className="mb-6 max-w-2xl">
                <h3 className="text-lg font-light text-white tracking-wide flex items-center gap-2 mb-1.5 font-serif italic">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Scheduled AI Factory Engine
                </h3>
                <p className="text-xs font-light text-white/50 leading-relaxed">
                  Every 60 minutes, the server autonomously brainstorms a trending niche, constructs a batch of all 6 core products, saves them to the archive, writes them to the local workspace, and pushes to your configured GitHub repository.
                </p>
              </div>

              {/* Status and Parameters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-white/5 mb-6">
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-white/40 block mb-1 font-mono">Current Status</span>
                  {autonomousStatus?.isRunning ? (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-amber-400 animate-pulse flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Generating Batch... ({autonomousStatus?.currentProductIndex}/{autonomousStatus?.totalProducts})
                      </span>
                      <p className="text-[10px] font-mono text-white/40">
                        Current Product: <span className="text-white/60">
                          {autonomousStatus?.currentProductIndex === 1 ? "Planner / Workbook" : 
                           autonomousStatus?.currentProductIndex === 2 ? "AI Prompt Pack" : 
                           autonomousStatus?.currentProductIndex === 3 ? "Template Pack" : 
                           autonomousStatus?.currentProductIndex === 4 ? "Mini-Guide / Book" : 
                           autonomousStatus?.currentProductIndex === 5 ? "Checklist System" : 
                           "Swipe File"}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Standing By (Sleep State)
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[9px] uppercase tracking-widest text-white/40 block mb-1 font-mono">Target Niche</span>
                  <span className="text-xs text-white/80 font-serif italic font-medium">
                    {autonomousStatus?.currentNiche || "Waiting for next cycle..."}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] uppercase tracking-widest text-white/40 block mb-1 font-mono">Time Sync (Local)</span>
                  <div className="text-[11px] text-white/60 space-y-0.5 font-mono">
                    <div>Last Run: {autonomousStatus?.lastRunTime ? new Date(autonomousStatus.lastRunTime).toLocaleTimeString() : "Never"}</div>
                    <div>Next Run: {autonomousStatus?.nextRunTime ? new Date(autonomousStatus.nextRunTime).toLocaleTimeString() : "Within 1 hr"}</div>
                  </div>
                </div>
              </div>

              {/* History / Recent Runs */}
              {autonomousStatus?.history && autonomousStatus.history.length > 0 && (
                <div className="pt-4 border-t border-white/5">
                  <span className="text-[9px] uppercase tracking-widest text-white/40 block mb-2 font-mono">Recent Autonomous Batches (Local & GitHub Commits)</span>
                  <div className="max-h-[100px] overflow-y-auto space-y-1.5 pr-2">
                    {autonomousStatus.history.map((run: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-[10px] font-mono border-b border-white/[0.02] pb-1">
                        <span className="text-white/70 truncate max-w-[250px]">{run.niche}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white/40">{new Date(run.timestamp).toLocaleTimeString()}</span>
                          <span className={`px-1.5 py-0.5 rounded-sm text-[8px] uppercase font-bold ${run.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {run.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Control Panel / Override button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5 bg-white/[0.01] -mx-6 -mb-6 p-6">
                <div className="text-[10px] text-white/30 font-light max-w-md">
                  Want to see the autonomous AI build a batch instantly? Click "Force Run Cycle" to trigger the hourly pipeline manually now.
                </div>
                <button
                  onClick={handleTriggerAutonomous}
                  disabled={autonomousStatus?.isRunning || isTriggeringAutonomous}
                  className="w-full sm:w-auto text-[9px] uppercase tracking-widest text-black bg-white hover:bg-white/90 disabled:bg-white/10 disabled:text-white/30 transition-all px-5 py-3 font-semibold cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {autonomousStatus?.isRunning || isTriggeringAutonomous ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" /> Processing AI Pipeline
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" /> Force Run Autonomous Cycle
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Queue Metrics / Counters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <div className="border border-white/10 bg-[#111] p-5 flex flex-col justify-between">
                <span className="text-[9px] uppercase tracking-widest text-white/40 mb-3 block flex items-center gap-1.5"><Clock className="w-3 h-3"/> Pending</span>
                <span className="text-2xl font-light text-white">
                  {queueTasks.filter(t => t.status === "pending").length}
                </span>
              </div>
              <div className="border border-white/10 bg-[#111] p-5 flex flex-col justify-between relative overflow-hidden">
                <span className="text-[9px] uppercase tracking-widest text-amber-400/60 mb-3 block flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block"></span>
                  Processing
                </span>
                <span className="text-2xl font-light text-amber-400/90">
                  {queueTasks.filter(t => t.status === "processing").length}
                </span>
                {queueTasks.some(t => t.status === "processing") && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400/10 via-amber-400 to-amber-400/10 animate-[pulse_2s_infinite]" />
                )}
              </div>
              <div className="border border-white/10 bg-[#111] p-5 flex flex-col justify-between">
                <span className="text-[9px] uppercase tracking-widest text-emerald-400/60 mb-3 block flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3"/> Completed</span>
                <span className="text-2xl font-light text-emerald-400/90">
                  {queueTasks.filter(t => t.status === "completed").length}
                </span>
              </div>
              <div className="border border-white/10 bg-[#111] p-5 flex flex-col justify-between">
                <span className="text-[9px] uppercase tracking-widest text-red-400/60 mb-3 block flex items-center gap-1.5"><AlertCircle className="w-3 h-3"/> Failed</span>
                <span className="text-2xl font-light text-red-400/90">
                  {queueTasks.filter(t => t.status === "failed").length}
                </span>
              </div>
            </div>

            {/* Task list */}
            {queueTasks.length === 0 ? (
              <div className="border border-white/5 bg-[#0A0A0A]/30 p-16 text-center">
                <Layers className="w-8 h-8 text-white/15 mx-auto mb-4" />
                <h3 className="text-xs font-light text-white/50 uppercase tracking-[0.2em] mb-2">Queue is Empty</h3>
                <p className="text-xs font-light text-white/30 max-w-sm mx-auto mb-6">
                  No background synthesis tasks are active. Use the "Manufacture" panel to load niches to the queue.
                </p>
                <button
                  onClick={() => setQueueView(false)}
                  className="text-[9px] uppercase tracking-widest text-[#E0E0E0] hover:text-white transition-colors border border-white/10 px-5 py-2.5 hover:bg-white/5 cursor-pointer inline-flex items-center gap-2"
                >
                  Go to Manufacture <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {queueTasks.map((task) => {
                  const prodType = PRODUCTS.find(p => p.id === task.productId) || PRODUCTS[0];
                  return (
                    <div 
                      key={task.id} 
                      className={`border p-6 bg-[#0E0E0E] transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 ${
                        task.status === 'processing' 
                          ? 'border-amber-500/30 bg-amber-500/[0.02]' 
                          : task.status === 'failed' 
                            ? 'border-red-900/30 bg-red-900/[0.01]' 
                            : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`p-3 border rounded-full flex items-center justify-center mt-1 ${
                          task.status === 'processing' 
                            ? 'border-amber-500/30 text-amber-400' 
                            : task.status === 'completed' 
                              ? 'border-emerald-500/30 text-emerald-400' 
                              : task.status === 'failed' 
                                ? 'border-red-500/30 text-red-400' 
                                : 'border-white/10 text-white/30'
                        }`}>
                          {prodType.ico}
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-serif text-white/90 text-sm font-medium">{task.niche}</span>
                            <span className="text-[9px] px-2 py-0.5 border border-white/10 bg-[#111] text-white/40 uppercase tracking-widest font-mono">
                              {prodType.code}
                            </span>
                            {task.language && (
                              <span className="text-[9px] px-2 py-0.5 border border-white/5 bg-[#111] text-white/30 uppercase tracking-widest font-mono">
                                {task.language}
                              </span>
                            )}
                          </div>
                          
                          {task.angle && (
                            <p className="text-xs font-light text-white/40">
                              <span className="text-[10px] uppercase tracking-wider text-white/20 font-mono">Vector:</span> {task.angle}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-white/30 font-light pt-1">
                            <span>ID: <span className="font-mono text-[9px]">{task.id.slice(0, 8)}</span></span>
                            <span>•</span>
                            <span>Created: {new Date(task.createdAt).toLocaleTimeString()}</span>
                            {task.completedAt && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-400/40">Finished: {new Date(task.completedAt).toLocaleTimeString()}</span>
                              </>
                            )}
                          </div>

                          {task.status === 'failed' && (
                            <p className="text-[10px] font-light text-red-400/80 mt-2 bg-red-950/20 border border-red-900/20 px-3 py-1.5 inline-block">
                              Error: {task.error}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Status / Actions Pane */}
                      <div className="flex items-center gap-3 self-end md:self-auto border-t md:border-t-0 border-white/5 pt-4 md:pt-0 w-full md:w-auto justify-end">
                        {/* Status Label */}
                        <div className="mr-3">
                          {task.status === 'pending' && (
                            <span className="text-[9px] uppercase tracking-widest text-white/30 bg-white/5 border border-white/10 px-3 py-1.5 flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-white/30" /> Queue Position
                            </span>
                          )}
                          {task.status === 'processing' && (
                            <span className="text-[9px] uppercase tracking-widest text-amber-400 bg-amber-500/5 border border-amber-500/20 px-3 py-1.5 flex items-center gap-1.5 animate-pulse">
                              <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" /> Synthesizing
                            </span>
                          )}
                          {task.status === 'completed' && (
                            <span className="text-[9px] uppercase tracking-widest text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 px-3 py-1.5 flex items-center gap-1.5">
                              <Check className="w-3 h-3 text-emerald-400" /> Complete
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        {task.status === 'completed' && task.result && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setQuickViewItem(task.result)}
                              className="text-[9px] uppercase tracking-widest text-[#E0E0E0] hover:text-white transition-colors flex items-center gap-1.5 border border-white/10 px-3 py-1.5 hover:bg-white/5 cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" /> View Result
                            </button>
                            {!archivedItems.some(i => i.productTitle === task.result.productTitle) ? (
                              <button
                                onClick={() => handleSaveToArchive(task.result)}
                                className="text-[9px] uppercase tracking-widest text-emerald-400/80 hover:text-emerald-400 transition-colors flex items-center gap-1.5 border border-emerald-900/30 px-3 py-1.5 hover:bg-emerald-950/20 cursor-pointer"
                                title="Save to local workspace archive"
                              >
                                <Save className="w-3 h-3" /> Archive
                              </button>
                            ) : (
                              <span className="text-[9px] uppercase tracking-widest text-white/30 border border-white/5 px-3 py-1.5 bg-white/[0.02]">
                                Archived
                              </span>
                            )}
                          </div>
                        )}

                        {/* Delete Task */}
                        {task.status !== 'processing' && (
                          <button
                            onClick={() => handleDeleteQueueTask(task.id)}
                            className="text-[9px] uppercase tracking-widest text-red-400/60 hover:text-red-400 transition-colors border border-red-950 p-2 hover:bg-red-950/10 cursor-pointer"
                            title="Remove task from list"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Archive Title if needed */}
        {archiveView && (
          <section className="mb-20 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-4">
              <h2 className="text-3xl font-light tracking-tight text-white/90 font-serif italic">
                Local Archive
              </h2>
              {archivedItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleDownloadMetadataCSV}
                    className="text-[9px] uppercase tracking-widest text-white/40 hover:text-white transition-colors flex items-center gap-2 border border-white/10 px-4 py-2 hover:bg-white/5"
                  >
                    <Download className="w-3 h-3" /> All Metadata (CSV)
                  </button>
                  {selectedArchiveIndices.length > 0 && (
                    <button
                      onClick={handleDownloadMultiPDF}
                      className="text-[9px] uppercase tracking-widest text-[#E0E0E0] hover:text-white transition-colors flex items-center gap-2 border border-white/40 px-4 py-2 hover:bg-white/10"
                    >
                      <FileText className="w-3 h-3" /> Export Selected ({selectedArchiveIndices.length}) PDF
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="text-sm font-light text-white/50 leading-relaxed max-w-xl">
              Persisted payload schemas and synthesized architectures. Readily available for further distribution.
            </p>
            {archivedItems.length > 0 && (
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="border border-white/10 bg-[#111] p-6 flex flex-col justify-between">
                  <span className="text-[9px] uppercase tracking-widest text-white/50 mb-4 block flex items-center gap-2"><Layers className="w-3 h-3"/> Total Assets</span>
                  <span className="text-3xl font-light text-white">{archivedItems.length}</span>
                </div>
                <div className="border border-white/10 bg-[#111] p-6 flex flex-col justify-between">
                  <span className="text-[9px] uppercase tracking-widest text-white/50 mb-4 block flex items-center gap-2"><FileText className="w-3 h-3"/> Total Words Processed</span>
                  <span className="text-3xl font-light text-white">{archivedItems.reduce((acc, item) => acc + (item.productContent?.split(/\\s+/).length || 0), 0).toLocaleString()}</span>
                </div>
                <div className="border border-white/10 bg-[#111] p-6 flex flex-col justify-between">
                  <span className="text-[9px] uppercase tracking-widest text-white/50 mb-4 block flex items-center gap-2"><Coins className="w-3 h-3"/> Average Value</span>
                  <span className="text-3xl font-light text-white">
                    \${(archivedItems.reduce((acc, item) => {
                      const p = parseFloat(item.priceRecommendationValue.replace(/[^0-9.]/g, ''));
                      return acc + (isNaN(p) ? 0 : p);
                    }, 0) / archivedItems.length || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            {archivedItems.length === 0 && (
               <div className="mt-12 p-8 border border-white/5 bg-[#0A0A0A] text-center">
                 <p className="text-xs font-light text-white/30 uppercase tracking-[0.2em]">Archive is empty.</p>
               </div>
            )}
          </section>
        )}

        {/* Quick View Modal */}
        <AnimatePresence>
          {quickViewItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
              onClick={() => setQuickViewItem(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-4xl max-h-[85vh] bg-[#0A0A0A] border border-white/20 overflow-y-auto scrollbar-thin text-white p-10 relative selection:bg-white/10 selection:text-white"
                onClick={e => e.stopPropagation()}
              >
                <button 
                  onClick={() => setQuickViewItem(null)}
                  className="absolute top-6 right-6 text-white/50 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-white/10 pb-6 mb-8">
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 flex items-center justify-center border border-white/10 bg-[#111]">
                       <Sparkles className="w-5 h-5 text-white/80" />
                     </div>
                     <div>
                       <span className="text-[9px] uppercase tracking-[0.4em] text-white/40 mb-2 flex items-center gap-3">
                         Preview Sequence
                         <span className="bg-white/10 px-2 py-0.5 rounded text-white/70">
                           Level: {getComplexityLevel(quickViewItem.productContent)}
                         </span>
                       </span>
                       <h2 className="text-2xl font-light">{quickViewItem.productTitle}</h2>
                     </div>
                   </div>
                   
                   <div className="flex flex-wrap items-center gap-3">
                     <button
                       onClick={() => handleDownloadProduct(quickViewItem)}
                       className="text-[9px] uppercase tracking-widest text-white/60 hover:text-white transition-colors flex items-center gap-2 border border-white/10 px-4 py-2 hover:bg-white/5 cursor-pointer"
                     >
                       <Download className="w-3 h-3" /> TXT
                     </button>
                     <button
                       onClick={() => handleDownloadHTML(quickViewItem)}
                       className="text-[9px] uppercase tracking-widest text-white/60 hover:text-white transition-colors flex items-center gap-2 border border-white/10 px-4 py-2 hover:bg-white/5 cursor-pointer"
                     >
                       <FileText className="w-3 h-3" /> HTML
                     </button>
                     <button
                       onClick={() => handleDownloadPDF(quickViewItem)}
                       className="text-[9px] uppercase tracking-widest text-white/60 hover:text-white transition-colors flex items-center gap-2 border border-white/10 px-4 py-2 hover:bg-white/5 cursor-pointer"
                     >
                       <FileText className="w-3 h-3" /> PDF
                     </button>
                   </div>
                </div>
                <div className="prose prose-invert max-w-none text-white/80 font-light text-sm leading-relaxed whitespace-pre-wrap">
                  {useMarkdown ? (
                    <ReactMarkdown>{quickViewItem.productContent}</ReactMarkdown>
                  ) : (
                    quickViewItem.productContent
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Payload Display Layer */}
        <AnimatePresence>
          {!queueView && (archiveView ? archivedItems : batchResults).length > 0 && (archiveView ? archivedItems : batchResults).map((res, index) => (
            <motion.div
              key={res.productTitle + index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className={`space-y-12 max-w-5xl mx-auto mb-32 ${index > 0 ? "pt-20 border-t border-white/10" : "mt-20"}`}
            >
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-white/10 pb-6">
                <div className="flex items-center gap-6">
                  {archiveView && (
                    <button
                      onClick={() => toggleArchiveSelection(index)}
                      className={`w-5 h-5 flex items-center justify-center border transition-colors ${
                        selectedArchiveIndices.includes(index) 
                          ? 'border-white text-white bg-white/10' 
                          : 'border-white/20 text-transparent hover:border-white/50'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  )}
                  <div className="w-12 h-12 flex items-center justify-center border border-white/10 bg-[#111]">
                    <Sparkles className="w-5 h-5 text-white/80" />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-[0.4em] text-white/40 mb-2 flex items-center gap-3">
                      Synthesis Concluded {isBatchMode && `// Target: ${res.originalNiche}`}
                      <span className="bg-white/10 px-2 py-0.5 rounded text-white/70">
                        Level: {getComplexityLevel(res.productContent)}
                      </span>
                    </span>
                    <h2 className="text-2xl font-light text-white/90 leading-none">{res.productTitle}</h2>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {archiveView && (
                    <button
                      onClick={() => setQuickViewItem(res)}
                      className="text-[9px] uppercase tracking-widest text-[#E0E0E0] hover:text-white transition-colors flex items-center gap-2 border border-white/10 px-4 py-2 hover:bg-white/5"
                    >
                      <ExternalLink className="w-3 h-3" /> Quick View
                    </button>
                  )}
                  {!archiveView && !archivedItems.some(i => i.productTitle === res.productTitle) && (
                    <button
                      onClick={() => handleSaveToArchive(res)}
                      className="text-[9px] uppercase tracking-widest text-[#E0E0E0] hover:text-white transition-colors flex items-center gap-2 border border-white/10 px-4 py-2 hover:bg-white/5"
                    >
                      <Save className="w-3 h-3" /> Save to Archive
                    </button>
                  )}
                  {archiveView && (
                    <button
                      onClick={() => handleRemoveFromArchive(index)}
                      className="text-[9px] uppercase tracking-widest text-red-400/80 hover:text-red-400 transition-colors flex items-center gap-2 border border-red-900/40 px-4 py-2 hover:bg-red-900/20"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  )}
                </div>
              </div>
                       {/* Matrix Layout */}
              <div className="border border-white/10 bg-[#0A0A0A] flex flex-col lg:flex-row">
                
                {/* Primary Column (Product Payload) */}
                <div className="flex-1 border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col">
                  
                  <div className="px-5 sm:px-8 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10">
                    <span className="text-[9px] uppercase tracking-[0.3em] text-white/40">Raw Sequence</span>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      <button
                        onClick={() => handleDownloadProduct(res)}
                        className="text-[9px] uppercase tracking-widest text-white/40 hover:text-white transition-colors flex items-center gap-2 cursor-pointer py-1"
                      >
                        <Download className="w-3 h-3" /> Exfil .TXT 
                      </button>
                      <button
                        onClick={() => handleDownloadHTML(res)}
                        className="text-[9px] uppercase tracking-widest text-white/40 hover:text-white transition-colors flex items-center gap-2 cursor-pointer py-1"
                      >
                        <ExternalLink className="w-3 h-3" /> Export .HTML 
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(res)}
                        className="text-[9px] uppercase tracking-widest text-white/40 hover:text-white transition-colors flex items-center gap-2 cursor-pointer py-1"
                      >
                        <FileText className="w-3 h-3" /> Export .PDF 
                      </button>
                    </div>
                  </div>
 
                  <div className="p-4 sm:p-8 bg-[#111111] flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <span className="text-[10px] text-white/30 font-light tracking-wide flex items-center gap-3">
                        <div className="w-1 h-1 bg-white/20"></div>
                        Rendered payload preview
                      </span>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] uppercase tracking-[0.3em] text-white/50 font-mono">Raw</span>
                            <button
                                type="button"
                                onClick={() => setUseMarkdown(!useMarkdown)}
                                className="w-8 h-4 rounded-full p-0.5 transition-colors bg-[#111111] border border-white/20 cursor-pointer"
                            >
                                <div className={`w-2 h-2 rounded-full bg-white transition-transform ${useMarkdown ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                            <span className="text-[9px] uppercase tracking-[0.3em] text-white/50 font-mono">MD</span>
                        </div>
                        <button
                          onClick={() => handleCopyText(res.productContent, `coreProduct_${index}`)}
                          className="text-[9px] uppercase tracking-widest text-white/50 hover:text-white transition-colors flex items-center gap-2 border border-white/10 px-3 py-1.5 cursor-pointer"
                        >
                          {copiedSection === `coreProduct_${index}` ? (
                            <><Check className="w-3 h-3 text-emerald-400" /> Stored</>
                          ) : (
                            <><Copy className="w-3 h-3" /> Transcribe</>
                          )}
                        </button>
                      </div>
                    </div>
 
                    <div className="max-h-[600px] overflow-y-auto bg-[#0A0A0A] border border-white/5 p-5 sm:p-8 text-sm font-light text-white/60 leading-relaxed scrollbar-thin selection:bg-white/10 selection:text-white">
                      <h1 className="text-xl font-light text-white mb-6 border-b border-white/10 pb-4">
                        {res.productTitle}
                      </h1>
                      {useMarkdown ? (
                        <div className="markdown-body space-y-4 text-white/80">
                          <ReactMarkdown>{res.productContent}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap font-mono text-xs">{res.productContent}</div>
                      )}
                    </div>
                  </div>
                </div>
 
                {/* Secondary Column (Telemetry / Marketing) */}
                <div className="w-full lg:w-[420px] p-5 sm:p-8 flex flex-col gap-10 bg-[#111111]">
                  
                  <div className="border-b border-white/10 pb-3">
                    <span className="text-[9px] uppercase tracking-[0.3em] text-white/40">Market Positioning</span>
                  </div>

                  {/* Title */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[9px] uppercase tracking-widest text-white/50">Optimized Header (Etsy)</span>
                      <button
                        onClick={() => handleCopyText(res.etsyTitle, `etsyTitle_${index}`)}
                        className="text-[9px] uppercase tracking-widest text-white/30 hover:text-white transition-colors"
                      >
                        {copiedSection === `etsyTitle_${index}` ? "Done" : "Copy"}
                      </button>
                    </div>
                    <p className="text-sm font-light text-white/80 leading-relaxed">
                      {res.etsyTitle}
                    </p>
                  </div>

                  {/* Pricing Anchor & Projection */}
                  <div>
                    <span className="text-[9px] uppercase tracking-widest text-white/50 block mb-4">Value Assertion</span>
                    <div className="flex items-baseline gap-3 mb-6">
                      <span className="text-2xl font-light italic font-serif text-white">
                        {res.priceRecommendationValue.split(" ")[0] || "$19"}
                      </span>
                      <span className="text-[10px] text-white/40 font-light tracking-wide uppercase">
                        {res.priceRecommendationValue.substring(res.priceRecommendationValue.indexOf(" ") + 1)}
                      </span>
                    </div>

                    <div className="bg-[#1A1A1A] border border-white/5 p-5">
                      <span className="text-[9px] uppercase tracking-widest text-white/70 mb-4 block flex items-center gap-2"><Coins className="w-3 h-3"/> Revenue Projection</span>
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center text-[10px] gap-2">
                          <span className="text-white/40 uppercase tracking-widest">Est. Traffic/mo</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const current = parseInt(calculatorState[`${res.productTitle}_${index}`]?.traffic || "1000") || 0;
                                updateCalculator(`${res.productTitle}_${index}`, 'traffic', Math.max(0, current - 100).toString());
                              }}
                              className="w-7 h-7 border border-white/10 bg-[#111] text-white flex items-center justify-center hover:bg-white/5 active:bg-white/10 text-sm font-medium rounded-sm cursor-pointer select-none"
                            >
                              -
                            </button>
                            <input 
                              type="number" 
                              className="bg-transparent border-b border-white/20 w-14 text-center outline-none text-white focus:border-white/50 font-mono text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={calculatorState[`${res.productTitle}_${index}`]?.traffic || "1000"} 
                              onChange={e => updateCalculator(`${res.productTitle}_${index}`, 'traffic', e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const current = parseInt(calculatorState[`${res.productTitle}_${index}`]?.traffic || "1000") || 0;
                                updateCalculator(`${res.productTitle}_${index}`, 'traffic', (current + 100).toString());
                              }}
                              className="w-7 h-7 border border-white/10 bg-[#111] text-white flex items-center justify-center hover:bg-white/5 active:bg-white/10 text-sm font-medium rounded-sm cursor-pointer select-none"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[10px] gap-2">
                          <span className="text-white/40 uppercase tracking-widest">Conv. Rate (%)</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const current = parseFloat(calculatorState[`${res.productTitle}_${index}`]?.conversion || "2.5") || 0;
                                updateCalculator(`${res.productTitle}_${index}`, 'conversion', Math.max(0, current - 0.5).toFixed(1));
                              }}
                              className="w-7 h-7 border border-white/10 bg-[#111] text-white flex items-center justify-center hover:bg-white/5 active:bg-white/10 text-sm font-medium rounded-sm cursor-pointer select-none"
                            >
                              -
                            </button>
                            <input 
                              type="number" 
                              step="0.1"
                              className="bg-transparent border-b border-white/20 w-14 text-center outline-none text-white focus:border-white/50 font-mono text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={calculatorState[`${res.productTitle}_${index}`]?.conversion || "2.5"} 
                              onChange={e => updateCalculator(`${res.productTitle}_${index}`, 'conversion', e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const current = parseFloat(calculatorState[`${res.productTitle}_${index}`]?.conversion || "2.5") || 0;
                                updateCalculator(`${res.productTitle}_${index}`, 'conversion', (current + 0.5).toFixed(1));
                              }}
                              className="w-7 h-7 border border-white/10 bg-[#111] text-white flex items-center justify-center hover:bg-white/5 active:bg-white/10 text-sm font-medium rounded-sm cursor-pointer select-none"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-xs mt-2 pt-4 border-t border-white/10 font-mono text-white/80">
                          <span className="text-[9px] font-sans uppercase tracking-widest text-white/40">Proj. MRR</span>
                          <span className="text-[#E0E0E0]">
                            ${(() => {
                              const traf = parseFloat(calculatorState[`${res.productTitle}_${index}`]?.traffic || "1000") || 0;
                              const conv = parseFloat(calculatorState[`${res.productTitle}_${index}`]?.conversion || "2.5") || 0;
                              const priceStr = res.priceRecommendationValue.match(/[\d.]+/);
                              const price = priceStr ? parseFloat(priceStr[0]) : 19;
                              return ((traf * (conv / 100)) * price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Platform Brief */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[9px] uppercase tracking-widest text-white/50">Transmission Brief (Gumroad)</span>
                      <button
                        onClick={() => handleCopyText(res.gumroadBlurb, `gumroadBlurb_${index}`)}
                        className="text-[9px] uppercase tracking-widest text-white/30 hover:text-white transition-colors"
                      >
                         {copiedSection === `gumroadBlurb_${index}` ? "Done" : "Copy"}
                      </button>
                    </div>
                    <p className="text-[13px] font-light italic text-white/60 leading-relaxed">
                      "{res.gumroadBlurb}"
                    </p>
                  </div>

                  {/* Tags */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[9px] uppercase tracking-widest text-white/50">Algorithmic Nodes</span>
                      <button
                        onClick={() => handleCopyText(res.etsyTags.join(", "), `etsyTags_${index}`)}
                        className="text-[9px] uppercase tracking-widest text-white/30 hover:text-white transition-colors"
                      >
                        {copiedSection === `etsyTags_${index}` ? "Done" : "Copy All"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {res.etsyTags.map((tag) => (
                        <span 
                          key={tag} 
                          className="text-[9px] uppercase tracking-widest text-white/40 border border-white/10 px-3 py-1.5 bg-[#0A0A0A]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Block Body Text */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[9px] uppercase tracking-widest text-white/50">Core Synopsis</span>
                      <button
                        onClick={() => handleCopyText(res.listingDescription, `listingDesc_${index}`)}
                        className="text-[9px] uppercase tracking-widest text-white/30 hover:text-white transition-colors"
                      >
                        {copiedSection === `listingDesc_${index}` ? "Done" : "Copy"}
                      </button>
                    </div>
                    <div className="text-xs leading-relaxed font-light text-white/50 bg-[#0A0A0A] border border-white/5 p-6 max-h-[220px] overflow-y-auto scrollbar-thin whitespace-pre-wrap">
                      {res.listingDescription}
                    </div>
                  </div>

                  {/* Market Syndication (Socials) */}
                  <div className="pt-6 border-t border-white/10">
                    <span className="text-[9px] uppercase tracking-widest text-white/50 block mb-6">Market Syndication</span>
                    
                    <div className="flex flex-wrap gap-3">
                      {/* X (Twitter) */}
                      <a href={`https://x.com/intent/tweet?text=Just launched: ${encodeURIComponent(res.productTitle)}! ${encodeURIComponent(res.gumroadBlurb)}`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all text-white/50 hover:text-white group" title="X Integration">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      </a>
                      {/* Instagram */}
                      <button className="w-10 h-10 flex items-center justify-center border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all text-white/50 hover:text-white" title="Instagram Integration">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                      </button>
                      {/* Facebook */}
                       <a href={`https://www.facebook.com/sharer/sharer.php?u=https://dropkit.io&quote=${encodeURIComponent(res.productTitle)}`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all text-white/50 hover:text-white" title="Facebook Integration">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z"/></svg>
                      </a>
                      {/* GitHub */}
                      <a href={`https://gist.github.com/`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all text-white/50 hover:text-white" title="Export to GitHub Gist">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                      </a>
                      {/* TikTok */}
                      <button className="w-10 h-10 flex items-center justify-center border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all text-white/50 hover:text-white" title="TikTok Integration">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93v7.2c0 1.96.65 3.93 1.95 5.37 1.84 2.04 4.77 2.68 7.37 1.63 2.72-1.07 4.54-3.8 4.47-6.75-.02-1.42-.4-2.83-1.12-4.04l-3.87 2.1c.17.65.23 1.34.1 2.01-.18.94-.8 1.76-1.63 2.15-1.22.58-2.73.47-3.84-.28-1.12-.76-1.72-2.1-1.6-3.46.12-1.34.9-2.52 2.13-3.13.38-.19.78-.32 1.2-.38V9.3c-2.3.1-4.52 1.08-6.19 2.72-2.02 1.98-3.11 4.79-3.04 7.63.07 2.94 1.34 5.75 3.55 7.68 2.5 2.16 5.87 3.02 9.17 2.5 3.32-.52 6.27-2.36 8.2-5.07 1.63-2.3 2.5-5.1 2.47-7.96V.02h-4.02c-.06 1.47-.38 2.9-.96 4.24-.55 1.25-1.4 2.37-2.45 3.25-1.07.88-2.31 1.52-3.64 1.84V.02z"/></svg>
                      </button>
                      {/* Pinterest */}
                      <a href={`https://pinterest.com/pin/create/button/?url=https://dropkit.io&description=${encodeURIComponent(res.productTitle)}`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all text-white/50 hover:text-white" title="Pinterest Integration">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.951-7.252 4.168 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.625 0 12.017 0z"/></svg>
                      </a>
                    </div>
                  </div>

                  {/* Growth & Revenue Streams */}
                  <div className="pt-6 border-t border-white/10">
                    <span className="text-[9px] uppercase tracking-widest text-white/50 block mb-6">Growth & Revenue Streams</span>
                    
                    <div className="flex flex-col gap-6">
                      {/* Advertising Framework */}
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[10px] text-white/70">Ad Campaign Strategy</span>
                          <button
                            onClick={() => handleCopyText(`Targeting: ${res.originalNiche || 'General'} based audiences.\nFormat: Short-form video / Carousel.\nHeadline: Stop struggling with [Problem].\nBody: I built ${res.productTitle} to help you achieve [Result] faster. Grab it now for ${res.priceRecommendationValue}.\nCTA: Learn More.`, `adStrategy_${index}`)}
                            className="text-[9px] uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                          >
                            {copiedSection === `adStrategy_${index}` ? "Done" : "Copy"}
                          </button>
                        </div>
                        <div className="text-[10px] font-light text-white/50 leading-relaxed border-l border-white/20 pl-3">
                          Deploy targeted ads to <span className="text-white/80">{res.originalNiche || 'this segment'}</span> using the value assertion. Suggested ad format: short-form video hooking their main pain point.
                        </div>
                      </div>

                      {/* Affiliate Program */}
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[10px] text-white/70">Affiliate Blueprint</span>
                          <button
                            onClick={() => handleCopyText(`Subject: Partner with me on ${res.productTitle} - 50% Commission\n\nHi [Name],\n\nI love your content for ${res.originalNiche || 'this audience'}. I just launched ${res.productTitle} and I'm offering a solid 50% commission for affiliates. Would you be interested in sharing it with your audience?\n\nBest,\n[Your Name]`, `affiliateText_${index}`)}
                            className="text-[9px] uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                          >
                            {copiedSection === `affiliateText_${index}` ? "Done" : "Copy"}
                          </button>
                        </div>
                        <div className="text-[10px] font-light text-white/50 leading-relaxed border-l border-white/20 pl-3">
                          Launch a <span className="text-white/80">50% tier affiliate program</span>. Reach out to influencers and creators in the {res.originalNiche || 'target'} space. Use the template to recruit partners.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vault Actions - Value Adds */}
                  <div className="pt-6 border-t border-white/10">
                    <span className="text-[9px] uppercase tracking-widest text-white/50 block mb-6">Execution Utilities</span>
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => handleCopyText(`Subject: Unlock ${res.productTitle} today\n\nHi [Name],\n\n${res.gumroadBlurb}\n\nGet it here: [Link]\n\nBest,\n[Your Name]`, `emailPromo_${index}`)}
                        className="text-left text-[10px] uppercase tracking-widest text-white/60 hover:text-white transition-colors bg-[#1A1A1A] border border-white/5 p-4 flex items-center justify-between group"
                        title="Copy an automated email sequence template for this product."
                      >
                        <span className="flex items-center gap-3">
                          <Check className={`w-3 h-3 ${copiedSection === `emailPromo_${index}` ? 'text-white' : 'text-white/20 group-hover:text-white/60'}`} />
                          Email Campaign Template
                        </span>
                        <span className="text-[8px] bg-white/5 px-2 py-0.5 rounded text-white/30 hidden sm:block">Value Add</span>
                      </button>
                      
                      <button 
                        onClick={() => handleCopyText(`A sleek, modern 3D abstract render representing ${res.productTitle}. The style is high-end, minimal, dark mode, glowing soft cyan and amber lighting. Clean layout, no text. --ar 16:9`, `imagePrompt_${index}`)}
                        className="text-left text-[10px] uppercase tracking-widest text-white/60 hover:text-white transition-colors bg-[#1A1A1A] border border-white/5 p-4 flex items-center justify-between group"
                        title="Copy an AI Image prompt (Midjourney/DALL-E) to generate a marketing graphic."
                      >
                        <span className="flex items-center gap-3">
                          <Check className={`w-3 h-3 ${copiedSection === `imagePrompt_${index}` ? 'text-white' : 'text-white/20 group-hover:text-white/60'}`} />
                          Promo Graphics Prompt
                        </span>
                        <span className="text-[8px] bg-white/5 px-2 py-0.5 rounded text-white/30 hidden sm:block">Value Add</span>
                      </button>

                      <div className="text-left text-[9px] uppercase tracking-widest text-white/40 pt-2 flex items-center gap-4">
                        <span className="flex items-center gap-2">
                          <div className="w-1 h-1 bg-white/20 rounded-full"></div>
                          {res.productContent.split(/\s+/).length} Words Total
                        </span>
                        <span className="flex items-center gap-2">
                          <div className="w-1 h-1 bg-white/20 rounded-full"></div>
                          {Math.max(1, Math.ceil(res.productContent.split(/\s+/).length / 200))} Min Read
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Protocol Architecture Steps - Only show after last result */}
              {index === (archiveView ? archivedItems : batchResults).length - 1 && !archiveView && (
                <div className="border-t border-white/10 pt-20 mt-20 max-w-5xl mx-auto">
                  <div className="mb-12 flex justify-between items-center">
                    <h3 className="text-xl font-light text-white/90 italic font-serif">Assembly & Distribution Protocol</h3>
                    <div className="text-[9px] uppercase tracking-widest text-white/30 border border-white/10 px-3 py-1.5 flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-white/40"></div> 
                      Live Guidelines
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-12 sm:gap-8">
                    <div className="flex flex-col gap-4">
                      <span className="text-[9px] uppercase tracking-[0.4em] text-white/40 border-b border-white/10 pb-3">Phase I / Exfil</span>
                      <h4 className="text-base font-light text-white/80">Secure the Asset</h4>
                      <p className="text-xs font-light text-white/40 leading-relaxed">
                        Download the raw encoded text manifest. Keep this pure local instance safe before translation.
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-4">
                      <span className="text-[9px] uppercase tracking-[0.4em] text-white/40 border-b border-white/10 pb-3">Phase II / Construct</span>
                      <h4 className="text-base font-light text-white/80">Visual Dress</h4>
                      <p className="text-xs font-light text-white/40 leading-relaxed">
                        Port blueprint into architecture tools (Canva/Notion). Implement structural margins, typography hierarchy, and export to pristine PDF format.
                      </p>
                    </div>

                    <div className="flex flex-col gap-4">
                      <span className="text-[9px] uppercase tracking-[0.4em] text-white/40 border-b border-white/10 pb-3">Phase III / Network</span>
                      <h4 className="text-base font-light text-white/80">Catalog Upload</h4>
                      <p className="text-xs font-light text-white/40 leading-relaxed">
                        Submit the crafted artifact into marketplace circuits using our synthesized SEO tags, titles, and exact conversion copy grids.
                      </p>
                    </div>

                    <div className="flex flex-col gap-4">
                      <span className="text-[9px] uppercase tracking-[0.4em] text-white/40 border-b border-white/10 pb-3">Phase IV / Stack</span>
                      <h4 className="text-base font-light text-white/80">Asset Monopoly</h4>
                      <p className="text-xs font-light text-white/40 leading-relaxed">
                        Iterate the loop. Drop 3 more complementary systems in this sector, package them, and enforce premium bundle anchors.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          ))}
        </AnimatePresence>

        {/* Strategy Context Block */}
        {!archiveView && (
        <section className="mt-32 mb-16 max-w-5xl mx-auto">
          <div className="text-center mb-16 flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-[0.4em] text-white/30 mb-8 block">Fundamental Economics</span>
            <h2 className="text-3xl sm:text-5xl font-light tracking-tight text-white/90 font-serif italic">
              Infinite Leverage Execution
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-white/10">
            
            <div className="bg-[#0A0A0A] p-10 flex flex-col hover:bg-[#111111] transition-colors duration-500">
              <span className="text-4xl font-light italic font-serif text-white/80 mb-6">$0</span>
              <h4 className="text-[10px] uppercase tracking-[0.3em] text-white/60 mb-3">Absolute Zero Cost</h4>
              <p className="text-xs font-light text-white/40 leading-relaxed">
                Distribution bears no mass. Replication requires zero energy expenditure. Profit retention remains uniformly 100%.
              </p>
            </div>

            <div className="bg-[#0A0A0A] p-10 flex flex-col hover:bg-[#111111] transition-colors duration-500">
              <span className="text-4xl font-light italic font-serif text-white/80 mb-6 flex items-baseline"><span className="text-2xl mr-1">$</span>15</span>
              <h4 className="text-[10px] uppercase tracking-[0.3em] text-white/60 mb-3">High Anchoring</h4>
              <p className="text-xs font-light text-white/40 leading-relaxed">
                While light assets command entry velocity, deep matrix templates and architectural frames effortlessly validate premium structures.
              </p>
            </div>

            <div className="bg-[#0A0A0A] p-10 flex flex-col hover:bg-[#111111] transition-colors duration-500">
              <span className="text-4xl font-light italic font-serif text-white/80 mb-6 text-white/90">10<span className="text-xl">%</span></span>
              <h4 className="text-[10px] uppercase tracking-[0.3em] text-white/60 mb-3">Gateway Equilibrium</h4>
              <p className="text-xs font-light text-white/40 leading-relaxed">
                Major processors merely extract nominal tithes. Vast market traffic pools cost fractions compared to physical logistics.
              </p>
            </div>

            <div className="bg-[#0A0A0A] p-10 flex flex-col hover:bg-[#111111] transition-colors duration-500">
              <span className="text-4xl font-light italic font-serif text-white/80 mb-6 mt-1 flex items-center">
                 <div className="relative flex h-8 w-8 mr-3">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/20 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-8 w-8 bg-white/10"></span>
                 </div>
              </span>
              <h4 className="text-[10px] uppercase tracking-[0.3em] text-white/60 mb-3">Non-Stop Operation</h4>
              <p className="text-xs font-light text-white/40 leading-relaxed">
                Rendered nodes process acquisitions independently of creator wake-cycles. A mathematically flawless perpetual mechanism.
              </p>
            </div>

          </div>
        </section>
        )}

      </main>

      {/* Elegant Footer */}
      <footer className="border-t border-white/10 bg-[#0A0A0A]">
        <div className="max-w-[1200px] mx-auto px-10 py-10 flex flex-col sm:flex-row items-center justify-between text-[9px] uppercase tracking-[0.4em] text-white/30 gap-6 text-center sm:text-left">
          <span>DropKit // Manufacture Matrix © 2026</span>
          <span className="opacity-60">Human curation of algorithmic output required before distribution.</span>
        </div>
      </footer>
    </div>
  );
}
