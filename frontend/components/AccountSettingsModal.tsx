"use client";

import React from "react";

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: number;
    email: string;
    full_name?: string;
    role?: string;
    daily_query_limit?: number;
    created_at?: string;
  } | null;
  onLogout: () => void;
}

export default function AccountSettingsModal({
  isOpen,
  onClose,
  currentUser,
  onLogout,
}: AccountSettingsModalProps) {
  if (!isOpen) return null;

  const joinDate = currentUser?.created_at
    ? new Date(currentUser.created_at).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Active Member";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-[#E5DCD0] bg-[#FBF9F5] text-[#1E1B18] shadow-2xl animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E5DCD0] bg-[#FAF7F2]/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-[#7D4F39] text-white font-bold shadow-xs">
              ⚙️
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1E1B18]">Account &amp; System Settings</h2>
              <p className="text-xs text-[#645D56]">IP-SAKTI Legal AI Workspace</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-[#F1EDE6] p-2 text-[#645D56] hover:bg-[#E5DCD0] hover:text-[#1E1B18] transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-5 p-6 max-h-[75vh] overflow-y-auto">
          {/* User Profile Card */}
          <div className="rounded-2xl border border-[#E5DCD0] bg-white p-4.5 shadow-2xs">
            <div className="flex items-center gap-4">
              <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[#7D4F39] to-[#643B28] text-white text-xl font-bold shadow-sm">
                {currentUser?.email ? currentUser.email[0].toUpperCase() : "U"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-[#1E1B18]">
                    {currentUser?.full_name || currentUser?.email?.split("@")[0] || "Guest Researcher"}
                  </h3>
                  <span className="rounded-full bg-[#F1EDE6] border border-[#7D4F39]/30 px-2 py-0.5 text-[10px] font-bold text-[#643B28]">
                    {currentUser?.role?.toUpperCase() || "IP APPLICANT"}
                  </span>
                </div>
                <p className="text-xs text-[#645D56] font-mono mt-0.5">{currentUser?.email}</p>
                <p className="text-[11px] text-[#8C827A] mt-1">Joined: {joinDate}</p>
              </div>
            </div>
          </div>

          {/* Statutory Query Quota */}
          <div className="rounded-2xl border border-[#E5DCD0] bg-[#FAF7F2]/50 p-4">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-[#1E1B18]">Daily Statutory Query Limit</span>
              <span className="text-[#C86D3B]">Active Plan: Unlimited Beta</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5DCD0]">
              <div className="h-full w-1/4 rounded-full bg-[#7D4F39]" />
            </div>
            <p className="mt-2 text-[11px] text-[#645D56]">
              RAG queries against Indian Patents Act 1970, Trade Marks Act 1999 &amp; TKDL are rate-guarded at 5 requests/sec with live streaming.
            </p>
          </div>

          {/* Legal Knowledge Base Status */}
          <div className="rounded-2xl border border-[#E5DCD0] bg-white p-4 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#8C827A]">
              Knowledge Base &amp; Regulatory Corpus
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-[#FBF9F5] p-2.5 border border-[#E5DCD0]">
                <div className="text-[10px] text-[#8C827A]">Total Indexed Chunks</div>
                <div className="font-bold text-[#1E1B18] text-sm">18,518 Chunks</div>
              </div>
              <div className="rounded-xl bg-[#FBF9F5] p-2.5 border border-[#E5DCD0]">
                <div className="text-[10px] text-[#8C827A]">Jurisdiction Coverage</div>
                <div className="font-bold text-[#7D4F39] text-sm">India + WIPO/PCT</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-[#E5DCD0]">
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition cursor-pointer"
            >
              Sign Out of Account
            </button>
            <button
              onClick={onClose}
              className="rounded-xl bg-[#7D4F39] px-5 py-2 text-xs font-bold text-white hover:bg-[#643B28] transition shadow-xs cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
