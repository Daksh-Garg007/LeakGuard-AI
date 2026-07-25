// services/price.js
// Flags "silent price hikes" on recurring subscriptions — a jump of 10%+
// between the first and most recent charge for the same merchant.

const HIKE_THRESHOLD_PCT = 10;

/**
 * Adds hikePct / isHike to each subscription without mutating the input.
 * @param {Array} subscriptions - output of services/recurring.js detectRecurring
 */
function withHikeInfo(subscriptions) {
  return subscriptions.map((s) => {
    const hikePct = s.firstAmount > 0 ? ((s.latestAmount - s.firstAmount) / s.firstAmount) * 100 : 0;
    return { ...s, hikePct, isHike: hikePct >= HIKE_THRESHOLD_PCT };
  });
}

function detectPriceHikes(subscriptions) {
  return withHikeInfo(subscriptions).filter((s) => s.isHike);
}

module.exports = { withHikeInfo, detectPriceHikes, HIKE_THRESHOLD_PCT };
