// Vercel serverless entry for DropKit's backend.
//
// All `/api/*` requests are routed here (see vercel.json). The Express app is
// pre-bundled by the Vercel buildCommand into a self-contained CommonJS file
// (server.generated.cjs) and shipped with this function via `includeFiles`. We
// load it with createRequire rather than a static `import "../server"`: the
// project is ESM ("type": "module"), and under Vercel's runtime a bare,
// cross-directory TypeScript import is neither bundled nor given a resolvable
// extension, which crashes the function with ERR_MODULE_NOT_FOUND. Requiring the
// pre-built bundle sidesteps module resolution entirely.
//
// An Express app is itself a (req, res) handler — exactly what @vercel/node
// expects as the default export. The bundle's CJS interop puts it on `.default`.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const serverModule = require("../server.generated.cjs");

export default serverModule?.default ?? serverModule;
