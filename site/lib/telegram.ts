// The editor's phone: a private bot sends notes (a fact-checker's warning, a story taken down, a birthday) and, since
// 19 Nov, each story that waits for his approval (sensitive or important: lib/config.ts approveFrom) with Publish / Don't
// buttons; the same story waits on his page (/editor), and whichever he presses first decides it. Only the chats in
// TELEGRAM_CHAT_IDS may decide. Messages and presses arrive either at the site (/api/telegram, when the bot's webhook points
// there) or are fetched by each engine run and engine/listen.ts (getUpdates, when it doesn't); handleUpdate() also answers
// a message (/start) with the chat's number, the one TELEGRAM_CHAT_IDS needs.
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { decideStory } from "./editor.ts";

type Sql = NeonQueryFunction<false, false>;
const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN ?? "";
const CHATS = () => (process.env.TELEGRAM_CHAT_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
export const telegramOn = () => !!TOKEN() && CHATS().length > 0;
/** The bot answers /start as soon as it has its token, so a new editor can learn their chat number. */
const botOn = () => !!TOKEN();

async function api(method: string, body: Record<string, unknown>, ms = 20_000) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN()}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms),
  });
  return (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; result?: unknown; description?: string };
}
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

/** A plain note to every editor. */
export async function tell(text: string) {
  if (!telegramOn()) return;
  for (const chat of CHATS()) await api("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true });
}

/** Why a story waits for the editor (shown to him, in Gujarati) */
export const HELD = { sensitive: "સંવેદનશીલ સમાચાર", important: "મહત્ત્વના સમાચાર" } as const;

export interface HeldStory { id: string; headline: string; deck: string; body: string; reason: string; sources: { name: string; url: string }[] }

/** A story waiting for approval, to every editor, with the buttons. */
export async function askApproval(sql: Sql, s: HeldStory) {
  if (!telegramOn()) return;
  const text = `<b>મંજૂરી જોઈએ</b> (${esc(s.reason)})\n\n<b>${esc(s.headline)}</b>\n${esc(s.deck)}\n\n${esc(s.body.slice(0, 2200))}${s.body.length > 2200 ? "…" : ""}\n\n` +
    `સ્રોત: ${s.sources.map((x) => `<a href="${esc(x.url)}">${esc(x.name)}</a>`).join(", ")}`;
  let first: number | null = null;
  for (const chat of CHATS()) {
    const r = await api("sendMessage", {
      chat_id: chat, text: text.slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: "✅ પ્રકાશિત કરો", callback_data: `a:${s.id}` }, { text: "❌ નહીં", callback_data: `r:${s.id}` }]] },
    });
    first ??= ((r.result as { message_id?: number })?.message_id) ?? null;
  }
  await sql.query(`insert into approvals (story_id, message_id) values ($1, $2) on conflict (story_id) do nothing`, [s.id, first]);
}

interface Update {
  update_id: number; message?: { chat: { id: number }; text?: string; from?: { first_name?: string } };
  callback_query?: { id: string; data?: string; from: { id: number; first_name?: string }; message?: { chat: { id: number }; message_id: number } };
}

/** A message to the bot (it says the chat's number and whether it's an editor's), or a button pressed: only from an
 *  editor's chat, and a story is decided once (on his page or here, whichever comes first). */
export async function handleUpdate(sql: Sql, u: Update): Promise<string> {
  const q = u.callback_query;
  if (q?.data && q.message) {
    const chat = String(q.message.chat.id);
    if (!CHATS().includes(chat)) { await api("answerCallbackQuery", { callback_query_id: q.id, text: "Not allowed" }); return "not an editor"; }
    const m = q.data.match(/^([ar]):([a-z0-9-]{1,60})$/);
    if (!m) return "unknown button";
    const [, what, id] = m;
    const done = await decideStory(sql, id, what === "a", q.from.first_name ?? String(q.from.id));
    await api("answerCallbackQuery", { callback_query_id: q.id, text: !done ? "પહેલેથી નક્કી થઈ ગયું છે" : what === "a" ? "પ્રકાશિત થયું" : "નહીં મુકાય" });
    await api("editMessageReplyMarkup", { chat_id: chat, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } });
    if (!done) return "already decided";
    await api("sendMessage", { chat_id: chat, reply_to_message_id: q.message.message_id,
      text: what === "a" ? `✅ ${q.from.first_name ?? ""}: પ્રકાશિત` : `❌ ${q.from.first_name ?? ""}: નહીં મુકાય` });
    return what === "a" ? `approved:${id}` : "rejected";
  }
  if (u.message) {
    const chat = String(u.message.chat.id);
    const editor = CHATS().includes(chat);
    await api("sendMessage", { chat_id: chat, parse_mode: "HTML", text: editor
      ? `નમસ્તે${u.message.from?.first_name ? ` ${esc(u.message.from.first_name)}` : ""}! આ ચેટ જોડાયેલી છે: મંજૂરી માગતા સમાચાર અને સંપાદક માટેની સૂચનાઓ અહીં આવશે.`
      : `નમસ્તે! આ ચેટનો નંબર <code>${chat}</code> છે. સમાચાર અહીં મેળવવા, આ નંબર GitHub ના TELEGRAM_CHAT_IDS માં ઉમેરો.\n\nThis chat's number is <code>${chat}</code>. To get the stories here, add it to the TELEGRAM_CHAT_IDS secret on GitHub.` });
    return editor ? "hello editor" : "told the chat number";
  }
  return "not a message";
}

/** The messages since last time, when the bot has no webhook (each engine run,
 *  and engine/listen.ts between runs, which waits up to `wait` seconds for the next one).
 *  null when the site takes them as they come (a webhook). */
export async function pollUpdates(sql: Sql, wait = 0): Promise<number | null> {
  if (!botOn()) return 0;
  const info = await api("getWebhookInfo", {});
  if ((info.result as { url?: string })?.url) return null;
  const [st] = await sql.query(`select value from state where key = 'telegram_offset'`);
  const r = await api("getUpdates", { offset: st ? Number(st.value) : 0, timeout: wait, allowed_updates: ["callback_query", "message"] }, (wait + 20) * 1000);
  const updates = (r.result as Update[]) ?? [];
  for (const u of updates) await handleUpdate(sql, u);
  if (updates.length) {
    await sql.query(`insert into state (key, value) values ('telegram_offset', $1) on conflict (key) do update set value = excluded.value`,
      [String(updates.at(-1)!.update_id + 1)]);
  }
  return updates.length;
}
