"use client";

import { useEffect, useState } from "react";

type ServiceState = "checking" | "available" | "unavailable";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function Home() {
  const [serviceState, setServiceState] = useState<ServiceState>("checking");

  useEffect(() => {
    const controller = new AbortController();

    async function checkService() {
      try {
        const response = await fetch(`${apiBaseUrl}/health`, {
          signal: controller.signal,
        });
        setServiceState(response.ok ? "available" : "unavailable");
      } catch {
        if (!controller.signal.aborted) {
          setServiceState("unavailable");
        }
      }
    }

    void checkService();
    return () => controller.abort();
  }, []);

  const statusText = {
    checking: "Checking assistant service…",
    available: "Assistant service is ready",
    unavailable: "Assistant service is not running",
  }[serviceState];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900 sm:px-10 lg:px-16">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-700 text-lg font-bold text-white">
              IP
            </div>
            <span className="text-lg font-semibold tracking-tight">Shakti Sahayak</span>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              serviceState === "available"
                ? "bg-emerald-100 text-emerald-800"
                : serviceState === "unavailable"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-200 text-slate-700"
            }`}
          >
            {statusText}
          </span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-20">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            Intellectual property guidance, made approachable
          </p>
          <h1 className="max-w-4xl text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
            Understand the next step for your idea.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            IP Shakti Sahayak will help people explore patents, trademarks, copyrights,
            and designs through grounded, plain-language answers from curated sources.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["Grounded answers", "Sources will be shown with every substantive response."],
              ["India-first", "Content will prioritise Indian IP law and official guidance."],
              ["Clear boundaries", "The assistant will explain information, not provide legal advice."],
            ].map(([title, description]) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-semibold text-slate-950">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="border-t border-slate-200 pt-5 text-sm text-slate-500">
          Phase 0 foundation · Knowledge ingestion and guided Q&amp;A are next.
        </footer>
      </div>
    </main>
  );
}
