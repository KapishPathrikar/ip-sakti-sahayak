"use client";

import React, { useState } from "react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (token: string, user: any) => void;
}

const apiBaseUrl = "";

export default function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const payload = isLogin
        ? { email, password }
        : { email, password, full_name: fullName || undefined };

      const res = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed.");
      }

      localStorage.setItem("ip_shakti_token", data.access_token);
      localStorage.setItem("ip_shakti_user", JSON.stringify(data.user));
      onAuthSuccess(data.access_token, data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl border border-[#E5DCBF] bg-[#FFFEFA] p-6 text-[#182C22] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E5DCBF] pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <h2 className="text-xl font-black text-[#285943]">
              {isLogin ? "Sign In to IP-SAKTI" : "Create IP-SAKTI Account"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-[#FAF6ED] p-1.5 text-[#7A5135] hover:bg-[#E5DCBF] hover:text-[#182C22] transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#7A5135]">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Dr. Rajesh Sharma"
                className="mt-1.5 w-full rounded-xl border border-[#E5DCBF] bg-[#FAF6ED] p-3 text-sm text-[#182C22] placeholder-[#7E9086] outline-none focus:border-[#285943] focus:ring-1 focus:ring-[#285943]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#7A5135]">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="mt-1.5 w-full rounded-xl border border-[#E5DCBF] bg-[#FAF6ED] p-3 text-sm text-[#182C22] placeholder-[#7E9086] outline-none focus:border-[#285943] focus:ring-1 focus:ring-[#285943]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#7A5135]">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-xl border border-[#E5DCBF] bg-[#FAF6ED] p-3 text-sm text-[#182C22] placeholder-[#7E9086] outline-none focus:border-[#285943] focus:ring-1 focus:ring-[#285943]"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#285943] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1E4433] disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account (50 queries/day)"}
            </button>
          </div>
        </form>

        <div className="mt-5 border-t border-[#E5DCBF] pt-4 text-center text-sm text-[#56685E]">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="font-bold text-[#285943] hover:text-[#1E4433] hover:underline"
          >
            {isLogin ? "Register for Free" : "Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}
