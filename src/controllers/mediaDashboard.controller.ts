import { Request, Response } from 'express';
import { MediaService } from '../services/mediaService.js';

export class MediaDashboardController {
  public static async renderDashboard(_req: Request, res: Response): Promise<void> {
    const stats = await MediaService.getStats();

    const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NewsFlow • Media & Image Optimization Control Center</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#f5f3ff',
              500: '#8b5cf6',
              600: '#7c3aed',
              700: '#6d28d9',
            },
            surface: {
              dark: '#070B14',
              card: '#111827',
              border: '#1F2937'
            }
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: #070B14;
      color: #E2E8F0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }
    .glass-card {
      background: rgba(17, 24, 39, 0.8);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
    }
    .badge-original {
      background: rgba(239, 68, 68, 0.15);
      color: #FCA5A5;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .badge-compressed {
      background: rgba(16, 185, 129, 0.15);
      color: #6EE7B7;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .badge-savings {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(59, 130, 246, 0.25) 100%);
      color: #A7F3D0;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }
  </style>
</head>
<body class="min-h-screen p-4 md:p-8">
  <div class="max-w-7xl mx-auto space-y-6">
    
    <!-- HEADER BAR -->
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 rounded-2xl">
      <div class="flex items-center space-x-4">
        <div class="h-12 w-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <i class="fa-solid fa-photo-film text-white text-2xl"></i>
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <h1 class="text-2xl font-bold tracking-tight text-white">Media & Image Compression Studio</h1>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full ${stats.imgproxyOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}"></span>
              Imgproxy Docker ${stats.imgproxyOnline ? 'Live (:8080)' : 'Standalone'}
            </span>
          </div>
          <p class="text-sm text-gray-400">Track real vs WebP compressed sizes, benchmark bandwidth savings, and manage media assets</p>
        </div>
      </div>
      
      <div class="flex items-center space-x-3">
        <a href="/admin/cms" class="px-4 py-2 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700 flex items-center gap-2">
          <i class="fa-solid fa-newspaper"></i> CMS Portal
        </a>
        <a href="/admin/database" class="px-4 py-2 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700 flex items-center gap-2">
          <i class="fa-solid fa-database"></i> DB Explorer
        </a>
        <a href="/admin/users" class="px-4 py-2 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700 flex items-center gap-2">
          <i class="fa-solid fa-users"></i> Users
        </a>
        <button onclick="syncDatabase()" class="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-lg shadow-indigo-600/30 flex items-center gap-2">
          <i class="fa-solid fa-arrows-rotate" id="sync-icon"></i> Sync DB Images
        </button>
      </div>
    </header>

    <!-- METRICS CARDS -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div class="glass-card p-4 rounded-xl border border-gray-800">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-gray-400">Total Images</span>
          <i class="fa-solid fa-images text-blue-400 text-sm"></i>
        </div>
        <div class="text-2xl font-bold text-white mt-2" id="stat-total">0</div>
        <div class="text-[11px] text-gray-500 mt-1">Tracked in registry</div>
      </div>

      <div class="glass-card p-4 rounded-xl border border-gray-800">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-gray-400">Original Total Size</span>
          <i class="fa-solid fa-weight-hanging text-red-400 text-sm"></i>
        </div>
        <div class="text-2xl font-bold text-red-300 mt-2" id="stat-original">0 MB</div>
        <div class="text-[11px] text-gray-500 mt-1">Raw uncompressed storage</div>
      </div>

      <div class="glass-card p-4 rounded-xl border border-gray-800">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-gray-400">Compressed WebP</span>
          <i class="fa-solid fa-compress text-emerald-400 text-sm"></i>
        </div>
        <div class="text-2xl font-bold text-emerald-300 mt-2" id="stat-compressed">0 MB</div>
        <div class="text-[11px] text-gray-500 mt-1">Imgproxy optimized size</div>
      </div>

      <div class="glass-card p-4 rounded-xl border border-gray-800">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-gray-400">Storage Saved</span>
          <i class="fa-solid fa-shield-halved text-teal-400 text-sm"></i>
        </div>
        <div class="text-2xl font-bold text-teal-300 mt-2" id="stat-saved">0 MB</div>
        <div class="text-[11px] text-gray-500 mt-1">Bandwidth saved per load</div>
      </div>

      <div class="glass-card p-4 rounded-xl border border-gray-800">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-gray-400">Compression Efficiency</span>
          <i class="fa-solid fa-bolt text-yellow-400 text-sm"></i>
        </div>
        <div class="text-2xl font-bold text-yellow-300 mt-2" id="stat-percentage">0%</div>
        <div class="text-[11px] text-gray-500 mt-1">Average space reduction</div>
      </div>
    </div>

    <!-- UPLOAD & BENCHMARK TOOL CARD -->
    <div class="glass-card p-6 rounded-2xl space-y-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-800 pb-4">
        <div>
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-cloud-arrow-up text-emerald-400"></i> Add & Benchmark New Image
          </h2>
          <p class="text-xs text-gray-400">Upload a local file or paste an image URL to immediately measure real bytes vs compressed WebP bytes</p>
        </div>
        <div class="flex items-center gap-2">
          <button id="tab-btn-file" onclick="switchUploadTab('file')" class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white transition-colors">
            <i class="fa-solid fa-file-image"></i> Local File Upload
          </button>
          <button id="tab-btn-url" onclick="switchUploadTab('url')" class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">
            <i class="fa-solid fa-link"></i> Direct Image URL
          </button>
        </div>
      </div>

      <!-- Tab 1: File Upload Form -->
      <form id="file-upload-form" onsubmit="handleFileUpload(event)" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="col-span-1 md:col-span-2 border-2 border-dashed border-gray-700 hover:border-emerald-500 rounded-xl p-6 text-center transition-colors bg-gray-900/40 cursor-pointer" onclick="document.getElementById('file-input').click()">
            <input type="file" id="file-input" accept="image/*" class="hidden" onchange="previewSelectedFile(event)">
            <i class="fa-solid fa-image text-3xl text-gray-500 mb-2"></i>
            <div id="file-label" class="text-sm font-medium text-gray-300">Click to browse or drag and drop image (JPG, PNG, WebP)</div>
            <div id="file-size-preview" class="text-xs text-gray-500 mt-1">Files are saved locally and auto-compressed via imgproxy</div>
          </div>
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1">Image Title / Description</label>
              <input type="text" id="file-title" placeholder="e.g. Hero Tech Banner" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1">Alt Text (Accessibility)</label>
              <input type="text" id="file-alt" placeholder="e.g. Graphic illustrating deep tech" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500">
            </div>
            <button type="submit" id="btn-upload-file" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2">
              <i class="fa-solid fa-bolt"></i> Upload & Benchmark
            </button>
          </div>
        </div>
      </form>

      <!-- Tab 2: URL Ingest Form -->
      <form id="url-upload-form" onsubmit="handleUrlUpload(event)" class="hidden space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="col-span-1 md:col-span-2 space-y-3">
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1">Direct Image URL (HTTP/HTTPS)</label>
              <input type="url" id="url-input" required placeholder="https://images.unsplash.com/photo-..." class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-400 mb-1">Image Title</label>
                <input type="text" id="url-title" placeholder="e.g. Finance Infographic" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500">
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-400 mb-1">Alt Text</label>
                <input type="text" id="url-alt" placeholder="e.g. Stock charts breakdown" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500">
              </div>
            </div>
          </div>
          <div class="flex flex-col justify-end">
            <button type="submit" id="btn-upload-url" class="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2">
              <i class="fa-solid fa-link"></i> Ingest & Benchmark URL
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- GALLERY & TABLE TOOLBAR -->
    <div class="glass-card p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-center gap-3 flex-1">
        <div class="relative flex-1 max-w-md">
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-gray-500 text-xs"></i>
          <input type="text" id="search-input" oninput="debounceSearch()" placeholder="Search by title, URL or alt text..." class="w-full bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500">
        </div>
        <select id="format-filter" onchange="loadMedia(1)" class="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none">
          <option value="ALL">All Formats</option>
          <option value="JPEG">JPEG</option>
          <option value="PNG">PNG</option>
          <option value="WEBP">WebP</option>
        </select>
        <select id="sort-filter" onchange="loadMedia(1)" class="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none">
          <option value="newest">Sort: Newest First</option>
          <option value="savings">Sort: Highest Savings</option>
          <option value="size">Sort: Largest Original Size</option>
        </select>
      </div>

      <div class="flex items-center gap-2">
        <button onclick="setViewMode('grid')" id="view-grid-btn" class="p-2 text-xs rounded-lg bg-emerald-600 text-white transition-colors" title="Card Grid View">
          <i class="fa-solid fa-table-cells-large"></i>
        </button>
        <button onclick="setViewMode('table')" id="view-table-btn" class="p-2 text-xs rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors" title="Table View">
          <i class="fa-solid fa-list"></i>
        </button>
      </div>
    </div>

    <!-- MAIN GALLERY CONTAINER -->
    <div id="media-container" class="min-h-[300px]">
      <!-- Cards / Table will be populated dynamically -->
    </div>

    <!-- PAGINATION -->
    <div id="pagination" class="flex items-center justify-between glass-card p-4 rounded-xl text-xs text-gray-400">
      <span id="page-info">Showing 0 of 0 images</span>
      <div class="flex gap-2" id="page-buttons"></div>
    </div>

  </div>

  <!-- EDIT MODAL -->
  <div id="edit-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
    <div class="glass-card max-w-lg w-full p-6 rounded-2xl space-y-4 border border-gray-700">
      <div class="flex items-center justify-between border-b border-gray-800 pb-3">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <i class="fa-solid fa-pen-to-square text-emerald-400"></i> Edit Media Item
        </h3>
        <button onclick="closeEditModal()" class="text-gray-400 hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <input type="hidden" id="edit-id">
      <div>
        <label class="block text-xs font-medium text-gray-400 mb-1">Title</label>
        <input type="text" id="edit-title" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-400 mb-1">Alt Text</label>
        <input type="text" id="edit-alt" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-400 mb-1">Image URL</label>
        <input type="text" id="edit-url" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500">
      </div>
      <div class="flex justify-end gap-3 pt-2">
        <button onclick="closeEditModal()" class="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700">Cancel</button>
        <button onclick="saveEditMedia()" class="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white">Save Changes</button>
      </div>
    </div>
  </div>

  <!-- LIGHTBOX MODAL -->
  <div id="lightbox-modal" class="fixed inset-0 bg-black/90 z-50 hidden flex items-center justify-center p-4 cursor-pointer" onclick="closeLightbox()">
    <div class="max-w-4xl max-h-[85vh] relative" onclick="event.stopPropagation()">
      <img id="lightbox-img" src="" class="max-w-full max-h-[80vh] rounded-xl object-contain shadow-2xl border border-gray-800">
      <div id="lightbox-caption" class="text-center text-xs text-gray-300 mt-2 font-medium"></div>
    </div>
  </div>

  <script>
    let currentViewMode = 'grid';
    let currentPage = 1;
    let searchDebounceTimer;
    let allMediaItems = [];

    function formatBytes(bytes) {
      if (!bytes || bytes <= 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
    }

    function switchUploadTab(tab) {
      const fileTab = document.getElementById('file-upload-form');
      const urlTab = document.getElementById('url-upload-form');
      const fileBtn = document.getElementById('tab-btn-file');
      const urlBtn = document.getElementById('tab-btn-url');

      if (tab === 'file') {
        fileTab.classList.remove('hidden');
        urlTab.classList.add('hidden');
        fileBtn.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white transition-colors';
        urlBtn.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors';
      } else {
        fileTab.classList.add('hidden');
        urlTab.classList.remove('hidden');
        fileBtn.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors';
        urlBtn.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white transition-colors';
      }
    }

    function previewSelectedFile(e) {
      const file = e.target.files[0];
      if (file) {
        document.getElementById('file-label').textContent = file.name;
        document.getElementById('file-size-preview').textContent = 'Original Raw Size: ' + formatBytes(file.size);
        if (!document.getElementById('file-title').value) {
          document.getElementById('file-title').value = file.name.replace(/\\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        }
      }
    }

    async function handleFileUpload(e) {
      e.preventDefault();
      const fileInput = document.getElementById('file-input');
      if (!fileInput.files || !fileInput.files[0]) {
        alert('Please select an image file first.');
        return;
      }

      const btn = document.getElementById('btn-upload-file');
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing & Compressing...';
      btn.disabled = true;

      const formData = new FormData();
      formData.append('image', fileInput.files[0]);
      formData.append('title', document.getElementById('file-title').value);
      formData.append('altText', document.getElementById('file-alt').value);

      try {
        const res = await fetch('/api/v1/media/upload', { method: 'POST', body: formData });
        const json = await res.json();
        if (json.success) {
          fileInput.value = '';
          document.getElementById('file-label').textContent = 'Click to browse or drag and drop image';
          document.getElementById('file-size-preview').textContent = 'Files are saved locally and auto-compressed via imgproxy';
          document.getElementById('file-title').value = '';
          document.getElementById('file-alt').value = '';
          loadMedia(1);
        } else {
          alert('Upload failed: ' + (json.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Upload failed: ' + err.message);
      } finally {
        btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Upload & Benchmark';
        btn.disabled = false;
      }
    }

    async function handleUrlUpload(e) {
      e.preventDefault();
      const urlInput = document.getElementById('url-input');
      if (!urlInput.value) return;

      const btn = document.getElementById('btn-upload-url');
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ingesting & Benchmarking...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/v1/media/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: urlInput.value,
            title: document.getElementById('url-title').value,
            altText: document.getElementById('url-alt').value,
          }),
        });
        const json = await res.json();
        if (json.success) {
          urlInput.value = '';
          document.getElementById('url-title').value = '';
          document.getElementById('url-alt').value = '';
          loadMedia(1);
        } else {
          alert('Ingest failed: ' + (json.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Ingest failed: ' + err.message);
      } finally {
        btn.innerHTML = '<i class="fa-solid fa-link"></i> Ingest & Benchmark URL';
        btn.disabled = false;
      }
    }

    function setViewMode(mode) {
      currentViewMode = mode;
      const gridBtn = document.getElementById('view-grid-btn');
      const tableBtn = document.getElementById('view-table-btn');
      if (mode === 'grid') {
        gridBtn.className = 'p-2 text-xs rounded-lg bg-emerald-600 text-white transition-colors';
        tableBtn.className = 'p-2 text-xs rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors';
      } else {
        gridBtn.className = 'p-2 text-xs rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors';
        tableBtn.className = 'p-2 text-xs rounded-lg bg-emerald-600 text-white transition-colors';
      }
      renderMediaItems();
    }

    function debounceSearch() {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => loadMedia(1), 300);
    }

    async function loadMedia(page = 1) {
      currentPage = page;
      const container = document.getElementById('media-container');
      container.innerHTML = '<div class="flex items-center justify-center p-12 text-gray-400"><i class="fa-solid fa-circle-notch fa-spin text-2xl mr-3 text-emerald-400"></i> Loading media catalog...</div>';

      const search = document.getElementById('search-input').value;
      const format = document.getElementById('format-filter').value;
      const sortBy = document.getElementById('sort-filter').value;

      try {
        const query = new URLSearchParams({ page, limit: 16, sortBy });
        if (search) query.append('search', search);
        if (format !== 'ALL') query.append('format', format);

        const res = await fetch('/api/v1/media?' + query.toString());
        const json = await res.json();

        if (json.success) {
          allMediaItems = json.data;
          updateStats(json.stats);
          renderMediaItems();
          renderPagination(json.pagination);
        }
      } catch (err) {
        container.innerHTML = '<div class="p-8 text-center text-red-400 font-medium">Failed to load media catalog: ' + err.message + '</div>';
      }
    }

    function updateStats(stats) {
      if (!stats) return;
      document.getElementById('stat-total').textContent = stats.totalCount || 0;
      document.getElementById('stat-original').textContent = formatBytes(stats.totalOriginalBytes);
      document.getElementById('stat-compressed').textContent = formatBytes(stats.totalCompressedBytes);
      document.getElementById('stat-saved').textContent = formatBytes(stats.totalSavedBytes);
      document.getElementById('stat-percentage').textContent = (stats.savingsPercentage || 0) + '%';
    }

    function renderMediaItems() {
      const container = document.getElementById('media-container');
      if (!allMediaItems || allMediaItems.length === 0) {
        container.innerHTML = '<div class="glass-card p-12 text-center rounded-2xl space-y-3"><i class="fa-solid fa-image text-4xl text-gray-600"></i><div class="text-sm font-semibold text-gray-300">No media items found</div><div class="text-xs text-gray-500">Upload an image or paste a URL above to populate your compression dashboard.</div></div>';
        return;
      }

      if (currentViewMode === 'grid') {
        container.innerHTML = \`<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">\${allMediaItems.map(item => {
          const savingsPct = item.originalSize > 0 ? Math.round(((item.originalSize - item.compressedSize) / item.originalSize) * 100) : 0;
          return \`
          <div class="glass-card rounded-xl overflow-hidden border border-gray-800 hover:border-gray-700 transition-all flex flex-col justify-between">
            <div class="relative h-44 bg-gray-950 cursor-pointer overflow-hidden group" onclick="openLightbox('\${item.originalUrl}', '\${escapeHtml(item.title)}')">
              <img src="\${item.originalUrl}" alt="\${escapeHtml(item.altText)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.src='https://images.unsplash.com/photo-1544568100-847a948585b9?w=400'">
              <div class="absolute top-2 left-2 flex gap-1">
                <span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-black/70 text-white uppercase">\${item.format}</span>
                \${item.isLocal ? '<span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-600/80 text-white">LOCAL</span>' : ''}
              </div>
              <div class="absolute bottom-2 right-2">
                <span class="badge-savings px-2 py-0.5 text-[11px] font-black rounded-md shadow-md">-\${savingsPct}%</span>
              </div>
            </div>
            <div class="p-3.5 space-y-2.5">
              <div class="font-bold text-xs text-white truncate" title="\${escapeHtml(item.title)}">\${escapeHtml(item.title)}</div>
              
              <!-- Size comparison pills -->
              <div class="grid grid-cols-2 gap-2 text-[11px]">
                <div class="badge-original px-2 py-1 rounded-md text-center">
                  <div class="text-[9px] uppercase font-semibold opacity-70">Real Size</div>
                  <div class="font-bold">\${formatBytes(item.originalSize)}</div>
                </div>
                <div class="badge-compressed px-2 py-1 rounded-md text-center">
                  <div class="text-[9px] uppercase font-semibold opacity-70">WebP Size</div>
                  <div class="font-bold">\${formatBytes(item.compressedSize)}</div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="pt-1 flex items-center justify-between border-t border-gray-800/80 text-xs">
                <div class="flex gap-1.5">
                  <button onclick="copyToClipboard('\${item.originalUrl}', this)" class="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px]" title="Copy Original URL">
                    <i class="fa-solid fa-copy"></i>
                  </button>
                  <button onclick="copyToClipboard('\${item.compressedUrl}', this)" class="px-2 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 text-[11px]" title="Copy Imgproxy WebP URL">
                    <i class="fa-solid fa-bolt"></i> WebP
                  </button>
                </div>
                <div class="flex gap-1.5">
                  <button onclick="openEditModal('\${item.id}')" class="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-indigo-300 text-[11px]" title="Edit Item">
                    <i class="fa-solid fa-pen"></i>
                  </button>
                  <button onclick="deleteMediaItem('\${item.id}')" class="px-2 py-1 rounded bg-gray-800 hover:bg-red-900/60 text-red-400 text-[11px]" title="Delete Item">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>\`;
        }).join('')}</div>\`;
      } else {
        container.innerHTML = \`
        <div class="glass-card rounded-2xl overflow-hidden border border-gray-800">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-gray-900/80 text-gray-400 uppercase text-[10px] font-bold border-b border-gray-800">
                <tr>
                  <th class="py-3 px-4">Preview</th>
                  <th class="py-3 px-4">Title / Name</th>
                  <th class="py-3 px-4">Format</th>
                  <th class="py-3 px-4">Real Raw Size</th>
                  <th class="py-3 px-4">Compressed WebP</th>
                  <th class="py-3 px-4">Savings</th>
                  <th class="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-800/60">
                \${allMediaItems.map(item => {
                  const savingsPct = item.originalSize > 0 ? Math.round(((item.originalSize - item.compressedSize) / item.originalSize) * 100) : 0;
                  return \`
                  <tr class="hover:bg-gray-900/40 transition-colors">
                    <td class="py-2 px-4">
                      <img src="\${item.originalUrl}" onclick="openLightbox('\${item.originalUrl}', '\${escapeHtml(item.title)}')" class="h-10 w-16 object-cover rounded cursor-pointer border border-gray-700" onerror="this.src='https://images.unsplash.com/photo-1544568100-847a948585b9?w=200'">
                    </td>
                    <td class="py-2 px-4 max-w-xs truncate font-medium text-white">\${escapeHtml(item.title)}</td>
                    <td class="py-2 px-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-300">\${item.format}</span></td>
                    <td class="py-2 px-4 text-red-300 font-bold">\${formatBytes(item.originalSize)}</td>
                    <td class="py-2 px-4 text-emerald-300 font-bold">\${formatBytes(item.compressedSize)}</td>
                    <td class="py-2 px-4"><span class="badge-savings px-2 py-0.5 text-[10px] font-extrabold rounded">-\${savingsPct}%</span></td>
                    <td class="py-2 px-4 text-right space-x-1">
                      <button onclick="copyToClipboard('\${item.originalUrl}', this)" class="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300" title="Copy Original URL"><i class="fa-solid fa-copy"></i></button>
                      <button onclick="openEditModal('\${item.id}')" class="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-indigo-300" title="Edit Item"><i class="fa-solid fa-pen"></i></button>
                      <button onclick="deleteMediaItem('\${item.id}')" class="p-1.5 rounded bg-gray-800 hover:bg-red-900 text-red-400" title="Delete Item"><i class="fa-solid fa-trash"></i></button>
                    </td>
                  </tr>\`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>\`;
      }
    }

    function renderPagination(p) {
      if (!p) return;
      document.getElementById('page-info').textContent = \`Showing \${allMediaItems.length} of \${p.total} images (Page \${p.page} of \${p.totalPages})\`;
      const btnContainer = document.getElementById('page-buttons');
      btnContainer.innerHTML = '';
      if (p.page > 1) {
        btnContainer.innerHTML += \`<button onclick="loadMedia(\${p.page - 1})" class="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 text-white font-semibold">Previous</button>\`;
      }
      if (p.page < p.totalPages) {
        btnContainer.innerHTML += \`<button onclick="loadMedia(\${p.page + 1})" class="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 text-white font-semibold">Next</button>\`;
      }
    }

    function openEditModal(id) {
      const item = allMediaItems.find(m => m.id === id);
      if (!item) return;
      document.getElementById('edit-id').value = item.id;
      document.getElementById('edit-title').value = item.title;
      document.getElementById('edit-alt').value = item.altText || '';
      document.getElementById('edit-url').value = item.originalUrl;
      document.getElementById('edit-modal').classList.remove('hidden');
    }

    function closeEditModal() {
      document.getElementById('edit-modal').classList.add('hidden');
    }

    async function saveEditMedia() {
      const id = document.getElementById('edit-id').value;
      const title = document.getElementById('edit-title').value;
      const altText = document.getElementById('edit-alt').value;
      const originalUrl = document.getElementById('edit-url').value;

      try {
        const res = await fetch('/api/v1/media/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, altText, originalUrl }),
        });
        const json = await res.json();
        if (json.success) {
          closeEditModal();
          loadMedia(currentPage);
        } else {
          alert('Failed to save edit: ' + json.error);
        }
      } catch (err) {
        alert('Error saving: ' + err.message);
      }
    }

    async function deleteMediaItem(id) {
      if (!confirm('Are you sure you want to delete this media item?')) return;
      try {
        const res = await fetch('/api/v1/media/' + id, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
          loadMedia(currentPage);
        } else {
          alert('Delete failed: ' + json.error);
        }
      } catch (err) {
        alert('Error deleting: ' + err.message);
      }
    }

    async function syncDatabase() {
      const icon = document.getElementById('sync-icon');
      icon.classList.add('fa-spin');
      try {
        const res = await fetch('/api/v1/media/sync-db', { method: 'POST' });
        const json = await res.json();
        alert(json.message || 'Database synchronized!');
        loadMedia(1);
      } catch (err) {
        alert('Sync failed: ' + err.message);
      } finally {
        icon.classList.remove('fa-spin');
      }
    }

    function openLightbox(url, title) {
      document.getElementById('lightbox-img').src = url;
      document.getElementById('lightbox-caption').textContent = title || '';
      document.getElementById('lightbox-modal').classList.remove('hidden');
    }

    function closeLightbox() {
      document.getElementById('lightbox-modal').classList.add('hidden');
    }

    function copyToClipboard(text, btn) {
      navigator.clipboard.writeText(text).then(() => {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check text-emerald-400"></i>';
        setTimeout(() => btn.innerHTML = orig, 1500);
      });
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Initial load
    window.addEventListener('DOMContentLoaded', () => loadMedia(1));
  </script>
</body>
</html>`;

    res.send(html);
  }
}
