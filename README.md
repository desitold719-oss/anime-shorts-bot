# anime-shorts-bot

Daily 2x **Hindi anime-facts YouTube Shorts** pipeline (Demon Slayer test phase).

**Status: PHASE 2 (fact-script generation) — in review**

## Pipeline plan

| Phase | Kya | Status |
|---|---|---|
| 1 | Inworld TTS voice test (Hindi + word timestamps) | 🟡 Ready — awaiting approval |
| 2 | Gemini se 5x 35s Hindi fact scripts | 🟡 Ready — awaiting approval |
| 3 | Drive episode + FFmpeg → 9:16 sample Short | ⬜ Pending |
| 4 | YouTube OAuth upload + daily cron (2 Shorts/day) | ⬜ Pending |

## Phase 1 — Voice test

`scripts/tts-test.mjs` Inworld non-streaming TTS bulata hai:
- model `inworld-tts-2`, voice `default-f3gk1ii-ylakxp7rac6xhq__kk`
- `deliveryMode: CREATIVE`, `language: hi-IN`, `timestampType: WORD`
- Output: `out/tts-test/tts-test.mp3` + `tts-test-timestamps.json` (word timings — Phase 3 captions ke liye)

### GitHub Actions se chalao (recommended)

1. Repo → **Actions** tab → **Shorts Voice Test (Phase 1 - TTS)**
2. **Run workflow** → Branch: `main` (ya jis branch pe ye code hai) → **Run workflow**
3. Run complete hone do (~30s)
4. Run page ke neeche **Artifacts** → `tts-test-<run_id>` **download** karo
5. Zip unzip karo → `tts-test.mp3` play karke sun lo

### Local se chalao (optional)

```bash
export INWORLD_API_KEY=your_key   # secret only via env — kabhi code me nahi
npm run tts:test
```

Secrets (GitHub → Settings → Secrets and variables → Actions):
- `INWORLD_API_KEY` (Phase 1)
- `GEMINI_API_KEY` (Phase 2)

## Phase 2 — Fact-script test

`scripts/script-test.mjs` Gemini (`gemini-2.5-flash`, env `GEMINI_MODEL` se badla ja sakta hai) se 5 alag angles par 35-second ke Hindi fact scripts banata hai:
- Har script: energy-bhara hook + exactly 3 facts + comment karwane wala sawaal
- **Validation:** 80–95 shabd, Devanagari Hindi, `?` present, minimum 5 lines — fail hone par auto-retry (max 3 attempts)
- Output: `out/script-1.txt` … `script-5.txt` + `out/scripts.json` (angle + word count ke saath)

### GitHub Actions se chalao (recommended)

1. Repo → **Actions** tab → **Shorts Script Test (Phase 2 - Gemini)**
2. **Run workflow** → Branch choose karo → **Run workflow**
3. Run complete hone do (~1–2 min, 5 scripts)
4. Run page ke neeche **Artifacts** → `script-test-<run_id>` **download** karo
5. Zip unzip karo → `script-1.txt` … `script-5.txt` padho; run log me bhi scripts print hoti hain

### Local se chalao (optional)

```bash
export GEMINI_API_KEY=your_key   # secret only via env — kabhi code me nahi
node scripts/script-test.mjs

# bina key ke sirf validation logic test karna ho:
node scripts/script-test.mjs --selftest
```
