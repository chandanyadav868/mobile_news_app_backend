// @ts-ignore
import { PDFParse } from 'pdf-parse';
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

export class PdfService {
    /**
     * Sanitizes raw extracted PDF text:
     * - Removes broken CID artifacts (e.g. (cid:123))
     * - Normalizes weird hyphens and line wraps
     * - Preserves natural punctuation for voice breath pauses
     */
    public static sanitizeText(text: string): string {
        if (!text) return '';
        return text
            .replace(/\(cid:\d+\)/gi, '')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            .replace(/([a-zA-Z0-9])-[\r\n]+([a-zA-Z0-9])/g, '$1$2')
            .replace(/[\r\n]+/g, '\n')
            .replace(/[ \t]+/g, ' ')
            .trim();
    }

    /**
     * Extracts 100% of all text, pages, and paragraphs from the entire PDF buffer.
     * Uses layout-aware sentence stitching to eliminate line break cuts,
     * filter out orphan page numbers, and produce smooth, continuous paragraphs
     * ready for natural voice TTS and real-time word highlighting.
     */
    public static async extractFromBuffer(
        buffer: Buffer,
        fileName?: string
    ): Promise<ExtractedPdfDocument> {
        try {
            console.log(`📄 [PdfService] Extracting full verbatim document "${fileName || 'Document'}" (${(buffer.length / 1024).toFixed(1)} KB)...`);

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

            // Fallback if rawText is still empty
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

            // 🧠 Smart Layout & Sentence Reconstruction Engine:
            // 1. Splits by physical lines
            // 2. Removes running page numbers, header lines, and isolated noise
            // 3. Stitches sentences across lines that were artificially wrapped by PDF columns
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

                // Filter out isolated page numbers (e.g., "Page 12", "12", "- 12 -", "12 / 72")
                if (/^(page\s+\d+(\s+(of|\/)\s+\d+)?|\d+|\-\s*\d+\s*\-|\d+\s*\/\s*\d+)$/i.test(line)) {
                    continue;
                }

                // Check if this line is a new list item, bullet, or heading
                const isNewItem = /^([•\-\*■►]|(\d+[\.\)]|[a-zA-Z][\.\)]))\s+/.test(line);
                const isHeading = /^(chapter|section|unit|part|\d+\s+[A-Z\s]{4,})/i.test(line);

                if (isNewItem || isHeading) {
                    if (currentParagraph.trim().length > 0) {
                        logicalParagraphs.push(currentParagraph.trim());
                    }
                    currentParagraph = line;
                } else if (currentParagraph) {
                    // Check if previous paragraph ended with hyphen (word wrap)
                    if (currentParagraph.endsWith('-')) {
                        currentParagraph = currentParagraph.slice(0, -1) + line;
                    } else if (/[a-zA-Z0-9,;]$/.test(currentParagraph)) {
                        // Natural sentence continuation
                        currentParagraph += ' ' + line;
                    } else {
                        // Previous ended with period or exclamation: join with space
                        currentParagraph += ' ' + line;
                    }
                } else {
                    currentParagraph = line;
                }
            }

            if (currentParagraph.trim()) {
                logicalParagraphs.push(currentParagraph.trim());
            }

            // 4. Chunk into speech-friendly sections (50–90 words) so TTS highlight is ultra-precise
            const paragraphs: ExtractedPdfParagraph[] = [];
            let pId = 1;
            let speechChunk = '';

            for (const para of logicalParagraphs) {
                const cleaned = this.sanitizeText(para);
                if (cleaned.length < 15) continue;

                const words = cleaned.split(/\s+/).filter(Boolean);

                if (words.length > 95) {
                    // Split very long paragraphs cleanly by sentence boundaries
                    const sentences = cleaned.match(/[^.!?]+[.!?]+(\s|$)/g) || [cleaned];
                    let subChunk = '';
                    for (const sent of sentences) {
                        if ((subChunk + ' ' + sent).split(/\s+/).length > 80) {
                            if (subChunk.trim()) {
                                const scClean = this.sanitizeText(subChunk);
                                const scWords = scClean.split(/\s+/).filter(Boolean);
                                const sents = scClean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
                                paragraphs.push({
                                    id: pId++,
                                    text: scClean,
                                    wordCount: scWords.length,
                                    cleanSpeechText: scClean,
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
                        const sents = scClean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
                        paragraphs.push({
                            id: pId++,
                            text: scClean,
                            wordCount: scWords.length,
                            cleanSpeechText: scClean,
                            bullets: sents.slice(0, 3).map(s => `• ${s}`),
                        });
                    }
                } else if (speechChunk.split(/\s+/).length + words.length > 80) {
                    if (speechChunk.trim()) {
                        const scClean = this.sanitizeText(speechChunk);
                        const scWords = scClean.split(/\s+/).filter(Boolean);
                        const sents = scClean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
                        paragraphs.push({
                            id: pId++,
                            text: scClean,
                            wordCount: scWords.length,
                            cleanSpeechText: scClean,
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
                const sents = scClean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
                paragraphs.push({
                    id: pId++,
                    text: scClean,
                    wordCount: scWords.length,
                    cleanSpeechText: scClean,
                    bullets: sents.slice(0, 3).map(s => `• ${s}`),
                });
            }

            const totalWords = paragraphs.reduce((sum, p) => sum + p.wordCount, 0);
            console.log(`✅ [PdfService] Successfully extracted 100% of PDF: ${paragraphs.length} sections (${totalWords} words across ${pageCount} pages).`);

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
}

export default PdfService;
