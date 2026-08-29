import { Request, Response } from 'express';

export class CmsDashboardController {
    /**
     * GET /cms or GET /admin/cms
     * Renders the complete, high-performance NewsFlow CMS Web Studio Portal
     */
    public static renderPortal(_req: Request, res: Response): void {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NewsFlow Studio — Centralized Content Management System</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                        mono: ['JetBrains Mono', 'monospace'],
                    },
                    colors: {
                        brand: {
                            50: '#FEF2F2',
                            100: '#FEE2E2',
                            500: '#EF4444',
                            600: '#DC2626',
                            700: '#B91C1C',
                        },
                        dark: {
                            900: '#090D16',
                            800: '#0F172A',
                            700: '#1E293B',
                            600: '#334155',
                        }
                    }
                }
            }
        }
    </script>
    <style>
        body { font-family: 'Inter', sans-serif; }
        .glass { background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); }
        .glass-card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.06); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 999px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.25); }
    </style>
</head>
<body class="bg-dark-900 text-slate-100 min-h-screen flex flex-col antialiased selection:bg-brand-500 selection:text-white">

    <!-- Top Navigation Bar -->
    <header class="glass sticky top-0 z-50 border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-rose-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
                <i data-lucide="newspaper" class="w-5 h-5 text-white"></i>
            </div>
            <div>
                <div class="flex items-center gap-2">
                    <h1 class="text-lg font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">NewsFlow Studio</h1>
                    <span class="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded-full">CMS v2.0</span>
                </div>
                <p class="text-xs text-slate-400">Unified Editorial, Ingestion & AI Mission Control</p>
            </div>
        </div>

        <div class="flex items-center gap-3">
            <!-- Auth Status / Admin Pill -->
            <div id="authStatusPill" class="hidden items-center gap-2 px-3 py-1.5 rounded-lg glass-card text-xs">
                <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                <span id="adminEmailBadge" class="font-medium text-slate-300">admin@newsflow.app</span>
                <span id="adminRoleBadge" class="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-semibold">SUPER_ADMIN</span>
            </div>

            <!-- Global Action: Trigger Ingestion -->
            <button onclick="triggerGlobalIngest()" class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-xs font-semibold transition-all">
                <i data-lucide="refresh-cw" class="w-3.5 h-3.5" id="ingestSpinIcon"></i>
                <span>Fetch All RSS</span>
            </button>

            <!-- Global Action: Flush Cache -->
            <button onclick="flushRedisCache()" class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-400 text-xs font-semibold transition-all">
                <i data-lucide="zap" class="w-3.5 h-3.5"></i>
                <span>Flush Redis</span>
            </button>

            <button onclick="logoutAdmin()" id="logoutBtn" class="hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition" title="Log Out">
                <i data-lucide="log-out" class="w-4 h-4"></i>
            </button>
        </div>
    </header>

    <!-- Main Workspace Container -->
    <div class="flex-1 flex overflow-hidden">

        <!-- Sidebar Navigation -->
        <aside class="w-64 border-r border-slate-800/80 glass p-4 flex flex-col gap-1 select-none">
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-2">Editorial Studio</div>
            
            <button onclick="switchTab('overview')" class="nav-tab active flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-slate-300 hover:bg-slate-800/60" data-tab="overview">
                <i data-lucide="layout-dashboard" class="w-4 h-4 text-blue-400"></i>
                <span>Overview & Analytics</span>
            </button>

            <button onclick="switchTab('articles')" class="nav-tab flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-slate-300 hover:bg-slate-800/60" data-tab="articles">
                <i data-lucide="file-text" class="w-4 h-4 text-emerald-400"></i>
                <span>Article Master</span>
            </button>

            <button onclick="switchTab('editor')" class="nav-tab flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-slate-300 hover:bg-slate-800/60" data-tab="editor">
                <i data-lucide="pen-tool" class="w-4 h-4 text-brand-400"></i>
                <span>Story Creator & AI</span>
            </button>

            <button onclick="switchTab('stories')" class="nav-tab flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-slate-300 hover:bg-slate-800/60" data-tab="stories">
                <i data-lucide="sparkles" class="w-4 h-4 text-purple-400"></i>
                <span>Visual Stories</span>
            </button>

            <button onclick="switchTab('polls')" class="nav-tab flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-slate-300 hover:bg-slate-800/60" data-tab="polls">
                <i data-lucide="vote" class="w-4 h-4 text-amber-400"></i>
                <span>Community Polls</span>
            </button>

            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 pt-4 pb-2">Operations & Feeds</div>

            <button onclick="switchTab('rss')" class="nav-tab flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-slate-300 hover:bg-slate-800/60" data-tab="rss">
                <i data-lucide="rss" class="w-4 h-4 text-orange-400"></i>
                <span>RSS Feeds & Scraping</span>
            </button>

            <button onclick="switchTab('taxonomy')" class="nav-tab flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-slate-300 hover:bg-slate-800/60" data-tab="taxonomy">
                <i data-lucide="tags" class="w-4 h-4 text-teal-400"></i>
                <span>Taxonomy & Categories</span>
            </button>

            <button onclick="switchTab('push')" class="nav-tab flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-slate-300 hover:bg-slate-800/60" data-tab="push">
                <i data-lucide="bell-ring" class="w-4 h-4 text-pink-400"></i>
                <span>Push Broadcast Studio</span>
            </button>

            <button onclick="switchTab('audit')" class="nav-tab flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-slate-300 hover:bg-slate-800/60" data-tab="audit">
                <i data-lucide="shield-check" class="w-4 h-4 text-indigo-400"></i>
                <span>Security & Audit Logs</span>
            </button>

            <div class="mt-auto pt-4 border-t border-slate-800/80">
                <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                    <div>
                        <div class="font-semibold text-slate-200">NewsFlow Core</div>
                        <div class="text-[10px] text-emerald-400">● REST API Online</div>
                    </div>
                    <a href="/dashboard" target="_blank" class="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition" title="Open Telemetry Dashboard">
                        <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                    </a>
                </div>
            </div>
        </aside>

        <!-- Main Content Area -->
        <main class="flex-1 overflow-y-auto custom-scrollbar p-6 bg-gradient-to-b from-dark-900 to-dark-800">

            <!-- TAB 1: OVERVIEW -->
            <div id="tab-overview" class="tab-content space-y-6">
                <!-- Metrics Grid -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="glass-card p-5 rounded-2xl">
                        <div class="flex items-center justify-between text-slate-400 mb-2">
                            <span class="text-xs font-semibold uppercase tracking-wider">Total Articles</span>
                            <i data-lucide="newspaper" class="w-4 h-4 text-blue-400"></i>
                        </div>
                        <div id="statTotalArticles" class="text-3xl font-extrabold text-white">--</div>
                        <div class="text-xs text-emerald-400 mt-1 font-medium flex items-center gap-1">
                            <i data-lucide="check-circle" class="w-3 h-3"></i> Live in database
                        </div>
                    </div>

                    <div class="glass-card p-5 rounded-2xl">
                        <div class="flex items-center justify-between text-slate-400 mb-2">
                            <span class="text-xs font-semibold uppercase tracking-wider">Active Polls</span>
                            <i data-lucide="vote" class="w-4 h-4 text-amber-400"></i>
                        </div>
                        <div id="statTotalPolls" class="text-3xl font-extrabold text-white">--</div>
                        <div class="text-xs text-amber-400 mt-1 font-medium">In-feed interactive</div>
                    </div>

                    <div class="glass-card p-5 rounded-2xl">
                        <div class="flex items-center justify-between text-slate-400 mb-2">
                            <span class="text-xs font-semibold uppercase tracking-wider">Visual Stories</span>
                            <i data-lucide="sparkles" class="w-4 h-4 text-purple-400"></i>
                        </div>
                        <div id="statTotalStories" class="text-3xl font-extrabold text-white">--</div>
                        <div class="text-xs text-purple-400 mt-1 font-medium">Multi-slide infographics</div>
                    </div>

                    <div class="glass-card p-5 rounded-2xl">
                        <div class="flex items-center justify-between text-slate-400 mb-2">
                            <span class="text-xs font-semibold uppercase tracking-wider">RSS Ingestion Sources</span>
                            <i data-lucide="rss" class="w-4 h-4 text-orange-400"></i>
                        </div>
                        <div id="statTotalRss" class="text-3xl font-extrabold text-white">--</div>
                        <div class="text-xs text-emerald-400 mt-1 font-medium">Auto-synced every 15m</div>
                    </div>
                </div>

                <!-- Category Breakdown & Quick Actions -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="lg:col-span-2 glass-card p-6 rounded-2xl">
                        <h3 class="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <i data-lucide="pie-chart" class="w-4 h-4 text-brand-400"></i>
                            Category Distribution
                        </h3>
                        <div id="categoryDistributionBars" class="space-y-3">
                            <div class="text-xs text-slate-400">Loading metrics...</div>
                        </div>
                    </div>

                    <div class="glass-card p-6 rounded-2xl space-y-4">
                        <h3 class="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                            <i data-lucide="zap" class="w-4 h-4 text-amber-400"></i>
                            Quick Actions
                        </h3>
                        <button onclick="switchTab('editor')" class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-rose-600 hover:from-brand-500 hover:to-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition">
                            <i data-lucide="plus-circle" class="w-4 h-4"></i>
                            <span>Create New News Story</span>
                        </button>
                        <button onclick="openCreateStoryModal()" class="w-full py-3 px-4 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-semibold text-xs flex items-center justify-center gap-2 transition">
                            <i data-lucide="sparkles" class="w-4 h-4"></i>
                            <span>Create Visual Story</span>
                        </button>
                        <button onclick="openCreatePollModal()" class="w-full py-3 px-4 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 font-semibold text-xs flex items-center justify-center gap-2 transition">
                            <i data-lucide="vote" class="w-4 h-4"></i>
                            <span>Launch Community Poll</span>
                        </button>
                        <button onclick="switchTab('push')" class="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition">
                            <i data-lucide="bell" class="w-4 h-4 text-pink-400"></i>
                            <span>Send Breaking Alert Broadcast</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- TAB 2: ARTICLE MASTER -->
            <div id="tab-articles" class="tab-content hidden space-y-4">
                <!-- Search & Filters Toolbar -->
                <div class="glass-card p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                    <div class="flex items-center gap-3 flex-1 min-w-[280px]">
                        <div class="relative flex-1">
                            <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"></i>
                            <input type="text" id="articleSearchInput" placeholder="Search by Article ID, Headline or Source..." oninput="debounceArticleSearch()" class="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500">
                        </div>
                        <select id="articleCategoryFilter" onchange="loadArticles(1)" class="bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500">
                            <option value="All">All Categories</option>
                            <option value="Top Stories">Top Stories</option>
                            <option value="Technology">Technology</option>
                            <option value="Business">Business</option>
                            <option value="Sports">Sports</option>
                            <option value="Entertainment">Entertainment</option>
                            <option value="Science">Science</option>
                            <option value="Health">Health</option>
                            <option value="World">World</option>
                            <option value="Politics">Politics</option>
                        </select>
                        <select id="articleCountryFilter" onchange="loadArticles(1)" class="bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500">
                            <option value="All">All Editions</option>
                            <option value="IN">India (IN)</option>
                            <option value="US">USA (US)</option>
                            <option value="GB">UK (GB)</option>
                            <option value="GLOBAL">Global</option>
                        </select>
                    </div>

                    <div class="flex items-center gap-2">
                        <button onclick="switchTab('editor')" class="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-brand-600/20 transition">
                            <i data-lucide="plus" class="w-4 h-4"></i>
                            <span>New Story</span>
                        </button>
                    </div>
                </div>

                <!-- Articles Table -->
                <div class="glass-card rounded-2xl overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs text-slate-300">
                            <thead class="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                                <tr>
                                    <th class="p-3.5">ID / Cover</th>
                                    <th class="p-3.5">Headline & Narrative</th>
                                    <th class="p-3.5">Category & Region</th>
                                    <th class="p-3.5">Flags</th>
                                    <th class="p-3.5">Published</th>
                                    <th class="p-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="articlesTableBody" class="divide-y divide-slate-800/60">
                                <tr><td colspan="6" class="p-6 text-center text-slate-500">Loading articles...</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Pagination Footer -->
                    <div class="p-3.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <span id="articlePaginationInfo">Showing 0 of 0 stories</span>
                        <div class="flex items-center gap-1.5" id="articlePaginationBtns"></div>
                    </div>
                </div>
            </div>

            <!-- TAB 3: STORY CREATOR & AI COPILOT -->
            <div id="tab-editor" class="tab-content hidden space-y-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-base font-bold text-slate-100 flex items-center gap-2">
                            <i data-lucide="pen-tool" class="w-4 h-4 text-brand-400"></i>
                            <span>News Creator & AI Editorial Studio</span>
                        </h2>
                        <p class="text-xs text-slate-400">Compose, edit, and enrich 110–140 word Inshorts-grade news stories</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="resetEditorForm()" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition">Clear Form</button>
                        <button onclick="saveArticleFromEditor()" class="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-lg shadow-brand-600/30 flex items-center gap-1.5 transition">
                            <i data-lucide="save" class="w-3.5 h-3.5"></i>
                            <span id="editorSaveBtnText">Publish Story</span>
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Left: Editor Inputs -->
                    <div class="lg:col-span-2 space-y-4">
                        <input type="hidden" id="editArticleId" value="">

                        <div class="glass-card p-5 rounded-2xl space-y-4">
                            <div>
                                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Article Headline (Punchy & Direct)</label>
                                <input type="text" id="editorTitle" placeholder="e.g. OpenAI Unveils Next-Gen GPT-5 with Real-Time Video Synthesis" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500">
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Category</label>
                                    <select id="editorCategory" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500">
                                        <option value="Top Stories">Top Stories</option>
                                        <option value="Technology">Technology</option>
                                        <option value="Business">Business</option>
                                        <option value="Sports">Sports</option>
                                        <option value="Entertainment">Entertainment</option>
                                        <option value="Science">Science</option>
                                        <option value="Health">Health</option>
                                        <option value="World">World</option>
                                        <option value="Politics">Politics</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Country Edition</label>
                                    <select id="editorCountry" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500">
                                        <option value="IN">India (IN)</option>
                                        <option value="US">USA (US)</option>
                                        <option value="GB">UK (GB)</option>
                                        <option value="GLOBAL">Global</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Source / Publisher</label>
                                    <input type="text" id="editorSource" value="NewsFlow Editorial" placeholder="NewsFlow Editorial" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500">
                                </div>
                            </div>

                            <div>
                                <div class="flex items-center justify-between mb-1.5">
                                    <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Story Narrative (110–140 Words)</label>
                                    <span id="editorWordCount" class="text-[11px] font-mono text-slate-400">0 words</span>
                                </div>
                                <textarea id="editorSummary" rows="6" oninput="updateWordCount()" placeholder="Write the 2-3 paragraph Inshorts story narrative here..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-xs leading-relaxed text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 custom-scrollbar"></textarea>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Cover Image URL</label>
                                    <input type="text" id="editorImageUrl" placeholder="https://images.unsplash.com/..." oninput="updatePreviewImage()" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500">
                                </div>
                                <div>
                                    <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Original Source URL (Optional)</label>
                                    <input type="text" id="editorUrl" placeholder="https://reuters.com/article/..." class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500">
                                </div>
                            </div>

                            <!-- Toggles -->
                            <div class="flex items-center gap-6 pt-2">
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" id="editorIsHero" class="rounded bg-slate-900 border-slate-700 text-brand-600 focus:ring-0">
                                    <span class="text-xs text-slate-300 font-medium">Pin to Hero Carousel</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" id="editorIsPinned" class="rounded bg-slate-900 border-slate-700 text-brand-600 focus:ring-0">
                                    <span class="text-xs text-slate-300 font-medium">Pin to Category Top</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Right: AI Copilot & Live Mobile Card Preview -->
                    <div class="space-y-4">
                        <!-- AI Copilot Card -->
                        <div class="glass-card p-5 rounded-2xl space-y-3">
                            <h3 class="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                                <i data-lucide="sparkles" class="w-4 h-4"></i>
                                <span>AI Editorial Copilot</span>
                            </h3>
                            <p class="text-[11px] text-slate-400">Generate high-cadence 110-word news summaries or run fact audits via Gemini LLM.</p>
                            
                            <div class="space-y-2 pt-1">
                                <button onclick="runAiSummarize()" id="aiSummarizeBtn" class="w-full py-2.5 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center justify-center gap-2 transition">
                                    <i data-lucide="wand-2" class="w-3.5 h-3.5"></i>
                                    <span>1-Click AI Summarize & Polish</span>
                                </button>
                                <button onclick="runAiFactCheck()" id="aiFactCheckBtn" class="w-full py-2.5 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-semibold flex items-center justify-center gap-2 transition">
                                    <i data-lucide="check-check" class="w-3.5 h-3.5"></i>
                                    <span>AI Deep Dive & Fact Audit</span>
                                </button>
                            </div>
                        </div>

                        <!-- Mobile Card Preview -->
                        <div class="glass-card p-4 rounded-2xl">
                            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                                <span>Inshorts Mobile Card Preview</span>
                                <span class="text-emerald-400">60-Word / 110-Word Fit</span>
                            </div>
                            <div class="bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
                                <div class="h-36 bg-slate-800 overflow-hidden relative">
                                    <img id="previewImage" src="https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=600" class="w-full h-full object-cover">
                                    <span id="previewCategoryTag" class="absolute top-2 left-2 px-2 py-0.5 rounded bg-brand-600 text-white text-[9px] font-bold uppercase">Technology</span>
                                </div>
                                <div class="p-3.5 space-y-2">
                                    <h4 id="previewHeadline" class="text-xs font-bold text-white line-clamp-2">Article Headline appears here...</h4>
                                    <p id="previewNarrative" class="text-[11px] leading-relaxed text-slate-300 line-clamp-5">Your comprehensive story narrative will render here in real-time as you write...</p>
                                    <div class="pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-400">
                                        <span id="previewSource">NewsFlow Editorial</span>
                                        <span>Just now</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB 4: VISUAL STORIES -->
            <div id="tab-stories" class="tab-content hidden space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-base font-bold text-slate-100 flex items-center gap-2">
                            <i data-lucide="sparkles" class="w-4 h-4 text-purple-400"></i>
                            <span>Visual Insight Stories Builder</span>
                        </h2>
                        <p class="text-xs text-slate-400">Publish multi-slide visual infographic stories featured in the Insights tab</p>
                    </div>
                    <button onclick="openCreateStoryModal()" class="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 flex items-center gap-1.5 transition">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        <span>New Visual Story</span>
                    </button>
                </div>
                <div id="storiesGrid" class="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div class="text-xs text-slate-500 col-span-3 text-center py-8">Loading visual stories...</div>
                </div>
            </div>

            <!-- TAB 5: COMMUNITY POLLS -->
            <div id="tab-polls" class="tab-content hidden space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-base font-bold text-slate-100 flex items-center gap-2">
                            <i data-lucide="vote" class="w-4 h-4 text-amber-400"></i>
                            <span>Interactive Community Polls</span>
                        </h2>
                        <p class="text-xs text-slate-400">Launch debate questions and monitor real-time vote metrics</p>
                    </div>
                    <button onclick="openCreatePollModal()" class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/30 flex items-center gap-1.5 transition">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        <span>Launch New Poll</span>
                    </button>
                </div>
                <div id="pollsList" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="text-xs text-slate-500 text-center py-8 col-span-2">Loading polls...</div>
                </div>
            </div>

            <!-- TAB 6: RSS FEEDS -->
            <div id="tab-rss" class="tab-content hidden space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-base font-bold text-slate-100 flex items-center gap-2">
                            <i data-lucide="rss" class="w-4 h-4 text-orange-400"></i>
                            <span>RSS Feeds & Ingestion Sources</span>
                        </h2>
                        <p class="text-xs text-slate-400">Configure automated news feeds and trigger on-demand scraping cycles</p>
                    </div>
                    <button onclick="openAddRssModal()" class="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-lg shadow-orange-600/30 flex items-center gap-1.5 transition">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        <span>Add RSS Source</span>
                    </button>
                </div>
                <div id="rssSourcesList" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="text-xs text-slate-500 text-center py-8 col-span-2">Loading RSS sources...</div>
                </div>
            </div>

            <!-- TAB 7: TAXONOMY -->
            <div id="tab-taxonomy" class="tab-content hidden space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-base font-bold text-slate-100 flex items-center gap-2">
                            <i data-lucide="tags" class="w-4 h-4 text-teal-400"></i>
                            <span>Dynamic Taxonomy & Categories</span>
                        </h2>
                        <p class="text-xs text-slate-400">Add custom categories, assign emojis, and control active status on mobile</p>
                    </div>
                    <button onclick="openAddCategoryModal()" class="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg shadow-teal-600/30 flex items-center gap-1.5 transition">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        <span>Add Custom Category</span>
                    </button>
                </div>
                <div id="taxonomyList" class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="text-xs text-slate-500 text-center py-8 col-span-4">Loading categories...</div>
                </div>
            </div>

            <!-- TAB 8: PUSH NOTIFICATIONS -->
            <div id="tab-push" class="tab-content hidden space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-base font-bold text-slate-100 flex items-center gap-2">
                            <i data-lucide="bell-ring" class="w-4 h-4 text-pink-400"></i>
                            <span>Push Notification Broadcast Studio</span>
                        </h2>
                        <p class="text-xs text-slate-400">Broadcast breaking news alerts directly to subscriber devices</p>
                    </div>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="glass-card p-5 rounded-2xl space-y-4">
                        <h3 class="text-xs font-bold uppercase tracking-wider text-pink-400">Compose Broadcast</h3>
                        <div>
                            <label class="block text-[11px] font-bold uppercase text-slate-400 mb-1">Notification Title</label>
                            <input type="text" id="pushTitle" placeholder="⚡ BREAKING: Major Headline..." class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold uppercase text-slate-400 mb-1">Notification Body</label>
                            <textarea id="pushBody" rows="3" placeholder="Summary of the breaking alert..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-brand-500"></textarea>
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold uppercase text-slate-400 mb-1">Target Category Audience</label>
                            <select id="pushCategory" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300">
                                <option value="All">Broadcast to All Devices (Global)</option>
                                <option value="Technology">Technology Subscribers</option>
                                <option value="Business">Business Subscribers</option>
                                <option value="Sports">Sports Subscribers</option>
                                <option value="Top Stories">Top Stories Subscribers</option>
                            </select>
                        </div>
                        <button onclick="sendPushBroadcast()" class="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shadow-lg shadow-pink-600/30 flex items-center justify-center gap-2 transition">
                            <i data-lucide="send" class="w-4 h-4"></i>
                            <span>Send Notification Now</span>
                        </button>
                    </div>

                    <div class="glass-card p-5 rounded-2xl space-y-3">
                        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Recent Broadcast History</h3>
                        <div id="pushHistoryList" class="space-y-2 text-xs text-slate-400">Loading history...</div>
                    </div>
                </div>
            </div>

            <!-- TAB 9: AUDIT LOGS -->
            <div id="tab-audit" class="tab-content hidden space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-base font-bold text-slate-100 flex items-center gap-2">
                            <i data-lucide="shield-check" class="w-4 h-4 text-indigo-400"></i>
                            <span>Security & Staff Audit Logs</span>
                        </h2>
                        <p class="text-xs text-slate-400">Chronological history of all admin edits, deletions, and ingestion runs</p>
                    </div>
                </div>
                <div class="glass-card rounded-2xl overflow-hidden">
                    <table class="w-full text-left text-xs text-slate-300">
                        <thead class="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                            <tr>
                                <th class="p-3.5">Timestamp</th>
                                <th class="p-3.5">Admin User</th>
                                <th class="p-3.5">Action</th>
                                <th class="p-3.5">Target Entity</th>
                            </tr>
                        </thead>
                        <tbody id="auditLogsTableBody" class="divide-y divide-slate-800/60">
                            <tr><td colspan="4" class="p-6 text-center text-slate-500">Loading audit trail...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

        </main>
    </div>

    <!-- MODAL 1: Create Visual Story -->
    <div id="createStoryModal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md hidden flex items-center justify-center p-4">
        <div class="glass-card max-w-2xl w-full p-6 rounded-3xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar border border-slate-700">
            <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-white flex items-center gap-2">
                    <i data-lucide="sparkles" class="w-4 h-4 text-purple-400"></i>
                    <span>Create Visual Insight Story</span>
                </h3>
                <button onclick="closeModal('createStoryModal')" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>

            <div class="space-y-3">
                <div>
                    <label class="block text-xs font-semibold text-slate-300 mb-1">Story Title</label>
                    <input type="text" id="modalStoryTitle" placeholder="e.g. The Quantum Computing Horizon" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                        <select id="modalStoryCategory" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300">
                            <option value="Technology">Technology</option>
                            <option value="Science">Science</option>
                            <option value="Business">Business</option>
                            <option value="Top Stories">Top Stories</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">Cover Image URL</label>
                        <input type="text" id="modalStoryCover" placeholder="https://images.unsplash.com/..." class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                    </div>
                </div>

                <div class="pt-2 border-t border-slate-800">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-bold text-purple-300 uppercase">Infographic Slides</span>
                        <button onclick="addSlideInputRow()" class="px-2.5 py-1 rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 text-[11px] font-semibold flex items-center gap-1">
                            <i data-lucide="plus" class="w-3 h-3"></i> Add Slide
                        </button>
                    </div>
                    <div id="modalSlidesContainer" class="space-y-3"></div>
                </div>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button onclick="closeModal('createStoryModal')" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">Cancel</button>
                <button onclick="submitNewStory()" class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30">Publish Visual Story</button>
            </div>
        </div>
    </div>

    <!-- MODAL 2: Create Community Poll -->
    <div id="createPollModal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md hidden flex items-center justify-center p-4">
        <div class="glass-card max-w-md w-full p-6 rounded-3xl space-y-4 border border-slate-700">
            <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-white flex items-center gap-2">
                    <i data-lucide="vote" class="w-4 h-4 text-amber-400"></i>
                    <span>Launch Community Debate Poll</span>
                </h3>
                <button onclick="closeModal('createPollModal')" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>

            <div class="space-y-3">
                <div>
                    <label class="block text-xs font-semibold text-slate-300 mb-1">Debate Question</label>
                    <input type="text" id="modalPollQuestion" placeholder="e.g. Will Electric Vehicles reach 50% market share by 2030?" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                        <select id="modalPollCategory" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300">
                            <option value="Technology">Technology</option>
                            <option value="Sports">Sports</option>
                            <option value="Business">Business</option>
                            <option value="Top Stories">Top Stories</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">Topic Tag</label>
                        <input type="text" id="modalPollTopicTag" placeholder="e.g. EVs & Energy" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                    </div>
                </div>

                <div class="pt-2 border-t border-slate-800">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-bold text-amber-300 uppercase">Selectable Options</span>
                        <button onclick="addPollOptionRow()" class="px-2.5 py-1 rounded-lg bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 text-[11px] font-semibold flex items-center gap-1">
                            <i data-lucide="plus" class="w-3 h-3"></i> Add Option
                        </button>
                    </div>
                    <div id="modalPollOptionsContainer" class="space-y-2"></div>
                </div>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button onclick="closeModal('createPollModal')" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">Cancel</button>
                <button onclick="submitNewPoll()" class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/30">Launch Poll</button>
            </div>
        </div>
    </div>

    <!-- MODAL 3: Add RSS Source -->
    <div id="addRssModal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md hidden flex items-center justify-center p-4">
        <div class="glass-card max-w-md w-full p-6 rounded-3xl space-y-4 border border-slate-700">
            <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-white flex items-center gap-2">
                    <i data-lucide="rss" class="w-4 h-4 text-orange-400"></i>
                    <span>Register RSS Feed Source</span>
                </h3>
                <button onclick="closeModal('addRssModal')" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>

            <div class="space-y-3">
                <div>
                    <label class="block text-xs font-semibold text-slate-300 mb-1">Source Name</label>
                    <input type="text" id="modalRssName" placeholder="e.g. Ars Technica" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-300 mb-1">RSS / Atom XML Feed URL</label>
                    <input type="url" id="modalRssUrl" placeholder="https://arstechnica.com/feed/" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                        <select id="modalRssCategory" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300">
                            <option value="Technology">Technology</option>
                            <option value="Business">Business</option>
                            <option value="Sports">Sports</option>
                            <option value="Science">Science</option>
                            <option value="Top Stories">Top Stories</option>
                            <option value="World">World</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">Edition Country</label>
                        <select id="modalRssCountry" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300">
                            <option value="GLOBAL">Global</option>
                            <option value="IN">India (IN)</option>
                            <option value="US">USA (US)</option>
                            <option value="GB">UK (GB)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button onclick="closeModal('addRssModal')" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">Cancel</button>
                <button onclick="submitNewRss()" class="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-lg shadow-orange-600/30">Register Source</button>
            </div>
        </div>
    </div>

    <!-- MODAL 4: Add Custom Category -->
    <div id="addCategoryModal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md hidden flex items-center justify-center p-4">
        <div class="glass-card max-w-sm w-full p-6 rounded-3xl space-y-4 border border-slate-700">
            <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-white flex items-center gap-2">
                    <i data-lucide="tags" class="w-4 h-4 text-teal-400"></i>
                    <span>Add Dynamic Category</span>
                </h3>
                <button onclick="closeModal('addCategoryModal')" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
            </div>

            <div class="space-y-3">
                <div>
                    <label class="block text-xs font-semibold text-slate-300 mb-1">Category Name</label>
                    <input type="text" id="modalCatName" placeholder="e.g. Artificial Intelligence" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">Emoji Icon</label>
                        <input type="text" id="modalCatEmoji" value="⚡" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white text-center">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">Sort Order Priority</label>
                        <input type="number" id="modalCatOrder" value="10" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                    </div>
                </div>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button onclick="closeModal('addCategoryModal')" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">Cancel</button>
                <button onclick="submitNewCategory()" class="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg shadow-teal-600/30">Add Category</button>
            </div>
        </div>
    </div>

    <!-- Login Modal (Rendered if unauthenticated) -->
    <div id="loginModal" class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <div class="glass-card max-w-md w-full p-8 rounded-3xl space-y-6 shadow-2xl border border-slate-700">
            <div class="text-center space-y-2">
                <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-rose-500 flex items-center justify-center shadow-lg shadow-brand-500/30 mx-auto">
                    <i data-lucide="shield" class="w-6 h-6 text-white"></i>
                </div>
                <h2 class="text-xl font-extrabold text-white">NewsFlow CMS Authentication</h2>
                <p class="text-xs text-slate-400">Enter your administrator credentials to access the studio</p>
            </div>

            <form onsubmit="handleAdminLogin(event)" class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold text-slate-300 mb-1">Admin Email</label>
                    <input type="email" id="loginEmail" value="admin@newsflow.app" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                    <div class="relative">
                        <input type="password" id="loginPassword" value="Admin@12345" required class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-4 pr-11 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500">
                        <button type="button" onclick="togglePasswordVisibility()" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1" title="Toggle password visibility">
                            <i data-lucide="eye" id="passwordEyeIcon" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
                <div id="loginError" class="hidden text-xs text-rose-400 text-center font-medium bg-rose-950/40 p-2.5 rounded-xl border border-rose-800/60"></div>
                <button type="submit" id="loginSubmitBtn" class="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-lg shadow-brand-600/30 transition">
                    Authenticate & Enter Studio
                </button>
            </form>
            <p class="text-[10px] text-center text-slate-500">Default Super Admin: admin@newsflow.app / Admin@12345</p>
        </div>
    </div>

    <!-- Frontend Core Scripts -->
    <script>
        let authToken = localStorage.getItem('newsflow_cms_token');
        let currentArticlesPage = 1;
        let searchTimeout = null;

        function togglePasswordVisibility() {
            const input = document.getElementById('loginPassword');
            const icon = document.getElementById('passwordEyeIcon');
            if (input.type === 'password') {
                input.type = 'text';
                icon.setAttribute('data-lucide', 'eye-off');
            } else {
                input.type = 'password';
                icon.setAttribute('data-lucide', 'eye');
            }
            lucide.createIcons();
        }

        document.addEventListener('DOMContentLoaded', () => {
            lucide.createIcons();
            if (authToken) {
                verifyAuth();
            } else {
                document.getElementById('loginModal').classList.remove('hidden');
            }
        });

        async function verifyAuth() {
            try {
                const res = await fetch('/api/v1/cms/auth/me', {
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                if (data.success && data.admin) {
                    document.getElementById('loginModal').classList.add('hidden');
                    document.getElementById('authStatusPill').classList.remove('hidden');
                    document.getElementById('authStatusPill').classList.add('flex');
                    document.getElementById('logoutBtn').classList.remove('hidden');
                    document.getElementById('adminEmailBadge').textContent = data.admin.email;
                    document.getElementById('adminRoleBadge').textContent = data.admin.role;
                    loadOverviewStats();
                    loadArticles(1);
                } else {
                    localStorage.removeItem('newsflow_cms_token');
                    authToken = null;
                    document.getElementById('loginModal').classList.remove('hidden');
                }
            } catch (e) {
                document.getElementById('loginModal').classList.remove('hidden');
            }
        }

        async function handleAdminLogin(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const errBox = document.getElementById('loginError');
            const submitBtn = document.getElementById('loginSubmitBtn');

            errBox.classList.add('hidden');
            submitBtn.textContent = 'Authenticating...';

            try {
                const res = await fetch('/api/v1/cms/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (data.success && data.token) {
                    authToken = data.token;
                    localStorage.setItem('newsflow_cms_token', authToken);
                    document.getElementById('loginModal').classList.add('hidden');
                    verifyAuth();
                } else {
                    errBox.textContent = data.error || 'Invalid credentials';
                    errBox.classList.remove('hidden');
                }
            } catch (err) {
                errBox.textContent = 'Server connection error';
                errBox.classList.remove('hidden');
            } finally {
                submitBtn.textContent = 'Authenticate & Enter Studio';
            }
        }

        function logoutAdmin() {
            localStorage.removeItem('newsflow_cms_token');
            authToken = null;
            location.reload();
        }

        function switchTab(tabId) {
            document.querySelectorAll('.nav-tab').forEach(b => {
                b.classList.remove('bg-slate-800', 'text-white', 'font-bold');
                if (b.dataset.tab === tabId) {
                    b.classList.add('bg-slate-800', 'text-white', 'font-bold');
                }
            });
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            const target = document.getElementById(\`tab-\${tabId}\`);
            if (target) target.classList.remove('hidden');

            if (tabId === 'overview') loadOverviewStats();
            if (tabId === 'articles') loadArticles(currentArticlesPage);
            if (tabId === 'stories') loadVisualStories();
            if (tabId === 'polls') loadPolls();
            if (tabId === 'rss') loadRssSources();
            if (tabId === 'taxonomy') loadTaxonomy();
            if (tabId === 'push') loadPushHistory();
            if (tabId === 'audit') loadAuditLogs();

            lucide.createIcons();
        }

        function openModal(id) {
            document.getElementById(id).classList.remove('hidden');
            lucide.createIcons();
        }
        function closeModal(id) {
            document.getElementById(id).classList.add('hidden');
        }

        async function loadOverviewStats() {
            if (!authToken) return;
            try {
                const res = await fetch('/api/v1/cms/analytics/overview', {
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                if (data.success && data.stats) {
                    document.getElementById('statTotalArticles').textContent = data.stats.totalArticles.toLocaleString();
                    document.getElementById('statTotalPolls').textContent = data.stats.totalPolls;
                    document.getElementById('statTotalStories').textContent = data.stats.totalVisualStories;
                    document.getElementById('statTotalRss').textContent = data.stats.totalRssSources;

                    const container = document.getElementById('categoryDistributionBars');
                    if (!data.stats.categoryDistribution || data.stats.categoryDistribution.length === 0) {
                        container.innerHTML = '<div class="text-xs text-slate-500">No articles yet.</div>';
                    } else {
                        const maxCount = Math.max(...data.stats.categoryDistribution.map(c => c.count), 1);
                        container.innerHTML = data.stats.categoryDistribution.map(c => \`
                            <div>
                                <div class="flex items-center justify-between text-xs mb-1 font-medium">
                                    <span class="text-slate-300">\${c.category}</span>
                                    <span class="text-slate-400 font-mono">\${c.count} stories</span>
                                </div>
                                <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div class="h-full bg-gradient-to-r from-brand-600 to-rose-400 rounded-full" style="width: \${(c.count / maxCount) * 100}%"></div>
                                </div>
                            </div>
                        \`).join('');
                    }
                }
            } catch (e) {}
        }

        async function loadArticles(page = 1) {
            if (!authToken) return;
            currentArticlesPage = page;
            const tbody = document.getElementById('articlesTableBody');
            const search = document.getElementById('articleSearchInput').value;
            const category = document.getElementById('articleCategoryFilter').value;
            const country = document.getElementById('articleCountryFilter').value;

            tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500">Loading articles...</td></tr>';

            try {
                const query = new URLSearchParams({ page, limit: 15, search, category, country });
                const res = await fetch(\`/api/v1/cms/articles?\${query}\`, {
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                if (data.success && data.articles) {
                    document.getElementById('articlePaginationInfo').textContent = \`Showing \${data.articles.length} of \${data.total} stories\`;
                    renderPagination(data.page, data.totalPages);

                    if (data.articles.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500">No articles found matching filters.</td></tr>';
                        return;
                    }

                    tbody.innerHTML = data.articles.map(a => \`
                        <tr class="hover:bg-slate-800/40 transition">
                            <td class="p-3.5">
                                <div class="flex items-center gap-3">
                                    <div class="w-12 h-12 rounded-xl bg-slate-800 overflow-hidden flex-shrink-0 border border-slate-700">
                                        <img src="\${a.imageUrl || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=150'}" class="w-full h-full object-cover">
                                    </div>
                                    <span class="font-mono text-[10px] text-slate-400">#\${a.id.slice(0, 8)}</span>
                                </div>
                            </td>
                            <td class="p-3.5 max-w-md">
                                <div class="font-bold text-slate-100 line-clamp-1 text-xs">\${a.title}</div>
                                <div class="text-slate-400 line-clamp-2 text-[11px] mt-0.5">\${a.summary}</div>
                            </td>
                            <td class="p-3.5">
                                <span class="px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 text-[10px] font-semibold">\${a.category}</span>
                                <span class="ml-1 text-[10px] text-slate-400 font-mono">\${a.country}</span>
                            </td>
                            <td class="p-3.5">
                                <div class="flex items-center gap-1.5">
                                    \${a.isHero ? '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">HERO</span>' : ''}
                                    <span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">\${a.status}</span>
                                </div>
                            </td>
                            <td class="p-3.5 text-slate-400 text-[11px]">
                                \${new Date(a.publishedAt).toLocaleDateString()}
                            </td>
                            <td class="p-3.5 text-right space-x-1">
                                <button onclick="editArticleDirect('\${a.id}')" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 transition" title="Edit Story">
                                    <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                                </button>
                                <button onclick="toggleHeroDirect('\${a.id}')" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition" title="Toggle Hero Status">
                                    <i data-lucide="star" class="w-3.5 h-3.5"></i>
                                </button>
                                <button onclick="deleteArticleDirect('\${a.id}')" class="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-400 transition" title="Delete Story">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                </button>
                            </td>
                        </tr>
                    \`).join('');
                    lucide.createIcons();
                }
            } catch (e) {}
        }

        function renderPagination(current, total) {
            const container = document.getElementById('articlePaginationBtns');
            if (total <= 1) { container.innerHTML = ''; return; }
            let btns = '';
            if (current > 1) btns += \`<button onclick="loadArticles(\${current - 1})" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs">◀ Prev</button>\`;
            btns += \`<span class="px-2 py-1 text-xs font-mono text-slate-400">\${current} / \${total}</span>\`;
            if (current < total) btns += \`<button onclick="loadArticles(\${current + 1})" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs">Next ▶</button>\`;
            container.innerHTML = btns;
        }

        function debounceArticleSearch() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => loadArticles(1), 300);
        }

        async function editArticleDirect(id) {
            try {
                const res = await fetch(\`/api/v1/cms/articles/\${id}\`, {
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                if (data.success && data.article) {
                    const a = data.article;
                    document.getElementById('editArticleId').value = a.id;
                    document.getElementById('editorTitle').value = a.title;
                    document.getElementById('editorSummary').value = a.summary;
                    document.getElementById('editorCategory').value = a.category;
                    document.getElementById('editorCountry').value = a.country;
                    document.getElementById('editorSource').value = a.source;
                    document.getElementById('editorImageUrl').value = a.imageUrl || '';
                    document.getElementById('editorUrl').value = a.url || '';
                    document.getElementById('editorIsHero').checked = Boolean(a.isHero);
                    document.getElementById('editorIsPinned').checked = Boolean(a.isPinned);
                    document.getElementById('editorSaveBtnText').textContent = 'Update Story';

                    updateWordCount();
                    updatePreviewImage();
                    switchTab('editor');
                }
            } catch (e) {}
        }

        async function deleteArticleDirect(id) {
            if (!confirm('Are you sure you want to permanently delete this article?')) return;
            try {
                const res = await fetch(\`/api/v1/cms/articles/\${id}\`, {
                    method: 'DELETE',
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                if (data.success) {
                    loadArticles(currentArticlesPage);
                }
            } catch (e) {}
        }

        async function toggleHeroDirect(id) {
            try {
                const res = await fetch(\`/api/v1/cms/articles/\${id}/hero\`, {
                    method: 'PATCH',
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                if (data.success) {
                    loadArticles(currentArticlesPage);
                }
            } catch (e) {}
        }

        function updateWordCount() {
            const text = document.getElementById('editorSummary').value.trim();
            const words = text ? text.split(/\\s+/).length : 0;
            const badge = document.getElementById('editorWordCount');
            badge.textContent = \`\${words} words\`;
            badge.className = \`text-[11px] font-mono \${words >= 110 && words <= 140 ? 'text-emerald-400 font-bold' : words < 110 ? 'text-amber-400' : 'text-rose-400'}\`;

            document.getElementById('previewHeadline').textContent = document.getElementById('editorTitle').value || 'Headline appears here...';
            document.getElementById('previewNarrative').textContent = text || 'Story narrative appears here...';
            document.getElementById('previewCategoryTag').textContent = document.getElementById('editorCategory').value;
            document.getElementById('previewSource').textContent = document.getElementById('editorSource').value || 'NewsFlow Editorial';
        }

        function updatePreviewImage() {
            const url = document.getElementById('editorImageUrl').value.trim();
            if (url) {
                document.getElementById('previewImage').src = url;
            }
        }

        function resetEditorForm() {
            document.getElementById('editArticleId').value = '';
            document.getElementById('editorTitle').value = '';
            document.getElementById('editorSummary').value = '';
            document.getElementById('editorImageUrl').value = '';
            document.getElementById('editorUrl').value = '';
            document.getElementById('editorIsHero').checked = false;
            document.getElementById('editorIsPinned').checked = false;
            document.getElementById('editorSaveBtnText').textContent = 'Publish Story';
            updateWordCount();
        }

        async function saveArticleFromEditor() {
            const id = document.getElementById('editArticleId').value;
            const title = document.getElementById('editorTitle').value.trim();
            const summary = document.getElementById('editorSummary').value.trim();
            const category = document.getElementById('editorCategory').value;
            const country = document.getElementById('editorCountry').value;
            const source = document.getElementById('editorSource').value.trim();
            const imageUrl = document.getElementById('editorImageUrl').value.trim();
            const url = document.getElementById('editorUrl').value.trim();
            const isHero = document.getElementById('editorIsHero').checked;
            const isPinned = document.getElementById('editorIsPinned').checked;

            if (!title || !summary) {
                alert('Please enter both a Headline and Story narrative.');
                return;
            }

            const payload = { title, summary, category, country, source, imageUrl, url, isHero, isPinned };
            const method = id ? 'PUT' : 'POST';
            const endpoint = id ? \`/api/v1/cms/articles/\${id}\` : '/api/v1/cms/articles';

            try {
                const res = await fetch(endpoint, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${authToken}\`
                    },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    alert(id ? 'Story updated successfully!' : 'Story published successfully!');
                    resetEditorForm();
                    switchTab('articles');
                } else {
                    alert('Error: ' + (data.error || 'Failed to save'));
                }
            } catch (e) {
                alert('Connection error');
            }
        }

        async function runAiSummarize() {
            const title = document.getElementById('editorTitle').value.trim();
            const content = document.getElementById('editorSummary').value.trim();
            if (!title) { alert('Please enter at least an Article Headline or raw text.'); return; }

            const btn = document.getElementById('aiSummarizeBtn');
            btn.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Generating 110-word summary...</span>';
            lucide.createIcons();

            try {
                const res = await fetch('/api/v1/cms/ai/summarize', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${authToken}\`
                    },
                    body: JSON.stringify({ title, content })
                });
                const data = await res.json();
                if (data.success && data.summary) {
                    document.getElementById('editorTitle').value = data.cleanTitle || title;
                    document.getElementById('editorSummary').value = data.summary;
                    updateWordCount();
                } else {
                    alert('AI summarization failed.');
                }
            } catch (e) {
                alert('AI connection error');
            } finally {
                btn.innerHTML = '<i data-lucide="wand-2" class="w-3.5 h-3.5"></i><span>1-Click AI Summarize & Polish</span>';
                lucide.createIcons();
            }
        }

        async function runAiFactCheck() {
            const headline = document.getElementById('editorTitle').value.trim();
            const story = document.getElementById('editorSummary').value.trim();
            if (!headline) { alert('Please enter an Article Headline.'); return; }

            const btn = document.getElementById('aiFactCheckBtn');
            btn.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Auditing facts...</span>';
            lucide.createIcons();

            try {
                const res = await fetch('/api/v1/cms/ai/fact-check', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${authToken}\`
                    },
                    body: JSON.stringify({ headline, story })
                });
                const data = await res.json();
                if (data.success && data.deepDive) {
                    alert(\`AI Fact Audit Result:\\n\\n\${data.deepDive.answer || JSON.stringify(data.deepDive)}\`);
                }
            } catch (e) {
                alert('Fact check connection error');
            } finally {
                btn.innerHTML = '<i data-lucide="check-check" class="w-3.5 h-3.5"></i><span>AI Deep Dive & Fact Audit</span>';
                lucide.createIcons();
            }
        }

        async function triggerGlobalIngest() {
            const spin = document.getElementById('ingestSpinIcon');
            spin.classList.add('animate-spin');
            try {
                const res = await fetch('/api/v1/cms/rss/trigger-all', {
                    method: 'POST',
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                alert(data.message || 'Ingestion cycle initiated in background!');
                setTimeout(() => loadArticles(1), 4000);
            } catch (e) {
                alert('Ingestion trigger failed');
            } finally {
                spin.classList.remove('animate-spin');
            }
        }

        async function flushRedisCache() {
            if (!confirm('Flush all Redis feed caches? Feeds will be re-generated on next user read.')) return;
            try {
                const res = await fetch('/api/v1/cms/analytics/flush-cache', {
                    method: 'POST',
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                alert(data.message || 'Redis cache flushed!');
            } catch (e) {
                alert('Cache flush failed');
            }
        }

        async function sendPushBroadcast() {
            const title = document.getElementById('pushTitle').value.trim();
            const body = document.getElementById('pushBody').value.trim();
            const category = document.getElementById('pushCategory').value;

            if (!title || !body) { alert('Title and body required.'); return; }
            if (!confirm(\`Broadcast notification to \${category} audience?\`)) return;

            try {
                const res = await fetch('/api/v1/cms/push/broadcast', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${authToken}\`
                    },
                    body: JSON.stringify({ title, body, category })
                });
                const data = await res.json();
                if (data.success) {
                    alert(data.message || 'Broadcast dispatched!');
                    document.getElementById('pushTitle').value = '';
                    document.getElementById('pushBody').value = '';
                    loadPushHistory();
                }
            } catch (e) {
                alert('Broadcast failed');
            }
        }

        async function loadPushHistory() {
            try {
                const res = await fetch('/api/v1/cms/push/history', {
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                const list = document.getElementById('pushHistoryList');
                if (data.success && data.logs) {
                    if (data.logs.length === 0) { list.innerHTML = 'No push broadcasts yet.'; return; }
                    list.innerHTML = data.logs.map(l => \`
                        <div class="p-3 rounded-xl bg-slate-900 border border-slate-800">
                            <div class="font-bold text-white">\${l.title}</div>
                            <div class="text-slate-400 line-clamp-1">\${l.body}</div>
                            <div class="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                                <span>Target: \${l.category || 'All Devices'} • \${l.sentCount} devices</span>
                                <span>\${new Date(l.sentAt).toLocaleTimeString()}</span>
                            </div>
                        </div>
                    \`).join('');
                }
            } catch (e) {}
        }

        async function loadAuditLogs() {
            try {
                const res = await fetch('/api/v1/cms/analytics/audit-logs', {
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                const tbody = document.getElementById('auditLogsTableBody');
                if (data.success && data.logs) {
                    if (data.logs.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-500">No audit logs recorded yet.</td></tr>'; return; }
                    tbody.innerHTML = data.logs.map(l => \`
                        <tr>
                            <td class="p-3 text-slate-400 font-mono text-[10px]">\${new Date(l.createdAt).toLocaleString()}</td>
                            <td class="p-3 font-semibold text-slate-200">\${l.admin ? l.admin.name : 'System'}</td>
                            <td class="p-3"><span class="px-2 py-0.5 rounded bg-slate-800 text-purple-300 font-mono text-[10px]">\${l.action}</span></td>
                            <td class="p-3 text-slate-400">\${l.entityType} \${l.entityId ? '#' + l.entityId.slice(0,8) : ''}</td>
                        </tr>
                    \`).join('');
                }
            } catch (e) {}
        }

        /* ─── VISUAL STORIES HANDLERS ─── */
        function openCreateStoryModal() {
            document.getElementById('modalStoryTitle').value = '';
            document.getElementById('modalStoryCover').value = 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800';
            document.getElementById('modalSlidesContainer').innerHTML = '';
            addSlideInputRow();
            addSlideInputRow();
            openModal('createStoryModal');
        }

        function addSlideInputRow() {
            const container = document.getElementById('modalSlidesContainer');
            const idx = container.children.length + 1;
            const div = document.createElement('div');
            div.className = 'p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2 relative slide-row';
            div.innerHTML = \`
                <div class="flex items-center justify-between text-xs text-purple-400 font-bold">
                    <span>Slide #\${idx}</span>
                    <button type="button" onclick="this.closest('.slide-row').remove()" class="text-slate-500 hover:text-rose-400 text-xs">✕ Remove</button>
                </div>
                <input type="text" placeholder="Slide Headline..." class="slide-headline w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white">
                <textarea placeholder="Slide Narrative Content..." rows="2" class="slide-content w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"></textarea>
                <input type="text" placeholder="Slide Image URL (optional)" class="slide-image w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-slate-400">
            \`;
            container.appendChild(div);
        }

        async function submitNewStory() {
            const title = document.getElementById('modalStoryTitle').value.trim();
            const category = document.getElementById('modalStoryCategory').value;
            const coverImage = document.getElementById('modalStoryCover').value.trim();

            const rows = document.querySelectorAll('.slide-row');
            const slides = Array.from(rows).map((r, i) => ({
                headline: r.querySelector('.slide-headline').value.trim() || \`Slide #\${i+1}\`,
                content: r.querySelector('.slide-content').value.trim() || '',
                image: r.querySelector('.slide-image').value.trim() || coverImage,
            }));

            if (!title || !coverImage) { alert('Title and cover image required.'); return; }

            try {
                const res = await fetch('/api/v1/cms/stories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${authToken}\` },
                    body: JSON.stringify({ title, category, coverImage, slides })
                });
                const data = await res.json();
                if (data.success) {
                    closeModal('createStoryModal');
                    loadVisualStories();
                    alert('Visual story published!');
                }
            } catch (e) { alert('Failed to create visual story'); }
        }

        async function loadVisualStories() {
            try {
                const res = await fetch('/api/v1/cms/stories', {
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                const grid = document.getElementById('storiesGrid');
                if (data.success && data.stories) {
                    if (data.stories.length === 0) { grid.innerHTML = '<div class="col-span-3 text-center text-slate-500 py-8 text-xs">No visual stories published.</div>'; return; }
                    grid.innerHTML = data.stories.map(s => \`
                        <div class="glass-card rounded-2xl overflow-hidden border border-slate-800 flex flex-col justify-between hover:border-purple-500/40 transition">
                            <div class="h-40 bg-slate-800 relative">
                                <img src="\${s.coverImage}" class="w-full h-full object-cover">
                                <span class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-purple-600/90 backdrop-blur-md text-white text-[10px] font-bold">\${s.category}</span>
                            </div>
                            <div class="p-4 space-y-2 flex-1 flex flex-col justify-between">
                                <div>
                                    <h4 class="font-bold text-xs text-white line-clamp-2">\${s.title}</h4>
                                    <p class="text-[11px] text-slate-400 mt-1 line-clamp-2">\${s.subtitle || ''}</p>
                                </div>
                                <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                                    <span class="text-[10px] font-semibold text-purple-300">\${s.slides.length} Infographic Slides</span>
                                    <button onclick="deleteStoryDirect('\${s.id}')" class="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-400 text-xs transition" title="Delete Story">
                                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    \`).join('');
                    lucide.createIcons();
                }
            } catch (e) {}
        }

        async function deleteStoryDirect(id) {
            if (!confirm('Permanently delete this visual story?')) return;
            try {
                const res = await fetch(\`/api/v1/cms/stories/\${id}\`, {
                    method: 'DELETE',
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                if (data.success) loadVisualStories();
            } catch (e) {}
        }

        /* ─── COMMUNITY POLLS HANDLERS ─── */
        function openCreatePollModal() {
            document.getElementById('modalPollQuestion').value = '';
            document.getElementById('modalPollTopicTag').value = '';
            document.getElementById('modalPollOptionsContainer').innerHTML = '';
            addPollOptionRow('Yes, highly likely');
            addPollOptionRow('No, significant bottlenecks');
            openModal('createPollModal');
        }

        function addPollOptionRow(defaultVal = '') {
            const container = document.getElementById('modalPollOptionsContainer');
            const div = document.createElement('div');
            div.className = 'flex items-center gap-2 poll-option-row';
            div.innerHTML = \`
                <input type="text" value="\${defaultVal}" placeholder="Option text..." class="poll-option-input flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white">
                <button type="button" onclick="this.closest('.poll-option-row').remove()" class="text-slate-500 hover:text-rose-400 px-1.5 text-xs">✕</button>
            \`;
            container.appendChild(div);
        }

        async function submitNewPoll() {
            const question = document.getElementById('modalPollQuestion').value.trim();
            const category = document.getElementById('modalPollCategory').value;
            const topicTag = document.getElementById('modalPollTopicTag').value.trim();
            const optionInputs = document.querySelectorAll('.poll-option-input');
            const options = Array.from(optionInputs).map(i => i.value.trim()).filter(Boolean);

            if (!question || options.length < 2) { alert('Question and at least 2 options required.'); return; }

            try {
                const res = await fetch('/api/v1/cms/polls', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${authToken}\` },
                    body: JSON.stringify({ question, category, topicTag, options })
                });
                const data = await res.json();
                if (data.success) {
                    closeModal('createPollModal');
                    loadPolls();
                    alert('Poll launched successfully!');
                }
            } catch (e) { alert('Failed to launch poll'); }
        }

        async function loadPolls() {
            try {
                const res = await fetch('/api/v1/cms/polls', {
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                const list = document.getElementById('pollsList');
                if (data.success && data.polls) {
                    if (data.polls.length === 0) { list.innerHTML = '<div class="text-center text-slate-500 py-8 text-xs col-span-2">No community polls created yet.</div>'; return; }
                    list.innerHTML = data.polls.map(p => \`
                        <div class="glass-card p-5 rounded-2xl space-y-3 flex flex-col justify-between hover:border-amber-500/40 transition">
                            <div class="space-y-1">
                                <div class="flex items-center justify-between">
                                    <span class="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase">\${p.category} • \${p.topicTag || 'Pulse'}</span>
                                    <span class="text-[11px] text-amber-400 font-mono font-bold">\${p.totalVotes} Total Votes</span>
                                </div>
                                <h4 class="font-bold text-xs text-white">\${p.question}</h4>
                            </div>
                            <div class="space-y-2 pt-1">
                                \${p.options.map(opt => \`
                                    <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                                        <div class="flex items-center justify-between text-xs">
                                            <span class="text-slate-300 font-medium">\${opt.text}</span>
                                            <span class="font-mono text-emerald-400 font-bold">\${opt.percentage}% (\${opt.votes})</span>
                                        </div>
                                        <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div class="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full" style="width: \${opt.percentage}%"></div>
                                        </div>
                                    </div>
                                \`).join('')}
                            </div>
                            <div class="pt-2 border-t border-slate-800 flex items-center justify-between">
                                <button onclick="resetPollDirect('\${p.id}')" class="text-[11px] text-slate-400 hover:text-amber-400 font-semibold flex items-center gap-1 transition">
                                    <i data-lucide="rotate-ccw" class="w-3 h-3"></i> Reset Votes
                                </button>
                                <button onclick="deletePollDirect('\${p.id}')" class="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-400 transition" title="Delete Poll">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                        </div>
                    \`).join('');
                    lucide.createIcons();
                }
            } catch (e) {}
        }

        async function resetPollDirect(id) {
            if (!confirm('Reset all vote tallies to 0 for this poll?')) return;
            try {
                const res = await fetch(\`/api/v1/cms/polls/\${id}/reset\`, {
                    method: 'POST',
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                if (data.success) loadPolls();
            } catch (e) {}
        }

        async function deletePollDirect(id) {
            if (!confirm('Permanently delete this poll?')) return;
            try {
                const res = await fetch(\`/api/v1/cms/polls/\${id}\`, {
                    method: 'DELETE',
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                if (data.success) loadPolls();
            } catch (e) {}
        }

        /* ─── RSS SOURCES HANDLERS ─── */
        function openAddRssModal() {
            document.getElementById('modalRssName').value = '';
            document.getElementById('modalRssUrl').value = '';
            openModal('addRssModal');
        }

        async function submitNewRss() {
            const name = document.getElementById('modalRssName').value.trim();
            const url = document.getElementById('modalRssUrl').value.trim();
            const category = document.getElementById('modalRssCategory').value;
            const country = document.getElementById('modalRssCountry').value;

            if (!name || !url) { alert('Name and URL required.'); return; }

            try {
                const res = await fetch('/api/v1/cms/rss/sources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${authToken}\` },
                    body: JSON.stringify({ name, url, category, country })
                });
                const data = await res.json();
                if (data.success) {
                    closeModal('addRssModal');
                    loadRssSources();
                    alert('RSS source registered!');
                }
            } catch (e) { alert('Failed to register RSS source'); }
        }

        async function loadRssSources() {
            try {
                const res = await fetch('/api/v1/cms/rss/sources', {
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                const list = document.getElementById('rssSourcesList');
                if (data.success && data.sources) {
                    if (data.sources.length === 0) { list.innerHTML = '<div class="text-center text-slate-500 py-8 text-xs col-span-2">No RSS sources registered.</div>'; return; }
                    list.innerHTML = data.sources.map(s => \`
                        <div class="glass-card p-4 rounded-2xl flex flex-col justify-between space-y-3 hover:border-orange-500/40 transition">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <div class="font-bold text-xs text-white flex items-center gap-1.5">
                                        <span>\${s.name}</span>
                                        <span class="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[9px] font-mono">\${s.country}</span>
                                    </div>
                                    <div class="text-[11px] font-mono text-slate-400 truncate max-w-xs mt-0.5">\${s.url}</div>
                                </div>
                                <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">\${s.category}</span>
                            </div>
                            <div class="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                                <span class="text-[10px] text-slate-400">Interval: \${s.fetchInterval}m • \${s.lastStatus || 'ACTIVE'}</span>
                                <button onclick="deleteRssDirect('\${s.id}')" class="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-400 transition" title="Delete Source">
                                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                        </div>
                    \`).join('');
                    lucide.createIcons();
                }
            } catch (e) {}
        }

        async function deleteRssDirect(id) {
            if (!confirm('Remove this RSS source?')) return;
            try {
                const res = await fetch(\`/api/v1/cms/rss/sources/\${id}\`, {
                    method: 'DELETE',
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                if (data.success) loadRssSources();
            } catch (e) {}
        }

        /* ─── TAXONOMY HANDLERS ─── */
        function openAddCategoryModal() {
            document.getElementById('modalCatName').value = '';
            document.getElementById('modalCatEmoji').value = '⚡';
            openModal('addCategoryModal');
        }

        async function submitNewCategory() {
            const name = document.getElementById('modalCatName').value.trim();
            const emoji = document.getElementById('modalCatEmoji').value.trim();
            const sortOrder = document.getElementById('modalCatOrder').value;

            if (!name) { alert('Category name required.'); return; }

            try {
                const res = await fetch('/api/v1/cms/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${authToken}\` },
                    body: JSON.stringify({ name, emoji, sortOrder })
                });
                const data = await res.json();
                if (data.success) {
                    closeModal('addCategoryModal');
                    loadTaxonomy();
                    alert('Category added!');
                }
            } catch (e) { alert('Failed to add category'); }
        }

        async function loadTaxonomy() {
            try {
                const res = await fetch('/api/v1/cms/categories', {
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                const list = document.getElementById('taxonomyList');
                if (data.success && data.categories) {
                    if (data.categories.length === 0) { list.innerHTML = '<div class="text-center text-slate-500 py-8 text-xs col-span-4">No dynamic categories.</div>'; return; }
                    list.innerHTML = data.categories.map(c => \`
                        <div class="glass-card p-4 rounded-2xl flex items-center justify-between hover:border-teal-500/40 transition">
                            <div class="flex items-center gap-2.5">
                                <span class="text-xl">\${c.emoji}</span>
                                <div>
                                    <div class="font-bold text-xs text-white">\${c.name}</div>
                                    <span class="text-[9px] font-mono text-slate-400">slug: \${c.slug}</span>
                                </div>
                            </div>
                            <button onclick="deleteCategoryDirect('\${c.id}')" class="p-1 rounded-lg hover:bg-rose-900/40 text-slate-500 hover:text-rose-400 transition">
                                <i data-lucide="trash-2" class="w-3 h-3"></i>
                            </button>
                        </div>
                    \`).join('');
                    lucide.createIcons();
                }
            } catch (e) {}
        }

        async function deleteCategoryDirect(id) {
            if (!confirm('Remove this category?')) return;
            try {
                const res = await fetch(\`/api/v1/cms/categories/\${id}\`, {
                    method: 'DELETE',
                    headers: { 'Authorization': \`Bearer \${authToken}\` }
                });
                const data = await res.json();
                if (data.success) loadTaxonomy();
            } catch (e) {}
        }
    </script>
</body>
</html>`);
    }
}
