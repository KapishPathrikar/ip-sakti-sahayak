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

function OptionCard({ title, icon, selected, onClick }: { title: string; icon: string; selected: boolean; onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 flex flex-col h-full items-center text-center ${
        selected 
          ? "border-[#7D4F39] bg-[#FBF9F5] shadow-sm" 
          : "border-[#E5DCD0] bg-white hover:border-[#C86D3B] hover:bg-slate-50"
      }`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors ${selected ? "bg-[#7D4F39] text-white" : "bg-[#FBF9F5] text-[#7D4F39]"}`}>
        <span className="material-symbols-outlined text-[24px]">{icon}</span>
      </div>
      <h3 className={`font-bold mb-1.5 text-base ${selected ? "text-[#1E1B18]" : "text-[#645D56]"}`}>{title}</h3>
    </div>
  );
}

function ResultRow({ icon, color, title, desc }: { icon: string; color: string; title: string; desc: string }) {
  return (
    <div className="flex gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors">
      <span className={`material-symbols-outlined ${color} mt-0.5`}>{icon}</span>
      <div>
        <h4 className="font-bold text-sm mb-1 text-[#1E1B18]">{title}</h4>
        <p className="text-xs leading-relaxed text-[#645D56]">{desc}</p>
      </div>
    </div>
  );
}

export default function FormulationClassifierWidget() {
  const [history, setHistory] = useState<(QuestionNode | CategoryResult)[]>([DECISION_TREE]);
  const [doubtQuestion, setDoubtQuestion] = useState<QuestionNode | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatting]);

  const currentNode = history[history.length - 1];
  const currentStep = history.length;

  const sendDoubtMessage = async () => {
    if (!chatInput.trim() || !doubtQuestion) return;
    
    const userMsg = chatInput;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsChatting(true);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: `Regarding the regulatory question: "${doubtQuestion.text}"\nUser asks: ${userMsg}\nPlease keep the answer very brief (1-3 sentences) and focused strictly on explaining the regulatory context of this specific question to help the user choose an option.`,
          session_id: "classifier-session",
          jurisdiction: "india",
          allow_cloud: true
        })
      });

      if (!response.body) throw new Error("No body in response");

      setChatMessages(prev => [...prev, { role: "assistant", content: "" }]);
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let currentAiText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") {
              break;
            }
            try {
              const event = JSON.parse(dataStr);
              if (event.type === "token" && event.token) {
                currentAiText += event.token;
                setChatMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1].content = currentAiText;
                  return updated;
                });
              }
            } catch {
              // Ignore parse errors on partial chunks
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
      setChatMessages(prev => {
        const updated = [...prev];
        if (updated[updated.length - 1]?.role === "assistant" && !updated[updated.length - 1]?.content) {
          updated[updated.length - 1].content = "Sorry, I couldn't reach the server. Please try again.";
        } else {
          updated.push({ role: "assistant", content: "Sorry, I couldn't reach the server. Please try again." });
        }
        return updated;
      });
    } finally {
      setIsChatting(false);
    }
  };

  const handleOptionClick = (nextNode: QuestionNode | CategoryResult) => {
    setHistory([...history, nextNode]);
    setDoubtQuestion(null);
  };

  const reset = () => {
    setHistory([DECISION_TREE]);
    setDoubtQuestion(null);
  };

  const goBack = () => {
    if (history.length > 1) {
      setHistory(history.slice(0, -1));
      setDoubtQuestion(null);
    }
  };

  const progressPercentage = Math.min((currentStep / 6) * 100, 100);

  return (
    <div className="w-full flex justify-center p-4 sm:p-10 pb-52 font-sans relative">
      <div className="max-w-3xl w-full flex flex-col gap-6 relative">
        
        {/* Header & Progress Bar */}
        <div className="bg-gradient-to-r from-[#7D4F39] to-[#643B28] p-8 rounded-2xl text-white shadow-md relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <span className="material-symbols-outlined text-9xl">account_tree</span>
          </div>
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
              <span className="material-symbols-outlined">psychiatry</span>
              Formulation Classifier
            </h1>
            <p className="text-white/90 text-sm sm:text-base max-w-xl leading-relaxed mb-6">
              Discover your IP and Access-and-Benefit-Sharing (ABS) posture instantly based on how your herbal formulation is structured.
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
              <span>{currentNode.type === "result" ? "Classification Ready" : "In Progress"}</span>
            </div>
          </div>
        </div>

        {/* Wizard Container */}
        <div className="bg-white rounded-2xl shadow-lg shadow-black/5 border border-[#E5DCD0] flex flex-col min-h-[400px]">
          
          {/* Top navigation */}
          {currentStep > 1 && (
            <div className="px-6 pt-6 flex justify-between items-center">
              <button onClick={goBack} className="text-[#7D4F39] text-sm font-bold flex items-center gap-1 hover:bg-[#F1EDE6]/50 px-3 py-1.5 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Back
              </button>
              <button onClick={reset} className="text-xs font-bold text-[#8C827A] uppercase tracking-widest hover:text-[#1E1B18] transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">refresh</span> Reset
              </button>
            </div>
          )}

          <div className="p-8 md:p-12 flex-1 flex flex-col">
            {currentNode.type === "question" ? (
              <div className="animate-in slide-in-from-right-8 duration-300">
                <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
                  <h2 className="text-2xl font-bold text-[#1E1B18] leading-snug">
                    {currentNode.text}
                  </h2>
                  <button
                    onClick={() => setDoubtQuestion(currentNode)}
                    className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors text-sm font-bold ${
                      doubtQuestion?.id === currentNode.id 
                        ? "bg-[#7D4F39] text-white border-[#7D4F39]" 
                        : "bg-white text-[#7D4F39] border-[#E5DCD0] hover:bg-[#E5DCD0]/30"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">help</span>
                    <span>Need Help?</span>
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 mt-8">
                  {currentNode.options.map((opt, i) => (
                    <OptionCard 
                      key={i}
                      title={opt.label} 
                      icon={i === 0 ? (currentNode.options.length === 2 ? (opt.label.toLowerCase().includes("yes") ? "check_circle" : "check") : "check") : "cancel"} 
                      selected={false} 
                      onClick={() => handleOptionClick(opt.next)} 
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="animate-in zoom-in-95 duration-500">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-[#1E1B18] flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#7D4F39] text-3xl">verified</span>
                    Classification Result
                  </h2>
                </div>

                <div className="space-y-6">
                  {/* Category Name */}
                  <div className={`p-6 rounded-xl border ${currentNode.color}`}>
                    <h3 className="font-black text-xl mb-2">{currentNode.name}</h3>
                    <p className="text-sm font-medium opacity-90">Based on your answers, this is the regulatory classification for your formulation.</p>
                  </div>

                  {/* Details */}
                  <div className="border border-[#E5DCD0] rounded-xl overflow-hidden">
                    <div className="bg-[#FBF9F5] px-5 py-3 border-b border-[#E5DCD0] font-bold text-[#1E1B18] text-sm flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">gavel</span>
                      Regulatory Strategy & Posture
                    </div>
                    <div className="p-5 bg-white space-y-2">
                      <ResultRow icon="balance" color="text-indigo-600" title="IP Posture" desc={currentNode.ipPosture} />
                      <div className="h-px bg-gray-100 mx-4"></div>
                      <ResultRow icon="shield" color="text-emerald-600" title="Protection Strategy" desc={currentNode.protection} />
                      <div className="h-px bg-gray-100 mx-4"></div>
                      <ResultRow icon="nature" color="text-amber-600" title="ABS Compliance (BDA)" desc={currentNode.abs} />
                    </div>
                  </div>
                </div>

                <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#E5DCD0] pt-6">
                  <button 
                    onClick={reset}
                    className="text-sm font-bold text-[#8C827A] hover:text-[#1E1B18] transition-colors"
                  >
                    Start Over
                  </button>
                  <button 
                    onClick={() => alert("Copied classification report to clipboard!")}
                    className="flex-1 sm:flex-none bg-gradient-to-r from-[#1E1B18] to-[#7D4F39] text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-all text-sm group"
                  >
                    <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">content_copy</span>
                    Copy Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Side Chatbox for Doubts (Floating overlay on large screens, modal on small) */}
      {doubtQuestion && (
        <>
          {/* Mobile backdrop */}
          <div className="fixed inset-0 bg-black/20 z-40 xl:hidden backdrop-blur-sm" onClick={() => setDoubtQuestion(null)} />
          
          <div className="fixed xl:absolute top-1/2 left-1/2 xl:top-0 xl:left-[calc(100%+16px)] -translate-x-1/2 -translate-y-1/2 xl:translate-x-0 xl:translate-y-0 h-[80vh] xl:h-[600px] w-[90vw] sm:w-[400px] xl:w-[320px] bg-[#FFFFFF] border border-[#E5DCD0] rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 xl:slide-in-from-left-4 fade-in duration-300 overflow-hidden z-50">
            <div className="bg-[#FBF9F5] px-4 py-3 border-b border-[#E5DCD0] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#7D4F39]">support_agent</span>
                <h3 className="font-bold text-[#7D4F39] text-sm">Question Assistant</h3>
              </div>
              <button 
                onClick={() => {
                  setDoubtQuestion(null);
                  setChatMessages([]);
                }}
                className="text-[#7D4F39] hover:text-red-700 p-1 rounded-full hover:bg-white transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm bg-white/95 backdrop-blur-sm custom-scrollbar">
              <div className="bg-[#FBF9F5] p-3 rounded-xl border border-[#E5DCD0] text-[#645D56]">
                <p className="font-medium mb-1 text-[10px] uppercase tracking-wider text-[#7D4F39]">Context</p>
                <p className="italic leading-relaxed">"{doubtQuestion.text}"</p>
              </div>
              
              {chatMessages.length === 0 && (
                <div className="text-center text-[#8C827A] text-xs py-4 px-2">
                  Confused by this question? Ask me to explain it or give you an example!
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`p-3 max-w-[85%] rounded-xl ${
                    msg.role === "user" 
                      ? "bg-[#F1EDE6] text-[#1E1B18] rounded-tr-sm" 
                      : "bg-[#FBF9F5] border border-[#E5DCD0] text-[#1E1B18] rounded-tl-sm shadow-sm"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              
              {isChatting && (
                <div className="flex justify-start">
                  <div className="p-3 bg-[#FBF9F5] border border-[#E5DCD0] rounded-xl rounded-tl-sm text-[#8C827A] flex items-center gap-2 shadow-sm">
                    <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 bg-[#FBF9F5] border-t border-[#E5DCD0] shrink-0">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  sendDoubtMessage();
                }}
                className="flex items-center gap-2 bg-white rounded-full px-3 py-1.5 border border-[#E5DCD0] focus-within:border-[#7D4F39] transition-colors shadow-sm"
              >
                <input 
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Ask for clarification..."
                  className="flex-1 text-sm bg-transparent outline-none py-1"
                  disabled={isChatting}
                />
                <button 
                  type="submit"
                  disabled={!chatInput.trim() || isChatting}
                  className="w-7 h-7 rounded-full bg-[#7D4F39] text-white flex items-center justify-center disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
