#!/usr/bin/env node
/**
 * Phase 2 — Gemini fact-script generator (Demon Slayer test)
 * Usage:
 *   GEMINI_API_KEY=xxx node scripts/script-test.mjs   → 5 Hindi scripts (out/ folder me)
 *   node scripts/script-test.mjs --selftest           → bina key ke validation logic test
 * Koi key hardcode NAHI — sirf env/secrets se.
 */
import { mkdirSync, writeFileSync } from "node:fs";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const API = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const OUT = "out";
const MIN_WORDS = 80;
const MAX_WORDS = 95;

const ANGLES = [
  "Tanjiro ke character, uski personality aur uske swordsmanship par hidden facts",
  "Nezuko aur uski anokhi powers par shocking facts",
  "Demon Slayer Corps ke Hashira par lesser-known facts",
  "Series ke demons (jaise Muzan, Rui) aur unki backstory par dark facts",
  "Author Koyoharu Gotouge aur series ki record-breaking success par amazing facts",
];

const PROMPT = (angle) =>
  `Tum Hindi YouTube Shorts ke liye anime-fact scriptwriter ho.
Topic: "${angle}" (anime: Demon Slayer / Kimetsu no Yaiba).
EXACTLY ek 35-second ka script likho.
Rules:
1. Sirf Devanagari Hindi me likho (naam bhi Devanagari me, jaise तनजीरो, नेज़ुको).
2. ${MIN_WORDS} se ${MAX_WORDS} shabd ke beech hona chahiye.
3. Structure: pehli line energy bhara hook, phir exactly 3 facts (har fact alag line me), aakhri line comment karwane wala sawaal (?) ke saath.
4. Facts 100% sach aur verifiable hone chahiye — banaaya hua fact bilkul nahi.
5. Sirf script ka text output karo — koi heading, numbering ya extra note nahi.`;

export function validate(script) {
  const errors = [];
  const text = (script || "").trim();
  if (!text) return { ok: false, errors: ["empty script"] };
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < MIN_WORDS) errors.push(`chhota hai: ${words} shabd (min ${MIN_WORDS})`);
  if (words > MAX_WORDS) errors.push(`lamba hai: ${words} shabd (max ${MAX_WORDS})`);
  if (!/[ऀ-ॿ]/.test(text)) errors.push("Devanagari Hindi nahi hai");
  if (!text.includes("?")) errors.push("end me comment-sawaal (?) nahi hai");
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 5) errors.push(`structure kam lines ka hai (${lines.length}) — hook+3 facts+sawaal chahiye`);
  return { ok: errors.length === 0, errors, words };
}

async function generate(prompt) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function selftest() {
  console.log("🧪 SELFTEST — validation logic\n");
  const good =
    "रुको! डेमन स्लेयर के बारे में ये वाली बातें निन्यानवे प्रतिशत लोग बिल्कुल नहीं जानते!\nतनजीरो का दिन में और रात में अलग व्यवहार होता है, और बोलने का तरीका भी बदल जाता है!\nनेज़ुको एकमात्र ऐसी राक्षस है जो मूज़ान से भी पहले सूरज की रोशनी सह पाई!\nसबसे शक्तिशाली योद्धाओं वाले हशिरा समूह में ठीक नौ सदस्य होते हैं!\nतनजीरो की काली तलवार असल में बेहद दुर्लभ और विशेष किस्म की होती है!\nसबसे ज्यादा चौंकाने वाला फैक्ट कौन सा लगा? कमेंट में बताओ?";
  const cases = [
    ["sahi script", good, true],
    ["chhota script", "रुको! एक fact। सवाल?", false],
    ["lamba script", ("लंबा फैक्ट वाला वाक्य ।\n").repeat(30), false],
    ["english script", "Wait! Three facts about Demon Slayer that nobody knows at all, right? ".repeat(3), false],
    ["bina sawaal", "रुको! यह एक हुक है।\nफैक्ट एक यह है।\nफैक्ट दो यह है।\nफैक्ट तीन यह है।\nयह आखिरी लाइन है बिना प्रश्न चिन्ह के।".repeat(2), false],
  ];
  let pass = 0;
  for (const [name, text, expect] of cases) {
    const r = validate(text);
    const ok = r.ok === expect;
    if (ok) pass++;
    console.log(`${ok ? "✅" : "❌"} ${name} → ok=${r.ok}${r.words ? ` (${r.words} shabd)` : ""}`);
  }
  console.log(`\n${pass}/${cases.length} selftest pass`);
  process.exit(pass === cases.length ? 0 : 1);
}

async function main() {
  if (process.argv.includes("--selftest")) return selftest();
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY env/secret me nahi hai. GitHub workflow ye secret khud lagata hai.");
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });
  const results = [];
  for (let i = 0; i < ANGLES.length; i++) {
    let script = "";
    let v = { ok: false, errors: ["not tried"] };
    for (let attempt = 1; attempt <= 3 && !v.ok; attempt++) {
      try {
        script = await generate(PROMPT(ANGLES[i]));
        v = validate(script);
        if (!v.ok) console.log(`⚠️  Script ${i + 1} attempt ${attempt}: ${v.errors.join(", ")} — retry`);
      } catch (e) {
        console.log(`⚠️  Script ${i + 1} attempt ${attempt} failed: ${e.message}`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    if (!v.ok) {
      console.error(`❌ Script ${i + 1} valid nahi bana (${ANGLES[i]}): ${v.errors.join(", ")}`);
      process.exit(1);
    }
    results.push({ angle: ANGLES[i], words: v.words, script });
    writeFileSync(`${OUT}/script-${i + 1}.txt`, script.trim() + "\n");
    console.log(`\n📜 SCRIPT ${i + 1} (${v.words} shabd) — ${ANGLES[i]}\n${script.trim()}\n`);
  }
  writeFileSync(`${OUT}/scripts.json`, JSON.stringify(results, null, 2));
  console.log(`✅ 5/5 scripts ready → ${OUT}/ (artifact me upload hongi)`);
}

main().catch((e) => {
  console.error("❌ script-test failed:", e);
  process.exit(1);
});
