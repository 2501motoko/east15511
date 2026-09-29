"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "登录失败，请重试。");
      router.push("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-screen">
    <section className="auth-card">
      <div className="brand-mark">511</div>
      <p className="eyebrow">WUYIYI STUDIO</p>
      <h1>登录吾一一事务所</h1>
      <p className="muted">输入学号和密码，即可参与编辑和讨论。</p>
      <form onSubmit={signIn} className="login-form">
        <label htmlFor="username">学号</label>
        <input id="username" name="username" type="text" inputMode="numeric" autoComplete="username"
          pattern="[0-9]{11}" maxLength={11} value={username}
          onChange={(event) => setUsername(event.target.value)} required />
        <label htmlFor="password">密码</label>
        <input id="password" name="password" type="password" autoComplete="current-password"
          maxLength={128} value={password}
          onChange={(event) => setPassword(event.target.value)} required />
        <button className="primary-button sign-in" disabled={busy}>
          {busy ? "登录中…" : "登录"}
        </button>
      </form>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <p className="muted login-footnote">初始密码为学号后六位。忘记密码或无法登录，请联系管理员。</p>
    </section>
  </main>;
}
