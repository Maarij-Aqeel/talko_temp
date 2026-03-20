import { GoogleGenAI } from '@google/genai';

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
};

const REPORT_PROMPT = `You are a warm, encouraging English tutor reviewing a student's GuessLingo game session.

You will receive:
- The words/idioms they played
- Whether they got each one right, needed hints, or had it revealed
- Their ACTUAL guesses/responses (what they typed or said)

Your job: Analyze their actual English responses and provide feedback following the "2+1" pattern:

1. 2x Simple Fixes: Find grammar mistakes, wrong word usage, awkward phrasing, or sentence structure issues from what they ACTUALLY wrote. Fix them with a short encouraging explanation.
   - You MUST include the "original" field with EXACTLY what the student wrote (their actual words).
   - The "fix" field shows the corrected version of what they wrote.
   - If the student made no clear mistakes, pick two phrases they used and show slightly better ways to say them.

2. 1x Vocabulary Upgrade: Find a basic or simple phrase the student used and upgrade it to a more natural, native-sounding expression (B2/C1 level). Show them a common phrasal verb, idiom, or natural expression that native speakers actually use.
   - You MUST include the "original" field with EXACTLY what the student wrote.
   - The "fix" field shows the more natural version.

IMPORTANT RULES:
- Keep ALL feedback in SIMPLE English (A2-B1 level explanations). The student is a learner.
- Use "we" voice (e.g., "We usually say..." "We can say it like this...")
- Be warm, brief, and genuine. Every attempt deserves recognition.
- Each fix/upgrade should be 1-2 sentences max for the note.

Respond with valid JSON only, no markdown, no code fences:
{
  "fixes": [
    {
      "title": "Short title for the fix",
      "original": "What the student actually wrote",
      "fix": "The corrected version",
      "note": "One short, encouraging sentence explaining the change"
    },
    {
      "title": "Short title for the fix",
      "original": "What the student actually wrote",
      "fix": "The corrected version",
      "note": "One short, encouraging sentence explaining the change"
    }
  ],
  "upgrade": {
    "title": "Short title for the native upgrade",
    "original": "The basic phrase the student used",
    "fix": "The natural/commonly used version",
    "note": "Explain the natural phrase and why it sounds more native"
  }
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfiguration: missing API key' });
  }

  try {
    const { results } = req.body || {};

    if (!results || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: 'No results provided' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const summary = results.map(r => {
      const inputs = r.userInputs && r.userInputs.length > 0
        ? `\n  Student wrote: ${r.userInputs.map(u => `"${u}"`).join(', ')}`
        : '';
      const status = r.result === 'first_try' ? 'Knew it on first try!'
        : r.result === 'with_hints' ? `Got it after ${r.attempts} attempts`
        : r.result === 'skipped' ? 'Skipped'
        : `Revealed after ${r.attempts} attempts`;
      return `- "${r.word}" (${r.type}): ${status}${inputs}`;
    }).join('\n');

    const userPrompt = `${REPORT_PROMPT}\n\nSESSION RESULTS:\n${summary}\n\nAnalyze the student's actual written responses above. Find grammar/vocabulary issues and provide your 2+1 feedback.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: { temperature: 0.7 },
    });

    let text = '';
    try {
      text = response.text ?? '';
    } catch (e) {
      console.error('AI response unreadable:', e.message);
      return res.status(500).json({ error: 'AI response was empty or blocked. Please try again.' });
    }
    text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1);
    }

    const result = JSON.parse(text);

    // Validate structure
    if (!result.fixes || !result.upgrade) {
      console.error('Incomplete report response:', result);
      return res.status(500).json({ error: 'Incomplete AI response. Please try again.' });
    }

    return res.status(200).json({
      fixes: result.fixes.slice(0, 2), // enforce max 2 fixes
      upgrade: result.upgrade,
    });
  } catch (err) {
    console.error('Report API error:', err);
    return res.status(500).json({ error: `Report generation failed: ${err.message || 'Unknown error'}` });
  }
}