import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { displayNameForEmail, getCurrentMember, isMember, type Member } from "../../lib/auth";
import { accountUsername, getLoginAccounts } from "../../lib/login-accounts";

const json = (data: unknown, status = 200) => Response.json(data, { status });
const bad = (message: string, status = 400) => json({ error: message }, status);
const now = () => new Date().toISOString();
const defaultDutySchedule = [
  { weekday: 0, username: "刘佳" },
  { weekday: 1, username: "王为钧" },
  { weekday: 3, username: "谢俞淇" },
  { weekday: 5, username: "赵英" },
];
const missingTable = (error: { code?: string } | null) => Boolean(error && ["42P01", "PGRST205"].includes(error.code ?? ""));

export async function GET() {
  const current = await getCurrentMember();
  // Session lookup is optional for public reads. If it fails, continue as a
  // guest; all private queries below remain filtered to public rows only.
  const member: Member | null = isMember(current) ? current : null;
  try {
    const db = createSupabaseAdminClient();
    const calendarQuery = db.from("calendar_items").select("*");
    if (member) calendarQuery.or("is_public.eq.true,owner_id.eq." + member.id);
    else calendarQuery.eq("is_public", true);
    const sportsQuery = db.from("sport_logs").select("*");
    if (member) sportsQuery.or("is_public.eq.true,owner_id.eq." + member.id);
    else sportsQuery.eq("is_public", true);
    const [coursesQ, resourcesQ, calendarQ, dutiesQ, dutyScheduleQ, sportsQ, memoriesQ, membersQ, topicsQ, teaPostsQ] = await Promise.all([
      db.from("courses").select("id,name").order("name"),
      db.from("resources").select("*").order("created_at", { ascending: false }),
      calendarQuery.order("item_date").order("due_time").order("start_time"),
      db.from("duty_rota").select("*").order("duty_date"),
      db.from("duty_weekly_schedule").select("weekday,member_username").order("weekday"),
      sportsQuery.order("activity_date", { ascending: false }),
      db.from("memories").select("*").order("created_at", { ascending: false }),
      db.from("members").select("id,email,display_name,role").order("display_name"),
      db.from("tea_topics").select("*").order("updated_at", { ascending: false }),
      db.from("tea_posts").select("*").order("created_at"),
    ]);
    const queries = [coursesQ, resourcesQ, calendarQ, dutiesQ, sportsQ, memoriesQ, membersQ, topicsQ, teaPostsQ];
    const failure = queries.find((q) => q.error)?.error;
    if (failure) throw failure;
    if (dutyScheduleQ.error && !missingTable(dutyScheduleQ.error)) throw dutyScheduleQ.error;
    const courses = coursesQ.data ?? [];
    const members = membersQ.data ?? [];
    const courseNames = new Map(courses.map((row) => [row.id, row.name]));
    const memberNames = new Map(members.map((row) => [row.id, displayNameForEmail(row.email)]));
    const loginAccounts = getLoginAccounts() ?? {};
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
        id: row.id, date: row.duty_date,
        garbageDone: row.garbage_done, sweepDone: row.sweep_done,
      })),
      dutySchedule: dutyScheduleQ.error
        ? defaultDutySchedule
        : (dutyScheduleQ.data ?? []).map((row) => ({ weekday: row.weekday, username: row.member_username })),
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
      members: member ? members.map((row) => ({ id: row.id, displayName: displayNameForEmail(row.email), role: row.role })) : [],
      accounts: member ? Object.entries(loginAccounts).map(([studentId, account]) => ({ studentId, username: accountUsername(studentId, account), role: account.role })) : [],
      teaTopics: (topicsQ.data ?? []).map((row) => ({
        id: row.id, title: row.title, zone: row.zone, description: row.description,
        tags: row.tags ?? [], ownerId: row.owner_id,
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
    if (action === "addTeaTopic") {
      const title = str("title", 120), description = str("description", 1000);
      if (!title) return bad("请填写主题名称。 ");
      const zone = str("zone", 20);
      if (zone !== "academic" && zone !== "life") return bad("请选择学术或生活分区。");
      const tags = Array.isArray(body.tags)
        ? [...new Set(body.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim().replace(/^#+/, "").slice(0, 24)).filter(Boolean))].slice(0, 8)
        : [];
      const result = await db.from("tea_topics").insert({
        title, zone, tags, description: description || null, owner_id: member.id,
      });
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
    if (action === "setDutySchedule") {
      const weekday = Number(body.weekday);
      const username = str("username", 80);
      const configured = Object.entries(getLoginAccounts() ?? {}).some(([studentId, account]) => accountUsername(studentId, account) === username);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !username || !configured) return bad("请选择有效的星期和成员。");
      const result = await db.from("duty_weekly_schedule").upsert({ weekday, member_username: username, updated_at: now() }, { onConflict: "weekday" });
      if (missingTable(result.error)) return bad("值日排班表尚未初始化，请在 Supabase 运行 supabase/duty_calendar.sql。", 503);
      return fail(result.error) ?? json({ ok: true });
    }
    if (action === "deleteDutySchedule") {
      const weekday = Number(body.weekday);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return bad("请选择有效的星期。");
      const result = await db.from("duty_weekly_schedule").delete().eq("weekday", weekday);
      if (missingTable(result.error)) return bad("值日排班表尚未初始化，请在 Supabase 运行 supabase/duty_calendar.sql。", 503);
      return fail(result.error) ?? json({ ok: true });
    }
    if (action === "toggleDuty") {
      const field = str("field", 20), date = str("date", 10), done = Boolean(body.done);
      if (field !== "garbage" && field !== "sweep") return bad("打卡项目不正确。");
      if (!isDate(date)) return bad("请选择有效日期。");
      const { data: row, error } = await db.from("duty_rota").select("id").eq("duty_date", date).maybeSingle();
      if (error) throw error;
      if (!row) {
        const created = await db.from("duty_rota").insert({ duty_date: date });
        if (created.error && created.error.code !== "23505") return fail(created.error) ?? bad("保存失败。");
      }
      const result = field === "garbage"
        ? await db.from("duty_rota").update({ garbage_done: done, garbage_done_by: done ? member.id : null, updated_at: now() }).eq("duty_date", date)
        : await db.from("duty_rota").update({ sweep_done: done, sweep_done_by: done ? member.id : null, updated_at: now() }).eq("duty_date", date);
      return fail(result.error) ?? json({ ok: true });
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
