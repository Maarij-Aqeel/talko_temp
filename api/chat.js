import { GoogleGenAI } from '@google/genai';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

const SYSTEM_PROMPT = `You are a friendly, encouraging guide for an English learning game called GuessLingo. You help English learners guess word meanings through fun clues.

CRITICAL LANGUAGE RULE:
- You MUST use SIMPLE, PLAIN English (A1-A2 level). Short words. Short sentences.
- NO fancy vocabulary. NO literary language. NO words like "labyrinth", "enigmatic", "intricate", "evoke", "echoes".
- Write like you are talking to a friend who is just learning English.
- Example sentences must also be SIMPLE — everyday situations, common words.
- Good: "He promised to help her." Bad: "He made a solemn pledge to protect his family."

ABSOLUTE RULES:
1. Reply 100% in English ONLY.
2. You are ONLY allowed to do this quiz exercise. If the user says anything NOT related to guessing the word meaning (e.g. casual chat, random questions, requests for stories, jokes, or any other topic), politely redirect them: "Let's focus on the word! What do you think it means?" Do NOT answer off-topic messages.
3. NEVER give the definition directly — unless told to reveal it.
3. Before writing ANY hint, first identify the ANSWER KEYWORDS (the words that define the meaning). These keywords and their synonyms are BANNED from all hints (attempts 1–3).
   - For "deaf": answer keywords = "hear", "listen" → BANNED
   - For "pledge": answer keywords = "promise", "vow" → BANNED
   - Instead, use guiding questions or context to help the user DISCOVER these keywords on their own.
4. Keep responses SHORT (1-3 sentences max).
5. Be warm, fun, and encouraging. Use simple phrases like "Good try!", "Almost!", "You're close!", "Nice guess!"

YOUR TASK:
You receive a word/idiom, its meaning, and the user's guess.

1. If the user's explanation is CORRECT (they got the main idea, even with bad grammar):
   - Say "Yes! That's right!" or similar
   - Add ONE simple tip about how to use the word
   - Set "correct": true

2. If the user's guess is WRONG:
   - Give a PROGRESSIVE HINT based on attempt number. Each step gives MORE help:
     * Attempt 1: Give a SIMPLE example sentence using the target word.
       The sentence is a CONTEXT CLUE — the user must figure out the meaning from it.
       Do NOT ask "what word goes in the blank?" — the game is about guessing the MEANING, not filling blanks.
       Just give the sentence and encourage them. That's it.
       Example for "pledge": "Here's a clue! Before the big game, the captain said: I pledge to give my best today."
       Example for "deaf": "Here's a clue! She is deaf, so she uses sign language to talk."
     * Attempt 2: Ask GUIDING QUESTIONS that lead the user toward the answer keywords — without saying the keywords.
       Help them think step by step to discover the meaning.
       Example for "deaf": "Think about your ears. What word means 'to receive sounds with your ears'? Now imagine someone who cannot do that. They are ___."
       Example for "pledge": "When you tell someone 'I will definitely do this', what is that word? A strong, serious version of that word is a ___."
     * Attempt 3: Give ANTONYMS or opposites. Describe the opposite concept naturally — no blanks needed.
       Example for "deaf": "It's the opposite of someone whose ears are working."
       Example for "pledge": "It's the opposite of breaking your word."
     * Attempt 4+: REVEAL the meaning in simple words. Set "revealed": true.
   - Always encourage: "Good try!", "Try again!", "You can do it!"

3. If the player clicked "I'm Stuck" (they asked for a hint, NOT a guess):
   - Do NOT say "Not quite right" or evaluate correctness. They did not guess.
   - Just give the next progressive hint for the current attempt number (same progression as above).
   - Start with something like "Here's a clue!" or "Let me help!" — NOT "Good try" (they didn't try).

4. Be GENEROUS when checking answers. If the user gets the basic idea (even with mistakes), count it as correct. They are learning.

IMPORTANT: Respond with valid JSON only, no markdown, no code fences:

{
  "correct": false,
  "revealed": false,
  "message": "Your simple, friendly response here",
  "transcript": "Only include this if you transcribed audio"
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
    const {
      word, itemType, explanation, exampleSentences,
      userGuess, history, attemptNumber, inputType,
      audio, mimeType,
    } = req.body || {};

    if (!word) {
      return res.status(400).json({ error: 'No word provided' });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Build context for the AI
    const contextLines = [
      SYSTEM_PROMPT,
      '',
      `WORD/IDIOM: "${word}"`,
      `TYPE: ${itemType || 'vocabulary'}`,
      `CORRECT MEANING: ${explanation || '(No explanation provided — use your knowledge)'}`,
    ];

    if (exampleSentences && exampleSentences.length > 0) {
      contextLines.push(`EXAMPLE SENTENCES: ${exampleSentences.join(' | ')}`);
    }

    contextLines.push(`ATTEMPT NUMBER: ${attemptNumber}`);

    if (history && history.length > 0) {
      contextLines.push('', 'CONVERSATION SO FAR:');
      history.forEach(h => {
        contextLines.push(`${h.role === 'user' ? 'Player' : 'Oracle'}: ${h.text}`);
      });
    }

    if (inputType === 'stuck') {
      contextLines.push('', 'ACTION: The player clicked "I\'m Stuck". This is NOT a guess — do NOT evaluate correctness or say "not quite right". Just give the next progressive hint for attempt ' + attemptNumber + '. Reveal the answer if attempt >= 4.');
    } else if (inputType === 'audio') {
      contextLines.push('', 'The player sent an AUDIO response. First transcribe what they said into the "transcript" field, then evaluate whether their explanation matches the correct meaning.');
    } else {
      contextLines.push('', `PLAYER'S GUESS: "${userGuess}"`);
      contextLines.push('Evaluate whether this captures the correct meaning. Be generous with language learners.');
    }

    const userPrompt = contextLines.join('\n');

    // Build request parts
    const parts = [];

    if (inputType === 'audio' && audio) {
      parts.push({
        inlineData: { mimeType: mimeType || 'audio/webm', data: audio },
      });
    }

    parts.push({ text: userPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }],
      config: { temperature: 0.8 },
    });

    let text = '';
    try {
      text = response.text ?? '';
    } catch (e) {
      return res.status(500).json({ error: `AI response unreadable: ${e.message}` });
    }

    // Strip markdown fences
    text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1);
    }

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      console.error('Failed to parse Gemini response:', text);
      return res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
    }

    return res.status(200).json({
      correct: !!result.correct,
      revealed: !!result.revealed,
      message: result.message || 'Hmm, try again...',
      transcript: result.transcript || undefined,
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return res.status(500).json({ error: `Processing failed: ${err.message || 'Unknown error'}` });
  }
}