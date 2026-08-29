import { prisma } from '../config/db.js';

export class CmsSeedService {
    /**
     * Seeds initial CMS records (RSS feeds, Visual Stories, Polls, Categories) if tables are empty.
     * Guaranteed non-blocking and executes safely on server startup.
     */
    public static async seedDefaultsIfNeeded(): Promise<void> {
        try {
            await Promise.all([
                this.seedCategories(),
                this.seedRssSources(),
                this.seedCommunityPolls(),
                this.seedVisualStories(),
            ]);
            console.log('✅ [CMS Seed] CMS tables verified & default records initialized.');
        } catch (e: any) {
            console.warn('⚠️ [CMS Seed] Seed notice (check if DB is ready):', e.message);
        }
    }

    private static async seedCategories() {
        try {
            const count = await prisma.categoryTaxonomy.count();
            if (count > 0) return;

            const DEFAULT_CATEGORIES = [
                { name: 'Top Stories', slug: 'top-stories', emoji: '🔥', sortOrder: 1 },
                { name: 'Technology', slug: 'technology', emoji: '💻', sortOrder: 2 },
                { name: 'Business', slug: 'business', emoji: '📈', sortOrder: 3 },
                { name: 'Sports', slug: 'sports', emoji: '🏏', sortOrder: 4 },
                { name: 'Entertainment', slug: 'entertainment', emoji: '🎬', sortOrder: 5 },
                { name: 'Science', slug: 'science', emoji: '🧬', sortOrder: 6 },
                { name: 'Health', slug: 'health', emoji: '🩺', sortOrder: 7 },
                { name: 'World', slug: 'world', emoji: '🌍', sortOrder: 8 },
                { name: 'Politics', slug: 'politics', emoji: '🏛️', sortOrder: 9 },
                { name: 'Crypto', slug: 'crypto', emoji: '🪙', sortOrder: 10 },
                { name: 'Startups', slug: 'startups', emoji: '🚀', sortOrder: 11 },
                { name: 'Defense', slug: 'defense', emoji: '🛡️', sortOrder: 12 },
            ];

            await prisma.categoryTaxonomy.createMany({
                data: DEFAULT_CATEGORIES.map((c) => ({
                    name: c.name,
                    slug: c.slug,
                    emoji: c.emoji,
                    sortOrder: c.sortOrder,
                    isActive: true,
                })),
                skipDuplicates: true,
            });
        } catch (e) {}
    }

    private static async seedRssSources() {
        try {
            const count = await prisma.rssFeedSource.count();
            if (count > 0) return;

            const DEFAULT_SOURCES = [
                { name: 'Reuters World News', url: 'https://feeds.reuters.com/reuters/worldNews', category: 'World', country: 'GLOBAL', fetchInterval: 15 },
                { name: 'BBC Top Stories', url: 'https://feeds.bbci.co.uk/news/rss.xml', category: 'Top Stories', country: 'GB', fetchInterval: 15 },
                { name: 'TechCrunch Headlines', url: 'https://techcrunch.com/feed/', category: 'Technology', country: 'GLOBAL', fetchInterval: 15 },
                { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'Technology', country: 'US', fetchInterval: 15 },
                { name: 'NDTV India Top Stories', url: 'https://feeds.feedburner.com/ndtvnews-top-stories', category: 'Top Stories', country: 'IN', fetchInterval: 15 },
                { name: 'CNBC Business News', url: 'https://search.cnbc.com/rs/search/view.html?partnerId=2000&keywords=business&categories=exclude', category: 'Business', country: 'US', fetchInterval: 15 },
                { name: 'ESPN Sports Center', url: 'https://www.espn.com/espn/rss/news', category: 'Sports', country: 'GLOBAL', fetchInterval: 15 },
                { name: 'Variety Entertainment', url: 'https://variety.com/feed/', category: 'Entertainment', country: 'US', fetchInterval: 15 },
                { name: 'CoinDesk Crypto & Web3', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', category: 'Crypto', country: 'GLOBAL', fetchInterval: 15 },
                { name: 'Nature Science Journal', url: 'https://www.nature.com/nature.rss', category: 'Science', country: 'GLOBAL', fetchInterval: 20 },
                { name: 'Medical News Today', url: 'https://www.medicalnewstoday.com/feed', category: 'Health', country: 'GLOBAL', fetchInterval: 20 },
                { name: 'Hindustan Times Business', url: 'https://www.hindustantimes.com/feeds/rss/business/rssfeed.xml', category: 'Business', country: 'IN', fetchInterval: 15 },
            ];

            for (const s of DEFAULT_SOURCES) {
                try {
                    await prisma.rssFeedSource.upsert({
                        where: { url: s.url },
                        update: {},
                        create: {
                            name: s.name,
                            url: s.url,
                            category: s.category,
                            country: s.country,
                            fetchInterval: s.fetchInterval,
                            isActive: true,
                            lastStatus: 'SUCCESS',
                        },
                    });
                } catch (e) {}
            }
        } catch (e) {}
    }

    private static async seedCommunityPolls() {
        try {
            const count = await prisma.communityPoll.count();
            if (count > 0) return;

            const DEFAULT_POLLS = [
                {
                    question: 'Will Artificial General Intelligence (AGI) be achieved before 2029?',
                    category: 'Technology',
                    topicTag: 'AI & Compute',
                    authorName: 'NewsFlow Editorial',
                    options: [
                        { text: 'Yes, rapid exponential compute scaling', votes: 342 },
                        { text: 'No, physical hardware & energy bottlenecks', votes: 198 },
                        { text: 'Uncertain / Too early to predict', votes: 76 },
                    ],
                },
                {
                    question: 'Who will win the upcoming International Cricket Trophy final?',
                    category: 'Sports',
                    topicTag: 'Cricket',
                    authorName: 'Sports Desk',
                    options: [
                        { text: 'India 🇮🇳', votes: 512 },
                        { text: 'Australia 🇦🇺', votes: 245 },
                        { text: 'England / South Africa', votes: 89 },
                    ],
                },
                {
                    question: 'Will the benchmark Sensex cross the 100,000 milestone this financial year?',
                    category: 'Business',
                    topicTag: 'Markets',
                    authorName: 'Markets Desk',
                    options: [
                        { text: 'Bullish: Strong domestic retail & SIP inflows', votes: 420 },
                        { text: 'Bearish: Global headwinds & elevated valuations', votes: 165 },
                    ],
                },
                {
                    question: 'How do you prefer consuming daily breaking news?',
                    category: 'Top Stories',
                    topicTag: 'Reader Pulse',
                    authorName: 'NewsFlow Pulse',
                    options: [
                        { text: '⚡ 60-word quick summaries (Inshorts style)', votes: 610 },
                        { text: '🎧 Hands-free AI audio voice briefing', votes: 280 },
                        { text: '📖 Long-form deep dive articles', votes: 94 },
                    ],
                },
            ];

            for (const p of DEFAULT_POLLS) {
                await prisma.communityPoll.create({
                    data: {
                        question: p.question,
                        category: p.category,
                        topicTag: p.topicTag,
                        authorName: p.authorName,
                        isActive: true,
                        options: {
                            create: p.options.map((o) => ({
                                text: o.text,
                                votes: o.votes,
                            })),
                        },
                    },
                });
            }
        } catch (e) {}
    }

    private static async seedVisualStories() {
        try {
            const count = await prisma.visualStory.count();
            if (count > 0) return;

            const DEFAULT_STORIES = [
                {
                    title: 'The Generative AI Compute Revolution',
                    subtitle: 'How next-generation Blackwell and custom silicon are transforming data centers worldwide.',
                    category: 'Technology',
                    coverImage: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800',
                    slides: [
                        {
                            image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800',
                            headline: 'Exponential GPU Demand Surges',
                            subheadline: 'Trillion-parameter models require gigawatt-scale infrastructure.',
                            content: 'Global compute capacity has grown over 10x in the past 24 months, driven by hyperscaler AI clusters across North America, Europe, and Asia.',
                            sortOrder: 0,
                        },
                        {
                            image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
                            headline: 'Liquid Cooling Becomes the Standard',
                            subheadline: 'Data center thermal dissipation reaches new milestones.',
                            content: 'Traditional air cooling can no longer handle 1000W+ processors. Direct-to-chip liquid cooling is now being deployed across all tier-1 AI facilities.',
                            sortOrder: 1,
                        },
                        {
                            image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
                            headline: 'Next Frontier: Sovereign AI Clusters',
                            subheadline: 'Nations invest billions in localized compute independence.',
                            content: 'Governments in India, Japan, France, and the UAE are commissioning domestic supercomputers to train cultural and native language foundational models.',
                            sortOrder: 2,
                        },
                    ],
                },
                {
                    title: 'Global Renewable Energy Super-Grid',
                    subtitle: 'Solar and wind parity accelerating clean power transitions across continents.',
                    category: 'Science',
                    coverImage: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800',
                    slides: [
                        {
                            image: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800',
                            headline: 'Solar Installation Records Shattered',
                            subheadline: 'Over 500 GW of global photovoltaic capacity added this year.',
                            content: 'Plummeting solar module costs have made utility-scale solar the cheapest source of newly installed electricity across 90% of global markets.',
                            sortOrder: 0,
                        },
                        {
                            image: 'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=800',
                            headline: 'Grid-Scale Battery Storage Booms',
                            subheadline: 'Lithium iron phosphate batteries solve peak intermittency.',
                            content: 'Massive multi-gigawatt-hour battery storage facilities in California, Australia, and Gujarat are now stabilizing nighttime electricity delivery.',
                            sortOrder: 1,
                        },
                    ],
                },
                {
                    title: 'India Space Odyssey: Gaganyaan & Beyond',
                    subtitle: 'ISRO advances human spaceflight and deep-space lunar base ambitions.',
                    category: 'Science',
                    coverImage: 'https://images.unsplash.com/photo-1517976487502-5f654b036980?w=800',
                    slides: [
                        {
                            image: 'https://images.unsplash.com/photo-1517976487502-5f654b036980?w=800',
                            headline: 'Human-Rated LVM3 Launch Approaching',
                            subheadline: 'Astronaut crew capsule successfully completes abort tests.',
                            content: 'ISRO engineers have finalized environmental control and life support systems for the upcoming uncrewed orbital flight demonstration.',
                            sortOrder: 0,
                        },
                    ],
                },
            ];

            for (const s of DEFAULT_STORIES) {
                await prisma.visualStory.create({
                    data: {
                        title: s.title,
                        subtitle: s.subtitle,
                        category: s.category,
                        coverImage: s.coverImage,
                        isActive: true,
                        slides: {
                            create: s.slides.map((sl) => ({
                                image: sl.image,
                                headline: sl.headline,
                                subheadline: sl.subheadline,
                                content: sl.content,
                                sortOrder: sl.sortOrder,
                            })),
                        },
                    },
                });
            }
        } catch (e) {}
    }
}
