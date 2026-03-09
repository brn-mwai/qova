/**
 * Qova API entry point -- Bun-native HTTP server.
 * @author Qova Engineering <eng@qova.cc>
 */

import { app } from "./app.js";

const port = Number(process.env.PORT) || 3001;

if (Number.isNaN(port) || port < 1 || port > 65535) {
	console.error("[FATAL] Invalid PORT:", process.env.PORT);
	process.exit(1);
}

console.log(`Qova API starting on port ${port}`);

export default {
	port,
	fetch: app.fetch,
};
