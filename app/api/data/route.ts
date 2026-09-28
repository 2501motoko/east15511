import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { getCurrentMember, isMember, type Member } from "../../lib/auth";

const json = (data: unknown, status = 200) => Response.json(data, { status });
const bad = (message: string, status = 400) => json({ error: message }, status);
const now = () => new Date().toISOString();

export async function GET() {
  const current = await getCurrentMember();
  let member: Member | null;
  if (isMember(current)) member = current;
  else if (current.status === 401 || current.status === 403) member = null;
  else return current;
  try {
    const db = createSupabaseAdminClient();
    const calendarQuery = db.from("calendar_items").select("*");
    if (member) calendarQuery.or("is_public.eq.true,owner_id.eq." + member.id);
    else calendarQuery.eq("is_public", true);
    const sportsQuery = db.from("sport_logs").select("*");
    if (member) sportsQuery.or("is_public.eq.true,owner_id.eq." + member.id);
    else sportsQuery.eq("is_public", true);
    const [coursesQ, resourcesQ, calendarQ, dutiesQ, sportsQ, memoriesQ, membersQ, topicsQ, teaPostsQ] = await Promise.all([
      db.from("courses").select("id,name").order("name"),
      db.from("resources").select("*").order("created_at", { ascending: false }),
      calendarQuery.order("item_date").order("due_time").order("start_time"),
      db.from("duty_rota").select("*").order("duty_date"),
      sportsQuery.order("activity_date", { ascending: false }),
      db.from("memories").select("*").order("created_at", { ascending: false }),
      db.from("members").select("id,display_name,role").order("display_name"),
      db.from("tea_topics").select("*").order("updated_at", { ascending: false }),
      db.from("tea_posts").select("*").order("created_at"),
    ]);
    const queries = [coursesQ, resourcesQ, calendarQ, dutiesQ, sportsQ, memoriesQ, membersQ, topicsQ, teaPostsQ];
    const failure = queries.find((q) => q.error)?.error;
    if (failure) throw failure;
    const inviteQ = member?.role === "admin"
      ? await db.from("member_invites").select("email,role,active").order("email")
      : { data: [], error: null };
    if (inviteQ.error) throw inviteQ.error;

    const courses = coursesQ.data ?? [];
    const members = membersQ.data ?? [];
    const courseNames = new Map(courses.map((row) => [row.id, row.name]));
    const memberNames = new Map(members.map((row) => [row.id, row.display_name]));
    return json({
      member: member ? { id: member.id, displayName: member.display_name, role: member.role } : { id: "", displayName: "访客", role: "guest" },
      courses,
      resources: (resourcesQ.data ?? []).map((row) => ({
        id: row.id, courseId: row.course_id, course: courseNames.get(row.course_id) ?? "",
        title: row.title, fileName: row.file_name, contentType: row.content_type, size: row.size,
        uploaderId: row.uploader_id, uploader: memberNames.get(row.uploader_id) ?? "宿舍成员",
        createdAt: row.created_at,
      })),
      calendar: (calendarQ.data ?? []).map((row) => ({
        id: row.id, kind: row.kind, title: row.title, courseId: row.course_id,
        course: row.course_id ? courseNames.get(row.course_id) ?? null : null, date: row.item_date,
        dueTime: row.due_time ? String(row.due_time).slice(0, 5) : null,
        startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
        endTime: row.end_time ? String(row.end_time).slice(0, 5) : null,
        location: row.location, notes: row.notes, isPublic: row.is_public,
        ownerId: row.owner_id, owner: memberNames.get(row.owner_id) ?? "宿舍成员",
      })),
      duties: (dutiesQ.data ?? []).map((row) => ({
        id: row.id, date: row.duty_date, garbageMemberId: row.garbage_member_id,
        sweepMemberId: row.sweep_member_id, garbageDone: row.garbage_done, sweepDone: row.sweep_done,
        garbageDoneBy: row.garbage_done_by, sweepDoneBy: row.sweep_done_by,
        garbageName: row.garbage_member_id ? memberNames.get(row.garbage_member_id) ?? null : null,
        sweepName: row.sweep_member_id ? memberNames.get(row.sweep_member_id) ?? null : null,
      })),
      sports: (sportsQ.data ?? []).map((row) => ({
        id: row.id, activityType: row.activity_type, durationMinutes: row.duration_minutes,
        date: row.activity_date, isPublic: row.is_public, ownerId: row.owner_id,
        owner: memberNames.get(row.owner_id) ?? "宿舍成员",
      })),
      memories: (memoriesQ.data ?? []).map((row) => ({
        id: row.id, caption: row.caption, date: row.memory_date, fileName: row.file_name,
        contentType: row.content_type, size: row.size, uploaderId: row.uploader_id,
        uploader: memberNames.get(row.uploader_id) ?? "宿舍成员", createdAt: row.created_at,
      })),
      members: member ? members.map((row) => ({ id: row.id, displayName: row.display_name, role: row.role })) : [],
      invites: member?.role === "admin" ? inviteQ.data ?? [] : [],
      teaTopics: (topicsQ.data ?? []).map((row) => ({
        id: row.id, title: row.title, description: row.description, ownerId: row.owner_id,
        owner: memberNames.get(row.owner_id) ?? "宿舍成员", createdAt: row.created_at, updatedAt: row.updated_at,
      })),
      teaPosts: (teaPostsQ.data ?? []).map((row) => ({
        id: row.id, topicId: row.topic_id, parentId: row.parent_id, content: row.content,
        ownerId: row.owner_id, owner: memberNames.get(row.owner_id) ?? "宿舍成员", createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Data load failed", error);
    return bad("共享数据暂时无法读取，请检查 Supabase 配置后重试。", 503);
  }
}

export async function POST(request: Request) {
  const member = await getCurrentMember();
  if (!isMember(member)) return member;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return bad("请求格式不正确。"); }
  const db = createSupabaseAdminClient();
  const action = typeof body.action === "string" ? body.action : "";
  const str = (key: string, max = 500) =>
    typeof body[key] === "string" ? String(body[key]).trim().slice(0, max) : "";
  const needAdmin = () => member.role === "admin" ? null : bad("这项操作仅管理员可用。", 403);
  const isDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z"));
  const fail = (error: { code?: string; message?: string } | null, duplicate = "已有相同名称或同一天的记录。") => {
    if (!error) return null;
    if (error.code === "23505") return bad(duplicate, 409);
    if (error.code === "23503") return bad("请先选择有效的课程或成员。");
    console.error("Data write failed", action, error);
    return bad("保存失败，请检查填写内容后重试。", 503);
  };
  try {
    if (action === "addCourse") {
      const denied = needAdmin(); if (denied) return denied;
      const name = str("name", 80); if (!name) return bad("请填写课程名称。");
      const result = await db.from("courses").insert({ name, created_by: member.id });
      return fail(result.error, "这个课程标签已经存在。") ?? json({ ok: true }, 201);
    }
    if (action === "deleteCourse") {
      const denied = needAdmin(); if (denied) return denied;
      const id = str("id", 80);
      const [resources, items] = await Promise.all([
        db.from("resources").select("id", { count: "exact", head: true }).eq("course_id", id),
        db.from("calendar_items").select("id", { count: "exact", head: true }).eq("course_id", id),
      ]);
      if (resources.error || items.error) throw resources.error ?? items.error;
      if ((resources.count ?? 0) + (items.count ?? 0) > 0) return bad("这门课已有资料或 DDL，不能删除。", 409);
      const result = await db.from("courses").delete().eq("id", id);
      return fail(result.error) ?? json({ ok: true });
    }
    if (action === "inviteMember") {
      const denied = needAdmin(); if (denied) return denied;
      const email = str("email", 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("请填写有效的邮箱地址。");
      if (email === process.env.DORM_ADMIN_EMAIL?.trim().toLowerCase()) return bad("管理员邮箱已自动配置。");
      const result = await db.from("member_invites").upsert(
        { email, role: "member", active: true, created_by: member.id }, { onConflict: "email" },
      );
      return fail(result.error) ?? json({ ok: true });
    }
    if (action === "removeInvite") {
      const denied = needAdmin(); if (denied) return denied;
      const email = str("email", 254).toLowerCase();
      if (email === process.env.DORM_ADMIN_EMAIL?.trim().toLowerCase()) return bad("不能移除主管理员。", 403);
      const result = await db.from("member_invites").update({ active: false }).eq("email", email);
      return fail(result.error) ?? json({ ok: true });
    }
    if (action === "addTeaTopic") {
      const title = str("title", 120), description = str("description", 1000);
      if (!title) return bad("请填写主题名称。 ");
      const result = await db.from("tea_topics").insert({ title, description: description || null, owner_id: member.id });
      return fail(result.error) ?? json({ ok: true }, 201);
    }
    if (action === "addTeaPost") {
      const topicId = str("topicId", 80), parentId = str("parentId", 80) || null, content = str("content", 5000);
      if (!topicId || !content) return bad("请选择主题并填写帖子内容。");
      if (parentId) {
        const { data: parent, error } = await db.from("tea_posts").select("id,topic_id,parent_id").eq("id", parentId).maybeSingle();
        if (error) throw error;
        if (!parent || parent.topic_id !== topicId || parent.parent_id) return bad("回复目标无效，请刷新页面后重试。", 400);
      }
      const result = await db.from("tea_posts").insert({ topic_id: topicId, parent_id: parentId, content, owner_id: member.id });
      if (result.error) return fail(result.error) ?? bad("发帖失败，请重试。", 503);
      await db.from("tea_topics").update({ updated_at: now() }).eq("id", topicId);
      return json({ ok: true }, 201);
    }
    if (action === "deleteTeaTopic") {
      const id = str("id", 80);
      const { data: row, error } = await db.from("tea_topics").select("owner_id").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!row) return bad("主题不存在。", 404);
      if (row.owner_id !== member.id && member.role !== "admin") return bad("只能删除自己创建的主题。", 403);
      const result = await db.from("tea_topics").delete().eq("id", id);
      return fail(result.error) ?? json({ ok: true });
    }
    if (action === "deleteTeaPost") {
      const id = str("id", 80);
      const { data: row, error } = await db.from("tea_posts").select("owner_id,parent_id").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!row) return bad("帖子不存在。", 404);
      if (row.owner_id !== member.id && member.role !== "admin") return bad("只能删除自己发布的帖子。", 403);
      const result = await db.from("tea_posts").delete().eq("id", id);
      return fail(result.error) ?? json({ ok: true });
    }
    if (action === "addCalendar") {
      const kind = str("kind", 16), title = str("title", 160), date = str("date", 10);
      if (!title || !isDate(date)) return bad("请填写事项名称和有效日期。");
      const courseId = str("courseId", 80) || null, dueTime = str("dueTime", 5) || null;
      const startTime = str("startTime", 5) || null, endTime = str("endTime", 5) || null;
      if (kind !== "ddl" && kind !== "activity") return bad("事项类型不正确。");
      if (kind === "ddl" && !courseId) return bad("请选择课程标签。");
      if (kind === "activity" && startTime && endTime && endTime < startTime) return bad("结束时间不能早于开始时间。");
      const result = await db.from("calendar_items").insert({
        kind, title, course_id: kind === "ddl" ? courseId : null, item_date: date,
        due_time: kind === "ddl" ? dueTime : null,
        start_time: kind === "activity" ? startTime : null,
        end_time: kind === "activity" ? endTime : null,
        location: kind === "activity" ? str("location", 160) || null : null,
        notes: str("notes", 1000) || null,
        is_public: kind === "activity" || Boolean(body.isPublic), owner_id: member.id,
      });
      return fail(result.error) ?? json({ ok: true }, 201);
    }
    if (action === "deleteCalendar" || action === "editCalendar") {
      const id = str("id", 80);
      const { data: row, error } = await db.from("calendar_items").select("owner_id,kind").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!row) return bad("日历记录不存在。", 404);
      if (row.owner_id !== member.id && member.role !== "admin") return bad("只能修改自己创建的记录。", 403);
      if (action === "deleteCalendar") {
        const result = await db.from("calendar_items").delete().eq("id", id);
        return fail(result.error) ?? json({ ok: true });
      }
      const kind = row.kind as "ddl" | "activity";
      const title = str("title", 160), date = str("date", 10);
      const courseId = str("courseId", 80) || null, dueTime = str("dueTime", 5) || null;
      const startTime = str("startTime", 5) || null, endTime = str("endTime", 5) || null;
      if (!title || !isDate(date)) return bad("请填写事项名称和有效日期。");
      if (kind === "ddl" && !courseId) return bad("请选择课程标签。");
      if (kind === "activity" && startTime && endTime && endTime < startTime) return bad("结束时间不能早于开始时间。");
      const result = await db.from("calendar_items").update({
        title, item_date: date, course_id: kind === "ddl" ? courseId : null,
        due_time: kind === "ddl" ? dueTime : null,
        start_time: kind === "activity" ? startTime : null,
        end_time: kind === "activity" ? endTime : null,
        location: kind === "activity" ? str("location", 160) || null : null,
        notes: str("notes", 1000) || null,
        is_public: kind === "activity" || Boolean(body.isPublic),
      }).eq("id", id);
      return fail(result.error) ?? json({ ok: true });
    }
    if (action === "addDuty") {
      const denied = needAdmin(); if (denied) return denied;
      const date = str("date", 10), garbage = str("garbageMemberId", 80), sweep = str("sweepMemberId", 80);
      if (!isDate(date) || !garbage || !sweep) return bad("请选择日期以及倒垃圾、扫地的值日成员。");
      const result = await db.from("duty_rota").insert({
        duty_date: date, garbage_member_id: garbage, sweep_member_id: sweep, updated_at: now(),
      });
      return fail(result.error, "这一天已有值日安排。") ?? json({ ok: true }, 201);
    }
    if (action === "toggleDuty") {
      const field = str("field", 20), id = str("id", 80), done = Boolean(body.done);
      if (field !== "garbage" && field !== "sweep") return bad("打卡项目不正确。");
      const { data: row, error } = await db.from("duty_rota").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!row) return bad("没有找到这条值日安排。", 404);
      const assigned = field === "garbage" ? row.garbage_member_id : row.sweep_member_id;
      if (member.role !== "admin" && assigned !== member.id) return bad("只有对应值日成员可以打卡。", 403);
      const result = field === "garbage"
        ? await db.from("duty_rota").update({ garbage_done: done, garbage_done_by: done ? member.id : null, updated_at: now() }).eq("id", id)
        : await db.from("duty_rota").update({ sweep_done: done, sweep_done_by: done ? member.id : null, updated_at: now() }).eq("id", id);
      return fail(result.error) ?? json({ ok: true });
    }
    if (action === "deleteDuty" || action === "editDuty") {
      const denied = needAdmin(); if (denied) return denied;
      const id = str("id", 80);
      if (action === "deleteDuty") {
        const result = await db.from("duty_rota").delete().eq("id", id);
        return fail(result.error) ?? json({ ok: true });
      }
      const date = str("date", 10), garbage = str("garbageMemberId", 80), sweep = str("sweepMemberId", 80);
      if (!isDate(date) || !garbage || !sweep) return bad("请选择日期以及两项值日成员。");
      const { data: current, error } = await db.from("duty_rota").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!current) return bad("没有找到这条值日安排。", 404);
      const result = await db.from("duty_rota").update({
        duty_date: date, garbage_member_id: garbage, sweep_member_id: sweep,
        garbage_done: current.garbage_member_id === garbage ? current.garbage_done : false,
        garbage_done_by: current.garbage_member_id === garbage ? current.garbage_done_by : null,
        sweep_done: current.sweep_member_id === sweep ? current.sweep_done : false,
        sweep_done_by: current.sweep_member_id === sweep ? current.sweep_done_by : null,
        updated_at: now(),
      }).eq("id", id);
      return fail(result.error, "这一天已有值日安排。") ?? json({ ok: true });
    }
    if (action === "addSport") {
      const date = str("date", 10), type = str("activityType", 80) || null, raw = body.durationMinutes;
      const duration = raw === "" || raw == null ? null : Number(raw);
      if (!isDate(date)) return bad("请填写有效的运动日期。");
      if (duration !== null && (!Number.isInteger(duration) || duration < 1 || duration > 1440)) return bad("运动时长需为 1 到 1440 分钟。");
      const result = await db.from("sport_logs").insert({
        activity_date: date, activity_type: type, duration_minutes: duration,
        is_public: Boolean(body.isPublic), owner_id: member.id,
      });
      return fail(result.error) ?? json({ ok: true }, 201);
    }
    if (action === "deleteSport" || action === "editSport") {
      const id = str("id", 80);
      const { data: row, error } = await db.from("sport_logs").select("owner_id").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!row) return bad("没有找到这条运动打卡。", 404);
      if (row.owner_id !== member.id && member.role !== "admin") return bad("只能修改自己的打卡。", 403);
      if (action === "deleteSport") {
        const result = await db.from("sport_logs").delete().eq("id", id);
        return fail(result.error) ?? json({ ok: true });
      }
      const date = str("date", 10), type = str("activityType", 80) || null, raw = body.durationMinutes;
      const duration = raw === "" || raw == null ? null : Number(raw);
      if (!isDate(date)) return bad("请填写有效的运动日期。");
      if (duration !== null && (!Number.isInteger(duration) || duration < 1 || duration > 1440)) return bad("运动时长需为 1 到 1440 分钟。");
      const result = await db.from("sport_logs").update({
        activity_date: date, activity_type: type, duration_minutes: duration, is_public: Boolean(body.isPublic),
      }).eq("id", id);
      return fail(result.error) ?? json({ ok: true });
    }
    if (action === "editResource" || action === "deleteResource") {
      const id = str("id", 80);
      const { data: row, error } = await db.from("resources").select("uploader_id,object_key").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!row) return bad("资料不存在。", 404);
      if (row.uploader_id !== member.id && member.role !== "admin") return bad("只能修改自己上传的资料。", 403);
      if (action === "editResource") {
        const courseId = str("courseId", 80), title = str("title", 160);
        if (!title || !courseId) return bad("请填写资料名称并选择课程。");
        const result = await db.from("resources").update({ course_id: courseId, title }).eq("id", id);
        return fail(result.error) ?? json({ ok: true });
      }
      const removed = await db.storage.from("course-files").remove([row.object_key]);
      if (removed.error) throw removed.error;
      const result = await db.from("resources").delete().eq("id", id);
      return fail(result.error) ?? json({ ok: true });
    }
    if (action === "editMemory" || action === "deleteMemory") {
      const id = str("id", 80);
      const { data: row, error } = await db.from("memories").select("uploader_id,object_key").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!row) return bad("照片不存在。", 404);
      if (row.uploader_id !== member.id && member.role !== "admin") return bad("只能修改自己上传的照片。", 403);
      if (action === "editMemory") {
        const date = str("date", 10) || null;
        if (date && !isDate(date)) return bad("日期格式不正确。");
        const result = await db.from("memories").update({
          caption: str("caption", 500) || null, memory_date: date,
        }).eq("id", id);
        return fail(result.error) ?? json({ ok: true });
      }
      const removed = await db.storage.from("dorm-photos").remove([row.object_key]);
      if (removed.error) throw removed.error;
      const result = await db.from("memories").delete().eq("id", id);
      return fail(result.error) ?? json({ ok: true });
    }
    return bad("不支持的操作。");
  } catch (error) {
    console.error("Data write failed", action, error);
    return bad("保存失败，请检查填写内容后重试。", 503);
  }
}
