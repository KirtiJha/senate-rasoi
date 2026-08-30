import { fetch as streamingFetch } from 'expo/fetch';

import { AIError } from './ai';
import { AgentProposal, AgentReply, AgentStep } from './agent';
import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

/**
 * Saathi, streamed.
 *
 * WHY NOT supabase.functions.invoke
 * It buffers the whole response before returning — the one thing a stream must
 * not do. So this calls the function URL directly and carries the session
 * token itself.
 *
 * WHY expo/fetch
 * React Native's stock fetch cannot read a response body incrementally:
 * `response.body` is not a ReadableStream there, so SSE is dead on arrival.
 * Expo's WinterCG fetch implements it. On web it defers to the platform, which
 * has always supported it.
 *
 * The agent can take several seconds across up to six sequential model calls.
 * Buffered, that is a spinner and a silence that reads as broken; streamed, you
 * watch it look things up and then watch the answer arrive.
 */

export type StreamHandlers = {
  /** A chunk of answer text. Append it. */
  onDelta: (text: string) => void;
  /** A tool finished — "searched \"plumber\" — 3 matches". */
  onStep: (step: AgentStep) => void;
};

const STREAM_TIMEOUT_MS = 90_000;

export async function streamAgent(
  question: string,
  history: { role: 'user' | 'assistant'; text: string }[],
  handlers: StreamHandlers,
): Promise<AgentReply> {
  const q = question.trim();
  if (!q) throw new AIError('Type a question first.');

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new AIError('Sign in to use Saathi.');

  // An abort rather than a hope. Without it a stalled stream leaves the chat
  // stuck on a half-finished sentence with no way back.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), STREAM_TIMEOUT_MS);

  let answer = '';
  const steps: AgentStep[] = [];
  let results: AgentReply['results'] = [];
  let proposal: AgentProposal | undefined;

  try {
    const res = await streamingFetch(`${supabaseUrl}/functions/v1/ai-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ action: 'agent-stream', question: q, history: history.slice(-8) }),
      signal: abort.signal,
    });

    if (!res.ok) {
      // Errors before the stream opens arrive as ordinary JSON.
      let message = 'Saathi is unavailable right now.';
      try {
        const body = await res.json();
        message = (body as { message?: string; error?: string }).message
          ?? (body as { error?: string }).error ?? message;
      } catch { /* keep the default */ }
      throw new AIError(message);
    }
    if (!res.body) throw new AIError('Streaming is not supported on this device.');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line. Anything after the last one
      // is a partial frame and stays in the buffer for the next chunk — the
      // classic way to lose the end of a sentence is to parse it too early.
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const line = frame.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        let evt: Record<string, unknown>;
        try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }

        if (evt.t === 'delta') {
          const v = String(evt.v ?? '');
          answer += v;
          handlers.onDelta(v);
        } else if (evt.t === 'step') {
          const step = { tool: String(evt.tool ?? ''), summary: String(evt.summary ?? '') };
          steps.push(step);
          handlers.onStep(step);
        } else if (evt.t === 'done') {
          results = (evt.results ?? []) as AgentReply['results'];
          proposal = evt.proposal as AgentProposal | undefined;
          if (Array.isArray(evt.steps) && evt.steps.length) {
            steps.splice(0, steps.length, ...(evt.steps as AgentStep[]));
          }
        } else if (evt.t === 'error') {
          throw new AIError(String(evt.message ?? 'Saathi could not finish that.'));
        }
      }
    }
  } catch (e) {
    if (abort.signal.aborted) throw new AIError('Saathi took too long — try again.');
    throw e instanceof AIError ? e : new AIError('Saathi is unavailable right now.');
  } finally {
    clearTimeout(timer);
  }

  return { answer: answer.trim(), results, proposal, steps };
}
