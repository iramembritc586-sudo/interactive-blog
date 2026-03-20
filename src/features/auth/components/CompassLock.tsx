"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildRotationStep,
  demoCredentials,
  matchSequence,
  type RotationStep,
} from "@/src/features/auth/lib/compassPassword";

type LockState = "idle" | "recording" | "recognizing" | "failure" | "success";

type CompassLockProps = {
  username: string;
};

const ringSegments = 48;
const stroke = 2 * Math.PI * 168;

export default function CompassLock({ username }: CompassLockProps) {
  const router = useRouter();
  const [rotation, setRotation] = useState(0);
  const [steps, setSteps] = useState<RotationStep[]>([]);
  const [state, setState] = useState<LockState>("idle");
  const [pulseSeed, setPulseSeed] = useState(0);
  const centerRef = useRef<{ x: number; y: number } | null>(null);
  const pointerAngleRef = useRef<number | null>(null);
  const accumRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepsRef = useRef<RotationStep[]>([]);
  const usernameRef = useRef(username);

  const ringClassName = useMemo(() => {
    switch (state) {
      case "recognizing":
        return "compass-ring compass-ring--scan";
      case "failure":
        return "compass-ring compass-ring--failure";
      case "success":
        return "compass-ring compass-ring--success";
      default:
        return "compass-ring";
    }
  }, [state]);

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, []);

  const scheduleRecognition = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = setTimeout(() => {
      void recognizePassword();
    }, 850);
  };

  const resetLock = () => {
    accumRef.current = 0;
    pointerAngleRef.current = null;
    setRotation(0);
    stepsRef.current = [];
    setSteps([]);
    setState("idle");
  };

  const recognizePassword = async () => {
    if (!stepsRef.current.length || state === "success") {
      return;
    }

    setState("recognizing");
    await new Promise((resolve) => setTimeout(resolve, 1400));

    const matched =
      usernameRef.current.trim().toLowerCase() === demoCredentials.username &&
      matchSequence(stepsRef.current, demoCredentials.sequence);

    if (matched) {
      setPulseSeed((value) => value + 1);
      setState("success");
      setTimeout(() => {
        router.push("/");
      }, 1700);
      return;
    }

    setState("failure");
    setTimeout(() => {
      resetLock();
    }, 1600);
  };

  const finalizeStep = () => {
    const nextStep = buildRotationStep(accumRef.current);
    accumRef.current = 0;
    if (!nextStep) {
      return;
    }

    setSteps((current) => {
      const updated = [...current, nextStep];
      stepsRef.current = updated;
      return updated;
    });
    setState("recording");
    scheduleRecognition();
  };

  const readAngle = (clientX: number, clientY: number) => {
    if (!centerRef.current) {
      return 0;
    }

    return (
      (Math.atan2(clientY - centerRef.current.y, clientX - centerRef.current.x) * 180) /
      Math.PI
    );
  };

  const beginGesture = (clientX: number, clientY: number, element: HTMLDivElement) => {
    const rect = element.getBoundingClientRect();
    centerRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    pointerAngleRef.current = readAngle(clientX, clientY);
    if (state === "idle") {
      setState("recording");
    }
  };

  const moveGesture = (clientX: number, clientY: number) => {
    const nextAngle = readAngle(clientX, clientY);
    const previousAngle = pointerAngleRef.current;
    if (previousAngle === null) {
      pointerAngleRef.current = nextAngle;
      return;
    }

    let delta = nextAngle - previousAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    accumRef.current += delta;
    setRotation((current) => current + delta);
    pointerAngleRef.current = nextAngle;
  };

  const releaseGesture = () => {
    pointerAngleRef.current = null;
    finalizeStep();
  };

  return (
    <div className="relative flex flex-col items-center gap-10">
      <div className="compass-shell">
        <div
          className={ringClassName}
          onPointerDown={(event) => {
            beginGesture(event.clientX, event.clientY, event.currentTarget as HTMLDivElement);
            (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!(event.currentTarget as HTMLDivElement).hasPointerCapture(event.pointerId)) {
              return;
            }
            moveGesture(event.clientX, event.clientY);
          }}
          onPointerUp={(event) => {
            if ((event.currentTarget as HTMLDivElement).hasPointerCapture(event.pointerId)) {
              (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
            }
            releaseGesture();
          }}
          onPointerCancel={releaseGesture}
        >
          <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="compassMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f6efe2" stopOpacity="0.9" />
                <stop offset="45%" stopColor="#8d7652" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#c6ab73" stopOpacity="0.88" />
              </linearGradient>
            </defs>
            <circle cx="200" cy="200" r="168" className="compass-outline" />
            <circle
              cx="200"
              cy="200"
              r="168"
              fill="none"
              stroke="url(#compassMetal)"
              strokeWidth="4"
              strokeDasharray={`${stroke / 30} ${stroke / 75}`}
              strokeLinecap="round"
            />
            {[...Array(16)].map((_, index) => {
              const angle = (index / 16) * Math.PI * 2;
              const x1 = 200 + Math.cos(angle) * 126;
              const y1 = 200 + Math.sin(angle) * 126;
              const x2 = 200 + Math.cos(angle) * 156;
              const y2 = 200 + Math.sin(angle) * 156;
              return (
                <line
                  key={index}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  className="compass-tick"
                />
              );
            })}
          </svg>

          <div className="compass-outer-shadow" />
          <div className="compass-face" style={{ transform: `rotate(${rotation}deg)` }}>
            <div className="compass-orbit compass-orbit--outer" />
            <div className="compass-orbit compass-orbit--mid" />
            <div className="compass-needle compass-needle--north" />
            <div className="compass-needle compass-needle--south" />
            <div className="compass-center" />
            <div className="compass-glyph compass-glyph--top">北</div>
            <div className="compass-glyph compass-glyph--right">東</div>
            <div className="compass-glyph compass-glyph--bottom">南</div>
            <div className="compass-glyph compass-glyph--left">西</div>
          </div>

          <div className="compass-segments" aria-hidden="true">
            {[...Array(ringSegments)].map((_, index) => (
              <span
                key={index}
                className="compass-segment"
                style={{
                  transform: `rotate(${index * (360 / ringSegments)}deg) translateY(-184px)`,
                  animationDelay: `${index * 40}ms`,
                }}
              />
            ))}
          </div>

          {state === "success" && (
            <div key={pulseSeed} className="compass-success-burst" aria-hidden="true">
              {[...Array(18)].map((_, index) => (
                <span
                  key={index}
                  className="compass-success-ray"
                  style={{
                    transform: `rotate(${index * 20}deg)`,
                    animationDelay: `${(index % 6) * 90}ms`,
                    height: `${110 + ((index * 17) % 55)}px`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}