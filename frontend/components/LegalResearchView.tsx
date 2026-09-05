"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

const apiBaseUrl = "";

interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  source: string;
  jurisdiction?: string;
}

interface LegalResearchViewProps {
  onAskQuestion: (query: string) => void;
}

export default function LegalResearchView({ onAskQuestion }: LegalResearchViewProps) {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const categoryBarRef = useRef<HTMLDivElement>(null);

  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    if (searchFilter) {
      setSearchFilter("");
    }
    categoryBarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    async function loadFaqs() {
      try {
        const res = await fetch(`${apiBaseUrl}/api/faqs`);
        if (res.ok) {
          const data = await res.json();
          setFaqs(data.faqs || []);
        }
      } catch (err) {
        console.error("Failed to load FAQs", err);
      } finally {
        setLoading(false);
      }
    }
    void loadFaqs();
  }, []);

  const categories = ["all", ...Array.from(new Set(faqs.map((f) => f.category)))];

  const filteredFaqs = faqs.filter((f) => {
    const matchesCategory = selectedCategory === "all" || f.category === selectedCategory;
    const matchesSearch =
      !searchFilter.trim() ||
      f.question.toLowerCase().includes(searchFilter.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchFilter.toLowerCase()) ||
      f.source.toLowerCase().includes(searchFilter.toLowerCase()) ||
      f.category.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-6 py-6 md:py-10 space-y-8 animate-in fade-in">
      {/* Header aligned with Stitch Legal Research & Tools */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF7F2]/80 text-[#7D4F39] text-xs font-semibold uppercase tracking-wider border card-border">
          <span className="material-symbols-outlined text-sm">menu_book</span>
          <span>Statutory Knowledge Repository</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#1E1B18] tracking-tight">
          Legal Research &amp; 25 Statutory FAQs
        </h2>
        <p className="text-sm md:text-base text-[#645D56] leading-relaxed max-w-3xl">
          Explore verified statutory guidance across Indian Patents Act 1970, Trade Marks Act 1999, TKDL Traditional Knowledge exclusions, and WIPO treaties.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div ref={categoryBarRef} className="space-y-4 bg-[#FAF7F2]/75 p-5 sm:p-6 rounded-2xl border card-border ambient-shadow">
        {/* Search Input */}
        <div className="flex items-center gap-3 w-full bg-white border card-border rounded-xl px-4 py-3 shadow-xs focus-within:border-[#7D4F39] focus-within:ring-2 focus-within:ring-[#7D4F39]/20 transition">
          <span className="material-symbols-outlined text-[#7D4F39] text-xl select-none shrink-0">
            search
          </span>
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search patents, TKDL, section 3, fees, biologics, trademarks..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-[#1E1B18] placeholder-[#8C827A] p-0 focus:ring-0"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter("")}
              className="text-xs font-bold text-[#8C827A] hover:text-[#1E1B18] cursor-pointer px-2 py-1 rounded-md hover:bg-[#FBF9F5]"
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="w-full flex flex-wrap gap-2 pt-1 items-center">
          <span className="text-xs font-semibold text-[#8C827A] uppercase tracking-wider mr-1">Categories:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategorySelect(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-[#7D4F39] text-white shadow-sm"
                  : "bg-white border card-border text-[#645D56] hover:bg-[#F1EDE6] hover:border-[#7D4F39]"
              }`}
            >
              {cat === "all" ? "ALL" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* FAQs Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-sm font-semibold text-[#8C827A] bg-white rounded-2xl border card-border flex flex-col items-center justify-center gap-3">
          <span className="material-symbols-outlined animate-spin text-3xl text-[#7D4F39]">sync</span>
          <span>Loading official statutory corpus...</span>
        </div>
      ) : filteredFaqs.length === 0 ? (
        <div className="py-16 text-center text-xs text-[#8C827A] bg-white rounded-2xl border card-border p-8 space-y-2">
          <span className="material-symbols-outlined text-4xl text-[#8C827A]">search_off</span>
          <p className="font-bold text-sm text-[#1E1B18]">No statutory FAQs matched "{searchFilter}"</p>
          <p>Try searching for terms like "Ayurvedic", "Form 1", "Section 3(p)", or "Rebate".</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {filteredFaqs.map((faq) => {
            const isExpanded = expandedId === faq.id;
            return (
              <div
                key={faq.id}
                className={`rounded-2xl border bg-white overflow-hidden transition-all duration-200 flex flex-col ambient-shadow ${
                  isExpanded ? "border-[#7D4F39] ring-2 ring-[#7D4F39]/20" : "card-border hover:border-[#7D4F39]"
                }`}
              >
                {/* Header Strip */}
                <div className="bg-[#FAF7F2]/80 px-6 py-3.5 border-b card-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#7D4F39] text-lg">policy</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCategorySelect(faq.category);
                      }}
                      title={`Filter questions by category: ${faq.category}`}
                      className={`rounded-md border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 flex items-center gap-1 ${
                        selectedCategory === faq.category
                          ? "bg-[#7D4F39] text-white border-[#7D4F39] shadow-xs"
                          : "bg-[#F6EDE7] border-[#7D4F39]/30 text-[#7D4F39] hover:bg-[#7D4F39] hover:text-white hover:border-[#7D4F39]"
                      }`}
                    >
                      <span>{faq.category}</span>
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {/* Question */}
                  <h3 className="font-bold text-base sm:text-lg text-[#1E1B18] leading-snug">
                    {faq.question}
                  </h3>

                  {/* Answer Text */}
                  <div className={`text-sm text-[#645D56] leading-relaxed ${isExpanded ? "whitespace-pre-line" : "line-clamp-3"}`}>
                    <ReactMarkdown 
                      components={{
                        p: ({ children }) => <span>{children}</span>,
                        strong: ({ children }) => <strong className="font-bold text-[#1E1B18]">{children}</strong>,
                      }}
                    >
                      {faq.answer}
                    </ReactMarkdown>
                  </div>

                  {/* Expanded Statutory Highlight Box (Stitch Unified Theme style) */}
                  {isExpanded && (
                    <div className="mt-4 p-4 rounded-r-xl bg-[#FAF7F2]/60 border-l-4 border-[#C86D3B] space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#C86D3B]">
                        <span className="material-symbols-outlined text-sm">menu_book</span>
                        <span>Statutory Citation &amp; Evidence</span>
                      </div>
                      <p className="font-statutory text-sm text-[#C86D3B] font-medium leading-relaxed">
                        "{faq.source}"
                      </p>
                      <span className="block text-[11px] text-[#8C827A] uppercase tracking-wider">
                        — Verified under Indian Patents Act 1970 / TKDL Guidelines
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="bg-[#FBF9F5] px-6 py-3 border-t card-border flex items-center justify-between gap-4 text-xs">
                  <div className="text-[11px] text-[#C86D3B] font-statutory truncate max-w-[60%] flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">gavel</span>
                    <span className="truncate">{faq.source}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                      className="px-3 py-1.5 rounded-lg border card-border hover:bg-white text-xs font-semibold text-[#645D56] transition cursor-pointer"
                    >
                      {isExpanded ? "Show Less ▲" : "Read More ▼"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAskQuestion(faq.question)}
                      className="rounded-lg bg-[#7D4F39] hover:bg-[#643B28] px-3.5 py-1.5 text-xs font-bold text-white transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <span>Ask AI</span>
                      <span className="material-symbols-outlined text-xs">send</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

