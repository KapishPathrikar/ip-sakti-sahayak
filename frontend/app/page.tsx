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
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Saved sessions state
  const [mySessions, setMySessions] = useState<SavedSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Auth & Service state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSessionId("sess-" + Math.random().toString(36).substring(2, 9));

    const token = localStorage.getItem("ip_shakti_token");
    const userStr = localStorage.getItem("ip_shakti_user");
    if (token) {
      setAuthToken(token);
      // Fetch fresh profile data
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (!data.detail) {
            setCurrentUser(data);
            localStorage.setItem("ip_shakti_user", JSON.stringify(data));
          }
        })
        .catch(err => console.error("Failed to fetch profile", err));
    }
    
    if (userStr && !token) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch { }
    }
  }, []);

  useEffect(() => {
    if (authToken) {
      void loadMySessions();
    }
  }, [authToken, sessionId]);

  useEffect(() => {
    if (currentView === "chat" && isAutoScrollEnabled) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, thinkingState, currentView, isAutoScrollEnabled]);

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

  async function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // If we are within 50px of the bottom, enable auto-scroll, else disable
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAutoScrollEnabled(isAtBottom);
  }

  async function sendMessage(textToSend?: string) {
    const text = textToSend || input.trim();
    if (!text || isStreaming) return;

    setCurrentView("chat");
    setIsAutoScrollEnabled(true);
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
    } catch { }
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

  async function handleDeleteSession(targetSessionId: string) {
    if (!confirm("Are you sure you want to delete this consultation history?")) return;
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
      await fetch(`${apiBaseUrl}/api/chat/history/${targetSessionId}`, {
        method: "DELETE",
        headers,
      });
      setMySessions((prev) => prev.filter((s) => (s.session_id || s.id) !== targetSessionId));
      if (sessionId === targetSessionId) {
        handleResetChat();
      }
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  }

  async function handleClearAllHistory() {
    if (confirm("Are you sure you want to permanently clear all consultation history?")) {
      try {
        const headers: Record<string, string> = {};
        if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
        await fetch(`${apiBaseUrl}/api/chat/all-history`, {
          method: "DELETE",
          headers,
        });
        setMySessions([]);
        setMessages([]);
        handleResetChat();
      } catch (err) {
        console.error("Failed to clear all history", err);
      }
    }
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
      <header className="md:hidden flex justify-between items-center w-full px-4 py-3 sticky top-0 z-40 bg-[#FFFDE7]/80 backdrop-blur-md border-b card-border">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-[#638C6D] p-1 cursor-pointer"
          >
            <span className="material-symbols-outlined">menu</span>
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
          <button
            onClick={() => (currentUser ? switchView("settings") : setIsAuthOpen(true))}
            className="w-8 h-8 rounded-full flex items-center justify-center border border-[#C1C8C0] cursor-pointer bg-[#E5F9E7] text-[#638C6D] hover:bg-[#DAEDDC] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">
              {currentUser ? "person" : "login"}
            </span>
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar (Desktop - Exact Stitch AI Dashboard & Unified Theme) ── */}
      <aside
        className={`flex flex-col h-screen p-6 w-[280px] fixed left-0 top-0 border-r card-border z-50 transition-transform duration-300 select-none bg-[#FFFDE7] ${
          isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
        }`}
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
            <p className="text-[11px] font-semibold text-[#414942] opacity-70 uppercase tracking-wider">AI Legal Suite</p>
          </div>
        </div>

        {/* CTA: New Chat */}
        <button
          onClick={handleResetChat}
          className="w-full mb-6 bg-[#638C6D] hover:bg-[#557E60] text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          <span>New Chat</span>
        </button>

        {/* Navigation Tabs */}
        <nav className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-1">
          <div className="px-3 py-1 text-[#414942] text-[11px] font-bold uppercase tracking-wider mb-1">
            Navigation
          </div>

          <button
            onClick={() => switchView("chat")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-200 cursor-pointer ${currentView === "chat"
                ? "bg-[#E7FBB4] text-[#5A6A32] border-l-4 border-[#638C6D] font-bold"
                : "text-[#414942] hover:bg-[#DAEDDC]/60"
              }`}
          >
            <span className="material-symbols-outlined text-[20px]">chat</span>
            <span className="text-sm font-medium truncate">New Chat</span>
          </button>

          <button
            onClick={() => switchView("history")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-200 cursor-pointer ${currentView === "history"
                ? "bg-[#E7FBB4] text-[#5A6A32] border-l-4 border-[#638C6D] font-bold"
                : "text-[#414942] hover:bg-[#DAEDDC]/60"
              }`}
          >
            <span className="material-symbols-outlined text-[20px]">history</span>
            <span className="text-sm font-medium truncate">Recent Inquiries</span>
          </button>

          <button
            onClick={() => switchView("research")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-200 cursor-pointer ${currentView === "research"
                ? "bg-[#E7FBB4] text-[#5A6A32] border-l-4 border-[#638C6D] font-bold"
                : "text-[#414942] hover:bg-[#DAEDDC]/60"
              }`}
          >
            <span className="material-symbols-outlined text-[20px]">menu_book</span>
            <span className="text-sm font-medium truncate">Legal Research</span>
          </button>

          <button
            onClick={() => switchView("tools")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-200 cursor-pointer ${currentView === "tools"
                ? "bg-[#E7FBB4] text-[#5A6A32] border-l-4 border-[#638C6D] font-bold"
                : "text-[#414942] hover:bg-[#DAEDDC]/60"
              }`}
          >
            <span className="material-symbols-outlined text-[20px]">calculate</span>
            <span className="text-sm font-medium truncate">IP Tools &amp; Calculator</span>
          </button>

          {/* Search History */}
          <div className="mt-4 px-1">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#727971] text-[18px]">
                search
              </span>
              <input
                className="w-full bg-[#E5F9E7] border border-transparent focus:border-[#638C6D] rounded-lg pl-9 pr-3 py-2 text-xs text-[#1B2B20] outline-none transition-colors placeholder:text-[#414942]/60"
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
                    onClick={() => {
                      resumeSession(sId);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-[#414942] hover:bg-[#DAEDDC]/60 rounded-lg truncate transition-colors block cursor-pointer"
                  >
                    {s.title || `Consultation #${sId.slice(-4)}`}
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        {/* Footer Profile (Stitch Dashboard style) */}
        <div className="mt-auto pt-4 border-t border-[#1B2B20]/10">
          <div
            onClick={() => {
              if (currentUser) {
                switchView("settings");
              } else {
                setIsAuthOpen(true);
              }
            }}
            className="flex items-center w-full gap-3 px-3 py-2 rounded-xl hover:bg-[#DAEDDC]/60 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center border border-[#C1C8C0] bg-[#E5F9E7] text-[#638C6D] shrink-0">
              <span className="material-symbols-outlined text-[18px]">
                {currentUser ? "person" : "login"}
              </span>
            </div>
            <div className="flex-1 min-w-0 flex items-center">
              <p className="text-sm font-bold text-[#1B2B20] truncate">
                {currentUser?.full_name || (currentUser?.email ? currentUser.email.split("@")[0] : "Temporary User")}
              </p>
            </div>
            <span
              className="material-symbols-outlined text-[#727971] text-base shrink-0"
              title="Account Settings"
            >
              settings
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col relative w-full md:ml-[280px] bg-[#FAFAF5] transition-all duration-300 h-screen overflow-hidden">
        {/* Dynamic Views Container */}
        <div 
          className="flex-1 overflow-y-auto w-full px-4 md:px-10 pt-6 md:pt-10 pb-36 flex flex-col items-center"
          onScroll={handleScroll}
        >
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
              onClearHistory={() => {
                setMySessions([]);
                setMessages([]);
                handleResetChat();
              }}
            />
          )}

          {currentView === "history" && (
            <div className="w-full max-w-[800px] space-y-4 pt-4 animate-in fade-in">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-2xl font-bold text-[#1B2B20]">Past Consultation Inquiries</h2>
                <div className="flex items-center gap-2">
                  {mySessions.length > 0 && (
                    <button
                      onClick={handleClearAllHistory}
                      className="px-3 py-1.5 rounded-lg border border-[#BA1A1A]/30 text-xs font-semibold text-[#BA1A1A] hover:bg-[#FFDAD6] transition cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">delete_forever</span>
                      <span>Clear All History</span>
                    </button>
                  )}
                  {authToken && (
                    <button
                      onClick={() => handleExportPDF()}
                      className="px-3 py-1.5 rounded-lg border border-[#638C6D] text-xs font-semibold text-[#638C6D] hover:bg-[#E5F9E7] transition cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                      <span>Export Current PDF</span>
                    </button>
                  )}
                </div>
              </div>

              {!currentUser ? (
                <div className="p-8 text-center bg-white rounded-2xl border card-border">
                  <p className="text-xs text-[#727971]">Sign in to view and resume your saved consultation records</p>
                  <button
                    onClick={() => setIsAuthOpen(true)}
                    className="mt-3 rounded-xl bg-[#638C6D] px-4 py-2 text-xs font-bold text-white cursor-pointer"
                  >
                    Sign In
                  </button>
                </div>
              ) : mySessions.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border card-border text-xs text-[#727971]">
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
                        className="p-4 rounded-xl bg-white border card-border flex items-center justify-between hover:border-[#638C6D] cursor-pointer transition ambient-shadow group"
                      >
                        <div className="flex-1 pr-4">
                          <div className="font-bold text-sm text-[#1B2B20] group-hover:text-[#638C6D] transition-colors">
                            {s.title || `Consultation #${sId.slice(-6)}`}
                          </div>
                          <div className="text-[11px] text-[#727971] mt-0.5">
                            {formatTimestamp(s.updated_at)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportPDF(sId);
                            }}
                            className="px-3 py-1.5 rounded-lg border card-border text-xs font-semibold text-[#638C6D] hover:bg-[#E7FBB4]/50 cursor-pointer"
                            title="Export PDF"
                          >
                            📄 PDF
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteSession(sId);
                            }}
                            className="px-2.5 py-1.5 rounded-lg border card-border text-xs font-semibold text-[#BA1A1A] hover:bg-[#FFDAD6] cursor-pointer"
                            title="Delete Session"
                          >
                            🗑️
                          </button>
                        </div>
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
                /* ── Empty Dashboard Welcome State (Design 3: Stitch IP-SAKTI AI Dashboard) ── */
                <div className="w-full flex flex-col items-center text-center mt-6 md:mt-12 animate-in fade-in">
                  <img
                    alt="IP-SAKTI Emblem"
                    className="w-16 h-16 md:w-20 md:h-20 mb-6 opacity-80 mix-blend-multiply rounded-xl"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuD9lk-V00H9o6k4G8IJexs3h2HKtANXj1QbDFLg7zaEe9wqSfHBzzjJH-LK4bW7AifHooA2M-6Qs-2kcjNwn6yZ9kGlEi7bCY8HZ7wybNCyD1uRoHdhDFADexqiPgjD1q3YVMytPsH4R24-PNkIXM0imI3dbAfyg7wK3pnsUqz0bCsrNDBfyExM3yORSpI2EytQW0a8LVx4PohstAs0IiiEAGZJb6XhOEzOawe5jS7qjW8SoulSf-nfxA"
                  />
                  <h2 className="text-[30px] md:text-[46px] font-bold text-[#1B2B20] mb-10 max-w-2xl leading-tight tracking-tight">
                    How can IP-SAKTI assist your invention today?
                  </h2>

                  {/* Suggestion Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                    {QUICK_SUGGESTIONS.map((card, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendMessage(card.query)}
                        className="flex items-start gap-3 p-4 rounded-xl border border-[#638C6D]/20 transition-all duration-200 text-left ambient-shadow cursor-pointer group hover:border-[#638C6D] bg-[#FFFDE7]/75"
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
                /* ── Active Conversation Stream (Design 1: Legal Research Chat - Unified Theme) ── */
                <div className="w-full space-y-6 pt-2 animate-in fade-in">
                  {messages.map((msg) => {
                    const isUser = msg.role === "user";
                    return (
                      <div key={msg.id} className="w-full">
                        {isUser ? (
                          /* User Query Bubble */
                          <div className="flex justify-end w-full">
                            <div className="bg-[#DAEDDC] text-[#1B2B20] rounded-2xl rounded-tr-xs px-5 py-3 max-w-[85%] shadow-xs">
                              <p className="text-sm font-medium">{msg.content}</p>
                            </div>
                          </div>
                        ) : (
                          /* AI Advisory Response Card */
                          <div className="flex justify-start w-full">
                            <div className="bg-[#FAFAF5] border card-border rounded-xl w-full shadow-sm overflow-hidden flex flex-col relative">
                              {/* Internal Header */}
                              <div className="bg-[#FFFDE7] px-6 py-3.5 border-b card-border flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <span className="material-symbols-outlined text-[#638C6D] text-lg filled">
                                    policy
                                  </span>
                                  <h3 className="text-sm font-bold text-[#638C6D] m-0 tracking-wide">
                                    {msg.isFaq ? "Statutory Guidance (Verified FAQ)" : "Section 3 & Statutory Guidance"}
                                  </h3>
                                </div>
                                <button
                                  onClick={() => handleExportPDF()}
                                  className="text-xs font-bold text-[#638C6D] hover:underline cursor-pointer flex items-center gap-1"
                                >
                                  <span>Export PDF</span>
                                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                                </button>
                              </div>

                              {/* Card Body */}
                              <div className="p-6 space-y-5 bg-white">
                                <MarkdownRenderer content={msg.content} />

                                {/* Official Citations */}
                                {msg.citations && msg.citations.length > 0 && (
                                  <div className="mt-4 border-t card-border pt-4 text-xs">
                                    <div className="flex items-center gap-1.5 font-bold text-[#C84C05] mb-2">
                                      <span className="material-symbols-outlined text-sm">menu_book</span>
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
                                              <span className="ml-2 rounded bg-[#FFFDE7] border border-[#BF5515]/30 px-1.5 py-0.5 text-[10px] font-bold text-[#BF5515]">
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
                              <div className="bg-[#FAFAF5] px-6 py-2.5 border-t card-border flex items-center justify-between text-xs text-[#727971]">
                                <span className="text-[11px]">IP-SAKTI Verified Statutory Corpus</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    aria-label="Helpful"
                                    onClick={() => handleFeedback(msg.id, 1)}
                                    className={`p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer flex items-center gap-1 ${feedbackGiven[msg.id] === 1 ? "text-[#638C6D] font-bold bg-white" : ""
                                      }`}
                                  >
                                    <span className="material-symbols-outlined text-sm">thumb_up</span>
                                    <span>Helpful</span>
                                  </button>
                                  <button
                                    aria-label="Not Helpful"
                                    onClick={() => handleFeedback(msg.id, -1)}
                                    className={`p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer flex items-center gap-1 ${feedbackGiven[msg.id] === -1 ? "text-red-700 font-bold bg-white" : ""
                                      }`}
                                  >
                                    <span className="material-symbols-outlined text-sm">thumb_down</span>
                                    <span>Report</span>
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

              {/* Active Thinking / Pulsing Indicator (Design 1) */}
              {thinkingState && (
                <div className="w-full flex justify-start mt-4">
                  <div className="flex items-center gap-2.5 text-[#727971] text-xs font-semibold pulse-animation bg-[#FFFDE7] px-4 py-2 rounded-full border card-border">
                    <span className="material-symbols-outlined animate-spin text-sm text-[#638C6D]">sync</span>
                    <span>{thinkingState}</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Floating Prompt Bar (Design 3 & Design 1 Unified) ───────────── */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-[#FAFAF5] via-[#FAFAF5]/90 to-transparent pointer-events-none z-20">
          <div className="max-w-[800px] mx-auto pointer-events-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage();
              }}
              className="bg-[#FFFDE7] backdrop-blur-md rounded-full p-2 flex items-center gap-2 ambient-shadow border card-border shadow-lg"
            >
              {/* Left Tools / Attach */}
              <button
                type="button"
                onClick={() => setCurrentView("research")}
                title="Browse Statutory FAQs & Repository"
                className="p-2.5 text-[#5A6A32] hover:bg-white/60 rounded-full transition-colors shrink-0 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">menu_book</span>
              </button>

              {/* Input */}
              <div className="flex-1 py-1 px-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isStreaming}
                  placeholder="Ask about IP law, TKDL, or fee rebates..."
                  className="w-full bg-transparent border-none focus:ring-0 text-sm text-[#1B2B20] placeholder:text-[#414942]/60 outline-none block"
                />
              </div>

              {/* Send Action */}
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                className="p-3 bg-[#DF6D2D] hover:bg-[#C84C05] disabled:opacity-50 text-white rounded-full transition-colors shrink-0 flex items-center justify-center shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">send</span>
              </button>
            </form>

            <div className="text-center mt-2.5 text-[11px] text-[#414942]/70 font-medium">
              IP-SAKTI can make mistakes. Verify important legal &amp; statutory information.
            </div>
          </div>
        </div>
      </main>

      {/* ── Bottom Navigation (Mobile Only - Exact Stitch Layout) ─────── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[#FFFDE7] border-t card-border flex justify-around items-center py-2 px-2 z-40">
        <button
          onClick={() => setCurrentView("chat")}
          className={`flex flex-col items-center p-2 cursor-pointer ${currentView === "chat" ? "text-[#638C6D] font-bold" : "text-[#414942]"
            }`}
        >
          <span className="material-symbols-outlined text-[22px]">chat</span>
          <span className="text-[10px] mt-0.5">Chat</span>
        </button>
        <button
          onClick={() => setCurrentView("research")}
          className={`flex flex-col items-center p-2 cursor-pointer ${currentView === "research" ? "text-[#638C6D] font-bold" : "text-[#414942]"
            }`}
        >
          <span className="material-symbols-outlined text-[22px]">menu_book</span>
          <span className="text-[10px] mt-0.5">Research</span>
        </button>
        <button
          onClick={() => setCurrentView("tools")}
          className={`flex flex-col items-center p-2 cursor-pointer ${currentView === "tools" ? "text-[#638C6D] font-bold" : "text-[#414942]"
            }`}
        >
          <span className="material-symbols-outlined text-[22px]">calculate</span>
          <span className="text-[10px] mt-0.5">Tools</span>
        </button>
        <button
          onClick={() => setCurrentView("settings")}
          className={`flex flex-col items-center p-2 cursor-pointer ${currentView === "settings" ? "text-[#638C6D] font-bold" : "text-[#414942]"
            }`}
        >
          <span className="material-symbols-outlined text-[22px]">settings</span>
          <span className="text-[10px] mt-0.5">Settings</span>
        </button>
      </nav>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(token: string, user: any) => {
          setAuthToken(token);
          setCurrentUser(user);
          setIsAuthOpen(false);
        }}
      />
    </div>
  );
}

