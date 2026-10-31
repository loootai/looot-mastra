import { describe, expect, it } from "vitest";
import { LoootApiError, loootTools } from "../src/index.js";

type Call = { url: URL; init: RequestInit };

function mockFetch(status: number, body: unknown, calls: Call[]): typeof fetch {
  return (async (url: URL, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

// Mastra tools validate input, so call execute the way an agent does: (inputData, context).
async function exec(tool: { execute?: (...a: any[]) => Promise<any> }, input: unknown) {
  return tool.execute!(input, {});
}

describe("loootTools", () => {
  it("searchCatalog sends q and limit with the bearer token", async () => {
    const calls: Call[] = [];
    const t = loootTools({ apiKey: "tok", fetch: mockFetch(200, { results: [{ endpointId: "job:people.email.find" }] }, calls) });
    const out = await exec(t.searchCatalog, { q: "work email", limit: 3 });
    expect(out.results[0].endpointId).toBe("job:people.email.find");
    expect(calls[0]!.url.pathname).toBe("/v1/catalog/search");
    expect(calls[0]!.url.searchParams.get("q")).toBe("work email");
    expect(calls[0]!.url.searchParams.get("limit")).toBe("3");
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe("Bearer tok");
  });

  it("inspect URL-encodes the endpoint id", async () => {
    const calls: Call[] = [];
    const t = loootTools({ apiKey: "tok", fetch: mockFetch(200, { endpointId: "job:company.enrich" }, calls) });
    await exec(t.inspect, { endpointId: "job:company.enrich" });
    expect(calls[0]!.url.pathname).toBe("/v1/operations/job%3Acompany.enrich");
  });

  it("run posts the body, waits 20 s by default and makes an idempotency key", async () => {
    const calls: Call[] = [];
    const t = loootTools({ apiKey: "tok", fetch: mockFetch(200, { runId: "r1", status: "succeeded" }, calls) });
    const out = await exec(t.run, { endpointId: "job:people.email.find", input: { domain: "example.com" } });
    expect(out.status).toBe("succeeded");
    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.url.searchParams.get("wait")).toBe("20");
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.endpointId).toBe("job:people.email.find");
    expect(body.input).toEqual({ domain: "example.com" });
    expect(body.idempotencyKey).toMatch(/^mastra-/);
    expect(body.fallback).toBeUndefined();
  });

  it("run sends maxCostUsd as a fallback cap and keeps a given idempotency key", async () => {
    const calls: Call[] = [];
    const t = loootTools({ apiKey: "tok", maxCostUsd: 0.5, fetch: mockFetch(200, { runId: "r2" }, calls) });
    await exec(t.run, { endpointId: "job:company.enrich", input: {}, idempotencyKey: "k1", waitSeconds: 5 });
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.fallback).toEqual({ enabled: true, maxCostUsd: 0.5 });
    expect(body.idempotencyKey).toBe("k1");
    expect(calls[0]!.url.searchParams.get("wait")).toBe("5");
  });

  it("getRun reads one run", async () => {
    const calls: Call[] = [];
    const t = loootTools({ apiKey: "tok", fetch: mockFetch(200, { runId: "r1", status: "running" }, calls) });
    const out = await exec(t.getRun, { runId: "r1" });
    expect(out.status).toBe("running");
    expect(calls[0]!.url.pathname).toBe("/v1/runs/r1");
  });

  it("balance reads the balance", async () => {
    const calls: Call[] = [];
    const t = loootTools({ apiKey: "tok", fetch: mockFetch(200, { available: 5 }, calls) });
    const out = await exec(t.balance, {});
    expect(out.available).toBe(5);
    expect(calls[0]!.url.pathname).toBe("/v1/balance");
  });
});

describe("errors", () => {
  it("throws LoootApiError on a non-2xx answer", async () => {
    const t = loootTools({
      apiKey: "tok",
      fetch: mockFetch(402, { error: { code: "insufficient_balance", message: "Top up", requestId: "q1" } }, []),
    });
    const err = await exec(t.balance, {}).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(LoootApiError);
    expect((err as LoootApiError).code).toBe("insufficient_balance");
    expect((err as LoootApiError).status).toBe(402);
  });

  it("throws missing_token without a key", async () => {
    const saved = process.env.LOOOT_TOKEN;
    delete process.env.LOOOT_TOKEN;
    try {
      const t = loootTools({ fetch: mockFetch(200, {}, []) });
      await expect(exec(t.balance, {})).rejects.toMatchObject({ code: "missing_token" });
    } finally {
      if (saved !== undefined) process.env.LOOOT_TOKEN = saved;
    }
  });
});
