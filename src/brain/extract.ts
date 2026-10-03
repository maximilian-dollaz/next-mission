/**
 * Transcript -> decision, one next action, and the context worth keeping.
 *
 * This is the one step that sends the raw transcript to a third party
 * (Anthropic), and it is the last thing that ever sees it: the transcript is
 * held in memory for this call and destroyed immediately after. That exposure
 * is stated plainly in docs/privacy.md rather than hidden — it is the price of
 * the extraction and it is bounded to a single request with no retention.
 *
 * Schema: docs/research/02-decision-protocol.md §5.
 */

import Anthropic from '@anthropic-ai/sdk';
import { require_, optional } from '../env.js';
import type { Extraction, KeepItem } from './types.js';
import type { RawTurn } from './agentphone.js';

const SYSTEM = `You read one finished decision call and pull out what should survive it.

The call ran a decision protocol: get the fork, install a north star in the
caller's own words, make one move that deletes an option, get a first-person
commitment sentence, offer them an easy way out and see if they take it.

Your job has three parts and a hard rule.

THE HARD RULE — never invent a landing.
If the caller did not commit in their own words, set landed=false, put what is
actually unsettled in open_questions, and make next_action the thing that
resolves it. A fabricated commitment is the worst output you can produce. It is
better to report an unlanded call accurately than a landed one falsely.

1. THE DECISION — verbatim where you can. Their sentence, their verb, their
   object. Not your summary of it. If the strongest thing they said was "I'm
   going to hand back the smallest client this week", that is the decision.

2. THE ONE NEXT ACTION — singular, and it must name a real object, not a
   category. "Text Tyler today asking how they gather client context" passes.
   "Reach out to my buddies" fails. If a second action is genuinely needed, it
   goes in open_questions, not here.

3. WHAT TO KEEP — the context items worth carrying into the next call:
   - theme: a recurring preoccupation
   - person: someone who matters to the decision, and how
   - commitment: something they said they would do
   - constraint: something not negotiable for them
   - prior_decision: a decision they reported already making
   Keep 3-8. Each needs a short source_quote in their own words — that quote is
   the only transcript fragment that survives, so keep it to a clause.
   Do not keep: pleasantries, the agent's own words, anything you inferred
   rather than heard, or anything they would be surprised to find in a file
   about them.

Everything you emit about the caller should be in the caller's framing, not
yours. Quote rather than paraphrase whenever quoting is possible.`;

const TOOL = {
  name: 'record_outcome',
  description: 'Record what survives this call.',
  input_schema: {
    type: 'object' as const,
    properties: {
      decision: { type: 'string', description: "The decision in their own words, verbatim where possible." },
      north_star: { type: ['string', 'null'], description: 'Their <=12-word north star, verbatim. Null if the call never installed one.' },
      next_action: { type: 'string', description: 'The one next action. Must name a real object, not a category.' },
      if_then: { type: ['string', 'null'], description: 'The if-then cue in their words ("after I close the laptop tonight"). Null if absent.' },
      why_this_one: { type: ['string', 'null'], description: 'Why this action and not another, their words.' },
      reasoning: { type: 'string', description: 'How they got there, in their framing. 2-3 sentences.' },
      conviction: { type: 'number', description: '0..1. How firmly they committed. Be honest and be willing to go low.' },
      out_of_scope: { type: 'array', items: { type: 'string' }, description: 'Questions explicitly retired on this call.' },
      open_questions: { type: 'array', items: { type: 'string' }, description: 'Still unsettled.' },
      landed: { type: 'boolean', description: 'Did they actually commit, in their own words? False is a legitimate and common answer.' },
      keep: {
        type: 'array',
        description: '3-8 context items worth carrying forward.',
        items: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['theme', 'person', 'commitment', 'constraint', 'prior_decision'] },
            label: { type: 'string', description: 'Short handle. A name, a theme in 2-4 words.' },
            body: { type: 'string', description: 'One sentence, their framing.' },
            source_quote: { type: ['string', 'null'], description: 'A clause in their own words. The only transcript fragment that survives.' },
            confidence: { type: 'number', description: '0..1' },
          },
          required: ['kind', 'label', 'body', 'source_quote', 'confidence'],
        },
      },
    },
    required: [
      'decision', 'north_star', 'next_action', 'if_then', 'why_this_one',
      'reasoning', 'conviction', 'out_of_scope', 'open_questions', 'landed', 'keep',
    ],
  },
};

function render(turns: RawTurn[]): string {
  return turns.map((t) => `${t.speaker === 'human' ? 'CALLER' : 'AGENT'}: ${t.text}`).join('\n');
}

const clamp01 = (n: unknown): number => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0.5;
  return Math.min(1, Math.max(0, v));
};

/** Read the call. Returns what should outlive it. */
export async function extract(turns: RawTurn[]): Promise<Extraction> {
  if (turns.length === 0) {
    throw new Error('Nothing to extract: the transcript is empty.');
  }

  const client = new Anthropic({ apiKey: require_('Decision extraction', 'ANTHROPIC_API_KEY') });

  const res = await client.messages.create({
    model: optional('ORCHESTRATOR_MODEL', 'claude-opus-5'),
    max_tokens: 4096,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'record_outcome' },
    messages: [{ role: 'user', content: `Here is the call.\n\n${render(turns)}` }],
  });

  const block = res.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') {
    throw new Error('Extraction produced no structured output.');
  }
  const raw = block.input as Record<string, unknown>;

  const keep: KeepItem[] = Array.isArray(raw.keep)
    ? (raw.keep as Record<string, unknown>[]).map((k) => ({
        kind: (k.kind as KeepItem['kind']) ?? 'theme',
        label: String(k.label ?? '').trim(),
        body: String(k.body ?? '').trim(),
        source_quote: typeof k.source_quote === 'string' ? k.source_quote : null,
        confidence: clamp01(k.confidence),
      })).filter((k) => k.label && k.body)
    : [];

  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];

  return {
    decision: String(raw.decision ?? '').trim(),
    north_star: typeof raw.north_star === 'string' && raw.north_star.trim() ? raw.north_star.trim() : null,
    next_action: String(raw.next_action ?? '').trim(),
    if_then: typeof raw.if_then === 'string' && raw.if_then.trim() ? raw.if_then.trim() : null,
    why_this_one: typeof raw.why_this_one === 'string' && raw.why_this_one.trim() ? raw.why_this_one.trim() : null,
    reasoning: String(raw.reasoning ?? '').trim(),
    conviction: clamp01(raw.conviction),
    out_of_scope: strings(raw.out_of_scope),
    open_questions: strings(raw.open_questions),
    keep,
    landed: raw.landed === true,
  };
}
