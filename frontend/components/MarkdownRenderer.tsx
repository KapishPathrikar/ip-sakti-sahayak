"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
}

export default function MarkdownRenderer({ content, isUser = false }: MarkdownRendererProps) {
  if (isUser) {
    return <div className="whitespace-pre-line leading-relaxed">{content}</div>;
  }

  return (
    <div className="markdown-content text-sm leading-relaxed text-slate-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-4 mb-2 text-lg font-extrabold text-white border-b border-slate-700/60 pb-1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-3.5 mb-1.5 text-base font-bold text-slate-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 mb-1 text-sm font-bold uppercase tracking-wider text-blue-300">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-bold text-white">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
          ul: ({ children }) => (
            <ul className="my-2.5 list-disc pl-5 space-y-1 text-slate-300">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2.5 list-decimal pl-5 space-y-1 text-slate-300">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          hr: () => <hr className="my-3 border-slate-700/80" />,
          blockquote: ({ children }) => (
            <blockquote className="my-2.5 border-l-4 border-blue-500 bg-blue-950/20 pl-3 py-1 text-slate-300 italic">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-400 underline decoration-blue-500/40 underline-offset-2 transition hover:text-blue-300"
            >
              {children} ↗
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/60">
              <table className="w-full text-left text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#121824] text-blue-300 uppercase text-[11px] font-bold border-b border-slate-700">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 font-bold tracking-wider">{children}</th>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-800 text-slate-300">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-800/40 transition">{children}</tr>
          ),
          td: ({ children }) => <td className="px-3.5 py-2.5 align-top">{children}</td>,
          code: ({ children }) => (
            <code className="rounded bg-slate-900 px-1.5 py-0.5 text-xs font-mono text-amber-300 border border-slate-800">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
