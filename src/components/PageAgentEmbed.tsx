"use client";

import Script from "next/script";

const defaultScriptUrl =
  "https://cdn.jsdelivr.net/npm/page-agent@1.6.0/dist/iife/page-agent.demo.js";

const scriptUrl =
  process.env.NEXT_PUBLIC_PAGE_AGENT_SCRIPT_URL?.trim() || defaultScriptUrl;

const enabled =
  process.env.NEXT_PUBLIC_ENABLE_PAGE_AGENT?.toLowerCase() !== "false";

export default function PageAgentEmbed() {
  if (!enabled) {
    return null;
  }

  return (
    <Script
      src={scriptUrl}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
