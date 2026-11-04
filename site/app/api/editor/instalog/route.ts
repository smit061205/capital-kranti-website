// Instagram's log for the editor page (lib/insta.ts, InstaLog.tsx), asked every few seconds so the editor sees each step as
// it happens, also while a button's work is still going (4 Nov: "nothing gets logged"). Only a signed-in editor.
import { cookies } from "next/headers";
import { db } from "@/lib/db.ts";
import { COOKIE, editorOf } from "@/lib/editor.ts";
import { instaLogs } from "@/lib/insta.ts";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!editorOf((await cookies()).get(COOKIE)?.value)) return Response.json({ error: "not signed in" }, { status: 401 });
  const sql = db();
  if (!sql) return Response.json({ error: "the website has no database" }, { status: 500 });
  try {
    return Response.json({ logs: await instaLogs(sql) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
