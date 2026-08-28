"use client";

import React, { useState, useEffect } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function FeeCalculatorWidget() {
  const [ipType, setIpType] = useState("patent");
  const [applicantType, setApplicantType] = useState("natural_person");
  const [filingMode, setFilingMode] = useState("online");
  const [pagesCount, setPagesCount] = useState(30);
  const [claimsCount, setClaimsCount] = useState(10);
  const [earlyPub, setEarlyPub] = useState(false);
  const [examType, setExamType] = useState("none");
  const [tmClasses, setTmClasses] = useState(1);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-calculate on changes
  useEffect(() => {
    void calculateFee();
  }, [ipType, applicantType, filingMode, pagesCount, claimsCount, earlyPub, examType, tmClasses]);

  async function calculateFee() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/tools/fee-calculator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip_type: ipType,
          applicant_type: applicantType,
          filing_mode: filingMode,
          pages_count: pagesCount,
          claims_count: claimsCount,
          include_early_publication: earlyPub,
          request_examination: examType,
          trademark_classes_count: tmClasses,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Calculation failed.");
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to calculate fee.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-[#161d27] p-6 text-slate-100 shadow-2xl">
      <div className="border-b border-slate-700/80 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧮</span>
          <h2 className="text-xl font-bold text-white">
            Official Indian IP Statutory Fee Calculator
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Statutory fees computed under *The First Schedule of The Patents Rules (2024)* &amp; *The Trade Marks Rules (2017)*.
        </p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
            IP Category
          </label>
          <select
            value={ipType}
            onChange={(e) => setIpType(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0f141c] p-3 text-sm text-white outline-none focus:border-blue-500"
          >
            <option value="patent">Patent (Form 1 &amp; 2)</option>
            <option value="trademark">Trademark (Form TM-A)</option>
            <option value="design">Industrial Design (Form 1)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
            Applicant Category
          </label>
          <select
            value={applicantType}
            onChange={(e) => setApplicantType(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0f141c] p-3 text-sm text-white outline-none focus:border-blue-500"
          >
            <option value="natural_person">Natural Person / Solo Inventor (80% Subsidy)</option>
            <option value="startup">DPIIT Recognized Startup (80% Subsidy)</option>
            <option value="small_entity">Small Entity / MSME (80% Subsidy)</option>
            <option value="educational_institution">Educational Institution (80% Subsidy)</option>
            <option value="large_entity">Large Entity / Corporation (Standard Rate)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
            Filing Mode
          </label>
          <select
            value={filingMode}
            onChange={(e) => setFilingMode(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0f141c] p-3 text-sm text-white outline-none focus:border-blue-500"
          >
            <option value="online">Online e-Filing (10% Statutory Discount)</option>
            <option value="physical">Physical Paper Filing (Patent Office Counter)</option>
          </select>
        </div>

        {ipType === "patent" && (
          <>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Examination Request
              </label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0f141c] p-3 text-sm text-white outline-none focus:border-blue-500"
              >
                <option value="none">None (File Later within 48 months)</option>
                <option value="standard">Standard Examination (Form 18)</option>
                <option value="expedited">Expedited Examination (Form 18A - Startups/Women)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Specification Pages (Base: 30)
              </label>
              <input
                type="number"
                min={1}
                value={pagesCount}
                onChange={(e) => setPagesCount(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0f141c] p-3 text-sm text-white outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Total Claims (Base: 10)
              </label>
              <input
                type="number"
                min={1}
                value={claimsCount}
                onChange={(e) => setClaimsCount(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0f141c] p-3 text-sm text-white outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2 sm:col-span-2">
              <input
                type="checkbox"
                id="earlyPub"
                checked={earlyPub}
                onChange={(e) => setEarlyPub(e.target.checked)}
                className="size-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="earlyPub" className="text-sm font-medium text-slate-300 cursor-pointer">
                Request Early Publication (Form 9 - Published within 1 month)
              </label>
            </div>
          </>
        )}

        {ipType === "trademark" && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Number of Trademark Nice Classes
            </label>
            <input
              type="number"
              min={1}
              max={45}
              value={tmClasses}
              onChange={(e) => setTmClasses(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-[#0f141c] p-3 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
        )}
      </div>

      {/* Prominent Action Button */}
      <div className="mt-5">
        <button
          type="button"
          onClick={() => void calculateFee()}
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-blue-500 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
        >
          <span>{loading ? "Calculating..." : "🔄 Calculate Statutory Fee"}</span>
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-800/60 bg-red-950/50 p-3 text-sm text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="mt-6 rounded-2xl border border-blue-900/60 bg-[#121926] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                Total Statutory Official Fee
              </span>
              <div className="text-3xl font-black text-white">
                ₹{result.total_fee_inr?.toLocaleString("en-IN")}
              </div>
            </div>
            <span className="rounded-full bg-emerald-950/80 border border-emerald-700 px-3 py-1 text-xs font-bold text-emerald-300">
              {result.rebate_applied}
            </span>
          </div>

          <div className="mt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Official Itemized Fee Breakdown
            </h4>
            <div className="mt-2 divide-y divide-slate-800 rounded-xl border border-slate-800 bg-[#0f141c]">
              {result.breakdown?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between p-3 text-sm">
                  <span className="text-slate-300">{item.item}</span>
                  <span className="font-bold text-white">
                    ₹{item.fee_inr?.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {result.applicable_forms && (
            <div className="mt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Applicable Official Forms
              </h4>
              <ul className="mt-1 list-inside list-disc text-sm text-blue-300 space-y-0.5">
                {result.applicable_forms.map((f: string, idx: number) => (
                  <li key={idx}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
