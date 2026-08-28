"use client";

import React, { useState, useEffect } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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
}

export default function AccountSettingsView({
  currentUser,
  onLogout,
  onOpenAuth,
  onProfileUpdate,
}: AccountSettingsViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState("Rajesh Kumar");
  const [organization, setOrganization] = useState("InnovateTech Solutions");
  const [timezone, setTimezone] = useState("IST (UTC+05:30)");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    try {
      const savedPrefs = localStorage.getItem("ip_shakti_prefs");
      if (savedPrefs) {
        const parsed = JSON.parse(savedPrefs);
        if (parsed.fullName) setFullName(parsed.fullName);
        if (parsed.organization) setOrganization(parsed.organization);
        if (parsed.timezone) setTimezone(parsed.timezone);
      } else if (currentUser?.full_name) {
        setFullName(currentUser.full_name);
      }
    } catch {}
  }, [currentUser]);

  const displayRole = currentUser?.role
    ? currentUser.role.toUpperCase()
    : "IP RESEARCHER / STARTUP";
  const displayEmail = currentUser?.email || "rajesh@startup.in";

  async function handleSaveProfile() {
    setIsEditing(false);
    const newPrefs = {
      fullName: fullName.trim(),
      organization: organization.trim(),
      timezone,
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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #0F1F15; background: #FAFAF5; padding: 40px; }
    .container { max-width: 860px; margin: 0 auto; background: #FFFFFF; padding: 40px; border-radius: 16px; border: 1px solid #D4E7D6; }
    .header { border-bottom: 2px solid #638C6D; padding-bottom: 20px; margin-bottom: 30px; }
    .title { font-size: 24px; font-weight: bold; color: #3D6448; }
    .session { background: #FFFDE7; border: 1px solid #D4E7D6; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .msg { margin: 12px 0; padding: 12px; border-radius: 8px; font-size: 14px; }
    .user { background: #E5F9E7; font-weight: 600; }
    .assistant { background: #FFFFFF; border: 1px solid #D4E7D6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">🌿 IP-SAKTI Legal Research Archive</div>
      <p><strong>Researcher:</strong> ${fullName} (${displayEmail}) | <strong>Organization:</strong> ${organization}</p>
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
            htmlContent += `<div class="session"><h3 style="margin-top:0; color:#0F1F15;">📌 ${sess.title || sId}</h3>`;
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

  function handleClearHistory() {
    if (
      confirm(
        "Are you sure you want to clear your consultation history? This action is permanent."
      )
    ) {
      localStorage.removeItem("ip_shakti_sessions");
      setSaveMessage("Consultation history cleared.");
      setTimeout(() => setSaveMessage(null), 3000);
    }
  }

  return (
    <div className="w-full min-h-screen" style={{ background: "#F0F0E8" }}>
      <div className="w-full max-w-5xl mx-auto px-6 py-8 space-y-5">
        {/* Page Header */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-[#0F1F15]">Account Settings</h2>
          <p className="text-sm" style={{ color: "#C07000" }}>
            Manage your{" "}
            <span style={{ color: "#C07000", textDecoration: "underline", cursor: "pointer" }}>
              profile
            </span>
            ,{" "}
            <span style={{ color: "#C07000", textDecoration: "underline", cursor: "pointer" }}>
              usage limits
            </span>
            , and{" "}
            <span style={{ color: "#C07000", textDecoration: "underline", cursor: "pointer" }}>
              data preferences
            </span>
            .
          </p>
        </div>

        {/* Success message */}
        {saveMessage && (
          <div
            className="p-3 rounded-xl text-xs font-semibold flex items-center gap-2"
            style={{
              background: "#E5F9E7",
              border: "1px solid #638C6D",
              color: "#3D6448",
            }}
          >
            <span>✅</span>
            <span>{saveMessage}</span>
          </div>
        )}

        {/* Main 2-column layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: "20px",
            alignItems: "start",
          }}
        >
          {/* LEFT: Profile Card */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E0E0D8",
              padding: "24px",
            }}
          >
            {/* Top row: Avatar + Name/Role/Email + Edit button */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "16px",
                paddingBottom: "20px",
                borderBottom: "1px solid #E8E8E0",
              }}
            >
              {/* Avatar + Info */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                {/* Avatar — small rounded rect matching screenshot */}
                <div
                  style={{
                    width: "64px",
                    height: "72px",
                    borderRadius: "8px",
                    overflow: "hidden",
                    flexShrink: 0,
                    background: "#E8E8E0",
                  }}
                >
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBBlrDJ92e0InbEqUdFoGT0LuKH1JGJjRQ5HBHdVOHOZ9X-L3iktSLcw8GpOkrFlTFxTA_WtDucP43Mm9DM5YQBdxDejlUaV1VKr5OU2BZX7XECY_hvJxMZoJTS5eMOPFOU9YaTYonmP2i3371sx82DPe7LeQGthzIxnxvTXtfsKWZsvLDiX8eb7actn4NtOmrA2KNRuqSpw8SAYtfKiahRmEcN1qE-y_kKooutpvoCx9vmXtAnR7CEcw"
                    alt={fullName}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "top center",
                    }}
                  />
                </div>

                {/* Name, Role, Email */}
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {isEditing ? (
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      style={{
                        border: "1px solid #D4E7D6",
                        borderRadius: "6px",
                        padding: "2px 8px",
                        fontSize: "18px",
                        fontWeight: "700",
                        color: "#0F1F15",
                        outline: "none",
                        width: "200px",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: "18px",
                        fontWeight: "700",
                        color: "#0F1F15",
                        lineHeight: 1.2,
                      }}
                    >
                      {fullName}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "#4A7C5E",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {displayRole}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      marginTop: "2px",
                    }}
                  >
                    <svg
                      width="13"
                      height="13"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="#888"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <span style={{ fontSize: "13px", color: "#555" }}>{displayEmail}</span>
                  </div>
                </div>
              </div>

              {/* Edit Profile button — top right */}
              <button
                onClick={() => {
                  if (isEditing) handleSaveProfile();
                  else setIsEditing(true);
                }}
                style={{
                  padding: "5px 14px",
                  borderRadius: "20px",
                  border: "1px solid #9ABBA6",
                  background: "transparent",
                  color: "#4A7C5E",
                  fontSize: "12px",
                  fontWeight: "500",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {isEditing ? "Save Changes" : "Edit Profile"}
              </button>
            </div>

            {/* Bottom: Organization & Timezone side-by-side */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px",
                marginTop: "20px",
              }}
            >
              {/* Organization */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "10px",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#7A9A7E",
                    marginBottom: "8px",
                  }}
                >
                  Organization
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: "#D4F5D8",
                      border: "1px solid #B8DFC0",
                      fontSize: "14px",
                      color: "#0F1F15",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: "#D4F5D8",
                      border: "1px solid #B8DFC0",
                      fontSize: "14px",
                      color: "#0F1F15",
                    }}
                  >
                    {organization}
                  </div>
                )}
              </div>

              {/* Timezone */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "10px",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#7A9A7E",
                    marginBottom: "8px",
                  }}
                >
                  Timezone
                </label>
                <div style={{ position: "relative" }}>
                  <select
                    value={timezone}
                    onChange={(e) => {
                      const newTz = e.target.value;
                      setTimezone(newTz);
                      try {
                        const savedPrefs = JSON.parse(
                          localStorage.getItem("ip_shakti_prefs") || "{}"
                        );
                        localStorage.setItem(
                          "ip_shakti_prefs",
                          JSON.stringify({ ...savedPrefs, timezone: newTz })
                        );
                      } catch {}
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 36px 10px 14px",
                      borderRadius: "8px",
                      background: "#D4F5D8",
                      border: "1px solid #B8DFC0",
                      fontSize: "14px",
                      color: "#0F1F15",
                      outline: "none",
                      appearance: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="IST (UTC+05:30)">IST (UTC+05:30)</option>
                    <option value="UTC (UTC+00:00)">UTC (UTC+00:00)</option>
                    <option value="EST (UTC-05:00)">EST (UTC-05:00)</option>
                    <option value="PST (UTC-08:00)">PST (UTC-08:00)</option>
                  </select>
                  <span
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "10px",
                      color: "#4A7C5E",
                      pointerEvents: "none",
                    }}
                  >
                    ▼
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT column: Security + Data Privacy */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Security Card */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E0E0D8",
                padding: "20px 22px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "14px",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#4A7C5E"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <span style={{ fontSize: "15px", fontWeight: "700", color: "#0F1F15" }}>
                  Security
                </span>
              </div>

              {/* Password row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  padding: "6px 4px",
                  borderRadius: "6px",
                }}
              >
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#0F1F15" }}>
                    Password
                  </div>
                  <div style={{ fontSize: "12px", color: "#888" }}>Last changed 3 months ago</div>
                </div>
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#888"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            {/* Data Privacy Card */}
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "12px",
                border: "1px solid #E0E0D8",
                padding: "20px 22px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#C07000"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <span style={{ fontSize: "15px", fontWeight: "700", color: "#0F1F15" }}>
                  Data Privacy
                </span>
              </div>

              <p style={{ fontSize: "12px", color: "#666", lineHeight: "1.55", marginBottom: "14px" }}>
                Manage your legal research data and history. Actions taken here are permanent.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {/* Export All Records */}
                <button
                  onClick={handleExportAllRecords}
                  disabled={isExporting}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "7px",
                    padding: "9px 16px",
                    borderRadius: "8px",
                    border: "1px solid #9ABBA6",
                    background: "transparent",
                    color: "#4A7C5E",
                    fontSize: "13px",
                    fontWeight: "500",
                    cursor: isExporting ? "not-allowed" : "pointer",
                    opacity: isExporting ? 0.6 : 1,
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  {isExporting ? "Exporting..." : "Export All Records"}
                </button>

                {/* Clear History */}
                <button
                  onClick={handleClearHistory}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "7px",
                    padding: "9px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#FCE8E6",
                    color: "#BA1A1A",
                    fontSize: "13px",
                    fontWeight: "500",
                    cursor: "pointer",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Clear History
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
