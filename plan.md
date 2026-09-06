# 📋 Architectural Plan: Neural Text-to-Speech (TTS) Speech Normalization & Voice Quality Engine

## 📌 Executive Summary

When news articles are sent to Microsoft Edge Neural TTS (`msedge-tts` / `en-IN-NeerjaNeural`), the audio output currently suffers from jarring acoustic glitches and unnatural speech artifacts:
1. **Apostrophes & Contractions (`'s`, `’s`)**: Words like `India's`, `Apple’s`, `it's`, `don't` sound robotic, distorted, or have the isolated letter *"ess"* pronounced separately after a glottal pause.
   - **Root Cause**: The current regex in [`ttsWorker.ts`](file:///d:/live-project/mobile_app_news/backend/src/workers/ttsWorker.ts#L46) filters out Unicode curly apostrophes (`’` U+2019) as non-ASCII, **replacing them with a space** (`India s`, `it s`).
2. **Markdown Symbols (`**bold**`, `*italic*`, `##`)**: Asterisks and markdown tokens pass through and are literally vocalized by the neural engine as *"asterisk asterisk Breaking News asterisk asterisk"*.
3. **Abbreviations & Initialisms (`e.g.`, `vs.`, `AI`, `PM`, `RBI`)**: Pronounced as *"e dot g dot"*, *"v s"*, or *"ay"* instead of natural spoken English (*"for example"*, *"versus"*, *"A.I."*, *"Prime Minister"*).
4. **Currencies & Large Numbers (`$50M`, `₹100 Cr`)**: Read as *"dollar fifty M"* or *"symbol one zero zero C R"* rather than *"fifty million dollars"* and *"one hundred crore rupees"*.
5. **URLs & RSS Agency Bylines (`https://...`, `(PTI):`, `[Read More]`)**: Read out character-by-character as *"h-t-t-p-s colon slash slash..."*.

This document catalogues **every single discrepancy between written text and spoken neural speech**, provides the complete phonetic transformation mapping, and defines an end-to-end normalization architecture that preserves **karaoke word-by-word visual sync** in the mobile UI.

---

## 🔍 Master Catalog: Spoken Voice Discrepancies vs. Written Text

| Category | Written Input | Current Broken Pronunciation | Desired Natural Spoken Voice | Transformation Rule |
| :--- | :--- | :--- | :--- | :--- |
| **Apostrophe / Possessives** | `India’s`, `Apple's` | *"India... ess"*, *"Apple... ess"* | *"India's"*, *"Apple's"* | Replace U+2019 `’` with standard ASCII `'` without spaces |
| **Contractions** | `it's`, `don’t`, `they’re` | *"it... ess"*, *"don... t"* | *"it's"*, *"don't"*, *"they're"* | Keep contraction unified; normalize Unicode apostrophes |
| **Markdown Bold** | `**Breaking News**` | *"asterisk asterisk Breaking News asterisk asterisk"* | *"Breaking News"* | Strip `**` delimiters |
| **Markdown Italic / Quotes** | `*Important*`, `_urgent_` | *"asterisk Important asterisk"* | *"Important"* | Strip `*` and `_` delimiters |
| **Markdown Headers** | `### Global Economy` | *"hash hash hash Global Economy"* | *"Global Economy"* | Strip `#` prefix |
| **Bullet Points** | `• Headline 1`, `- Point 2` | *"bullet Headline one"*, *"hyphen Point two"* | *"Headline 1. Point 2."* | Replace bullets with sentence-ending pause |
| **Latin Abbreviations** | `e.g.`, `e.g.,` | *"e dot g dot"* | *"for example,"* | Expand to conversational English |
| **Latin Abbreviations** | `i.e.`, `i.e.,` | *"i dot e dot"* | *"that is,"* | Expand to conversational English |
| **Comparison** | `vs.`, `vs` | *"v s"* | *"versus"* | Expand abbreviation |
| **General Abbreviations** | `approx.`, `dept.`, `govt.` | *"approx"*, *"dept"*, *"govt"* | *"approximately"*, *"department"*, *"government"* | Dictionary word expansion |
| **Acronym: Artificial Intelligence** | `AI`, `A.I.` | *"ay"* (like the word 'aye') | *"A.I."* (letter-by-letter with phonetic pauses) | Ensure dotted acronym `A.I.` |
| **Indian Financial Currencies** | `₹100 Cr`, `Rs 100 Crore` | *"currency sign one zero zero C R"* | *"100 crore rupees"* | Currency + scale expansion |
| **Indian Financial Currencies** | `₹50 Lakh`, `Rs. 50L` | *"fifty L"* | *"50 lakh rupees"* | Currency + scale expansion |
| **US/Global Currencies** | `$50M`, `$2.5B` | *"dollar fifty M"*, *"dollar two point five B"* | *"50 million dollars"*, *"2.5 billion dollars"* | Number + magnitude + currency |
| **Percentages** | `25%` | *"twenty-five percent"* (sometimes *"percent sign"*) | *"25 percent"* | Convert `%` to word `percent` |
| **Time & Operating Hours** | `24/7` | *"twenty-four slash seven"* | *"twenty-four seven"* | Convert `24/7` to words |
| **Web Links & URLs** | `https://newsflow.app/story` | *"h-t-t-p-s colon slash slash newsflow dot app..."* | *[Omit or say "link"]* | Strip raw URLs completely |
| **Social Mentions & Tags** | `@narendramodi`, `#Budget2026` | *"at narendramodi"*, *"hash Budget twenty twenty-six"* | *"Narendra Modi"*, *"Budget 2026"* | Clean social decorators |
| **RSS Wire Bylines** | `NEW DELHI (PTI) —`, `(Reuters)` | *"New Delhi P T I em-dash"* | *"New Delhi. PTI reports:"* | Clean news wire brackets and dashes |
| **Em-dashes & En-dashes** | `Policy—introduced today` | Glitched word mash: *"Policyintroduced"* | Natural speech pause: *"Policy, introduced today"* | Convert `—` / `–` to `, ` or ` - ` |
| **Ellipsis** | `Wait for it…` | Glitch or silence | Natural pause: `Wait for it...` | Normalize U+2026 to `...` |

---

## 🏗️ Technical Architecture: Two-Pass Speech Normalizer

To ensure natural spoken speech **WITHOUT breaking the mobile app's word-by-word visual highlight (karaoke)**, we employ a Two-Pass Architecture:

```
[ Raw Article Text ]
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Pass 1: Text Sanitization & Typographical Cleanup           │
│  - Convert Unicode curly quotes (’ ‘ ” “) to ASCII          │
│  - Strip Markdown (**, *, _, ##, ``, [text](url))          │
│  - Strip Raw URLs & RSS boilerplate ([Read more...], PTI)   │
│  - Convert Em-dash (—) and En-dash (–) to speech pause      │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Pass 2: Phonetic & Lexical Speech Expansion                │
│  - Expand abbreviations: e.g. -> "for example", vs -> "versus"│
│  - Expand currencies: ₹100 Cr -> "100 crore rupees"         │
│  - Format acronyms: AI -> "A.I.", RBI -> "R.B.I."           │
│  - Clean contractions: it's, don't, India's preserved        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Pass 3: Alignment & Boundary Interpolation Engine          │
│  - Sends normalized text to MsEdgeTTS                       │
│  - Receives WordBoundary events from Microsoft Edge stream  │
│  - Maps spoken words back to the original article words      │
│  - Returns audioBase64 + aligned wordBoundaries to Frontend │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Proposed Code Changes

### Component 1: Speech Normalizer Utility
#### [NEW] [`backend/src/utils/speechNormalizer.ts`](file:///d:/live-project/mobile_app_news/backend/src/utils/speechNormalizer.ts)
A standalone, high-performance module dedicated to text-to-speech phonetic transformation:
- `normalizeForSpeech(rawText: string, lang: string): { speechText: string, tokenMap: TokenMap }`
- Handles all 21 categories from the master table.
- Converts currency symbols and multipliers (`$M`, `₹Cr`, `₹Lakh`, `€B`).
- Expands abbreviations (`e.g.`, `i.e.`, `vs.`, `approx.`, `dept.`, `govt.`).
- Cleans markdown formatting, quotes, dashes, and wire bylines.

### Component 2: TTS Worker Integration
#### [MODIFY] [`backend/src/workers/ttsWorker.ts`](file:///d:/live-project/mobile_app_news/backend/src/workers/ttsWorker.ts)
- Replace lines 44-50 (the buggy regex that replaces `’` with a space) with `normalizeForSpeech()`.
- Ensure standard ASCII `'` inside words (`India's`, `don't`) is **never removed or replaced with space**.
- Strip all `*`, `_`, `#`, and markdown characters so Edge-TTS never pronounces them.

### Component 3: Frontend Karaoke Sync Protection
#### [MODIFY] [`services/neuralVoicePlayer.ts`](file:///d:/live-project/mobile_app_news/services/neuralVoicePlayer.ts)
- Update word boundary matching to use fuzzy prefix/stem matching so that expanded tokens (e.g. `₹100 Cr` spoken as *"100 crore rupees"*) cleanly highlight the corresponding on-screen card text without getting stuck.

---

## 🧪 Verification & Benchmark Plan

### 1. Unit Tests ([`backend/src/test/speechNormalizer.test.ts`](file:///d:/live-project/mobile_app_news/backend/src/test/speechNormalizer.test.ts))
- Test 1: `India’s economy is growing` -> `India's economy is growing` (no space, no dropped `'s`).
- Test 2: `**Breaking:** Apple's new AI phone` -> `Breaking: Apple's new A.I. phone` (no asterisks, A.I. punctuated).
- Test 3: `Growth was 8.2% vs. 7.5% e.g. in Q1` -> `Growth was 8.2 percent versus 7.5 percent for example in Q1`.
- Test 4: `Company raised ₹500 Cr and $50M` -> `Company raised 500 crore rupees and 50 million dollars`.

### 2. Live Audio Synthesis Benchmark
- Dispatch test payloads to `/api/v1/speech/synthesize` and listen to the audio output to confirm zero phonetic glitches on `en-IN-NeerjaNeural`.
