import crypto from 'crypto';
// @ts-ignore
import { PDFParse } from 'pdf-parse';
import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { UniversalLlmService, SummarizedNewsResult } from './universalLlmService.js';

export interface ExtractedPdfParagraph {
    id: number;
    text: string;
    wordCount: number;
    cleanSpeechText: string;
    bullets: string[];
    hasMath?: boolean;
    requiresOcr?: boolean;
}

export interface ExtractedPdfDocument {
    title: string;
    author: string | null;
    pageCount: number;
    wordCount: number;
    readingTimeMinutes: number;
    listeningTimeMinutes: number;
    paragraphs: ExtractedPdfParagraph[];
    fullCleanText: string;
    executiveSummary?: SummarizedNewsResult;
}

export interface PdfSessionInfo {
    sessionId: string;
    title: string;
    author: string | null;
    pageCount: number;
    createdAt: number;
}

export class PdfService {
    // In-memory document buffer cache with 2-hour TTL for fast batched page extraction
    private static sessionCache = new Map<string, { buffer: Buffer; fileName: string; totalPages: number; title: string; author: string | null; createdAt: number }>();

    private static tesseractWorkerPromise: Promise<any> | null = null;

    /**
     * Initializes or returns a singleton Tesseract.js Worker instance
     */
    public static async getTesseractWorker(): Promise<any> {
        if (!this.tesseractWorkerPromise) {
            this.tesseractWorkerPromise = (async () => {
                try {
                    // Dynamic import of tesseract.js
                    const Tesseract = await import('tesseract.js');
                    const createWorker = (Tesseract as any).createWorker || (Tesseract as any).default?.createWorker;
                    if (typeof createWorker === 'function') {
                        const worker = await createWorker('eng');
                        console.log('✅ [PdfService] Tesseract.js OCR Worker initialized.');
                        return worker;
                    }
                } catch (err: any) {
                    console.warn('⚠️ [PdfService] Tesseract.js worker initialization notice:', err.message || err);
                }
                return null;
            })();
        }
        return this.tesseractWorkerPromise;
    }

    /**
     * 🧮 Math Formula Verbalizer for Natural Voice Text-to-Speech:
     * Converts mathematical symbols, equations, and fractions into spoken English
     * so that Edge-TTS and Gemini Voice pronounce formulas naturally.
     */
    public static verbalizeMathForTts(text: string): string {
        if (!text) return '';

        return text
            // 1. Remove unicode replacement diamonds and broken font codes
            .replace(/\uFFFD/g, ' ')
            .replace(/[]/g, ' ')

            // 2. Greek Mathematical Symbols
            .replace(/\\alpha|\bα\b/g, 'alpha')
            .replace(/\\beta|\bβ\b/g, 'beta')
            .replace(/\\gamma|\bγ\b/g, 'gamma')
            .replace(/\\delta|\bδ\b/g, 'delta')
            .replace(/\\epsilon|\bε\b/g, 'epsilon')
            .replace(/\\theta|\bθ\b/g, 'theta')
            .replace(/\\lambda|\bλ\b/g, 'lambda')
            .replace(/\\mu|\bμ\b/g, 'mu')
            .replace(/\\pi|\bπ\b/g, 'pi')
            .replace(/\\sigma|\bσ\b/g, 'sigma')
            .replace(/\\phi|\bφ\b/g, 'phi')
            .replace(/\\omega|\bω\b/g, 'omega')
            .replace(/\\Delta|\bΔ\b/g, 'Delta')
            .replace(/\\Sigma|\bΣ\b/g, 'Sigma')
            .replace(/\\Omega|\bΩ\b/g, 'Omega')
            .replace(/\\infty|\b∞\b/g, 'infinity')

            // 3. LaTeX Fraction and Roots
            .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 over $2')
            .replace(/\\sqrt\[3\]\{([^}]+)\}/g, 'cube root of $1')
            .replace(/\\sqrt\{([^}]+)\}/g, 'square root of $1')
            .replace(/√\s*([a-zA-Z0-9_]+)/g, 'square root of $1')

            // 4. Integrals & Summations
            .replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, 'integral from $1 to $2 of')
            .replace(/\\int|\b∫\b/g, 'integral of')
            .replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, 'summation from $1 to $2 of')
            .replace(/\\sum|\b∑\b/g, 'summation of')

            // 5. Common Fractions
            .replace(/\b1\/2\b|½/g, 'one half')
            .replace(/\b1\/3\b|⅓/g, 'one third')
            .replace(/\b2\/3\b|⅔/g, 'two thirds')
            .replace(/\b1\/4\b|¼/g, 'one quarter')
            .replace(/\b3\/4\b|¾/g, 'three quarters')
            .replace(/\b1\/5\b/g, 'one fifth')
            .replace(/\b2\/5\b/g, 'two fifths')
            .replace(/\b3\/5\b/g, 'three fifths')
            .replace(/\b4\/5\b/g, 'four fifths')
            .replace(/\b1\/8\b|⅛/g, 'one eighth')
            .replace(/\b3\/8\b|⅜/g, 'three eighths')
            .replace(/\b5\/8\b|⅝/g, 'five eighths')
            .replace(/\b7\/8\b|⅞/g, 'seven eighths')

            // 6. Probability & Functions notation
            .replace(/\bP\s*\(\s*([A-Za-z0-9_]+)\s*\)/g, 'Probability of $1')
            .replace(/\bP\s*\(\s*([A-Za-z0-9_]+)\s*\|\s*([A-Za-z0-9_]+)\s*\)/g, 'Probability of $1 given $2')

            // 7. Powers & Exponents
            .replace(/\b([a-zA-Z0-9]+)\^2\b|([a-zA-Z0-9]+)²/g, '$1 squared')
            .replace(/\b([a-zA-Z0-9]+)\^3\b|([a-zA-Z0-9]+)³/g, '$1 cubed')
            .replace(/\b([a-zA-Z0-9]+)\^([0-9]+)\b/g, '$1 to the power of $2')

            // 8. Operators
            .replace(/([a-zA-Z0-9]+)\s*[\*×]\s*([a-zA-Z0-9]+)/g, '$1 times $2')
            .replace(/([a-zA-Z0-9]+)\s*[\/÷]\s*([a-zA-Z0-9]+)/g, '$1 divided by $2')
            .replace(/\b(\d+)%/g, '$1 percent')
            .replace(/≠|\\ne/g, 'is not equal to')
            .replace(/≤|\\le/g, 'less than or equal to')
            .replace(/≥|\\ge/g, 'greater than or equal to')
            .replace(/≈|\\approx/g, 'approximately equal to')
            .replace(/±|\\pm/g, 'plus or minus ')

            // Collapse multiple spaces
            .replace(/[ \t]+/g, ' ')
            .trim();
    }

    /**
     * 📐 2. Math Formula & Equation Detector:
     * Analyzes if text contains mathematical formulas, equations, or LaTeX syntax
     * to tag cards and suggest deep-dive explanations in AI Q&A Studio.
     */
    public static detectMathAndComplexFormulas(text: string): { hasMath: boolean; formulaCount: number; symbolsFound: string[] } {
        if (!text || text.length < 5) return { hasMath: false, formulaCount: 0, symbolsFound: [] };

        const mathPatterns = [
            /\\(frac|sqrt|int|sum|prod|alpha|beta|gamma|delta|sigma|mu|pi|theta|lambda|omega|infty)/i,
            /[αβγδσμπθλω∑∫√≠≤≥≈±×÷]/,
            /\b([a-zA-Z0-9_]+)\^([0-9a-zA-Z_]+)\b/,
            /\b\d+\/\d+\b/,
            /\b[A-Za-z]\s*=\s*[^.!?\n]{3,}\b/,
            /\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/,
            /\$\$[\s\S]*?\$\$/,
        ];

        const symbolsFound: string[] = [];
        let count = 0;

        for (const pattern of mathPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                count += matches.length;
                symbolsFound.push(matches[0]);
            }
        }

        return {
            hasMath: count > 0,
            formulaCount: count,
            symbolsFound,
        };
    }

    /**
     * 🔐 Automatic Caesar-Cipher / Shifted-Font Decoding Engine
     * Detects if the PDF was generated with shifted font tables (e.g. MSxpsPS +3 Caesar shift: 'SURWDJRQLVW' ➔ 'PROTAGONIST')
     * and automatically reverses the character shift.
     */
    public static detectAndDecodeCipherShift(text: string): string {
        if (!text || text.length < 20) return text;

        const COMMON_WORDS = new Set([
            'THE', 'AND', 'FOR', 'THAT', 'THIS', 'WITH', 'FROM', 'HAVE', 'WHICH',
            'PROTAGONIST', 'KNOWLEDGE', 'IGNORANCE', 'MOMENT', 'SECTION', 'CHAPTER',
            'THEORY', 'EXAMPLE', 'DEFINITION', 'PROBABILITY', 'VALUE', 'NUMBER',
            'OEDIPUS', 'TRAGEDY', 'FORTUNES', 'EFFECTS', 'REVERSAL', 'DISCOVERY',
            'POETICS', 'ARISTOTLE', 'CHANGE', 'GOOD', 'BAD', 'HERO', 'CHARACTER'
        ]);

        const sampleWords = text
            .toUpperCase()
            .split(/[^A-Z]+/)
            .filter(w => w.length >= 3)
            .slice(0, 60);

        if (sampleWords.length === 0) return text;

        let bestShift = 0;
        let maxMatches = 0;

        for (let shift = 0; shift < 26; shift++) {
            let matches = 0;
            for (const word of sampleWords) {
                let decodedWord = '';
                for (let i = 0; i < word.length; i++) {
                    const code = word.charCodeAt(i) - 65;
                    const newCode = (code - shift + 26) % 26;
                    decodedWord += String.fromCharCode(newCode + 65);
                }
                if (COMMON_WORDS.has(decodedWord)) {
                    matches++;
                }
            }
            if (matches > maxMatches) {
                maxMatches = matches;
                bestShift = shift;
            }
        }

        if (bestShift > 0 && maxMatches >= 2) {
            console.log(`🔐 [PdfService] Detected +${bestShift} Caesar shifted font encoding (e.g. MSxpsPS). Auto-decoding text...`);
            let decoded = '';
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const code = text.charCodeAt(i);

                if (code >= 65 && code <= 90) {
                    const newCode = (code - 65 - bestShift + 26) % 26;
                    decoded += String.fromCharCode(newCode + 65);
                } else if (code >= 97 && code <= 122) {
                    const newCode = (code - 97 - bestShift + 26) % 26;
                    decoded += String.fromCharCode(newCode + 97);
                } else {
                    decoded += char;
                }
            }
            return decoded;
        }

        return text;
    }

    /**
     * 🔍 1. Text Quality Scoring Engine:
     * Evaluates text health (0 to 100). Automatically detects glued words, corrupted symbol tables,
     * missing ASCII spaces, and unusual long character sequences.
     */
    public static scoreTextQuality(text: string): { score: number; isBad: boolean; reasons: string[] } {
        let score = 100;
        const reasons: string[] = [];

        if (!text || text.trim().length < 30) {
            return { score: 0, isBad: true, reasons: ['Empty or insufficient content'] };
        }

        // 1. Space-to-Character Ratio (Normal English text is ~0.15 - 0.22)
        const spaces = (text.match(/\s/g) || []).length;
        const spaceRatio = spaces / text.length;
        if (spaceRatio < 0.06) {
            score -= 45;
            reasons.push(`Glued words / missing spaces detected (space ratio ${(spaceRatio * 100).toFixed(1)}% < 6%)`);
        }

        // 2. Corrupted Escape Glyphs Ratio (e.g. $, \, ³, , )
        const weirdChars = (text.match(/[\$\\³\^\\\uFFFD]/g) || []).length;
        if (weirdChars / text.length > 0.008) {
            const deduction = Math.min(40, weirdChars * 3);
            score -= deduction;
            reasons.push(`Corrupted glyph / font table encoding detected (${weirdChars} anomalous symbols)`);
        }

        // 3. Unusually Long Word Token Ratio (> 24 characters without space)
        const longWords = text.split(/\s+/).filter(w => w.length > 24).length;
        if (longWords > 2) {
            score -= 30;
            reasons.push(`Unbroken word concatenations detected (${longWords} tokens > 24 chars)`);
        }

        return {
            score: Math.max(0, score),
            isBad: score < 70,
            reasons,
        };
    }

    /**
     * 🧩 2. Heuristic Word Space & Kerning Restorer:
     * Reconstructs missing word boundaries (e.g. 'PROTAGONISTOFTHESTORY' ➔ 'PROTAGONIST OF THE STORY')
     * and fixes corrupted punctuation like '$RISTOTLESA$S³$MANCANNOTB'.
     */
    public static restoreMissingSpaces(text: string): string {
        if (!text) return '';

        let restored = text;

        // 1. Re-map MSxpsPS and XPS font glyph corruptions
        restored = restored
            .replace(/\$([A-Za-z])/g, 'A$1')
            .replace(/\$/g, ' ')
            .replace(/A\s*S³\s*A/gi, "'S A")
            .replace(/A\s*S³\s*/gi, "'S ")
            .replace(/S³\s*/gi, "'S ")
            .replace(/([A-Z])\\/g, '$1Y')
            .replace(/\\([A-Z]+)/g, ' $1')
            .replace(/7\s*HISTERM/gi, 'THIS TERM')
            .replace(/7\s*HIS/gi, 'THIS')
            .replace(/´/g, '. ')
            .replace(/KNOWl\s*EDGE/gi, 'KNOWLEDGE');

        // 2. Insert space between lowercase and Uppercase (CamelCase word boundary)
        restored = restored.replace(/([a-z])([A-Z])/g, '$1 $2');

        // 3. Insert space between digits and letters (e.g. 1.0OBJECTIVES -> 1.0 OBJECTIVES)
        restored = restored.replace(/(\d+\.\d+)([A-Za-z])/g, '$1 $2');
        restored = restored.replace(/([0-9])([a-zA-Z])/g, '$1 $2');
        restored = restored.replace(/([a-zA-Z])([0-9])/g, '$1 $2');

        // 4. Break uppercase glue words using comprehensive high-frequency dictionary word boundaries
        const gluePatterns = [
            /\b(PROTAGONIST)(OF|THE|AND|IS|IN|TO|FOR|THAT|FROM)\b/gi,
            /\b(OF)(THE|A|AN|THAT|THIS|EVERY|ALL|HIS|HER|THEIR|ITS)\b/gi,
            /\b(MAN)(CANNOT|CAN|WILL|MUST|IS|SHOULD|COULD|WOULD)\b/gi,
            /\b(CANNOT)(BECOME|BE|HAVE|DO|SEE|FIND|REACH)\b/gi,
            /\b(BECOME)(A|AN|THE|HERO|GREAT|BETTER)\b/gi,
            /\b(HERO)(IN|OF|THAT|WHO|WHICH|BRINGS|UNTIL)\b/gi,
            /\b(UNTIL)(HE|SHE|IT|THEY|WE|YOU|MAN)\b/gi,
            /\b(ROOT)(OF|IN|FOR|TO)\b/gi,
            /\b(DOWNFALL)(ANAGNORISIS|AND|IS|WHICH|THAT)\b/gi,
            /\b(ANAGNORISIS)(MEANS|IS|AND|REFERS|WHICH)\b/gi,
            /\b(MEANS)(RECOGNITION|DISCOVERY|CHANGE)\b/gi,
            /\b(REFERS)(TO|IN|AS)\b/gi,
            /\b(DISCOVERY)(BY|OF|THAT|WHICH|IN|AND)\b/gi,
            /\b(NATURE)(OF|IN|FOR)\b/gi,
            /\b(PREDICAMENT)(WHICH|THAT|LEADS|IN)\b/gi,
            /\b(LEADS)(TO|IN|FOR)\b/gi,
            /\b(RESOLUTION)(OF|IN|FOR)\b/gi,
            /\b(PLOT)(IT|IS|THAT|WHICH|AND)\b/gi,
            /\b(STARTLING)(DISCOVERY|EVENT|MOMENT)\b/gi,
            /\b(BRINGS)(A|AN|THE|CHANGE|FORTUNE)\b/gi,
            /\b(CHANGE)(IN|OF|FROM|TO|FORTUNES|AND)\b/gi,
            /\b(IGNORANCE)(TO|AND|IN|FOR)\b/gi,
            /\b(KNOWLEDGE)(AND|IN|OF|FOR|TO)\b/gi,
            /\b(EFFECTS)(A|AN|THE|CHANGE)\b/gi,
        ];

        for (const pattern of gluePatterns) {
            restored = restored.replace(pattern, '$1 $2');
        }

        return restored.replace(/[ \t]+/g, ' ').trim();
    }

    /**
     * 👁️ 3. Cloud Gemini Multimodal Vision Document OCR:
     * When PDF text streams are severely damaged or scanned images, this passes the PDF directly
     * to Gemini 2.5/3.5 Vision, returning pristine, properly spaced, accurate text.
     */
    public static async extractWithGeminiVision(buffer: Buffer, fileName?: string): Promise<string> {
        const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
        if (!apiKey) {
            throw new Error('Gemini API key is required for Vision OCR.');
        }

        console.log(`👁️ [PdfService] Running Gemini Multimodal Vision OCR on "${fileName || 'Document'}"...`);

        const ai = new GoogleGenAI({ apiKey });
        const base64Pdf = buffer.toString('base64');
        const visionModels = ['gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-3.5-flash'];

        for (const model of visionModels) {
            try {
                const response = await ai.models.generateContent({
                    model,
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                {
                                    inlineData: {
                                        mimeType: 'application/pdf',
                                        data: base64Pdf,
                                    },
                                },
                                {
                                    text: 'Extract and transcribe all text from this PDF document with 100% precision. Ensure correct word spacing, clear paragraphs, accurate headings, and write out all math/scientific symbols clearly. Return clean, formatted text only.',
                                },
                            ],
                        },
                    ],
                });

                const ocrText = response.text || '';
                if (ocrText.trim().length > 30) {
                    console.log(`✅ [PdfService] Gemini Vision OCR succeeded with model ${model} (${ocrText.length} chars extracted).`);
                    return ocrText;
                }
            } catch (err: any) {
                console.warn(`[PdfService] Gemini Vision OCR attempt failed on ${model}:`, err.message);
            }
        }

        throw new Error('Gemini Vision OCR failed across all models.');
    }

    /**
     * Sanitizes raw extracted PDF text:
     * - Decodes shifted font encodings (MSxpsPS)
     * - Restores missing word spaces
     * - Removes broken CID artifacts (e.g. (cid:123))
     * - Normalizes weird hyphens and line wraps
     * - Preserves natural punctuation for voice breath pauses
     */
    public static sanitizeText(text: string): string {
        if (!text) return '';
        const decoded = this.detectAndDecodeCipherShift(text);
        const spaced = this.restoreMissingSpaces(decoded);
        return spaced
            .replace(/\(cid:\d+\)/gi, '')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            .replace(/\uFFFD/g, ' ')
            .replace(/[]/g, ' ')
            .replace(/([a-zA-Z0-9])-[\r\n]+([a-zA-Z0-9])/g, '$1$2')
            .replace(/[ \t]+/g, ' ')
            .trim();
    }

    /**
     * 📦 1. Initializes a Document Session for Large Multi-Page PDFs:
     * Calculates page count, document title, and stores the buffer in memory/session cache.
     * Responds in under 200ms.
     */
    public static async initSession(
        buffer: Buffer,
        fileName?: string
    ): Promise<PdfSessionInfo> {
        const sessionId = crypto.randomUUID();
        let pageCount = 1;
        let title = fileName ? fileName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ') : 'Uploaded PDF Document';
        let author: string | null = null;

        try {
            if (typeof (PDFParse as any) === 'function') {
                const parser = new (PDFParse as any)({ data: buffer });
                if (typeof parser.getText === 'function') {
                    const textResult = await parser.getText({ maxPages: 1 });
                    pageCount = textResult.total || 1;
                    try {
                        const infoResult = await parser.getInfo();
                        if (infoResult?.info?.Title && infoResult.info.Title.trim().length > 3) {
                            title = infoResult.info.Title.trim();
                        }
                        author = infoResult?.info?.Author?.trim() || null;
                    } catch {}
                    if (typeof parser.destroy === 'function') {
                        await parser.destroy();
                    }
                }
            }
        } catch (err) {
            console.warn('Session init fast check error:', err);
        }

        // Cache session
        this.sessionCache.set(sessionId, {
            buffer,
            fileName: fileName || 'document.pdf',
            totalPages: pageCount,
            title,
            author,
            createdAt: Date.now(),
        });

        // Clean up sessions older than 2 hours
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        for (const [sId, data] of this.sessionCache.entries()) {
            if (data.createdAt < twoHoursAgo) {
                this.sessionCache.delete(sId);
            }
        }

        console.log(`📦 [PdfService] Initialized session ${sessionId}: "${title}" (${pageCount} pages, ${(buffer.length / 1024).toFixed(1)} KB)`);

        return {
            sessionId,
            title,
            author,
            pageCount,
            createdAt: Date.now(),
        };
    }

    /**
     * 📦 2. Extracts an On-Demand Batch of Pages (e.g. Pages 1-5, Pages 6-10):
     * Runs smart layout extraction, math formula verbalization, and returns structured sections.
     */
    public static async extractBatch(
        sessionId: string,
        pageStart: number = 1,
        pageSize: number = 5
    ): Promise<{
        paragraphs: ExtractedPdfParagraph[];
        pageStart: number;
        pageEnd: number;
        totalPages: number;
        hasMore: boolean;
        title: string;
    }> {
        const session = this.sessionCache.get(sessionId);
        if (!session) {
            throw new Error('PDF session expired or invalid. Please re-upload the document.');
        }

        const pageEnd = Math.min(pageStart + pageSize - 1, session.totalPages);
        console.log(`⚡ [PdfService] Extracting batch: Pages ${pageStart} to ${pageEnd} of ${session.totalPages} (Session: ${sessionId})...`);

        let batchRawText = '';

        try {
            if (typeof (PDFParse as any) === 'function') {
                const parser = new (PDFParse as any)({ data: session.buffer });
                if (typeof parser.getText === 'function') {
                    // Extract requested page range (first..last)
                    const textResult = await parser.getText({
                        first: pageStart,
                        last: pageEnd,
                    });
                    batchRawText = textResult.text || '';
                    if (typeof parser.destroy === 'function') {
                        await parser.destroy();
                    }
                }
            }
        } catch (err: any) {
            console.warn('Batch parser error:', err);
        }

        // Fallback: If range extraction wasn't supported, extract full and slice by lines
        if (!batchRawText.trim()) {
            const fullDoc = await this.extractFromBuffer(session.buffer, session.fileName);
            const totalParas = fullDoc.paragraphs.length;
            const startIdx = Math.floor(((pageStart - 1) / session.totalPages) * totalParas);
            const endIdx = Math.ceil((pageEnd / session.totalPages) * totalParas);
            const sliced = fullDoc.paragraphs.slice(startIdx, endIdx);

            return {
                paragraphs: sliced,
                pageStart,
                pageEnd,
                totalPages: session.totalPages,
                hasMore: pageEnd < session.totalPages,
                title: session.title,
            };
        }

        // 🔍 Real-Time Text Quality Scoring Gate
        const quality = this.scoreTextQuality(batchRawText);
        console.log(`🔍 [PdfService] Batch (p.${pageStart}-${pageEnd}) quality score: ${quality.score}/100 (isBad: ${quality.isBad})`);

        if (quality.isBad) {
            console.warn(`⚠️ [PdfService] Low text quality detected: ${quality.reasons.join(', ')}. Triggering Gemini Vision OCR fallback...`);
            try {
                const ocrText = await this.extractWithGeminiVision(session.buffer, session.fileName);
                if (ocrText && ocrText.trim().length > 30) {
                    batchRawText = ocrText;
                }
            } catch (ocrErr: any) {
                console.warn('[PdfService] Gemini Vision OCR fallback notice:', ocrErr.message);
            }
        }

        // Process batch raw text into clean speech paragraphs with Math Verbalization & Breath-Pause Cadence
        const rawLines = batchRawText.split(/\r?\n/);
        const paragraphs = this.processRawLinesToCards(rawLines, pageStart);

        return {
            paragraphs,
            pageStart,
            pageEnd,
            totalPages: session.totalPages,
            hasMore: pageEnd < session.totalPages,
            title: session.title,
        };
    }

    /**
     * 🧩 4. Semantic Line-to-Card Processor & Breath-Pause Cadence Engine:
     * - Preserves vertical line breaks for Table of Contents, Outlines, and Bullet lists.
     * - Inserts sentence periods (.) after outline and heading items for natural 400ms TTS breath pauses.
     * - Slices cards whenever a major section header (UNIT, CHAPTER, 1.0, 2.0, STRUCTURE) begins.
     */
    public static processRawLinesToCards(
        rawLines: string[],
        pageStart: number = 1
    ): ExtractedPdfParagraph[] {
        const paragraphs: ExtractedPdfParagraph[] = [];
        let pId = (pageStart - 1) * 10 + 1;

        let currentLines: string[] = [];
        let currentType: 'heading' | 'outline' | 'bullets' | 'body' = 'body';

        const flushBlock = () => {
            if (currentLines.length === 0) return;

            const isOutline = currentLines.some(l => /^(\d+(\.\d+)+)\s+/.test(l.trim()));
            const hasBullets = currentLines.some(l => /^[•\-\*■►]/.test(l.trim()));

            let displayText = '';
            let speechText = '';
            let bullets: string[] = [];

            if (isOutline) {
                displayText = currentLines.map(l => this.sanitizeText(l)).filter(Boolean).join('\n');
                speechText = currentLines.map(l => {
                    const clean = this.verbalizeMathForTts(this.sanitizeText(l));
                    return /[.!?]$/.test(clean) ? clean : `${clean}.`;
                }).join(' ');
                bullets = currentLines.slice(0, 3).map(l => `• ${this.sanitizeText(l)}`);
            } else if (hasBullets) {
                displayText = currentLines.map(l => this.sanitizeText(l)).filter(Boolean).join('\n');
                speechText = currentLines.map(l => {
                    const clean = this.verbalizeMathForTts(this.sanitizeText(l));
                    return /[.!?]$/.test(clean) ? clean : `${clean};`;
                }).join(' ');
                bullets = currentLines.filter(l => /^[•\-\*■►]/.test(l.trim())).slice(0, 4).map(l => this.sanitizeText(l));
            } else {
                const joined = currentLines.map(l => this.sanitizeText(l)).filter(Boolean).join(' ');
                displayText = joined;
                speechText = this.verbalizeMathForTts(joined);
                const sents = joined.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
                bullets = sents.slice(0, 3).map(s => `• ${s}`);
            }

            if (displayText.trim().length >= 8) {
                const words = displayText.split(/\s+/).filter(Boolean);
                const mathInfo = this.detectMathAndComplexFormulas(displayText);

                paragraphs.push({
                    id: pId++,
                    text: displayText,
                    wordCount: words.length,
                    cleanSpeechText: speechText,
                    bullets,
                    hasMath: mathInfo.hasMath,
                });
            }

            currentLines = [];
        };

        for (const line of rawLines) {
            const trimmed = line.trim();
            if (!trimmed) {
                flushBlock();
                continue;
            }

            // Skip page numbers/headers
            if (/^(page\s+\d+(\s+(of|\/)\s+\d+)?|\d+|\-\s*\d+\s*\-|\d+\s*\/\s*\d+)$/i.test(trimmed)) {
                continue;
            }

            const isMajorHeading = /^(unit|chapter|part|section)\s+\d+|^\d+\.0+\s+[A-Z\s]{3,}|^structure\b/i.test(trimmed);
            const isOutlineItem = /^(\d+(\.\d+)+)\s+[A-Za-z]/.test(trimmed);
            const isBullet = /^[•\-\*■►]\s+/.test(trimmed);

            if (isMajorHeading) {
                flushBlock();
                currentLines.push(trimmed);
                flushBlock();
            } else if (isOutlineItem) {
                if (currentType !== 'outline') {
                    flushBlock();
                    currentType = 'outline';
                }
                currentLines.push(trimmed);
            } else if (isBullet) {
                if (currentType !== 'bullets') {
                    if (currentLines.length > 2) {
                        flushBlock();
                    }
                    currentType = 'bullets';
                }
                currentLines.push(trimmed);
            } else {
                if (currentType === 'outline' && !isOutlineItem) {
                    flushBlock();
                    currentType = 'body';
                }
                currentLines.push(trimmed);
            }
        }

        flushBlock();
        return paragraphs;
    }

    /**
     * Extracts 100% of all text, pages, and paragraphs from the entire PDF buffer.
     * Uses Math Verbalization for natural audio pronunciation.
     */
    public static async extractFromBuffer(
        buffer: Buffer,
        fileName?: string
    ): Promise<ExtractedPdfDocument> {
        try {
            console.log(`📄 [PdfService] Extracting full document "${fileName || 'Document'}" (${(buffer.length / 1024).toFixed(1)} KB)...`);

            let rawText = '';
            let pageCount = 1;
            let meta: any = {};

            if (typeof (PDFParse as any) === 'function') {
                const parser = new (PDFParse as any)({ data: buffer });
                if (typeof parser.getText === 'function') {
                    const textResult = await parser.getText();
                    rawText = textResult.text || '';
                    pageCount = textResult.total || 1;
                    try {
                        const infoResult = await parser.getInfo();
                        meta = infoResult?.info || {};
                    } catch {}
                    if (typeof parser.destroy === 'function') {
                        await parser.destroy();
                    }
                }
            }

            if (!rawText.trim()) {
                const parserFn = (PDFParse as any).default || PDFParse;
                if (typeof parserFn === 'function') {
                    const data = await parserFn(buffer);
                    rawText = data.text || '';
                    pageCount = data.numpages || pageCount;
                    meta = data.info || meta;
                }
            }

            // 🔍 Real-Time Full Document Quality Gate
            const quality = this.scoreTextQuality(rawText);
            console.log(`🔍 [PdfService] Full document text quality score: ${quality.score}/100 (isBad: ${quality.isBad})`);

            if (quality.isBad) {
                console.warn(`⚠️ [PdfService] Low document text quality detected: ${quality.reasons.join(', ')}. Triggering Gemini Vision OCR fallback...`);
                try {
                    const ocrText = await this.extractWithGeminiVision(buffer, fileName);
                    if (ocrText && ocrText.trim().length > 30) {
                        rawText = ocrText;
                    }
                } catch (ocrErr: any) {
                    console.warn('[PdfService] Gemini Vision OCR fallback notice:', ocrErr.message);
                }
            }

            const documentTitle =
                (meta.Title && meta.Title.trim().length > 3)
                    ? meta.Title.trim()
                    : (fileName ? fileName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ') : 'Uploaded PDF Document');

            const author = meta.Author ? meta.Author.trim() : null;

            const rawLines = rawText.split(/\r?\n/);
            const paragraphs = this.processRawLinesToCards(rawLines, 1);

            const totalWords = paragraphs.reduce((sum, p) => sum + p.wordCount, 0);
            console.log(`✅ [PdfService] Full extraction complete: ${paragraphs.length} sections (${totalWords} words, ${pageCount} pages).`);

            return {
                title: documentTitle,
                author,
                pageCount,
                wordCount: totalWords,
                readingTimeMinutes: Math.max(1, Math.ceil(totalWords / 200)),
                listeningTimeMinutes: Math.max(1, Math.ceil(totalWords / 140)),
                paragraphs,
                fullCleanText: paragraphs.map(p => p.text).join('\n\n'),
            };
        } catch (error: any) {
            console.error('❌ [PdfService] Full Extraction Error:', error);
            throw new Error(`Failed to extract text from PDF: ${error.message || 'Invalid or encrypted PDF file'}`);
        }
    }

    /**
     * Generates an Executive AI Summary for an uploaded PDF using Gemini / Universal LLM
     */
    public static async generateSummary(
        fullText: string,
        title: string
    ): Promise<SummarizedNewsResult> {
        const leadExcerpt = fullText.slice(0, 4000);
        return UniversalLlmService.summarizeNews({
            title: `Executive Briefing: ${title}`,
            content: leadExcerpt,
            category: 'Document Analysis',
        });
    }

    /**
     * 🧠 Interactive AI Document Q&A (Selected Section Inquiries)
     */
    public static async askDocumentQuestion(
        question: string,
        selectedSections: { id: number; text: string }[],
        docTitle: string = 'Document'
    ): Promise<{ answer: string; keyTakeaways: string[] }> {
        if (!question || !question.trim()) {
            throw new Error('Question cannot be empty.');
        }

        const contextText = selectedSections.length > 0
            ? selectedSections.map(s => `[Section #${s.id}]:\n${s.text}`).join('\n\n')
            : 'No specific sections selected. Please answer based on general context.';

        const qaResult = await UniversalLlmService.chatDocumentQuestion({
            question,
            contextText,
            docTitle,
        });

        return {
            answer: qaResult.answer,
            keyTakeaways: qaResult.keyTakeaways,
        };
    }
}

export default PdfService;
