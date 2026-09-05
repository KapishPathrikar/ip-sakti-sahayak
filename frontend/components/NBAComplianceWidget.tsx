"use client";

import React, { useState } from "react";

type Step = 0 | 1 | 2 | 3 | 4 | 5; // 5 is Results

export default function NBAComplianceWidget({ onGenerateMemo }: { onGenerateMemo?: (prompt: string) => void }) {
  const [currentStep, setCurrentStep] = useState<Step>(0);
  
  // State variables for answers
  const [origin, setOrigin] = useState<"india" | "foreign" | "synthetic" | null>(null);
  const [classification, setClassification] = useState<"raw" | "ntc" | "vap" | null>(null);
  const [applicant, setApplicant] = useState<"indian" | "nri" | "foreign" | "foreign_vc" | null>(null);
  const [isTK, setIsTK] = useState<boolean | null>(null);
  const [hasSynergy, setHasSynergy] = useState<boolean | null>(null);

  // Computed compliance logic
  const isExemptFromNBA = origin === "synthetic" || classification === "vap" || classification === "ntc";
  const needsFormI = (applicant === "nri" || applicant === "foreign" || applicant === "foreign_vc") && !isExemptFromNBA && origin === "india";
  const needsFormIII = applicant === "indian" && !isExemptFromNBA && origin === "india";
  
  // Scoring logic (just for visual flair)
  let score = 100;
  if (needsFormI || needsFormIII) score -= 20;
  if (isTK) score -= 30;
  if (isTK && !hasSynergy) score -= 20;
  if (origin === "synthetic") score = 100;

  const nextStep = () => {
    if (currentStep < 5) {
      // Fast path: if synthetic, skip classification
      if (currentStep === 0 && origin === "synthetic") {
        setCurrentStep(2);
      } else {
        setCurrentStep((s) => (s + 1) as Step);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      if (currentStep === 2 && origin === "synthetic") {
        setCurrentStep(0);
      } else {
        setCurrentStep((s) => (s - 1) as Step);
      }
    }
  };

  const reset = () => {
    setOrigin(null);
    setClassification(null);
    setApplicant(null);
    setIsTK(null);
    setHasSynergy(null);
    setCurrentStep(0);
  };

  const handleGenerateMemo = () => {
    const prompt = `Write a formal Legal Opinion Memo regarding the patentability and Biological Diversity Act (BDA) compliance of my invention. 
Details:
- Source of material: ${origin}
- Material Classification: ${classification || 'N/A'}
- Applicant Status: ${applicant}
- Based on Traditional Knowledge (TKDL): ${isTK ? 'Yes' : 'No'}
- Synergistic Efficacy Data Available: ${hasSynergy ? 'Yes' : 'No'}

Please structure the memo with Sections for 1. BDA Compliance (Section 6, Value Added Products etc.), 2. Patents Act Compliance (Section 3(e) & 3(p)), and 3. Strategic Recommendations.`;
    
    if (onGenerateMemo) {
      onGenerateMemo(prompt);
    } else {
      navigator.clipboard.writeText(prompt);
      alert("Memo prompt copied to clipboard! Paste it in the Legal Research chat.");
    }
  };

  const progressPercentage = (currentStep / 5) * 100;

  return (
    <div className="w-full flex justify-center p-4 sm:p-10 pb-32 font-sans">
      <div className="max-w-3xl w-full flex flex-col gap-6">
        
        {/* Header & Progress Bar */}
        <div className="bg-gradient-to-r from-[#7D4F39] to-[#643B28] p-8 rounded-2xl text-white shadow-md relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <span className="material-symbols-outlined text-9xl">admin_panel_settings</span>
          </div>
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
              <span className="material-symbols-outlined">shield_with_heart</span>
              Premium Statutory Audit
            </h1>
            <p className="text-white/90 text-sm sm:text-base max-w-xl leading-relaxed mb-6">
              A comprehensive IP & Biodiversity compliance matrix. We automatically calculate Form I/III requirements and statutory exemptions (e.g., Value Added Products) to bulletproof your patent filing.
            </p>
            
            {/* Progress Bar */}
            <div className="w-full bg-black/20 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-[#F6EDE7] h-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs mt-2 font-medium text-[#F6EDE7]/80">
              <span>Start</span>
              <span>{currentStep === 5 ? "Report Ready" : `Step ${currentStep + 1} of 5`}</span>
            </div>
          </div>
        </div>

        {/* Wizard Container */}
        <div className="bg-white rounded-2xl shadow-lg shadow-black/5 border border-[#E5DCD0] flex flex-col min-h-[400px]">
          {/* Top navigation */}
          {currentStep > 0 && currentStep < 5 && (
            <div className="px-6 pt-6 flex justify-between items-center">
              <button onClick={prevStep} className="text-[#7D4F39] text-sm font-bold flex items-center gap-1 hover:bg-[#F1EDE6]/50 px-3 py-1.5 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Back
              </button>
              <span className="text-xs font-bold text-[#8C827A] uppercase tracking-widest">
                Audit Step {currentStep} / 5
              </span>
            </div>
          )}

          {/* STEP 0: Resource Origin */}
          {currentStep === 0 && (
            <div className="p-8 md:p-12 animate-in slide-in-from-right-8 duration-300">
              <h2 className="text-2xl font-bold text-[#1E1B18] mb-3">Resource Origin</h2>
              <p className="text-[#645D56] mb-8 leading-relaxed">
                Where is the primary biological or active material in your invention sourced from?
              </p>
              
              <div className="grid gap-4 md:grid-cols-3">
                <OptionCard 
                  title="Sourced from India" 
                  icon="local_florist" 
                  desc="Plants, microbes, or animals collected within Indian territory."
                  selected={origin === "india"} 
                  onClick={() => setOrigin("india")} 
                />
                <OptionCard 
                  title="Foreign Sourced" 
                  icon="public" 
                  desc="Strictly imported biological materials (requires proof of import)."
                  selected={origin === "foreign"} 
                  onClick={() => setOrigin("foreign")} 
                />
                <OptionCard 
                  title="Strictly Synthetic" 
                  icon="science" 
                  desc="Lab-synthesized chemicals with no biological extraction."
                  selected={origin === "synthetic"} 
                  onClick={() => setOrigin("synthetic")} 
                />
              </div>
            </div>
          )}

          {/* STEP 1: Classification */}
          {currentStep === 1 && (
            <div className="p-8 md:p-12 animate-in slide-in-from-right-8 duration-300">
              <h2 className="text-2xl font-bold text-[#1E1B18] mb-3">Material Classification</h2>
              <p className="text-[#645D56] mb-8 leading-relaxed">
                Under Section 2(c) of the BDA, how is this biological material classified? 
                <span className="block text-xs mt-1 text-[#7D4F39] font-medium">*Hint: Certain classes are exempt from NBA approval!</span>
              </p>
              
              <div className="grid gap-4 md:grid-cols-3">
                <OptionCard 
                  title="Raw Material" 
                  icon="grass" 
                  desc="Raw herbs, leaves, unrefined extracts, or live specimens."
                  selected={classification === "raw"} 
                  onClick={() => setClassification("raw")} 
                />
                <OptionCard 
                  title="Normally Traded Commodity (NTC)" 
                  icon="storefront" 
                  desc="Spices, crops, or commodities officially notified under Section 40."
                  selected={classification === "ntc"} 
                  onClick={() => setClassification("ntc")} 
                />
                <OptionCard 
                  title="Value Added Product (VAP)" 
                  icon="precision_manufacturing" 
                  desc="Highly refined molecules where the raw identity is lost (e.g. purified Curcumin)."
                  selected={classification === "vap"} 
                  onClick={() => setClassification("vap")} 
                />
              </div>
            </div>
          )}

          {/* STEP 2: Applicant */}
          {currentStep === 2 && (
            <div className="p-8 md:p-12 animate-in slide-in-from-right-8 duration-300">
              <h2 className="text-2xl font-bold text-[#1E1B18] mb-3">Applicant Identity</h2>
              <p className="text-[#645D56] mb-8 leading-relaxed">
                Who will be the primary patent applicant? This strictly determines which NBA Form applies under Section 3 vs Section 7.
              </p>
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <OptionCard 
                  title="Indian Citizen/Entity" 
                  icon="flag" 
                  desc="100% Indian ownership."
                  selected={applicant === "indian"} 
                  onClick={() => setApplicant("indian")} 
                />
                <OptionCard 
                  title="Indian Entity with Foreign VC" 
                  icon="account_balance" 
                  desc="Registered in India but has foreign shareholding."
                  selected={applicant === "foreign_vc"} 
                  onClick={() => setApplicant("foreign_vc")} 
                />
                <OptionCard 
                  title="NRI" 
                  icon="flight" 
                  desc="Non-Resident Indian."
                  selected={applicant === "nri"} 
                  onClick={() => setApplicant("nri")} 
                />
                <OptionCard 
                  title="Foreign Entity" 
                  icon="language" 
                  desc="Non-Indian citizen or corporation."
                  selected={applicant === "foreign"} 
                  onClick={() => setApplicant("foreign")} 
                />
              </div>
            </div>
          )}

          {/* STEP 3: Traditional Knowledge */}
          {currentStep === 3 && (
            <div className="p-8 md:p-12 animate-in slide-in-from-right-8 duration-300">
              <h2 className="text-2xl font-bold text-[#1E1B18] mb-3">Traditional Knowledge (Section 3p)</h2>
              <p className="text-[#645D56] mb-8 leading-relaxed">
                Is your formulation or its core mechanism documented in traditional Indian texts (e.g., Ayurveda, Unani) or the TKDL?
              </p>
              
              <div className="grid gap-4 md:grid-cols-2">
                <OptionCard 
                  title="Yes, based on Traditional Knowledge" 
                  icon="menu_book" 
                  desc="The ingredients and their uses are historically documented."
                  selected={isTK === true} 
                  onClick={() => setIsTK(true)} 
                />
                <OptionCard 
                  title="No, entirely novel" 
                  icon="lightbulb" 
                  desc="Completely unknown mechanism or newly discovered plant properties."
                  selected={isTK === false} 
                  onClick={() => setIsTK(false)} 
                />
              </div>
            </div>
          )}

          {/* STEP 4: Synergy */}
          {currentStep === 4 && (
            <div className="p-8 md:p-12 animate-in slide-in-from-right-8 duration-300">
              <h2 className="text-2xl font-bold text-[#1E1B18] mb-3">Scientific Synergy (Section 3e)</h2>
              <p className="text-[#645D56] mb-8 leading-relaxed">
                If your invention is a combination of known substances, do you have concrete experimental data (in-vitro, in-vivo) proving <strong>synergistic efficacy</strong>?
              </p>
              
              <div className="grid gap-4 md:grid-cols-2">
                <OptionCard 
                  title="Yes, Synergy Data Available" 
                  icon="biotech" 
                  desc="We have lab data showing the combination is drastically more effective than the sum of its parts."
                  selected={hasSynergy === true} 
                  onClick={() => setHasSynergy(true)} 
                />
                <OptionCard 
                  title="No, merely mixed / admixture" 
                  icon="blender" 
                  desc="It is a simple mixture of ingredients for convenience or stability."
                  selected={hasSynergy === false} 
                  onClick={() => setHasSynergy(false)} 
                />
              </div>
            </div>
          )}

          {/* Next Button Footer for Steps 0-4 */}
          {currentStep < 5 && (
            <div className="mt-auto p-6 border-t border-[#E5DCD0] flex justify-end bg-gray-50/50">
              <button 
                onClick={nextStep}
                disabled={
                  (currentStep === 0 && origin === null) ||
                  (currentStep === 1 && classification === null) ||
                  (currentStep === 2 && applicant === null) ||
                  (currentStep === 3 && isTK === null) ||
                  (currentStep === 4 && hasSynergy === null)
                }
                className="bg-[#1E1B18] text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-[#643B28] transition-all shadow-md disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {currentStep === 4 ? "Generate Audit Report" : "Continue"}
                <span className="material-symbols-outlined text-[18px]">
                  {currentStep === 4 ? "analytics" : "arrow_forward"}
                </span>
              </button>
            </div>
          )}

          {/* STEP 5: FINAL REPORT */}
          {currentStep === 5 && (
            <div className="p-8 md:p-12 animate-in zoom-in-95 duration-500">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-[#1E1B18] flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#7D4F39] text-3xl">verified_user</span>
                  Statutory Audit Report
                </h2>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-[#8C827A] uppercase tracking-widest">Compliance Score</p>
                    <p className={`text-3xl font-black ${score > 80 ? 'text-[#7D4F39]' : score > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {score}/100
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                
                {/* BDA ANALYSIS */}
                <div className="border border-[#E5DCD0] rounded-xl overflow-hidden">
                  <div className="bg-[#FBF9F5] px-5 py-3 border-b border-[#E5DCD0] font-bold text-[#1E1B18] text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">psychiatry</span>
                    Biological Diversity Act (BDA) Status
                  </div>
                  <div className="p-5 bg-white">
                    {origin === "synthetic" ? (
                      <ResultRow icon="check_circle" color="text-emerald-600" title="Exempt: Synthetic Materials" desc="The BDA does not apply to strictly synthetic molecules. No NBA approval required." />
                    ) : origin === "foreign" ? (
                      <ResultRow icon="check_circle" color="text-emerald-600" title="Exempt: Non-Indian Origin" desc="Materials imported from outside India are generally exempt from NBA approval, provided you have strict proof of import and origin." />
                    ) : isExemptFromNBA ? (
                      <ResultRow icon="star" color="text-emerald-600" title="Strategic BDA Bypass Activated" desc={`Because your material is classified as a ${classification === "vap" ? "Value Added Product (VAP)" : "Normally Traded Commodity (NTC)"}, it is strictly EXEMPT from NBA approval under the BDA, even though it originates in India. This saves years of red tape.`} />
                    ) : needsFormI ? (
                      <ResultRow icon="warning" color="text-red-600" title="Section 3 Triggered: Form I Required" desc="Because the applicant is an NRI, Foreign Entity, or has foreign shareholding, you MUST file NBA Form I for prior approval to even access the resources, AND Form III before IP grant." isHighRisk />
                    ) : needsFormIII ? (
                      <ResultRow icon="gavel" color="text-indigo-600" title="Section 6 Triggered: Form III Required" desc="As an Indian entity using Indian biological resources, you must file NBA Form III. The patent office will pause your application's grant until you upload the NBA approval agreement." />
                    ) : (
                      <ResultRow icon="help" color="text-gray-500" title="Unknown BDA Status" desc="Please review the details." />
                    )}
                  </div>
                </div>

                {/* PATENTS ACT ANALYSIS */}
                <div className="border border-[#E5DCD0] rounded-xl overflow-hidden">
                  <div className="bg-[#FBF9F5] px-5 py-3 border-b border-[#E5DCD0] font-bold text-[#1E1B18] text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">balance</span>
                    Indian Patents Act (1970) Posture
                  </div>
                  <div className="p-5 bg-white space-y-4">
                    {isTK ? (
                      <ResultRow icon="history_edu" color="text-amber-600" title="Section 3(p) Risk: Traditional Knowledge" desc="The invention risks rejection under Sec 3(p) as Traditional Knowledge. The examiner will cross-reference the TKDL." />
                    ) : (
                      <ResultRow icon="check_circle" color="text-emerald-600" title="Section 3(p) Pass" desc="Not directly based on known traditional recipes. Lower risk of TKDL-based rejection." />
                    )}

                    {!hasSynergy && isTK ? (
                      <ResultRow icon="error" color="text-red-600" title="Section 3(e) Violation: Mere Admixture" desc="CRITICAL: Without synergistic data, your formulation will be rejected as a 'mere admixture' of known herbs. Utility patent chances are near zero. Pivot to Trademark/Design protection or generate in-vitro data." isHighRisk />
                    ) : hasSynergy ? (
                      <ResultRow icon="science" color="text-emerald-600" title="Section 3(e) Cleared: Synergy Data" desc="You possess synergistic efficacy data (1+1>2). This is the exact legal requirement to overcome Section 3(e) objections for herbal formulations." />
                    ) : (
                      <ResultRow icon="info" color="text-blue-600" title="Patentability Check" desc="Ensure you establish a clear inventive step." />
                    )}
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#E5DCD0] pt-6">
                <button 
                  onClick={reset}
                  className="text-sm font-bold text-[#8C827A] hover:text-[#1E1B18] transition-colors"
                >
                  Start New Audit
                </button>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {(needsFormI || needsFormIII) && (
                    <a 
                      href="https://absefiling.nic.in/NBA/login/auth" 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex-1 sm:flex-none border border-[#7D4F39] text-[#7D4F39] bg-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#F6EDE7]/30 transition-all text-sm"
                    >
                      NBA e-Filing <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    </a>
                  )}
                  <button 
                    onClick={handleGenerateMemo}
                    className="flex-1 sm:flex-none bg-gradient-to-r from-[#1E1B18] to-[#643B28] text-[#F6EDE7] px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-all text-sm group"
                  >
                    <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">auto_awesome</span>
                    Draft Legal Memo via AI
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function OptionCard({ title, icon, desc, selected, onClick }: { title: string, icon: string, desc: string, selected: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 flex flex-col h-full
        ${selected 
          ? 'border-[#7D4F39] bg-[#F1EDE6]/40 shadow-sm' 
          : 'border-[#E5DCD0] bg-white hover:border-[#E5DCD0] hover:bg-slate-50'
        }
      `}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 transition-colors ${selected ? 'bg-[#7D4F39] text-white' : 'bg-[#FBF9F5] text-[#7D4F39]'}`}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <h3 className={`font-bold mb-1.5 text-sm ${selected ? 'text-[#1E1B18]' : 'text-[#645D56]'}`}>{title}</h3>
      <p className="text-xs text-[#8C827A] leading-relaxed mt-auto">{desc}</p>
    </div>
  );
}

function ResultRow({ icon, color, title, desc, isHighRisk = false }: { icon: string, color: string, title: string, desc: string, isHighRisk?: boolean }) {
  return (
    <div className={`flex gap-4 p-4 rounded-xl ${isHighRisk ? 'bg-red-50/50 border border-red-100' : ''}`}>
      <span className={`material-symbols-outlined ${color} mt-0.5`}>{icon}</span>
      <div>
        <h4 className={`font-bold text-sm mb-1 ${isHighRisk ? 'text-red-900' : 'text-[#1E1B18]'}`}>{title}</h4>
        <p className={`text-xs leading-relaxed ${isHighRisk ? 'text-red-800' : 'text-[#645D56]'}`}>{desc}</p>
      </div>
    </div>
  );
}
