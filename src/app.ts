/**
 * The HTTP surface. Hono, so the same app runs under `tsx src/server.ts`
 * locally and as a Vercel function from `api/index.ts`.
 *
 * Routes split three ways:
 *   /health, /config        — always work, even with an empty .env
 *   /api/*                  — the context library
 *   /paid, /mpp/*           — Stripe MPP, HTTP 402
 */

import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { discovery } from 'mppx/hono';
import { configReport, MissingConfigError } from './env.js';
import { handleMcpRequest, mcpInfo } from './mcp/server.js';
import {
  approve,
  dropTask,
  editTask,
  getHandoff,
  handoffFromBrief,
  latestHandoff,
  type BriefLike,
} from './handoff/index.js';
import {
  DEFAULT_SUBJECT,
  appendTurn,
  createSession,
  dbReady,
  destroySession,
  endSession,
  exportLibrary,
  getDecisionForSession,
  getSession,
  keepContextItems,
  listContextItems,
  listDecisions,
  listReceipts,
  listSessions,
  listTurns,
  markDispatched,
  setSessionPhase,
  writeDecision,
  writeReceipt,
} from './db/index.js';
import {
  accruedUsd,
  getMppx,
  livemode,
  mppMissing,
  mppReady,
  pricingSummary,
  flatSettlementUsd,
  settlementUsd,
  usd,
  usdPrecise,
} from './mpp/index.js';
import { SESSION_PHASES, type NewDecision, type SessionPhase } from './types.js';
import { web } from './web/index.js';

export const app = new Hono();

app.use('*', cors());

// The front door: the page, the vCard, signup, the inbound webhook.
// Mounted first so GET / can serve HTML to a browser; it calls next() for
// anything that is not a browser, which falls through to the service
// document below.
app.route('/', web);

// Non-browsers fall through the front door to here.
app.get('/', (c) => app.fetch(new Request(new URL('/service', c.req.url))));

/** Parse a JSON body, treating absent or malformed bodies as `{}`. */
async function body<T extends object>(c: Context): Promise<Partial<T>> {
  return (await c.req.json().catch(() => ({}))) as Partial<T>;
}

// ─────────────────────────────────────────────────────────────
// Errors — a clear message, never a stack trace over the wire
// ─────────────────────────────────────────────────────────────

app.onError((err, c) => {
  if (err instanceof MissingConfigError) {
    return c.json({ error: 'not_configured', message: err.message, missing: err.keys }, 503);
  }
  console.error('[error]', err);
  return c.json({ error: 'internal', message: err.message }, 500);
});

// ─────────────────────────────────────────────────────────────
// Always-on
// ─────────────────────────────────────────────────────────────

app.get('/service', (c) =>
  c.json({
    service: 'next-mission',
    what: 'A private voice agent that walks a human to a decision they believe, then hands their own agent an executable brief.',
    endpoints: {
      health: 'GET /health',
      config: 'GET /config',
      discovery: 'GET /openapi.json',
      paid_resource: 'POST /paid',
      pricing: 'GET /mpp/pricing',
      meter: 'POST /mpp/meter',
      settlement: 'POST /mpp/brief/:sessionId',
      library_export: 'GET /api/library/export',
      destroy_on_exit: 'POST /api/sessions/:id/destroy',
    },
  })
);

app.get('/health', (c) => c.json({ ok: true, at: new Date().toISOString() }));

/**
 * Plain-text documentation for agents. `mppx validate` checks for this, and
 * an agent that finds the 402 should be able to read what it is buying.
 */
app.get('/llms.txt', (c) => {
  const p = pricingSummary();
  return c.text(
    `# Next Mission

A private voice agent that walks a human through structured decision-making
until they reach a decision they actually believe. It outputs the decision in
the person's own words plus the exact next steps an agent can execute, then
hands that brief to the human's own personal agent.

It deliberately does not take the action. Committing to a direction is the one
thing only the human can do; this turns that commitment into an executable brief.

## What you are buying

Your human's conviction, as a deterministic brief you can act on:
a decision statement, one next action, the reasoning, and further next steps.

## Pricing

${p.model}.

- Meter: ${p.meter.usd_per_second} USD per second of talk time (${p.meter.usd_per_minute} USD/min),
  accruing continuously during the conversation. Sub-cent per second.
- Settlement: the decision brief. You pay the accrued talk time, clamped up to
  the payment method minimum (${p.settlement.spt_minimum_usd} USD for Shared Payment Tokens,
  ${p.settlement.stablecoin_minimum_usd} USDC for stablecoin).
- Methods: ${p.methods.join(', ')}.

## Endpoints

- GET  /openapi.json          discovery, with x-payment-info
- GET  /mpp/pricing           the pricing model as JSON
- POST /mpp/meter             report talk time; returns the running accrual
- POST /paid                  paid resource at the settlement price (402)
- POST /mpp/brief/:sessionId  the settlement event: pay, receive the brief (402)
- GET  /api/library/export    the person's whole context library as portable JSON
- POST /api/sessions/:id/destroy  destroy the raw transcript; kept context survives

## Privacy

The raw transcript is destroyable on exit as a real delete, not a flag. What
survives is only the context the person chose to keep, and their own decisions.
`,
    200,
    { 'Content-Type': 'text/plain; charset=utf-8' }
  );
});

/** Which features have their keys. Names only — never any values. */
app.get('/config', (c) =>
  c.json({ ok: true, features: configReport(), pricing: pricingSummary() })
);

// ─────────────────────────────────────────────────────────────
// MPP — HTTP 402
// ─────────────────────────────────────────────────────────────

app.get('/mpp/pricing', (c) => c.json(pricingSummary()));

/**
 * The canonical paid resource. Flat settlement price, no database needed —
 * this is what `mppx validate` exercises for the full round trip.
 */
/**
 * Built once and reused, because discovery needs the configured handler
 * itself in order to describe the route's payment requirements.
 */
let cachedPaidCharge: ReturnType<ReturnType<typeof getMppx>['charge']> | null = null;

function paidCharge() {
  if (!cachedPaidCharge) {
    cachedPaidCharge = getMppx().charge({
      amount: flatSettlementUsd(),
      description: 'Next Mission — decision brief settlement',
    });
  }
  return cachedPaidCharge;
}

const paid = async (c: Context) => {
  const result = await paidCharge()(c.req.raw);

  if (result.status === 402) return result.challenge;

  return result.withReceipt(
    Response.json({
      paid: true,
      amount_usd: flatSettlementUsd(),
      resource: 'decision-brief',
      livemode: livemode(),
      at: new Date().toISOString(),
    })
  );
};

app.post('/paid', paid);
app.get('/paid', paid);

/**
 * The meter. Called while the conversation runs. Accrues sub-cent talk
 * time against the session and reports the running balance. Not itself a
 * settlement — see the note at the top of src/mpp/index.ts.
 */
app.post('/mpp/meter', async (c) => {
  const b = await body<{ session_id: string; seconds: number }>(c);
  const seconds = Number(b.seconds ?? 0);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return c.json({ error: 'bad_request', message: '`seconds` must be a non-negative number' }, 400);
  }

  let totalSeconds = seconds;
  if (b.session_id && dbReady()) {
    const session = await getSession(b.session_id);
    if (!session) return c.json({ error: 'not_found', message: 'session not found' }, 404);
    totalSeconds = session.duration_seconds + seconds;
    await endSession(b.session_id, totalSeconds, session.status);
  }

  return c.json({
    session_id: b.session_id ?? null,
    tick_seconds: seconds,
    tick_usd: usdPrecise(accruedUsd(seconds)),
    total_seconds: Math.round(totalSeconds),
    accrued_usd: usdPrecise(accruedUsd(totalSeconds)),
    settles_on: 'the decision brief',
  });
});

/**
 * The settlement event. An agent asks for its human's decision brief and
 * pays the accrued talk time for it. 402 until it does.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

app.post('/mpp/brief/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  const mppx = getMppx();

  // Check the id before touching the database. Passing a non-UUID straight
  // through produces a Postgres type error, which surfaced as a 500 on any
  // probe of the literal `:sessionId` path.
  if (!UUID.test(sessionId)) {
    return c.json(
      { error: 'bad_request', message: '`sessionId` must be a session UUID' },
      400
    );
  }

  // The amount is the session's metered talk time. With no library
  // configured it falls back to the flat settlement price, so the 402 still
  // works against an empty Supabase config.
  let seconds = 0;
  if (dbReady()) {
    const session = await getSession(sessionId);
    // Never issue a payment challenge for a session that does not exist —
    // an agent must not be able to pay for nothing.
    if (!session) return c.json({ error: 'not_found', message: 'session not found' }, 404);
    seconds = session.duration_seconds;
  }
  const quote = settlementUsd(seconds);

  const result = await mppx.charge({
    amount: quote.amount,
    description: `Next Mission — decision brief for ${quote.seconds}s of talk time`,
    meta: { session_id: sessionId, billed_seconds: String(quote.seconds) },
  })(c.req.raw);

  if (result.status === 402) return result.challenge;

  // Paid. Record the receipt and hand over the brief.
  const decision = dbReady() ? await getDecisionForSession(sessionId) : null;

  let receiptRow = null;
  if (dbReady()) {
    receiptRow = await writeReceipt({
      session_id: sessionId,
      cadence: 'settlement',
      amount_usd: quote.amount,
      billed_seconds: quote.seconds,
      livemode: livemode(),
      payment_method: 'mpp',
      raw: { accrued_usd: quote.accrued, clamped_to_minimum: quote.clamped },
    }).catch(() => null);
  }

  return result.withReceipt(
    Response.json({
      paid: true,
      session_id: sessionId,
      billing: quote,
      decision,
      receipt: receiptRow,
      livemode: livemode(),
    })
  );
});

// OpenAPI discovery at GET /openapi.json, so an agent (and `mppx validate`)
// can find the paid routes without being told about them.
// Routes are declared explicitly rather than introspected: `auto: true` reads
// Hono's route table, which cannot tell which routes are paid, so it produced
// an empty `paths` and `mppx validate` never exercised the round trip.
if (mppReady()) {
  try {
    discovery(app, getMppx(), {
      info: { title: 'Next Mission', version: '1.0.0' },
      routes: [
        {
          handler: paidCharge(),
          method: 'post',
          path: '/paid',
          summary: 'Buy the decision brief at the flat settlement price.',
          requestBody: { type: 'object', properties: {} },
        },
        {
          handler: paidCharge(),
          method: 'get',
          path: '/paid',
          summary: 'Buy the decision brief at the flat settlement price.',
        },
        // POST /mpp/brief/{sessionId} is deliberately not declared here.
        // Its amount is one session's metered talk time, and it refuses to
        // issue a challenge for a session that does not exist — so a prober
        // requesting the literal `{sessionId}` gets a 400, not a 402. It is
        // documented in /llms.txt instead. /paid is the declared paid
        // resource and settles at the same price.
      ],
    });
  } catch (err) {
    console.warn('[mpp] discovery not mounted:', (err as Error).message);
  }
} else {
  app.get('/openapi.json', (c) =>
    c.json(
      {
        error: 'not_configured',
        message: `Stripe MPP is not configured. Missing in .env: ${mppMissing().join(', ')}.`,
      },
      503
    )
  );
}

// ─────────────────────────────────────────────────────────────
// The context library
// ─────────────────────────────────────────────────────────────

app.post('/api/sessions', async (c) => {
  const b = await body<{ subject_id: string; metadata: Record<string, unknown> }>(c);
  return c.json(await createSession(b), 201);
});

app.get('/api/sessions', async (c) =>
  c.json(await listSessions(c.req.query('subject_id') ?? DEFAULT_SUBJECT))
);

app.get('/api/sessions/:id', async (c) => {
  const session = await getSession(c.req.param('id'));
  if (!session) return c.json({ error: 'not_found' }, 404);
  const [turns, contextItems, decision, receipts] = await Promise.all([
    listTurns(session.id),
    listContextItems({ sessionId: session.id }),
    getDecisionForSession(session.id),
    listReceipts({ sessionId: session.id }),
  ]);
  return c.json({ session, turns, context_items: contextItems, decision, receipts });
});

app.post('/api/sessions/:id/turns', async (c) => {
  const b = await body<{ speaker: 'human' | 'agent'; text: string; offset_ms: number }>(c);
  if (!b.speaker || typeof b.text !== 'string') {
    return c.json({ error: 'bad_request', message: '`speaker` and `text` are required' }, 400);
  }
  return c.json(
    await appendTurn({
      session_id: c.req.param('id'),
      speaker: b.speaker,
      text: b.text,
      offset_ms: b.offset_ms ?? null,
    }),
    201
  );
});

app.post('/api/sessions/:id/phase', async (c) => {
  const b = await body<{ phase: string }>(c);
  if (!b.phase || !SESSION_PHASES.includes(b.phase as SessionPhase)) {
    return c.json(
      { error: 'bad_request', message: `\`phase\` must be one of: ${SESSION_PHASES.join(', ')}` },
      400
    );
  }
  return c.json(await setSessionPhase(c.req.param('id'), b.phase as SessionPhase));
});

app.post('/api/sessions/:id/end', async (c) => {
  const b = await body<{ duration_seconds: number; status: 'completed' | 'abandoned' }>(c);
  return c.json(
    await endSession(c.req.param('id'), Number(b.duration_seconds ?? 0), b.status ?? 'completed')
  );
});

/** Destroy-on-exit. The demoable moment. */
app.post('/api/sessions/:id/destroy', async (c) => c.json(await destroySession(c.req.param('id'))));

app.get('/api/context', async (c) =>
  c.json(
    await listContextItems({
      subjectId: c.req.query('subject_id') ?? DEFAULT_SUBJECT,
      keptOnly: c.req.query('kept') === 'true',
    })
  )
);

/** The person chooses what to keep. Only kept items survive destroy. */
app.post('/api/context/keep', async (c) => {
  const b = await body<{ ids: string[]; kept: boolean }>(c);
  if (!Array.isArray(b.ids)) {
    return c.json({ error: 'bad_request', message: '`ids` must be an array' }, 400);
  }
  return c.json(await keepContextItems(b.ids, b.kept ?? true));
});

app.post('/api/decisions', async (c) => {
  const b = await body<NewDecision>(c);
  if (!b.session_id || !b.statement || !b.next_action) {
    return c.json(
      { error: 'bad_request', message: '`session_id`, `statement` and `next_action` are required' },
      400
    );
  }
  return c.json(await writeDecision(b as NewDecision), 201);
});

app.get('/api/decisions', async (c) =>
  c.json(await listDecisions(c.req.query('subject_id') ?? DEFAULT_SUBJECT))
);

app.post('/api/decisions/:id/dispatch', async (c) => {
  const b = await body<{ target: string }>(c);
  return c.json(await markDispatched(c.req.param('id'), b.target ?? 'personal-agent'));
});

app.get('/api/receipts', async (c) => c.json(await listReceipts({})));

/** The whole library, one call, portable JSON. */
app.get('/api/library/export', async (c) => {
  const subjectId = c.req.query('subject_id') ?? DEFAULT_SUBJECT;
  const library = await exportLibrary(subjectId);
  c.header('Content-Disposition', `attachment; filename="next-mission-library-${subjectId}.json"`);
  return c.json(library);
});

// ─────────────────────────────────────────────────────────────
// The handoff over MCP — src/mcp/server.ts
//
// A caller's own agent connects here and pulls the work. One line, no setup:
//   claude mcp add --transport http next-mission https://<host>/mcp
// ─────────────────────────────────────────────────────────────

app.all('/mcp', (c) => handleMcpRequest(c.req.raw));

app.get('/mcp/info', (c) => c.json(mcpInfo(new URL(c.req.url).origin)));

// ─────────────────────────────────────────────────────────────
// The approval gate — what chat 07's approval screen calls.
//
// The human scans the brief, edits what they want, approves. Only then does
// any of it reach their agent: /mcp serves approved handoffs only, so these
// routes are the entire path from "a call landed" to "an agent can work".
// ─────────────────────────────────────────────────────────────

/**
 * The wire from a finished call to a reviewable brief: post the decision
 * brief, get back a DRAFT handoff with its task set.
 *
 * A route rather than a direct import, so the call-end pipeline (chat 06)
 * can reach it with one fetch and does not have to take a dependency on this
 * module — and so the whole path can be exercised with curl in a demo.
 */
app.post('/api/handoff/from-brief', async (c) => {
  const brief = (await c.req.json()) as BriefLike & { call_id?: string };
  const id = brief.call_id ?? c.req.query('call_id');
  if (!id) {
    return c.json(
      { error: 'bad_request', message: 'need a call_id, as ?call_id= or a call_id field' },
      400
    );
  }
  if (!brief?.lead_domino?.action) {
    return c.json({ error: 'bad_request', message: 'body must be a decision brief' }, 400);
  }
  const handoff = await handoffFromBrief(brief, id);
  return c.json(
    {
      ...handoff,
      awaiting: 'human approval — no agent can see this yet',
      approve_at: `POST ${new URL(c.req.url).origin}/api/handoff/${handoff.id}/approve`,
    },
    201
  );
});

/** The brief to put on the approval screen. Draft or approved. */
app.get('/api/handoff', async (c) => {
  const id = c.req.query('id');
  const h = id ? await getHandoff(id) : await latestHandoff();
  if (!h) return c.json({ error: 'not_found', message: 'no handoff yet' }, 404);
  return c.json(h);
});

/** Edit one task before approving. Refused once approved. */
app.patch('/api/handoff/:id/tasks/:taskId', async (c) => {
  const patch = await c.req.json();
  const { task } = await editTask(c.req.param('id'), c.req.param('taskId'), patch);
  return c.json(task);
});

/** Cut a task the human does not want. Refused once approved. */
app.delete('/api/handoff/:id/tasks/:taskId', async (c) =>
  c.json(await dropTask(c.req.param('id'), c.req.param('taskId')))
);

/** The product moment. After this, and only after this, agents can see it. */
app.post('/api/handoff/:id/approve', async (c) => {
  const h = await approve(c.req.param('id'));
  return c.json({
    ...h,
    now_reachable_at: `${new URL(c.req.url).origin}/mcp`,
  });
});

export default app;
