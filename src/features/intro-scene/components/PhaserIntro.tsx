"use client";

import { useEffect, useRef } from "react";

export type PhaserIntroProps = {
  onEnter?: () => void;
};

export default function PhaserIntro({ onEnter }: PhaserIntroProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    let destroyed = false;

    const boot = async () => {
      const Phaser = (await import("phaser")).default;
      const { default: IntroScene, setIntroOnEnter } = await import(
        "../phaser/IntroScene"
      );
      if (destroyed || !containerRef.current) return;

      setIntroOnEnter(() => {
        onEnterRef.current?.();
      });

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        parent: containerRef.current,
        backgroundColor: "#111111",
        scene: [IntroScene],
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      };

      gameRef.current = new Phaser.Game(config);
    };

    void boot();

    const handleResize = () => {
      if (!gameRef.current) return;
      gameRef.current.scale.resize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      destroyed = true;
      window.removeEventListener("resize", handleResize);
      gameRef.current?.destroy(true);
      gameRef.current = null;
      void import("../phaser/IntroScene").then(({ setIntroOnEnter }) => {
        setIntroOnEnter(undefined);
      });
    };
  }, []);

  return <div ref={containerRef} className="h-screen w-full overflow-hidden" />;
}
