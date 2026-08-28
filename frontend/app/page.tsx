"use client";

import React, { useState, useRef, useEffect } from "react";
import AuthModal from "../components/AuthModal";
import FeeCalculatorView from "../components/FeeCalculatorView";
import LegalResearchView from "../components/LegalResearchView";
import AccountSettingsView from "../components/AccountSettingsView";
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

interface SavedSession {
  session_id: string;
  id?: string;
  title: string | null;
  message_count?: number;
  created_at: string;
  updated_at: string;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function formatTimestamp(isoString?: string): string {
  if (!isoString) return "";
  try {
    let raw = isoString.trim();
    if (!raw.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(raw) && !/[+-]\d{4}$/.test(raw)) {
      raw += "Z";
    }
    const d = new Date(raw);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

const QUICK_SUGGESTIONS = [
  {
    title: "Can Haldi & Milk be patented?",
    desc: "Traditional Knowledge Check",
    icon: "🌿",
    query: "Can an Ayurvedic formulation combining turmeric (haldi) and milk (dudh) be patented in India?",
  },
  {
    title: "80% Startup Fee Rebates",
    desc: "Fee Calculation Guide",
    icon: "🧮",
    query: "What are the official patent filing fees in India for DPIIT recognized startups with 80% rebate?",
  },
  {
    title: "Section 3(p) TKDL Exclusions",
    desc: "Statutory Analysis",
    icon: "📜",
    query: "What are the patent exclusions for traditional medicine under Section 3(p) and TKDL guidelines?",
  },
];

export default function Home() {
  const [currentView, setCurrentView] = useState<"chat" | "history" | "research" | "settings" | "tools">("chat");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinkingState, setThinkingState] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>("sess-new");
  const [feedbackGiven, setFeedbackGiven] = useState<{ [msgId: string]: number }>({});

  // Saved sessions state
  const [mySessions, setMySessions] = useState<SavedSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Auth & Service state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId("sess-" + Math.random().toString(36).substring(2, 9));

    const token = localStorage.getItem("ip_shakti_token");
    const userStr = localStorage.getItem("ip_shakti_user");
    if (token) setAuthToken(token);
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (authToken) {
      void loadMySessions();
    }
  }, [authToken, sessionId]);

  useEffect(() => {
    if (currentView === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, thinkingState, currentView]);

  async function loadMySessions() {
    if (!authToken) return;
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
    setCurrentView("chat");
    setThinkingState("Loading consultation record...");
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

    setCurrentView("chat");
    setInput("");
    const userMsgId = "user-" + Date.now();
    const assistantMsgId = "asst-" + Date.now();

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: text },
    ]);

    setIsStreaming(true);
    setThinkingState("Analyzing Indian Patents Act 1970 & TKDL...");
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
      void loadMySessions();
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
    setCurrentView("chat");
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
    <div className="bg-[#FAFAF5] text-[#1B2B20] font-sans h-screen overflow-hidden flex flex-col md:flex-row">
      {/* ── Top Navigation (Mobile Only) ────────────────────────────── */}
      <header className="md:hidden flex justify-between items-center w-full px-4 py-3 sticky top-0 z-40 bg-[#FFFDE7]/80 backdrop-blur-md border-b border-[#E6E5DD]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentView(currentView === "chat" ? "history" : "chat")}
            className="text-[#638C6D] p-1"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-lg text-[#638C6D]">IP-SAKTI</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleResetChat}
            className="p-1.5 rounded-full bg-[#638C6D] text-white text-xs font-bold"
            title="New Chat"
          >
            ＋
          </button>
          <div
            onClick={() => (currentUser ? setCurrentView("settings") : setIsAuthOpen(true))}
            className="w-8 h-8 rounded-full overflow-hidden border border-[#c1c8c0] cursor-pointer bg-[#E5F9E7]"
          >
            <img
              alt="User Avatar"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD9lk-V00H9o6k4G8IJexs3h2HKtANXj1QbDFLg7zaEe9wqSfHBzzjJH-LK4bW7AifHooA2M-6Qs-2kcjNwn6yZ9kGlEi7bCY8HZ7wybNCyD1uRoHdhDFADexqiPgjD1q3YVMytPsH4R24-PNkIXM0imI3dbAfyg7wK3pnsUqz0bCsrNDBfyExM3yORSpI2EytQW0a8LVx4PohstAs0IiiEAGZJb6XhOEzOawe5jS7qjW8SoulSf-nfxA"
            />
          </div>
        </div>
      </header>

      {/* ── Sidebar (Desktop) ─────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col h-screen p-6 w-[280px] fixed left-0 top-0 border-r border-[#daeddc] z-30 transition-all duration-300 select-none"
        style={{ backgroundColor: "rgb(255, 253, 231)" }}
      >
        {/* Brand */}
        <div
          onClick={handleResetChat}
          className="flex items-center gap-3 mb-8 px-2 cursor-pointer"
        >
          <img
            alt="IP-SAKTI Logo"
            className="w-10 h-10 object-contain rounded-lg shadow-2xs"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuD9lk-V00H9o6k4G8IJexs3h2HKtANXj1QbDFLg7zaEe9wqSfHBzzjJH-LK4bW7AifHooA2M-6Qs-2kcjNwn6yZ9kGlEi7bCY8HZ7wybNCyD1uRoHdhDFADexqiPgjD1q3YVMytPsH4R24-PNkIXM0imI3dbAfyg7wK3pnsUqz0bCsrNDBfyExM3yORSpI2EytQW0a8LVx4PohstAs0IiiEAGZJb6XhOEzOawe5jS7qjW8SoulSf-nfxA"
          />
          <div>
            <h1 className="text-[24px] font-bold leading-tight text-[#638C6D]">IP-SAKTI</h1>
            <p className="text-[12px] font-semibold text-[#414942] opacity-70 uppercase tracking-wider">AI Legal Suite</p>
          </div>
        </div>

        {/* CTA: New Chat */}
        <button
          onClick={handleResetChat}
          className="w-full mb-6 bg-[#638C6D] hover:bg-[#557e60] text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
        >
          <span className="text-lg leading-none font-bold">＋</span>
          <span>New Chat</span>
        </button>

        {/* Navigation Tabs */}
        <nav className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-1">
          <div className="px-3 py-1 text-[#414942] text-[11px] font-bold uppercase tracking-wider mb-1">
            Navigation
          </div>

          <button
            onClick={() => setCurrentView("chat")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-200 cursor-pointer ${
              currentView === "chat"
                ? "bg-[#E7FBB4] text-[#5a6a32] border-l-4 border-[#638C6D] font-bold"
                : "text-[#414942] hover:bg-[#daeddc]/60"
            }`}
          >
            <span className="text-base">💬</span>
            <span className="text-sm font-medium truncate">New Chat</span>
          </button>

          <button
            onClick={() => setCurrentView("history")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-200 cursor-pointer ${
              currentView === "history"
                ? "bg-[#E7FBB4] text-[#5a6a32] border-l-4 border-[#638C6D] font-bold"
                : "text-[#414942] hover:bg-[#daeddc]/60"
            }`}
          >
            <span className="text-base">🕒</span>
            <span className="text-sm font-medium truncate">Recent Inquiries</span>
          </button>

          <button
            onClick={() => setCurrentView("research")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-200 cursor-pointer ${
              currentView === "research"
                ? "bg-[#E7FBB4] text-[#5a6a32] border-l-4 border-[#638C6D] font-bold"
                : "text-[#414942] hover:bg-[#daeddc]/60"
            }`}
          >
            <span className="text-base">📖</span>
            <span className="text-sm font-medium truncate">Legal Research</span>
          </button>

          <button
            onClick={() => setCurrentView("tools")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-200 cursor-pointer ${
              currentView === "tools"
                ? "bg-[#E7FBB4] text-[#5a6a32] border-l-4 border-[#638C6D] font-bold"
                : "text-[#414942] hover:bg-[#daeddc]/60"
            }`}
          >
            <span className="text-base">🧮</span>
            <span className="text-sm font-medium truncate">IP Tools &amp; Calculator</span>
          </button>

          {/* Search History */}
          <div className="mt-4 px-1">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#727971] text-xs">🔍</span>
              <input
                className="w-full bg-[#e5f9e7] border border-transparent focus:border-[#638C6D] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#1B2B20] outline-none transition-colors placeholder:text-[#414942]/60"
                placeholder="Search history..."
                type="text"
                onChange={(e) => {
                  const q = e.target.value.toLowerCase();
                  if (!q) {
                    void loadMySessions();
                  } else {
                    setMySessions((prev) =>
                      prev.filter((s) => (s.title || "").toLowerCase().includes(q))
                    );
                  }
                }}
              />
            </div>
          </div>

          {/* Grouped Recent Sessions */}
          {mySessions.length > 0 && (
            <div className="mt-4 space-y-1">
              <div className="px-3 py-1 text-[#414942] text-[10px] font-bold uppercase tracking-wider">
                Recent Chats
              </div>
              {mySessions.slice(0, 5).map((s) => {
                const sId = s.session_id || s.id || "";
                return (
                  <button
                    key={sId}
                    onClick={() => resumeSession(sId)}
                    className="w-full text-left px-3 py-1.5 text-xs text-[#414942] hover:bg-[#daeddc]/60 rounded-lg truncate transition-colors block cursor-pointer"
                  >
                    {s.title || `Consultation #${sId.slice(-4)}`}
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        {/* Footer Profile */}
        <div className="mt-auto pt-4 border-t border-[#daeddc]">
          <div
            onClick={() => (currentUser ? setCurrentView("settings") : setIsAuthOpen(true))}
            className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#daeddc]/60 transition-colors cursor-pointer"
          >
            <img
              alt="User Profile"
              className="w-8 h-8 rounded-full bg-[#d4e7d6] object-cover border border-[#c1c8c0]"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD9lk-V00H9o6k4G8IJexs3h2HKtANXj1QbDFLg7zaEe9wqSfHBzzjJH-LK4bW7AifHooA2M-6Qs-2kcjNwn6yZ9kGlEi7bCY8HZ7wybNCyD1uRoHdhDFADexqiPgjD1q3YVMytPsH4R24-PNkIXM0imI3dbAfyg7wK3pnsUqz0bCsrNDBfyExM3yORSpI2EytQW0a8LVx4PohstAs0IiiEAGZJb6XhOEzOawe5jS7qjW8SoulSf-nfxA"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#1B2B20] truncate">
                {currentUser?.full_name || (currentUser?.email ? currentUser.email.split("@")[0] : "Dr. Aditi Sharma")}
              </p>
              <p className="text-[10px] text-[#727971] truncate">
                {currentUser ? "Active Session" : "Sign In / Profile"}
              </p>
            </div>
            <span
              onClick={(e) => {
                e.stopPropagation();
                setCurrentView("settings");
              }}
              className="text-[#727971] hover:text-[#1B2B20] text-sm"
              title="Account Settings"
            >
              ⚙️
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col relative w-full md:ml-[280px] bg-[#FAFAF5] transition-all duration-300 h-screen overflow-hidden">
        {/* Dynamic Views Container */}
        <div className="flex-1 overflow-y-auto w-full px-4 md:px-10 pt-6 md:pt-10 pb-36 flex flex-col items-center">
          {currentView === "research" && (
            <LegalResearchView
              onAskQuestion={(q) => {
                void sendMessage(q);
              }}
            />
          )}

          {currentView === "tools" && <FeeCalculatorView />}

          {currentView === "settings" && (
            <AccountSettingsView
              currentUser={currentUser}
              onLogout={handleLogout}
              onOpenAuth={() => setIsAuthOpen(true)}
              onProfileUpdate={(updatedUser) => {
                setCurrentUser(updatedUser);
              }}
            />
          )}

          {currentView === "history" && (
            <div className="w-full max-w-[800px] space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-[#1B2B20]">Past Consultation Inquiries</h2>
                {authToken && (
                  <button
                    onClick={() => handleExportPDF()}
                    className="px-3 py-1.5 rounded-lg border border-[#638C6D] text-xs font-semibold text-[#638C6D] hover:bg-[#E5F9E7] transition cursor-pointer"
                  >
                    📄 Export Current PDF
                  </button>
                )}
              </div>

              {!currentUser ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-[#daeddc]">
                  <p className="text-xs text-[#727971]">Sign in to view and resume your saved consultation records</p>
                  <button
                    onClick={() => setIsAuthOpen(true)}
                    className="mt-3 rounded-xl bg-[#638C6D] px-4 py-2 text-xs font-bold text-white cursor-pointer"
                  >
                    Sign In
                  </button>
                </div>
              ) : mySessions.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-[#daeddc] text-xs text-[#727971]">
                  No saved consultations found in your account archive.
                </div>
              ) : (
                <div className="space-y-3">
                  {mySessions.map((s) => {
                    const sId = s.session_id || s.id || "";
                    return (
                      <div
                        key={sId}
                        onClick={() => resumeSession(sId)}
                        className="p-4 rounded-xl bg-white border border-[#daeddc] flex items-center justify-between hover:border-[#638C6D] cursor-pointer transition shadow-2xs group"
                      >
                        <div>
                          <div className="font-bold text-sm text-[#1B2B20] group-hover:text-[#638C6D] transition-colors">
                            {s.title || `Consultation #${sId.slice(-6)}`}
                          </div>
                          <div className="text-[11px] text-[#727971] mt-0.5">
                            {formatTimestamp(s.updated_at)}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportPDF(sId);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-[#daeddc] text-xs font-semibold text-[#638C6D] hover:bg-[#E7FBB4]/50 cursor-pointer"
                        >
                          📄 PDF
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {currentView === "chat" && (
            <div className="w-full max-w-[800px] flex flex-col items-center">
              {isChatEmpty ? (
                /* ── Empty Dashboard Welcome State (Exact Stitch Layout) ── */
                <div className="w-full flex flex-col items-center text-center mt-6 md:mt-12">
                  <img
                    alt="IP-SAKTI Emblem"
                    className="w-16 h-16 md:w-20 md:h-20 mb-6 opacity-80 mix-blend-multiply rounded-xl"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuD9lk-V00H9o6k4G8IJexs3h2HKtANXj1QbDFLg7zaEe9wqSfHBzzjJH-LK4bW7AifHooA2M-6Qs-2kcjNwn6yZ9kGlEi7bCY8HZ7wybNCyD1uRoHdhDFADexqiPgjD1q3YVMytPsH4R24-PNkIXM0imI3dbAfyg7wK3pnsUqz0bCsrNDBfyExM3yORSpI2EytQW0a8LVx4PohstAs0IiiEAGZJb6XhOEzOawe5jS7qjW8SoulSf-nfxA"
                  />
                  <h2 className="text-[32px] md:text-[48px] font-bold text-[#1B2B20] mb-10 max-w-2xl leading-tight tracking-tight">
                    How can IP-SAKTI assist your invention today?
                  </h2>

                  {/* Suggestion Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                    {QUICK_SUGGESTIONS.map((card, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendMessage(card.query)}
                        className="flex items-start gap-3 p-4 rounded-xl border border-[#638C6D]/20 transition-all duration-200 text-left shadow-xs cursor-pointer group"
                        style={{ backgroundColor: "rgba(255, 253, 231, 0.75)" }}
                      >
                        <span className="text-xl shrink-0">{card.icon}</span>
                        <div>
                          <p className="font-semibold text-sm text-[#1B2B20] group-hover:text-[#638C6D] transition-colors leading-snug">
                            {card.title}
                          </p>
                          <p className="text-xs text-[#414942] mt-1 opacity-70">
                            {card.desc}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* ── Active Conversation Stream ─────────────────────────── */
                <div className="w-full space-y-6 pt-2">
                  {messages.map((msg) => {
                    const isUser = msg.role === "user";
                    return (
                      <div key={msg.id} className="w-full">
                        {isUser ? (
                          /* User Query Bubble */
                          <div className="flex justify-end w-full">
                            <div className="bg-[#daeddc] text-[#1B2B20] rounded-2xl rounded-tr-sm px-5 py-3 max-w-[85%] shadow-xs">
                              <p className="text-sm font-medium">{msg.content}</p>
                            </div>
                          </div>
                        ) : (
                          /* AI Advisory Response Card */
                          <div className="flex justify-start w-full">
                            <div className="bg-white border border-[#daeddc] rounded-2xl w-full shadow-xs overflow-hidden flex flex-col relative">
                              {/* Internal Header */}
                              <div className="bg-[#FFFDE7]/80 px-6 py-3 border-b border-[#daeddc] flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-[#638C6D] text-lg">🛡️</span>
                                  <h3 className="text-sm font-bold text-[#638C6D] m-0 uppercase tracking-wide">
                                    {msg.isFaq ? "Statutory Guidance (Verified FAQ)" : "Section 3 & Statutory Guidance"}
                                  </h3>
                                </div>
                                <button
                                  onClick={() => handleExportPDF()}
                                  className="text-xs font-bold text-[#638C6D] hover:underline cursor-pointer"
                                >
                                  Export PDF ↗
                                </button>
                              </div>

                              {/* Card Body */}
                              <div className="p-6 space-y-4">
                                <MarkdownRenderer content={msg.content} />

                                {/* Official Citations */}
                                {msg.citations && msg.citations.length > 0 && (
                                  <div className="mt-4 border-t border-[#daeddc] pt-3 text-xs">
                                    <div className="flex items-center gap-1.5 font-bold text-[#bf5515] mb-2">
                                      <span>📜</span>
                                      <span>Official Statutory Citations:</span>
                                    </div>
                                    <ul className="space-y-1.5 text-[12px] text-[#414942]">
                                      {msg.citations.map((c, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                          <span className="text-[#638C6D] font-bold">•</span>
                                          <div>
                                            <span className="font-semibold text-[#1B2B20]">{c.source}</span>
                                            <span className="text-[#727971] ml-1">(Page {c.page})</span>
                                            {c.confidence && (
                                              <span className="ml-2 rounded bg-[#FFFDE7] border border-[#bf5515]/30 px-1.5 py-0.5 text-[10px] font-bold text-[#bf5515]">
                                                {c.confidence}
                                              </span>
                                            )}
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>

                              {/* Card Footer (Feedback) */}
                              <div className="bg-[#FAFAF5] px-6 py-2.5 border-t border-[#daeddc] flex items-center justify-between text-xs text-[#727971]">
                                <span className="text-[11px]">IP-SAKTI Verified Statutory Corpus</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    aria-label="Helpful"
                                    onClick={() => handleFeedback(msg.id, 1)}
                                    className={`p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer ${
                                      feedbackGiven[msg.id] === 1 ? "text-[#638C6D] font-bold bg-white" : ""
                                    }`}
                                  >
                                    👍 Helpful
                                  </button>
                                  <button
                                    aria-label="Not Helpful"
                                    onClick={() => handleFeedback(msg.id, -1)}
                                    className={`p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer ${
                                      feedbackGiven[msg.id] === -1 ? "text-red-700 font-bold bg-white" : ""
                                    }`}
                                  >
                                    👎 Report
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Active Thinking Indicator */}
              {thinkingState && (
                <div className="flex justify-start w-full mt-4">
                  <div className="flex items-center gap-3 text-[#638C6D] text-xs font-semibold animate-pulse bg-[#FFFDE7] px-4 py-2 rounded-xl border border-[#638C6D]/20">
                    <span className="animate-spin text-sm">🌿</span>
                    <span>{thinkingState}</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Floating Prompt Bar (Exact Stitch Layout & Pill Styling) ─ */}
        {currentView === "chat" && (
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 bg-gradient-to-t from-[#FAFAF5] via-[#FAFAF5] to-transparent pointer-events-none z-40">
            <div className="max-w-[800px] mx-auto pointer-events-auto">
              <div
                className="rounded-full p-2 flex items-center gap-2 shadow-lg border border-[#E6E5DD] transition-all duration-300 focus-within:border-[#638C6D]"
                style={{ backgroundColor: "rgba(255, 253, 231, 0.9)" }}
              >
                {/* Left Tool Button */}
                <button
                  type="button"
                  onClick={() => setCurrentView("tools")}
                  className="p-3 text-[#5a6a32] hover:bg-white/50 rounded-full transition-colors shrink-0 flex items-center justify-center cursor-pointer"
                  title="Open Official IP Tools, Fee Calculator & Wizard"
                >
                  <span className="text-xl leading-none">🧮</span>
                </button>

                {/* Input Textbox */}
                <div className="flex-1 py-1 px-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder="Draft a patent claim for an AI model or Ayurvedic formulation..."
                    disabled={isStreaming}
                    className="w-full bg-transparent border-none outline-none text-sm text-[#1B2B20] placeholder-[#1B2B20]/50 focus:ring-0 font-normal"
                  />
                </div>

                {/* Send Button */}
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={isStreaming || !input.trim()}
                  className="p-3 bg-[#DF6D2D] hover:bg-[#bf5515] text-white rounded-full transition-colors shrink-0 flex items-center justify-center shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>

              <div className="text-center mt-3 text-xs text-[#414942] opacity-60">
                IP-SAKTI can make mistakes. Verify important legal information with a registered Patent Agent.
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Bottom Navigation (Mobile Only) ─────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[#e5f9e7] border-t border-[#daeddc] flex justify-around items-center py-2 px-2 z-40">
        <button
          onClick={() => setCurrentView("chat")}
          className={`flex flex-col items-center gap-1 p-2 ${currentView === "chat" ? "text-[#638C6D] font-bold" : "text-[#414942]"}`}
        >
          <span className="text-lg">💬</span>
          <span className="text-[10px]">Chat</span>
        </button>
        <button
          onClick={() => setCurrentView("research")}
          className={`flex flex-col items-center gap-1 p-2 ${currentView === "research" ? "text-[#638C6D] font-bold" : "text-[#414942]"}`}
        >
          <span className="text-lg">📖</span>
          <span className="text-[10px]">Research</span>
        </button>
        <button
          onClick={() => setCurrentView("tools")}
          className={`flex flex-col items-center gap-1 p-2 ${currentView === "tools" ? "text-[#638C6D] font-bold" : "text-[#414942]"}`}
        >
          <span className="text-lg">🧮</span>
          <span className="text-[10px]">Tools</span>
        </button>
        <button
          onClick={() => (currentUser ? setCurrentView("settings") : setIsAuthOpen(true))}
          className={`flex flex-col items-center gap-1 p-2 ${currentView === "settings" ? "text-[#638C6D] font-bold" : "text-[#414942]"}`}
        >
          <span className="text-lg">👤</span>
          <span className="text-[10px]">Profile</span>
        </button>
      </nav>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(token, user) => {
          setAuthToken(token);
          setCurrentUser(user);
        }}
      />
    </div>
  );
}
