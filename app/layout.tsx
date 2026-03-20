import type { Metadata } from "next";
import SiteNav from "@/src/components/SiteNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Interactive Blog",
  description: "个人博客与全屏 Phaser 互动序章",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
