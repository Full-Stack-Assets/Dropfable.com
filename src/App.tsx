import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import ReactMarkdown from "react-markdown";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { QRCodeSVG } from "qrcode.react";
import { PRODUCT_DEFS } from "./products";
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
  ShoppingCart,
  Rocket,
  Edit2,
  Archive,
  Grid,
  List,
  FolderArchive
} from "lucide-react";

interface ProductType {
  id: string;
  ico: React.ReactNode;
  name: string;
  code: string;
  spec: string;
}

// Icons are UI-only, so they live here keyed by the shared product id rather
// than in src/products.ts (which must stay React-free for the server build).
const PRODUCT_ICONS: Record<string, React.ReactNode> = {
  planner: <Calendar className="w-5 h-5" />,
  prompts: <Brain className="w-5 h-5" />,
  templates: <Mail className="w-5 h-5" />,
  guide: <BookOpen className="w-5 h-5" />,
  checklist: <CheckSquare className="w-5 h-5" />,
  swipe: <Layers className="w-5 h-5" />,
  website: <ExternalLink className="w-5 h-5" />
};

// Built from the shared catalog (src/products.ts). `name`/`spec` map to the
// catalog's `label`/`blurb`; the long Gemini spec stays server-side.
const PRODUCTS: ProductType[] = PRODUCT_DEFS.map((p) => ({
  id: p.id,
  ico: PRODUCT_ICONS[p.id],
  name: p.label,
  code: p.code,
  spec: p.blurb
}));

const TARGET_AUDIENCES = [
  "AI Content Creators", "Digital Nomads", "Notion Template Designers", "SaaS Founders", 
  "Fitness Coaches", "Real Estate Investors", "No-Code Enthusiasts", "Remote Work Managers", 
  "Indie Game Developers", "Freelance Graphic Designers", "SEO Specialists", "Copywriters", 
  "E-commerce Store Owners", "Airbnb Hosts", "Yoga Instructors", "Personal Finance Bloggers", 
  "Podcast Hosts", "Life Coaches", "Wedding Photographers", "UX/UI Designers", 
  "Social Media Managers", "Virtual Assistants", "Dropshippers", "Indie Authors", 
  "Online Course Creators", "Data Analysts", "Web3 Developers", "Event Planners", 
  "Career Counselors", "Nutritionists", "Language Tutors", "Interior Designers", 
  "Pet Startup Founders", "Local Restaurant Owners", "Marketing Agency Owners", 
  "Mobile App Developers", "Newsletter Creators", "Vloggers/YouTubers", "Music Producers", 
  "Travel Bloggers", "B2B Sales Professionals", "Cybersecurity Consultants"
];

interface ManufactureResult {
  productTitle: string;
  productContent: string;
  etsyTitle: string;
  priceRecommendationValue: string;
  listingDescription: string;
  etsyTags: string[];
  gumroadBlurb: string;
  growthTactics?: string;
  originalNiche?: string;
  coverImage?: string;
  versions?: { date: string; productTitle: string; }[];
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

// Persisted archive key. Renamed from the legacy "dropkit_archive"; existing
// archives are migrated to the new key on first load (see effect in App()).
const ARCHIVE_KEY = "nichesmith_archive";
const LEGACY_ARCHIVE_KEY = "dropkit_archive";

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
  
  const [targetOffset, setTargetOffset] = useState(0);
  const [discoveries, setDiscoveries] = useState<string[]>([]);
  const [isPushingNotion, setIsPushingNotion] = useState<Record<number, boolean>>({});
  
  const [generateAllProducts, setGenerateAllProducts] = useState(false);
  const [isPrinterFriendly, setIsPrinterFriendly] = useState(false);
  const [enablePageBreaks, setEnablePageBreaks] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState<Record<number, boolean>>({});
  const [isFetchingTrends, setIsFetchingTrends] = useState(false);
  
  const [viewMode, setViewMode] = useState<'comfort' | 'compact'>('comfort');
  const [archiveGrouping, setArchiveGrouping] = useState<'list' | 'clusters'>('list');
  const [archiveSearchQuery, setArchiveSearchQuery] = useState("");
  const [isPushingShopify, setIsPushingShopify] = useState<Record<number, boolean>>({});
  const [editTitleIndex, setEditTitleIndex] = useState<number | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [showVersionsIndex, setShowVersionsIndex] = useState<number | null>(null);
  
  const [showArchiveSettings, setShowArchiveSettings] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [qrCodeData, setQrCodeData] = useState<Record<number, string>>({});

  useEffect(() => {
    // Pick 3 random for discoveries initially, and rotate every 15s
    const pickRandom = () => {
      const shuffled = [...TARGET_AUDIENCES].sort(() => 0.5 - Math.random());
      setDiscoveries(shuffled.slice(0, 3));
    };
    pickRandom();
    const inv = setInterval(pickRandom, 15000);
    return () => clearInterval(inv);
  }, []);

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

  const getAssetRecommendations = (title: string, niche: string, currentProdName: string) => {
    const text = (title + ' ' + (niche || '')).toLowerCase();
    const scores = PRODUCTS.map(p => ({ p, score: 1 }));
    scores.forEach(s => {
      const n = s.p.name.toLowerCase();
      if (text.includes(n.split(' ')[0])) s.score += 2;
      if (text.includes('planner') && n.includes('checklist')) s.score += 1;
      if (text.includes('copy') && n.includes('prompts')) s.score += 1;
      s.score += Math.random() * 0.5; // slight randomization for tie breakers
    });
    return scores
      .filter(s => s.p.name !== currentProdName)
      .sort((a,b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.p);
  };

  const calculateSEOScore = (title: string, tags: string[]) => {
    let score = 100;
    const tips: string[] = [];

    if (title.length < 40) {
      score -= 20;
      tips.push("Title is very short. Add more descriptive keywords.");
    } else if (title.length > 130) {
      score -= 5;
      tips.push("Title is quite long, front-load keywords.");
    }

    if (tags.length < 13) {
      score -= (13 - tags.length) * 5;
      tips.push(`Use all 13 Etsy tags (you have ${tags.length}).`);
    }

    const multiWordTags = tags.filter(t => t.trim().split(' ').length > 1);
    if (multiWordTags.length < 5) {
      score -= 10;
      tips.push("Add more multi-word tags.");
    }

    return { score: Math.max(0, score), tips };
  };

  const handleCopyArchiveJSON = () => {
    const dataStr = localStorage.getItem(ARCHIVE_KEY);
    if (!dataStr) {
      alert("Archive is empty.");
      return;
    }
    handleCopyText(dataStr, 'copy_archive_json');
  };

  const handleBackupArchive = () => {
    const dataStr = localStorage.getItem(ARCHIVE_KEY);
    if (!dataStr) {
      alert("Archive is empty.");
      return;
    }
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'assetforge_archive_backup.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    document.body.appendChild(linkElement);
    linkElement.click();
    document.body.removeChild(linkElement);
  };

  // Build a single, self-contained Markdown document (full product content +
  // Etsy/Gumroad sales copy) for one archived item — mirrors the per-product
  // download but bundled for the "Download All Files" ZIP.
  const buildProductMarkdown = (item: ManufactureResult): string => {
    const tags = Array.isArray(item.etsyTags) ? item.etsyTags.join(", ") : (item.etsyTags || "");
    return [
      item.productContent || "",
      "\n\n---\n\n## 📦 Sales Copy & Listing Metadata\n",
      `**Target Audience / Niche:** ${item.originalNiche || "—"}`,
      `\n**Recommended Price:** ${item.priceRecommendationValue || "—"}`,
      `\n### Etsy Title\n${item.etsyTitle || "—"}`,
      `\n### Etsy Tags (${Array.isArray(item.etsyTags) ? item.etsyTags.length : 0})\n${tags}`,
      `\n### Listing Description\n${item.listingDescription || "—"}`,
      `\n### Gumroad Blurb\n${item.gumroadBlurb || "—"}`,
      `\n### 3-Month Growth Roadmap\n${item.growthTactics || "—"}`,
      "\n\n---\n_Manufactured by Full Stack Assets · DropKit_\n",
    ].join("\n");
  };

  const [isZipping, setIsZipping] = useState(false);

  // Bundle every archived product into one ZIP: a Markdown file per item (plus
  // its cover image when present) and an index. One click, one download.
  const handleDownloadAllFiles = async () => {
    if (archivedItems.length === 0) {
      alert("Archive is empty.");
      return;
    }
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const slug = (s: string) =>
        (s || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
      const pad = (n: number) => String(n).padStart(2, "0");

      let index = `# DropKit Archive — ${archivedItems.length} Products\n\n`;
      const usedNames = new Set<string>();

      archivedItems.forEach((item, i) => {
        let base = `${pad(i + 1)}-${slug(item.productTitle) || "product"}`;
        while (usedNames.has(base)) base += "-x";
        usedNames.add(base);

        zip.file(`${base}.md`, buildProductMarkdown(item));
        index += `${i + 1}. [${item.originalNiche || "—"}] ${item.productTitle || "Untitled"} — ${base}.md\n`;

        // Embed cover art as a sibling image when one was generated.
        const cover = item.coverImage;
        if (cover && cover.startsWith("data:")) {
          const comma = cover.indexOf(",");
          const meta = cover.slice(5, comma); // e.g. image/png;base64
          const b64 = cover.slice(comma + 1);
          const ext = meta.includes("png") ? "png" : meta.includes("webp") ? "webp" : "jpg";
          zip.file(`${base}.${ext}`, b64, { base64: true });
        }
      });

      zip.file("00-INDEX.md", index);

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "dropkit_archive_documents.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("Could not build ZIP: " + (e?.message || e));
    } finally {
      setIsZipping(false);
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportArchive = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const fileReader = new FileReader();
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = e => {
        if (e.target?.result) {
          try {
            const data = JSON.parse(e.target.result as string);
            if (Array.isArray(data)) {
              setArchivedItems(data);
              localStorage.setItem(ARCHIVE_KEY, JSON.stringify(data));
              alert("Backup restored successfully.");
            } else {
              alert("Invalid backup file format.");
            }
          } catch (err) {
            alert("Error parsing backup file.");
          }
        }
      };
      
      // reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  useEffect(() => {
    let saved = localStorage.getItem(ARCHIVE_KEY);
    // One-time migration from the pre-rename key so saved archives survive.
    if (!saved) {
      const legacy = localStorage.getItem(LEGACY_ARCHIVE_KEY);
      if (legacy) {
        localStorage.setItem(ARCHIVE_KEY, legacy);
        saved = legacy;
      }
    }
    if (saved) {
      try { setArchivedItems(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const handleSaveToArchive = (item: ManufactureResult) => {
    const isAlreadySaved = archivedItems.some((cached) => cached.productTitle === item.productTitle);
    if (!isAlreadySaved) {
      const updated = [...archivedItems, item];
      setArchivedItems(updated);
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated));
    }
  };

  const handleRemoveFromArchive = (index: number) => {
    const updated = archivedItems.filter((_, i) => i !== index);
    setArchivedItems(updated);
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated));
    setSelectedArchiveIndices(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i));
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
      const results = TARGET_AUDIENCES.filter(t => t.toLowerCase().includes(niche.toLowerCase()) && t.toLowerCase() !== niche.toLowerCase());
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
© Manufactured by Full Stack Assets.`;

    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const safeTitle = item.productTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    
    link.download = `${safeTitle || "assetforge-product"}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadHTML = (item: ManufactureResult) => {
    const safeTitle = item.productTitle.replace(/<[^>]*>?/gm, '') || "assetforge-product";
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
    <div class="footer">Manufactured by Full Stack Assets</div>
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
      const footerText = watermarkText.trim() ? `Manufactured by Full Stack Assets • ${watermarkText}` : "Manufactured by Full Stack Assets";
      doc.text(footerText, 105, 285, { align: "center" });

      if (logoUrl.trim()) {
        try {
          doc.addImage(logoUrl.trim(), "PNG", 95, 268, 20, 10);
        } catch (e) {
          console.error("PDF Logo Image Error", e);
        }
      }

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
    const audienceY = 120 + (titleLines.length * 10);
    doc.text(`Target Audience: ${item.originalNiche || niche || "General"}`, 105, audienceY, { align: "center" });

    if (item.coverImage) {
      try {
        // aspect ratio is 4:3, so w=160, h=120
        doc.addImage(item.coverImage, "JPEG", 25, audienceY + 15, 160, 120);
      } catch (e) {
        console.error("PDF Image Error", e);
      }
    }

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

    doc.save(`${safeTitle || "assetforge-product"}.pdf`);
  };

  const handleDownloadMultiPDF = () => {
    if (selectedArchiveIndices.length === 0) return;
    const doc = new jsPDF();
    let isFirst = true;

    const addFooter = () => {
      doc.setFontSize(10);
      doc.setTextColor(150);
      const footerText = watermarkText.trim() ? `Manufactured by Full Stack Assets • ${watermarkText}` : "Manufactured by Full Stack Assets";
      doc.text(footerText, 105, 285, { align: "center" });

      if (logoUrl.trim()) {
        try {
          doc.addImage(logoUrl.trim(), "PNG", 95, 268, 20, 10);
        } catch (e) {
          console.error("PDF Logo Image Error", e);
        }
      }

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
      const audienceY = 120 + (titleLines.length * 10);
      doc.text(`Target Audience: ${item.originalNiche || item.productTitle || "General"}`, 105, audienceY, { align: "center" });

      if (item.coverImage) {
        try {
          doc.addImage(item.coverImage, "JPEG", 25, audienceY + 15, 160, 120);
        } catch (e) {
          console.error("PDF Image Error", e);
        }
      }

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

    doc.save("assetforge-batch-archive.pdf");
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
    link.download = "assetforge_metadata.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePushToNotion = async (item: ManufactureResult, index: number) => {
    setIsPushingNotion(prev => ({ ...prev, [index]: true }));
    try {
      const res = await fetch("/api/notion/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.productTitle,
          content: item.productContent,
          targetAudience: item.originalNiche || "General"
        }),
      });

      const data = await parseJsonResponse(res);
      if (!res.ok) {
        alert("Notion Push Failed: " + (data.error || "Unknown error"));
      } else {
        alert("Successfully pushed to Notion! URL: " + data.url);
      }
    } catch (e: any) {
      alert("Error contacting server: " + e.message);
    } finally {
      setIsPushingNotion(prev => ({ ...prev, [index]: false }));
    }
  };

  const handlePushToShopify = async (item: ManufactureResult, index: number) => {
    setIsPushingShopify(prev => ({ ...prev, [index]: true }));
    try {
      const res = await fetch("/api/shopify/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.productTitle,
          description: item.listingDescription.replace(/\n/g, '<br/>'),
          price: item.priceRecommendationValue
        }),
      });

      const data = await parseJsonResponse(res);
      if (!res.ok) {
        alert("Shopify Push Failed: " + (data.error || "Unknown error"));
      } else {
        alert("Successfully pushed to Shopify! Product Admin URL: " + data.url);
      }
    } catch (e: any) {
      alert("Error contacting server: " + e.message);
    } finally {
      setIsPushingShopify(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleSaveTitle = (index: number) => {
    if (!archiveView) return; // Only allowed in archive
    const newTitle = editTitleValue.trim();
    if (!newTitle) return;

    const oldItem = archivedItems[index];
    if (oldItem.productTitle === newTitle) {
      setEditTitleIndex(null);
      return;
    }

    const updated = [...archivedItems];
    const newVersions = oldItem.versions ? [...oldItem.versions] : [];
    newVersions.unshift({
      date: new Date().toISOString(),
      productTitle: oldItem.productTitle
    });

    updated[index] = { ...oldItem, productTitle: newTitle, versions: newVersions };
    setArchivedItems(updated);
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated));
    setEditTitleIndex(null);
  };

  const handleRestoreVersion = (archiveIndex: number, versionIndex: number) => {
    const oldItem = archivedItems[archiveIndex];
    if (!oldItem.versions || oldItem.versions.length <= versionIndex) return;
    
    const versionToRestore = oldItem.versions[versionIndex];
    
    const updated = [...archivedItems];
    const newVersions = [...oldItem.versions];
    
    // remove the one we are restoring, and add the current to the top
    newVersions.splice(versionIndex, 1);
    newVersions.unshift({
      date: new Date().toISOString(),
      productTitle: oldItem.productTitle
    });

    updated[archiveIndex] = { ...oldItem, productTitle: versionToRestore.productTitle, versions: newVersions };
    setArchivedItems(updated);
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated));
  };

  const handleFetchTrends = async () => {
    setIsFetchingTrends(true);
    try {
      const res = await fetch("/api/trends");
      const data = await parseJsonResponse(res);
      if (data.trends && data.trends.length > 0) {
         setSuggestions(data.trends);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsFetchingTrends(false);
    }
  };

  const handleGenerateCover = async (item: ManufactureResult, index: number, isArchived: boolean = false) => {
    setIsGeneratingCover(prev => ({ ...prev, [index]: true }));
    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productTitle: item.productTitle,
          niche: item.originalNiche || niche
        }),
      });

      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate image");
      }

      const updatedItem = { ...item, coverImage: data.imageUrl };
      
      if (isArchived) {
        const newArchived = [...archivedItems];
        newArchived[index] = updatedItem;
        setArchivedItems(newArchived);
        localStorage.setItem(ARCHIVE_KEY, JSON.stringify(newArchived));
      } else {
        const newBatch = [...batchResults];
        newBatch[index] = updatedItem;
        setBatchResults(newBatch);
      }
    } catch (e: any) {
      alert("Cover Art Error: " + e.message);
    } finally {
      setIsGeneratingCover(prev => ({ ...prev, [index]: false }));
    }
  };

  const triggerSubmit = async (overrideNiche?: string) => {
    const activeNiche = overrideNiche || niche;
    const nichesToProcess = isBatchMode 
      ? activeNiche.split('\n').map(n => n.trim()).filter(Boolean)
      : [activeNiche.trim()];

    if (nichesToProcess.length === 0) {
      setError("Please insert a target audience parameter to proceed.");
      return;
    }

    setError(null);
    setLoading(true);
    setBatchResults([]);

    try {
      const newResults: ManufactureResult[] = [];
      const productsToProcess = generateAllProducts ? PRODUCTS : [selectedProduct];
      
      let currentIdx = 0;
      const totalSteps = nichesToProcess.length * productsToProcess.length;

      for (let i = 0; i < nichesToProcess.length; i++) {
        const currentNiche = nichesToProcess[i];
        
        for (let j = 0; j < productsToProcess.length; j++) {
          const currentProduct = productsToProcess[j];
          currentIdx++;
          setBatchProgress({ current: currentIdx, total: totalSteps });

          const response = await fetch("/api/manufacture", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              productId: currentProduct.id,
              niche: currentNiche,
              angle: angle.trim() || undefined,
              language: language !== "English" ? language : undefined,
            }),
          });

          const data = await parseJsonResponse(response);

          if (!response.ok) {
            throw new Error(data.error || `Failed to process synthesis for: ${currentNiche} (${currentProduct.name})`);
          }

          newResults.push({ ...data, originalNiche: currentNiche });
          setBatchResults([...newResults]);
        }
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
    <div className="min-h-screen bg-base text-ink font-sans flex flex-col selection:bg-white/10 selection:text-white">
      {/* Header Sticky Bar */}
      <header className="sticky top-0 z-50 bg-base/90 backdrop-blur-md border-b border-bord flex-shrink-0">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 py-6 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">
          <div className="flex items-center gap-8">
            <div className="text-[10px] sm:text-xs tracking-[0.4em] font-medium uppercase text-white/90 flex items-center gap-4">
              <span>Full Stack Assets</span>
              <span className="text-white/30 hidden sm:inline">/ Nichesmith</span>
            </div>
            {/* Trending Niche Intensity Sparkline */}
            <div className="hidden lg:flex flex-col w-24 opacity-80 border-l border-bord pl-6 ml-2">
              <span className="text-[8px] uppercase tracking-widest text-mut mb-1 flex items-center gap-1">Trend <Sparkles className="w-2 h-2"/></span>
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
              onClick={() => setArchiveView(false)}
              className={`pb-1 cursor-pointer transition-colors ${!archiveView ? 'text-white border-b border-white/40' : 'hover:text-white'}`}
            >
              Manufacture
            </span>
            <span 
              onClick={() => setArchiveView(true)}
              className={`pb-1 cursor-pointer transition-colors ${archiveView ? 'text-white border-b border-white/40' : 'hover:text-white'}`}
            >
              Archive ({archivedItems.length})
            </span>
          </div>
          <div className="hidden sm:flex text-[9px] uppercase tracking-widest text-mut border border-bord px-4 py-2 items-center justify-center hover:bg-white/5 transition-colors">
            Mk I. System
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 py-16 sm:py-24">
        
        {/* Pitch Hero */}
        {!archiveView && (
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

            {/* Niche Discovery Section */}
            <motion.section 
              className="max-w-5xl mx-auto mb-16 border border-white/5 bg-surface p-6 relative overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                <div className="flex-1">
                  <span className="text-[9px] uppercase tracking-widest text-ink mb-2 block flex items-center gap-2">
                    <Sparkles className="w-3 h-3"/> Niche Discovery Engine
                  </span>
                  <p className="text-xs font-light text-white/50">
                    Live trending segments detected in the market globally. Click any to lock it in and auto-initiate synthesis.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <AnimatePresence mode="popLayout">
                    {discoveries.map((nicheItem) => (
                      <motion.button
                        key={nicheItem}
                        onClick={() => {
                          setNiche(nicheItem);
                          // Ensure we aren't in batch mode to prevent weird text area appending issue
                          setIsBatchMode(false);
                          setTimeout(() => triggerSubmit(nicheItem), 50);
                        }}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="px-4 py-2 bg-white/5 border border-bord hover:bg-white/10 text-white text-xs whitespace-nowrap transition-colors"
                      >
                        {nicheItem}
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </motion.section>

            {/* The Machine Controls */}
            <section className="mb-20 sm:mb-32">
          <div className="w-full max-w-5xl mx-auto border border-bord bg-base relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 text-[9px] uppercase tracking-[0.5em] text-white/10 pointer-events-none hidden sm:block">
              Module A.01 // Input Config
            </div>

            <div className="p-8 sm:p-14">
              
              {/* Step 1 */}
              <div className="mb-14">
                <div className="text-[9px] uppercase tracking-[0.4em] text-mut mb-8 flex items-center gap-4">
                  <span>01</span> <div className="h-px bg-white/10 w-8"></div> <span>Architecture Spec</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-px bg-white/10 border border-bord">
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
                        className={`text-left p-8 bg-base transition-colors duration-500 relative flex flex-col group ${
                          isSelected ? "bg-surface" : "hover:bg-surface/50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-8">
                          <div className={`p-3 border rounded-full transition-colors flex items-center justify-center ${
                            isSelected ? 'border-white/50 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'border-bord text-white/30 group-hover:text-white/60'
                          }`}>
                            {p.ico}
                          </div>
                          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">
                            {p.code}
                          </span>
                        </div>
                        <h3 className="text-lg font-light tracking-wide text-white/90 mb-2">{p.name}</h3>
                        <p className="text-xs text-mut font-light leading-relaxed">
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
              <div className="border-t border-bord pt-14">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                  <div className="text-[9px] uppercase tracking-[0.4em] text-mut flex items-center gap-4">
                    <span>02</span> <div className="h-px bg-white/10 w-8"></div> <span>Boundary Definitions</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] uppercase tracking-[0.3em] text-white/50" title="Generate every product type for this niche">Full Suite (All Types)</span>
                      <button
                        type="button"
                        onClick={() => setGenerateAllProducts(!generateAllProducts)}
                        className={`w-10 h-5 rounded-full p-1 transition-colors ${generateAllProducts ? 'bg-white/90' : 'bg-surface border border-white/20'}`}
                      >
                        <div className={`w-3 h-3 rounded-full bg-base transition-transform ${generateAllProducts ? 'translate-x-5' : 'translate-x-0 bg-white/50'}`} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] uppercase tracking-[0.3em] text-white/50">Batch Mode</span>
                      <button
                        type="button"
                        onClick={() => setIsBatchMode(!isBatchMode)}
                        className={`w-10 h-5 rounded-full p-1 transition-colors ${isBatchMode ? 'bg-white/90' : 'bg-surface border border-white/20'}`}
                      >
                        <div className={`w-3 h-3 rounded-full bg-base transition-transform ${isBatchMode ? 'translate-x-5' : 'translate-x-0 bg-white/50'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* Niche Input */}
                    <div className="relative">
                      <div className="flex items-center justify-between mb-4">
                        <label htmlFor="niche" className="block text-[9px] uppercase tracking-[0.3em] text-mut transition-colors focus-within:text-white/70">
                          Primary Target Audience * {isBatchMode && <span className="text-white/30 lowercase tracking-normal ml-2">(one per line)</span>}
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="text-[9px] uppercase tracking-widest text-ink hover:text-white transition-colors flex items-center gap-1 bg-white/5 px-2 py-1"
                            onClick={() => {
                              const randomNiche = TARGET_AUDIENCES[Math.floor(Math.random() * TARGET_AUDIENCES.length)];
                              setNiche(isBatchMode ? (niche ? `${niche}\n${randomNiche}` : randomNiche) : randomNiche);
                            }}
                          >
                            Random
                          </button>
                          <button
                            type="button"
                            onClick={handleFetchTrends}
                            disabled={isFetchingTrends}
                            className="text-[9px] uppercase tracking-widest text-ink hover:text-white transition-colors flex items-center gap-1 bg-white/5 px-2 py-1"
                          >
                            <Sparkles className="w-3 h-3" /> {isFetchingTrends ? 'Fetching...' : 'Auto-Suggest Niche'}
                          </button>
                        </div>
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
                            <div className="absolute top-14 left-0 w-full bg-surface border border-bord shadow-2xl z-20 max-h-48 overflow-y-auto scrollbar-thin">
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
                        {TARGET_AUDIENCES.slice(targetOffset, targetOffset + 4).map((preset) => (
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
                            className="text-[9px] px-3 py-1.5 border border-bord hover:bg-white/5 hover:text-white text-mut transition-colors uppercase tracking-widest cursor-pointer"
                          >
                            + {preset}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setTargetOffset((prev) => (prev + 4 >= TARGET_AUDIENCES.length ? 0 : prev + 4))}
                          className="text-[9px] px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white transition-colors uppercase tracking-widest cursor-pointer ml-auto"
                        >
                          ↻ Rotate
                        </button>
                      </div>
                    </div>

                    {/* Angle Input */}
                    <div className="relative">
                      <label htmlFor="angle" className="block text-[9px] uppercase tracking-[0.3em] text-mut mb-4 transition-colors focus-within:text-white/70">
                        Creative Vector (Optional)
                      </label>
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

                    {/* Language Dropdown */}
                    <div className="relative">
                      <label htmlFor="language" className="block text-[9px] uppercase tracking-[0.3em] text-mut mb-4 transition-colors focus-within:text-white/70">
                        Output Language
                      </label>
                      <select
                        id="language"
                        className="w-full bg-transparent border-b border-white/20 px-0 py-3 text-sm font-light text-white/90 focus:outline-none focus:border-white transition-colors appearance-none cursor-pointer"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                      >
                        <option value="English" className="bg-surface">English</option>
                        <option value="Spanish" className="bg-surface">Spanish</option>
                        <option value="French" className="bg-surface">French</option>
                        <option value="German" className="bg-surface">German</option>
                        <option value="Italian" className="bg-surface">Italian</option>
                        <option value="Portuguese" className="bg-surface">Portuguese</option>
                        <option value="Dutch" className="bg-surface">Dutch</option>
                        <option value="Japanese" className="bg-surface">Japanese</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 pt-8 text-mut">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>

                    {/* PDF Watermark Input */}
                    <div className="relative">
                      <label htmlFor="watermark" className="block text-[9px] uppercase tracking-[0.3em] text-mut mb-4 transition-colors focus-within:text-white/70">
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
                      <span className="text-[10px] uppercase tracking-[0.2em] text-mut">
                        Generates deployment payload sequence.
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full sm:w-auto px-10 py-5 border border-white/20 hover:bg-white hover:text-black transition-all duration-300 text-[10px] uppercase tracking-[0.3em] font-medium disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-4 bg-base/50"
                    >
                      {loading ? (
                        <>
                          <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                          {isBatchMode && batchProgress ? `Processing ${batchProgress.current}/${batchProgress.total} Iteration` : 'Processing Iteration'}
                        </>
                      ) : (
                        <>
                          Initiate Synthesis
                        </>
                      )}
                    </button>
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
                    <div className="mt-10 border border-white/5 bg-surface p-16 flex flex-col items-center justify-center text-center">
                      <div className="relative w-10 h-10 mb-8 flex items-center justify-center">
                        <span className="absolute inset-0 border border-bord border-t-white/80 rounded-full animate-spin duration-1000" />
                        <div className="w-1 h-1 bg-white/60 rounded-full animate-pulse"></div>
                      </div>
                      <h4 className="text-[10px] uppercase tracking-[0.4em] text-white/80 mb-4">Neural Assembly Active</h4>
                      {isBatchMode && batchProgress && (
                        <div className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-3">
                          Batch: <span className="text-white/90">{batchProgress.current}</span> / <span className="text-white/90">{batchProgress.total}</span>
                        </div>
                      )}
                      <p className="text-[10px] uppercase tracking-[0.3em] text-mut animate-pulse font-mono">
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

        {/* Archive Title if needed */}
        {archiveView && (
          <section className="mb-20 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-4">
              <div className="flex items-center gap-6">
                <h2 className="text-3xl font-light tracking-tight text-white/90 font-serif italic">
                  Local Archive
                </h2>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search Archive..."
                    value={archiveSearchQuery}
                    onChange={(e) => setArchiveSearchQuery(e.target.value)}
                    className="bg-transparent border-b border-white/20 px-2 py-1 text-sm font-light text-white/90 placeholder:text-white/30 focus:outline-none focus:border-white transition-colors w-64"
                  />
                  {archiveSearchQuery && (
                    <button 
                      onClick={() => setArchiveSearchQuery('')}
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-mut hover:text-white pb-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-bord rounded overflow-hidden">
                  <button 
                    onClick={() => setViewMode('comfort')} 
                    className={`px-3 py-1.5 flex items-center justify-center transition-colors ${viewMode === 'comfort' ? 'bg-white/20 text-white' : 'bg-transparent text-white/50 hover:text-white'}`}
                    title="Comfort View"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => setViewMode('compact')} 
                    className={`px-3 py-1.5 flex items-center justify-center transition-colors ${viewMode === 'compact' ? 'bg-white/20 text-white' : 'bg-transparent text-white/50 hover:text-white'}`}
                    title="Compact View"
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center border border-bord rounded overflow-hidden mr-4">
                  <button 
                    onClick={() => setArchiveGrouping('list')} 
                    className={`px-3 py-1.5 text-[9px] uppercase tracking-widest transition-colors ${archiveGrouping === 'list' ? 'bg-white/20 text-white' : 'bg-transparent text-white/50 hover:text-white'}`}
                    title="List View"
                  >
                    Timeline
                  </button>
                  <button 
                    onClick={() => setArchiveGrouping('clusters')} 
                    className={`px-3 py-1.5 text-[9px] uppercase tracking-widest transition-colors ${archiveGrouping === 'clusters' ? 'bg-white/20 text-white' : 'bg-transparent text-white/50 hover:text-white'}`}
                    title="Clusters View"
                  >
                    Clusters
                  </button>
                </div>
                {archivedItems.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                    onClick={handleDownloadMetadataCSV}
                    className="text-[9px] uppercase tracking-widest text-mut hover:text-white transition-colors flex items-center gap-2 border border-bord px-4 py-2 hover:bg-white/5"
                  >
                    <Download className="w-3 h-3" /> All Metadata (CSV)
                  </button>
                  <button 
                    onClick={handleCopyArchiveJSON}
                    className="text-[9px] uppercase tracking-widest text-mut hover:text-white transition-colors flex items-center gap-2 border border-bord px-4 py-2 hover:bg-white/5"
                  >
                    <Check className={`w-3.5 h-3.5 ${copiedSection === 'copy_archive_json' ? 'text-white' : 'hidden'}`} /> 
                    <FileText className={`w-3.5 h-3.5 ${copiedSection === 'copy_archive_json' ? 'hidden' : 'text-mut'}`} />
                    {copiedSection === 'copy_archive_json' ? 'Copied' : 'Copy JSON'}
                  </button>
                  {selectedArchiveIndices.length > 0 && (
                    <button
                      onClick={handleDownloadMultiPDF}
                      className="text-[9px] uppercase tracking-widest text-ink hover:text-white transition-colors flex items-center gap-2 border border-white/40 px-4 py-2 hover:bg-white/10"
                    >
                      <FileText className="w-3 h-3" /> Export Selected ({selectedArchiveIndices.length}) PDF
                    </button>
                  )}
                  <button
                    onClick={() => setShowArchiveSettings(!showArchiveSettings)}
                    className={`text-[9px] uppercase tracking-widest transition-colors flex items-center gap-2 border px-4 py-2 ${showArchiveSettings ? 'text-white border-white/40 bg-white/10' : 'text-mut border-bord hover:text-white hover:bg-white/5'}`}
                  >
                    Settings
                  </button>
                </div>
              )}
              </div>
            </div>
            <p className="text-sm font-light text-white/50 leading-relaxed max-w-xl">
              Persisted payload schemas and synthesized architectures. Readily available for further distribution.
            </p>
            
            <AnimatePresence>
              {showArchiveSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-6"
                >
                  <div className="border border-bord bg-surface p-6 text-sm font-light">
                    <h3 className="text-white/90 mb-6 flex items-center gap-2 text-[10px] uppercase tracking-widest font-medium border-b border-bord pb-3"><Info className="w-4 h-4"/> Output Formatting Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <label className="block text-[9px] uppercase tracking-[0.3em] text-mut mb-3 transition-colors focus-within:text-white/70">
                          Brand Logo URL
                        </label>
                        <input
                          type="text"
                          className="w-full bg-transparent border border-bord px-4 py-3 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-white/50 transition-colors"
                          placeholder="https://example.com/logo.png"
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                        />
                        <p className="mt-3 text-[10px] text-white/30 tracking-wide">
                          Provide a URL or base64 data to embed in the top right of exported PDFs.
                        </p>
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase tracking-[0.3em] text-mut mb-3 transition-colors focus-within:text-white/70">
                          Global PDF Watermark
                        </label>
                        <input
                          type="text"
                          className="w-full bg-transparent border border-bord px-4 py-3 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-white/50 transition-colors"
                          placeholder="E.g., Acuity Brand Solutions..."
                          value={watermarkText}
                          onChange={(e) => setWatermarkText(e.target.value)}
                        />
                        <p className="mt-3 text-[10px] text-white/30 tracking-wide">
                          Injected into the footer of all exported payload layers.
                        </p>
                      </div>
                    </div>
                    
                    <h3 className="text-white/90 mt-10 mb-6 flex items-center gap-2 text-[10px] uppercase tracking-widest font-medium border-b border-bord pb-3"><Info className="w-4 h-4"/> Data Management</h3>
                    <div className="flex flex-wrap gap-4">
                      <button
                        onClick={handleDownloadAllFiles}
                        disabled={isZipping || archivedItems.length === 0}
                        className="text-[9px] uppercase tracking-widest text-ink hover:text-white transition-colors border border-bord px-6 py-3 hover:bg-white/5 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <FolderArchive className="w-3.5 h-3.5" /> {isZipping ? "Bundling..." : `Download All Files (ZIP · ${archivedItems.length})`}
                      </button>
                      <button
                        onClick={handleBackupArchive}
                        className="text-[9px] uppercase tracking-widest text-ink hover:text-white transition-colors border border-bord px-6 py-3 hover:bg-white/5 flex items-center gap-2"
                      >
                        <Download className="w-3.5 h-3.5" /> Backup All Data (JSON)
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[9px] uppercase tracking-widest text-white/50 hover:text-white transition-colors border border-bord px-6 py-3 hover:bg-white/5 flex items-center gap-2"
                      >
                        Import Backup
                      </button>
                      <input 
                        type="file" 
                        accept=".json" 
                        ref={fileInputRef} 
                        onChange={handleImportArchive} 
                        style={{ display: 'none' }} 
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {archivedItems.length > 0 && (
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="border border-bord bg-surface p-6 flex flex-col justify-between">
                  <span className="text-[9px] uppercase tracking-widest text-white/50 mb-4 block flex items-center gap-2"><Layers className="w-3 h-3"/> Total Assets</span>
                  <span className="text-3xl font-light text-white">{archivedItems.length}</span>
                </div>
                <div className="border border-bord bg-surface p-6 flex flex-col justify-between">
                  <span className="text-[9px] uppercase tracking-widest text-white/50 mb-4 block flex items-center gap-2"><FileText className="w-3 h-3"/> Total Words Processed</span>
                  <span className="text-3xl font-light text-white">{archivedItems.reduce((acc, item) => acc + (item.productContent?.split(/\\s+/).length || 0), 0).toLocaleString()}</span>
                </div>
                <div className="border border-bord bg-surface p-6 flex flex-col justify-between">
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
               <div className="mt-12 p-8 border border-white/5 bg-base text-center">
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
                className={`w-full max-w-4xl max-h-[85vh] overflow-y-auto p-10 relative ${isPrinterFriendly ? 'bg-white text-black border-none shadow-xl print:m-0 print:p-0 print:max-w-none print:w-full print:h-auto print:max-h-none print:overflow-visible' : 'bg-base border border-white/20 text-white scrollbar-thin selection:bg-white/10 selection:text-white'}`}
                onClick={e => e.stopPropagation()}
              >
                {isPrinterFriendly && (
                  <style>{`
                    @media print {
                      body * {
                        visibility: hidden;
                      }
                      #print-section, #print-section * {
                        visibility: visible;
                      }
                      #print-section {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        overflow: visible;
                      }
                      .forced-page-break {
                        page-break-before: always;
                      }
                    }
                  `}</style>
                )}
                
                <div className="absolute top-6 right-6 flex items-center gap-4 print:hidden">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] uppercase tracking-widest ${isPrinterFriendly ? 'text-black/50' : 'text-white/50'}`}>Printer Friendly</span>
                    <button
                      type="button"
                      onClick={() => setIsPrinterFriendly(!isPrinterFriendly)}
                      className={`w-8 h-4 rounded-full p-0.5 transition-colors ${isPrinterFriendly ? (isPrinterFriendly ? 'bg-black/90' : 'bg-white/90') : 'bg-surface border border-white/20'}`}
                    >
                      <div className={`w-2 h-2 rounded-full transition-transform ${isPrinterFriendly ? 'translate-x-4 bg-white' : 'translate-x-0 bg-white/50'}`} />
                    </button>
                  </div>
                  {isPrinterFriendly && (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] uppercase tracking-widest text-black/50">Page Breaks</span>
                      <button
                        type="button"
                        onClick={() => setEnablePageBreaks(!enablePageBreaks)}
                        className={`w-8 h-4 rounded-full p-0.5 transition-colors ${enablePageBreaks ? 'bg-black/90' : 'bg-black/10 border border-black/20'}`}
                      >
                        <div className={`w-2 h-2 rounded-full transition-transform ${enablePageBreaks ? 'translate-x-4 bg-white' : 'translate-x-0 bg-black/50'}`} />
                      </button>
                    </div>
                  )}
                  {isPrinterFriendly && (
                    <button 
                      onClick={() => window.print()}
                      className="text-[9px] uppercase tracking-widest text-black hover:text-black/70 flex items-center gap-1 border border-black/20 px-3 py-1"
                    >
                      Print
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setQuickViewItem(null);
                      setIsPrinterFriendly(false);
                      setEnablePageBreaks(false);
                    }}
                    className={`${isPrinterFriendly ? 'text-black/50 hover:text-black' : 'text-white/50 hover:text-white'}`}
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                
                <div id="print-section" className={isPrinterFriendly ? "mt-8" : ""}>
                  <div className={`flex items-center gap-4 mb-8 ${isPrinterFriendly ? 'border-b border-black/10 pb-6' : 'border-b border-bord pb-6'}`}>
                     <div className={`w-12 h-12 flex items-center justify-center border ${isPrinterFriendly ? 'border-black/10 bg-white text-black' : 'border-bord bg-surface text-white/80'}`}>
                       <Sparkles className="w-5 h-5" />
                     </div>
                     <div>
                       <span className={`text-[9px] uppercase tracking-[0.4em] mb-2 flex items-center gap-3 ${isPrinterFriendly ? 'text-black/40' : 'text-mut'}`}>
                         Preview Sequence
                         <span className={`px-2 py-0.5 rounded ${isPrinterFriendly ? 'bg-black/5 text-black/70' : 'bg-white/10 text-white/70'}`}>
                           Level: {getComplexityLevel(quickViewItem.productContent)}
                         </span>
                       </span>
                       <h2 className="text-2xl font-light">{quickViewItem.productTitle}</h2>
                     </div>
                  </div>
                  
                  {isPrinterFriendly && quickViewItem.coverImage && (
                    <div className="mb-10 page-break-inside-avoid">
                      <img src={quickViewItem.coverImage} referrerPolicy="no-referrer" alt="Cover Art" className="max-w-full h-auto border border-black/10 shadow-sm" />
                    </div>
                  )}

                  <div className={`prose ${isPrinterFriendly ? 'prose-sm' : 'prose-invert'} max-w-none font-light text-sm leading-relaxed whitespace-pre-wrap ${isPrinterFriendly ? 'text-black' : 'text-white/80'}`}>
                    {useMarkdown ? (
                      <ReactMarkdown components={{
                        h1: ({node, ...props}) => <h1 className={enablePageBreaks ? "forced-page-break mt-12" : "mt-8"} {...props} />,
                        h2: ({node, ...props}) => <h2 className={enablePageBreaks ? "forced-page-break mt-10" : "mt-8"} {...props} />
                      }}>{quickViewItem.productContent}</ReactMarkdown>
                    ) : (
                      quickViewItem.productContent.split('\n\n').map((paragraph, i) => {
                        const isHeading = paragraph.length < 100 && !paragraph.includes('.') && paragraph === paragraph.toUpperCase();
                        return (
                          <div key={i} className={isHeading && enablePageBreaks ? "forced-page-break mt-8" : "mb-4"}>
                            {paragraph}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Payload Display Layer */}
        <AnimatePresence>
          {(() => {
             const getCluster = (niche: string) => {
               const n = (niche || '').toLowerCase();
               if (n.includes('fit') || n.includes('health') || n.includes('wellness') || n.includes('yoga') || n.includes('diet') || n.includes('pet')) return 'Wellness & Lifestyle';
               if (n.includes('tech') || n.includes('code') || n.includes('dev') || n.includes('saas') || n.includes('app') || n.includes('web3') || n.includes('ai')) return 'Tech & Dev';
               if (n.includes('finance') || n.includes('money') || n.includes('invest') || n.includes('real estate') || n.includes('crypto')) return 'Finance & Wealth';
               if (n.includes('market') || n.includes('seo') || n.includes('copy') || n.includes('social') || n.includes('creator') || n.includes('blog') || n.includes('podcast')) return 'Marketing & Creator Content';
               if (n.includes('design') || n.includes('art') || n.includes('photo') || n.includes('music') || n.includes('video') || n.includes('notion')) return 'Design & Creative';
               return 'General & Other';
             };

             let currentItems = archiveView ? archivedItems : batchResults;
             if (archiveView && archiveSearchQuery.trim()) {
               const query = archiveSearchQuery.toLowerCase();
               currentItems = currentItems.filter(item => 
                 item.productTitle.toLowerCase().includes(query) || 
                 (item.originalNiche && item.originalNiche.toLowerCase().includes(query))
               );
             }
             
             if (currentItems.length === 0) return null;

             const grouped: Record<string, { item: ManufactureResult, index: number }[]> = {};
             
             if (!archiveView || archiveGrouping === 'list') {
               grouped['All'] = currentItems.map((item, index) => ({ item, index }));
             } else {
               currentItems.forEach((item, index) => {
                 const cluster = getCluster(item.originalNiche || item.productTitle);
                 if (!grouped[cluster]) grouped[cluster] = [];
                 grouped[cluster].push({ item, index });
               });
             }

             return (
               <>
                 {archiveView && archiveGrouping === 'clusters' && (
                   <div className="max-w-5xl mx-auto mb-16 border border-bord bg-base p-6">
                     <h3 className="text-[10px] uppercase tracking-widest text-white/50 mb-6 flex items-center gap-2"><Sparkles className="w-3 h-3"/> Cluster Density Heatmap</h3>
                     <div className="flex flex-wrap gap-6">
                       {Object.entries(grouped).map(([cluster, items]) => {
                         const maxCount = Math.max(...Object.values(grouped).map(g => g.length), 1);
                         const intensity = items.length / maxCount;
                         return (
                           <div key={cluster} className="flex flex-col items-center gap-2">
                             <div 
                               className="w-12 h-12 flex items-center justify-center text-xs font-mono text-black transition-colors"
                               style={{ backgroundColor: `rgba(255, 255, 255, ${0.1 + intensity * 0.9})` }}
                               title={`${items.length} products in ${cluster}`}
                             >
                               {items.length}
                             </div>
                             <span className="text-[9px] uppercase tracking-wider text-mut max-w-[80px] text-center leading-tight">{cluster}</span>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 )}
                 {Object.entries(grouped).map(([cluster, clusterItems]) => (
                   <div key={cluster} className="mb-20">
                     {cluster !== 'All' && (
                       <h3 className="text-xl font-serif italic text-white/80 mb-10 border-b border-bord pb-4 max-w-5xl mx-auto">{cluster} <span className="text-white/30 text-sm ml-2">({clusterItems.length})</span></h3>
                     )}
                     <div className={viewMode === 'compact' ? "grid grid-cols-1 md:grid-cols-2 gap-8 max-w-[1400px] mx-auto" : "flex flex-col gap-16"}>
                       {clusterItems.map(({ item: res, index }) => (
                         <motion.div
                           key={res.productTitle + index}
                       initial={{ opacity: 0, y: 20 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ duration: 0.7, ease: "easeOut" }}
                       className={`space-y-12 mb-32 ${viewMode === 'compact' ? 'max-w-none pt-0 border-t-0 space-y-8 bg-base border border-bord p-6' : `max-w-5xl mx-auto ${index > 0 && cluster === 'All' ? "pt-20 border-t border-bord" : "mt-20"}`}`}
                     >
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-bord pb-6">
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
                  <div className="w-12 h-12 flex items-center justify-center border border-bord bg-surface">
                    <Sparkles className="w-5 h-5 text-white/80" />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-[0.4em] text-mut mb-2 flex items-center gap-3">
                      Synthesis Concluded {isBatchMode && `// Target: ${res.originalNiche}`}
                      <span className="bg-white/10 px-2 py-0.5 rounded text-white/70">
                        Level: {getComplexityLevel(res.productContent)}
                      </span>
                      <span className="flex items-center gap-2 relative group cursor-default" title="Estimated Minute Read">
                        <svg className="w-4 h-4 transform -rotate-90" viewBox="0 0 36 36">
                          <path className="text-white/10" strokeWidth="3" stroke="currentColor" fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                          <path className="text-white/50 transition-all duration-700 group-hover:text-white" strokeDasharray={`${Math.min((Math.ceil((res.productContent.split(/\s+/).length || 1) / 200) / 30) * 100, 100)}, 100`} strokeWidth="3" stroke="currentColor" fill="none" 
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        </svg>
                        <span className="text-white/70 group-hover:text-white transition-colors">{Math.max(1, Math.ceil((res.productContent.split(/\s+/).length || 1) / 200))} Min Read</span>
                      </span>
                    </span>
                    {editTitleIndex === index ? (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          className="bg-transparent border-b border-white/40 text-2xl font-light text-white/90 focus:outline-none focus:border-white px-0 rounded-none pb-1 w-full max-w-lg"
                          value={editTitleValue}
                          onChange={(e) => setEditTitleValue(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTitle(index);
                            else if (e.key === 'Escape') setEditTitleIndex(null);
                          }}
                        />
                        <button onClick={() => handleSaveTitle(index)} className="text-[9px] uppercase tracking-widest text-ink hover:text-white transition-colors bg-white/10 px-2 py-1">Save</button>
                        <button onClick={() => setEditTitleIndex(null)} className="text-[9px] uppercase tracking-widest text-mut hover:text-white transition-colors">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-light text-white/90 leading-none">{res.productTitle}</h2>
                        {archiveView && (
                          <div className="flex flex-col relative">
                            <div className="flex items-center gap-2">
                              <button onClick={() => {
                                setEditTitleIndex(index);
                                setEditTitleValue(res.productTitle);
                              }} className="text-white/20 hover:text-white/60 transition-colors w-6 h-6 flex items-center justify-center">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {res.versions && res.versions.length > 0 && (
                                <button onClick={() => setShowVersionsIndex(showVersionsIndex === index ? null : index)} className={`text-[9px] uppercase tracking-widest border px-2 py-0.5 rounded transition-colors ${showVersionsIndex === index ? 'bg-white text-black border-white' : 'text-mut hover:text-white border-bord hover:border-white/30'}`}>
                                  {res.versions.length} Edit{res.versions.length > 1 ? 's' : ''}
                                </button>
                              )}
                            </div>
                            {showVersionsIndex === index && res.versions && (
                              <div className="absolute top-8 left-0 min-w-80 bg-surface border border-bord shadow-2xl z-50 p-4 flex flex-col gap-3">
                                <span className="text-[9px] uppercase tracking-[0.3em] text-mut border-b border-white/5 pb-2">Version History</span>
                                {res.versions.map((ver, vIdx) => (
                                  <div key={vIdx} className="flex justify-between items-start gap-4 p-2 hover:bg-white/5 rounded transition-colors">
                                    <div className="flex flex-col">
                                      <span className="text-xs text-white/80 font-light">{ver.productTitle}</span>
                                      <span className="text-[9px] uppercase text-white/30">{new Date(ver.date).toLocaleString()}</span>
                                    </div>
                                    <button onClick={() => {
                                      handleRestoreVersion(index, vIdx);
                                      setShowVersionsIndex(null);
                                    }} className="text-[9px] uppercase tracking-widest text-green-400 hover:text-green-300 transition-colors">
                                      Restore
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {archiveView && (
                    <button
                      onClick={() => setQuickViewItem(res)}
                      className="text-[9px] uppercase tracking-widest text-ink hover:text-white transition-colors flex items-center gap-2 border border-bord px-4 py-2 hover:bg-white/5"
                    >
                      <ExternalLink className="w-3 h-3" /> Quick View
                    </button>
                  )}
                  {!archiveView && !archivedItems.some(i => i.productTitle === res.productTitle) && (
                    <button
                      onClick={() => handleSaveToArchive(res)}
                      className="text-[9px] uppercase tracking-widest text-ink hover:text-white transition-colors flex items-center gap-2 border border-bord px-4 py-2 hover:bg-white/5"
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
              <div className="border border-bord bg-base flex flex-col lg:flex-row">
                
                {/* Primary Column (Product Payload) */}
                <div className="flex-1 border-b lg:border-b-0 lg:border-r border-bord flex flex-col">
                  
                  <div className="px-8 flex pt-6 pb-4 items-center justify-between border-b border-bord">
                    <span className="text-[9px] uppercase tracking-[0.3em] text-mut">Raw Sequence</span>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handlePushToNotion(res, index)}
                        className="text-[9px] uppercase tracking-widest text-mut hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                        disabled={isPushingNotion[index]}
                      >
                        <Layers className="w-3 h-3" /> {isPushingNotion[index] ? 'Pushing...' : 'Push to Notion'} 
                      </button>
                      <button
                        onClick={() => handlePushToShopify(res, index)}
                        className="text-[9px] uppercase tracking-widest text-mut hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                        disabled={isPushingShopify[index]}
                      >
                        <ShoppingCart className="w-3 h-3" /> {isPushingShopify[index] ? 'Pushing...' : 'Push to Shopify'} 
                      </button>
                      <button
                        onClick={() => handleDownloadProduct(res)}
                        className="text-[9px] uppercase tracking-widest text-mut hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <Download className="w-3 h-3" /> Exfil .TXT 
                      </button>
                      <button
                        onClick={() => handleDownloadHTML(res)}
                        className="text-[9px] uppercase tracking-widest text-mut hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" /> Export .HTML 
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(res)}
                        className="text-[9px] uppercase tracking-widest text-mut hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <FileText className="w-3 h-3" /> Export .PDF 
                      </button>
                    </div>
                  </div>

                  <div className="p-8 bg-surface flex-1">
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-[10px] text-white/30 font-light tracking-wide flex items-center gap-3">
                        <div className="w-1 h-1 bg-white/20"></div>
                        Rendered payload preview
                      </span>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] uppercase tracking-[0.3em] text-white/50">Raw</span>
                            <button
                                type="button"
                                onClick={() => setUseMarkdown(!useMarkdown)}
                                className={`w-8 h-4 rounded-full p-0.5 transition-colors ${useMarkdown ? 'bg-white/90' : 'bg-surface border border-white/20'}`}
                            >
                                <div className={`w-2 h-2 rounded-full bg-base transition-transform ${useMarkdown ? 'translate-x-4' : 'translate-x-0 bg-white/50'}`} />
                            </button>
                            <span className="text-[9px] uppercase tracking-[0.3em] text-white/50">MD</span>
                        </div>
                        <button
                          onClick={() => handleCopyText(res.productContent, `coreProduct_${index}`)}
                          className="text-[9px] uppercase tracking-widest text-white/50 hover:text-white transition-colors flex items-center gap-2 border border-bord px-3 py-1.5"
                        >
                          {copiedSection === `coreProduct_${index}` ? (
                            <><Check className="w-3 h-3" /> Stored</>
                          ) : (
                            <><Copy className="w-3 h-3" /> Transcribe</>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[600px] overflow-y-auto bg-base border border-white/5 p-8 text-sm font-light text-white/60 leading-relaxed scrollbar-thin selection:bg-white/10 selection:text-white">
                      <h1 className="text-xl font-light text-white mb-6 border-b border-bord pb-4">
                        {res.productTitle}
                      </h1>
                      {useMarkdown ? (
                        <div className="markdown-body space-y-4 text-white/80">
                          <ReactMarkdown>{res.productContent}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{res.productContent}</div>
                      )}
                    </div>
                    
                    {/* Asset Recommendations */}
                    <div className="mt-8 border border-white/5 bg-surface p-6">
                      <span className="text-[9px] uppercase tracking-[0.3em] text-mut mb-4 block flex items-center gap-2"><Sparkles className="w-3 h-3"/> Bundle Recommendations</span>
                      <p className="text-[10px] tracking-wide text-white/50 font-light mb-6">
                        Algorithmically selected product variants to bundle with this asset for maximum average order value.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {getAssetRecommendations(res.productTitle, res.originalNiche || '', selectedProduct.name).map((rec, rIdx) => (
                          <div key={rIdx} className="bg-base border border-bord p-5 transition-colors hover:border-white/20 hover:bg-white/5 cursor-pointer flex flex-col justify-between group">
                            <div className="text-white/30 group-hover:text-white/80 transition-colors mb-6">{rec.ico}</div>
                            <div>
                               <h5 className="text-[10px] uppercase tracking-widest text-white/80 mb-1 truncate">{rec.name}</h5>
                               <p className="text-[8px] uppercase tracking-widest text-mut font-mono truncate">{rec.code}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Secondary Column (Telemetry / Marketing) */}
                <div className="w-full lg:w-[420px] p-8 flex flex-col gap-10 bg-surface">
                  
                  <div className="border-b border-bord pb-3">
                    <span className="text-[9px] uppercase tracking-[0.3em] text-mut">Market Positioning</span>
                  </div>

                  {/* Cover Art Generator */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[9px] uppercase tracking-widest text-white/50">Market Visuals</span>
                      <button
                        onClick={() => handleGenerateCover(res, index, archiveView)}
                        disabled={isGeneratingCover[index]}
                        className="text-[9px] uppercase tracking-widest text-ink hover:text-white transition-colors disabled:opacity-50"
                      >
                        {isGeneratingCover[index] ? "Generating..." : "Generate Cover Art"}
                      </button>
                    </div>
                    {res.coverImage ? (
                      <div className="border border-bord bg-base aspect-video w-full flex items-center justify-center overflow-hidden">
                        <img src={res.coverImage} referrerPolicy="no-referrer" alt="Cover Art" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="border border-white/5 border-dashed aspect-video w-full flex items-center justify-center text-white/20 text-[10px] uppercase tracking-widest bg-white/5">
                        {isGeneratingCover[index] ? "Synthesizing pixels..." : "No Asset Generated"}
                      </div>
                    )}
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
                      <span className="text-[10px] text-mut font-light tracking-wide uppercase">
                        {res.priceRecommendationValue.substring(res.priceRecommendationValue.indexOf(" ") + 1)}
                      </span>
                    </div>

                    <div className="bg-elevated border border-white/5 p-5">
                      <span className="text-[9px] uppercase tracking-widest text-white/70 mb-4 block flex items-center gap-2"><Coins className="w-3 h-3"/> Revenue Projection</span>
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-mut uppercase tracking-widest">Est. Traffic/mo</span>
                          <input 
                            type="number" 
                            className="bg-transparent border-b border-white/20 w-16 text-right outline-none text-white focus:border-white/50"
                            value={calculatorState[`\${res.productTitle}_\${index}`]?.traffic || "1000"} 
                            onChange={e => updateCalculator(`\${res.productTitle}_\${index}`, 'traffic', e.target.value)}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-mut uppercase tracking-widest">Conv. Rate (%)</span>
                          <input 
                            type="number" 
                            step="0.1"
                            className="bg-transparent border-b border-white/20 w-16 text-right outline-none text-white focus:border-white/50"
                            value={calculatorState[`\${res.productTitle}_\${index}`]?.conversion || "2.5"} 
                            onChange={e => updateCalculator(`\${res.productTitle}_\${index}`, 'conversion', e.target.value)}
                          />
                        </div>
                        <div className="flex justify-between items-center text-xs mt-2 pt-4 border-t border-bord font-mono text-white/80">
                          <span className="text-[9px] font-sans uppercase tracking-widest text-mut">Proj. MRR</span>
                          <span className="text-ink">
                            \${(() => {
                              const traf = parseFloat(calculatorState[`\${res.productTitle}_\${index}`]?.traffic || "1000") || 0;
                              const conv = parseFloat(calculatorState[`\${res.productTitle}_\${index}`]?.conversion || "2.5") || 0;
                              const priceStr = res.priceRecommendationValue.match(/[\\d.]+/);
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
                          className="text-[9px] uppercase tracking-widest text-mut border border-bord px-3 py-1.5 bg-base"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* SEO Score */}
                  <div className="bg-elevated border border-white/5 p-5">
                     <span className="text-[9px] uppercase tracking-widest text-white/70 mb-4 block flex items-center gap-2">SEO Score Analysis</span>
                     {(() => {
                       const { score, tips } = calculateSEOScore(res.etsyTitle, res.etsyTags);
                       return (
                         <div>
                           <div className="flex items-center gap-3 mb-4">
                             <div className="flex-1 bg-white/10 h-1">
                               <div className="bg-white text-white/90 h-1 transition-all" style={{width: `${score}%`, backgroundColor: score > 80 ? '#4ade80' : score > 50 ? '#facc15' : '#f87171'}} />
                             </div>
                             <span className="text-xs font-mono">{score}%</span>
                           </div>
                           {tips.length > 0 && (
                             <ul className="text-[9px] text-white/50 space-y-2 uppercase tracking-wide list-disc list-inside">
                               {tips.map((tip, idx) => (
                                 <li key={idx}>{tip}</li>
                               ))}
                             </ul>
                           )}
                           {tips.length === 0 && <span className="text-[9px] text-green-400 uppercase tracking-wide">Excellent formulation. No improvements needed.</span>}
                         </div>
                       );
                     })()}
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
                    <div className="text-xs leading-relaxed font-light text-white/50 bg-base border border-white/5 p-6 max-h-[220px] overflow-y-auto scrollbar-thin whitespace-pre-wrap">
                      {res.listingDescription}
                    </div>
                  </div>

                  {/* Market Syndication (Socials) */}
                  <div className="pt-6 border-t border-bord">
                    <span className="text-[9px] uppercase tracking-widest text-white/50 block mb-6">Market Syndication</span>
                    
                    <div className="flex flex-wrap gap-3">
                      {/* X (Twitter) */}
                      <a href={`https://x.com/intent/tweet?text=Just launched: ${encodeURIComponent(res.productTitle)}! ${encodeURIComponent(res.gumroadBlurb)}`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center border border-bord hover:bg-white/10 hover:border-white/30 transition-all text-white/50 hover:text-white group" title="X Integration">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      </a>
                      {/* Instagram */}
                      <button className="w-10 h-10 flex items-center justify-center border border-bord hover:bg-white/10 hover:border-white/30 transition-all text-white/50 hover:text-white" title="Instagram Integration">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                      </button>
                      {/* Facebook */}
                       <a href={`https://www.facebook.com/sharer/sharer.php?u=https://fullstackassets.com&quote=${encodeURIComponent(res.productTitle)}`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center border border-bord hover:bg-white/10 hover:border-white/30 transition-all text-white/50 hover:text-white" title="Facebook Integration">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z"/></svg>
                      </a>
                      {/* GitHub */}
                      <a href={`https://gist.github.com/`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center border border-bord hover:bg-white/10 hover:border-white/30 transition-all text-white/50 hover:text-white" title="Export to GitHub Gist">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                      </a>
                      {/* TikTok */}
                      <button className="w-10 h-10 flex items-center justify-center border border-bord hover:bg-white/10 hover:border-white/30 transition-all text-white/50 hover:text-white" title="TikTok Integration">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93v7.2c0 1.96.65 3.93 1.95 5.37 1.84 2.04 4.77 2.68 7.37 1.63 2.72-1.07 4.54-3.8 4.47-6.75-.02-1.42-.4-2.83-1.12-4.04l-3.87 2.1c.17.65.23 1.34.1 2.01-.18.94-.8 1.76-1.63 2.15-1.22.58-2.73.47-3.84-.28-1.12-.76-1.72-2.1-1.6-3.46.12-1.34.9-2.52 2.13-3.13.38-.19.78-.32 1.2-.38V9.3c-2.3.1-4.52 1.08-6.19 2.72-2.02 1.98-3.11 4.79-3.04 7.63.07 2.94 1.34 5.75 3.55 7.68 2.5 2.16 5.87 3.02 9.17 2.5 3.32-.52 6.27-2.36 8.2-5.07 1.63-2.3 2.5-5.1 2.47-7.96V.02h-4.02c-.06 1.47-.38 2.9-.96 4.24-.55 1.25-1.4 2.37-2.45 3.25-1.07.88-2.31 1.52-3.64 1.84V.02z"/></svg>
                      </button>
                      {/* Pinterest */}
                      <a href={`https://pinterest.com/pin/create/button/?url=https://fullstackassets.com&description=${encodeURIComponent(res.productTitle)}`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center border border-bord hover:bg-white/10 hover:border-white/30 transition-all text-white/50 hover:text-white" title="Pinterest Integration">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.951-7.252 4.168 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.625 0 12.017 0z"/></svg>
                      </a>
                      {/* Claude */}
                      <button 
                        onClick={() => {
                          const claudePrompt = `Please review and refine the following piece of digital content:\n\nTitle: ${res.productTitle}\n\n${res.productContent}`;
                          navigator.clipboard.writeText(claudePrompt);
                          window.open('https://claude.ai/new', '_blank');
                        }}
                        className="w-10 h-10 flex items-center justify-center border border-bord hover:bg-white/10 hover:border-white/30 transition-all text-white/50 hover:text-white" 
                        title="Copy to clipboard & Open Claude"
                      >
                        <Brain className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Growth & Revenue Streams */}
                  <div className="pt-6 border-t border-bord">
                    <span className="text-[9px] uppercase tracking-widest text-white/50 block mb-6">Growth & Revenue Streams</span>
                    
                    <div className="flex flex-col gap-6">
                      {/* Advertising Framework */}
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[10px] text-white/70">Ad Campaign Strategy</span>
                          <button
                            onClick={() => handleCopyText(`Targeting: ${res.originalNiche || 'General'} based audiences.\nFormat: Short-form video / Carousel.\nHeadline: Stop struggling with [Problem].\nBody: I built ${res.productTitle} to help you achieve [Result] faster. Grab it now for ${res.priceRecommendationValue}.\nCTA: Learn More.`, `adStrategy_${index}`)}
                            className="text-[9px] uppercase tracking-widest text-mut hover:text-white transition-colors"
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
                            className="text-[9px] uppercase tracking-widest text-mut hover:text-white transition-colors"
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

                  {/* Growth Tactics */}
                  {res.growthTactics && (
                    <div className="pt-6 border-t border-bord">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[9px] uppercase tracking-widest text-ink block flex items-center gap-2"><Rocket className="w-3 h-3" /> Growth Tactics (3-Month Roadmap)</span>
                        <button
                          onClick={() => handleCopyText(res.growthTactics!, `growthTactics_${index}`)}
                          className="text-[9px] uppercase tracking-widest text-white/30 hover:text-white transition-colors"
                        >
                          {copiedSection === `growthTactics_${index}` ? "Done" : "Copy"}
                        </button>
                      </div>
                      <div className="text-xs leading-relaxed font-light text-white/60 bg-elevated border border-white/5 p-5 whitespace-pre-wrap">
                        {res.growthTactics}
                      </div>
                    </div>
                  )}

                  {/* Vault Actions - Value Adds */}
                  <div className="pt-6 border-t border-bord">
                    <span className="text-[9px] uppercase tracking-widest text-white/50 block mb-6">Execution Utilities</span>
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => handleCopyText(`Subject: Unlock ${res.productTitle} today\n\nHi [Name],\n\n${res.gumroadBlurb}\n\nGet it here: [Link]\n\nBest,\n[Your Name]`, `emailPromo_${index}`)}
                        className="text-left text-[10px] uppercase tracking-widest text-white/60 hover:text-white transition-colors bg-elevated border border-white/5 p-4 flex items-center justify-between group"
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
                        className="text-left text-[10px] uppercase tracking-widest text-white/60 hover:text-white transition-colors bg-elevated border border-white/5 p-4 flex items-center justify-between group"
                        title="Copy an AI Image prompt (Midjourney/DALL-E) to generate a marketing graphic."
                      >
                        <span className="flex items-center gap-3">
                          <Check className={`w-3 h-3 ${copiedSection === `imagePrompt_${index}` ? 'text-white' : 'text-white/20 group-hover:text-white/60'}`} />
                          Promo Graphics Prompt
                        </span>
                        <span className="text-[8px] bg-white/5 px-2 py-0.5 rounded text-white/30 hidden sm:block">Value Add</span>
                      </button>

                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => setQrCodeData(prev => ({ 
                            ...prev, 
                            [index]: prev[index] ? '' : `https://gumroad.com/l/${res.productTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}` 
                          }))}
                          className="text-left text-[10px] uppercase tracking-widest text-white/60 hover:text-white transition-colors bg-elevated border border-white/5 p-4 flex items-center justify-between group"
                          title="Generate a QR code for your Gumroad listing to use in offline print materials."
                        >
                          <span className="flex items-center gap-3">
                            <span className={`w-3 h-3 flex items-center justify-center font-bold text-[8px] border border-current rounded-[2px] pb-[1px] ${qrCodeData[index] ? 'text-white border-white' : 'text-white/20 group-hover:text-white/60 group-hover:border-white/60 border-white/20'}`}>
                              qr
                            </span>
                            Generate QR Code
                          </span>
                          <span className="text-[8px] bg-white/5 px-2 py-0.5 rounded text-white/30 hidden sm:block">Growth</span>
                        </button>
                        
                        <AnimatePresence>
                          {qrCodeData[index] && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="bg-white p-6 flex flex-col items-center justify-center mt-2 border border-bord relative">
                                <QRCodeSVG 
                                  value={qrCodeData[index]} 
                                  size={160} 
                                  level={"H"}
                                  includeMargin={false}
                                />
                                <div className="mt-4 flex flex-col items-center text-center">
                                  <p className="text-[8px] uppercase tracking-widest text-black/40 mb-1">Gumroad Link</p>
                                  <p className="text-[9px] font-mono text-black/80 break-all max-w-[200px] leading-tight">{qrCodeData[index]}</p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="text-left text-[9px] uppercase tracking-widest text-mut pt-2 flex items-center gap-4">
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
                <div className="border-t border-bord pt-20 mt-20 max-w-5xl mx-auto">
                  <div className="mb-12 flex justify-between items-center">
                    <h3 className="text-xl font-light text-white/90 italic font-serif">Assembly & Distribution Protocol</h3>
                    <div className="text-[9px] uppercase tracking-widest text-white/30 border border-bord px-3 py-1.5 flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-white/40"></div> 
                      Live Guidelines
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-12 sm:gap-8">
                    <div className="flex flex-col gap-4">
                      <span className="text-[9px] uppercase tracking-[0.4em] text-mut border-b border-bord pb-3">Phase I / Exfil</span>
                      <h4 className="text-base font-light text-white/80">Secure the Asset</h4>
                      <p className="text-xs font-light text-mut leading-relaxed">
                        Download the raw encoded text manifest. Keep this pure local instance safe before translation.
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-4">
                      <span className="text-[9px] uppercase tracking-[0.4em] text-mut border-b border-bord pb-3">Phase II / Construct</span>
                      <h4 className="text-base font-light text-white/80">Visual Dress</h4>
                      <p className="text-xs font-light text-mut leading-relaxed">
                        Port blueprint into architecture tools (Canva/Notion). Implement structural margins, typography hierarchy, and export to pristine PDF format.
                      </p>
                    </div>

                    <div className="flex flex-col gap-4">
                      <span className="text-[9px] uppercase tracking-[0.4em] text-mut border-b border-bord pb-3">Phase III / Network</span>
                      <h4 className="text-base font-light text-white/80">Catalog Upload</h4>
                      <p className="text-xs font-light text-mut leading-relaxed">
                        Submit the crafted artifact into marketplace circuits using our synthesized SEO tags, titles, and exact conversion copy grids.
                      </p>
                    </div>

                    <div className="flex flex-col gap-4">
                      <span className="text-[9px] uppercase tracking-[0.4em] text-mut border-b border-bord pb-3">Phase IV / Stack</span>
                      <h4 className="text-base font-light text-white/80">Asset Monopoly</h4>
                      <p className="text-xs font-light text-mut leading-relaxed">
                        Iterate the loop. Drop 3 more complementary systems in this sector, package them, and enforce premium bundle anchors.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
                   ))}
                 </div>
               </div>
             ))}
             </>
           );
          })()}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-bord">
            
            <div className="bg-base p-10 flex flex-col hover:bg-surface transition-colors duration-500">
              <span className="text-4xl font-light italic font-serif text-white/80 mb-6">$0</span>
              <h4 className="text-[10px] uppercase tracking-[0.3em] text-white/60 mb-3">Absolute Zero Cost</h4>
              <p className="text-xs font-light text-mut leading-relaxed">
                Distribution bears no mass. Replication requires zero energy expenditure. Profit retention remains uniformly 100%.
              </p>
            </div>

            <div className="bg-base p-10 flex flex-col hover:bg-surface transition-colors duration-500">
              <span className="text-4xl font-light italic font-serif text-white/80 mb-6 flex items-baseline"><span className="text-2xl mr-1">$</span>15</span>
              <h4 className="text-[10px] uppercase tracking-[0.3em] text-white/60 mb-3">High Anchoring</h4>
              <p className="text-xs font-light text-mut leading-relaxed">
                While light assets command entry velocity, deep matrix templates and architectural frames effortlessly validate premium structures.
              </p>
            </div>

            <div className="bg-base p-10 flex flex-col hover:bg-surface transition-colors duration-500">
              <span className="text-4xl font-light italic font-serif text-white/80 mb-6 text-white/90">10<span className="text-xl">%</span></span>
              <h4 className="text-[10px] uppercase tracking-[0.3em] text-white/60 mb-3">Gateway Equilibrium</h4>
              <p className="text-xs font-light text-mut leading-relaxed">
                Major processors merely extract nominal tithes. Vast market traffic pools cost fractions compared to physical logistics.
              </p>
            </div>

            <div className="bg-base p-10 flex flex-col hover:bg-surface transition-colors duration-500">
              <span className="text-4xl font-light italic font-serif text-white/80 mb-6 mt-1 flex items-center">
                 <div className="relative flex h-8 w-8 mr-3">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/20 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-8 w-8 bg-white/10"></span>
                 </div>
              </span>
              <h4 className="text-[10px] uppercase tracking-[0.3em] text-white/60 mb-3">Non-Stop Operation</h4>
              <p className="text-xs font-light text-mut leading-relaxed">
                Rendered nodes process acquisitions independently of creator wake-cycles. A mathematically flawless perpetual mechanism.
              </p>
            </div>

          </div>
        </section>
        )}

      </main>

      {/* Elegant Footer */}
      <footer className="border-t border-bord bg-base">
        <div className="max-w-[1200px] mx-auto px-10 py-10 flex flex-col sm:flex-row items-center justify-between text-[9px] uppercase tracking-[0.4em] text-white/30 gap-6 text-center sm:text-left">
          <span>Full Stack Assets © 2026</span>
          <span className="opacity-60">Human curation of algorithmic output required before distribution.</span>
        </div>
      </footer>
    </div>
  );
}
