"use client";

import React, { useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function PatentabilityWizardWidget() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAyurvedic, setIsAyurvedic] = useState(false);
  const [isCombination, setIsCombination] = useState(false);
  const [hasSynergy, setHasSynergy] = useState(false);
  const [usesBioResources, setUsesBioResources] = useState(false);
  const [isTreatmentMethod, setIsTreatmentMethod] = useState(false);
  const [publiclyDisclosed, setPubliclyDisclosed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAssess(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/tools/patentability-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          is_ayurvedic_or_herbal: isAyurvedic,
          is_combination_of_known_herbs_or_drugs: isCombination,
          has_synergistic_efficacy_data: hasSynergy,
          uses_indian_biological_resources: usesBioResources,
          is_method_of_treatment: isTreatmentMethod,
          publicly_disclosed_before_filing: publiclyDisclosed,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Assessment failed.");
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to assess patentability.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-[#161d27] p-6 text-slate-100 shadow-2xl">
      <div className="border-b border-slate-700/80 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔍</span>
          <h2 className="text-xl font-bold text-white">
            "Am I Patentable?" Statutory Assessment Wizard
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Evaluates statutory bars under Section 3 of The Patents Act (1970) and Section 6 of Biological Diversity Act (2002).
        </p>
      </div>

      <form onSubmit={handleAssess} className="mt-5 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
            Invention Title
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Synergistic Herbal Formulation for Blood Glucose Management"
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0f141c] p-3 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
            Brief Technical Description
          </label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explain the composition, ingredients, or novel process..."
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0f141c] p-3 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
          />
        </div>

        <div className="space-y-3 rounded-xl border border-slate-800 bg-[#0f141c] p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">
            Statutory Criteria Checklist
          </h3>

          <label className="flex items-start gap-3 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isAyurvedic}
              onChange={(e) => setIsAyurvedic(e.target.checked)}
              className="mt-1 size-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Is the invention based on traditional Ayurvedic, Unani, Siddha, or herbal knowledge? (Section 3(p))</span>
          </label>

          <label className="flex items-start gap-3 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isCombination}
              onChange={(e) => setIsCombination(e.target.checked)}
              className="mt-1 size-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Is it an admixture or combination of known herbs/chemical substances? (Section 3(e))</span>
          </label>

          <label className="flex items-start gap-3 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={hasSynergy}
              onChange={(e) => setHasSynergy(e.target.checked)}
              className="mt-1 size-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Do you possess experimental laboratory proof of synergistic therapeutic efficacy?</span>
          </label>

          <label className="flex items-start gap-3 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={usesBioResources}
              onChange={(e) => setUsesBioResources(e.target.checked)}
              className="mt-1 size-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Does it utilize biological resources (plants, herbs, seeds) sourced from India? (Section 6 NBA)</span>
          </label>

          <label className="flex items-start gap-3 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isTreatmentMethod}
              onChange={(e) => setIsTreatmentMethod(e.target.checked)}
              className="mt-1 size-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Is the primary invention drafted as a method of treating a disease? (Section 3(i))</span>
          </label>

          <label className="flex items-start gap-3 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={publiclyDisclosed}
              onChange={(e) => setPubliclyDisclosed(e.target.checked)}
              className="mt-1 size-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Has this formulation/process already been published in journals, presented publicly, or sold?</span>
          </label>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-blue-500 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{loading ? "Analyzing Statutory Bars..." : "🚀 Evaluate Patentability Risk"}</span>
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-xl border border-red-800/60 bg-red-950/50 p-3 text-sm text-red-300">
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-[#121926] p-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Feasibility Score
              </span>
              <div className="text-3xl font-black text-white">
                {result.patentability_score}/100
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                result.patentability_score >= 75
                  ? "bg-emerald-950 border border-emerald-700 text-emerald-300"
                  : result.patentability_score >= 50
                    ? "bg-amber-950 border border-amber-700 text-amber-300"
                    : "bg-red-950 border border-red-700 text-red-300"
              }`}
            >
              {result.risk_level}
            </span>
          </div>

          <p className="mt-3 text-sm text-slate-300">{result.summary}</p>

          {result.statutory_hurdles?.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-red-400">
                Statutory Hurdles Identified
              </h4>
              <div className="mt-2 space-y-2">
                {result.statutory_hurdles.map((h: any, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200"
                  >
                    <div className="font-bold text-red-300">{h.section} ({h.severity})</div>
                    <div className="mt-1 text-xs text-red-200/80">{h.issue}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.required_clearances?.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Mandatory Clearances Required
              </h4>
              <ul className="mt-1 list-inside list-disc text-sm text-amber-200/90 space-y-0.5">
                {result.required_clearances.map((c: string, idx: number) => (
                  <li key={idx}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {result.strategic_recommendations?.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Strategic Recommendations
              </h4>
              <ul className="mt-1 list-inside list-disc text-sm text-slate-300 space-y-0.5">
                {result.strategic_recommendations.map((r: string, idx: number) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
