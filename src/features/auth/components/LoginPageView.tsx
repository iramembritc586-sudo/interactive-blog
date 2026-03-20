"use client";

import Link from "next/link";
import { useState } from "react";
import CompassLock from "@/src/features/auth/components/CompassLock";

export default function LoginPageView() {
  const [username, setUsername] = useState("");

  return (
    <main className="auth-page auth-page--login">
      <div className="auth-page__veil" />
      <section className="auth-page__panel">
        <div className="auth-page__copy">
          <p className="auth-page__eyebrow">Ritual Gate</p>
          <h1 className="auth-page__title">Turn the hidden path until the compass remembers you.</h1>
        </div>

        <label className="auth-input-wrap">
          <span className="sr-only">Username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username"
            className="auth-input"
            autoComplete="username"
          />
        </label>

        <CompassLock username={username} />

        <div className="auth-page__actions">
          <Link href="/register" className="auth-link auth-link--secondary">
            New user? Register
          </Link>
        </div>
      </section>
    </main>
  );
}
