// api/analyze.js — POST /api/analyze
// Vercel serverless function. Body: { csvText: string }.
// Runs the full pipeline in-memory (no database, nothing persisted) and
// returns everything the dashboard needs in a single response:
//   transactions, subscriptions, priceHikes, leakScore, monthlySpend,
//   recommendations, totalSavings.

const { parseCSV } = require('../services/parser');
const { detectRecurring } = require('../services/recurring');
const { withHikeInfo, detectPriceHikes } = require('../services/price');
const { computeLeakScoreDetailed } = require('../services/leakScore');
const { buildRecommendations, generateAiInsight } = require('./recommend');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { csvText } = req.body || {};
    if (!csvText || typeof csvText !== 'string') {
      res.status(400).json({ error: 'csvText is required' });
      return;
    }

    // 1. Extract transactions
    const transactions = parseCSV(csvText);

    // 2. Detect recurring subscriptions (~30 day interval, 2+ months)
    const rawSubscriptions = detectRecurring(transactions);

    // 3. Check for silent price hikes (>=10%)
    const subscriptions = withHikeInfo(rawSubscriptions);
    const priceHikes = detectPriceHikes(rawSubscriptions);

    // 4. Calculate Leak Score (weighted composite — see services/leakScore.js)
    const { score: leakScore, breakdown: leakScoreBreakdown } = computeLeakScoreDetailed(subscriptions);

    // 5. Generate recommendations
    const { recs, totalSavings } = buildRecommendations(rawSubscriptions);

    // 6. Optional AI enrichment — null if GEMINI_API_KEY isn't set
    const aiInsight = await generateAiInsight(rawSubscriptions, recs, totalSavings);

    const monthlySpend = subscriptions.reduce((sum, s) => sum + s.latestAmount, 0);

    res.status(200).json({
      transactions,
      subscriptions,
      priceHikes,
      leakScore,
      leakScoreBreakdown,
      monthlySpend,
      recommendations: recs,
      totalSavings,
      aiInsight,
    });
  } catch (err) {
    console.error('analyze.js error:', err);
    res.status(500).json({ error: 'Failed to analyze statement' });
  }
};