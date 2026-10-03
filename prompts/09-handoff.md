# Executor brief 09 — The handoff

**Owns:** `src/handoff/`, `src/mcp/`. Runs in its own worktree.
Do not touch `src/voice/` (04), `src/brain/` (06), `app/` (07), the Retell agent (08).
**Model:** Opus.
**Deadline: 1 hour from start.** Hackathon ends 17:30; Max submits at 17:00.

## Why this is the most important workstream left

The hackathon prompt is **"build something agents want."** Max's position, and he is right:

> *"The handoff is the criterion for judging whether this is even a valid pitch. It needs to
> be something agents want, and agents want to execute the tasks their humans need done."*

Everything upstream — the conversation, the privacy, the billing — is setup. **This is the
part that answers the prompt.** If a judge only looks at one thing, it is this.

## What you are building

A human finishes a call having decided something. Out of that comes a **task set an agent
can actually execute**, handed to *their own* agent — not ours.

Three jobs, in order:

### 1. Decompose the decision into tasks

Take the landed decision and the one next action, and break it into the concrete work that
moves it. Each task needs enough that a competent agent, with no access to the
conversation, could execute it without asking a follow-up question.

Minimum shape per task:

```
id
title            imperative, one line
detail           everything needed to do it, in the human's own words where possible
owner            "agent" | "human"
inputs_needed    what must be known or supplied first
done_when        the observable condition that ends it
blocked_by       other task ids, or nothing
```

**`done_when` is the field that makes this real.** A task without an observable completion
condition is a wish. Enforce it.

### 2. Decide who does what — and this is where Max's judgment enters

Max has said explicitly: *"determining what the agent can knock out is a feature that
requires my judgment and not something Claude can do 100% solo."*

So **do not hard-code the policy.** Build the split, then surface it to him and let him
move items across the line. Starting heuristics, to be argued with rather than obeyed:

- **Agent can:** draft the message, find the contact, assemble the list, do the research,
  prepare the document, schedule the slot, pull the numbers together.
- **Human must:** anything that is them — the actual sending of a personal message, the
  conversation, the commitment, the judgment call, anything irreversible, anything
  involving someone's trust in *them*.
- **Grey, and the interesting part:** the agent drafts and the human sends. Most of the
  value is here. Make this a first-class state, not an afterthought.

Ask Max which way the grey cases go. Give him the specific list from a real call, not an
abstract policy question.

### 3. Dispatch it over MCP

The user's own agent — Claude Code, Muse, whatever they run — connects and pulls the work.
**Do not build a second MCP server.** Chat 06 owns GBrain, whose MCP server is the context
library; the brief and its tasks land there and are served from there. One server, both
jobs: the library *is* the handoff. Coordinate with chat 06 before writing any server code.

Tools to expose, named for what an agent wants to do:

- `get_decision` — the landed decision, in their words, with the reasoning
- `list_tasks` — the task set, filterable by owner and blocked state
- `claim_task` / `complete_task` — so progress is visible and two agents don't collide
- `add_context` — so the agent can write back what it learned

## The demo beat

A judge points **their own** Claude Code at the MCP server and watches it pick up tasks from
a decision Max made out loud two minutes earlier. That is the whole pitch in one gesture, so
build toward it being doable live, in front of someone, without setup.

## Constraints

- **No timing pressure on the conversation.** Max has dropped the 110-second sprint
  requirement — the full protocol runs as long as it needs. Do not optimise for speed.
- `MPP_SETTLEMENT_USD` fires when the brief is delivered (chat 03 owns the rail). Call it;
  do not reimplement it.
- Work in your own worktree, commit there, and say when you are ready to merge.

## Report

To the orchestrator chat: the task schema as soon as it exists (chats 06 and 07 need it),
the agent/human split from a real call for Max to rule on, and whether an external agent can
connect to the MCP server. Within the hour.

Max optimises for simplicity and clarity. Make no creative decisions alone — surface options
and ask him in normal chat.
