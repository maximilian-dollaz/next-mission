/**
 * Vercel entrypoint. Every path is rewritten here by vercel.json, so this
 * serves the same Hono app that `tsx src/server.ts` serves locally.
 *
 * Exports `fetch`, not a default export: Vercel's Node runtime invokes a
 * default export with the legacy `(req, res)` signature, which hands Hono a
 * Node IncomingMessage instead of a Web Request and then hangs waiting for a
 * `res` write that never comes. A named `fetch` export gets the Web
 * `Request`/`Response` contract the app is written against.
 */

import app from '../src/app.js';

export function fetch(request: Request): Response | Promise<Response> {
  return app.fetch(request);
}
