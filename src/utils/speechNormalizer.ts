/**
 * Speech Normalizer Utility for Neural Text-to-Speech (Edge-TTS / Gemini)
 *
 * Transforms written text, markdown, abbreviations, currencies, and typography
 * into natural, fluent phonetic English/multilingual representations.
 */

export interface SpeechNormalizationResult {
    originalText: string;
    speechText: string;
}

/**
 * Normalizes text for optimal neural audio synthesis.
 * Solves:
 *  - Unicode curly quotes ('’' U+2019) breaking possessives and contractions (India's, it's)
 *  - Markdown delimiters (**, *, _, ##, ``) being vocalized as "asterisk asterisk"
 *  - Abbreviations (e.g., i.e., vs.) being read as "e dot g dot"
 *  - Acronyms (AI, RBI, PM, CEO) being mispronounced as words or slurred
 *  - Currency notations (₹100 Cr, $50M) being read as "symbol one zero zero C R"
 *  - Raw URLs, social handles, and RSS wire agency noise being spelled out
 */
export function normalizeForSpeech(text: string, lang: string = 'en'): string {
    if (!text || typeof text !== 'string') return '';

    let s = text;

    // -------------------------------------------------------------
    // 1. Remove HTML Tags & URLs
    // -------------------------------------------------------------
    s = s.replace(/<[^>]*>/g, ' ');
    s = s.replace(/https?:\/\/\S+/gi, ' ');
    s = s.replace(/www\.\S+/gi, ' ');

    // -------------------------------------------------------------
    // 2. Strip RSS Agency Bylines & Bracketed Noise (Run first before dash replacement)
    // -------------------------------------------------------------
    // e.g., "NEW DELHI (PTI) —", "MUMBAI (Reuters):", "[Read More]", "(Source: ANI)"
    s = s.replace(/^[A-Z\s,]+(?:\(PTI\)|\(Reuters\)|\(ANI\)|\(AFP\)|\(IANS\)|\(AP\))\s*[:\-—–,]\s*/i, '');
    s = s.replace(/\[(?:Read More|Exclusive|Watch Video|Photos?|Live Updates?)[^\]]*\]/gi, ' ');

    // -------------------------------------------------------------
    // 3. Normalize Unicode Typography to Standard Speech Equivalents
    // -------------------------------------------------------------
    // Convert curly apostrophes / quotes to standard ASCII single quote without spaces
    s = s.replace(/[\u2018\u2019\u201A\u201B\u0060\u00B4]/g, "'");
    // Convert curly double quotes to standard double quotes
    s = s.replace(/[\u201C\u201D\u201E\u201F]/g, '"');
    // Convert em-dash (—) and en-dash (–) to comma-pause for natural speech cadence
    s = s.replace(/[\u2013\u2014]/g, ', ');
    // Convert ellipsis (…) to three dots
    s = s.replace(/\u2026/g, '...');
    // Replace bullet points and list markers with period for sentence boundary
    s = s.replace(/[\u2022\u2023\u25E6\u2043\u2219\u25CB\u25CF]/g, '. ');

    // -------------------------------------------------------------
    // 4. Strip Markdown Formatting Delimiters
    // -------------------------------------------------------------
    // Strip bold/italic markdown (**text**, *text*, __text__, _text_)
    s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
    s = s.replace(/\*([^*]+)\*/g, '$1');
    s = s.replace(/__([^_]+)__/g, '$1');
    s = s.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '$1');
    // Strip strikethrough (~~text~~)
    s = s.replace(/~~([^~]+)~~/g, '$1');
    // Strip headers (#, ##, ###, ####)
    s = s.replace(/^#{1,6}\s+/gm, '');
    // Strip inline code blocks (`code`)
    s = s.replace(/`([^`]+)`/g, '$1');
    // Strip markdown links [Anchor](url) -> Anchor
    s = s.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    // Strip standalone stray asterisks, hashtags, and tildes
    s = s.replace(/[*#~]/g, ' ');

    // -------------------------------------------------------------
    // 5. Expand Common Conversational & News Abbreviations
    // -------------------------------------------------------------
    s = s.replace(/\be\.g\.,?\s*/gi, 'for example, ');
    s = s.replace(/\bi\.e\.,?\s*/gi, 'that is, ');
    s = s.replace(/\bvs\.?(?=\s|$|,)/gi, 'versus');
    s = s.replace(/\bapprox\.?(?=\s|$|,)/gi, 'approximately');
    s = s.replace(/\bdept\.?(?=\s|$|,)/gi, 'department');
    s = s.replace(/\bgovt\.?(?=\s|$|,)/gi, 'government');
    s = s.replace(/\bmin\.?\b(?=\s*\d|\s*(?:ago|wait|read))/gi, 'minutes');
    s = s.replace(/\bhr\.?\b(?=\s*\d|\s*(?:ago|wait|read))/gi, 'hours');
    s = s.replace(/\bsec\.?\b(?=\s*\d|\s*(?:ago|wait|read))/gi, 'seconds');
    s = s.replace(/\b24\/7\b/gi, 'twenty-four seven');

    // -------------------------------------------------------------
    // 6. Expand Indian Financial Scale & Currencies (₹, Rs.)
    // -------------------------------------------------------------
    // ₹100 Cr / Rs 100 Crore / Rs. 100 Cr -> "100 crore rupees"
    s = s.replace(/(?:₹|Rs\.?)\s*(\d+(?:\.\d+)?)\s*(?:Cr|Crore|crores?)\b/gi, '$1 crore rupees');
    // ₹50 Lakh / Rs 50 L -> "50 lakh rupees"
    s = s.replace(/(?:₹|Rs\.?)\s*(\d+(?:\.\d+)?)\s*(?:L|Lakh|lakhs?)\b/gi, '$1 lakh rupees');
    // Plain ₹500 / Rs 500 -> "500 rupees"
    s = s.replace(/(?:₹|Rs\.?)\s*(\d+(?:\.\d+)?)\b/gi, '$1 rupees');

    // -------------------------------------------------------------
    // 7. Expand Global Currencies ($, €, £) with Financial Multipliers
    // -------------------------------------------------------------
    // $50B / $50 Billion -> "50 billion dollars"
    s = s.replace(/\$\s*(\d+(?:\.\d+)?)\s*(?:B|Billion|billions?)\b/gi, '$1 billion dollars');
    // $50M / $50 Million -> "50 million dollars"
    s = s.replace(/\$\s*(\d+(?:\.\d+)?)\s*(?:M|Million|millions?)\b/gi, '$1 million dollars');
    // $50K -> "50 thousand dollars"
    s = s.replace(/\$\s*(\d+(?:\.\d+)?)\s*K\b/gi, '$1 thousand dollars');
    // Plain $500 -> "500 dollars"
    s = s.replace(/\$\s*(\d+(?:\.\d+)?)\b/g, '$1 dollars');

    // Euro & Pound equivalents
    s = s.replace(/€\s*(\d+(?:\.\d+)?)\s*(?:B|Billion)\b/gi, '$1 billion euros');
    s = s.replace(/€\s*(\d+(?:\.\d+)?)\s*(?:M|Million)\b/gi, '$1 million euros');
    s = s.replace(/€\s*(\d+(?:\.\d+)?)\b/g, '$1 euros');
    s = s.replace(/£\s*(\d+(?:\.\d+)?)\s*(?:B|Billion)\b/gi, '$1 billion pounds');
    s = s.replace(/£\s*(\d+(?:\.\d+)?)\s*(?:M|Million)\b/gi, '$1 million pounds');
    s = s.replace(/£\s*(\d+(?:\.\d+)?)\b/g, '$1 pounds');

    // -------------------------------------------------------------
    // 8. Percentages, Units & Speeds
    // -------------------------------------------------------------
    // 25% or 25.5% -> "25 percent"
    s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, '$1 percent');
    // 100km/h or 100 kmph -> "100 kilometers per hour"
    s = s.replace(/(\d+)\s*(?:km\/h|kmph)\b/gi, '$1 kilometers per hour');
    // 60mph -> "60 miles per hour"
    s = s.replace(/(\d+)\s*mph\b/gi, '$1 miles per hour');
    // 32°C -> "32 degrees Celsius"
    s = s.replace(/(\d+)\s*°\s*C\b/gi, '$1 degrees Celsius');
    // 98°F -> "98 degrees Fahrenheit"
    s = s.replace(/(\d+)\s*°\s*F\b/gi, '$1 degrees Fahrenheit');

    // -------------------------------------------------------------
    // 9. Punctuating Crucial Acronyms for Distinct Articulation
    // -------------------------------------------------------------
    // AI -> A.I. (prevents pronouncing as "ay")
    s = s.replace(/\bAI\b\.?/g, (m) => m.endsWith('.') ? 'A.I.' : 'A.I.');
    s = s.replace(/\bRBI\b\.?/g, (m) => m.endsWith('.') ? 'R.B.I.' : 'R.B.I.');
    s = s.replace(/\bBCCI\b\.?/g, (m) => m.endsWith('.') ? 'B.C.C.I.' : 'B.C.C.I.');
    s = s.replace(/\bISRO\b\.?/g, (m) => m.endsWith('.') ? 'I.S.R.O.' : 'I.S.R.O.');
    s = s.replace(/\bPM\b\.?/g, (m) => m.endsWith('.') ? 'P.M.' : 'P.M.');
    s = s.replace(/\bCM\b\.?/g, (m) => m.endsWith('.') ? 'C.M.' : 'C.M.');
    s = s.replace(/\bFIR\b\.?/g, (m) => m.endsWith('.') ? 'F.I.R.' : 'F.I.R.');
    s = s.replace(/\bUPI\b\.?/g, (m) => m.endsWith('.') ? 'U.P.I.' : 'U.P.I.');
    s = s.replace(/\bGST\b\.?/g, (m) => m.endsWith('.') ? 'G.S.T.' : 'G.S.T.');
    s = s.replace(/\bCEO\b\.?/g, (m) => m.endsWith('.') ? 'C.E.O.' : 'C.E.O.');
    s = s.replace(/\bCFO\b\.?/g, (m) => m.endsWith('.') ? 'C.F.O.' : 'C.F.O.');
    s = s.replace(/\bCTO\b\.?/g, (m) => m.endsWith('.') ? 'C.T.O.' : 'C.T.O.');
    s = s.replace(/\bED\b(?=\s+directorate|\s+investigates|\s+raids|\s+summons)/gi, 'E.D.');

    // -------------------------------------------------------------
    // 10. Preserve Contractions & Possessives (Crucial Fix)
    // -------------------------------------------------------------
    // Ensure words like India's, Apple's, it's, don't, can't, didn't NEVER have space around the apostrophe
    s = s.replace(/([a-zA-Z0-9])\s*'\s*([sStTdDmMvVrRlL]{1,2})\b/g, "$1'$2");

    // Replace '&' with 'and'
    s = s.replace(/&/g, ' and ');

    // -------------------------------------------------------------
    // 11. Final Character Cleansing (Safe for English + Indian Languages)
    // -------------------------------------------------------------
    // Retains standard ASCII, Latin accents, Devanagari, and common punctuation
    s = s.replace(/[^\x20-\x7E\u0900-\u097F\u00A0-\u024F.,!?'"-\s]/g, ' ');

    // Prevent double periods like "C.E.O.." while preserving ellipsis "..."
    s = s.replace(/(?<!\.)\.\.(?!\.)/g, '.');

    // Collapse multiple whitespace
    s = s.replace(/\s+/g, ' ').trim();

    return s;
}
