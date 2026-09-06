import { normalizeForSpeech } from '../utils/speechNormalizer.js';

function runTests() {
    let passed = 0;
    let failed = 0;

    function assertEqual(testName: string, actual: string, expected: string) {
        if (actual === expected) {
            console.log(`✅ [PASS] ${testName}`);
            passed++;
        } else {
            console.error(`❌ [FAIL] ${testName}`);
            console.error(`   Actual  : "${actual}"`);
            console.error(`   Expected: "${expected}"`);
            failed++;
        }
    }

    console.log('\n--- Running Speech Normalizer Tests ---\n');

    // Test 1: Apostrophe & Possessives with Unicode Curly Quotes
    assertEqual(
        "Preserve possessives with Unicode curly apostrophe ('’')",
        normalizeForSpeech("India’s economy and Apple’s new product are thriving."),
        "India's economy and Apple's new product are thriving."
    );

    // Test 2: Contractions with curly quotes
    assertEqual(
        "Preserve contractions with curly quotes",
        normalizeForSpeech("It’s true that they didn’t know, but don’t worry."),
        "It's true that they didn't know, but don't worry."
    );

    // Test 3: Markdown Bold & Asterisks
    assertEqual(
        "Strip markdown bold asterisks",
        normalizeForSpeech("**Breaking News:** The **ISRO** mission launched."),
        "Breaking News: The I.S.R.O. mission launched."
    );

    // Test 4: Latin Abbreviations
    assertEqual(
        "Expand e.g., i.e., and vs.",
        normalizeForSpeech("Tech giants e.g., Google vs. Apple i.e., rivals."),
        "Tech giants for example, Google versus Apple that is, rivals."
    );

    // Test 5: Indian Financial Currencies
    assertEqual(
        "Expand Indian Rupee scales (₹ and Rs.)",
        normalizeForSpeech("The government allocated ₹500 Cr and Rs. 50 Lakh for development."),
        "The government allocated 500 crore rupees and 50 lakh rupees for development."
    );

    // Test 6: Global Currencies
    assertEqual(
        "Expand USD $M and $B",
        normalizeForSpeech("Startup secured $50M in funding with a $1.2B valuation."),
        "Startup secured 50 million dollars in funding with a 1.2 billion dollars valuation."
    );

    // Test 7: AI Acronym
    assertEqual(
        "Punctuates AI to A.I. for clear articulation",
        normalizeForSpeech("The AI revolution is here, says the CEO."),
        "The A.I. revolution is here, says the C.E.O."
    );

    // Test 8: Percentages and 24/7
    assertEqual(
        "Expands percentage and 24/7",
        normalizeForSpeech("Inflation dropped by 4.5% with 24/7 monitoring."),
        "Inflation dropped by 4.5 percent with twenty-four seven monitoring."
    );

    // Test 9: Em-dash pause
    assertEqual(
        "Converts em-dash to comma pause",
        normalizeForSpeech("New policy—effective immediately—was announced."),
        "New policy, effective immediately, was announced."
    );

    // Test 10: URLs and RSS Bylines
    assertEqual(
        "Strips URLs and RSS byline boilerplate",
        normalizeForSpeech("NEW DELHI (PTI) — Visit https://newsflow.app/story for [Read More] updates."),
        "Visit for updates."
    );

    console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
