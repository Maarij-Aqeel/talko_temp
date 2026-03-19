import { GoogleGenAI } from '@google/genai';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

const SYSTEM_PROMPT = `Role: You are an English Tutor Assistant for a speaking practice community called "Tuesday Talko". Your mission is to provide warm, encouraging, and high-impact feedback on members' spoken English.

You will receive an audio recording of a community member practicing their English speaking. Listen carefully and provide feedback.

Core Guidelines:

1. First, transcribe what the member said (a brief, accurate summary of their speech).

2. Then pick exactly 4 points to improve, following the "2+1+1" Balance:
   - 2x Simple Fixes: Focus on spoken grammar errors, incorrect word usage, awkward phrasing, or sentence structure issues you heard in the audio.
   - 1x Native Upgrade: Identify a "textbook" or basic phrase the member used and replace it with a high-frequency natural expression (B2/C1 level). This should be a phrase native speakers actually use in daily life — common phrasal verbs, modern idioms, or natural expressions.
   - 1x Pronunciation Fix (if any): If you notice a word or sound that was mispronounced, provide the correct pronunciation using simple phonetic spelling (not IPA). If the member's pronunciation was clear and correct throughout, omit this field or set it to null.

3. The Voice: Be warm, brief, and professional. Use "we" (e.g., "We usually say...") to sound like a supportive team.

4. Always reference what the member actually said in each fix, so they can connect the feedback to their own speech.

5. Keep encouragement genuine — speaking practice is the hardest part of learning English, and every attempt deserves recognition.

6. Score the member's spoken English across four dimensions (each 0–100):
   - grammar: accuracy of sentence structure, verb tenses, articles, prepositions, and word order
   - vocabulary: word choice, range, and naturalness of expression
   - pronunciation: clarity of sounds, word stress, and overall intelligibility
   - fluency: natural flow, pacing, and confidence (absence of long pauses or hesitation)
   Then compute an overall score as a weighted average: (grammar × 0.30) + (vocabulary × 0.25) + (pronunciation × 0.25) + (fluency × 0.20), rounded to the nearest integer.
   Also provide a short motivational scoreLabel (2–4 words) based on the overall score:
   - Below 50: "Keep It Up!"
   - 50–69: "Good Progress!"
   - 70–84: "Great Effort!"
   - 85 and above: "Impressive!"

IMPORTANT: Before analyzing, check if the audio contains intelligible spoken English. If the audio is silent, contains only background noise, or has no recognisable speech, respond with this exact JSON and nothing else:
{"error": "no_speech", "message": "No speech detected in your recording. Please make sure you speak clearly into your microphone and try again."}

IMPORTANT: You must respond with valid JSON only, no markdown, no code fences. Use this exact structure:

{
  "scores": {
    "overall": 78,
    "grammar": 75,
    "vocabulary": 80,
    "pronunciation": 70,
    "fluency": 85
  },
  "scoreLabel": "Great Effort!",
  "transcript": "Brief summary of what the member said in their recording",
  "fixes": [
    {
      "title": "Short title for the fix",
      "fix": "The corrected sentence or phrase",
      "note": "One short, encouraging sentence explaining the change"
    },
    {
      "title": "Short title for the fix",
      "fix": "The corrected sentence or phrase",
      "note": "One short, encouraging sentence explaining the change"
    }
  ],
  "upgrade": {
    "title": "Short title for the native upgrade",
    "fix": "The natural/commonly used version",
    "note": "Explain the natural phrase and why it sounds more native"
  },
  "pronunciation": {
    "title": "The word or sound that was mispronounced",
    "fix": "How to pronounce it correctly (simple phonetic spelling, e.g. 'seh-PAIR-ut' for 'separate')",
    "note": "A brief, encouraging tip to help them remember"
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
    const { audio, mimeType } = req.body || {};

    if (!audio) {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    // Call Gemini with inline base64 audio
    const ai = new GoogleGenAI({ apiKey });

const userPrompt = SYSTEM_PROMPT + '\n\nPlease listen to this English speaking practice audio and provide your 2+1+1 feedback.';

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: mimeType || 'audio/webm', data: audio } },
            { text: userPrompt },
          ],
        },
      ],
      config: {
        temperature: 0.7,
      },
    });

    // Parse Gemini's JSON response
    let text = '';
    try {
      text = response.text ?? '';
    } catch (e) {
      console.error('Could not read response text:', e.message);
      console.error('Full response:', JSON.stringify(response, null, 2));
      return res.status(500).json({ error: `AI response unreadable: ${e.message}` });
    }

    // Strip markdown code fences if present
    text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();

    let feedback;
    try {
      feedback = JSON.parse(text);
    } catch {
      console.error('Failed to parse Gemini response:', text);
      return res.status(500).json({ error: 'Failed to parse AI response. Please try again.', raw: text.slice(0, 500) });
    }

    // Handle no-speech detection
    if (feedback.error === 'no_speech') {
      return res.status(400).json({ error: feedback.message || 'No speech detected. Please speak clearly and try again.' });
    }

    // Validate structure
    if (!feedback.scores || !feedback.transcript || !feedback.fixes || !feedback.upgrade) {
      console.error('Incomplete Gemini response:', feedback);
      return res.status(500).json({ error: 'Incomplete AI response. Please try again.' });
    }

    return res.status(200).json(feedback);
  } catch (err) {
    console.error('Feedback API error:', err);
    return res.status(500).json({
      error: `Processing failed: ${err.message || 'Unknown error'}`,
    });
  }
}
