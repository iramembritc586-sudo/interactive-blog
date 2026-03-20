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
        </div>
      </section>
    </main>
  );
}
