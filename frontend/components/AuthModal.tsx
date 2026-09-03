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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      {/* Sleek blurred backdrop */}
      <div 
        className="absolute inset-0 bg-[#FAFAF5]/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-[400px] overflow-hidden rounded-3xl bg-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-[#E5F9E7] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top decorative gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#638C6D] via-[#A8CBAF] to-[#638C6D]" />

        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div className="flex flex-col">
              <img
                alt="IP-SAKTI Logo"
                className="w-10 h-10 object-contain rounded-xl shadow-sm mb-4"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD9lk-V00H9o6k4G8IJexs3h2HKtANXj1QbDFLg7zaEe9wqSfHBzzjJH-LK4bW7AifHooA2M-6Qs-2kcjNwn6yZ9kGlEi7bCY8HZ7wybNCyD1uRoHdhDFADexqiPgjD1q3YVMytPsH4R24-PNkIXM0imI3dbAfyg7wK3pnsUqz0bCsrNDBfyExM3yORSpI2EytQW0a8LVx4PohstAs0IiiEAGZJb6XhOEzOawe5jS7qjW8SoulSf-nfxA"
              />
              <h2 className="text-2xl font-bold text-[#1B2B20] tracking-tight">
                {isLogin ? "Welcome back" : "Create an account"}
              </h2>
              <p className="text-sm text-[#727971] mt-1">
                {isLogin 
                  ? "Enter your details to access IP-SAKTI." 
                  : "Sign up to start using the AI legal suite."}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[#727971] hover:text-[#1B2B20] hover:bg-[#FAFAF5] rounded-full p-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-[#FFDAD6]/50 p-3 text-sm text-[#BA1A1A] border border-[#FFDAD6] flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-[#414942] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Sharma"
                  className="w-full rounded-xl border border-[#E0E5E0] bg-[#FAFAF5] px-3.5 py-2.5 text-sm text-[#1B2B20] placeholder:text-[#A0A8A0] outline-none focus:border-[#638C6D] focus:ring-1 focus:ring-[#638C6D] transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#414942] mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[#E0E5E0] bg-[#FAFAF5] px-3.5 py-2.5 text-sm text-[#1B2B20] placeholder:text-[#A0A8A0] outline-none focus:border-[#638C6D] focus:ring-1 focus:ring-[#638C6D] transition-all"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-[#414942]">
                  Password
                </label>
                {isLogin && (
                  <a href="#" className="text-xs text-[#638C6D] font-medium hover:underline">
                    Forgot password?
                  </a>
                )}
              </div>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#E0E5E0] bg-[#FAFAF5] px-3.5 py-2.5 text-sm text-[#1B2B20] placeholder:text-[#A0A8A0] outline-none focus:border-[#638C6D] focus:ring-1 focus:ring-[#638C6D] transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#638C6D] py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#557E60] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer mt-2"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  Processing...
                </div>
              ) : isLogin ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[#727971]">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setFullName("");
                setPassword("");
              }}
              className="font-semibold text-[#1B2B20] hover:text-[#638C6D] transition-colors"
            >
              {isLogin ? "Sign up" : "Log in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
