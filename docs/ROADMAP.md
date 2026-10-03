# Mission control — Next Mission v2

**Deadline: today, Oct 3 2026, 17:30 PDT.** Target submission 17:00.
**Prompt:** "build something agents want."

This file is owned by the orchestration chat. Executor chats read it; they do not edit it.

## The product in one paragraph

A private voice agent that walks a human through structured decision-making until they
reach a decision they actually believe. It outputs **a firm decision the human made, plus
the exact next steps an agent can execute** — then hands that brief to the human's own
personal agent (Intuitive, Muse, whatever they run). The system deliberately does not take
the action. Every conversation also builds the human's private, user-owned **context
library**.

**Why agents want it:** agents want to help their humans, but they cannot decide *for*
them. This converts the one thing only a human can do — commit to a direction — into a
specific, deterministic, executable brief, and hands the agent the reins to build momentum.

## Workstream ownership — one chat per row

| # | Workstream | Owns | Model | Status |
|---|---|---|---|---|
| 01 | **Transcript intelligence** | `docs/findings/` | Opus | **done** — 112 calls, 24 substantive |
| 02 | **Decision architecture** | `docs/research/` | Opus | **running** — due 90 min |
| 03 | **Infrastructure** | `src/db/`, `src/mpp/`, `supabase/`, `scripts/`, deploy | Sonnet | **running** — deploy by 14:30 |
| 04 | **Voice engine** | `src/voice/` | Opus | **running** — talking by 14:00 |
| 05 | **Brief + MCP dispatch** | `src/brief/`, `src/mcp/` | Sonnet | waits on 02 + 03 interfaces |
| 06 | **Surface** | the UI | Sonnet | waits on 04 |

Rule: a workstream may only write inside the paths it owns. Conflicts come back here.

## Decision log

Decisions are recorded here once made, with the date and the reasoning, so executor chats
never re-litigate them.

| # | Decision | Status |
|---|---|---|
| 0 | Stripe: **MPP, not Metronome** — Metronome real-time usage billing is private preview; MPP is GA, documented, and self-gradeable with `npx mppx validate` | **settled** |
| 0b | **No SMS.** US A2P 10DLC carrier registration takes days. Voice only | **settled** |
| 0c | **Pricing = metered by talk time** (idea F1) over MPP's streaming cadence and sub-cent settlement. The human's personal agent pays by the minute for its human's conversation. This also answers "who pays" | **settled** |
| 1 | **The brain: Claude + Gemini now.** Privacy ships as architecture — destroy-on-exit and user-owned data (idea D1) — with the model behind a config boundary so an open-source swap (E1) stays cheap. Keeps the Claude and Gemini categories | **settled** |
| 3 | **Dispatch target: an MCP server.** Any agent connects and pulls the brief; a judge can point their own Claude Code at it | **settled** |
| 1b | **The frame opens the pitch** (Garry Tan's capacity argument). Say Cowan's four chunks, not Miller's seven — the correction strengthens the mechanism. Never cite the Iyengar jam study or decision fatigue | **settled** |
| 2 | Demo scope: what is in the 2-minute demo | **open** |
| 5 | Voice surface: phone, browser, or both | open |
| 6 | Pacing: B13 long meditative pauses vs B11 short fast turns — contradictory, both his | **open — creative** |
| 7 | Vocabulary: G2 says "context" drew an eye roll, but this panel is engineers; G5 doubts "make a decision" as the headline | **open — creative** |

The 12 ideas that are non-negotiable, and what each one earns, are in
`docs/IDEA-BANK-TRIAGE.md`. Executor chats must read that file before writing prompts or
conversation logic.

## Category coverage

Nine voting categories. Current plan covers eight; Codex is deliberately skipped.

| Category | How this build earns it | Risk |
|---|---|---|
| Best use of Stripe | MPP 402 on the decision brief | depends on Decision 4 |
| Best use of Claude | decision extraction + next-step generation | conflicts with Decision 1 |
| Best use of multimodal AI for Gemini | Live API native audio conversation | conflicts with Decision 1 |
| Best use of Vercel | deployed app | low |
| Functionality and completeness | one loop working end to end | low |
| Innovation and creativity | agents buying human conviction | low |
| UX and design | live session view + the brief artifact | low |
| Impact and usefulness | the strongest card — this is a real need | low |
| Best use of Codex | not pursued | — |

## Blockers on Max (serial, nothing proceeds without them)

1. **Team created** on hackathon.supabase.com — none found under his name. **~3 min.**
2. **Submission form located** — find it now, not at 17:00. **~3 min.**
3. Keys into `.env`: Anthropic, Gemini, Supabase, Stripe sandbox. **~20 min.**

See `docs/CRITICAL-PATH.md` for the full ordered list, timeline, and the 80/20 exclusions.
