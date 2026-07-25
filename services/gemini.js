// services/gemini.js
// Thin wrapper around the Gemini API. Reads the key from the environment —
// never hardcode it in source. If no key is set, callers should skip AI
// enrichment and fall back to the rule-based recommendations, which work
// fine on their own.

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * @param {string} prompt
 * @returns {Promise<string|null>} the model's text response, or null if no
 *   key is configured or the call fails (caller should fall back gracefully)
 */
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      console.error('Gemini API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' ? text.trim() : null;
  } catch (err) {
    console.error('Gemini call failed:', err);
    return null;
  }
}

module.exports = { callGemini };
