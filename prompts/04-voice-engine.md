# Executor brief 04 — Voice engine (Gemini Live native audio)

**Owns:** `src/voice/` and a minimal voice page. Do not touch `src/db/`, `src/mpp/`,
`supabase/`, `docs/research/`, or `docs/findings/`.
**Model:** Opus — streaming audio and barge-in are fiddly.
**Time box:** a real spoken conversation in the browser by **14:00 PDT**.
Hackathon ends **17:30 PDT today**.

## Your job

A person opens a page, talks, and the agent talks back — low latency, natural turn-taking.
This carries **Best Use of Multimodal AI for Gemini**, so the native-audio capabilities have
to be genuinely used, not a text chatbot with speech bolted on.

Repo: `/Users/maxmuzones/Hackathon 10-3-2026`. `@google/genai@1.52.0` is installed.
`GEMINI_API_KEY` is in `.env`. Read `docs/ROADMAP.md` first.

## Technical specifics — verified, use these

- Model: **`gemini-2.5-flash-native-audio-preview-12-2025`** (Live API, native audio dialog).
  There is also `gemini-live-2.5-flash-preview-native-audio-09-2025` if the first misbehaves.
- Input audio: **raw 16-bit PCM, 16 kHz, little-endian**. Output: **raw 16-bit PCM, 24 kHz,
  little-endian**. Getting these wrong produces audio that sounds like noise — check first.
- Supports function calling, audio+text output, and thinking. Does **not** support caching,
  structured outputs, or image generation.
- Fetch `https://ai.google.dev/gemini-api/docs/live` and the Live API guide pages for current
  SDK syntax rather than working from memory — this is a preview API and moves.
- Architecture: server-to-server is simpler and keeps the key off the client. If you go
  client-to-server, use **ephemeral tokens**, never ship `GEMINI_API_KEY` to the browser.
- Configure via `LiveConnectConfig`: `response_modalities`, `system_instruction`, voice name,
  and input/output audio transcription — **turn transcription on**, chat 03 needs the text to
  store turns and chat 05 needs it to extract the decision.

## Why native audio, specifically

The product's pacing is the Gemini claim. Max's idea **B13**: *"it would have to be
consistent and reliable and take long pauses. It would have to be very aware and in tune
with me."* That means:

- **Silence is allowed.** When someone is thinking, the agent must not fill the gap. Do not
  let a short pause trigger a response. This is the single most important behaviour.
- **Hear hesitation, not just words.** Native audio perceives how something was said. A
  wavering "yeah, I guess" is not agreement — and Max's completion gate (**C2**) depends on
  telling real resonance from politeness.
- **Barge-in works.** The person can interrupt and the agent yields immediately.

## The pacing conflict — do not resolve this yourself

Max has two contradictory recorded instructions, both his:
- **B13** — long pauses, meditative, patient
- **B11** — *"shorter turns — it needs to be swifter, faster"*

**Make pacing configurable** (silence threshold before the agent speaks, max agent turn
length, and response latency target), expose it as a small config object, and ship a
sensible default of patient-but-not-sleepy. Then **ask Max** which mode the demo should run
in, or whether it shifts as the conversation deepens. Do not pick for him.

## Conversation content

Chat 02 is producing the conversation protocol at `docs/research/02-decision-protocol.md`.
**Do not wait for it and do not invent your own.** Build the transport, the turn-taking and
the pacing with a placeholder system instruction, structured so the instruction is swapped
in from a single file when 02 lands. Check whether that file exists before you finish.

Placeholder behaviour, enough to test with: open by asking for broad context, ask one
question at a time, never give advice, never hold more than two or three things against each
other at once, and use "it seems like" rather than "I think" (**B7**).

## Deliverables

1. `src/voice/` — the Live session: connect, stream mic in, play audio out, handle
   interruption, surface transcripts via a callback.
2. A minimal page to hold a real conversation. Plain and functional; chat 06 owns the
   actual UI. Do not build a design.
3. A clean seam for the system instruction and for the pacing config.
4. A `turn` callback another chat can wire to persistence — do not write to the database
   yourself, chat 03 owns that.

## Report back

By 14:00 or when it works, whichever is first: whether a real spoken conversation happens
end to end, measured latency, how silence handling behaves, and the pacing question above.
Max optimises for simplicity and clarity — say plainly what works and what does not. Make no
creative decisions; surface options and ask in normal chat.
