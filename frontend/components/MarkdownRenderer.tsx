"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
}

// Canonical official portals map to prevent 404s
const OFFICIAL_URL_MAP: Record<string, string> = {
  ipindia: "https://ipindia.gov.in",
  inpass: "https://ipindiaservices.gov.in/publicsearch",
  tkdl: "https://www.tkdl.res.in",
  ayush: "https://ayush.gov.in",
  wipo: "https://www.wipo.int",
  cdsco: "https://cdsco.gov.in",
  copyright: "https://copyright.gov.in",
};

function formatSafeHref(rawHref?: string): string {
  if (!rawHref) return "#";
  let href = rawHref.trim();

  // If link is a relative or bare domain like "ipindia.gov.in"
  if (!href.startsWith("http://") && !href.startsWith("https://") && !href.startsWith("mailto:")) {
    // Check if it matches any official portal keyword
    const lower = href.toLowerCase();
    for (const [key, targetUrl] of Object.entries(OFFICIAL_URL_MAP)) {
      if (lower.includes(key)) {
        return targetUrl;
      }
    }
    href = "https://" + href;
  }

  // Sanitize broken or internal 404 paths
  if (href.includes("localhost") || href.includes("127.0.0.1")) {
    return "https://ipindia.gov.in";
  }

  return href;
}

export default function MarkdownRenderer({ content, isUser = false }: MarkdownRendererProps) {
  if (isUser) {
    return <div className="whitespace-pre-line leading-relaxed text-[#0F1F15] font-medium">{content}</div>;
  }

  return (
    <div className="markdown-content text-sm leading-relaxed text-[#0F1F15] space-y-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-4 mb-2 text-lg font-bold text-[#638C6D] border-b border-[#E6E5DD] pb-1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-3.5 mb-1.5 text-base font-bold text-[#638C6D]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 mb-1 text-xs font-bold uppercase tracking-wider text-[#C84C05]">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-[#414942]">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-bold text-[#0F1F15]">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-[#727971]">{children}</em>,
          ul: ({ children }) => (
            <ul className="my-2.5 list-disc pl-5 space-y-1 text-[#414942]">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2.5 list-decimal pl-5 space-y-1 text-[#414942]">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          hr: () => <hr className="my-3 border-[#E6E5DD]" />,
          blockquote: ({ children }) => (
            <div className="my-3 bg-[#FFFDE7]/60 border-l-4 border-[#C84C05] p-4 rounded-r-lg">
              <div className="font-statutory text-base text-[#C84C05] leading-relaxed italic">{children}</div>
            </div>
          ),
          a: ({ href, children }) => {
            const safeHref = formatSafeHref(href);
            return (
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#638C6D] underline decoration-[#638C6D]/40 underline-offset-2 transition hover:text-[#3D6448]"
                title={`Open official portal: ${safeHref}`}
              >
                {children} ↗
              </a>
            );
          },
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-[#E6E5DD] bg-white shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#FFFDE7] text-[#638C6D] uppercase text-[11px] font-bold border-b border-[#E6E5DD]">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="p-3 font-bold tracking-wider">{children}</th>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-[#E6E5DD]/50 text-[#0F1F15]">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-[#FFFDE7] transition-colors">{children}</tr>
          ),
          td: ({ children }) => <td className="p-3 align-top text-[#414942]">{children}</td>,
          code: ({ children }) => (
            <code className="rounded bg-[#E5F9E7] px-1.5 py-0.5 text-xs font-mono text-[#3D6448] border border-[#D4E7D6]">
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
