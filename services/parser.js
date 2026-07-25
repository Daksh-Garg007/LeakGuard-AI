// services/parser.js
// Parses a raw CSV (or pasted CSV-shaped text) bank statement into a flat
// list of { date, description, amount } transactions. Expects a header row
// followed by Date,Description,Amount columns. This is the "Round 1" ingest
// path — PDF statement parsing is planned for Round 2.

function parseCSV(text) {
  if (!text || typeof text !== 'string') return [];

  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const rows = lines.slice(1); // skip header row

  return rows
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const parts = line.split(',');
      const date = parts[0].trim();
      const amount = parseFloat(parts[parts.length - 1].trim());
      const description = parts.slice(1, parts.length - 1).join(',').trim();
      return { date, description, amount };
    })
    .filter((tx) => tx.date && tx.description && !Number.isNaN(tx.amount));
}

module.exports = { parseCSV };
