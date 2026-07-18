import React, { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { X, Download } from 'lucide-react';

interface PDFViewerModalProps {
  item: any;
  watermarkText: string;
  onClose: () => void;
  onDownload: () => void;
}

export function PDFViewerModal({ item, watermarkText, onClose, onDownload }: PDFViewerModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!item) return;

    const generatePdf = async () => {
      setLoading(true);
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
      
      const titleLines = doc.splitTextToSize(item.productTitle || '', 180);
      doc.text(titleLines, 105, 100, { align: "center" });
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(14);
      doc.text(`Target Audience: ${item.originalNiche || "General"}`, 105, 130 + (titleLines.length * 10), { align: "center" });

      addFooter();

      // Content Pages
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

      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      if (iframeRef.current) {
        iframeRef.current.src = pdfUrl;
      }
      setLoading(false);
    };

    generatePdf();
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
