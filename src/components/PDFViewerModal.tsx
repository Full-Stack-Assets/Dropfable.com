import { useEffect, useRef, useState } from "react";
import { X, Download } from "lucide-react";
import { ManufactureResult } from "../types";
import { buildProductPdf } from "../lib/export";

interface PDFViewerModalProps {
  item: ManufactureResult;
  watermarkText: string;
  onClose: () => void;
  onDownload: () => void;
}

export function PDFViewerModal({ item, watermarkText, onClose, onDownload }: PDFViewerModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    const doc = buildProductPdf(item, watermarkText);
    const pdfUrl = URL.createObjectURL(doc.output("blob"));
    if (iframeRef.current) {
      iframeRef.current.src = pdfUrl;
    }
    setLoading(false);
    return () => URL.revokeObjectURL(pdfUrl);
  }, [item, watermarkText]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-8">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="font-semibold text-gray-900 truncate pr-4">Preview: {item.productTitle}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onDownload}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-gray-100 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          )}
          <iframe ref={iframeRef} className="w-full h-full border-none" title="PDF Preview" />
        </div>
      </div>
    </div>
  );
}
