import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase public configuration.");
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll(): { name: string; value: string }[] {
        return cookieStore.getAll();
      },
      setAll: ((values) => {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Some Server Component contexts are read-only; route handlers can refresh cookies.
        }
      }) satisfies SetAllCookies,
    },
  });
}
