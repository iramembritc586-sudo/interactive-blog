"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

const PhaserIntro = dynamic(
  () => import("@/src/features/intro-scene/components/PhaserIntro"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center bg-[#0a0806] text-sm text-neutral-400">
        Loading scene…
      </div>
    ),
  }
);

export default function HomePage() {
  const [entered, setEntered] = useState(false);

  const handleEnter = useCallback(() => {
    setEntered(true);
  }, []);

  useEffect(() => {
    if (entered) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [entered]);

  return (
    <main className="relative w-full">
      <div
        className={`fixed inset-0 z-20 transition-transform duration-700 ease-in-out ${
          entered ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <PhaserIntro onEnter={handleEnter} />
      </div>

      <section className="relative z-10 min-h-screen bg-white px-6 py-16 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-4 text-4xl font-bold tracking-tight">欢迎</h1>
          <p className="mb-4 text-lg text-neutral-600 dark:text-neutral-400">
            这是个人首页正文区。从互动序章进入后，可向下滚动浏览站点内容。
          </p>
          <p className="text-neutral-600 dark:text-neutral-400">
            使用顶部导航访问 About、Blog、Projects 与 Contact。
          </p>
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-sm text-emerald-950 shadow-sm dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100">
            <p className="font-semibold">Page Agent 已接入</p>
            <p className="mt-2 leading-6 text-emerald-900/80 dark:text-emerald-100/80">
              页面右下角会在脚本加载后出现 Page Agent 控件。你可以直接输入自然语言，
              让它帮你点击导航、浏览页面内容或执行基础网页交互。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
