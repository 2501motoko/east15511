import { NextResponse } from "next/server";
import { accountUsername, getLoginAccounts, studentEmail } from "../../../lib/login-accounts";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function POST(request: Request) {
  let body: { username?: unknown; password?: unknown };
  try { body = await request.json() as { username?: unknown; password?: unknown }; }
  catch { return NextResponse.json({ error: "请输入学号和密码。" }, { status: 400 }); }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const accounts = getLoginAccounts();
  if (!accounts) return NextResponse.json({ error: "登录服务尚未配置账号，请联系管理员。" }, { status: 503 });

  const auth = await createSupabaseServerClient();
  const account = /^\d{11}$/.test(username) ? accounts[username] : undefined;
  if (!account || typeof account.password !== "string" || account.password !== password || !["admin", "member"].includes(account.role)) {
    // Route failed attempts through Supabase Auth so its auth endpoint rate limits apply.
    const failedEmail = /^\d{11}$/.test(username) ? studentEmail(username) : studentEmail(`unknown-${crypto.randomUUID()}`);
    await auth.auth.signInWithPassword({ email: failedEmail, password: password || "invalid" });
    return NextResponse.json({ error: "学号或密码不正确。" }, { status: 401 });
  }

  const email = studentEmail(username);
  const displayName = accountUsername(username, account);
  const admin = createSupabaseAdminClient();
  try {
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    const existingUser = listed.users.find((candidate) => candidate.email === email);
    if (existingUser) {
      const { error } = await admin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: displayName, username: displayName, student_id: username },
      });
      if (error) throw error;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: displayName, username: displayName, student_id: username },
      });
      if (error) {
        // Another request may have created this account at the same time.
        const { data: refreshed, error: refreshError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const racedUser = !refreshError && refreshed.users.find((candidate) => candidate.email === email);
        if (!racedUser) throw error;
        const { error: updateError } = await admin.auth.admin.updateUserById(racedUser.id, {
          password,
          email_confirm: true,
          user_metadata: { full_name: displayName, username: displayName, student_id: username },
        });
        if (updateError) throw updateError;
      } else if (!data.user) {
        throw new Error("Supabase did not return the created account.");
      }
    }

    const { error: signInError } = await auth.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    return NextResponse.json({ ok: true, role: account.role });
  } catch (error) {
    console.error("Student login failed", error);
    return NextResponse.json({ error: "登录暂时失败，请稍后重试。" }, { status: 503 });
  }
}
