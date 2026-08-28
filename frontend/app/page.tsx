"use client";

import React, { useState, useRef, useEffect } from "react";
import AuthModal from "../components/AuthModal";
import FeeCalculatorWidget from "../components/FeeCalculatorWidget";
import PatentabilityWizardWidget from "../components/PatentabilityWizardWidget";
import MarkdownRenderer from "../components/MarkdownRenderer";

interface Citation {
  source: string;
  page: number;
  confidence?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  confidence?: string;
  isFaq?: boolean;
}

interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  source: string;
}

interface SavedSession {
  session_id: string;
  id?: string;
  title: string | null;
  message_count?: number;
  created_at: string;
  updated_at: string;
}


const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const QUICK_SUGGESTIONS = [
  "🌿 Can an Ayurvedic formulation be patented in India?",
  "⚖️ What are the patent filing fees for startups with 80% rebate?",
  "📜 What is the Traditional Knowledge Digital Library (TKDL)?",
  "🧪 Explain Section 3(e) synergism requirement for herbal drugs",
  "🌱 When is National Biodiversity Authority (NBA) approval mandatory?",
  "🌐 Official portal link to apply for an Indian patent online",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinkingState, setThinkingState] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => "sess-" + Math.random().toString(36).substring(2, 9));
  const [feedbackGiven, setFeedbackGiven] = useState<{ [msgId: string]: number }>({});

  // Tool dropdown & modals state
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<"calculator" | "wizard" | "faqs" | "history" | null>(null);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [mySessions, setMySessions] = useState<SavedSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Auth & Service state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("ip_shakti_token");
    const userStr = localStorage.getItem("ip_shakti_user");
    if (token) setAuthToken(token);
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch {}
    }

    async function init() {
      try {
        const res = await fetch(`${apiBaseUrl}/health`);
        setServiceOnline(res.ok);
      } catch {
        setServiceOnline(false);
      }

      try {
        const faqRes = await fetch(`${apiBaseUrl}/api/faqs`);
        if (faqRes.ok) {
          const faqData = await faqRes.json();
          setFaqs(faqData.faqs || []);
        }
      } catch {}
    }
    void init();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinkingState]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setIsToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadMySessions() {
    if (!authToken) {
      setIsAuthOpen(true);
      return;
    }
    setLoadingSessions(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/chat/my-sessions`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMySessions(data || []);
      }
    } catch (err) {
      console.error("Failed to load sessions", err);
    } finally {
      setLoadingSessions(false);
    }
  }

  async function resumeSession(pastSessionId: string) {
    setActiveModal(null);
    setThinkingState("Loading previous consultation...");
    try {
      const res = await fetch(`${apiBaseUrl}/api/chat/history/${pastSessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSessionId(pastSessionId);
        const formattedMessages: Message[] = (data.history || []).map((m: any, idx: number) => ({
          id: `hist-${idx}-${Date.now()}`,
          role: m.role,
          content: m.content,
          citations: m.citations,
          confidence: m.confidence,
        }));
        setMessages(formattedMessages);
      }
    } catch (err) {
      console.error("Failed to resume session", err);
    } finally {
      setThinkingState(null);
    }
  }

  async function sendMessage(textToSend?: string) {
    const text = textToSend || input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setIsToolsOpen(false);
    const userMsgId = "user-" + Date.now();
    const assistantMsgId = "asst-" + Date.now();

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: text },
    ]);

    setIsStreaming(true);
    setThinkingState("🌿 Consulting Indian IP statutes, TKDL & Ayush guidelines...");
    let partialText = "";

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${apiBaseUrl}/api/chat/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: text,
          session_id: sessionId,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          const errData = await response.json();
          throw new Error(errData.detail?.message || "Rate limit reached. Please wait.");
        }
        throw new Error("Failed to connect to streaming API.");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream.");

      const decoder = new TextDecoder("utf-8");
      let citations: Citation[] = [];

      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: "assistant", content: "" },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const rawData = line.slice(6).trim();
            if (!rawData) continue;

            try {
              const event = JSON.parse(rawData);
              if (event.type === "thinking") {
                setThinkingState(event.message);
              } else if (event.type === "token") {
                setThinkingState(null);
                partialText += event.token;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: partialText } : m
                  )
                );
              } else if (event.type === "done") {
                citations = event.citations || [];
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: partialText, citations, isFaq: event.from_faq }
                      : m
                  )
                );
              }
            } catch (err) {
              console.error("Stream parse error", err);
            }
          }
        }
      }
    } catch (err: any) {
      if (!partialText || partialText.trim().length === 0) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== assistantMsgId),
          {
            id: "err-" + Date.now(),
            role: "assistant",
            content: `⚠️ ${err.message || "Failed to retrieve answer."}`,
          },
        ]);
      }
    } finally {
      setIsStreaming(false);
      setThinkingState(null);
    }
  }

  async function handleFeedback(messageId: string, rating: number) {
    setFeedbackGiven((prev) => ({ ...prev, [messageId]: rating }));
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

      await fetch(`${apiBaseUrl}/api/feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message_id: 1,
          rating,
          comment: rating === 1 ? "Helpful" : "Needs improvement",
        }),
      });
    } catch {}
  }

  function handleExportPDF(exportSessId?: string) {
    const target = exportSessId || sessionId;
    window.open(`${apiBaseUrl}/api/chat/export/${target}`, "_blank");
  }

  function handleResetChat() {
    setSessionId("sess-" + Math.random().toString(36).substring(2, 9));
    setMessages([]);
  }

  function handleLogout() {
    localStorage.removeItem("ip_shakti_token");
    localStorage.removeItem("ip_shakti_user");
    setAuthToken(null);
    setCurrentUser(null);
    setMySessions([]);
  }

  const isChatEmpty = messages.length === 0;

  return (
    <main className="flex min-h-screen flex-col bg-[#F7F3E8] text-[#182C22] font-sans antialiased">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-6 py-3.5 border-b border-[#E5DCBF] bg-[#FFFEFA]/95 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#285943] to-[#1E4433] text-white font-bold text-sm shadow-sm">
            🌿
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-[#285943] text-base">
                IP-SAKTI
              </span>
              <span className="rounded-full bg-[#FAF4E4] border border-[#E8D2A3] px-2 py-0.5 text-[10px] font-bold text-[#C59A3D]">
                Legal AI
              </span>
            </div>
            <span className="text-[11px] font-medium text-[#7A5135]">
              Ancient Knowledge → Modern Intelligence
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[#56685E]">
            <span
              className={`size-2 rounded-full ${
                serviceOnline === true
                  ? "bg-[#285943]"
                  : serviceOnline === false
                    ? "bg-red-500"
                    : "bg-[#C59A3D]"
              }`}
            />
            <span className="hidden sm:inline font-medium">
              {serviceOnline ? "Database Online" : "Connecting"}
            </span>
          </div>

          {currentUser ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  void loadMySessions();
                  setActiveModal("history");
                }}
                className="flex items-center gap-1.5 rounded-full bg-[#E9F1E8] border border-[#C8DAC5] px-3.5 py-1.5 text-xs font-semibold text-[#285943] hover:bg-[#D9E5D7] transition cursor-pointer"
                title="View Saved Consultations"
              >
                <span>🕒 History</span>
                <span className="opacity-60">·</span>
                <span className="font-bold">{currentUser.email.split("@")[0]}</span>
              </button>
              <button
                onClick={handleLogout}
                className="text-xs font-semibold text-[#7A5135] hover:text-red-700 hover:underline cursor-pointer"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="rounded-xl bg-[#285943] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#1E4433] cursor-pointer"
            >
              Sign In / History
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 flex-col items-center justify-between p-4 sm:p-6 max-w-4xl mx-auto w-full">
        {/* CENTER HERO (When chat is empty) */}
        {isChatEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center my-auto py-12 max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#E9F1E8] border border-[#C8DAC5] px-3.5 py-1 text-xs font-bold text-[#285943]">
              <span>🏛️</span>
              <span>Indian Patent, Trademark &amp; TKDL Legal Advisory</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-[#285943]">
              How may I guide your invention today?
            </h1>

            <p className="mt-3.5 text-sm sm:text-base text-[#7A5135] font-medium leading-relaxed">
              Explore patent eligibility under Section 3, verify TKDL prior art, compute 80% statutory rebates, or assess NBA approvals with authoritative citations.
            </p>
          </div>
        ) : (
          /* CONVERSATION STREAM VIEW */
          <div className="flex-1 w-full space-y-4 overflow-y-auto py-4">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E5DCBF] text-xs text-[#7A5135]">
              <span className="font-semibold">Consultation Reference: {sessionId}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExportPDF()}
                  className="rounded-lg bg-[#FFFEFA] border border-[#E5DCBF] px-3 py-1 text-[#285943] font-semibold hover:bg-[#FAF6ED] shadow-2xs cursor-pointer"
                >
                  📄 Export PDF
                </button>
                <button
                  onClick={handleResetChat}
                  className="rounded-lg bg-[#FFFEFA] border border-[#E5DCBF] px-3 py-1 text-[#7A5135] font-semibold hover:bg-[#FAF6ED] shadow-2xs cursor-pointer"
                >
                  🔄 New Consultation
                </button>
              </div>
            </div>

            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[82%] rounded-2xl px-5 py-3.5 text-sm shadow-xs ${
                      isUser
                        ? "bg-[#285943] text-white rounded-br-xs font-medium"
                        : "bg-[#FFFEFA] text-[#182C22] rounded-bl-xs border border-[#E5DCBF]"
                    }`}
                  >
                    <MarkdownRenderer content={msg.content} isUser={isUser} />

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3.5 border-t border-[#E5DCBF] pt-2.5 text-xs">
                        <div className="flex items-center gap-1 font-bold text-[#285943]">
                          <span>📚</span>
                          <span>Official Statutory Citations:</span>
                        </div>
                        <ul className="mt-1.5 list-inside list-disc space-y-1 text-[11px] text-[#56685E]">
                          {msg.citations.map((c, i) => (
                            <li key={i}>
                              <span className="font-medium text-[#182C22]">{c.source}</span> (Page {c.page})
                              {c.confidence && (
                                <span className="ml-1.5 rounded-sm bg-[#FAF4E4] border border-[#E8D2A3] px-1.5 py-0.2 text-[10px] font-bold text-[#C59A3D]">
                                  {c.confidence}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {!isUser && msg.content && (
                    <div className="mt-1.5 flex items-center gap-2 px-1 text-xs text-[#7A5135]">
                      <span>Was this statutory guidance accurate?</span>
                      <button
                        onClick={() => handleFeedback(msg.id, 1)}
                        className={`hover:text-[#285943] transition cursor-pointer ${
                          feedbackGiven[msg.id] === 1 ? "text-[#285943] font-bold" : ""
                        }`}
                      >
                        👍
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, -1)}
                        className={`hover:text-red-700 transition cursor-pointer ${
                          feedbackGiven[msg.id] === -1 ? "text-red-700 font-bold" : ""
                        }`}
                      >
                        👎
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {thinkingState && (
              <div className="flex items-center gap-2 rounded-xl bg-[#FAF4E4] border border-[#E8D2A3] px-4 py-2.5 text-xs text-[#7A5135] font-semibold animate-pulse">
                <span className="animate-spin text-[#C59A3D]">⚙️</span>
                <span>{thinkingState}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* BOTTOM PROMPT BAR & TOOLS (Gemini Style on Warm Ivory) */}
        <div className="w-full space-y-3 pt-2">
          {/* Centered Gemini Prompt Bar */}
          <div className="relative w-full rounded-2xl border border-[#E5DCBF] bg-[#FFFEFA] shadow-md focus-within:border-[#285943] focus-within:ring-2 focus-within:ring-[#285943]/20 transition">
            {/* FLOATING TOOLS MENU (IP-SAKTI Palette) */}
            {isToolsOpen && (
              <div
                ref={toolsMenuRef}
                className="absolute bottom-full left-3 mb-2 w-72 rounded-2xl border border-[#E5DCBF] bg-[#FFFEFA] p-2.5 shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2"
              >
                <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#7A5135]">
                  Statutory Actions &amp; Tools
                </div>

                <button
                  onClick={() => {
                    setActiveModal("calculator");
                    setIsToolsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#182C22] transition hover:bg-[#E9F1E8] hover:text-[#285943] cursor-pointer"
                >
                  <span className="text-xl">🧮</span>
                  <div className="text-left">
                    <div className="font-bold text-[#285943]">Fee Calculator</div>
                    <div className="text-[11px] text-[#7A5135]">Patent / TM fees with 80% subsidy</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveModal("wizard");
                    setIsToolsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#182C22] transition hover:bg-[#E9F1E8] hover:text-[#285943] cursor-pointer"
                >
                  <span className="text-xl">🔍</span>
                  <div className="text-left">
                    <div className="font-bold text-[#285943]">"Am I Patentable?"</div>
                    <div className="text-[11px] text-[#7A5135]">Section 3 &amp; NBA risk assessment</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveModal("faqs");
                    setIsToolsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#182C22] transition hover:bg-[#E9F1E8] hover:text-[#285943] cursor-pointer"
                >
                  <span className="text-xl">📚</span>
                  <div className="text-left">
                    <div className="font-bold text-[#285943]">Statutory FAQs (25)</div>
                    <div className="text-[11px] text-[#7A5135]">Instant verified legal answers</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    void loadMySessions();
                    setActiveModal("history");
                    setIsToolsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#182C22] transition hover:bg-[#E9F1E8] hover:text-[#285943] cursor-pointer"
                >
                  <span className="text-xl">🕒</span>
                  <div className="text-left">
                    <div className="font-bold text-[#285943]">Past Consultations</div>
                    <div className="text-[11px] text-[#7A5135]">Resume previous sessions &amp; records</div>
                  </div>
                </button>

                <div className="my-1.5 border-t border-[#E5DCBF]" />

                <button
                  onClick={() => {
                    handleExportPDF();
                    setIsToolsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-[#285943] transition hover:bg-[#FAF6ED] cursor-pointer"
                >
                  <span>📄</span>
                  <span>Export Consultation (PDF)</span>
                </button>

                <button
                  onClick={() => {
                    handleResetChat();
                    setIsToolsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-[#7A5135] transition hover:bg-[#FAF6ED] cursor-pointer"
                >
                  <span>🔄</span>
                  <span>New Consultation</span>
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage();
              }}
              className="flex items-center px-4 py-3 gap-2.5"
            >
              {/* + Tools Menu Trigger */}
              <button
                type="button"
                onClick={() => setIsToolsOpen(!isToolsOpen)}
                className={`grid size-9 place-items-center rounded-xl transition cursor-pointer font-bold ${
                  isToolsOpen
                    ? "bg-[#285943] text-white"
                    : "bg-[#E9F1E8] text-[#285943] hover:bg-[#D9E5D7]"
                }`}
                title="Open Statutory Tools & Wizards"
              >
                <span className="text-lg leading-none">{isToolsOpen ? "✕" : "＋"}</span>
              </button>

              {/* Chat Input */}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask in English, Hindi (उदा. हळद व दुधाचे पेटेंट?), or Marathi..."
                disabled={isStreaming}
                className="flex-1 bg-transparent text-sm text-[#182C22] placeholder-[#7E9086] outline-none font-medium"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                className="rounded-xl bg-[#285943] p-2.5 text-white transition hover:bg-[#1E4433] disabled:opacity-40 shadow-xs cursor-pointer"
              >
                <svg
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </button>
            </form>
          </div>

          {/* Quick FAQ / Suggestion Pills (Sage & Ivory) */}
          {isChatEmpty && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {QUICK_SUGGESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(q)}
                  className="rounded-full border border-[#E5DCBF] bg-[#FFFEFA] px-3.5 py-1.5 text-xs font-semibold text-[#285943] transition hover:border-[#8FAF8B] hover:bg-[#E9F1E8] shadow-2xs cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODALS FOR TOOLS */}
      {/* 1. Fee Calculator */}
      {activeModal === "calculator" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#FFFEFA] p-2 text-[#182C22] shadow-2xl border border-[#E5DCBF]">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-[#FAF6ED] p-2 text-[#7A5135] hover:bg-[#E5DCBF] transition cursor-pointer"
            >
              ✕
            </button>
            <FeeCalculatorWidget />
          </div>
        </div>
      )}

      {/* 2. Patentability Wizard */}
      {activeModal === "wizard" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#FFFEFA] p-2 text-[#182C22] shadow-2xl border border-[#E5DCBF]">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-[#FAF6ED] p-2 text-[#7A5135] hover:bg-[#E5DCBF] transition cursor-pointer"
            >
              ✕
            </button>
            <PatentabilityWizardWidget />
          </div>
        </div>
      )}

      {/* 3. Statutory FAQs */}
      {activeModal === "faqs" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-3xl bg-[#FFFEFA] p-6 text-[#182C22] shadow-2xl border border-[#E5DCBF]">
            <div className="flex items-center justify-between border-b border-[#E5DCBF] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📚</span>
                <h2 className="text-xl font-extrabold text-[#285943]">25 Statutory FAQs</h2>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-full bg-[#FAF6ED] p-2 text-[#7A5135] hover:bg-[#E5DCBF] transition cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {faqs.map((f) => (
                <div
                  key={f.id}
                  onClick={() => {
                    setActiveModal(null);
                    sendMessage(f.question);
                  }}
                  className="cursor-pointer rounded-2xl border border-[#E5DCBF] bg-[#FAF6ED] p-4 transition hover:border-[#8FAF8B] hover:bg-[#E9F1E8]"
                >
                  <span className="text-xs font-bold uppercase text-[#7A5135]">{f.category}</span>
                  <h4 className="mt-1 font-bold text-[#285943]">{f.question}</h4>
                  <p className="mt-2 line-clamp-2 text-xs text-[#56685E]">{f.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Past Consultations / History Modal */}
      {activeModal === "history" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl bg-[#FFFEFA] p-6 text-[#182C22] shadow-2xl border border-[#E5DCBF]">
            <div className="flex items-center justify-between border-b border-[#E5DCBF] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🕒</span>
                <div>
                  <h2 className="text-xl font-extrabold text-[#285943]">Past Consultations</h2>
                  <p className="text-xs text-[#7A5135]">Saved legal advisory records for {currentUser?.email}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-full bg-[#FAF6ED] p-2 text-[#7A5135] hover:bg-[#E5DCBF] transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {loadingSessions ? (
              <div className="py-12 text-center text-sm font-medium text-[#7A5135] animate-pulse">
                🌿 Loading your saved consultation records...
              </div>
            ) : mySessions.length === 0 ? (
              <div className="py-12 text-center text-[#56685E]">
                <div className="text-3xl mb-2">📜</div>
                <div className="font-semibold text-base text-[#182C22]">No consultation records found yet</div>
                <div className="text-xs mt-1 text-[#7A5135]">
                  Start asking questions in the assistant and your full multi-turn conversations will be saved here automatically!
                </div>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-[#E5DCBF] rounded-2xl border border-[#E5DCBF] bg-[#FAF6ED]/60">
                {mySessions.map((s) => {
                  const sId = s.session_id || s.id || "";
                  return (
                    <div key={sId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#E9F1E8]/50 transition">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#285943] text-sm">
                            {s.title || `Consultation #${sId.substring(5, 11)}`}
                          </span>
                          {s.message_count !== undefined && (
                            <span className="rounded-full bg-[#E9F1E8] border border-[#C8DAC5] px-2 py-0.5 text-[10px] font-bold text-[#285943]">
                              {s.message_count} messages
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#7A5135]">
                          Session ID: <code className="font-mono bg-[#FFFEFA] px-1 rounded border border-[#E5DCBF]">{sId}</code> · Updated: {new Date(s.updated_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => resumeSession(sId)}
                          className="rounded-xl bg-[#285943] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#1E4433] transition cursor-pointer"
                        >
                          💬 Resume
                        </button>
                        <button
                          onClick={() => handleExportPDF(sId)}
                          className="rounded-xl bg-[#FFFEFA] border border-[#E5DCBF] px-3 py-1.5 text-xs font-bold text-[#7A5135] hover:bg-[#FAF6ED] transition cursor-pointer"
                          title="Download Advisory PDF"
                        >
                          📄 PDF
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

            )}
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(token, user) => {
          setAuthToken(token);
          setCurrentUser(user);
        }}
      />
    </main>
  );
}
