/** Local server. `npm run dev` / `npm start`. Vercel uses api/index.ts instead. */

import { serve } from '@hono/node-server';
import app from './app.js';
import { configReport } from './env.js';

const port = Number(process.env.PORT ?? 4242);

serve({ fetch: app.fetch, port }, (info) => {
  const features = configReport();
  console.log(`next-mission listening on http://localhost:${info.port}`);
  console.log(
    `  supabase: ${features.supabase.ready ? 'ready' : `missing ${features.supabase.missing.join(', ')}`}`
  );
  console.log(
    `  stripe:   ${features.stripe.ready ? `ready (livemode=${features.stripe.livemode}, tempo=${features.stripe.tempo})` : `missing ${features.stripe.missing.join(', ')}`}`
  );
  console.log(`  validate: npx mppx@latest validate http://localhost:${info.port}`);
});
