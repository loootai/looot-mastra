# @looot/mastra

[![License](https://img.shields.io/github/license/loootai/looot-mastra)](LICENSE) [![Release](https://img.shields.io/github/v/release/loootai/looot-mastra)](https://github.com/loootai/looot-mastra/releases) [![Docs](https://img.shields.io/badge/docs-docs.looot.ai-12A06A)](https://docs.looot.ai)

[looot](https://looot.ai) tools for [Mastra](https://mastra.ai) agents. looot gives an agent one key and one prepaid balance for 4,200+ data APIs from 300+ providers: work emails, phone numbers, company and people search, Google results, web pages, LinkedIn profiles. The agent searches the catalog, sees the price before it runs, and pays per call. A failed call costs nothing. Top up from $5.

> Status: public, MIT, not on npm yet. Install from GitHub until the first release.

## Install

```bash
npm install github:loootai/looot-mastra#v0.1.0 @mastra/core zod
export LOOOT_TOKEN=...   # agent token from https://looot.ai (Settings, Agent tokens)
```

Peer dependencies: `@mastra/core` 1.x, `zod` 3.25+ or 4. Node 22.13+.

## Example

```ts
import { Agent } from "@mastra/core/agent";
import { loootTools } from "@looot/mastra";

export const researcher = new Agent({
  id: "researcher",
  name: "Researcher",
  instructions:
    "Use searchCatalog to find an endpoint, inspect it to see the price, then run it. Check balance before the first paid run.",
  model: "openai/gpt-5-mini",
  tools: loootTools({ maxCostUsd: 0.5 }), // reads LOOOT_TOKEN
});

const result = await researcher.generate("Find the work email of Jane Doe at example.com and tell me what it cost.");
console.log(result.text);
```

## Tools

| Tool | Tool id | Does | Cost |
| --- | --- | --- | --- |
| `searchCatalog` | `looot_search_catalog` | Ranked endpoint search from a plain-words task | free |
| `inspect` | `looot_inspect` | Input schema, output schema, price | free |
| `run` | `looot_run` | Runs one endpoint (`waitSeconds` inline, then poll) | spends credit |
| `getRun` | `looot_get_run` | Status and result of a run | free |
| `balance` | `looot_balance` | Prepaid balance and minimum top-up | free |

Options for `loootTools()`: `apiKey` (default `LOOOT_TOKEN`), `baseUrl`, `fetch`, `timeoutMs`, and `maxCostUsd`, which caps one run by sending `fallback: { enabled: true, maxCostUsd }`. Each tool is also exported alone (`searchCatalog()`, `run()` and so on).

A resolved `run` is not success. A bad input answers with `status: "failed"` and is not charged. Pass the same `idempotencyKey` to retry safely. API errors throw `LoootApiError` with `status` and `code`.

## Alternative: the remote MCP server

If you prefer not to use these tools, point Mastra's `MCPClient` at the looot remote MCP server (Streamable HTTP):

```ts
import { MCPClient } from "@mastra/mcp";

const looot = new MCPClient({
  servers: {
    looot: {
      url: new URL("https://api.looot.ai/mcp"),
      requestInit: { headers: { Authorization: `Bearer ${process.env.LOOOT_TOKEN}` } },
    },
  },
});

const tools = await looot.listTools(); // pass to new Agent({ tools })
```

The server also supports browser OAuth for interactive clients. Docs: https://docs.looot.ai.

## Develop

```bash
npm install
npm run typecheck && npm test && npm run build
npm run scan
git config core.hooksPath .githooks
```

## License

MIT. See [LICENSE](LICENSE).
