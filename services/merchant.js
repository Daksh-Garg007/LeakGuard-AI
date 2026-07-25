// services/merchant.js
// Normalizes messy bank-statement description strings (e.g. "NETFLIX.COM",
// "NETFLIX INDIA") into a single clean merchant entity. In production this
// mapping is meant to be backed by Gemini 2.5 Flash reasoning over unseen
// merchant strings — the rule list below is the deterministic fallback/demo
// layer so the app works fully offline too.

const merchantRules = [
  { match: /netflix/i, name: 'Netflix', category: 'Streaming', icon: 'N' },
  { match: /spotify/i, name: 'Spotify', category: 'Streaming', icon: 'S' },
  { match: /amazon prime/i, name: 'Amazon Prime', category: 'Streaming', icon: 'P' },
  { match: /google one/i, name: 'Google One', category: 'Cloud Storage', icon: 'G' },
  { match: /audible/i, name: 'Audible', category: 'Streaming', icon: 'A' },
  { match: /swiggy/i, name: 'Swiggy', category: 'Food Delivery', icon: 'Sw' },
  { match: /bigbasket/i, name: 'BigBasket', category: 'Groceries', icon: 'B' },
];

/**
 * @param {string} raw - raw transaction description from the statement
 * @returns {{name: string, category: string, icon: string}}
 */
function normalizeMerchant(raw) {
  for (const rule of merchantRules) {
    if (rule.match.test(raw)) {
      return { name: rule.name, category: rule.category, icon: rule.icon };
    }
  }
  return { name: raw.trim().replace(/\s+/g, ' '), category: 'Other', icon: '•' };
}

module.exports = { normalizeMerchant, merchantRules };
