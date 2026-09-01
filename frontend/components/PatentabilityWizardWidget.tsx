"use client";

import React, { useState } from "react";

const apiBaseUrl = "";

export default function PatentabilityWizardWidget() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAyurvedic, setIsAyurvedic] = useState(false);
  const [isCombination, setIsCombination] = useState(false);
  const [hasSynergy, setHasSynergy] = useState(false);
  const [usesBioResources, setUsesBioResources] = useState(false);
  const [isTreatmentMethod, setIsTreatmentMethod] = useState(false);
  const [publiclyDisclosed, setPubliclyDisclosed] = useState(false);

  const [step, setStep] = useState(1);

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
    <div className="rounded-2xl border border-[#E5DCBF] bg-[#FFFEFA] p-6 text-[#182C22] shadow-sm">
      <div className="border-b border-[#E5DCBF] pb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔍</span>
          <h2 className="text-xl font-bold text-[#285943]">
            "Am I Patentable?" Statutory Assessment Wizard
          </h2>
        </div>
        <p className="mt-1 text-xs font-medium text-[#7A5135]">
          Evaluates statutory bars under Section 3 of The Patents Act (1970) and Section 6 of Biological Diversity Act (2002).
        </p>
      </div>

      {/* Progress Indicators */}
      <div className="mt-4 flex items-center justify-between px-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step >= s ? "bg-[#285943] text-white" : "bg-slate-200 text-slate-500"}`}>
              {s}
            </div>
            {s < 3 && (
              <div className={`h-1 w-16 mx-2 rounded ${step > s ? "bg-[#285943]" : "bg-slate-200"}`} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleAssess} className="mt-5 space-y-4">
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#7A5135]">
                Step 1: Invention Details
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Synergistic Herbal Formulation for Blood Glucose Management"
                className="mt-1.5 w-full rounded-xl border border-[#E5DCBF] bg-[#FAF6ED] p-3 text-sm text-[#182C22] placeholder-[#7E9086] outline-none focus:border-[#285943]"
              />
            </div>

            <div>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief Technical Description: Explain the composition, active ingredients, or novel extraction process..."
                className="mt-1.5 w-full rounded-xl border border-[#E5DCBF] bg-[#FAF6ED] p-3 text-sm text-[#182C22] placeholder-[#7E9086] outline-none focus:border-[#285943]"
              />
            </div>
            
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!title || !description}
              className="w-full rounded-xl bg-[#285943] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1E4433] disabled:opacity-50"
            >
              Next Step ➔
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 rounded-xl border border-[#C8DAC5] bg-[#E9F1E8] p-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#285943]">
              Step 2: Ingredients & Synergy
            </h3>

            <label className="flex items-start gap-3 text-sm text-[#182C22] font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={isAyurvedic}
                onChange={(e) => setIsAyurvedic(e.target.checked)}
                className="mt-1 size-4 rounded accent-[#285943] focus:ring-[#285943]"
              />
              <span>Is the invention based on traditional Ayurvedic, Unani, Siddha, or herbal knowledge? (Section 3(p))</span>
            </label>

            <label className="flex items-start gap-3 text-sm text-[#182C22] font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={isCombination}
                onChange={(e) => setIsCombination(e.target.checked)}
                className="mt-1 size-4 rounded accent-[#285943] focus:ring-[#285943]"
              />
              <span>Is it an admixture or combination of known herbs/chemical substances? (Section 3(e))</span>
            </label>

            <label className="flex items-start gap-3 text-sm text-[#182C22] font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={hasSynergy}
                onChange={(e) => setHasSynergy(e.target.checked)}
                className="mt-1 size-4 rounded accent-[#285943] focus:ring-[#285943]"
              />
              <span>Do you possess experimental laboratory proof of synergistic therapeutic efficacy?</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl border border-[#285943] text-[#285943] py-2.5 text-sm font-bold shadow-sm transition hover:bg-white"
              >
                ⬅️ Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 rounded-xl bg-[#285943] py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1E4433]"
              >
                Next Step ➔
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 rounded-xl border border-[#C8DAC5] bg-[#E9F1E8] p-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#285943]">
              Step 3: Clearances & Disclosures
            </h3>

            <label className="flex items-start gap-3 text-sm text-[#182C22] font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={usesBioResources}
                onChange={(e) => setUsesBioResources(e.target.checked)}
                className="mt-1 size-4 rounded accent-[#285943] focus:ring-[#285943]"
              />
              <span>Does it utilize biological resources (plants, herbs, seeds) sourced from India? (Section 6 NBA)</span>
            </label>

            <label className="flex items-start gap-3 text-sm text-[#182C22] font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={isTreatmentMethod}
                onChange={(e) => setIsTreatmentMethod(e.target.checked)}
                className="mt-1 size-4 rounded accent-[#285943] focus:ring-[#285943]"
              />
              <span>Is the primary invention drafted as a method of treating a disease? (Section 3(i))</span>
            </label>

            <label className="flex items-start gap-3 text-sm text-[#182C22] font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={publiclyDisclosed}
                onChange={(e) => setPubliclyDisclosed(e.target.checked)}
                className="mt-1 size-4 rounded accent-[#285943] focus:ring-[#285943]"
              />
              <span>Has this formulation/process already been published in journals, presented publicly, or sold?</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 rounded-xl border border-[#285943] text-[#285943] py-3.5 text-sm font-bold shadow-sm transition hover:bg-white"
              >
                ⬅️ Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-2 w-full rounded-xl bg-amber-600 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{loading ? "Analyzing..." : "🚀 Evaluate Patentability Risk"}</span>
              </button>
            </div>
          </div>
        )}
      </form>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-medium">
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-2xl border border-[#C8DAC5] bg-[#E9F1E8] p-5">
          <div className="flex items-center justify-between border-b border-[#C8DAC5] pb-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7A5135]">
                Feasibility Score
              </span>
              <div className="text-3xl font-black text-[#285943]">
                {result.patentability_score}/100
              </div>
            </div>
            <span
              className={`rounded-full px-3.5 py-1 text-xs font-bold ${
                result.patentability_score >= 75
                  ? "bg-[#FAF4E4] border border-[#E8D2A3] text-[#C59A3D]"
                  : result.patentability_score >= 50
                    ? "bg-[#FAF4E4] border border-[#E8D2A3] text-[#7A5135]"
                    : "bg-red-100 border border-red-300 text-red-800"
              }`}
            >
              {result.risk_level}
            </span>
          </div>

          <p className="mt-3 text-sm text-[#182C22] font-medium">{result.summary}</p>

          {result.statutory_hurdles?.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A5135]">
                Statutory Hurdles Identified
              </h4>
              <div className="mt-2 space-y-2">
                {result.statutory_hurdles.map((h: any, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-red-200 bg-[#FFFEFA] p-3 text-sm text-red-900"
                  >
                    <div className="font-bold text-red-800">{h.section} ({h.severity})</div>
                    <div className="mt-1 text-xs text-[#56685E] font-medium">{h.issue}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.required_clearances?.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A5135]">
                Mandatory Clearances Required
              </h4>
              <ul className="mt-1 list-inside list-disc text-sm text-[#285943] font-medium space-y-0.5">
                {result.required_clearances.map((c: string, idx: number) => (
                  <li key={idx}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {result.strategic_recommendations?.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#285943]">
                Strategic Recommendations
              </h4>
              <ul className="mt-1 list-inside list-disc text-sm text-[#182C22] font-medium space-y-0.5">
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
