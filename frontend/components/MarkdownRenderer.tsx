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
    return <div className="whitespace-pre-line leading-relaxed text-white font-medium">{content}</div>;
  }

  return (
    <div className="markdown-content text-sm leading-relaxed text-[#182C22]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-4 mb-2 text-lg font-bold text-[#285943] border-b border-[#E5DCBF] pb-1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-3.5 mb-1.5 text-base font-bold text-[#285943]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 mb-1 text-xs font-bold uppercase tracking-wider text-[#7A5135]">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-bold text-[#182C22]">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-[#56685E]">{children}</em>,
          ul: ({ children }) => (
            <ul className="my-2.5 list-disc pl-5 space-y-1 text-[#2C3E33]">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2.5 list-decimal pl-5 space-y-1 text-[#2C3E33]">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          hr: () => <hr className="my-3 border-[#E5DCBF]" />,
          blockquote: ({ children }) => (
            <blockquote className="my-2.5 border-l-4 border-[#7A5135] bg-[#F4ECE6] rounded-r-lg pl-3 py-1.5 text-[#5D3F28] italic">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#285943] underline decoration-[#8FAF8B] underline-offset-2 transition hover:text-[#1E4433]"
            >
              {children} ↗
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-[#E5DCBF] bg-[#FFFEFA] shadow-xs">
              <table className="w-full text-left text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#E9F1E8] text-[#285943] uppercase text-[11px] font-bold border-b border-[#C8DAC5]">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 font-bold tracking-wider">{children}</th>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-[#EBE4D2] text-[#2C3E33]">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-[#FAF6ED] transition">{children}</tr>
          ),
          td: ({ children }) => <td className="px-3.5 py-2.5 align-top">{children}</td>,
          code: ({ children }) => (
            <code className="rounded bg-[#FAF4E4] px-1.5 py-0.5 text-xs font-mono text-[#7A5135] border border-[#E8D2A3]">
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
