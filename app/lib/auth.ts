import { createSupabaseAdminClient } from "./supabase/admin";
import { createSupabaseServerClient } from "./supabase/server";

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
    const admin = createSupabaseAdminClient();
    const adminEmail = process.env.DORM_ADMIN_EMAIL?.trim().toLowerCase();
    if (adminEmail && email === adminEmail) {
      const { error: seedError } = await admin.from("member_invites").upsert(
        { email, role: "admin", active: true },
        { onConflict: "email" },
      );
      if (seedError) throw seedError;
    }

    const { data: invite, error: inviteError } = await admin
      .from("member_invites")
      .select("email,role,active")
      .eq("email", email)
      .eq("active", true)
      .maybeSingle();
    if (inviteError) throw inviteError;
    if (!invite) {
      return Response.json(
        { error: "这个邮箱还没有宿舍访问权限，请联系管理员添加后再登录。" },
        { status: 403 },
      );
    }

    const metadata = user.user_metadata ?? {};
    const displayName =
      (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
      (typeof metadata.name === "string" && metadata.name.trim()) ||
      email.split("@")[0];
    const { data: member, error: memberError } = await admin
      .from("members")
      .upsert(
        { id: user.id, email, display_name: displayName, role: invite.role },
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

export function isMember(value: Member | Response): value is Member {
  return !(value instanceof Response);
}
