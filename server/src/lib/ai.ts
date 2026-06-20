// ── AI Provider: Groq ─────────────────────────────────────────────────────────
// To swap providers, rewrite ONLY this file.
// Contract: export generateJSON<T> and generateText — ai.service.ts uses only these two.
//
// Switching to Anthropic Claude:
//   import Anthropic from '@anthropic-ai/sdk';
//   const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
//   generateJSON: call client.messages.create() with JSON-instructing system prompt, parse response
//   generateText: same but without JSON instruction

import Groq from 'groq-sdk';
import { AppError } from './AppError';

if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is required');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'llama-3.3-70b-versatile';

export async function generateJSON<T>(prompt: string): Promise<T> {
  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });
  const text = response.choices[0]?.message?.content ?? '';
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AppError(500, 'AI_PARSE_ERROR', 'AI response could not be parsed');
  }
}

export async function generateText(prompt: string): Promise<string> {
  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });
  return response.choices[0]?.message?.content ?? '';
}
