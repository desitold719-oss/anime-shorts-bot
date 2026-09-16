#!/usr/bin/env node
/**
 * PHASE 1 — Voice test
 * Inworld non-streaming TTS (model: inworld-tts-2) with word-level timestamps.
 *
 * Input  : env INWORLD_API_KEY (never hardcoded — GitHub secret / export)
 * Output : out/tts-test/tts-test.mp3            (voice audio)
 *          out/tts-test/tts-test-timestamps.json (word timings for Phase 3 captions)
 *
 * Run    : node scripts/tts-test.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const INWORLD_TTS_URL = "https://api.inworld.ai/tts/v1/voice";

// Requested settings — sirf yahan config hai, koi key nahi.
const CONFIG = {
  modelId: "inworld-tts-2",
  voiceId: "default-f3gk1ii-ylakxp7rac6xhq__kk",
  deliveryMode: "CREATIVE",
  language: "hi-IN",
  timestampType: "WORD",
  audioEncoding: "MP3",
  sampleRateHertz: 48000,
};

const SAMPLE_TEXT =
  "रुको! डेमन स्लेयर के बारे में ये तीन बातें निन्यानवे प्रतिशत लोग नहीं जानते! " +
  "नंबर एक — तनजीरो का दिन में और रात में अलग व्यक्तित्व होता है!";

const OUT_DIR = path.join("out", "tts-test");

function fail(msg) {
  console.error(`\n❌ FAIL: ${msg}`);
  process.exit(1);
}

async function synthesize(text, apiKey) {
  const body = {
    text,
    voiceId: CONFIG.voiceId,
    modelId: CONFIG.modelId,
    language: CONFIG.language,
    deliveryMode: CONFIG.deliveryMode,
    timestampType: CONFIG.timestampType,
    audioConfig: {
      audioEncoding: CONFIG.audioEncoding,
      sampleRateHertz: CONFIG.sampleRateHertz,
    },
  };

  console.log(`\n→ POST ${INWORLD_TTS_URL}`);
  console.log(`  model=${CONFIG.modelId} voice=${CONFIG.voiceId}`);
  console.log(`  language=${CONFIG.language} deliveryMode=${CONFIG.deliveryMode} timestampType=${CONFIG.timestampType}`);
  console.log(`  text="${text}"`);

  let response;
  try {
    response = await fetch(INWORLD_TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    fail(
      `Inworld API tak request hi nahi pahunchi (network error: ${err?.cause?.code || err?.message})\n` +
      "   • API key/env sahi hai? Internet/proxy check karo.\n" +
      "   • GitHub Actions me ye normal network use karta hai — wahan retry karo."
    );
  }

  if (!response.ok) {
    let details = "";
    try {
      details = JSON.stringify(await response.json());
    } catch {
      details = await response.text().catch(() => "");
    }
    fail(`Inworld API HTTP ${response.status} ${response.statusText}\n   Response: ${details || "(empty)"}`);
  }

  const result = await response.json();

  if (!result.audioContent) {
    fail(`Response me audioContent nahi mila. Keys: ${Object.keys(result).join(", ")}`);
  }
  return result;
}

// wordAlignment arrays → caption-ready [{word, start, end}] list
function buildWordList(wordAlignment) {
  const words = wordAlignment?.words ?? [];
  const starts = wordAlignment?.wordStartTimeSeconds ?? [];
  const ends = wordAlignment?.wordEndTimeSeconds ?? [];
  const list = [];
  for (let i = 0; i < words.length; i++) {
    // Sirf actual speech tokens rakho (khali/whitespace tokens skip)
    const w = String(words[i] ?? "");
    if (!w.trim()) continue;
    list.push({
      word: w,
      start: Number(starts[i] ?? 0),
      end: Number(ends[i] ?? starts[i] ?? 0),
    });
  }
  return list;
}

async function main() {
  const apiKey = process.env.INWORLD_API_KEY;
  if (!apiKey) {
    fail(
      "INWORLD_API_KEY set nahi hai!\n" +
      "   • Local:  export INWORLD_API_KEY=your_key\n" +
      "   • GitHub: repo → Settings → Secrets and variables → Actions → INWORLD_API_KEY"
    );
  }

  console.log("🎙️  PHASE 1 — Inworld TTS voice test (Hindi)");

  const result = await synthesize(SAMPLE_TEXT, apiKey);

  const audio = Buffer.from(result.audioContent, "base64");
  const wordAlignment = result.timestampInfo?.wordAlignment ?? {};
  const wordList = buildWordList(wordAlignment);
  const duration = wordList.length ? wordList[wordList.length - 1].end : 0;

  // Caption-ready JSON + debug-friendly raw response (audio base64 hata ke)
  const rawNoAudio = { ...result };
  delete rawNoAudio.audioContent;

  const timestampsDoc = {
    generatedAt: new Date().toISOString(),
    text: SAMPLE_TEXT,
    config: CONFIG,
    audioFile: "tts-test.mp3",
    audioBytes: audio.length,
    estimatedDurationSeconds: Number(duration.toFixed(3)),
    wordCount: wordList.length,
    words: wordList,
    rawResponse: rawNoAudio,
  };

  await mkdir(OUT_DIR, { recursive: true });
  const mp3Path = path.join(OUT_DIR, "tts-test.mp3");
  const jsonPath = path.join(OUT_DIR, "tts-test-timestamps.json");
  await writeFile(mp3Path, audio);
  await writeFile(jsonPath, JSON.stringify(timestampsDoc, null, 2) + "\n");

  // Console summary — Actions log me turant dikh jaye
  console.log("\n✅ TTS synthesis successful");
  console.log(`   MP3       : ${mp3Path} (${(audio.length / 1024).toFixed(1)} KB, ${audio.length} bytes)`);
  console.log(`   Timestamps: ${jsonPath}`);
  console.log(`   Words     : ${wordList.length} | Approx duration: ${duration.toFixed(2)}s`);
  console.log("\n   Pehle 6 word timestamps:");
  for (const w of wordList.slice(0, 6)) {
    console.log(`     [${w.start.toFixed(2)}s → ${w.end.toFixed(2)}s] ${w.word}`);
  }
  if (wordList.length > 6) {
    console.log("   ...");
    console.log("   Aakhri 3 word timestamps:");
    for (const w of wordList.slice(-3)) {
      console.log(`     [${w.start.toFixed(2)}s → ${w.end.toFixed(2)}s] ${w.word}`);
    }
  }
  console.log("\n🎉 Phase 1 done — artifact download karke MP3 sun lo!");
}

main().catch((err) => fail(err?.stack || err?.message || String(err)));
