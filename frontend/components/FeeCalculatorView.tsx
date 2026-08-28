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

  // Run calculation immediately on load and on any change
  useEffect(() => {
    void calculateFees();
  }, [calculateFees]);

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

  // ── Standard Professional Partner Fee Estimations ────────────────────
  const professionalFee = ipType === "patent" ? 13000 : 5000;
  const isLargeEntity = applicantType === "other" || !isSubsidyEligible;
  const officialFee = feeResult?.total_fee_inr ?? (ipType === "patent" ? (isLargeEntity ? 8000 : 1600) : (isLargeEntity ? 9000 : 4500));
  const estimatedTotal = officialFee + professionalFee;

  // Score badge colours
  const score = wizResult?.patentability_score ?? 0;
  const scoreBg = score >= 80 ? "#3D6448" : score >= 50 ? "#C84C05" : "#BA1A1A";

  // Shared toggle component
  const Toggle = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <label className="relative inline-flex items-center cursor-pointer select-none">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="w-11 h-6 bg-[#c1c8c0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#638C6D]" />
    </label>
  );

  return (
    <div
      className="w-full min-h-screen px-4 md:px-10 py-8 md:py-12"
      style={{ background: "#FAFAF5", fontFamily: "Inter, sans-serif" }}
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="mb-10 max-w-3xl">
        <h1 style={{ fontSize: "clamp(36px,5.5vw,56px)", fontWeight: 800, lineHeight: 1.1, color: "#1B2B20", marginBottom: "14px", letterSpacing: "-0.025em" }}>
          Tools
        </h1>
        <p style={{ fontSize: "18px", lineHeight: "28px", color: "rgba(27,43,32,0.8)" }}>
          Estimate official registry fees and professional charges for Patents and Trademarks in India.{" "}
          <br className="hidden md:block" />
          Includes special provisions for Startups, MSMEs, and Educational Institutions.
        </p>

        {/* Tab switcher */}
        <div
          className="mt-8 flex gap-2 p-1 w-fit rounded-xl"
          style={{ background: "#e5f9e7" }}
        >
          <button
            id="btn-fee-calc"
            onClick={() => setActiveTab("calculator")}
            style={{
              padding: "8px 24px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              transition: "all 0.15s",
              background: activeTab === "calculator" ? "#638C6D" : "transparent",
              color: activeTab === "calculator" ? "#ffffff" : "rgba(27,43,32,0.8)",
              boxShadow: activeTab === "calculator" ? "0 1px 4px rgba(0,0,0,0.15)" : "none",
              cursor: "pointer",
              border: "none",
            }}
          >
            Official Fee Calculator
          </button>
          <button
            id="btn-patent-wizard"
            onClick={() => setActiveTab("wizard")}
            style={{
              padding: "8px 24px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              transition: "all 0.15s",
              background: activeTab === "wizard" ? "#638C6D" : "transparent",
              color: activeTab === "wizard" ? "#ffffff" : "rgba(27,43,32,0.8)",
              boxShadow: activeTab === "wizard" ? "0 1px 4px rgba(0,0,0,0.15)" : "none",
              cursor: "pointer",
              border: "none",
            }}
          >
            Am I Patentable?
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TAB 1 — OFFICIAL FEE CALCULATOR VIEW
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "calculator" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl" id="view-fee-calc">
          {/* Left panel — inputs */}
          <div className="lg:col-span-7 space-y-6">
            <div
              className="rounded-xl p-6 md:p-8"
              style={{
                background: "rgba(255,253,231,0.75)",
                border: "1px solid rgba(27,43,32,0.1)",
                boxShadow: "0px 4px 20px rgba(61,100,72,0.04)",
              }}
            >
              {/* Select IP Type */}
              <div className="mb-8">
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "rgba(27,43,32,0.8)",
                    marginBottom: "16px",
                  }}
                >
                  Select IP Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div
                    onClick={() => setIpType("patent")}
                    className="p-4 rounded-lg flex flex-col items-center text-center gap-2 transition-all duration-200 cursor-pointer select-none"
                    style={{
                      border: ipType === "patent" ? "1px solid #638C6D" : "1px solid rgba(27,43,32,0.1)",
                      background: ipType === "patent" ? "rgba(255,253,231,1)" : "#ffffff",
                    }}
                  >
                    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke={ipType === "patent" ? "#638C6D" : "rgba(27,43,32,0.6)"} strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                        color: ipType === "patent" ? "#638C6D" : "rgba(27,43,32,0.8)",
                      }}
                    >
                      Patent
                    </span>
                  </div>

                  <div
                    onClick={() => setIpType("trademark")}
                    className="p-4 rounded-lg flex flex-col items-center text-center gap-2 transition-all duration-200 cursor-pointer select-none"
                    style={{
                      border: ipType === "trademark" ? "1px solid #638C6D" : "1px solid rgba(27,43,32,0.1)",
                      background: ipType === "trademark" ? "rgba(255,253,231,1)" : "#ffffff",
                    }}
                  >
                    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke={ipType === "trademark" ? "#638C6D" : "rgba(27,43,32,0.6)"} strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    <span
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                        color: ipType === "trademark" ? "#638C6D" : "rgba(27,43,32,0.8)",
                      }}
                    >
                      Trademark
                    </span>
                  </div>
                </div>
              </div>

              {/* Applicant Status */}
              <div className="mb-8">
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "rgba(27,43,32,0.8)",
                    marginBottom: "16px",
                  }}
                >
                  Applicant Status
                </label>
                <select
                  value={applicantType}
                  onChange={(e) => handleApplicantStatusChange(e.target.value as any)}
                  style={{
                    width: "100%",
                    background: "rgba(255,253,231,0.75)",
                    border: "1px solid rgba(27,43,32,0.1)",
                    color: "#1B2B20",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    fontSize: "16px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="startup">Startup / MSME / Educational Inst.</option>
                  <option value="natural">Natural Person(s)</option>
                  <option value="other">Other Entity (Large Corp)</option>
                </select>
              </div>

              {/* Filing Stage */}
              <div className="mb-8">
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "rgba(27,43,32,0.8)",
                    marginBottom: "16px",
                  }}
                >
                  Filing Stage
                </label>
                <select
                  value={filingStage}
                  onChange={(e) => setFilingStage(e.target.value)}
                  style={{
                    width: "100%",
                    background: "rgba(255,253,231,0.75)",
                    border: "1px solid rgba(27,43,32,0.1)",
                    color: "#1B2B20",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    fontSize: "16px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="new">New Application (E-filing)</option>
                  <option value="examination">Request for Examination</option>
                  <option value="early_pub">Early Publication</option>
                  <option value="provisional">Renewal</option>
                </select>
              </div>

              {/* Toggles */}
              <div className="space-y-4 pt-4" style={{ borderTop: "1px solid rgba(27,43,32,0.1)" }}>
                {/* Startup Subsidy Toggle */}
                <div
                  className="flex items-center justify-between p-4 rounded-lg"
                  style={{ background: "rgba(255,253,231,0.75)", border: "1px solid rgba(99,140,109,0.2)" }}
                >
                  <div>
                    <p style={{ fontSize: "16px", fontWeight: 600, color: "#638C6D" }}>
                      80% Startup Subsidy Eligibility
                    </p>
                    <p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(27,43,32,0.8)", marginTop: "4px" }}>
                      DPIIT Recognized Startups receive significant fee reductions.
                    </p>
                  </div>
                  <Toggle checked={isSubsidyEligible} onChange={handleSubsidyToggle} />
                </div>

                {/* Expedited Examination Toggle */}
                <div
                  className="flex items-center justify-between p-4 rounded-lg"
                  style={{ background: "#ffffff", border: "1px solid rgba(27,43,32,0.1)" }}
                >
                  <div>
                    <p style={{ fontSize: "16px", color: "#1B2B20" }}>Expedited Examination</p>
                    <p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(27,43,32,0.8)", marginTop: "4px" }}>
                      Available for specific applicant categories.
                    </p>
                  </div>
                  <Toggle checked={isExpedited} onChange={setIsExpedited} />
                </div>
              </div>
            </div>
          </div>

          {/* Right panel — breakdown card */}
          <div className="lg:col-span-5">
            <div
              className="rounded-xl sticky top-8 overflow-hidden flex flex-col"
              style={{
                background: "rgba(255,253,231,0.75)",
                border: "1px solid rgba(27,43,32,0.1)",
                boxShadow: "0px 4px 20px rgba(61,100,72,0.04)",
              }}
            >
              {/* Total header */}
              <div
                className="p-6"
                style={{ background: "#E7FBB4", borderBottom: "1px solid rgba(27,43,32,0.1)" }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#1B2B20",
                    marginBottom: "8px",
                  }}
                >
                  Estimated Total
                </p>
                <div className="flex items-baseline gap-2">
                  <span
                    style={{
                      fontSize: "clamp(32px,5vw,48px)",
                      fontWeight: 700,
                      letterSpacing: "-0.02em",
                      color: "#638C6D",
                    }}
                  >
                    ₹{estimatedTotal.toLocaleString("en-IN")}
                  </span>
                  <span style={{ fontSize: "16px", color: "#1B2B20" }}>INR</span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="p-6 flex-grow flex flex-col">
                <h3 style={{ fontSize: "20px", fontWeight: 600, color: "#1B2B20", marginBottom: "24px" }}>
                  Fee Breakdown
                </h3>

                <div className="space-y-4 mb-8">
                  {/* Official Registry Fee */}
                  <div
                    className="flex justify-between items-center pb-4"
                    style={{ borderBottom: "1px solid #d4e7d6" }}
                  >
                    <div>
                      <p style={{ fontSize: "16px", fontWeight: 500, color: "#1B2B20" }}>
                        Official Registry Fee
                      </p>
                      <p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(27,43,32,0.8)" }}>
                        {ipType === "patent" ? "Patent Application (E-filing)" : "Trademark Application (E-filing)"}
                      </p>
                    </div>
                    <span style={{ fontSize: "20px", fontWeight: 500, color: "#1B2B20" }}>
                      ₹{officialFee.toLocaleString("en-IN")}
                    </span>
                  </div>

                  {/* Professional Charges */}
                  <div
                    className="flex justify-between items-center pb-4"
                    style={{ borderBottom: "1px solid #d4e7d6" }}
                  >
                    <div>
                      <p style={{ fontSize: "16px", fontWeight: 500, color: "#1B2B20" }}>
                        Professional Charges
                      </p>
                      <p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(27,43,32,0.8)" }}>
                        Drafting &amp; Filing Services
                      </p>
                    </div>
                    <span style={{ fontSize: "20px", fontWeight: 500, color: "#1B2B20" }}>
                      ₹{professionalFee.toLocaleString("en-IN")}
                    </span>
                  </div>

                  {/* Itemized breakdown from backend */}
                  {feeResult?.breakdown && feeResult.breakdown.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {feeResult.breakdown.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex justify-between items-start text-xs py-1.5 border-b border-[#d4e7d6]/40"
                        >
                          <span style={{ color: "rgba(27,43,32,0.7)", maxWidth: "75%" }}>
                            {item.item || item.description}
                          </span>
                          <span style={{ fontWeight: 600, color: "#1B2B20" }}>
                            ₹{Number(item.fee_inr ?? 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Subsidy badge */}
                  {isSubsidyEligible && (
                    <div
                      className="flex items-center justify-between p-3 rounded-md"
                      style={{
                        background: "rgba(255,253,231,0.75)",
                        border: "1px solid rgba(27,43,32,0.1)",
                        color: "#638C6D",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p style={{ fontSize: "12px", fontWeight: 600 }}>Startup Subsidy Applied</p>
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: 600 }}>-80% on Official Fees</span>
                    </div>
                  )}
                </div>

                {/* Disclaimer */}
                <div
                  className="p-4 rounded-lg mb-8 mt-auto flex gap-3"
                  style={{ background: "#dff3e2" }}
                >
                  <svg
                    className="mt-0.5 shrink-0"
                    width="20"
                    height="20"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="rgba(27,43,32,0.8)"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(27,43,32,0.8)", lineHeight: "1.5" }}>
                    Professional fees are estimates based on standard IP-SAKTI partner rates.
                  </p>
                </div>

                <button
                  onClick={calculateFees}
                  style={{
                    width: "100%",
                    background: "#638C6D",
                    color: "#ffffff",
                    padding: "16px 24px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    border: "none",
                    cursor: "pointer",
                    transition: "background 0.15s",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                  }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#DF6D2D"; }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#638C6D"; }}
                >
                  Generate Formal Quote
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 2 — AM I PATENTABLE? WIZARD VIEW
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "wizard" && (
        <div className="max-w-3xl mx-auto space-y-8" id="view-patent-wizard">
          <div
            className="rounded-xl p-6 md:p-8 space-y-6"
            style={{
              background: "rgba(255,253,231,0.75)",
              border: "1px solid rgba(27,43,32,0.1)",
              boxShadow: "0px 4px 20px rgba(61,100,72,0.04)",
            }}
          >
            {/* Quick Test Samples */}
            <div className="flex flex-wrap items-center gap-2 pb-2">
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#638C6D", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Quick Test Samples:
              </span>
              <button
                type="button"
                onClick={() => {
                  setWizTitle("Synergistic Curcumin & Piperine Solid Lipid Nanoparticle Formulation");
                  setWizDesc("A novel therapeutic formulation combining Curcumin with Piperine at a 10:1 ratio, showing a 340% increase in bioavailability and statistically significant synergistic anti-inflammatory efficacy (CI < 0.65).");
                  setCheckAyush(true);
                  setCheckAdmixture(false);
                  setCheckSynergism(true);
                  setCheckBioResources(true);
                  setCheckTreatment(false);
                  setCheckDisclosed(false);
                }}
                className="px-3 py-1 rounded-md text-xs font-semibold bg-[#E5F9E7] text-[#3D6448] border border-[#638C6D]/30 hover:bg-[#638C6D] hover:text-white transition cursor-pointer"
              >
                🌿 Curcumin Synergy (High Score)
              </button>
              <button
                type="button"
                onClick={() => {
                  setWizTitle("Herbal Powder Composition of Haldi, Tulsi, and Ginger");
                  setWizDesc("A traditional powdered herbal remedy mixing turmeric, tulsi, and ginger in equal parts for relieving common cold symptoms.");
                  setCheckAyush(true);
                  setCheckAdmixture(true);
                  setCheckSynergism(false);
                  setCheckBioResources(true);
                  setCheckTreatment(true);
                  setCheckDisclosed(false);
                }}
                className="px-3 py-1 rounded-md text-xs font-semibold bg-[#FFDAD6] text-[#BA1A1A] border border-[#BA1A1A]/30 hover:bg-[#BA1A1A] hover:text-white transition cursor-pointer"
              >
                ⚠️ Classical Admixture (Section 3p Risk)
              </button>
            </div>

            {/* Invention Title */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "rgba(27,43,32,0.8)",
                  marginBottom: "8px",
                }}
              >
                Invention Title
              </label>
              <input
                type="text"
                value={wizTitle}
                onChange={(e) => setWizTitle(e.target.value)}
                placeholder="e.g. Synergistic Herbal Formulation for Blood Glucose Management"
                style={{
                  width: "100%",
                  background: "#ffffff",
                  border: "1px solid rgba(27,43,32,0.1)",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  fontSize: "16px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Technical Description */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "rgba(27,43,32,0.8)",
                  marginBottom: "8px",
                }}
              >
                Brief Technical Description
              </label>
              <textarea
                value={wizDesc}
                onChange={(e) => setWizDesc(e.target.value)}
                rows={4}
                placeholder="Explain the composition, active ingredients, or novel extraction process..."
                style={{
                  width: "100%",
                  background: "#ffffff",
                  border: "1px solid rgba(27,43,32,0.1)",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  fontSize: "16px",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Statutory Checklist */}
            <div style={{ paddingTop: "24px", borderTop: "1px solid rgba(27,43,32,0.1)" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "rgba(27,43,32,0.8)",
                  marginBottom: "16px",
                }}
              >
                Statutory Criteria Checklist
              </label>

              <div
                className="space-y-4 p-6 rounded-xl"
                style={{ background: "#e5f9e7", border: "1px solid rgba(99,140,109,0.1)" }}
              >
                {[
                  {
                    key: "ayush",
                    checked: checkAyush,
                    set: setCheckAyush,
                    label: "Is the invention based on traditional Ayurvedic, Unani, Siddha, or herbal knowledge? (Section 3(p))",
                  },
                  {
                    key: "admixture",
                    checked: checkAdmixture,
                    set: setCheckAdmixture,
                    label: "Is it an admixture or combination of known herbs/chemical substances? (Section 3(e))",
                  },
                  {
                    key: "synergism",
                    checked: checkSynergism,
                    set: setCheckSynergism,
                    label: "Do you possess experimental laboratory proof of synergistic therapeutic efficacy?",
                  },
                  {
                    key: "bio",
                    checked: checkBioResources,
                    set: setCheckBioResources,
                    label: "Does it utilize biological resources (plants, herbs, seeds) sourced from India? (Section 6 NBA)",
                  },
                  {
                    key: "treatment",
                    checked: checkTreatment,
                    set: setCheckTreatment,
                    label: "Is the primary invention drafted as a method of treating a disease? (Section 3(i))",
                  },
                  {
                    key: "disclosed",
                    checked: checkDisclosed,
                    set: setCheckDisclosed,
                    label: "Has this formulation/process already been published in journals, presented publicly, or sold?",
                  },
                ].map(({ key, checked, set, label }) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => set(e.target.checked)}
                      style={{
                        marginTop: "4px",
                        width: "16px",
                        height: "16px",
                        borderRadius: "4px",
                        accentColor: "#638C6D",
                        flexShrink: 0,
                        cursor: "pointer",
                      }}
                    />
                    <span style={{ fontSize: "16px", lineHeight: "24px", color: "rgba(27,43,32,0.8)" }}>
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Evaluate Button */}
            <button
              onClick={evaluatePatentability}
              disabled={wizLoading || !wizTitle.trim()}
              style={{
                width: "100%",
                background: wizLoading || !wizTitle.trim() ? "#a0b8a8" : "#638C6D",
                color: "#ffffff",
                padding: "16px 24px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                border: "none",
                cursor: wizLoading || !wizTitle.trim() ? "not-allowed" : "pointer",
                transition: "background 0.15s",
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
              onMouseOver={(e) => {
                if (!wizLoading && wizTitle.trim())
                  (e.currentTarget as HTMLButtonElement).style.background = "#DF6D2D";
              }}
              onMouseOut={(e) => {
                if (!wizLoading && wizTitle.trim())
                  (e.currentTarget as HTMLButtonElement).style.background = "#638C6D";
              }}
            >
              {wizLoading ? (
                "Evaluating Statutory Criteria..."
              ) : (
                <>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Evaluate Patentability Risk
                </>
              )}
            </button>
          </div>

          {/* ── Result Card ──────────────────────────────────────────── */}
          {wizResult && (
            <div
              className="rounded-xl p-6 md:p-8 space-y-6"
              style={{
                background: "rgba(255,253,231,0.75)",
                border: "1px solid rgba(27,43,32,0.1)",
                boxShadow: "0px 4px 20px rgba(61,100,72,0.04)",
              }}
            >
              {/* Score + Risk badge */}
              <div className="flex items-center gap-6">
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-full shadow-sm"
                  style={{
                    width: "84px",
                    height: "84px",
                    background: scoreBg,
                    color: "#ffffff",
                    fontSize: "26px",
                    fontWeight: 800,
                  }}
                >
                  {score}
                </div>
                <div>
                  <p
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "rgba(27,43,32,0.8)",
                    }}
                  >
                    Patentability Score
                  </p>
                  <p
                    style={{
                      fontSize: "24px",
                      fontWeight: 700,
                      color: scoreBg,
                      lineHeight: 1.2,
                    }}
                  >
                    {wizResult.risk_level ?? (score >= 80 ? "High" : score >= 50 ? "Moderate" : "Low")}
                  </p>
                  {wizResult.summary && (
                    <p style={{ fontSize: "14px", color: "rgba(27,43,32,0.8)", marginTop: "6px" }}>
                      {wizResult.summary}
                    </p>
                  )}
                </div>
              </div>

              {/* Statutory Hurdles */}
              {wizResult.statutory_hurdles && wizResult.statutory_hurdles.length > 0 && (
                <div>
                  <h4
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "rgba(27,43,32,0.8)",
                      marginBottom: "12px",
                    }}
                  >
                    Statutory Hurdles Identified
                  </h4>
                  <ul className="space-y-2">
                    {wizResult.statutory_hurdles.map((h: any, i: number) => {
                      const text = typeof h === "string" ? h : `${h.section ? `[${h.section}] ` : ""}${h.issue || ""}`;
                      return (
                        <li
                          key={i}
                          className="flex items-start gap-3 p-3 rounded-lg"
                          style={{ background: "#ffdad6", border: "1px solid rgba(186,26,26,0.2)" }}
                        >
                          <span style={{ color: "#ba1a1a", fontWeight: 700, flexShrink: 0 }}>⚠</span>
                          <span style={{ fontSize: "14px", color: "#1B2B20" }}>{text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Strategic Recommendations */}
              {wizResult.strategic_recommendations && wizResult.strategic_recommendations.length > 0 && (
                <div>
                  <h4
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "rgba(27,43,32,0.8)",
                      marginBottom: "12px",
                    }}
                  >
                    Strategic Recommendations
                  </h4>
                  <ul className="space-y-2">
                    {wizResult.strategic_recommendations.map((r: string, i: number) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-lg"
                        style={{ background: "#e5f9e7", border: "1px solid rgba(99,140,109,0.2)" }}
                      >
                        <span style={{ color: "#638C6D", fontWeight: 700, flexShrink: 0 }}>✓</span>
                        <span style={{ fontSize: "14px", color: "#1B2B20" }}>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
