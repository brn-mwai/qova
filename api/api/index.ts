/**
 * Vercel Serverless Function entry point.
 * Wraps the Hono app with the Vercel adapter.
 * Imports from pre-bundled output that inlines @brnmwai/qova-core.
 *
 * Build the bundle before deploying:
 *   cd sdk && bun run build
 *   cd ../api && bun build src/app.ts --outfile dist/app.bundle.js --target=node --bundle --external hono --external viem --external zod
 */

import { handle } from "hono/vercel";
import { app } from "../dist/app.bundle.js";

export const runtime = "nodejs";

export default handle(app);
