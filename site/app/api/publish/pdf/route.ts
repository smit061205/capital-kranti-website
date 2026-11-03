// The day's printed paper as a PDF, sent by the paper app's Publish (the readers asked for a download, 3 Nov). A paper's
// PDF is 6 to 26 MB, more than a request to the site may carry (4.5 MB), so it goes in two steps, both with the publish key:
//   1. {date, number}        → a one-time pass for epaper/<date>/paper-<id>.pdf, good for 15 minutes; the app uploads the
//                              file straight to the photo store with it (@vercel/blob `put(path, file, {access: "private", token})`)
//   2. {date, number, path}  → the uploaded file recorded as that day's PDF; the past issues show its download button
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { authorized, refuse } from "@/lib/auth.ts";
import { db } from "@/lib/db.ts";
import { prepared } from "@/lib/write.ts";

const MAX = 60_000_000;

export async function POST(req: Request) {
  if (!authorized(req)) return refuse();
  const sql = db();
  if (!sql) return Response.json({ error: "the website has no database" }, { status: 500 });
  const b = (await req.json().catch(() => null)) as { date?: string; number?: number; path?: string } | null;
  const date = b?.date ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(b?.number)) return Response.json({ error: "the issue's date (YYYY-MM-DD) and number" }, { status: 400 });

  if (!b!.path) {
    const path = `epaper/${date}/paper-${randomBytes(5).toString("hex")}.pdf`;
    const token = await generateClientTokenFromReadWriteToken({
      pathname: path, allowedContentTypes: ["application/pdf"], maximumSizeInBytes: MAX, validUntil: Date.now() + 15 * 60_000, addRandomSuffix: false,
    });
    return Response.json({ path, token });
  }

  if (!new RegExp(`^epaper/${date}/paper-[a-f0-9]{10}\\.pdf$`).test(b!.path)) return Response.json({ error: "the path step 1 gave" }, { status: 400 });
  const file = await head(b!.path).catch(() => null);
  if (!file) return Response.json({ error: "the PDF isn't in the store: upload it with the pass first" }, { status: 409 });
  await prepared(sql);
  const url = `/media/${b!.path}`;
  await sql.query(
    `insert into issues (date, number, pdf) values ($1, $2, $3) on conflict (date) do update set pdf = excluded.pdf, number = excluded.number`,
    [date, b!.number, url]);
  for (const p of ["/archive", "/en/archive", "/hi/archive"]) revalidatePath(p, "layout");
  return Response.json({ ok: true, date, url, bytes: file.size });
}
