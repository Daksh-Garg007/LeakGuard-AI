// services/leakScore.js
//
// LEAK SCORE — a 0-100 "financial health" score built the way a real fintech
// risk score is built: several independently-normalized sub-scores (each
// 0-100), combined with fixed weights — not a flat point-per-signal tally.
//
// The old version added a fixed number of points per hike / per streaming
// sub / per subscription. That meant a ₹50/mo subscription counted exactly
// as much as a ₹2,000/mo one, and the score could keep climbing forever as
// more subscriptions were added, with no sense of *how much money* was
// actually at risk. This version is spend-aware: it looks at what share of
// the person's actual monthly subscription spend is leaking, not just how
// many line items look suspicious.
//
// Sub-scores (each 0-100):
//   1. Waste Ratio       (35%) — % of monthly sub spend that's confirmed-
//                                 unused or is the "extra" from a price hike
//   2. Hike Severity      (30%) — how aggressive the detected hikes are,
//                                 nudged by how much of the portfolio they touch
//   3. Usage Confidence   (25%) — user-confirmed-unused spend, weighted by
//                                 its share of the total budget (this is the
//                                 highest-certainty signal, since it comes
//                                 directly from the person, not a guess)
//   4. Portfolio Volume   (10%) — baseline complexity: more subscriptions
//                                 means more surface area for leaks to hide,
//                                 scaled logarithmically so the 8th
//                                 subscription doesn't move the needle like
//                                 the 2nd one did

const WEIGHTS = {
  wasteRatio: 0.35,
  hikeSeverity: 0.30,
  usageConfidence: 0.25,
  volume: 0.10,
};

function clamp(n, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function totalMonthlySpend(subs) {
  return subs.reduce((sum, s) => sum + (s.latestAmount || 0), 0);
}

// 1. Waste Ratio — share of monthly spend that is either confirmed-unused
//    outright, or is the extra amount now being paid because of a hike.
function wasteRatioScore(subs, total) {
  if (total <= 0) return 0;
  const wasted = subs.reduce((sum, s) => {
    if (s.isUnused === true) return sum + s.latestAmount;
    if (s.isHike) return sum + Math.max(s.latestAmount - s.firstAmount, 0);
    return sum;
  }, 0);
  // Scaled by 1.4x so a portfolio where ~70% of spend is waste already reads
  // as critical (100), rather than needing every rupee to be wasted.
  return clamp((wasted / total) * 100 * 1.4);
}

// 2. Hike Severity — average size of detected hikes, amplified slightly
//    when hikes affect a larger share of the subscriptions on file.
function hikeSeverityScore(subs) {
  const hikes = subs.filter((s) => s.isHike);
  if (hikes.length === 0) return 0;
  const avgHikePct = hikes.reduce((sum, s) => sum + s.hikePct, 0) / hikes.length;
  const coverage = hikes.length / subs.length;
  const base = clamp(avgHikePct * 1.8); // ~55% average hike already maxes this sub-score
  return clamp(base * (0.65 + 0.35 * coverage));
}

// 3. Usage Confidence — spend tied to subscriptions the person themselves
//    confirmed they don't use, via the dashboard's Confirm Usage toggle.
//    Floors at 55 the moment anything is confirmed unused (even one small
//    subscription is a real, certain leak worth surfacing loudly), then
//    scales up with how much of the total budget it represents.
function usageConfidenceScore(subs, total) {
  if (total <= 0) return 0;
  const confirmedUnusedSpend = subs
    .filter((s) => s.isUnused === true)
    .reduce((sum, s) => sum + s.latestAmount, 0);
  if (confirmedUnusedSpend <= 0) return 0;
  const shareOfBudget = confirmedUnusedSpend / total;
  return clamp(55 + shareOfBudget * 90);
}

// 4. Portfolio Volume — logarithmic baseline so subscription count alone
//    can't run the score up indefinitely.
function volumeScore(subs) {
  if (subs.length === 0) return 0;
  return clamp(Math.log2(subs.length + 1) * 28);
}

/**
 * @param {Array} subscriptions - subscriptions annotated with isHike/hikePct
 *   (services/price.js) and, optionally, isUnused (true/false/undefined)
 *   from the dashboard's Confirm Usage toggle.
 * @returns {{score:number, breakdown:{wasteRatio:number, hikeSeverity:number, usageConfidence:number, volume:number}}}
 */
function computeLeakScoreDetailed(subscriptions) {
  const total = totalMonthlySpend(subscriptions);

  const breakdown = {
    wasteRatio: Math.round(wasteRatioScore(subscriptions, total)),
    hikeSeverity: Math.round(hikeSeverityScore(subscriptions)),
    usageConfidence: Math.round(usageConfidenceScore(subscriptions, total)),
    volume: Math.round(volumeScore(subscriptions)),
  };

  const weighted =
    breakdown.wasteRatio * WEIGHTS.wasteRatio +
    breakdown.hikeSeverity * WEIGHTS.hikeSeverity +
    breakdown.usageConfidence * WEIGHTS.usageConfidence +
    breakdown.volume * WEIGHTS.volume;

  return { score: clamp(Math.round(weighted)), breakdown };
}

// Back-compat: most call sites just want the number.
function computeLeakScore(subscriptions) {
  return computeLeakScoreDetailed(subscriptions).score;
}

module.exports = { computeLeakScore, computeLeakScoreDetailed, WEIGHTS };