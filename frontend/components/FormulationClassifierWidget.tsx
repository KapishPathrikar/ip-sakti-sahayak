"use client";

import React, { useState } from "react";

type CategoryResult = {
  type: "result";
  name: string;
  ipPosture: string;
  protection: string;
  abs: string;
  color: string;
};

type QuestionNode = {
  type: "question";
  id: string;
  text: string;
  options: {
    label: string;
    next: QuestionNode | CategoryResult;
  }[];
};

const RESULTS = {
  CLASSICAL: {
    type: "result",
    name: "Classical / Generic Formulation",
    ipPosture: "Barred from patenting under Section 3(p) of the Patents Act.",
    protection: "Defended defensively via the Traditional Knowledge Digital Library (TKDL).",
    abs: "Exempt from NBA Form 1 approval under Biological Diversity Act.",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200",
  } as CategoryResult,
  PHYTOPHARMACEUTICAL: {
    type: "result",
    name: "Phytopharmaceutical Drug",
    ipPosture: "Highly patentable. Treated closer to modern allopathic drugs.",
    protection: "Utility patents possible for composition, extraction methods, and precise fraction ratios.",
    abs: "Mandatory NBA Form 1 compliance required if Indian biological resources are used.",
    color: "bg-blue-50 text-blue-800 border-blue-200",
  } as CategoryResult,
  NOT_AYURVEDA: {
    type: "result",
    name: "Not Ayurveda (Outside Scope)",
    ipPosture: "Products with synthetic APIs fall under modern allopathic medicine.",
    protection: "Standard modern pharmaceutical patenting applies.",
    abs: "Standard rules apply depending on biological inputs.",
    color: "bg-slate-50 text-slate-800 border-slate-200",
  } as CategoryResult,
  AYURVEDA_AAHAR: {
    type: "result",
    name: "Ayurveda Aahar (Nutraceutical)",
    ipPosture: "Utility patents are rare unless novel processing methods are used. No therapeutic claims allowed.",
    protection: "Focus strongly on Trademarks, Branding, and Design patents (packaging).",
    abs: "Subject to FSSAI guidelines. NBA compliance applies if biological resources are commercialized.",
    color: "bg-orange-50 text-orange-800 border-orange-200",
  } as CategoryResult,
  COSMETIC: {
    type: "result",
    name: "Ayurvedic Cosmetic",
    ipPosture: "No therapeutic claims allowed.",
    protection: "Focus on Trademarks, Brand Identity, and Design protection.",
    abs: "Mandatory NBA compliance if biological resources are used.",
    color: "bg-pink-50 text-pink-800 border-pink-200",
  } as CategoryResult,
  PROPRIETARY: {
    type: "result",
    name: "Patent or Proprietary Medicine (P&P)",
    ipPosture: "Genuine patent potential if you can prove synergistic efficacy or novel extraction method (overcoming Sec 3(e) and 3(p)).",
    protection: "Utility patents for novel combinations/synergies.",
    abs: "MANDATORY National Biodiversity Authority (NBA) approval (Form 1) required before patent grant.",
    color: "bg-purple-50 text-purple-800 border-purple-200",
  } as CategoryResult,
  NEW_DRUG: {
    type: "result",
    name: "New Ayurvedic Drug",
    ipPosture: "High patent potential. Requires rigorous clinical safety and efficacy data.",
    protection: "Utility patents for novel composition and method of treatment (in permitted jurisdictions).",
    abs: "MANDATORY National Biodiversity Authority (NBA) approval (Form 1) required before patent grant.",
    color: "bg-indigo-50 text-indigo-800 border-indigo-200",
  } as CategoryResult,
};

const DECISION_TREE: QuestionNode = {
  type: "question",
  id: "q1",
  text: "Is the formulation strictly manufactured according to the exact recipe in an authoritative text (First Schedule of Drugs & Cosmetics Act)?",
  options: [
    { label: "Yes, exact traditional recipe", next: RESULTS.CLASSICAL },
    {
      label: "No",
      next: {
        type: "question",
        id: "q2",
        text: "Is it a purified and characterized fraction from a medicinal plant (not an entire extract) intended for modern allopathic-style clinical use?",
        options: [
          { label: "Yes", next: RESULTS.PHYTOPHARMACEUTICAL },
          {
            label: "No",
            next: {
              type: "question",
              id: "q3",
              text: "Does it contain any synthetic chemicals/APIs, or is it strictly plant/animal/mineral based?",
              options: [
                { label: "Contains synthetic chemicals", next: RESULTS.NOT_AYURVEDA },
                {
                  label: "Strictly natural (Ayurvedic)",
                  next: {
                    type: "question",
                    id: "q4",
                    text: "Is it intended to be consumed purely as food/nutrition with NO therapeutic or medicinal claims?",
                    options: [
                      { label: "Yes, food/nutrition only", next: RESULTS.AYURVEDA_AAHAR },
                      {
                        label: "No, has health benefits/claims",
                        next: {
                          type: "question",
                          id: "q5",
                          text: "Is it applied to the human body for cleansing, beautifying, or altering appearance without therapeutic claims?",
                          options: [
                            { label: "Yes, it is a cosmetic", next: RESULTS.COSMETIC },
                            {
                              label: "No",
                              next: {
                                type: "question",
                                id: "q6",
                                text: "Is it a new combination of known herbs, or a completely novel formulation?",
                                options: [
                                  { label: "Combination of known herbs", next: RESULTS.PROPRIETARY },
                                  { label: "Completely novel / New indication", next: RESULTS.NEW_DRUG },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
};

export default function FormulationClassifierWidget() {
  const [history, setHistory] = useState<(QuestionNode | CategoryResult)[]>([DECISION_TREE]);

  const handleOptionClick = (nextNode: QuestionNode | CategoryResult) => {
    setHistory([...history, nextNode]);
  };

  const reset = () => {
    setHistory([DECISION_TREE]);
  };

  const goBack = () => {
    if (history.length > 1) {
      setHistory(history.slice(0, -1));
    }
  };

  return (
    <div className="rounded-2xl border border-[#E5DCBF] bg-[#FFFEFA] p-6 text-[#182C22] shadow-sm flex flex-col h-full max-h-[600px]">
      <div className="border-b border-[#E5DCBF] pb-4 shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl material-symbols-outlined text-[#285943]">account_tree</span>
            <h2 className="text-xl font-bold text-[#285943]">
              Regulatory Formulation Classifier
            </h2>
          </div>
          <p className="mt-1 text-xs font-medium text-[#7A5135]">
            Discover your IP and Access-and-Benefit-Sharing (ABS) posture instantly.
          </p>
        </div>
        <button onClick={reset} className="text-xs font-bold text-[#285943] hover:underline flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">refresh</span> Reset
        </button>
      </div>

      <div className="flex-1 overflow-y-auto mt-4 pr-2 space-y-4 custom-scrollbar">
        {history.map((node, index) => {
          const isCurrent = index === history.length - 1;

          if (node.type === "question") {
            return (
              <div
                key={index}
                className={`p-4 rounded-xl border transition-all ${
                  isCurrent
                    ? "border-[#285943] bg-[#FAF6ED] shadow-sm"
                    : "border-[#E5DCBF] bg-white opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="bg-[#285943] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    Q
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{node.text}</h3>
                    {isCurrent && (
                      <div className="mt-4 flex flex-col sm:flex-row gap-2">
                        {node.options.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => handleOptionClick(opt.next)}
                            className="bg-white border border-[#285943] text-[#285943] hover:bg-[#285943] hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors text-left flex-1"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          } else {
            return (
              <div
                key={index}
                className={`p-5 rounded-xl border shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 ${node.color}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined">verified</span>
                  <h3 className="font-bold text-lg">{node.name}</h3>
                </div>
                
                <div className="space-y-3 text-sm mt-4">
                  <div>
                    <span className="font-bold uppercase tracking-wider text-[10px] opacity-70 block mb-1">IP Posture</span>
                    <p className="font-medium">{node.ipPosture}</p>
                  </div>
                  <div>
                    <span className="font-bold uppercase tracking-wider text-[10px] opacity-70 block mb-1">Protection Strategy</span>
                    <p className="font-medium">{node.protection}</p>
                  </div>
                  <div>
                    <span className="font-bold uppercase tracking-wider text-[10px] opacity-70 block mb-1">ABS Compliance (Biological Diversity Act)</span>
                    <p className="font-medium">{node.abs}</p>
                  </div>
                </div>
              </div>
            );
          }
        })}
      </div>

      {history.length > 1 && (
        <div className="pt-4 shrink-0 flex justify-start border-t border-[#E5DCBF] mt-2">
          <button onClick={goBack} className="text-sm font-bold text-[#7A5135] hover:text-[#285943] flex items-center gap-1 transition-colors">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Go Back
          </button>
        </div>
      )}
    </div>
  );
}
