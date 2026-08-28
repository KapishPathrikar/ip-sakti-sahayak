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

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const QUICK_SUGGESTIONS = [
  "Can an Ayurvedic formulation be patented in India?",
  "What are the official patent filing fees for startups?",
  "What is the Traditional Knowledge Digital Library (TKDL)?",
  "Explain Section 3(e) synergism requirement for drugs",
  "When is National Biodiversity Authority (NBA) approval mandatory?",
  "What is the official website link to apply for an Indian patent online?",
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
  const [activeModal, setActiveModal] = useState<"calculator" | "wizard" | "faqs" | null>(null);
  const [faqs, setFaqs] = useState<FAQ[]>([]);

  // Auth & Service state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check saved token
    const token = localStorage.getItem("ip_shakti_token");
    const userStr = localStorage.getItem("ip_shakti_user");
    if (token) setAuthToken(token);
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch {}
    }

    // Health check & load FAQs
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

  // Close tools dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setIsToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    setThinkingState("🧠 Analyzing Indian IP statutes & legal corpus...");
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
          throw new Error(errData.detail?.message || "Rate limit exceeded.");
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

  function handleExportPDF() {
    window.open(`${apiBaseUrl}/api/chat/export/${sessionId}`, "_blank");
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
  }

  const isChatEmpty = messages.length === 0;

  return (
    <main className="flex min-h-screen flex-col bg-[#0e1217] text-slate-100 font-sans">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131922]/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-black text-white shadow-md">
            IP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white">IP Shakti Sahayak</span>
              <span className="rounded bg-blue-900/60 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
                AI 2.0
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              India-First Legal Intelligence &amp; TKDL Assistant
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span
              className={`size-2 rounded-full ${
                serviceOnline === true
                  ? "bg-emerald-400"
                  : serviceOnline === false
                    ? "bg-red-400"
                    : "bg-amber-400"
              }`}
            />
            <span className="hidden sm:inline">
              {serviceOnline ? "Online" : "Connecting"}
            </span>
          </div>

          {currentUser ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300 border border-slate-700">
                👤 {currentUser.email}
              </span>
              <button
                onClick={handleLogout}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 flex-col items-center justify-between p-4 sm:p-6 max-w-4xl mx-auto w-full">
        {/* CENTER HERO (When chat is empty, Gemini Style) */}
        {isChatEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center my-auto py-10">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-amber-300 bg-clip-text text-transparent">
              Hello, how can I assist your IP today?
            </h1>
            <p className="mt-3 max-w-lg text-sm text-slate-400">
              Ask about Indian patent prosecution, trademark filing, traditional Ayurvedic formulations, or verify fees with citations.
            </p>
          </div>
        ) : (
          /* CONVERSATION STREAM VIEW */
          <div className="flex-1 w-full space-y-4 overflow-y-auto py-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs text-slate-400">
              <span>Consultation ID: {sessionId}</span>
              <div className="flex gap-2">
                <button
                  onClick={handleExportPDF}
                  className="rounded bg-slate-800 px-2.5 py-1 text-slate-300 hover:bg-slate-700"
                >
                  📄 Export PDF
                </button>
                <button
                  onClick={handleResetChat}
                  className="rounded bg-slate-800 px-2.5 py-1 text-slate-300 hover:bg-slate-700"
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
                    className={`max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : "bg-[#1a2230] text-slate-200 rounded-bl-sm border border-slate-800"
                    }`}
                  >
                    <MarkdownRenderer content={msg.content} isUser={isUser} />


                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 border-t border-slate-700/60 pt-2 text-xs text-emerald-400">
                        <span className="font-semibold">Statutory Citations:</span>
                        <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px] text-emerald-300/80">
                          {msg.citations.map((c, i) => (
                            <li key={i}>
                              {c.source} (Page {c.page})
                              {c.confidence ? ` · ${c.confidence}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {!isUser && msg.content && (
                    <div className="mt-1 flex items-center gap-2 px-1 text-xs text-slate-500">
                      <span>Helpful?</span>
                      <button
                        onClick={() => handleFeedback(msg.id, 1)}
                        className={`hover:text-emerald-400 ${
                          feedbackGiven[msg.id] === 1 ? "text-emerald-400 font-bold" : ""
                        }`}
                      >
                        👍
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, -1)}
                        className={`hover:text-red-400 ${
                          feedbackGiven[msg.id] === -1 ? "text-red-400 font-bold" : ""
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
              <div className="flex items-center gap-2 rounded-xl bg-blue-950/40 border border-blue-800/50 px-4 py-2.5 text-xs text-blue-300 animate-pulse">
                <span className="animate-spin">⚙️</span>
                <span>{thinkingState}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* BOTTOM PROMPT BAR & TOOLS (Gemini Style) */}
        <div className="w-full space-y-3 pt-2">
          {/* Centered Gemini Prompt Bar */}
          <div className="relative w-full rounded-2xl border border-slate-700 bg-[#161d27] shadow-2xl focus-within:border-blue-500 transition">
            {/* FLOATING TOOLS MENU (Just like the Gemini Screenshot) */}
            {isToolsOpen && (
              <div
                ref={toolsMenuRef}
                className="absolute bottom-full left-3 mb-2 w-64 rounded-2xl border border-slate-700 bg-[#1a2332] p-2 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-bottom-2"
              >
                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Legal Tools &amp; Actions
                </div>

                <button
                  onClick={() => {
                    setActiveModal("calculator");
                    setIsToolsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200 transition hover:bg-blue-600/20 hover:text-blue-300"
                >
                  <span className="text-lg">🧮</span>
                  <div className="text-left">
                    <div className="font-semibold">Fee Calculator</div>
                    <div className="text-[11px] text-slate-400">Compute patent/TM fees (80% rebate)</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveModal("wizard");
                    setIsToolsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200 transition hover:bg-blue-600/20 hover:text-blue-300"
                >
                  <span className="text-lg">🔍</span>
                  <div className="text-left">
                    <div className="font-semibold">"Am I Patentable?"</div>
                    <div className="text-[11px] text-slate-400">Section 3 &amp; NBA risk assessment</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveModal("faqs");
                    setIsToolsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200 transition hover:bg-blue-600/20 hover:text-blue-300"
                >
                  <span className="text-lg">📚</span>
                  <div className="text-left">
                    <div className="font-semibold">Statutory FAQs (25)</div>
                    <div className="text-[11px] text-slate-400">Browse verified legal Q&amp;A</div>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-700/80" />

                <button
                  onClick={() => {
                    handleExportPDF();
                    setIsToolsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-slate-300 transition hover:bg-slate-700/50"
                >
                  <span>📄</span>
                  <span>Export Consultation (PDF)</span>
                </button>

                <button
                  onClick={() => {
                    handleResetChat();
                    setIsToolsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-slate-300 transition hover:bg-slate-700/50"
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
              className="flex items-center px-4 py-3 gap-2"
            >
              {/* + Tools Menu Trigger (Exact match with Gemini screenshot) */}
              <button
                type="button"
                onClick={() => setIsToolsOpen(!isToolsOpen)}
                className={`grid size-9 place-items-center rounded-xl transition ${
                  isToolsOpen
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
                title="Open IP Tools & Wizards"
              >
                <span className="text-lg leading-none">{isToolsOpen ? "✕" : "＋"}</span>
              </button>

              {/* Chat Input */}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about Indian patents, trademarks, TKDL in English, Hindi, or Marathi..."
                disabled={isStreaming}
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                className="rounded-xl bg-blue-600 p-2 text-white transition hover:bg-blue-500 disabled:opacity-40"
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
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </button>
            </form>
          </div>

          {/* Quick FAQ / Suggestion Pills Below Chat Bar */}
          {isChatEmpty && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {QUICK_SUGGESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(q)}
                  className="rounded-full border border-slate-800 bg-[#161d27]/70 px-3.5 py-1.5 text-xs text-slate-400 transition hover:border-slate-600 hover:bg-slate-800 hover:text-slate-200"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODALS FOR TOOLS (Fee Calculator, Wizard, FAQs) */}
      {activeModal === "calculator" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-2 text-slate-900 shadow-2xl">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
            >
              ✕
            </button>
            <FeeCalculatorWidget />
          </div>
        </div>
      )}

      {activeModal === "wizard" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-2 text-slate-900 shadow-2xl">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
            >
              ✕
            </button>
            <PatentabilityWizardWidget />
          </div>
        </div>
      )}

      {activeModal === "faqs" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-xl font-bold">25 Statutory FAQs</h2>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
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
                  className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-500 hover:bg-blue-50/40"
                >
                  <span className="text-xs font-bold uppercase text-blue-700">{f.category}</span>
                  <h4 className="mt-1 font-semibold text-slate-900">{f.question}</h4>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-600">{f.answer}</p>
                </div>
              ))}
            </div>
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
