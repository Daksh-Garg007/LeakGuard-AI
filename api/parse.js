// api/parse.js — POST /api/parse
// Thin wrapper around services/parser.js, exposed as its own endpoint so the
// frontend (or a future integration) can validate/preview parsed rows
// without running the full analysis pipeline.

const { parseCSV } = require('../services/parser');

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

    const transactions = parseCSV(csvText);
    res.status(200).json({ transactions, count: transactions.length });
  } catch (err) {
    console.error('parse.js error:', err);
    res.status(500).json({ error: 'Failed to parse statement' });
  }
};
