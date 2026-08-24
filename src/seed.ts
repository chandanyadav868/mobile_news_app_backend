import { prisma } from './config/db.js';

const INITIAL_INSIGHTS = [
  {
    title: 'THE PSYCHOLOGY OF ATTENTION: HOW MODERN APPS CAPTURE FOCUS',
    subtitle: 'From dopamine loops to variable reward schedules in daily interfaces',
    coverImage: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&q=80',
    slides: [
      {
        title: 'THE ATTENTION ECONOMY',
        subtitle: 'Why your screen time is the most valuable commodity on earth',
        content: 'Every modern social feed is engineered around variable ratio schedules of reinforcement.',
        image: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&q=80',
      },
      {
        title: 'THE DOPAMINE LOOP',
        subtitle: 'The neurological mechanism behind the bottom-pull refresh',
        content: 'Anticipation triggers greater dopamine release than the actual reward itself.',
        image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80',
      },
    ],
  },
  {
    title: 'QUANTUM COMPUTING: BEYOND THE CLASSICAL SILICON HORIZON',
    subtitle: 'Understanding qubits, superposition, and next-decade cryptographic disruption',
    coverImage: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=80',
    slides: [
      {
        title: 'SUPERPOSITION & ENTANGLEMENT',
        subtitle: 'How subatomic states enable exponential compute parallelization',
        content: 'Unlike binary bits that exist as 0 or 1, qubits exploit probabilistic superposition.',
        image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=80',
      },
    ],
  },
];

const INITIAL_TIMELINES = [
  {
    title: 'ISRO Chandrayaan-3 & Gaganyaan Lunar Roadmap',
    category: 'Science',
    description: 'Chronological roadmap of Indias historic lunar touchdown and upcoming human spaceflight mission.',
    events: [
      {
        title: 'Chandrayaan-3 Historic Soft Landing on Lunar South Pole',
        date: 'Aug 23, 2023',
        snippet: 'Vikram lander achieved soft landing near the Moon south pole, making India the first nation to do so.',
        source: 'ISRO',
        sourceUrl: 'https://isro.gov.in',
        order: 1,
      },
      {
        title: 'Pragyan Rover Completes In-Situ Mineral Analysis',
        date: 'Sep 02, 2023',
        snippet: 'The 26kg rover confirmed presence of Sulphur, Aluminium, Calcium, and Iron on lunar regolith.',
        source: 'The Hindu',
        sourceUrl: 'https://thehindu.com',
        order: 2,
      },
    ],
  },
];

async function seed() {
  console.log('🌱 Starting database seeding...');

  // Seed Insights
  for (const story of INITIAL_INSIGHTS) {
    await prisma.insightStory.create({
      data: story,
    });
  }
  console.log(`✅ Seeded ${INITIAL_INSIGHTS.length} Visual Insight stories.`);

  // Seed Timelines
  for (const topic of INITIAL_TIMELINES) {
    await prisma.timelineTopic.create({
      data: {
        title: topic.title,
        category: topic.category,
        description: topic.description,
        events: {
          create: topic.events,
        },
      },
    });
  }
  console.log(`✅ Seeded ${INITIAL_TIMELINES.length} Timeline topics.`);

  console.log('🎉 Seeding completed successfully!');
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error('Seeding error:', e);
  process.exit(1);
});
