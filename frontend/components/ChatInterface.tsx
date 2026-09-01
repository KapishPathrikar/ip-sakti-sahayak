"use client";

import React, { useState, useRef, useEffect } from "react";
import MarkdownRenderer from "./MarkdownRenderer";


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

interface ChatInterfaceProps {
  initialQuestion?: string;
  authToken?: string | null;
  currentUser?: any;
}

const apiBaseUrl = "";

export default function ChatInterface({ initialQuestion, authToken, currentUser }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Namaste! I am IP Shakti Sahayak, your India-first intellectual property intelligence assistant.\n\nAsk me anything about Indian patent filing procedures, trademark rules, traditional knowledge (TKDL), or biodiversity approvals in English, Hindi, or Marathi.",
    },
  ]);
  const [input, setInput] = useState("");
  const [lastAttemptedQuery, setLastAttemptedQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinkingState, setThinkingState] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => "sess-" + Math.random().toString(36).substring(2, 9));
  const [feedbackGiven, setFeedbackGiven] = useState<{ [msgId: string]: number }>({});
  const [jurisdiction, setJurisdiction] = useState<"india" | "international">("india");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinkingState]);

  useEffect(() => {
    if (initialQuestion) {
      void sendMessage(initialQuestion);
    }
  }, [initialQuestion]);

  async function sendMessage(textToSend?: string) {
    const text = textToSend || input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setLastAttemptedQuery(text);
    const userMsgId = "user-" + Date.now();
    
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: text },
    ]);
    
    const assistantMsgId = "asst-" + Date.now();
    setIsStreaming(true);
    setThinkingState("🧠 Analyzing Indian IP statutes & legal corpus...");

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
          jurisdiction: jurisdiction,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          const errData = await response.json();
          throw new Error(errData.detail?.message || "Rate limit reached. Please wait.");
        }
        throw new Error("Failed to receive stream response.");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No readable stream.");

      const decoder = new TextDecoder("utf-8");
      let partialAssistantText = "";
      let citations: Citation[] = [];

      // Add placeholder assistant message
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
                partialAssistantText += event.token;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: partialAssistantText }
                      : msg
                  )
                );
              } else if (event.type === "done") {
                citations = event.citations || [];
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          content: partialAssistantText,
                          citations: citations,
                          isFaq: event.from_faq,
                        }
                      : msg
                  )
                );
              }
            } catch (err) {
              console.error("Error parsing stream chunk", err);
            }
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          role: "assistant",
          content: `⚠️ Error: ${err.message || "Something went wrong while fetching guidance."}`,
        },
      ]);
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
          message_id: 1, // Reference ID
          rating,
          comment: rating === 1 ? "Helpful answer" : "Inaccurate",
        }),
      });
    } catch (err) {
      console.error("Feedback submit error", err);
    }
  }

  function handleExportPDF() {
    window.open(`${apiBaseUrl}/api/export-dossier/${sessionId}`, "_blank");
  }

  function handleResetChat() {
    setSessionId("sess-" + Math.random().toString(36).substring(2, 9));
    setMessages([
      {
        id: "welcome-" + Date.now(),
        role: "assistant",
        content: "Conversation cleared. How may I assist you with Indian IP law today?",
      },
    ]);
  }

  return (
    <div className="flex h-[600px] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-bold text-slate-800">
            Live IP Legal Assistant
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
            <button
              onClick={() => setJurisdiction("india")}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                jurisdiction === "india" ? "bg-white shadow-sm text-emerald-700" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              🇮🇳 India
            </button>
            <button
              onClick={() => setJurisdiction("international")}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                jurisdiction === "international" ? "bg-white shadow-sm text-blue-700" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              🌐 International
            </button>
          </div>
          <button
            onClick={handleExportPDF}
            className="rounded-lg border border-slate-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 shadow-sm"
            title="Download full attorney brief PDF"
          >
            📄 Generate Attorney Brief
          </button>
          <button
            onClick={handleResetChat}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            🔄 New Chat
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? "bg-blue-700 text-white rounded-br-none"
                    : "bg-slate-100 text-slate-900 rounded-bl-none"
                }`}
              >
                <MarkdownRenderer content={msg.content} isUser={isUser} />


                {/* Citations block */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-4 border-t border-slate-200/60 pt-3 text-xs">
                    <span className="font-bold flex items-center gap-1 text-emerald-800 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Verified Statutory Citations
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {msg.citations.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-md bg-emerald-50 px-2.5 py-1.5 border border-emerald-100 cursor-pointer hover:bg-emerald-100 transition-colors">
                          <span className="font-semibold text-emerald-900">{c.source}</span>
                          <span className="text-emerald-700">| Pg {c.page}</span>
                          {c.confidence && (
                            <span className="ml-1 rounded bg-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                              {c.confidence}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Message Footer / Feedback */}
              {!isUser && msg.id !== "welcome" && msg.content && (
                <div className="mt-1 flex items-center gap-2 px-1 text-xs text-slate-400">
                  <span>Was this helpful?</span>
                  <button
                    onClick={() => handleFeedback(msg.id, 1)}
                    className={`hover:text-emerald-600 ${
                      feedbackGiven[msg.id] === 1 ? "text-emerald-600 font-bold" : ""
                    }`}
                  >
                    👍
                  </button>
                  <button
                    onClick={() => handleFeedback(msg.id, -1)}
                    className={`hover:text-red-600 ${
                      feedbackGiven[msg.id] === -1 ? "text-red-600 font-bold" : ""
                    }`}
                  >
                    👎
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Live Thinking Status Box */}
        {thinkingState && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/70 px-3.5 py-2.5 text-xs font-medium text-blue-800 animate-pulse">
            <span className="animate-spin">⚙️</span>
            <span>{thinkingState}</span>
          </div>
        )}



        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage();
        }}
        className="flex items-center gap-2 border-t border-slate-200 p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask in English, Hindi (उदा. पेटेंट कसे करायचे?), or Marathi..."
          disabled={isStreaming}
          className="flex-1 rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-blue-600 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-50"
        >
          {isStreaming ? "Thinking..." : "Send"}
        </button>
      </form>
    </div>
  );
}
