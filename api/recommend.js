// api/recommend.js — POST /api/recommend
// Turns a list of subscriptions into actionable recommendations (downgrade,
// cancel, keep) plus a total projected yearly savings figure. Rule-based by
// default; swap the marked section for a Gemini 2.5 Flash call to generate
// richer, per-user reasoning without changing the response shape.

const { withHikeInfo } = require('../services/price');
const { callGemini } = require('../services/gemini');

function buildRecommendations(subscriptions) {
  const subs = withHikeInfo(subscriptions);
  const recs = [];
  let totalSavings = 0;
  const handledForUsage = new Set();

  // User-confirmed usage signal (from the "Confirm Usage" toggle on the
  // dashboard). This is the strongest signal we have — it comes straight
  // from the person, not a heuristic — so it takes priority over any
  // guesswork below.
  subs.forEach((s) => {
    if (s.isUnused === true) {
      const save = Math.round(s.latestAmount * 12);
      recs.push({
        type: 'warn',
        icon: '✂',
        title: `Cancel ${s.name}`,
        detail: `You confirmed you haven't used this in the last 30 days. Canceling saves ₹${save}/yr with zero impact on your routine.`,
        save,
      });
      totalSavings += save;
      handledForUsage.add(s.name);
    } else if (s.isUnused === false) {
      // Explicitly confirmed as actively used — never flag it as a low-usage leak.
      handledForUsage.add(s.name);
    }
  });

  subs.forEach((s) => {
    if (s.isHike) {
      const yearlyDelta = Math.round(s.latestAmount * 12 - s.firstAmount * 12);
      const save = yearlyDelta > 0 ? yearlyDelta : Math.round(s.latestAmount * 12 * 0.35);
      recs.push({
        type: 'warn',
        icon: '↓',
        title: `Downgrade or renegotiate ${s.name}`,
        detail: `₹${s.firstAmount} → ₹${s.latestAmount} (+${Math.round(s.hikePct)}%). A lower tier could recover this.`,
        save,
      });
      totalSavings += save;
    }
  });

  // Low-usage heuristic fallback: Audible has no strong "active use" signal
  // in a bank statement alone, so — until the user confirms usage one way or
  // the other via the toggle — it's a common silent leak worth flagging.
  const audible = subs.find((s) => s.name === 'Audible');
  if (audible && !handledForUsage.has('Audible')) {
    const save = Math.round(audible.latestAmount * 12);
    recs.push({
      type: 'warn',
      icon: '✂',
      title: 'Cancel Audible',
      detail: 'No strong usage signal in the statement — a common low-utilization leak. Confirm above if you actually use it.',
      save,
    });
    totalSavings += save;
  }

  const prime = subs.find((s) => s.name === 'Amazon Prime');
  if (prime && !handledForUsage.has('Amazon Prime')) {
    recs.push({
      type: 'keep',
      icon: '✓',
      title: 'Keep Amazon Prime',
      detail: 'Frequent activity alongside it suggests active, regular use.',
      save: 0,
    });
  }

  if (recs.length === 0) {
    recs.push({
      type: 'keep',
      icon: '✓',
      title: 'No major leaks found',
      detail: 'Your subscriptions look stable and reasonably priced.',
      save: 0,
    });
  }

  return { recs, totalSavings };
}

// Optional: asks Gemini for a short, plain-English summary on top of the
// rule-based recs. Returns null (and the app just uses the rules alone) if
// GEMINI_API_KEY isn't set or the call fails — this is enrichment, not a
// dependency.
async function generateAiInsight(subscriptions, recs, totalSavings) {
  const subsSummary = subscriptions
    .map((s) => `${s.name} (${s.category}): ₹${s.firstAmount} -> ₹${s.latestAmount}${s.isUnused === true ? ' [user confirmed: UNUSED]' : ''}`)
    .join('; ');

  const unusedNames = subscriptions.filter((s) => s.isUnused === true).map((s) => s.name);
  const unusedNote = unusedNames.length
    ? ` The user has explicitly confirmed they no longer use: ${unusedNames.join(', ')}. Prioritize mentioning these by name as the clearest, zero-risk savings.`
    : '';

  const prompt = `You are a concise personal-finance assistant. A user's bank statement shows these recurring subscriptions: ${subsSummary}. ` +
    `Detected potential yearly savings: ₹${totalSavings}.${unusedNote} ` +
    `In 2-3 short sentences, give the user a friendly, specific takeaway about their subscription spending. No markdown, no headers.`;

  return callGemini(prompt);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { subscriptions } = req.body || {};
    if (!Array.isArray(subscriptions)) {
      res.status(400).json({ error: 'subscriptions array is required' });
      return;
    }

    const result = buildRecommendations(subscriptions);
    const aiInsight = await generateAiInsight(subscriptions, result.recs, result.totalSavings);
    res.status(200).json({ ...result, aiInsight });
  } catch (err) {
    console.error('recommend.js error:', err);
    res.status(500).json({ error: 'Failed to build recommendations' });
  }
};

// Exported so api/analyze.js can reuse the same logic in one round trip.
module.exports.buildRecommendations = buildRecommendations;
module.exports.generateAiInsight = generateAiInsight;