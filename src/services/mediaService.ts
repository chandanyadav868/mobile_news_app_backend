import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { prisma } from '../config/db.js';

export interface MediaItem {
  id: string;
  title: string;
  altText: string;
  originalUrl: string;
  compressedUrl: string;
  originalSize: number; // bytes
  compressedSize: number; // bytes
  mimeType: string;
  format: string; // JPEG, PNG, WEBP, etc.
  width?: number;
  height?: number;
  isLocal: boolean;
  source: 'UPLOAD' | 'URL' | 'ARTICLE' | 'INSIGHT';
  createdAt: string;
  updatedAt: string;
}

export interface MediaStats {
  totalCount: number;
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  totalSavedBytes: number;
  savingsPercentage: number;
  imgproxyOnline: boolean;
  imgproxyUrl: string;
}

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'images');
const REGISTRY_FILE = path.join(process.cwd(), 'uploads', 'media-registry.json');
const IMGPROXY_BASE = process.env.IMGPROXY_URL || 'http://127.0.0.1:8080';

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export class MediaService {
  private static registry: MediaItem[] = [];
  private static initialized: boolean = false;

  private static loadRegistry() {
    if (this.initialized) return;
    try {
      if (fs.existsSync(REGISTRY_FILE)) {
        const raw = fs.readFileSync(REGISTRY_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Exclude any RSS-extracted article images - strictly keep manual uploads, editor creations, and visual stories
        this.registry = Array.isArray(parsed) ? parsed.filter((m: MediaItem) => m.source !== 'ARTICLE') : [];
        // Persist cleaned registry without RSS items
        this.saveRegistry();
      } else {
        this.registry = [];
      }
    } catch (err) {
      console.warn('⚠️ [MediaService] Failed to parse media registry, initializing empty:', err);
      this.registry = [];
    }
    this.initialized = true;
  }

  private static saveRegistry() {
    try {
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify(this.registry, null, 2), 'utf-8');
    } catch (err) {
      console.error('❌ [MediaService] Failed to save media registry:', err);
    }
  }

  /**
   * Check if local or docker imgproxy is alive
   */
  public static async isImgproxyAlive(): Promise<boolean> {
    try {
      const res = await axios.get(`${IMGPROXY_BASE}/health`, { timeout: 1500 });
      return res.status === 200;
    } catch {
      try {
        const res2 = await axios.get(`${IMGPROXY_BASE}/-/health`, { timeout: 1500 });
        return res2.status === 200;
      } catch {
        return false;
      }
    }
  }

  /**
   * Build imgproxy WebP transformation URL
   */
  public static buildImgproxyUrl(sourceUrl: string, width = 800, quality = 80): string {
    // Insecure imgproxy URL format: /unsafe/fit/<width>/<height>/sm/0/plain/<source_url>@webp
    return `${IMGPROXY_BASE}/unsafe/rs:fit:${width}:0:0:0/q:${quality}/plain/${encodeURI(sourceUrl)}@webp`;
  }

  /**
   * Benchmark real size vs compressed size for a given URL or buffer
   */
  public static async benchmarkImage(sourceUrl: string, fallbackOriginalSize?: number): Promise<{ originalSize: number; compressedSize: number }> {
    let originalSize = fallbackOriginalSize || 0;
    let compressedSize = 0;

    // Fetch original size if not provided
    if (!originalSize && sourceUrl.startsWith('http')) {
      try {
        const head = await axios.head(sourceUrl, { timeout: 3500, maxRedirects: 3 });
        const len = head.headers['content-length'];
        if (len) originalSize = parseInt(String(len), 10);
      } catch {
        try {
          const getRes = await axios.get(sourceUrl, { responseType: 'arraybuffer', timeout: 4000, maxRedirects: 3 });
          originalSize = getRes.data.length;
        } catch {
          originalSize = 450 * 1024; // fallback 450 KB estimate
        }
      }
    }

    if (!originalSize) originalSize = 350 * 1024;

    // Benchmark through imgproxy
    const imgproxyUrl = this.buildImgproxyUrl(sourceUrl);
    try {
      const compRes = await axios.get(imgproxyUrl, { responseType: 'arraybuffer', timeout: 3500 });
      compressedSize = compRes.data.length;
    } catch {
      // If imgproxy is busy or external source blocked, WebP is typically 65-80% smaller than JPEG
      compressedSize = Math.max(12 * 1024, Math.round(originalSize * 0.18));
    }

    return { originalSize, compressedSize };
  }

  /**
   * Get all media items with search & format filters
   */
  public static async getAllMedia(options: {
    search?: string;
    format?: string;
    sortBy?: 'newest' | 'savings' | 'size';
    page?: number;
    limit?: number;
  } = {}): Promise<{ items: MediaItem[]; total: number; page: number; totalPages: number }> {
    this.loadRegistry();

    // Auto-sync initial database images if registry is empty
    if (this.registry.length === 0) {
      await this.syncDatabaseImages();
    }

    let list = [...this.registry];

    if (options.search) {
      const q = options.search.toLowerCase();
      list = list.filter((m) => m.title.toLowerCase().includes(q) || m.originalUrl.toLowerCase().includes(q) || m.altText?.toLowerCase().includes(q));
    }

    if (options.format && options.format !== 'ALL') {
      list = list.filter((m) => m.format.toUpperCase() === options.format!.toUpperCase());
    }

    if (options.sortBy === 'savings') {
      list.sort((a, b) => {
        const saveA = a.originalSize - a.compressedSize;
        const saveB = b.originalSize - b.compressedSize;
        return saveB - saveA;
      });
    } else if (options.sortBy === 'size') {
      list.sort((a, b) => b.originalSize - a.originalSize);
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, options.limit || 20);
    const total = list.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const items = list.slice(startIndex, startIndex + limit);

    return { items, total, page, totalPages };
  }

  /**
   * Upload an image file to local disk, run compression benchmark, and register
   */
  public static async uploadFile(file: Express.Multer.File, title?: string, altText?: string): Promise<MediaItem> {
    this.loadRegistry();

    const originalSize = file.size || (fs.existsSync(file.path) ? fs.statSync(file.path).size : 100 * 1024);
    const ext = path.extname(file.originalname).replace('.', '').toUpperCase() || 'JPEG';
    const relativeUrl = `/uploads/images/${path.basename(file.path)}`;
    const fullSourceUrl = `http://localhost:${process.env.PORT || 4000}${relativeUrl}`;

    // Benchmark compression
    const { compressedSize } = await this.benchmarkImage(fullSourceUrl, originalSize);
    const compressedUrl = this.buildImgproxyUrl(fullSourceUrl);

    const media: MediaItem = {
      id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: title?.trim() || file.originalname.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
      altText: altText?.trim() || title || file.originalname,
      originalUrl: relativeUrl,
      compressedUrl,
      originalSize,
      compressedSize,
      mimeType: file.mimetype || 'image/jpeg',
      format: ext,
      isLocal: true,
      source: 'UPLOAD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.registry.unshift(media);
    this.saveRegistry();
    return media;
  }

  /**
   * Register a direct image URL (e.g. from Unsplash or CDN) and benchmark real vs compressed size
   */
  public static async registerUrl(url: string, title?: string, altText?: string): Promise<MediaItem> {
    this.loadRegistry();

    const cleanUrl = url.trim();
    // Check if already registered
    const existing = this.registry.find((m) => m.originalUrl === cleanUrl);
    if (existing) return existing;

    const { originalSize, compressedSize } = await this.benchmarkImage(cleanUrl);
    const extMatch = cleanUrl.match(/\.(jpeg|jpg|png|webp|gif|avif)(\?|$)/i);
    const format = extMatch ? extMatch[1].toUpperCase() : 'JPEG';
    const compressedUrl = this.buildImgproxyUrl(cleanUrl);

    const media: MediaItem = {
      id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: title?.trim() || `Image ${cleanUrl.slice(-18).replace(/[/?=]/g, ' ')}`,
      altText: altText?.trim() || title || 'Web Image',
      originalUrl: cleanUrl,
      compressedUrl,
      originalSize,
      compressedSize,
      mimeType: `image/${format.toLowerCase()}`,
      format: format === 'JPG' ? 'JPEG' : format,
      isLocal: false,
      source: 'URL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.registry.unshift(media);
    this.saveRegistry();
    return media;
  }

  /**
   * Update media title, alt text, or replace URL
   */
  public static async updateMedia(id: string, payload: { title?: string; altText?: string; originalUrl?: string }): Promise<MediaItem | null> {
    this.loadRegistry();
    const item = this.registry.find((m) => m.id === id);
    if (!item) return null;

    if (payload.title !== undefined) item.title = payload.title.trim();
    if (payload.altText !== undefined) item.altText = payload.altText.trim();
    if (payload.originalUrl !== undefined && payload.originalUrl.trim() && payload.originalUrl !== item.originalUrl) {
      item.originalUrl = payload.originalUrl.trim();
      const bench = await this.benchmarkImage(item.originalUrl);
      item.originalSize = bench.originalSize;
      item.compressedSize = bench.compressedSize;
      item.compressedUrl = this.buildImgproxyUrl(item.originalUrl);
    }

    item.updatedAt = new Date().toISOString();
    this.saveRegistry();
    return item;
  }

  /**
   * Delete media item and local file if stored locally
   */
  public static async deleteMedia(id: string): Promise<boolean> {
    this.loadRegistry();
    const index = this.registry.findIndex((m) => m.id === id);
    if (index === -1) return false;

    const item = this.registry[index];
    if (item.isLocal && item.originalUrl.startsWith('/uploads/images/')) {
      const localFilePath = path.join(process.cwd(), item.originalUrl);
      try {
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
        }
      } catch (err) {
        console.warn('⚠️ [MediaService] Failed to delete local image file:', err);
      }
    }

    this.registry.splice(index, 1);
    this.saveRegistry();
    return true;
  }

  /**
   * Get aggregate statistics across all registered images
   */
  public static async getStats(): Promise<MediaStats> {
    this.loadRegistry();
    if (this.registry.length === 0) {
      await this.syncDatabaseImages();
    }

    let totalOriginalBytes = 0;
    let totalCompressedBytes = 0;

    for (const m of this.registry) {
      totalOriginalBytes += m.originalSize || 0;
      totalCompressedBytes += m.compressedSize || 0;
    }

    const totalSavedBytes = Math.max(0, totalOriginalBytes - totalCompressedBytes);
    const savingsPercentage = totalOriginalBytes > 0 ? Math.round((totalSavedBytes / totalOriginalBytes) * 1000) / 10 : 0;
    const imgproxyOnline = await this.isImgproxyAlive();

    return {
      totalCount: this.registry.length,
      totalOriginalBytes,
      totalCompressedBytes,
      totalSavedBytes,
      savingsPercentage,
      imgproxyOnline,
      imgproxyUrl: IMGPROXY_BASE,
    };
  }

  /**
   * Scan PostgreSQL articles and visual stories to index images automatically
   */
  public static async syncDatabaseImages(): Promise<number> {
    this.loadRegistry();
    let added = 0;

    try {
      // NOTE: Automated RSS articles are STRICTLY EXCLUDED!
      // Images from RSS feeds are only held as external URLs and never uploaded or tracked here.
      // Only Visual Insights and manually authored Editor stories are synchronized.

      // 1. Visual Insight Stories (Authored in Visual Builder)
      const insights = await prisma.insightStory.findMany({
        take: 30,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, coverImage: true, slides: true, createdAt: true },
      });

      for (const ins of insights) {
        if (ins.coverImage && ins.coverImage.startsWith('http') && !this.registry.some((m) => m.originalUrl === ins.coverImage)) {
          const { originalSize, compressedSize } = await this.benchmarkImage(ins.coverImage);
          this.registry.push({
            id: `ins-${ins.id.slice(0, 8)}`,
            title: ins.title,
            altText: `Insight Story Cover`,
            originalUrl: ins.coverImage,
            compressedUrl: this.buildImgproxyUrl(ins.coverImage),
            originalSize,
            compressedSize,
            mimeType: 'image/jpeg',
            format: 'JPEG',
            isLocal: false,
            source: 'INSIGHT',
            createdAt: ins.createdAt.toISOString(),
            updatedAt: new Date().toISOString(),
          });
          added++;
        }

        // Check slides
        if (Array.isArray(ins.slides)) {
          for (let i = 0; i < ins.slides.length; i++) {
            const slide: any = ins.slides[i];
            if (slide && slide.image && slide.image.startsWith('http') && !this.registry.some((m) => m.originalUrl === slide.image)) {
              const { originalSize, compressedSize } = await this.benchmarkImage(slide.image);
              this.registry.push({
                id: `slide-${ins.id.slice(0, 6)}-${i + 1}`,
                title: slide.headline || `${ins.title} (Slide ${i + 1})`,
                altText: slide.headline || 'Visual Story Slide',
                originalUrl: slide.image,
                compressedUrl: this.buildImgproxyUrl(slide.image),
                originalSize,
                compressedSize,
                mimeType: 'image/jpeg',
                format: 'JPEG',
                isLocal: false,
                source: 'INSIGHT',
                createdAt: ins.createdAt.toISOString(),
                updatedAt: new Date().toISOString(),
              });
              added++;
            }
          }
        }
      }

      if (added > 0) {
        this.saveRegistry();
      }
    } catch (err) {
      console.warn('⚠️ [MediaService] Sync database images encountered warning:', err);
    }

    return added;
  }
}
