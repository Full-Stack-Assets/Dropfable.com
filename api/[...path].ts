// Vercel serverless entry for DropKit's backend.
//
// All `/api/*` requests are routed here (see vercel.json). The exported value
// is the configured Express app from ../server.ts — an Express app is itself a
// (req, res) handler, which is exactly what @vercel/node expects. The Express
// routes are defined with their full `/api/...` paths and Vercel preserves the
// original request URL, so they match without any rewriting.
import app from "../server";

export default app;
