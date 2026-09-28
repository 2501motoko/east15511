import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { getCurrentMember, isMember } from "../../lib/auth";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;
const supportedDocs = new Set(["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "txt", "md", "zip"]);
const supportedPhotos = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const safeName = (name: string) => name.replace(/[\\/\r\n\u0000]/g, "_").slice(0, 180);

export async function POST(request: Request) {
  const member = await getCurrentMember();
  if (!isMember(member)) return member;
  const form = await request.formData();
  const type = String(form.get("type") ?? "");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "请选择一个文件。" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "单个文件不能超过 25 MB。" }, { status: 413 });

  const filename = safeName(file.name);
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const db = createSupabaseAdminClient();
  if (type === "resource") {
    if (!supportedDocs.has(ext)) return Response.json({ error: "资料支持 PDF、Office 文档、CSV、TXT、Markdown 和 ZIP。" }, { status: 415 });
    const courseId = String(form.get("courseId") ?? "");
    const title = String(form.get("title") ?? filename).trim().slice(0, 160);
    if (!courseId || !title) return Response.json({ error: "请填写资料名称并选择课程。" }, { status: 400 });
    const { data: course, error: courseError } = await db.from("courses").select("id").eq("id", courseId).maybeSingle();
    if (courseError) return Response.json({ error: "无法验证课程标签。" }, { status: 503 });
    if (!course) return Response.json({ error: "请选择有效课程标签。" }, { status: 400 });
    const id = crypto.randomUUID();
    const key = `resources/${id}`;
    const contentType = file.type || "application/octet-stream";
    const uploaded = await db.storage.from("course-files").upload(key, await file.arrayBuffer(), { contentType, upsert: false });
    if (uploaded.error) {
      console.error("Resource upload failed", uploaded.error);
      return Response.json({ error: "文件上传失败，请稍后重试。" }, { status: 503 });
    }
    const inserted = await db.from("resources").insert({
      id, course_id: courseId, title, file_name: filename, object_key: key,
      content_type: contentType, size: file.size, uploader_id: member.id,
    });
    if (inserted.error) {
      await db.storage.from("course-files").remove([key]);
      console.error("Resource record creation failed", inserted.error);
      return Response.json({ error: "资料保存失败，请稍后重试。" }, { status: 503 });
    }
    return Response.json({ id }, { status: 201 });
  }

  if (type === "memory") {
    if (!supportedPhotos.has(ext) || !file.type.startsWith("image/")) return Response.json({ error: "照片支持 JPG、PNG、WebP 或 GIF。" }, { status: 415 });
    const caption = String(form.get("caption") ?? "").trim().slice(0, 500) || null;
    const date = String(form.get("date") ?? "").trim() || null;
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)))) {
      return Response.json({ error: "日期格式不正确。" }, { status: 400 });
    }
    const id = crypto.randomUUID();
    const key = `memories/${id}`;
    const contentType = file.type || "image/jpeg";
    const uploaded = await db.storage.from("dorm-photos").upload(key, await file.arrayBuffer(), { contentType, upsert: false });
    if (uploaded.error) {
      console.error("Photo upload failed", uploaded.error);
      return Response.json({ error: "照片上传失败，请稍后重试。" }, { status: 503 });
    }
    const inserted = await db.from("memories").insert({
      id, caption, memory_date: date, file_name: filename, object_key: key,
      content_type: contentType, size: file.size, uploader_id: member.id,
    });
    if (inserted.error) {
      await db.storage.from("dorm-photos").remove([key]);
      console.error("Photo record creation failed", inserted.error);
      return Response.json({ error: "照片保存失败，请稍后重试。" }, { status: 503 });
    }
    return Response.json({ id }, { status: 201 });
  }
  return Response.json({ error: "上传类型不正确。" }, { status: 400 });
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "文件不存在。" }, { status: 404 });
  const db = createSupabaseAdminClient();
  const resource = await db.from("resources").select("file_name,object_key,content_type").eq("id", id).maybeSingle();
  if (resource.error) return Response.json({ error: "文件读取失败。" }, { status: 503 });
  const memory = resource.data ? null : await db.from("memories").select("file_name,object_key,content_type").eq("id", id).maybeSingle();
  if (memory?.error) return Response.json({ error: "文件读取失败。" }, { status: 503 });
  const item = resource.data ?? memory?.data;
  if (!item) return Response.json({ error: "文件不存在。" }, { status: 404 });
  const bucket = resource.data ? "course-files" : "dorm-photos";
  const downloaded = await db.storage.from(bucket).download(item.object_key);
  if (downloaded.error || !downloaded.data) return Response.json({ error: "文件已不可用。" }, { status: 404 });
  const inline = new URL(request.url).searchParams.get("inline") === "1" && item.content_type.startsWith("image/");
  const dispositionName = encodeURIComponent(item.file_name).replace(/'/g, "%27");
  return new Response(await downloaded.data.arrayBuffer(), { headers: {
    "Content-Type": item.content_type,
    "Content-Length": String(downloaded.data.size),
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${dispositionName}`,
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  } });
}
