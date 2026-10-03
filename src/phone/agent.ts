import { readFileSync } from 'node:fs';
import { AgentPhoneClient } from 'agentphone';
import { AGENT_ID, SPRINT_PROMPT_FILE, STAGE_CONFIG } from './config.js';

function requireKey(): string {
  const key = process.env.AGENTPHONE_API_KEY;
  if (!key) throw new Error('AGENTPHONE_API_KEY is not set');
  return key;
}

export function phoneClient(): AgentPhoneClient {
  // The SDK appends /v1 itself; AGENTPHONE_BASE_URL in .env already carries it,
  // so strip it or every path doubles to /v1/v1/... and 404s.
  const baseUrl = process.env.AGENTPHONE_BASE_URL?.replace(/\/v1\/?$/, '');
  return new AgentPhoneClient({ token: requireKey(), ...(baseUrl ? { baseUrl } : {}) });
}

/** Read the sprint prompt off disk. One file, swappable without touching logic. */
export function sprintPrompt(): string {
  return readFileSync(SPRINT_PROMPT_FILE, 'utf8');
}

export async function getAgent() {
  return phoneClient().agents.getAgent({ agent_id: AGENT_ID });
}

/**
 * Push the sprint prompt + stage config to the live agent.
 * `beginMessage` is passed explicitly so the opener is never left stale.
 */
export async function pushStageConfig(beginMessage: string | null) {
  return phoneClient().agents.updateAgent({
    agent_id: AGENT_ID,
    ...STAGE_CONFIG,
    systemPrompt: sprintPrompt(),
    beginMessage,
  } as Parameters<AgentPhoneClient['agents']['updateAgent']>[0]);
}
