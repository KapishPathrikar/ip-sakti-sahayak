"use client";

import React, { useState, useEffect } from "react";
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFFDE7]/80 text-[#638C6D] text-xs font-semibold uppercase tracking-wider border card-border">
          <span className="material-symbols-outlined text-sm">menu_book</span>
          <span>Statutory Knowledge Repository</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#1B2B20] tracking-tight">
          Legal Research &amp; 25 Statutory FAQs
        </h2>
        <p className="text-sm md:text-base text-[#414942] leading-relaxed max-w-3xl">
          Explore verified statutory guidance across Indian Patents Act 1970, Trade Marks Act 1999, TKDL Traditional Knowledge exclusions, and WIPO treaties.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="space-y-4 bg-[#FFFDE7]/75 p-5 sm:p-6 rounded-2xl border card-border ambient-shadow">
        {/* Search Input */}
        <div className="flex items-center gap-3 w-full bg-white border card-border rounded-xl px-4 py-3 shadow-xs focus-within:border-[#638C6D] focus-within:ring-2 focus-within:ring-[#638C6D]/20 transition">
          <span className="material-symbols-outlined text-[#638C6D] text-xl select-none shrink-0">
            search
          </span>
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search patents, TKDL, section 3, fees, biologics, trademarks..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-[#1B2B20] placeholder-[#727971] p-0 focus:ring-0"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter("")}
              className="text-xs font-bold text-[#727971] hover:text-[#1B2B20] cursor-pointer px-2 py-1 rounded-md hover:bg-[#FAFAF5]"
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="w-full flex flex-wrap gap-2 pt-1 items-center">
          <span className="text-xs font-semibold text-[#727971] uppercase tracking-wider mr-1">Categories:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-[#638C6D] text-white shadow-sm"
                  : "bg-white border card-border text-[#414942] hover:bg-[#E5F9E7] hover:border-[#638C6D]"
              }`}
            >
              {cat === "all" ? "ALL" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* FAQs Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-sm font-semibold text-[#727971] bg-white rounded-2xl border card-border flex flex-col items-center justify-center gap-3">
          <span className="material-symbols-outlined animate-spin text-3xl text-[#638C6D]">sync</span>
          <span>Loading official statutory corpus...</span>
        </div>
      ) : filteredFaqs.length === 0 ? (
        <div className="py-16 text-center text-xs text-[#727971] bg-white rounded-2xl border card-border p-8 space-y-2">
          <span className="material-symbols-outlined text-4xl text-[#727971]">search_off</span>
          <p className="font-bold text-sm text-[#1B2B20]">No statutory FAQs matched "{searchFilter}"</p>
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
                  isExpanded ? "border-[#638C6D] ring-2 ring-[#638C6D]/20" : "card-border hover:border-[#638C6D]"
                }`}
              >
                {/* Header Strip */}
                <div className="bg-[#FFFDE7]/80 px-6 py-3.5 border-b card-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#638C6D] text-lg">policy</span>
                    <span className="rounded-md bg-[#E7FBB4] border border-[#638C6D]/30 px-2.5 py-0.5 text-[11px] font-bold text-[#5A6A32] uppercase tracking-wider">
                      {faq.category}
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {/* Question */}
                  <h3 className="font-bold text-base sm:text-lg text-[#1B2B20] leading-snug">
                    {faq.question}
                  </h3>

                  {/* Answer Text */}
                  <div className={`text-sm text-[#414942] leading-relaxed ${isExpanded ? "whitespace-pre-line" : "line-clamp-3"}`}>
                    <ReactMarkdown 
                      components={{
                        p: ({ children }) => <span>{children}</span>,
                        strong: ({ children }) => <strong className="font-bold text-[#0F1F15]">{children}</strong>,
                      }}
                    >
                      {faq.answer}
                    </ReactMarkdown>
                  </div>

                  {/* Expanded Statutory Highlight Box (Stitch Unified Theme style) */}
                  {isExpanded && (
                    <div className="mt-4 p-4 rounded-r-xl bg-[#FFFDE7]/60 border-l-4 border-[#C84C05] space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#C84C05]">
                        <span className="material-symbols-outlined text-sm">menu_book</span>
                        <span>Statutory Citation &amp; Evidence</span>
                      </div>
                      <p className="font-statutory text-sm text-[#C84C05] font-medium leading-relaxed">
                        "{faq.source}"
                      </p>
                      <span className="block text-[11px] text-[#727971] uppercase tracking-wider">
                        — Verified under Indian Patents Act 1970 / TKDL Guidelines
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="bg-[#FAFAF5] px-6 py-3 border-t card-border flex items-center justify-between gap-4 text-xs">
                  <div className="text-[11px] text-[#C84C05] font-statutory truncate max-w-[60%] flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">gavel</span>
                    <span className="truncate">{faq.source}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                      className="px-3 py-1.5 rounded-lg border card-border hover:bg-white text-xs font-semibold text-[#414942] transition cursor-pointer"
                    >
                      {isExpanded ? "Show Less ▲" : "Read More ▼"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAskQuestion(faq.question)}
                      className="rounded-lg bg-[#638C6D] hover:bg-[#557E60] px-3.5 py-1.5 text-xs font-bold text-white transition cursor-pointer flex items-center gap-1.5 shadow-xs"
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

