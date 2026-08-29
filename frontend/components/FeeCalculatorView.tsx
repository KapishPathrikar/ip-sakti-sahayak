"use client";

import React, { useState, useEffect, useCallback } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function FeeCalculatorView() {
  const [activeTab, setActiveTab] = useState<"calculator" | "wizard">("calculator");

  // ── Fee Calculator State ──────────────────────────────────────────────
  const [ipType, setIpType] = useState<"patent" | "trademark">("patent");
  const [applicantType, setApplicantType] = useState<"startup" | "natural" | "other">("startup");
  const [filingStage, setFilingStage] = useState("new");
  const [isSubsidyEligible, setIsSubsidyEligible] = useState(true);
  const [isExpedited, setIsExpedited] = useState(false);
  const [feeResult, setFeeResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // ── Formal Quotation Modal State ──────────────────────────────────────
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [quoteId, setQuoteId] = useState("");

  // ── Wizard State ──────────────────────────────────────────────────────
  const [wizTitle, setWizTitle] = useState("");
  const [wizDesc, setWizDesc] = useState("");
  const [checkAyush, setCheckAyush] = useState(true);
  const [checkAdmixture, setCheckAdmixture] = useState(false);
  const [checkSynergism, setCheckSynergism] = useState(true);
  const [checkBioResources, setCheckBioResources] = useState(true);
  const [checkTreatment, setCheckTreatment] = useState(false);
  const [checkDisclosed, setCheckDisclosed] = useState(false);
  const [wizResult, setWizResult] = useState<any>(null);
  const [wizLoading, setWizLoading] = useState(false);

  // ── Handle Applicant Status Change ────────────────────────────────────
  function handleApplicantStatusChange(newStatus: "startup" | "natural" | "other") {
    setApplicantType(newStatus);
    if (newStatus === "other") {
      setIsSubsidyEligible(false);
    } else {
      setIsSubsidyEligible(true);
    }
  }

  // ── Handle Subsidy Toggle Change ──────────────────────────────────────
  function handleSubsidyToggle(checked: boolean) {
    setIsSubsidyEligible(checked);
    if (!checked && applicantType !== "other") {
      setApplicantType("other");
    } else if (checked && applicantType === "other") {
      setApplicantType("startup");
    }
  }

  // ── Dynamic Auto-Calculate Fees ───────────────────────────────────────
  const calculateFees = useCallback(async () => {
    setLoading(true);
    try {
      let reqExam = "none";
      let isEarlyPub = false;
      let isProv = false;
      if (filingStage === "examination") reqExam = isExpedited ? "expedited" : "standard";
      if (filingStage === "early_pub") isEarlyPub = true;
      if (filingStage === "provisional") isProv = true;

      // Determine applicant category for 80% rebate
      let appCategory = "startup";
      if (applicantType === "other" || !isSubsidyEligible) {
        appCategory = "large_entity";
      } else if (applicantType === "natural") {
        appCategory = "natural_person";
      } else {
        appCategory = "startup";
      }

      const res = await fetch(`${apiBaseUrl}/api/tools/fee-calculator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip_type: ipType,
          applicant_type: appCategory,
          filing_mode: "online",
          is_provisional: isProv,
          pages_count: 30,
          claims_count: 10,
          include_early_publication: isEarlyPub,
          request_examination: reqExam,
          trademark_classes_count: 1,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setFeeResult(data);
      }
    } catch (err) {
      console.error("Failed to calculate fee", err);
    } finally {
      setLoading(false);
    }
  }, [ipType, applicantType, filingStage, isSubsidyEligible, isExpedited]);

  useEffect(() => {
    void calculateFees();
  }, [calculateFees]);

  // ── Formal Quote Handlers ─────────────────────────────────────────────
  function handleGenerateQuote() {
    const qNum = "IPS-QT-" + new Date().getFullYear() + "-" + Math.floor(10000 + Math.random() * 90000);
    setQuoteId(qNum);
    setIsQuoteModalOpen(true);
  }

  const officialFee = feeResult?.total_official_fee_inr ?? (isSubsidyEligible ? 1600 : 8000);
  const professionalFee = ipType === "patent" ? 13000 : 7000;
  const estimatedTotal = officialFee + professionalFee;

  async function handleDownloadQuotePDF() {
    setIsDownloadingPdf(true);
    try {
      const applicantLabel =
        applicantType === "startup"
          ? "Startup / MSME / Educational Inst."
          : applicantType === "natural"
          ? "Natural Person(s)"
          : "Other Entity (Large Corp)";

      const payload = {
        quote_id: quoteId,
        ip_type: ipType === "patent" ? "Patent" : "Trademark",
        applicant_type: applicantLabel,
        is_subsidy_eligible: isSubsidyEligible,
        official_fee: officialFee,
        professional_fee: professionalFee,
        total_fee: estimatedTotal,
        breakdown: feeResult?.breakdown || [
          {
            item: `${ipType === "patent" ? "Patent" : "Trademark"} E-Filing Application Fee`,
            category: "Official Registry Fee",
            fee_inr: officialFee,
          },
        ],
      };

      const res = await fetch(`${apiBaseUrl}/api/tools/quote-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `IP_SAKTI_Quote_${quoteId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        alert("Could not generate PDF. Please try again.");
      }
    } catch (err) {
      console.error("Failed to download PDF quote", err);
      alert("Error downloading quote PDF.");
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  // ── Patentability Wizard Call ─────────────────────────────────────────
  async function evaluatePatentability() {
    if (!wizTitle.trim()) return;
    setWizLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/tools/patentability-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: wizTitle.trim(),
          description: wizDesc.trim() || wizTitle.trim(),
          is_ayurvedic_or_herbal: checkAyush,
          is_combination_of_known_herbs_or_drugs: checkAdmixture,
          has_synergistic_efficacy_data: checkSynergism,
          uses_indian_biological_resources: checkBioResources,
          is_method_of_treatment: checkTreatment,
          publicly_disclosed_before_filing: checkDisclosed,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setWizResult(data);
      }
    } catch (err) {
      console.error("Patentability check failed", err);
    } finally {
      setWizLoading(false);
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-6 py-6 md:py-10 animate-in fade-in">
      {/* ── Header (Stitch IP Tools) ─────────────────────────────────── */}
      <div className="mb-10 max-w-3xl mx-auto text-center md:text-left">
        <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-[#FFFDE7]/80 text-[#638C6D] font-bold text-2xl uppercase tracking-wider mb-4 border card-border">
          <span className="material-symbols-outlined text-3xl">calculate</span>
          <span>Tools</span>
        </div>
        <p className="text-base text-[#414942] leading-relaxed">
          Estimate official registry fees and professional charges for Patents and Trademarks in India.{" "}
          <br className="hidden md:block" />
          Includes special provisions for Startups, MSMEs, and Educational Institutions.
        </p>

        {/* Segmented Toggle Bar */}
        <div className="mt-8 flex gap-2 p-1.5 bg-[#E5F9E7] rounded-xl w-fit mx-auto md:mx-0 border card-border">
          <button
            onClick={() => setActiveTab("calculator")}
            className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "calculator"
                ? "bg-[#638C6D] text-white shadow-sm"
                : "text-[#1B2B20]/80 hover:bg-[#DAEDDC]"
            }`}
          >
            Official Fee Calculator
          </button>
          {/* Hiding the wizard feature as requested by the user */}
          <button
            onClick={() => setActiveTab("wizard")}
            className={`hidden px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "wizard"
                ? "bg-[#638C6D] text-white shadow-sm"
                : "text-[#1B2B20]/80 hover:bg-[#DAEDDC]"
            }`}
          >
            Am I Patentable?
          </button>
        </div>
      </div>

      {/* ── View 1: Fee Calculator Grid ───────────────────────────────── */}
      {activeTab === "calculator" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto">
          {/* Left Column: Calculator Configuration */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-[#FFFDE7]/75 rounded-2xl p-6 md:p-8 card-border ambient-shadow">
              {/* Select IP Type */}
              <div className="mb-8">
                <label className="block text-xs font-bold text-[#1B2B20]/80 uppercase tracking-wider mb-3">
                  Select IP Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div
                    onClick={() => setIpType("patent")}
                    className="relative cursor-pointer"
                  >
                    <div
                      className={`p-4 rounded-xl border transition-all duration-200 flex flex-col items-center text-center gap-2 ${
                        ipType === "patent"
                          ? "bg-white border-[#638C6D] shadow-sm ring-2 ring-[#638C6D]/20 text-[#638C6D]"
                          : "bg-white/80 card-border text-[#414942] hover:bg-white"
                      }`}
                    >
                      <span className="material-symbols-outlined text-3xl">lightbulb</span>
                      <span className="font-bold text-sm">Patent</span>
                    </div>
                  </div>

                  <div
                    onClick={() => setIpType("trademark")}
                    className="relative cursor-pointer"
                  >
                    <div
                      className={`p-4 rounded-xl border transition-all duration-200 flex flex-col items-center text-center gap-2 ${
                        ipType === "trademark"
                          ? "bg-white border-[#638C6D] shadow-sm ring-2 ring-[#638C6D]/20 text-[#638C6D]"
                          : "bg-white/80 card-border text-[#414942] hover:bg-white"
                      }`}
                    >
                      <span className="material-symbols-outlined text-3xl">verified</span>
                      <span className="font-bold text-sm">Trademark</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Applicant Status */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-[#1B2B20]/80 uppercase tracking-wider mb-2">
                  Applicant Status
                </label>
                <select
                  value={applicantType}
                  onChange={(e) =>
                    handleApplicantStatusChange(e.target.value as "startup" | "natural" | "other")
                  }
                  className="w-full bg-white border card-border text-[#1B2B20] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#638C6D] focus:border-[#638C6D] outline-none transition-shadow cursor-pointer"
                >
                  <option value="startup">Startup / MSME / Educational Inst.</option>
                  <option value="natural">Natural Person(s)</option>
                  <option value="other">Other Entity (Large Corp)</option>
                </select>
              </div>

              {/* Filing Stage */}
              <div className="mb-8">
                <label className="block text-xs font-bold text-[#1B2B20]/80 uppercase tracking-wider mb-2">
                  Filing Stage
                </label>
                <select
                  value={filingStage}
                  onChange={(e) => setFilingStage(e.target.value)}
                  className="w-full bg-white border card-border text-[#1B2B20] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#638C6D] focus:border-[#638C6D] outline-none transition-shadow cursor-pointer"
                >
                  <option value="new">New Application (E-filing)</option>
                  <option value="examination">Request for Examination</option>
                  <option value="early_pub">Early Publication</option>
                  <option value="provisional">Provisional Application</option>
                </select>
              </div>

              {/* Toggles */}
              <div className="space-y-4 pt-4 border-t card-border">
                {/* Startup 80% Subsidy Switch */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-[#638C6D]/30">
                  <div className="pr-4">
                    <p className="font-bold text-sm text-[#638C6D]">80% Startup Subsidy Eligibility</p>
                    <p className="text-xs text-[#414942] mt-0.5">
                      DPIIT Recognized Startups &amp; MSMEs receive significant official fee reductions.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={isSubsidyEligible}
                      onChange={(e) => handleSubsidyToggle(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#C1C8C0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#638C6D]"></div>
                  </label>
                </div>

                {/* Expedited Examination Switch */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-white card-border">
                  <div className="pr-4">
                    <p className="font-semibold text-sm text-[#1B2B20]">Expedited Examination</p>
                    <p className="text-xs text-[#414942] mt-0.5">
                      Accelerated patent examination under Rule 24C.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={isExpedited}
                      onChange={(e) => setIsExpedited(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#C1C8C0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#638C6D]"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Estimated Total & Breakdown */}
          <div className="lg:col-span-5">
            <div className="bg-[#FFFDE7]/75 rounded-2xl border card-border ambient-shadow sticky top-8 overflow-hidden flex flex-col h-full">
              {/* Estimated Total Header Strip */}
              <div className="bg-[#E7FBB4] p-6 border-b card-border">
                <p className="text-xs font-bold text-[#1B2B20] uppercase tracking-wider mb-1">
                  Estimated Total
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-[#638C6D]">
                    ₹{estimatedTotal.toLocaleString("en-IN")}
                  </span>
                  <span className="text-sm font-bold text-[#1B2B20]">INR</span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="p-6 flex-grow flex flex-col justify-between space-y-6">
                <div>
                  <h3 className="font-bold text-base text-[#1B2B20] mb-4">Fee Breakdown</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b card-border">
                      <div>
                        <p className="text-sm font-semibold text-[#1B2B20]">Official Registry Fee</p>
                        <p className="text-xs text-[#727971]">
                          {ipType === "patent" ? "Patent Application (E-filing)" : "Trademark Class 1 Application"}
                        </p>
                      </div>
                      <span className="font-statutory font-bold text-sm text-[#1B2B20]">
                        ₹{officialFee.toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b card-border">
                      <div>
                        <p className="text-sm font-semibold text-[#1B2B20]">Professional Charges</p>
                        <p className="text-xs text-[#727971]">Drafting &amp; Filing Services</p>
                      </div>
                      <span className="font-statutory font-bold text-sm text-[#1B2B20]">
                        ₹{professionalFee.toLocaleString("en-IN")}
                      </span>
                    </div>

                    {isSubsidyEligible && (
                      <div className="flex justify-between items-center text-[#638C6D] bg-white p-3 rounded-lg border card-border shadow-xs">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-[#638C6D]">
                            check_circle
                          </span>
                          <p className="text-xs font-bold">Startup Subsidy Applied</p>
                        </div>
                        <span className="text-xs font-bold">-80% on Official Fees</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-[#E5F9E7] p-3.5 rounded-xl flex gap-2.5 border card-border">
                    <span className="material-symbols-outlined text-[#638C6D] text-lg shrink-0 mt-0.5">
                      info
                    </span>
                    <p className="text-xs text-[#414942] leading-relaxed">
                      Professional fees are estimates based on standard IP-SAKTI partner rates. Final quotation will be generated on official letterhead.
                    </p>
                  </div>

                  <button
                    onClick={handleGenerateQuote}
                    className="w-full bg-[#638C6D] hover:bg-[#557E60] text-white py-3.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">receipt_long</span>
                    <span>Generate Formal Quote</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── View 2: "Am I Patentable?" Wizard ─────────────────────────── */}
      {activeTab === "wizard" && (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in">
          <div className="bg-[#FFFDE7]/75 rounded-2xl p-6 md:p-8 card-border ambient-shadow space-y-6">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-[#1B2B20]/80 uppercase tracking-wider mb-2">
                Invention Title
              </label>
              <input
                type="text"
                value={wizTitle}
                onChange={(e) => setWizTitle(e.target.value)}
                placeholder="e.g. Synergistic Herbal Formulation for Blood Glucose Management"
                className="w-full bg-white border card-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#638C6D] focus:border-[#638C6D] outline-none"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-[#1B2B20]/80 uppercase tracking-wider mb-2">
                Brief Technical Description
              </label>
              <textarea
                rows={4}
                value={wizDesc}
                onChange={(e) => setWizDesc(e.target.value)}
                placeholder="Explain the composition, active ingredients, or novel extraction process..."
                className="w-full bg-white border card-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#638C6D] focus:border-[#638C6D] outline-none"
              />
            </div>

            {/* Statutory Checklist */}
            <div className="pt-6 border-t card-border">
              <label className="block text-xs font-bold text-[#1B2B20]/80 uppercase tracking-wider mb-4">
                Statutory Criteria Checklist
              </label>
              <div className="space-y-3.5 bg-white p-6 rounded-xl border card-border">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkAyush}
                    onChange={(e) => setCheckAyush(e.target.checked)}
                    className="mt-1 rounded text-[#638C6D] focus:ring-[#638C6D] border-[#C1C8C0] w-4 h-4"
                  />
                  <span className="text-xs md:text-sm text-[#414942]">
                    Is the invention based on traditional Ayurvedic, Unani, Siddha, or herbal knowledge? (Section 3(p))
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkAdmixture}
                    onChange={(e) => setCheckAdmixture(e.target.checked)}
                    className="mt-1 rounded text-[#638C6D] focus:ring-[#638C6D] border-[#C1C8C0] w-4 h-4"
                  />
                  <span className="text-xs md:text-sm text-[#414942]">
                    Is it an admixture or combination of known herbs/chemical substances? (Section 3(e))
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkSynergism}
                    onChange={(e) => setCheckSynergism(e.target.checked)}
                    className="mt-1 rounded text-[#638C6D] focus:ring-[#638C6D] border-[#C1C8C0] w-4 h-4"
                  />
                  <span className="text-xs md:text-sm text-[#414942]">
                    Do you possess experimental laboratory proof of synergistic therapeutic efficacy?
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkBioResources}
                    onChange={(e) => setCheckBioResources(e.target.checked)}
                    className="mt-1 rounded text-[#638C6D] focus:ring-[#638C6D] border-[#C1C8C0] w-4 h-4"
                  />
                  <span className="text-xs md:text-sm text-[#414942]">
                    Does it utilize biological resources (plants, herbs, seeds) sourced from India? (Section 6 NBA)
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkTreatment}
                    onChange={(e) => setCheckTreatment(e.target.checked)}
                    className="mt-1 rounded text-[#638C6D] focus:ring-[#638C6D] border-[#C1C8C0] w-4 h-4"
                  />
                  <span className="text-xs md:text-sm text-[#414942]">
                    Is the primary invention drafted as a method of treating a disease? (Section 3(i))
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkDisclosed}
                    onChange={(e) => setCheckDisclosed(e.target.checked)}
                    className="mt-1 rounded text-[#638C6D] focus:ring-[#638C6D] border-[#C1C8C0] w-4 h-4"
                  />
                  <span className="text-xs md:text-sm text-[#414942]">
                    Has this formulation/process already been published in journals, presented publicly, or sold?
                  </span>
                </label>
              </div>
            </div>

            <button
              onClick={evaluatePatentability}
              disabled={wizLoading || !wizTitle.trim()}
              className="w-full bg-[#638C6D] hover:bg-[#557E60] disabled:opacity-50 text-white py-4 px-6 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {wizLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                  <span>Evaluating Statutory Corpus...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">rocket_launch</span>
                  <span>Evaluate Patentability Risk</span>
                </>
              )}
            </button>
          </div>

          {/* Wizard Result Display */}
          {wizResult && (
            <div className="bg-white rounded-2xl p-6 md:p-8 card-border ambient-shadow space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between border-b card-border pb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-2xl text-[#638C6D]">verified</span>
                  <h3 className="text-lg font-bold text-[#1B2B20]">Patentability Evaluation Result</h3>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    wizResult.patentability_score >= 70
                      ? "bg-[#E7FBB4] text-[#5A6A32] border border-[#638C6D]"
                      : "bg-[#FFDAD6] text-[#BA1A1A] border border-[#BA1A1A]/30"
                  }`}
                >
                  Score: {wizResult.patentability_score}% ({wizResult.risk_level} Risk)
                </span>
              </div>

              {/* Objections / Warnings */}
              {wizResult.objections && wizResult.objections.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#BA1A1A] uppercase tracking-wider">
                    Statutory Objections Identified:
                  </h4>
                  <div className="space-y-2">
                    {wizResult.objections.map((obj: string, i: number) => (
                      <div key={i} className="p-3 bg-[#FFDAD6]/40 rounded-xl border border-[#BA1A1A]/20 text-xs text-[#BA1A1A]">
                        ⚠️ {obj}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {wizResult.recommendations && (
                <div className="space-y-2 bg-[#FFFDE7]/75 p-5 rounded-xl border card-border">
                  <h4 className="text-xs font-bold text-[#638C6D] uppercase tracking-wider">
                    Recommended Statutory Drafting Strategy:
                  </h4>
                  <ul className="text-xs text-[#414942] space-y-1.5 list-disc pl-5">
                    {wizResult.recommendations.map((rec: string, i: number) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Formal Quote Modal ────────────────────────────────────────── */}
      {isQuoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-6 card-border ambient-shadow animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b card-border pb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl text-[#638C6D]">receipt_long</span>
                <div>
                  <h3 className="font-bold text-base text-[#1B2B20]">Official Formal Quotation</h3>
                  <p className="text-xs text-[#727971]">{quoteId}</p>
                </div>
              </div>
              <button
                onClick={() => setIsQuoteModalOpen(false)}
                className="p-1 rounded-md text-[#727971] hover:text-[#1B2B20] text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#414942]">
              <div className="flex justify-between py-1.5 border-b card-border">
                <span>IP Filing Type:</span>
                <span className="font-bold text-[#1B2B20] capitalize">{ipType} (India E-filing)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b card-border">
                <span>Applicant Category:</span>
                <span className="font-bold text-[#1B2B20]">
                  {applicantType === "startup"
                    ? "Startup / MSME"
                    : applicantType === "natural"
                    ? "Natural Person"
                    : "Large Entity"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b card-border">
                <span>Official Government Fee:</span>
                <span className="font-statutory font-bold text-[#1B2B20]">₹{officialFee.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b card-border">
                <span>Professional Partner Services:</span>
                <span className="font-statutory font-bold text-[#1B2B20]">₹{professionalFee.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between py-2 bg-[#E7FBB4] p-3 rounded-lg text-sm">
                <span className="font-bold text-[#5A6A32]">Total Payable:</span>
                <span className="font-bold text-[#638C6D]">₹{estimatedTotal.toLocaleString("en-IN")} INR</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsQuoteModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border card-border text-xs font-semibold text-[#414942] hover:bg-[#FAFAF5]"
              >
                Close
              </button>
              <button
                onClick={handleDownloadQuotePDF}
                disabled={isDownloadingPdf}
                className="flex-1 py-2.5 rounded-xl bg-[#638C6D] hover:bg-[#557E60] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                {isDownloadingPdf ? (
                  <span>Generating PDF...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">download</span>
                    <span>Download PDF Quote</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
