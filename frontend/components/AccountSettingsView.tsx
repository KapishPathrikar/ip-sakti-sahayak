"use client";

import React, { useState, useEffect } from "react";

const apiBaseUrl = "";

interface AccountSettingsViewProps {
  currentUser?: {
    id: number;
    email: string;
    full_name?: string;
    role?: string;
    daily_query_limit?: number;
    created_at?: string;
  } | null;
  onLogout?: () => void;
  onOpenAuth?: () => void;
  onProfileUpdate?: (updatedUser: any) => void;
  onClearHistory?: () => void;
}

export default function AccountSettingsView({
  currentUser,
  onLogout,
  onOpenAuth,
  onProfileUpdate,
  onClearHistory,
}: AccountSettingsViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState("Temporary User");
  const [location, setLocation] = useState("India");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    try {
      if (currentUser?.full_name) {
        setFullName(currentUser.full_name);
      } else {
        setFullName("Temporary User");
      }
      const savedPrefs = localStorage.getItem("ip_shakti_prefs");
      if (savedPrefs && currentUser) {
        const parsed = JSON.parse(savedPrefs);
        if (parsed.fullName) setFullName(parsed.fullName);
        if (parsed.location) setLocation(parsed.location);
      }
    } catch {}
  }, [currentUser]);

  const displayRole = currentUser?.role
    ? currentUser.role.toUpperCase()
    : "TEMPORARY USER (GUEST)";
  const displayEmail = currentUser?.email || "Guest Session (Not Signed In)";

  // Real usage data from backend
  const queriesMax = currentUser?.daily_query_limit || 50;
  const queriesUsed = (currentUser as any)?.daily_queries_used || 0; 
  const usagePercentage = Math.min(100, Math.max(0, (queriesUsed / queriesMax) * 100));

  async function handleSaveProfile() {
    setIsEditing(false);
    const newPrefs = {
      fullName: fullName.trim(),
      location: location.trim(),
    };
    localStorage.setItem("ip_shakti_prefs", JSON.stringify(newPrefs));

    if (currentUser) {
      const updatedUser = { ...currentUser, full_name: fullName.trim() };
      localStorage.setItem("ip_shakti_user", JSON.stringify(updatedUser));
      if (onProfileUpdate) onProfileUpdate(updatedUser);

      try {
        const token = localStorage.getItem("ip_shakti_token");
        if (token) {
          await fetch(`${apiBaseUrl}/api/auth/profile`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ full_name: fullName.trim() }),
          }).catch(() => {});
        }
      } catch {}
    }

    setSaveMessage("Profile updated successfully!");
    setTimeout(() => setSaveMessage(null), 3000);
  }

  async function handleExportAllRecords() {
    setIsExporting(true);
    try {
      const token = localStorage.getItem("ip_shakti_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${apiBaseUrl}/api/chat/my-sessions`, { headers });
      if (!res.ok) throw new Error("Failed to fetch records.");

      const sessions = await res.json();
      if (!sessions || sessions.length === 0) {
        setSaveMessage("No saved consultation records found to export.");
        setTimeout(() => setSaveMessage(null), 3000);
        return;
      }

      let htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>IP-SAKTI Legal Consultation Records</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1E1B18; background: #FBF9F5; padding: 40px; }
    .container { max-width: 860px; margin: 0 auto; background: #FFFFFF; padding: 40px; border-radius: 16px; border: 1px solid #E5DCD0; }
    .header { border-bottom: 2px solid #7D4F39; padding-bottom: 20px; margin-bottom: 30px; }
    .title { font-size: 24px; font-weight: bold; color: #7D4F39; }
    .session { background: #FAF7F2; border: 1px solid #E5DCD0; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .msg { margin: 12px 0; padding: 12px; border-radius: 8px; font-size: 14px; }
    .user { background: #F1EDE6; font-weight: 600; }
    .assistant { background: #FFFFFF; border: 1px solid #E5DCD0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">🌿 IP-SAKTI Legal Research Archive</div>
      <p><strong>Researcher:</strong> ${fullName} (${displayEmail}) | <strong>Location:</strong> ${location}</p>
    </div>
`;

      for (const sess of sessions) {
        const sId = sess.session_id || sess.id;
        try {
          const histRes = await fetch(`${apiBaseUrl}/api/chat/history/${sId}`);
          if (histRes.ok) {
            const histData = await histRes.json();
            const msgs = histData.history || [];
            if (msgs.length === 0) continue;
            htmlContent += `<div class="session"><h3 style="margin-top:0; color:#1E1B18;">📌 ${sess.title || sId}</h3>`;
            for (const m of msgs) {
              const isUser = m.role === "user";
              htmlContent += `<div class="msg ${isUser ? "user" : "assistant"}"><strong>${isUser ? "Query" : "Advisory"}:</strong> ${m.content.replace(/\n/g, "<br/>")}</div>`;
            }
            htmlContent += `</div>`;
          }
        } catch {}
      }

      htmlContent += `</div></body></html>`;

      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `IP_SAKTI_Consultation_Report_${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setSaveMessage("Consultation report downloaded successfully!");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setSaveMessage("Failed to export records.");
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleClearHistory() {
    if (
      confirm(
        "Are you sure you want to permanently clear all consultation histories? This action cannot be undone."
      )
    ) {
      try {
        const token = localStorage.getItem("ip_shakti_token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${apiBaseUrl}/api/chat/all-history`, {
          method: "DELETE",
          headers,
        });

        localStorage.removeItem("ip_shakti_sessions");
        if (onClearHistory) onClearHistory();

        if (res.ok) {
          setSaveMessage("All consultation history has been permanently cleared.");
        } else {
          setSaveMessage("History cleared locally.");
        }
        setTimeout(() => setSaveMessage(null), 3500);
      } catch (err) {
        console.error("Failed to clear history", err);
        setSaveMessage("Failed to clear history. Please try again.");
        setTimeout(() => setSaveMessage(null), 3000);
      }
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-6 py-6 md:py-10 space-y-8 animate-in fade-in transition-colors duration-300 dark:bg-gray-900">
      {/* ── Header (Stitch Unified Theme) ───────────────────────────── */}
      <header className="mb-4">
        <h2 className="text-3xl sm:text-4xl font-bold text-[#1E1B18] mb-2 tracking-tight dark:text-white transition-colors duration-300">
          Account Settings
        </h2>
        <p className="text-sm md:text-base text-[#645D56] dark:text-gray-300 transition-colors duration-300">
          Manage your profile, usage limits, and data preferences.
        </p>
      </header>

      {/* Save / Notification Toast */}
      {saveMessage && (
        <div className="p-4 rounded-xl bg-[#F6EDE7] border border-[#7D4F39]/40 text-[#7D4F39] text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>{saveMessage}</span>
          </div>
          <button onClick={() => setSaveMessage(null)} className="text-xs">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left Column: Profile Card ───────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 ambient-shadow border card-border dark:border-gray-700 transition-colors duration-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8 pb-8 border-b border-[#1E1B18]/10 dark:border-gray-700">
              {/* Profile Details */}
              <div className="flex-1 min-w-0">
                <h3 className="text-2xl font-bold text-[#1E1B18] dark:text-white mb-1 transition-colors duration-300">
                  {fullName}
                </h3>
                <p className="text-[#7D4F39] dark:text-[#C86D3B] text-xs font-bold uppercase tracking-wider mb-2 transition-colors duration-300">
                  {displayRole}
                </p>
                <div className="flex items-center gap-2 text-xs text-[#645D56] dark:text-gray-400 transition-colors duration-300">
                  <span className="material-symbols-outlined text-base">mail</span>
                  <span className="truncate">{displayEmail}</span>
                </div>
              </div>

              {/* Edit / Sign-in / Logout Action */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {currentUser && onLogout && (
                  <button
                    onClick={onLogout}
                    className="mt-4 sm:mt-0 px-4 py-2.5 rounded-xl border border-[#B3261E]/40 text-[#B3261E] text-xs font-bold hover:bg-[#FDF2F2]/50 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    title="Sign out and return to Temporary User"
                  >
                    <span className="material-symbols-outlined text-sm">logout</span>
                    Sign Out
                  </button>
                )}
                {!currentUser ? (
                  <button
                    onClick={onOpenAuth}
                    className="mt-4 sm:mt-0 px-5 py-2.5 rounded-xl bg-[#7D4F39] text-white text-xs font-bold hover:bg-[#643B28] transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">login</span>
                    Sign In / Register
                  </button>
                ) : isEditing ? (
                  <button
                    onClick={handleSaveProfile}
                    className="mt-4 sm:mt-0 px-5 py-2.5 rounded-xl bg-[#7D4F39] text-white text-xs font-bold hover:bg-[#643B28] transition-colors shadow-xs cursor-pointer"
                  >
                    Save Changes
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="mt-4 sm:mt-0 px-5 py-2.5 rounded-xl border border-[#7D4F39] text-[#7D4F39] text-xs font-bold hover:bg-[#7D4F39]/10 transition-colors cursor-pointer"
                  >
                    Edit Profile
                  </button>
                )}
              </div>
            </div>

            {/* Profile Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-[#8C827A] uppercase tracking-wider mb-2">
                  Full Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#F1EDE6] text-[#1E1B18] text-sm border card-border outline-none focus:ring-2 focus:ring-[#7D4F39] dark:bg-gray-800 dark:text-white"
                  />
                ) : (
                  <div className="px-4 py-3 rounded-xl bg-[#F1EDE6]/60 text-[#1E1B18] text-sm border card-border font-medium dark:bg-gray-800 dark:text-white">
                    {fullName}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#8C827A] uppercase tracking-wider mb-2">
                  Location
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#F1EDE6] text-[#1E1B18] text-sm border card-border outline-none focus:ring-2 focus:ring-[#7D4F39] dark:bg-gray-800 dark:text-white"
                  />
                ) : (
                  <div className="px-4 py-3 rounded-xl bg-[#F1EDE6]/60 text-[#1E1B18] text-sm border card-border font-medium dark:bg-gray-800 dark:text-white">
                    {location}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-[#8C827A] uppercase tracking-wider">
                    API Usage (Daily)
                  </label>
                  <span className="text-xs font-bold text-[#1E1B18] dark:text-white transition-colors duration-300">
                    {queriesUsed} / {queriesMax} queries
                  </span>
                </div>
                
                {/* Progress Bar Track */}
                <div className="h-3 w-full bg-[#F1EDE6] dark:bg-gray-700 rounded-full overflow-hidden border card-border dark:border-gray-600 transition-colors duration-300">
                  {/* Progress Bar Fill */}
                  <div 
                    className="h-full bg-[#7D4F39] transition-all duration-1000 ease-out"
                    style={{ width: `${usagePercentage}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-[#8C827A] mt-2">
                  Your limit resets daily at midnight UTC. Upgrade your plan for more queries.
                </p>
              </div>
            </div>

            {currentUser && onLogout && (
              <div className="mt-8 pt-6 border-t border-[#1E1B18]/10 flex justify-end">
                <button
                  onClick={onLogout}
                  className="px-4 py-2 rounded-lg border border-[#B3261E]/30 text-xs font-semibold text-[#B3261E] hover:bg-[#FDF2F2]/50 transition cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            )}
          </section>
        </div>

        {/* ── Right Column: Security & Data Privacy ───────────────────── */}
        <div className="flex flex-col gap-8">
          {/* Security Card - Hidden per user request */}
          <section className="hidden bg-white rounded-2xl p-6 ambient-shadow border card-border">
            <h3 className="text-base font-bold text-[#1E1B18] mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#7D4F39]">lock</span>
              <span>Security</span>
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center p-3.5 hover:bg-[#F1EDE6]/50 rounded-xl transition-colors cursor-pointer group border card-border">
                <div>
                  <h4 className="text-sm font-semibold text-[#1E1B18] group-hover:text-[#7D4F39] transition-colors">
                    Password &amp; Auth
                  </h4>
                  <p className="text-xs text-[#8C827A]">Protected via JWT encryption</p>
                </div>
                <span className="material-symbols-outlined text-[#8C827A]">chevron_right</span>
              </div>
            </div>
          </section>

          {/* Data Privacy Card */}
          <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 ambient-shadow border card-border dark:border-gray-700 transition-colors duration-300">
            <h3 className="text-base font-bold text-[#1E1B18] dark:text-white mb-2 flex items-center gap-2 transition-colors duration-300">
              <span className="material-symbols-outlined text-[#7D4F39]">shield_lock</span>
              <span>Data Privacy</span>
            </h3>
            <p className="text-xs text-[#645D56] dark:text-gray-400 mb-6 leading-relaxed transition-colors duration-300">
              Manage your legal research data and history. Actions taken here are permanent.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleExportAllRecords}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-[#7D4F39] text-[#7D4F39] text-xs font-bold hover:bg-[#7D4F39]/5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">download</span>
                <span>{isExporting ? "Exporting Records..." : "Export All Records"}</span>
              </button>

              <button
                onClick={handleClearHistory}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#FDF2F2]/50 text-[#B3261E] border border-[#B3261E]/30 text-xs font-bold hover:bg-[#FDF2F2] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">delete_forever</span>
                <span>Clear History</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
