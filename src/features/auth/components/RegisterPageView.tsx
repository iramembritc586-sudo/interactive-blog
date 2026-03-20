"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildRotationStep, type RotationStep } from "@/src/features/auth/lib/compassPassword";

const presets = [
  { label: "Left full turn", value: -360 },
  { label: "Left triple turn", value: -1080 },
  { label: "Right half turn", value: 180 },
  { label: "Right full turn", value: 360 },
] as const;

export default function RegisterPageView() {
  const [username, setUsername] = useState("");
  const [sequence, setSequence] = useState<RotationStep[]>([]);

  const sequenceSummary = useMemo(
    () =>
      sequence.length
        ? sequence.map((step) => `${step.direction} ${step.turns} turn${step.turns > 1 ? "s" : ""}`).join(" → ")
        : "No compass-password sequence selected yet.",
    [sequence]
  );

  return (
    <main className="auth-page auth-page--register">
      <div className="auth-page__veil" />
      <section className="auth-page__panel auth-page__panel--wide">
        <div className="auth-page__copy">
          <p className="auth-page__eyebrow">First Passage</p>
          <h1 className="auth-page__title">Create a compass-password that feels ceremonial, precise, and unforgettable.</h1>
          <p className="auth-page__lede">
            This entrance does not use a traditional password field. Your password is a sequence of compass rotations.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="auth-card-stack">
            <section className="auth-card">
              <h2>How the compass-password works</h2>
              <ul>
                <li>Direction matters: left and right are treated as different motions.</li>
                <li>Order matters: each rotation must happen in the same sequence every time.</li>
                <li>Turn count and angle matter: a half turn, full turn, or triple turn are all distinct.</li>
                <li>The system listens for stillness and validates automatically after you stop rotating.</li>
                <li>A small tolerance helps natural motion feel smooth, while keeping the ritual precise.</li>
              </ul>
            </section>

            <section className="auth-card">
              <h2>Create a starter profile</h2>
              <label className="auth-form-field">
                <span>Username</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Choose a username"
                  className="auth-input"
                />
              </label>

              <div className="auth-form-field">
                <span>Choose your compass sequence</span>
                <div className="flex flex-wrap gap-3">
                  {presets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className="auth-chip"
                      onClick={() => {
                        const step = buildRotationStep(preset.value);
                        if (!step) return;
                        setSequence((current) => [...current, step]);
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="auth-form-field">
                <span>Current sequence</span>
                <p className="auth-sequence-preview">{sequenceSummary}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" className="auth-link auth-link--primary">
                  Save ritual profile
                </button>
                <button type="button" className="auth-link auth-link--ghost" onClick={() => setSequence([])}>
                  Reset sequence
                </button>
              </div>
            </section>
          </div>

          <aside className="auth-card auth-card--aside">
            <h2>Onboarding guidance</h2>
            <p>
              For first-time users, start with three memorable motions. Example: left 3 turns, right half turn, left 1 turn.
            </p>
            <p>
              During login, you only enter your username and rotate the compass. There is no password box, no submit button, and no hint text on the ritual screen.
            </p>
            <p>
              Once the compass senses that you have stopped moving, it reads the sequence and decides automatically.
            </p>
            <Link href="/login" className="auth-link auth-link--secondary mt-4 inline-flex">
              Return to login ritual
            </Link>
          </aside>
        </div>
      </section>
    </main>
  );
}
