"use client";

import React, { useState, useEffect } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FFFDE7] text-[#638C6D] text-xs font-bold uppercase tracking-wider border border-[#D4E7D6]">
          <span>📖</span>
          <span>Statutory Knowledge Repository</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F1F15] tracking-tight">
          Legal Research &amp; 25 Statutory FAQs
        </h2>
        <p className="text-sm text-[#414942] leading-relaxed max-w-2xl">
          Explore curated, verified statutory guidance across Indian Patents, Trademarks, TKDL Traditional Knowledge, and WIPO treaties.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="space-y-4 bg-[#FFFDE7]/60 p-4 sm:p-6 rounded-2xl border border-[#D4E7D6] shadow-2xs">
        {/* Search Input with Icon to the Left */}
        <div className="flex items-center gap-3 w-full bg-white border border-[#D4E7D6] rounded-xl px-4 py-3 shadow-2xs focus-within:border-[#638C6D] focus-within:ring-2 focus-within:ring-[#638C6D]/20 transition">
          <span className="text-[#638C6D] text-lg select-none shrink-0 leading-none">
            🔍
          </span>
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search patents, TKDL, section 3, fees, biologics, trademarks..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-[#0F1F15] placeholder-[#727971] p-0 focus:ring-0"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter("")}
              className="text-xs font-bold text-[#727971] hover:text-[#0F1F15] cursor-pointer px-2 py-1 rounded-md hover:bg-[#FAFAF5]"
            >
              ✕ Clear
            </button>
          )}
        </div>


        {/* Category Filter Pills */}
        <div className="w-full flex flex-wrap gap-2 pt-2">
          <span className="text-xs font-bold text-[#727971] uppercase tracking-wider self-center shrink-0 mr-1">Categories:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`w-[90px] h-[54px] px-4 rounded-xl text-[10px] font-bold uppercase tracking-wider transition cursor-pointer text-center flex items-center justify-center leading-snug whitespace-normal break-words ${selectedCategory === cat
                ? "bg-[#638C6D] text-white ring-2 ring-[#638C6D]/30 shadow-sm"
                : "bg-white border border-[#D4E7D6] text-[#414942] hover:bg-[#E5F9E7] hover:border-[#638C6D]"
                }`}
            >
              {cat === "all" ? "ALL" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* FAQs Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-sm font-semibold text-[#727971] animate-pulse bg-white rounded-2xl border border-[#D4E7D6]">
          🌿 Loading official statutory corpus...
        </div>
      ) : filteredFaqs.length === 0 ? (
        <div className="py-16 text-center text-xs text-[#727971] bg-white rounded-2xl border border-[#D4E7D6] p-8 space-y-2">
          <div className="text-2xl">🔎</div>
          <p className="font-bold text-sm text-[#0F1F15]">No statutory FAQs matched "{searchFilter}"</p>
          <p>Try searching for terms like "Ayurvedic", "Form 1", "Section 3(p)", or "Rebate".</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredFaqs.map((faq) => {
            const isExpanded = expandedId === faq.id;
            return (
              <div
                key={faq.id}
                className={`rounded-2xl border bg-white p-6 sm:p-7 transition-all duration-200 flex flex-col justify-between shadow-xs ${isExpanded ? "border-[#638C6D] ring-2 ring-[#638C6D]/20 shadow-md" : "border-[#D4E7D6] hover:border-[#638C6D]"
                  }`}
              >
                <div className="space-y-4">
                  {/* Category Pill & ID */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-[#E7FBB4] border border-[#638C6D]/30 px-3 py-0.5 text-[11px] font-bold text-[#3D6448] uppercase tracking-wider">
                      {faq.category}
                    </span>
                    <span className="font-mono text-xs font-semibold text-[#727971] bg-[#FAFAF5] px-2 py-0.5 rounded border border-[#D4E7D6]">
                      {faq.id}
                    </span>
                  </div>

                  {/* Question */}
                  <h3 className="font-extrabold text-base sm:text-lg text-[#0F1F15] leading-snug">
                    {faq.question}
                  </h3>

                  {/* Answer Text */}
                  <div className="text-xs sm:text-sm text-[#414942] leading-relaxed">
                    <p className={isExpanded ? "whitespace-pre-line" : "line-clamp-3"}>
                      {faq.answer}
                    </p>
                  </div>

                  {/* Expanded Statutory Details */}
                  {isExpanded && (
                    <div className="mt-4 p-4 rounded-xl bg-[#FFFDE7]/80 border border-[#C84C05]/30 space-y-2 animate-in fade-in">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#C84C05]">
                        <span>📜</span>
                        <span>Official Statutory Source:</span>
                      </div>
                      <p className="font-statutory text-sm text-[#0F1F15] font-semibold">
                        {faq.source}
                      </p>
                      <p className="text-[11px] text-[#727971]">
                        Verified under Indian Patents Act, 1970 and Trade Marks Act, 1999 (IPO / WIPO / TKDL guidelines).
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="mt-5 pt-4 border-t border-[#D4E7D6] flex items-center justify-between gap-4 text-xs">
                  <div className="text-[11px] text-[#C84C05] font-statutory truncate max-w-[60%]">
                    📜 <b>{faq.source}</b>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                      className="px-4 py-1.5 rounded-lg border border-[#D4E7D6] hover:bg-[#FAFAF5] text-xs font-bold text-[#414942] transition cursor-pointer whitespace-nowrap"
                    >
                      {isExpanded ? "Show Less ▲" : "Read More ▼"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onAskQuestion(faq.question)}
                      className="ml-2 rounded-lg bg-[#638C6D] hover:bg-[#3D6448] px-4 py-1.5 text-xs font-bold text-white shadow-2xs transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <span>Ask AI</span>
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4.5M9.5 2.5V7.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
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
