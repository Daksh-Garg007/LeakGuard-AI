// api/recompute.js — POST /api/recompute
// Lightweight companion to /api/analyze. Called whenever the user flips a
// subscription's "Used / Unused" toggle on the dashboard, so the Leak Score,
// recommendations, and AI note update live — without re-uploading or
// re-parsing the original statement.
//
// Body: { subscriptions: Array, unusedNames: string[] }
//   - subscriptions: the same subscription objects returned by /api/analyze
//     (name, category, icon, firstAmount, latestAmount, monthsSeen, ...)
//   - unusedNames: names the user has toggled to "Unused". Any subscription
//     not in this list but present in usedNames is treated as confirmed-used;
//     anything untouched is left as an unconfirmed heuristic case.

const { withHikeInfo } = require('../services/price');
const { computeLeakScoreDetailed } = require('../services/leakScore');
const { buildRecommendations, generateAiInsight } = require('./recommend');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { subscriptions, unusedNames, usedNames } = req.body || {};
    if (!Array.isArray(subscriptions)) {
      res.status(400).json({ error: 'subscriptions array is required' });
      return;
    }

    const unusedSet = new Set(Array.isArray(unusedNames) ? unusedNames : []);
    const usedSet = new Set(Array.isArray(usedNames) ? usedNames : []);

    const annotated = subscriptions.map((s) => {
      let isUnused;
      if (unusedSet.has(s.name)) isUnused = true;
      else if (usedSet.has(s.name)) isUnused = false;
      return { ...s, isUnused };
    });

    const subsWithHikeInfo = withHikeInfo(annotated);
    const { score: leakScore, breakdown: leakScoreBreakdown } = computeLeakScoreDetailed(subsWithHikeInfo);
    const { recs, totalSavings } = buildRecommendations(annotated);
    const aiInsight = await generateAiInsight(annotated, recs, totalSavings);

    res.status(200).json({
      leakScore,
      leakScoreBreakdown,
      recommendations: recs,
      totalSavings,
      aiInsight,
      subscriptions: subsWithHikeInfo,
    });
  } catch (err) {
    console.error('recompute.js error:', err);
    res.status(500).json({ error: 'Failed to recompute leak score' });
  }
};