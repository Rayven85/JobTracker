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

// GROQ_BASE_URL is only set by the E2E suite, which points it at a local stub
// (e2e/mock-groq.mjs) so browser tests run hermetically — no real LLM calls.
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  ...(process.env.GROQ_BASE_URL ? { baseURL: process.env.GROQ_BASE_URL } : {}),
});
const MODEL = 'llama-3.3-70b-versatile';

// Free-tier limit is 12000 tokens/minute, counting input + reserved max_tokens. Two guards:
// 1) callers pass a max_tokens budget sized to the call (small enough that input + budget fits);
// 2) createWithRetry rides out transient 429s (bursts of calls in one minute) with backoff,
//    honouring the server's retry-after, and converts a genuine exhaustion into a clear error.
interface CompletionBody {
  model: string;
  messages: { role: 'user'; content: string }[];
  temperature: number;
  max_tokens: number;
  response_format?: { type: 'json_object' };
}

async function createWithRetry(body: CompletionBody): Promise<Groq.Chat.ChatCompletion> {
  const MAX_ATTEMPTS = 4;
  for (let attempt = 1; ; attempt++) {
    try {
      return await groq.chat.completions.create(body);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 429 && attempt < MAX_ATTEMPTS) {
        const header = (err as { headers?: Record<string, string> }).headers?.['retry-after'];
        const retryAfter = Number(header);
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 30000)
          : Math.min(3000 * 2 ** (attempt - 1), 20000);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
      if (status === 429 || status === 413) {
        throw new AppError(
          503,
          'AI_RATE_LIMITED',
          'The AI service hit its rate limit (free tier). Please wait a minute and try again.'
        );
      }
      // 401 = bad/expired GROQ_API_KEY (server misconfig, not a user auth problem). Return 500
      // with a clear message rather than leaking Groq's raw JSON or tripping the client's 401 → re-login flow.
      if (status === 401) {
        throw new AppError(
          500,
          'AI_AUTH_ERROR',
          'The AI API key is invalid or expired. Check GROQ_API_KEY on the server and restart it.'
        );
      }
      throw err;
    }
  }
}

export async function generateJSON<T>(prompt: string, maxTokens = 4000): Promise<T> {
  const response = await createWithRetry({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: maxTokens,
  });
  const text = response.choices[0]?.message?.content ?? '';
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AppError(500, 'AI_PARSE_ERROR', 'AI response could not be parsed');
  }
}

export async function generateText(prompt: string, maxTokens = 1500): Promise<string> {
  const response = await createWithRetry({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: maxTokens,
  });
  return response.choices[0]?.message?.content ?? '';
}
