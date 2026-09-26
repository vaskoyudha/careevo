import { getLlm } from "@/lib/llm/port";
import type { StudyChatMessage } from "@/lib/learning/chat-types";

/**
 * The ask-hint — the line the composer offers before the learner types.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: deeptutor/services/chat_hints.py
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 *
 * Upstream's own note, kept because it is the whole design: the mastery and
 * reading composers each hint about something fixed in view — a waypoint, a
 * page — but the home chat has no such anchor. What it *does* have is the
 * conversation, and that is enough to predict the one thing worth offering:
 * the line the learner is likely to type next, given what the assistant just
 * said. That line is deliberately NOT required to be a question — "lanjut",
 * "jelaskan lebih sederhana", a straight follow-up are all plausible next
 * turns, and demanding a question mark would reject most of them. The one hard
 * rule carried over is voice: this writes what the *learner* would type, never
 * a description of it ("kamu bisa tanya…") and never the assistant's own voice.
 *
 * Nothing to predict from is a real state, not a failure: a conversation with
 * no messages yet has nothing for this to work from (the opening screen is
 * served by the starter chips instead), so this returns "" with no LLM call.
 * Every other dead end — a timeout, a model that answered instead of
 * predicting, a provider that threw — also leaves the composer's own static
 * placeholder standing. An empty hint is an answer, not an error.
 *
 * Modified for Careevo:
 * - `_SYSTEM_EN` and `_SYSTEM_ZH` collapse into one Indonesian prompt, because
 *   every message in Careevo is Indonesian and a predictor instructed to answer
 *   in English would write the wrong language into the composer.
 * - The session-store read, the language setting and the single-flight TTL
 *   cache (`_collect`, `_response_language`, `get_ask_hint`) are gone: the
 *   caller already holds the transcript and does the caching, so this module
 *   stays pure enough to unit-test with no I/O.
 * - `_META_EN` and `_ASSISTANT_VOICE_EN` keep their English patterns and gain
 *   the Indonesian equivalents ("kamu bisa", "tentu saja", …), so the two
 *   rejections that guard the hint's *voice* still fire in this language.
 * - `_normal_form` drops the CJK range from its `[^\w㐀-鿿]` class: the rules
 *   are latin-only here, so `\w` alone is the same normalization.
 * - `complete(system_prompt=…, prompt=…)` becomes one prompt string, because
 *   the LLM port takes a single `generate(prompt)` argument.
 * - The 12s timeout, `temperature: 0.7` and `max_tokens: 120` are not set: the
 *   port exposes no such options, and a timeout is the caller's business.
 */

/** Upstream `_MAX_HINT_CHARS["en"]`. Above this, the prediction is not shown. */
export const MAX_HINT_CHARS = 110;
/** Upstream `_HISTORY_TURNS`: only the tail of the conversation is sent. */
export const HINT_HISTORY_TURNS = 4;
/** Upstream `_MAX_MESSAGE_CHARS`: per-message cap inside that tail. */
export const MAX_HINT_MESSAGE_CHARS = 700;

/**
 * The conversation tail, normalized exactly like upstream `_collect`.
 *
 * The order of the three steps is upstream's and each one shows: role-filter
 * first, then the last `_HISTORY_TURNS` messages, then drop the empty ones —
 * so a blank message still consumes a slot rather than letting the tail reach
 * further back. Whitespace is collapsed, because a multi-line assistant answer
 * would otherwise turn the rendered prompt into a wall of newlines, and the
 * per-message cap is applied after collapsing, so it caps visible characters.
 */
export function potongPercakapan(
  messages: readonly StudyChatMessage[],
): { role: "user" | "assistant"; content: string }[] {
  const tail: { role: "user" | "assistant"; content: string }[] = [];
  if (!Array.isArray(messages)) return tail;

  // Upstream keeps only `user` / `assistant` rows. The type already says so, but
  // this transcript arrives from a cookie, so the runtime check stays.
  const relevan = messages.filter(
    (message) => message?.role === "user" || message?.role === "assistant",
  );

  for (const message of relevan.slice(-HINT_HISTORY_TURNS)) {
    const content = String(message.content ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!content) continue;
    tail.push({ role: message.role, content: content.slice(0, MAX_HINT_MESSAGE_CHARS) });
  }
  return tail;
}

/**
 * The Indonesian system prompt — upstream `_SYSTEM_EN`, same four rules and the
 * same Good/Bad examples, translated (retry policy, casual email tone, picking
 * the second option, and the three Bad lines).
 *
 * Not exported: it is only ever concatenated into the prompt below.
 */
const PROMPT_SISTEM_PETUNJUK = `Kamu memprediksi SATU baris yang kemungkinan besar akan diketik pengguna selanjutnya ke dalam kotak chat — ini adalah teks placeholder composer, dibaca sebelum ia mulai mengetik.

Kamu diberi ekor percakapan. Tulis satu hal yang paling mungkin dikatakan pengguna berikutnya: pertanyaan lanjutan, reaksi, permintaan lanjutan, langkah berikutnya dalam tugas yang sama — apa pun yang cocok, dan TIDAK harus berupa pertanyaan.

Aturan:
- Balas hanya baris itu saja. Tanpa tanda kutip, tanpa awalan, tanpa markdown, tanpa komentar.
- Orang pertama, persis seperti yang akan diketik pengguna. Di bawah 14 kata.
- Tulis apa yang akan dikatakan PENGGUNA, bukan apa yang akan dijawab asisten, dan bukan deskripsi sebuah pertanyaan ("kamu bisa tanya...") alih-alih pertanyaan itu sendiri.
- Kaitkan dengan apa yang baru saja dikatakan asisten; jangan memasukkan topik yang tidak berhubungan.

Baik (asisten baru saja menjelaskan kebijakan retry): "Bagaimana kalau percobaan ketiga gagal?"
Baik (asisten baru saja menyusun draf email): "Buat nadanya lebih santai"
Baik (asisten baru saja menyebut tiga pilihan): "Ambil pilihan kedua saja"
Buruk: "Kamu bisa tanya soal batas retry"  <- mendeskripsikan sebuah baris, bukan menjadi baris itu
Buruk: "Penjelasannya bagus sekali!"       <- tidak layak diketik, tidak melanjutkan apa pun
Buruk: "Ini versi yang lebih santai: ..."  <- suara asisten, bukan suara pengguna`;

/** Upstream `_render`'s speaker labels, in the one language Careevo speaks. */
const LABEL_PERAN: Record<"user" | "assistant", string> = {
  user: "Pengguna",
  assistant: "Asisten",
};

/**
 * Upstream `_render`: the tail as `[Peran] isi` lines under a heading, with one
 * closing instruction. Newlines are already collapsed, so this is deliberately
 * a flat block, not a re-indented transcript.
 */
function renderPercakapan(
  material: readonly { role: "user" | "assistant"; content: string }[],
): string {
  const body = material.map(({ role, content }) => `[${LABEL_PERAN[role]}] ${content}`).join("\n");
  return ["# Akhir percakapan\n" + body, "\nTulis satu baris berikutnya itu."].join("\n\n");
}

/**
 * Upstream's `_call_llm` body: the system prompt plus the rendered transcript.
 *
 * Upstream passes these as `system_prompt` and `prompt`; the port takes one
 * string, so they are joined with a blank line — the system instructions first,
 * exactly as a chat template would order them.
 */
function susunPrompt(material: readonly { role: "user" | "assistant"; content: string }[]): string {
  return `${PROMPT_SISTEM_PETUNJUK}\n\n${renderPercakapan(material)}`;
}

/** The prediction prompt for a transcript. */
export function bangunPromptPetunjuk(messages: readonly StudyChatMessage[]): string {
  return susunPrompt(potongPercakapan(messages));
}

/** Upstream `_META_EN`, plus the Indonesian phrasings of the same mistake. */
const POLA_META =
  /\byou (?:can|could|should)\b|\btry (?:asking|saying)\b|\bconsider asking\b|\bthe user (?:can|could|should)\b|kamu bisa|kamu dapat|coba tanya|coba bilang|mungkin tanyakan|sebaiknya tanya/i;

/** Upstream `_ASSISTANT_VOICE_EN`, plus the Indonesian assistant openings. */
const POLA_SUARA_ASISTEN =
  /^(?:sure|certainly|of course|here(?:'|’)s|here is|as an ai|i(?:'|’)d be happy|tentu saja|tentu|baiklah|baik|siap|berikut|ini dia)\b/i;

/** The quote pairs upstream strips when they wrap the whole line. */
const PASANGAN_KUTIP = new Set(['""', "''", "“”", "‘’", "「」"]);

/** Upstream `_normal_form`, latin-only (`\w`) and casefolded. */
function bentukNormal(value: string): string {
  return String(value ?? "")
    .replace(/[^\w]+/g, "")
    .toLowerCase();
}

/**
 * Upstream `_echoes_last_message`: true when the hint is essentially the
 * learner's own last message read back.
 *
 * Copied exactly, including the `< 6` guard: below six word characters either
 * form can contain the other by coincidence ("oke" inside "oke sip"), which
 * would reject a perfectly ordinary short reply.
 */
function gemaPesanTerakhir(hint: string, lastUserMessage: string): boolean {
  if (!lastUserMessage) return false;
  const hintForm = bentukNormal(hint);
  const messageForm = bentukNormal(lastUserMessage);
  return hintForm.length >= 6 && (messageForm.includes(hintForm) || hintForm.includes(messageForm));
}

/**
 * Upstream `_sanitize`, with the language fixed to the latin rules.
 *
 * One compliant predicted line, or an empty string. Every step is kept in
 * upstream's order, because each one can be the reason a model answer is not a
 * hint: two lines is a paragraph, a fence is markdown, a leading dash is a
 * list, wrapping quotes are quoting rather than saying, a description of a
 * question is meta, an opening like "Tentu saja" is the assistant's voice, and
 * the learner's own message read back predicts nothing.
 */
export function bersihkanPetunjuk(raw: string, lastUserMessage: string): string {
  // Multi-line rejection first: a hint is one line, so nothing below has to
  // reason about which line was meant.
  const baris = String(raw ?? "")
    .split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (baris.length !== 1) return "";

  let text = baris[0].trim();
  if (text.startsWith("```") || text.endsWith("```")) return "";

  text = text.replace(/^[-•*# ]+/, "").trim();
  if (text.length >= 2 && PASANGAN_KUTIP.has(text[0] + text[text.length - 1])) {
    text = text.slice(1, -1).trim();
  }
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return "";

  // The cap is on the visible line, so it is checked after quote stripping.
  if (text.length > MAX_HINT_CHARS) return "";
  if (POLA_META.test(text)) return "";
  if (POLA_SUARA_ASISTEN.test(text)) return "";
  if (gemaPesanTerakhir(text, lastUserMessage)) return "";
  return text;
}

/** Upstream `_Material.last_user_message`: the newest learner turn in the tail. */
function pesanTerakhirPengguna(
  material: readonly { role: "user" | "assistant"; content: string }[],
): string {
  for (let index = material.length - 1; index >= 0; index -= 1) {
    const baris = material[index];
    if (baris?.role === "user") return baris.content;
  }
  return "";
}

/**
 * One hint, or `""` — never throws, never rejects.
 *
 * Mirrors `get_ask_hint`: an empty transcript returns before any model is
 * resolved, a port with no model configured returns `""` too (upstream has no
 * stub for this call — the composer keeps its own placeholder), and a thrown
 * error or a `!ok` result is the same empty answer rather than a propagated
 * failure. Caching belongs to the caller, so nothing is remembered here.
 */
export async function mintaPetunjuk(messages: readonly StudyChatMessage[]): Promise<string> {
  try {
    const material = potongPercakapan(messages);
    // Nothing to continue without at least one real exchange — and this is the
    // path that must not spend a model call.
    if (material.length === 0) return "";

    const llm = getLlm();
    if (!llm.available) return "";

    const hasil = await llm.generate(susunPrompt(material));
    if (!hasil.ok) return "";
    return bersihkanPetunjuk(hasil.text, pesanTerakhirPengguna(material));
  } catch {
    return "";
  }
}
