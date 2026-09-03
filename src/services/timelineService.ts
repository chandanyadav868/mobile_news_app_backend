import { prisma } from '../config/db.js';

export interface TimelineEventPayload {
  title: string;
  date: string;
  timeAgo?: string;
  snippet: string;
  image?: string;
  source: string;
  sourceUrl: string;
}

export interface TimelineTopicPayload {
  title: string;
  category: string;
  description?: string;
  leadImage?: string;
  isPinned?: boolean;
  events: TimelineEventPayload[];
}

export class TimelineService {
  /**
   * Helper to format relative time
   */
  private static formatRelativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    if (diffMinutes < 60) return `${Math.max(1, diffMinutes)}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  /**
   * Fetch all active timeline topics with chronological events
   */
  public static async getAllTimelines() {
    await this.seedDefaultTimelinesIfNeeded();

    const topics = await (prisma as any).timelineTopic.findMany({
      include: {
        events: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 20,
    });

    return topics.map((topic: any) => {
      const timeAgo = this.formatRelativeTime(new Date(topic.updatedAt));
      const isNew = (Date.now() - new Date(topic.updatedAt).getTime()) < 24 * 3600 * 1000;

      let cleanDesc = topic.description || '';
      let leadImage = 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&q=80';
      let isPinned = false;

      try {
        if (cleanDesc.startsWith('{')) {
          const parsed = JSON.parse(cleanDesc);
          cleanDesc = parsed.description || cleanDesc;
          leadImage = parsed.leadImage || leadImage;
          isPinned = !!parsed.isPinned;
        }
      } catch (e) {}

      return {
        id: topic.id,
        title: topic.title,
        category: topic.category,
        timeAgo,
        isNew,
        leadImage,
        isPinned,
        events: (topic.events || []).map((e: any) => {
          let eventImg = leadImage;
          let eventUrl = e.sourceUrl || '';
          if (eventUrl.includes('#img=')) {
            const [url, imgPart] = eventUrl.split('#img=');
            eventUrl = url;
            eventImg = decodeURIComponent(imgPart);
          }

          return {
            id: e.id,
            title: e.title,
            timeAgo: e.date,
            image: eventImg,
            link: eventUrl,
            snippet: e.snippet,
            source: e.source,
          };
        }),
        discussion: {
          id: `disc-${topic.id}`,
          title: cleanDesc || `Live community pulse on ${topic.title}`,
          snippet: `Join verified readers tracking chronological developments across ${topic.title}.`,
          authorName: 'NewsFlow Editorial',
          timeAgo: 'Live',
          repliesCount: Math.floor(Math.abs(Math.sin(topic.title.length)) * 50) + 15,
        },
      };
    });
  }

  /**
   * Seed realistic live storylines if database has 0 timeline records
   */
  public static async seedDefaultTimelinesIfNeeded(): Promise<void> {
    try {
      const count = await (prisma as any).timelineTopic.count();
      if (count >= 4) return;

      console.log('🌱 [TimelineService] Seeding initial rich live timelines...');

      const defaultTimelines: TimelineTopicPayload[] = [
        {
          title: 'Global Semiconductor & AI Supercomputer Race',
          category: 'Technology',
          description: 'Chronological timeline of trillion-dollar quantum chip architecture announcements and trade curbs.',
          leadImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1000&auto=format&fit=crop&q=80',
          isPinned: true,
          events: [
            {
              title: 'Next-Gen 2nm Fabrication Nodes Enter Commercial Trial Runs',
              date: '2h ago',
              timeAgo: '2h ago',
              snippet: 'Foundries in Taiwan and Japan announce stable sub-2nm test yields with 40% reduction in thermal dissipation.',
              image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&auto=format&fit=crop&q=80',
              source: 'TechPulse Daily',
              sourceUrl: 'https://techradar.com',
            },
            {
              title: 'Global Tech Consortium Unveils Open Edge Inference Standard',
              date: '5h ago',
              timeAgo: '5h ago',
              snippet: 'Over 30 enterprise device manufacturers adopt standardized on-device neural model compression.',
              image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
              source: 'Silicon Review',
              sourceUrl: 'https://geekwire.com',
            },
            {
              title: 'Energy Grid Upgrades Approved to Power Multi-Gigawatt AI Clusters',
              date: '1d ago',
              timeAgo: '1d ago',
              snippet: 'Energy regulators clear fast-track nuclear and geothermal hookups for regional data center facilities.',
              image: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=600&auto=format&fit=crop&q=80',
              source: 'CleanEnergy Dispatch',
              sourceUrl: 'https://independent.co.uk',
            },
          ],
        },
        {
          title: 'India Digital Currency & Cross-Border UPI Expansion',
          category: 'Finance',
          description: 'Live milestone tracker of instant global bilateral settlement agreements and central bank pilot rollouts.',
          leadImage: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1000&auto=format&fit=crop&q=80',
          isPinned: true,
          events: [
            {
              title: 'Bilateral Instant Rupee Settlement Goes Live Across 12 GCC & ASEAN Hubs',
              date: '1h ago',
              timeAgo: '1h ago',
              snippet: 'Direct sovereign payment connectivity eliminates intermediate currency conversion fees for international remittances.',
              image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&auto=format&fit=crop&q=80',
              source: 'Financial Express',
              sourceUrl: 'https://hindustantimes.com',
            },
            {
              title: 'Offline Digital Rupee Smart Cards Tested for Remote Rural Connectivity',
              date: '6h ago',
              timeAgo: '6h ago',
              snippet: 'Telecom authorities and banking consortiums validate dual-tap NFC transactions without active internet connectivity.',
              image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&auto=format&fit=crop&q=80',
              source: 'Economic Times',
              sourceUrl: 'https://timesofindia.indiatimes.com',
            },
            {
              title: 'Central Bank Issues Interoperability Guidelines for FinTech Wallets',
              date: '1d ago',
              timeAgo: '1d ago',
              snippet: 'Unified QR specifications mandate frictionless peer-to-merchant token movement across all verified payment apps.',
              image: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=600&auto=format&fit=crop&q=80',
              source: 'MoneyControl',
              sourceUrl: 'https://thehindu.com',
            },
          ],
        },
        {
          title: 'SpaceX Starship Orbital Refueling & Moon Mission',
          category: 'Science',
          description: 'Key engineering tests and launch windows leading up to Artemis lunar cargo deployment.',
          leadImage: 'https://images.unsplash.com/photo-1517976487502-86470a1a1db5?w=1000&auto=format&fit=crop&q=80',
          isPinned: false,
          events: [
            {
              title: 'Flight Test 7 Completes Full Catch of Super Heavy Booster',
              date: '3h ago',
              timeAgo: '3h ago',
              snippet: 'The mechanical launch tower arms successfully snare the returning booster during terminal supersonic descent.',
              image: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=600&auto=format&fit=crop&q=80',
              source: 'Cosmic Watch',
              sourceUrl: 'https://sciencedaily.com',
            },
            {
              title: 'In-Space Cryogenic Propellant Transfer Verification Clears Stage 1',
              date: '8h ago',
              timeAgo: '8h ago',
              snippet: 'Telemetry confirms sub-zero liquid methane transfer between docked ship prototypes with zero boil-off loss.',
              image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80',
              source: 'AeroSpace Weekly',
              sourceUrl: 'https://sciencedaily.com',
            },
          ],
        },
        {
          title: 'US-Canada Trade War & Cross-Border Tariff Quotas',
          category: 'National',
          description: 'Real-time trade negotiation developments, industrial tariffs, and border commerce regulations.',
          leadImage: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1000&auto=format&fit=crop&q=80',
          isPinned: false,
          events: [
            {
              title: 'Bilateral Talks Reconvene in Washington to Review Automotive Exemptions',
              date: '4h ago',
              timeAgo: '4h ago',
              snippet: 'Trade ministers open round 3 consultations focusing on steel tariffs and agricultural cross-border quotas.',
              image: 'https://images.unsplash.com/photo-1580828343064-fde4fc206bc6?w=600&auto=format&fit=crop&q=80',
              source: 'Global Wire',
              sourceUrl: 'https://independent.co.uk',
            },
            {
              title: 'Bank of Canada Releases Economic Forecast on Supply Chain Adjustments',
              date: '10h ago',
              timeAgo: '10h ago',
              snippet: 'Central bank model projects alternative export agreements with European and Asian trading partners.',
              image: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=600&auto=format&fit=crop&q=80',
              source: 'Reuters Desk',
              sourceUrl: 'https://news18.com',
            },
          ],
        },
      ];

      for (const t of defaultTimelines) {
        const metadata = JSON.stringify({
          description: t.description,
          leadImage: t.leadImage,
          isPinned: t.isPinned ?? false,
        });

        await (prisma as any).timelineTopic.create({
          data: {
            title: t.title,
            category: t.category,
            description: metadata,
            events: {
              create: t.events.map((e, idx) => ({
                title: e.title,
                date: e.date,
                snippet: e.snippet,
                source: e.source,
                sourceUrl: e.image ? `${e.sourceUrl}#img=${encodeURIComponent(e.image)}` : e.sourceUrl,
                order: idx,
              })),
            },
          },
        });
      }

      console.log('✅ [TimelineService] Successfully seeded 4 live timelines with 11 milestones.');
    } catch (e: any) {
      console.warn('⚠️ [TimelineService] Could not seed timelines:', e.message);
    }
  }

  /**
   * Generate an on-demand chronological timeline for any custom keyword
   */
  public static async trackKeywordTimeline(keyword: string) {
    const cleanKw = (keyword || '').trim();
    if (!cleanKw) throw new Error('Keyword is required');

    // 1. Check if an active topic already exists
    const existing = await (prisma as any).timelineTopic.findFirst({
      where: {
        title: { contains: cleanKw, mode: 'insensitive' },
      },
      include: { events: { orderBy: { order: 'asc' } } },
    });

    if (existing) {
      return existing;
    }

    // 2. Look for relevant articles in PostgreSQL
    const matchingArticles = await prisma.article.findMany({
      where: {
        OR: [
          { title: { contains: cleanKw, mode: 'insensitive' } },
          { summary: { contains: cleanKw, mode: 'insensitive' } },
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: 6,
    });

    const leadImage = matchingArticles.find((a: any) => a.imageUrl)?.imageUrl ||
      'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=1000&auto=format&fit=crop&q=80';
    const category = matchingArticles[0]?.category || 'General';

    const eventsData = matchingArticles.map((art: any, idx: number) => ({
      title: art.title,
      date: this.formatRelativeTime(new Date(art.publishedAt)),
      timeAgo: this.formatRelativeTime(new Date(art.publishedAt)),
      snippet: art.summary ? art.summary.slice(0, 160) + '...' : 'Verified breaking report on ' + cleanKw,
      image: art.imageUrl || leadImage,
      source: art.source || 'NewsFlow',
      sourceUrl: art.url || '',
      order: idx,
    }));

    // If fewer than 2 articles found in DB, generate synthesized events
    if (eventsData.length < 2) {
      eventsData.push({
        title: `Live Breaking Developments: ${cleanKw}`,
        date: 'Just now',
        timeAgo: 'Just now',
        snippet: `Verified chronological tracker activated for ${cleanKw}. Real-time news ingestion underway.`,
        image: leadImage,
        source: 'NewsFlow Pulse',
        sourceUrl: 'https://newsflow.ai',
        order: eventsData.length,
      });
      eventsData.push({
        title: `Initial Situation Brief: ${cleanKw}`,
        date: '2h ago',
        timeAgo: '2h ago',
        snippet: `Initial signals and stakeholder responses observed across global wires for ${cleanKw}.`,
        image: leadImage,
        source: 'Global Wire',
        sourceUrl: 'https://newsflow.ai',
        order: eventsData.length,
      });
    }

    const metadata = JSON.stringify({
      description: `Verified chronological intelligence stream tracking all key milestones across ${cleanKw}.`,
      leadImage,
      isPinned: false,
    });

    const created = await (prisma as any).timelineTopic.create({
      data: {
        title: `${cleanKw} • Live Storyline`,
        category,
        description: metadata,
        events: {
          create: eventsData.map((e) => ({
            title: e.title,
            date: e.date,
            snippet: e.snippet,
            source: e.source,
            sourceUrl: e.image ? `${e.sourceUrl}#img=${encodeURIComponent(e.image)}` : e.sourceUrl,
            order: e.order,
          })),
        },
      },
      include: { events: { orderBy: { order: 'asc' } } },
    });

    return created;
  }
}
