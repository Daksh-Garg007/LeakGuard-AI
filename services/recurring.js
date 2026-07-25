// services/recurring.js
// Detects recurring subscriptions from a transaction list: groups by
// normalized merchant, keeps only merchants seen in 2+ distinct months
// (the recurring signal), and predicts the next renewal date from the
// average interval between charges (~30 days).

const { normalizeMerchant } = require('./merchant');

function groupByMerchant(transactions) {
  const groups = {};
  transactions.forEach((tx) => {
    const info = normalizeMerchant(tx.description);
    const key = info.name;
    if (!groups[key]) groups[key] = { info, txs: [] };
    groups[key].txs.push(tx);
  });
  return groups;
}

function averageIntervalDays(sortedTxs) {
  if (sortedTxs.length < 2) return 30;
  let total = 0;
  let count = 0;
  for (let i = 1; i < sortedTxs.length; i++) {
    const diff = (new Date(sortedTxs[i].date) - new Date(sortedTxs[i - 1].date)) / 86400000;
    if (diff > 0) {
      total += diff;
      count += 1;
    }
  }
  return count > 0 ? total / count : 30;
}

/**
 * @param {Array<{date:string, description:string, amount:number}>} transactions
 * @returns {Array} subscriptions with firstAmount/latestAmount/history/nextRenewal
 */
function detectRecurring(transactions) {
  const groups = groupByMerchant(transactions);
  const subscriptions = [];

  Object.values(groups).forEach((g) => {
    const months = new Set(g.txs.map((t) => t.date.slice(0, 7)));
    if (months.size < 2) return; // must recur across at least 2 distinct months

    const sorted = [...g.txs].sort((a, b) => a.date.localeCompare(b.date));
    const firstAmount = sorted[0].amount;
    const latestAmount = sorted[sorted.length - 1].amount;
    const intervalDays = averageIntervalDays(sorted);
    const lastDate = new Date(sorted[sorted.length - 1].date);
    const nextRenewal = new Date(lastDate.getTime() + intervalDays * 86400000);

    subscriptions.push({
      name: g.info.name,
      category: g.info.category,
      icon: g.info.icon,
      firstAmount,
      latestAmount,
      monthsSeen: months.size,
      history: sorted,
      nextRenewal: nextRenewal.toISOString(),
    });
  });

  return subscriptions;
}

module.exports = { detectRecurring, groupByMerchant };
