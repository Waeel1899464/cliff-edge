// Merge Anything — server function (Supabase Edge Function "merge").
// The game sends two things of the same level; this answers what they fuse into.
// Each recipe is asked to the AI only once, then saved and given to every player in the world.
// The AI key lives only here (secret ANTHROPIC_API_KEY), never in the game page.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-haiku-5-5";          // cheap and fast
const DAILY_AI_LIMIT = Number(Deno.env.get("MERGE_DAILY_AI_LIMIT") ?? "20000");

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const ai = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const comboKey = (t: number, a: string, b: string) => {
  const x = [norm(a), norm(b)].sort();
  return `${t}|${x[0]}+${x[1]}`;
};

// Words that must never appear in a result (checked on whole words, any case).
const BLOCK = /\b(sex\w*|porn\w*|nude\w*|naked|boob\w*|penis|vagina|dick|cock|pussy|anal|horny|fetish|kill\w*|murder\w*|suicide|rape\w*|gore|blood\w*|corpse|terror\w*|bomb\w*|gun|guns|nazi\w*|hitler|isis|drug\w*|cocaine|heroin|meth|weed|stoned|beer|vodka|wine|drunk|fuck\w*|shit\w*|bitch\w*|bastard|damn|hell|crap|piss\w*|slut\w*|whore\w*|nigg\w*|fag\w*|retard\w*|jesus|allah|god|prophet|bible|quran|church|mosque|trump|biden|putin|israel|palestin\w*|politic\w*)\b/i;
const NAME_OK = /^[\p{L}\p{N}][\p{L}\p{N} '\-&!.]{0,27}$/u;
const EMOJI_OK = /\p{Extended_Pictographic}/u;

const SYSTEM = `You are the imagination inside "Merge Anything", a cute physics game played by people of every age all over the world.
Two things touch inside a jar and fuse into ONE new thing. You decide what comes out.

How to answer well:
- The result must clearly come from BOTH inputs, yet be surprising: a clever pun, a funny twist, a creature, a food, an object, a job, a place, a feeling, a myth, a piece of internet culture. The best answers make people laugh out loud or say "oh, that's clever!".
- Concrete and easy to picture beats abstract. One to three words, Title Case, English, at most 24 characters.
- Never repeat either input, never just glue the two names together ("Cat Rain" is bad; "Umbrella With Whiskers" is good).
- The level says how big and epic the result should feel: level 4 is everyday and small, level 7 is impressive, level 10 is legendary or cosmic.
- Safe for children everywhere: no real people, no brands, no religion, no politics, no violence, no weapons, no alcohol or drugs, nothing rude.
- emoji: exactly one common emoji that shows the result and works on old phones.

Examples:
Level 4: Coffee + Robot -> {"name":"Morning Person","emoji":"🤖"}
Level 4: Ghost + Ramen -> {"name":"Spooky Noodles","emoji":"🍜"}
Level 5: Dragon + Sheep -> {"name":"Wool Dragon","emoji":"🐲"}
Level 6: Wizard + WiFi -> {"name":"Wizard Of The Web","emoji":"🧙"}
Level 8: Kraken + Rainbow -> {"name":"Disco Octopus","emoji":"🐙"}
Level 10: Sun King + Space Whale -> {"name":"Galaxy Emperor","emoji":"🌌"}`;

const SCHEMA = {
  type: "object",
  properties: { name: { type: "string" }, emoji: { type: "string" } },
  required: ["name", "emoji"],
  additionalProperties: false,
};

async function askAI(t: number, a: string, b: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await ai.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: `Level ${t}: ${a} + ${b}` }],
    } as Anthropic.MessageCreateParamsNonStreaming);
    if (msg.stop_reason === "refusal") return null;
    const block = msg.content.find((c) => c.type === "text");
    if (!block || block.type !== "text") continue;
    let out: { name?: string; emoji?: string };
    try { out = JSON.parse(block.text); } catch { continue; }
    const name = String(out.name ?? "").trim().replace(/\s+/g, " ");
    const emoji = String(out.emoji ?? "").trim();
    const bad = !NAME_OK.test(name) || BLOCK.test(name) || !EMOJI_OK.test(emoji) || emoji.length > 16 ||
      norm(name) === norm(a) || norm(name) === norm(b);
    if (!bad) return { name, emoji };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { t?: unknown; a?: unknown; b?: unknown };
  try { body = JSON.parse(await req.text()); } catch { return json({ error: "bad json" }, 400); }
  const t = Number(body.t), a = String(body.a ?? ""), b = String(body.b ?? "");
  if (!Number.isInteger(t) || t < 2 || t > 10 || !a || !b || a.length > 40 || b.length > 40) {
    return json({ error: "bad request" }, 400);
  }
  const key = comboKey(t, a, b);

  // 1. Already decided? Everyone gets the same answer.
  const found = await db.from("merge_combos").select("name, emoji").eq("key", key).maybeSingle();
  if (found.data) {
    db.rpc("merge_add_use", { k: key }).then(() => {}, () => {});
    return json({ n: found.data.name, e: found.data.emoji, first: false });
  }

  // 2. Both inputs must be real things from the game (stops people feeding the AI their own words).
  const known = await db.from("merge_items").select("key").eq("tier", t - 1).in("key", [norm(a), norm(b)]);
  const have = new Set((known.data ?? []).map((r) => r.key));
  if (!have.has(norm(a)) || !have.has(norm(b))) return json({ error: "unknown things" }, 422);

  // 3. Daily safety limit on AI calls.
  const count = await db.rpc("merge_count_ai_call");
  if (typeof count.data === "number" && count.data > DAILY_AI_LIMIT) return json({ error: "busy" }, 503);

  // 4. Ask the AI.
  let res;
  try { res = await askAI(t, a, b); } catch (e) { console.error("ai error", e); return json({ error: "ai" }, 502); }
  if (!res) return json({ error: "no answer" }, 502);

  // 5. Save it. If someone else saved the same recipe a moment ago, theirs wins.
  const ins = await db.from("merge_combos").insert({ key, tier: t, name: res.name, emoji: res.emoji }).select("key");
  if (ins.error) {
    const again = await db.from("merge_combos").select("name, emoji").eq("key", key).maybeSingle();
    if (again.data) return json({ n: again.data.name, e: again.data.emoji, first: false });
    return json({ error: "db" }, 500);
  }
  // "First in the world" = nobody had ever made this thing (at this level) before.
  const item = await db.from("merge_items")
    .upsert({ tier: t, key: norm(res.name), name: res.name, emoji: res.emoji }, { onConflict: "tier,key", ignoreDuplicates: true })
    .select("key");
  return json({ n: res.name, e: res.emoji, first: (item.data ?? []).length > 0 });
});
