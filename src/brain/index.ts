/**
 * src/brain — the context library and the zero-retention pipeline.
 *
 * The one thing this product does that ChatGPT does not: the call leaves
 * nothing behind. What survives is sorted into the caller's own GBrain, which
 * runs on their hardware, their database, their keys — and which their own
 * agent reads over GBrain's MCP server. We ship no MCP server of our own; the
 * context library is the handoff.
 */

export { runPipeline, type RunOptions } from './pipeline.js';
export { briefSlug, renderBrief } from './page.js';
export { extract } from './extract.js';
export * as gbrain from './gbrain.js';
export {
  fetchCallArtifacts,
  destroyCallArtifacts,
  type CallArtifacts,
  type RawTurn,
} from './agentphone.js';
export type {
  CallReceipt,
  Extraction,
  KeepItem,
  StoreRecord,
  StoreOutcome,
  Verification,
} from './types.js';
