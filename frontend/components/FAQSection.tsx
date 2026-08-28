"use client";

import React, { useEffect, useState } from "react";

interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  source: string;
}

interface FAQSectionProps {
  onSelectFAQ: (question: string) => void;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function FAQSection({ onSelectFAQ }: FAQSectionProps) {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
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
      }
    }
    void loadFaqs();
  }, []);

  const categories = ["All", ...Array.from(new Set(faqs.map((f) => f.category)))];
  const filteredFaqs =
    selectedCategory === "All"
      ? faqs
      : faqs.filter((f) => f.category === selectedCategory);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b pb-4">
        <h2 className="text-xl font-bold text-slate-900">
          25 Statutory IP Questions (Instant Answers)
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Authoritative answers from Indian Patent, Trademark, and TKDL legal manuals.
        </p>
      </div>

      {/* Category Tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
              selectedCategory === cat
                ? "bg-blue-700 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* FAQ Grid */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {filteredFaqs.map((faq) => {
          const isExpanded = expandedId === faq.id;
          return (
            <div
              key={faq.id}
              className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 transition hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold uppercase text-blue-700">
                  {faq.id} · {faq.category}
                </span>
                <button
                  onClick={() => onSelectFAQ(faq.question)}
                  title="Ask in live chat"
                  className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Ask Chat ↗
                </button>
              </div>

              <h3
                onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                className="mt-2 cursor-pointer font-semibold text-slate-900 hover:text-blue-700"
              >
                {faq.question}
              </h3>

              {isExpanded && (
                <div className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-700">
                  <p className="whitespace-pre-line leading-relaxed">{faq.answer}</p>
                  <div className="mt-2 text-xs font-medium text-emerald-800">
                    📚 Source: {faq.source}
                  </div>
                </div>
              )}

              <button
                onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                {isExpanded ? "▲ Hide Answer" : "▼ View Instant Answer"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
