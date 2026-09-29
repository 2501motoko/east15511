import { createSupabaseAdminClient } from "./supabase/admin";
import { createSupabaseServerClient } from "./supabase/server";
import { accountUsername, getLoginAccounts, studentNumberFromEmail } from "./login-accounts";

export type Member = {
  id: string;
  email: string;
  display_name: string;
  role: "admin" | "member";
};

export async function getCurrentMember(): Promise<Member | Response> {
  try {
    const auth = await createSupabaseServerClient();
    const { data, error } = await auth.auth.getUser();
    const user = data.user;
    if (error || !user?.email) return Response.json({ error: "请先登录。" }, { status: 401 });

    const email = user.email.trim().toLowerCase();
    const username = studentNumberFromEmail(email);
    const account = username ? getLoginAccounts()?.[username] : null;
    if (!username || !account || !["admin", "member"].includes(account.role)) {
      return Response.json({ error: "这个账号没有访问权限。" }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    const displayName = accountUsername(username, account);
    const { data: member, error: memberError } = await admin
      .from("members")
      .upsert(
        { id: user.id, email, display_name: displayName, role: account.role },
        { onConflict: "id" },
      )
      .select("id,email,display_name,role")
      .single();
    if (memberError) throw memberError;
    return member as Member;
  } catch (error) {
    console.error("Member authentication failed", error);
    return Response.json({ error: "登录服务暂不可用，请检查 Supabase 配置。" }, { status: 503 });
  }
}

export function displayNameForEmail(email: string) {
  const studentId = studentNumberFromEmail(email.trim().toLowerCase());
  if (!studentId) return "宿舍成员";
  return accountUsername(studentId, getLoginAccounts()?.[studentId]);
}

export function isMember(value: Member | Response): value is Member {
  return !(value instanceof Response);
}
