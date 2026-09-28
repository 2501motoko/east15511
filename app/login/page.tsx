"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: window.location.origin + "/auth/callback",
          shouldCreateUser: true,
        },
      });
      if (authError) throw authError;
      setMessage("登录链接已发送到邮箱。请用收到邀请的邮箱打开邮件并完成登录。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "暂时无法发送登录链接。");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-screen">
    <section className="auth-card">
      <div className="brand-mark">511</div>
      <p className="eyebrow">511 SOCIOLOGY DORM</p>
      <h1>登录宿舍共享空间</h1>
      <p className="muted">网站内容可直接浏览；登录后可以参与编辑和互动。输入管理员添加过的邮箱，我们会发送一次性登录链接。</p>
      <form onSubmit={sendLink} className="login-form">
        <label htmlFor="email">邮箱地址</label>
        <input id="email" type="email" autoComplete="email" value={email}
          onChange={(event) => setEmail(event.target.value)} required />
        <button className="primary-button sign-in" disabled={busy}>
          {busy ? "发送中…" : "发送登录链接"}
        </button>
      </form>
      {message && <p className="login-success" role="status">{message}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <p className="muted login-footnote">只有宿舍管理员添加过的邮箱可以编辑内容或参与讨论。</p>
    </section>
  </main>;
}
