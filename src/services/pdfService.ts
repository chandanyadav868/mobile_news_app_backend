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

            // 2. Common Fractions
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

            // 3. Probability & Functions notation
            .replace(/\bP\s*\(\s*([A-Za-z0-9_]+)\s*\)/g, 'Probability of $1')
            .replace(/\bP\s*\(\s*([A-Za-z0-9_]+)\s*\|\s*([A-Za-z0-9_]+)\s*\)/g, 'Probability of $1 given $2')

            // 4. Powers & Exponents
            .replace(/\b([a-zA-Z0-9]+)\^2\b|([a-zA-Z0-9]+)²/g, '$1 squared')
            .replace(/\b([a-zA-Z0-9]+)\^3\b|([a-zA-Z0-9]+)³/g, '$1 cubed')
            .replace(/\b([a-zA-Z0-9]+)\^([0-9]+)\b/g, '$1 to the power of $2')

            // 5. Square roots & Math Operators
            .replace(/√\s*([a-zA-Z0-9_]+)|\\sqrt\{([^}]+)\}/g, 'square root of $1$2')
            .replace(/([a-zA-Z0-9]+)\s*[\*×]\s*([a-zA-Z0-9]+)/g, '$1 times $2')
            .replace(/([a-zA-Z0-9]+)\s*[\/÷]\s*([a-zA-Z0-9]+)/g, '$1 divided by $2')
            .replace(/\b(\d+)%/g, '$1 percent')
            .replace(/≠/g, 'is not equal to')
            .replace(/≤/g, 'less than or equal to')
            .replace(/≥/g, 'greater than or equal to')
            .replace(/≈/g, 'approximately equal to')
            .replace(/±/g, 'plus or minus ')

            // Collapse multiple spaces
            .replace(/[ \t]+/g, ' ')
            .trim();
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
     * Sanitizes raw extracted PDF text:
     * - Decodes shifted font encodings (MSxpsPS)
     * - Removes broken CID artifacts (e.g. (cid:123))
     * - Normalizes weird hyphens and line wraps
     * - Preserves natural punctuation for voice breath pauses
     */
    public static sanitizeText(text: string): string {
        if (!text) return '';
        const decoded = this.detectAndDecodeCipherShift(text);
        return decoded
            .replace(/\(cid:\d+\)/gi, '')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            .replace(/\uFFFD/g, ' ')
            .replace(/[]/g, ' ')
            .replace(/([a-zA-Z0-9])-[\r\n]+([a-zA-Z0-9])/g, '$1$2')
            .replace(/[\r\n]+/g, '\n')
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

        // Process batch raw text into clean speech paragraphs with Math Verbalization
        const rawLines = batchRawText.split(/\r?\n/);
        const logicalParagraphs: string[] = [];
        let currentParagraph = '';

        for (const line of rawLines) {
            const trimmed = line.trim();
            if (!trimmed) {
                if (currentParagraph.trim().length > 0) {
                    logicalParagraphs.push(currentParagraph.trim());
                    currentParagraph = '';
                }
                continue;
            }

            // Skip page numbers
            if (/^(page\s+\d+(\s+(of|\/)\s+\d+)?|\d+|\-\s*\d+\s*\-|\d+\s*\/\s*\d+)$/i.test(trimmed)) {
                continue;
            }

            const isNewItem = /^([•\-\*■►]|(\d+[\.\)]|[a-zA-Z][\.\)]))\s+/.test(trimmed);
            const isHeading = /^(chapter|section|unit|part|\d+\s+[A-Z\s]{4,})/i.test(trimmed);

            if (isNewItem || isHeading) {
                if (currentParagraph.trim().length > 0) {
                    logicalParagraphs.push(currentParagraph.trim());
                }
                currentParagraph = trimmed;
            } else if (currentParagraph) {
                if (currentParagraph.endsWith('-')) {
                    currentParagraph = currentParagraph.slice(0, -1) + trimmed;
                } else if (/[a-zA-Z0-9,;]$/.test(currentParagraph)) {
                    currentParagraph += ' ' + trimmed;
                } else {
                    currentParagraph += ' ' + trimmed;
                }
            } else {
                currentParagraph = trimmed;
            }
        }

        if (currentParagraph.trim()) {
            logicalParagraphs.push(currentParagraph.trim());
        }

        const paragraphs: ExtractedPdfParagraph[] = [];
        let pId = (pageStart - 1) * 10 + 1;
        let speechChunk = '';

        for (const para of logicalParagraphs) {
            const cleaned = this.sanitizeText(para);
            if (cleaned.length < 15) continue;

            const words = cleaned.split(/\s+/).filter(Boolean);

            if (words.length > 95) {
                const sentences = cleaned.match(/[^.!?]+[.!?]+(\s|$)/g) || [cleaned];
                let subChunk = '';
                for (const sent of sentences) {
                    if ((subChunk + ' ' + sent).split(/\s+/).length > 80) {
                        if (subChunk.trim()) {
                            const scClean = this.sanitizeText(subChunk);
                            const scWords = scClean.split(/\s+/).filter(Boolean);
                            const verbalizedSpeech = this.verbalizeMathForTts(scClean);
                            const sents = scClean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
                            paragraphs.push({
                                id: pId++,
                                text: scClean,
                                wordCount: scWords.length,
                                cleanSpeechText: verbalizedSpeech,
                                bullets: sents.slice(0, 3).map(s => `• ${s}`),
                            });
                        }
                        subChunk = sent;
                    } else {
                        subChunk += (subChunk ? ' ' : '') + sent;
                    }
                }
                if (subChunk.trim()) {
                    const scClean = this.sanitizeText(subChunk);
                    const scWords = scClean.split(/\s+/).filter(Boolean);
                    const verbalizedSpeech = this.verbalizeMathForTts(scClean);
                    const sents = scClean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
                    paragraphs.push({
                        id: pId++,
                        text: scClean,
                        wordCount: scWords.length,
                        cleanSpeechText: verbalizedSpeech,
                        bullets: sents.slice(0, 3).map(s => `• ${s}`),
                    });
                }
            } else if (speechChunk.split(/\s+/).length + words.length > 80) {
                if (speechChunk.trim()) {
                    const scClean = this.sanitizeText(speechChunk);
                    const scWords = scClean.split(/\s+/).filter(Boolean);
                    const verbalizedSpeech = this.verbalizeMathForTts(scClean);
                    const sents = scClean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
                    paragraphs.push({
                        id: pId++,
                        text: scClean,
                        wordCount: scWords.length,
                        cleanSpeechText: verbalizedSpeech,
                        bullets: sents.slice(0, 3).map(s => `• ${s}`),
                    });
                }
                speechChunk = cleaned;
            } else {
                speechChunk += (speechChunk ? ' ' : '') + cleaned;
            }
        }

        if (speechChunk.trim()) {
            const scClean = this.sanitizeText(speechChunk);
            const scWords = scClean.split(/\s+/).filter(Boolean);
            const verbalizedSpeech = this.verbalizeMathForTts(scClean);
            const sents = scClean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
            paragraphs.push({
                id: pId++,
                text: scClean,
                wordCount: scWords.length,
                cleanSpeechText: verbalizedSpeech,
                bullets: sents.slice(0, 3).map(s => `• ${s}`),
            });
        }

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

            const documentTitle =
                (meta.Title && meta.Title.trim().length > 3)
                    ? meta.Title.trim()
                    : (fileName ? fileName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ') : 'Uploaded PDF Document');

            const author = meta.Author ? meta.Author.trim() : null;

            const rawLines = rawText.split(/\r?\n/);
            const logicalParagraphs: string[] = [];
            let currentParagraph = '';

            for (let i = 0; i < rawLines.length; i++) {
                const line = rawLines[i].trim();
                if (!line) {
                    if (currentParagraph.trim().length > 0) {
                        logicalParagraphs.push(currentParagraph.trim());
                        currentParagraph = '';
                    }
                    continue;
                }

                if (/^(page\s+\d+(\s+(of|\/)\s+\d+)?|\d+|\-\s*\d+\s*\-|\d+\s*\/\s*\d+)$/i.test(line)) {
                    continue;
                }

                const isNewItem = /^([•\-\*■►]|(\d+[\.\)]|[a-zA-Z][\.\)]))\s+/.test(line);
                const isHeading = /^(chapter|section|unit|part|\d+\s+[A-Z\s]{4,})/i.test(line);

                if (isNewItem || isHeading) {
                    if (currentParagraph.trim().length > 0) {
                        logicalParagraphs.push(currentParagraph.trim());
                    }
                    currentParagraph = line;
                } else if (currentParagraph) {
                    if (currentParagraph.endsWith('-')) {
                        currentParagraph = currentParagraph.slice(0, -1) + line;
                    } else if (/[a-zA-Z0-9,;]$/.test(currentParagraph)) {
                        currentParagraph += ' ' + line;
                    } else {
                        currentParagraph += ' ' + line;
                    }
                } else {
                    currentParagraph = line;
                }
            }

            if (currentParagraph.trim()) {
                logicalParagraphs.push(currentParagraph.trim());
            }

            const paragraphs: ExtractedPdfParagraph[] = [];
            let pId = 1;
            let speechChunk = '';

            for (const para of logicalParagraphs) {
                const cleaned = this.sanitizeText(para);
                if (cleaned.length < 15) continue;

                const words = cleaned.split(/\s+/).filter(Boolean);

                if (words.length > 95) {
                    const sentences = cleaned.match(/[^.!?]+[.!?]+(\s|$)/g) || [cleaned];
                    let subChunk = '';
                    for (const sent of sentences) {
                        if ((subChunk + ' ' + sent).split(/\s+/).length > 80) {
                            if (subChunk.trim()) {
                                const scClean = this.sanitizeText(subChunk);
                                const scWords = scClean.split(/\s+/).filter(Boolean);
                                const verbalizedSpeech = this.verbalizeMathForTts(scClean);
                                const sents = scClean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
                                paragraphs.push({
                                    id: pId++,
                                    text: scClean,
                                    wordCount: scWords.length,
                                    cleanSpeechText: verbalizedSpeech,
                                    bullets: sents.slice(0, 3).map(s => `• ${s}`),
                                });
                            }
                            subChunk = sent;
                        } else {
                            subChunk += (subChunk ? ' ' : '') + sent;
                        }
                    }
                    if (subChunk.trim()) {
                        const scClean = this.sanitizeText(subChunk);
                        const scWords = scClean.split(/\s+/).filter(Boolean);
                        const verbalizedSpeech = this.verbalizeMathForTts(scClean);
                        const sents = scClean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
                        paragraphs.push({
                            id: pId++,
                            text: scClean,
                            wordCount: scWords.length,
                            cleanSpeechText: verbalizedSpeech,
                            bullets: sents.slice(0, 3).map(s => `• ${s}`),
                        });
                    }
                } else if (speechChunk.split(/\s+/).length + words.length > 80) {
                    if (speechChunk.trim()) {
                        const scClean = this.sanitizeText(speechChunk);
                        const scWords = scClean.split(/\s+/).filter(Boolean);
                        const verbalizedSpeech = this.verbalizeMathForTts(scClean);
                        const sents = scClean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
                        paragraphs.push({
                            id: pId++,
                            text: scClean,
                            wordCount: scWords.length,
                            cleanSpeechText: verbalizedSpeech,
                            bullets: sents.slice(0, 3).map(s => `• ${s}`),
                        });
                    }
                    speechChunk = cleaned;
                } else {
                    speechChunk += (speechChunk ? ' ' : '') + cleaned;
                }
            }

            if (speechChunk.trim()) {
                const scClean = this.sanitizeText(speechChunk);
                const scWords = scClean.split(/\s+/).filter(Boolean);
                const verbalizedSpeech = this.verbalizeMathForTts(scClean);
                const sents = scClean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
                paragraphs.push({
                    id: pId++,
                    text: scClean,
                    wordCount: scWords.length,
                    cleanSpeechText: verbalizedSpeech,
                    bullets: sents.slice(0, 3).map(s => `• ${s}`),
                });
            }

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

        const prompt = `You are a world-class AI Document Research Assistant specializing in academic, educational, and business analysis.

Document: "${docTitle}"

Selected Reference Sections:
"""
${contextText}
"""

User Question:
"${question}"

Instructions:
1. Provide a direct, highly articulate, and insightful explanation answering the user's question based on the selected reference sections.
2. If mathematical formulas or literary/technical terms appear, explain their significance clearly.
3. Include 2-4 bullet points highlighting Key Takeaways.
4. Format your output strictly in valid JSON format:
{
  "answer": "Clear, direct explanation...",
  "keyTakeaways": ["Key point 1", "Key point 2"]
}`;

        const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
        const ai = new GoogleGenAI({ apiKey });
        const models = ['gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-3.5-flash'];

        for (const model of models) {
            try {
                const response = await ai.models.generateContent({
                    model,
                    contents: prompt,
                    config: {
                        temperature: 0.2,
                        responseMimeType: 'application/json',
                    },
                });

                const text = response.text || '{}';
                const parsed = JSON.parse(text);
                if (parsed && parsed.answer) {
                    return {
                        answer: parsed.answer,
                        keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
                    };
                }
            } catch (err: any) {
                console.warn(`[PdfService] Q&A Model ${model} notice:`, err.message);
            }
        }

        return {
            answer: 'Could not generate an answer at this time. Please try asking again.',
            keyTakeaways: [],
        };
    }
}

export default PdfService;
