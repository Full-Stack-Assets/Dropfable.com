import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { ArchiveStats } from './ArchiveStats';
import { ManufactureResult } from '../types';
import { PRODUCTS } from '../constants';
import { Download, Trash2, Eye, FileText, FileDown, FileUp, List } from 'lucide-react';
import { PDFViewerModal } from './PDFViewerModal';
import ReactMarkdown from 'react-markdown';

interface ArchiveViewProps {
  archivedItems: ManufactureResult[];
  selectedArchiveIndices: number[];
  toggleArchiveSelection: (idx: number) => void;
  handleRemoveFromArchive: (idx: number) => void;
  setSelectedArchiveIndices: React.Dispatch<React.SetStateAction<number[]>>;
  watermarkText: string;
  setArchivedItems: React.Dispatch<React.SetStateAction<ManufactureResult[]>>;
}

export function ArchiveView({
  archivedItems,
  selectedArchiveIndices,
  toggleArchiveSelection,
  handleRemoveFromArchive,
  setSelectedArchiveIndices,
  watermarkText,
  setArchivedItems
}: ArchiveViewProps) {
  const [viewingPdfItem, setViewingPdfItem] = useState<ManufactureResult | null>(null);

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

    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    const titleLines = doc.splitTextToSize(item.productTitle || '', 180);
    doc.text(titleLines, 105, 100, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.text(`Target Audience: ${item.originalNiche || "General"}`, 105, 130 + (titleLines.length * 10), { align: "center" });

    addFooter();
    doc.addPage();
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    addFooter();
    
    const textLines = doc.splitTextToSize(item.productContent || '', 180);
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
    
    const safeTitle = (item.productTitle || 'product').toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    doc.save(`${safeTitle}.pdf`);
  };

  const handleDownloadMultiPDF = () => {
    if (selectedArchiveIndices.length === 0) return;
    const doc = new jsPDF();

    const addFooter = () => {
      doc.setFontSize(10);
      doc.setTextColor(150);
      const footerText = watermarkText.trim() ? `Manufactured by DropKit • ${watermarkText}` : "Manufactured by DropKit Digital Factory";
      doc.text(footerText, 105, 285, { align: "center" });
      doc.setTextColor(0);
      doc.setFontSize(11);
    };

    // Table of Contents Page
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("Batch Manufacturing Archive", 105, 40, { align: "center" });
    doc.setFontSize(16);
    doc.text("Table of Contents", 105, 55, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    let tocY = 75;
    
    selectedArchiveIndices.forEach((idx, i) => {
      const item = archivedItems[idx];
      if (tocY > 270) {
        doc.addPage();
        tocY = 20;
      }
      doc.text(`${i + 1}. ${item.productTitle || "Untitled Product"} - (${item.originalNiche || "General Niche"})`, 20, tocY);
      tocY += 10;
    });

    addFooter();

    // Content Pages
    selectedArchiveIndices.forEach((idx) => {
      const item = archivedItems[idx];
      doc.addPage();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      const titleLines = doc.splitTextToSize(item.productTitle || '', 180);
      doc.text(titleLines, 105, 100, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(14);
      doc.text(`Target Audience: ${item.originalNiche || "General"}`, 105, 130 + (titleLines.length * 10), { align: "center" });

      addFooter();

      doc.addPage();
      doc.setTextColor(0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      addFooter();

      let y = 20;
      const textLines = doc.splitTextToSize(item.productContent || '', 180);
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
          // Merge imported with current
          const newItems = [...archivedItems];
          imported.forEach((item) => {
            if (!newItems.some(i => i.productTitle === item.productTitle)) {
              newItems.push(item);
            }
          });
          setArchivedItems(newItems);
        }
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  return (
    <div className="w-full">
      <ArchiveStats items={archivedItems} />
      
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-light tracking-tight text-gray-900">Saved Assets</h2>
        <div className="flex items-center gap-3">
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
            onClick={handleDownloadMultiPDF}
            disabled={selectedArchiveIndices.length === 0}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Batch PDF ({selectedArchiveIndices.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {archivedItems.map((item, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-start justify-between">
              <div className="flex-1 pr-4">
                <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-2 block">
                  {item.originalNiche}
                </span>
                <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 leading-tight">
                  {item.productTitle}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedArchiveIndices.includes(idx)}
                  onChange={() => toggleArchiveSelection(idx)}
                  className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>
            <div className="p-6 flex-1 text-sm text-gray-600 font-light flex flex-col justify-between">
              <p className="line-clamp-3 mb-6">
                {item.gumroadBlurb}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">
                  {item.priceRecommendationValue}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setViewingPdfItem(item)}
                    className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="View PDF"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDownloadPDF(item)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Download PDF"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRemoveFromArchive(idx)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
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
