import { Request, Response } from 'express';
import { prisma } from '../config/db.js';

export async function renderDatabaseAdmin(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const search = (req.query.search as string) || '';
    const selectedCategory = (req.query.category as string) || '';
    const selectedCountry = (req.query.country as string) || '';

    const skip = (page - 1) * limit;

    const where: any = {};
    if (selectedCategory && selectedCategory !== 'ALL') {
      where.category = { equals: selectedCategory, mode: 'insensitive' };
    }
    if (selectedCountry && selectedCountry !== 'ALL') {
      where.country = { equals: selectedCountry, mode: 'insensitive' };
    }
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    const [articles, totalCount, totalInsights, totalTimelines, categoryCounts, countryCounts] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.article.count({ where }),
      prisma.insightStory.count(),
      prisma.timelineTopic.count(),
      prisma.article.groupBy({
        by: ['category'] as any,
        _count: { id: true },
      }),
      prisma.article.groupBy({
        by: ['country'] as any,
        _count: { id: true },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    // Generate clean HTML Table UI
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NewsFlow Database & Readability Explorer</title>
  <style>
    :root {
      --bg: #0F172A;
      --card-bg: #1E293B;
      --border: #334155;
      --text: #F8FAFC;
      --text-muted: #94A3B8;
      --primary: #3B82F6;
      --accent: #10B981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 24px; }
    .container { max-width: 1400px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .title { font-size: 24px; font-weight: 800; display: flex; align-items: center; gap: 10px; }
    .btn { background: var(--primary); color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
    .btn:hover { opacity: 0.9; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: var(--card-bg); padding: 18px; border-radius: 12px; border: 1px solid var(--border); }
    .stat-val { font-size: 28px; font-weight: 800; color: var(--primary); margin-top: 4px; }
    .stat-lbl { color: var(--text-muted); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    
    .filters-bar { background: var(--card-bg); padding: 16px; border-radius: 12px; border: 1px solid var(--border); display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .search-input, .select-input { background: #0F172A; border: 1px solid var(--border); color: white; padding: 10px 14px; border-radius: 8px; font-size: 14px; outline: none; }
    .search-input { flex: 1; min-width: 220px; }
    
    .table-card { background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border); overflow: hidden; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { background: #0F172A; padding: 14px 16px; font-size: 12px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; border-bottom: 1px solid var(--border); }
    td { padding: 14px 16px; border-bottom: 1px solid var(--border); font-size: 13.5px; vertical-align: middle; }
    tr:hover td { background: rgba(255,255,255,0.02); }
    
    .thumb { width: 54px; height: 54px; border-radius: 8px; object-fit: cover; background: #334155; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; background: rgba(59, 130, 246, 0.15); color: #60A5FA; }
    .country-badge { display: inline-block; padding: 3px 6px; border-radius: 5px; font-size: 11px; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #34D399; margin-right: 4px; }
    .source-tag { font-size: 11.5px; color: var(--text-muted); font-weight: 600; }
    .hash-tag { font-family: monospace; font-size: 11px; color: #64748B; background: #0F172A; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block; }
    
    .pagination { display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #0F172A; }
    .page-link { color: var(--primary); text-decoration: none; font-weight: 700; font-size: 13px; padding: 6px 12px; background: var(--card-bg); border-radius: 6px; border: 1px solid var(--border); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">
        <span>⚡</span> NewsFlow Database & Readability Explorer
      </div>
      <div style="display: flex; gap: 10px;">
        <button class="btn" onclick="triggerIngest()" style="background: var(--accent);">🔄 Sync RSS Feeds & Run Readability</button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-lbl">Total Articles in DB</div>
        <div class="stat-val">${totalCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-lbl">Visual Insights</div>
        <div class="stat-val">${totalInsights}</div>
      </div>
      <div class="stat-card">
        <div class="stat-lbl">Timeline Topics</div>
        <div class="stat-val">${totalTimelines}</div>
      </div>
      <div class="stat-card">
        <div class="stat-lbl">Active Categories</div>
        <div class="stat-val">${categoryCounts.length}</div>
      </div>
    </div>

    <form class="filters-bar" method="GET" action="/admin/database">
      <input type="text" name="search" class="search-input" placeholder="Search articles by title..." value="${search}">
      
      <select name="country" class="select-input" onchange="this.form.submit()">
        <option value="ALL" ${!selectedCountry || selectedCountry === 'ALL' ? 'selected' : ''}>All Countries</option>
        ${countryCounts
          .map(
            (c: any) =>
              `<option value="${c.country || 'GLOBAL'}" ${selectedCountry.toUpperCase() === (c.country || '').toUpperCase() ? 'selected' : ''}>${c.country || 'GLOBAL'} (${c._count?.id || 0})</option>`
          )
          .join('')}
      </select>

      <select name="category" class="select-input" onchange="this.form.submit()">
        <option value="ALL" ${!selectedCategory || selectedCategory === 'ALL' ? 'selected' : ''}>All Categories</option>
        ${categoryCounts
          .map(
            (c: any) =>
              `<option value="${c.category}" ${selectedCategory.toLowerCase() === (c.category || '').toLowerCase() ? 'selected' : ''}>${c.category} (${c._count?.id || 0})</option>`
          )
          .join('')}
      </select>
      <button type="submit" class="btn">Filter</button>
      ${search || selectedCategory || selectedCountry ? `<a href="/admin/database" class="page-link">Clear</a>` : ''}
    </form>

    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th style="width: 70px;">Cover</th>
            <th>Title & Inshorts Summary</th>
            <th style="width: 140px;">Region & Category</th>
            <th style="width: 130px;">Source</th>
            <th style="width: 140px;">Published</th>
            <th style="width: 100px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${
            articles.length === 0
              ? `<tr><td colspan="6" style="text-align: center; padding: 40px; color: #94A3B8;">No articles found matching filter criteria</td></tr>`
              : articles
                  .map(
                    (art: any) => `
            <tr>
              <td>
                ${art.imageUrl ? `<img src="${art.imageUrl}" class="thumb" onerror="this.style.display='none'">` : '<div class="thumb"></div>'}
              </td>
              <td>
                <div style="font-weight: 700; font-size: 14.5px; margin-bottom: 6px; color: #F1F5F9;">${art.title}</div>
                <div style="font-size: 12.5px; color: #94A3B8; line-height: 1.4;">${art.summary}</div>
                <div class="hash-tag">MD5: ${(art.hash || '').substring(0, 12)}... ${art.rawContent ? `· Full Text: ${art.rawContent.length} chars` : ''}</div>
              </td>
              <td>
                <span class="country-badge">${art.country === 'IN' ? '🇮🇳 IN' : art.country === 'US' ? '🇺🇸 US' : art.country === 'GB' ? '🇬🇧 GB' : '🌍 ' + (art.country || 'GLOBAL')}</span>
                <span class="badge">${art.category}</span>
              </td>
              <td>
                <span class="source-tag">${art.source}</span>
                ${art.author ? `<div style="font-size: 11px; color: #64748B;">${art.author}</div>` : ''}
              </td>
              <td style="color: var(--text-muted); font-size: 12px;">${new Date(art.publishedAt).toLocaleString()}</td>
              <td>
                <a href="${art.url}" target="_blank" class="page-link" style="padding: 4px 8px; font-size: 11px;">Open ↗</a>
              </td>
            </tr>
          `
                  )
                  .join('')
          }
        </tbody>
      </table>

      <div class="pagination">
        <div>Showing Page <strong>${page}</strong> of <strong>${totalPages}</strong> (${totalCount} articles)</div>
        <div style="display: flex; gap: 8px;">
          ${page > 1 ? `<a href="/admin/database?page=${page - 1}&category=${encodeURIComponent(selectedCategory)}&country=${encodeURIComponent(selectedCountry)}&search=${encodeURIComponent(search)}" class="page-link">← Previous</a>` : ''}
          ${page < totalPages ? `<a href="/admin/database?page=${page + 1}&category=${encodeURIComponent(selectedCategory)}&country=${encodeURIComponent(selectedCountry)}&search=${encodeURIComponent(search)}" class="page-link">Next →</a>` : ''}
        </div>
      </div>
    </div>
  </div>

  <script>
    async function triggerIngest() {
      if (!confirm('Run background RSS feed synchronization & Mozilla Readability extraction now?')) return;
      try {
        const btn = document.querySelector('button[onclick="triggerIngest()"]');
        btn.innerText = '⏳ Extracting & Ingesting...';
        btn.disabled = true;
        const res = await fetch('/api/v1/news/refresh', { method: 'POST' });
        const json = await res.json();
        alert('Pipeline complete: ' + json.stats.inserted + ' new articles enriched with Readability and inserted.');
        window.location.reload();
      } catch (err) {
        alert('Ingestion error: ' + err.message);
      }
    }
  </script>
</body>
</html>
    `;

    return res.send(html);
  } catch (error: any) {
    return res.status(500).send(`<h3>Error loading admin database: ${error.message}</h3>`);
  }
}
