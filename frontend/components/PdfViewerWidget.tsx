"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Set up the PDF.js worker from CDN to avoid Next.js build configuration issues
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerWidgetProps {
  url: string;
  initialPage: number;
  onClose: () => void;
  title?: string;
  searchQuery?: string;
}

export default function PdfViewerWidget({ url, initialPage, onClose, title = "Document Viewer", searchQuery }: PdfViewerWidgetProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(initialPage || 1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);

  // When initialPage changes from props, jump to it
  useEffect(() => {
    if (initialPage) {
      setPageNumber(initialPage);
    }
  }, [initialPage, url]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
  }

  function changePage(offset: number) {
    setPageNumber(prevPageNumber => {
      const newPage = prevPageNumber + offset;
      if (newPage < 1) return 1;
      if (numPages && newPage > numPages) return numPages;
      return newPage;
    });
  }

  function previousPage() {
    changePage(-1);
  }

  function nextPage() {
    changePage(1);
  }

  function zoomIn() {
    setScale(prev => Math.min(prev + 0.2, 3.0));
  }

  function zoomOut() {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  }

  const textRenderer = useCallback(
    (textItem: { str: string }) => {
      if (!searchQuery) return textItem.str;
      
      const words = searchQuery
        .split(/\s+/)
        .map(w => w.replace(/[^\w\s]/g, '')) // strip punctuation
        .filter(w => w.length > 4);

      if (words.length === 0) return textItem.str;

      const regex = new RegExp(`(${words.join('|')})`, 'gi');
      const parts = textItem.str.split(regex);
      
      return (
        <React.Fragment>
          {parts.map((part, index) => 
            index % 2 !== 0 ? (
              <mark 
                key={index} 
                style={{
                  backgroundColor: 'rgba(253, 224, 71, 0.5)',
                  color: 'transparent',
                  borderRadius: '2px',
                  boxShadow: '0 0 2px rgba(253, 224, 71, 0.8)'
                }}
              >
                {part}
              </mark>
            ) : (
              <span key={index}>{part}</span>
            )
          )}
        </React.Fragment>
      );
    },
    [searchQuery]
  );

  const pdfOptions = React.useMemo(() => ({
    disableRange: true,
    disableStream: true,
  }), []);

  return (
    <div className="w-full h-full flex flex-col bg-[#F3F4F0] relative overflow-hidden">
      {/* ── Top Bar (Clean Gemini Style) ── */}
      <div className="h-14 flex items-center justify-between px-6 bg-white shrink-0 shadow-sm z-10 rounded-tl-3xl">
        <div className="flex items-center gap-3 text-[#414942]">
          <span className="material-symbols-outlined text-[#DF6D2D]">picture_as_pdf</span>
          <span className="font-bold text-sm truncate max-w-[300px]">{title}</span>
        </div>
        <div className="flex items-center gap-4">
          {searchQuery && (
            <div className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded border border-orange-200">
              Snippet: {searchQuery.substring(0, 30)}...
            </div>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#F3F4F0] rounded-full text-[#727971] transition-colors cursor-pointer"
            title="Close Viewer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
      </div>

      {/* ── PDF Container ── */}
      <div className="flex-1 overflow-auto relative custom-scrollbar flex justify-center bg-[#FAFAF5]">
        <div className="py-6 px-4 min-h-full flex items-center justify-center transition-transform duration-200">
          <Document
            file={url}
            options={pdfOptions}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center gap-3 text-[#727971]">
                <span className="material-symbols-outlined animate-spin text-3xl">sync</span>
                <span className="text-sm font-semibold">Loading document...</span>
              </div>
            }
            error={
              <div className="text-red-500 font-semibold text-sm">
                Failed to load PDF.
              </div>
            }
            className="rounded-lg shadow-xl overflow-hidden border card-border bg-white"
          >
            {!loading && (
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                customTextRenderer={textRenderer}
                className="transition-all duration-300 bg-white"
              />
            )}
          </Document>
        </div>
      </div>

      {/* ── Bottom Floating Pill (Gemini Style) ── */}
      {!loading && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#1E1E1E] text-white rounded-full px-5 py-2.5 flex items-center gap-6 shadow-2xl border border-white/10 z-20 backdrop-blur-md">
          {/* Navigation */}
          <div className="flex items-center gap-4">
            <button
              onClick={previousPage}
              disabled={pageNumber <= 1}
              className="disabled:opacity-30 hover:text-white/80 transition-colors flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <span className="text-xs font-semibold whitespace-nowrap opacity-90">
              Page {pageNumber} / {numPages || '--'}
            </span>
            <button
              onClick={nextPage}
              disabled={numPages ? pageNumber >= numPages : false}
              className="disabled:opacity-30 hover:text-white/80 transition-colors flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>

          <div className="w-px h-4 bg-white/20"></div>

          {/* Zoom */}
          <div className="flex items-center gap-3">
            <button
              onClick={zoomOut}
              disabled={scale <= 0.5}
              className="disabled:opacity-30 hover:text-white/80 transition-colors flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">remove</span>
            </button>
            <span className="text-xs font-semibold w-[3ch] text-center opacity-90">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              disabled={scale >= 3.0}
              className="disabled:opacity-30 hover:text-white/80 transition-colors flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
