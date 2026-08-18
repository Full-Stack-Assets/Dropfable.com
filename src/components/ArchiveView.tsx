import { useState } from "react";
import { ArchiveStats } from "./ArchiveStats";
import { ManufactureResult } from "../types";
import { ETSY_PROMPT_PACK_NOTICE } from "../types";
import { Download, Trash2, Eye, FileText, FileDown, FileUp, List, Package, Image as ImageIcon, Loader2 } from "lucide-react";
import { PDFViewerModal } from "./PDFViewerModal";
import { exportProductPdf, exportBatchPdf, exportProductTxt, exportProductHtml } from "../lib/export";
import { exportSalesKit, exportArchiveZip } from "../lib/salesKit";
import { parseJsonResponse } from "../lib/http";
import { authHeaders } from "../lib/billingClient";
import { trackEvent } from "../analytics";

interface ArchiveViewProps {
  archivedItems: ManufactureResult[];
  selectedArchiveIndices: number[];
  toggleArchiveSelection: (idx: number) => void;
  handleRemoveFromArchive: (idx: number) => void;
  setSelectedArchiveIndices: React.Dispatch<React.SetStateAction<number[]>>;
  watermarkText: string;
  setWatermarkText: (value: string) => void;
  onArchiveChange: (items: ManufactureResult[]) => Promise<void> | void;
}

export function ArchiveView({
  archivedItems,
  selectedArchiveIndices,
  toggleArchiveSelection,
  handleRemoveFromArchive,
  setSelectedArchiveIndices,
  watermarkText,
  setWatermarkText,
  onArchiveChange,
}: ArchiveViewProps) {
  const [viewingPdfItem, setViewingPdfItem] = useState<ManufactureResult | null>(null);
  const [coverBusy, setCoverBusy] = useState<number | null>(null);
  const [kitBusy, setKitBusy] = useState<number | null>(null);

  const handleDownloadPDF = (item: ManufactureResult) => {
    exportProductPdf(item, { watermarkText, niche: item.originalNiche || "" });
  };

  const handleDownloadMultiPDF = () => {
    if (selectedArchiveIndices.length === 0) return;
    exportBatchPdf(selectedArchiveIndices.map((idx) => archivedItems[idx]), { watermarkText });
    setSelectedArchiveIndices([]);
  };

  const handleExportJSON = () => {
    if (archivedItems.length === 0) return;
    const blob = new Blob([JSON.stringify(archivedItems, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dropkit-archive-export.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const imported = JSON.parse(evt.target?.result as string);
        if (Array.isArray(imported)) {
          const newItems = [...archivedItems];
          imported.forEach((item: ManufactureResult) => {
            if (!newItems.some((i) => i.productTitle === item.productTitle)) {
              newItems.push(item);
            }
          });
          await onArchiveChange(newItems);
        }
      } catch {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const generateCover = async (idx: number) => {
    const item = archivedItems[idx];
    setCoverBusy(idx);
    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ productTitle: item.productTitle, niche: item.originalNiche }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || "Cover generation failed.");
      const next = [...archivedItems];
      next[idx] = { ...item, coverImage: data.imageUrl };
      await onArchiveChange(next);
    } catch (err: any) {
      alert(err.message || "Cover generation failed.");
    } finally {
      setCoverBusy(null);
    }
  };

  const downloadKit = async (idx: number, item: ManufactureResult) => {
    setKitBusy(idx);
    try {
      await exportSalesKit(item);
      trackEvent("kit_downloaded", { product: item.productId || "unknown" });
    } finally {
      setKitBusy(null);
    }
  };

  const markListed = async (idx: number, listedOn: string) => {
    const item = archivedItems[idx];
    const next = [...archivedItems];
    next[idx] = {
      ...item,
      listingOutcome: {
        ...item.listingOutcome,
        listedOn,
        updatedAt: new Date().toISOString(),
      },
    };
    await onArchiveChange(next);
    trackEvent("product_listed", { channel: listedOn, product: item.productId || "unknown" });
  };

  const markSale = async (idx: number) => {
    const note = window.prompt("Optional receipt note (Gumroad order id, amount, etc.)") || "";
    const item = archivedItems[idx];
    const next = [...archivedItems];
    next[idx] = {
      ...item,
      listingOutcome: {
        ...item.listingOutcome,
        saleNoted: true,
        receiptNote: note,
        updatedAt: new Date().toISOString(),
      },
    };
    await onArchiveChange(next);
    trackEvent("purchase", { product: item.productId || "unknown", value: 0 });
  };

  return (
    <div className="w-full">
      <ArchiveStats items={archivedItems} />

      <div className="flex flex-col gap-4 mb-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-light tracking-tight text-gray-900">Saved Assets</h2>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <label className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-2">
              <FileUp className="w-4 h-4" />
              Import JSON
              <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
            </label>
            <button
              onClick={handleExportJSON}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              Export JSON
            </button>
            <button
              onClick={() => exportArchiveZip(archivedItems)}
              disabled={archivedItems.length === 0}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download All
            </button>
            <button
              onClick={handleDownloadMultiPDF}
              disabled={selectedArchiveIndices.length === 0}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Batch PDF ({selectedArchiveIndices.length})
            </button>
          </div>
        </div>
        <label className="text-xs text-gray-500 flex items-center gap-2 max-w-sm">
          PDF watermark
          <input
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900"
            placeholder="Your shop name"
            value={watermarkText}
            onChange={(e) => setWatermarkText(e.target.value)}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {archivedItems.map((item, idx) => {
          const etsyOk = item.etsyEligible !== false && item.productId !== "prompts";
          return (
            <div key={idx} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
              {item.coverImage && (
                <img src={item.coverImage} alt="" className="w-full h-40 object-cover" />
              )}
              <div className="p-6 border-b border-gray-100 flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-2 block">
                    {item.originalNiche}
                  </span>
                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 leading-tight">
                    {item.productTitle}
                  </h3>
                  {!etsyOk && (
                    <p className="text-[11px] text-amber-700 mt-2">{ETSY_PROMPT_PACK_NOTICE}</p>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={selectedArchiveIndices.includes(idx)}
                  onChange={() => toggleArchiveSelection(idx)}
                  className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
              <div className="p-6 flex-1 text-sm text-gray-600 font-light flex flex-col justify-between">
                <p className="line-clamp-3 mb-4">{item.gumroadBlurb}</p>
                {etsyOk && item.etsyTitle && (
                  <p className="text-[11px] text-gray-500 mb-4 line-clamp-2">Etsy: {item.etsyTitle}</p>
                )}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button onClick={() => markListed(idx, "gumroad")} className="text-[10px] uppercase tracking-wider border border-gray-200 px-2 py-1 rounded hover:bg-gray-50">
                    {item.listingOutcome?.listedOn === "gumroad" ? "Listed on Gumroad" : "I listed on Gumroad"}
                  </button>
                  {etsyOk && (
                    <button onClick={() => markListed(idx, "etsy")} className="text-[10px] uppercase tracking-wider border border-gray-200 px-2 py-1 rounded hover:bg-gray-50">
                      {item.listingOutcome?.listedOn === "etsy" ? "Listed on Etsy" : "I listed on Etsy"}
                    </button>
                  )}
                  <button onClick={() => markSale(idx)} className="text-[10px] uppercase tracking-wider border border-gray-200 px-2 py-1 rounded hover:bg-gray-50">
                    {item.listingOutcome?.saleNoted ? "Sale noted" : "I made a sale"}
                  </button>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">
                    {item.priceRecommendationValue}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setViewingPdfItem(item)} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" title="View PDF" aria-label="View PDF">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDownloadPDF(item)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Download PDF" aria-label="Download PDF">
                      <FileText className="w-4 h-4" />
                    </button>
                    <button onClick={() => exportProductTxt(item, { productTypeName: item.productId || "product", niche: item.originalNiche || "", angle: "" })} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg" title="TXT" aria-label="TXT">
                      TXT
                    </button>
                    <button onClick={() => exportProductHtml(item)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg" title="HTML" aria-label="HTML">
                      HTML
                    </button>
                    <button onClick={() => downloadKit(idx, item)} className="p-2 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg" title="Sales Kit" aria-label="Sales Kit">
                      {kitBusy === idx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                    </button>
                    <button onClick={() => generateCover(idx)} className="p-2 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg" title="Cover art">
                      {coverBusy === idx ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleRemoveFromArchive(idx)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Remove">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {archivedItems.length === 0 && (
        <div className="text-center py-20 bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
          <List className="w-10 h-10 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">No manufactured products in the archive yet.</p>
        </div>
      )}

      {viewingPdfItem && (
        <PDFViewerModal
          item={viewingPdfItem}
          watermarkText={watermarkText}
          onClose={() => setViewingPdfItem(null)}
          onDownload={() => handleDownloadPDF(viewingPdfItem)}
        />
      )}
    </div>
  );
}
