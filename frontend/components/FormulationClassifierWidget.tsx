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
  const [doubtQuestion, setDoubtQuestion] = useState<QuestionNode | null>(null);
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatting]);

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
            } catch (e) {
              // Ignore parse errors on partial chunks
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
      setChatMessages(prev => {
        const updated = [...prev];
        if (updated[updated.length - 1].role === "assistant" && !updated[updated.length - 1].content) {
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
    setDoubtQuestion(null); // Close chat if moving forward
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

  const classifierContent = (
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
                  <div className="flex-1">
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
                  {/* Doubt Button */}
                  {isCurrent && (
                    <button
                      onClick={() => setDoubtQuestion(node)}
                      className={`shrink-0 p-2 rounded-full border transition-colors ${
                        doubtQuestion?.id === node.id 
                          ? "bg-[#285943] text-white border-[#285943]" 
                          : "bg-white text-[#7A5135] border-[#E5DCBF] hover:bg-[#E5DCBF]/30"
                      }`}
                      title="Need help understanding this?"
                    >
                      <span className="material-symbols-outlined text-lg">help</span>
                    </button>
                  )}
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

  return (
    <div className="h-full w-full relative">
      {/* Main Classifier (Always Full Width) */}
      <div className="h-full w-full">
        {classifierContent}
      </div>

      {/* Side Chatbox for Doubts (Floating outside on the right) */}
      {doubtQuestion && (
        <div className="absolute top-0 left-[calc(100%+16px)] h-full w-[300px] bg-[#FFFEFA] border border-[#E5DCBF] rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-left-4 fade-in duration-300 overflow-hidden z-20">
          <div className="bg-[#FAF6ED] px-4 py-3 border-b border-[#E5DCBF] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#7A5135]">support_agent</span>
              <h3 className="font-bold text-[#7A5135] text-sm">Question Assistant</h3>
            </div>
            <button 
              onClick={() => {
                setDoubtQuestion(null);
                setChatMessages([]); // Clear chat when closing
              }}
              className="text-[#7A5135] hover:text-red-700 p-1 rounded-full hover:bg-white transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm bg-white/95 backdrop-blur-sm custom-scrollbar">
            <div className="bg-[#FAFAF5] p-3 rounded-xl border border-[#E5DCBF] text-[#414942]">
              <p className="font-medium mb-1 text-xs uppercase tracking-wider text-[#7A5135]">Context</p>
              <p className="italic">"{doubtQuestion.text}"</p>
            </div>
            
            {chatMessages.length === 0 && (
              <div className="text-center text-[#727971] text-xs py-4">
                Confused by this question? Ask me to explain it or give you an example!
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-3 max-w-[85%] rounded-xl ${
                  msg.role === 'user' 
                    ? 'bg-[#DAEDDC] text-[#1B2B20] rounded-tr-sm' 
                    : 'bg-[#FAFAF5] border border-[#E5DCBF] text-[#1B2B20] rounded-tl-sm shadow-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            
            {isChatting && (
              <div className="flex justify-start">
                <div className="p-3 bg-[#FAFAF5] border border-[#E5DCBF] rounded-xl rounded-tl-sm text-[#727971] flex items-center gap-2 shadow-sm">
                  <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  Thinking...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 bg-[#FAF6ED] border-t border-[#E5DCBF] shrink-0">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                sendDoubtMessage();
              }}
              className="flex items-center gap-2 bg-white rounded-full px-3 py-1.5 border border-[#E5DCBF] focus-within:border-[#285943] transition-colors shadow-sm"
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
                className="w-7 h-7 rounded-full bg-[#285943] text-white flex items-center justify-center disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
