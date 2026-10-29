const PRINCIPAL_HEADER = "x-ms-client-principal-name";

export class PayloadTooLargeError extends Error {
  constructor() {
    super("Payload too large");
  }
}

/** Easy Auth injects and overwrites this header, so it is trusted when present. */
export function requestActor(request: Request, fallback?: string) {
  const principal = request.headers.get(PRINCIPAL_HEADER)?.trim();
  if (principal) return principal.slice(0, 200);
  const next = fallback?.trim();
  return next ? next.slice(0, 200) : undefined;
}

export function principalName(request: Request) {
  return request.headers.get(PRINCIPAL_HEADER)?.trim() || null;
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) throw new PayloadTooLargeError();
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new PayloadTooLargeError();
  return JSON.parse(text);
}

export function serverError(scope: string, err: unknown, status = 500) {
  const ref = crypto.randomUUID().slice(0, 8);
  console.error(`[${scope}] ref=${ref}`, err);
  return Response.json({ ok: false, error: "Map service unavailable", ref }, { status });
}

type Bucket = { tokens: number; at: number };

/** Small per-instance token bucket; enough to stop runaway clients, not a distributed limiter. */
export function createRateLimiter(capacity: number, refillPerSecond: number) {
  const buckets = new Map<string, Bucket>();
  return (key: string) => {
    const now = Date.now();
    const bucket = buckets.get(key) ?? { tokens: capacity, at: now };
    bucket.tokens = Math.min(capacity, bucket.tokens + ((now - bucket.at) / 1000) * refillPerSecond);
    bucket.at = now;
    if (bucket.tokens < 1) {
      buckets.set(key, bucket);
      return false;
    }
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) if (now - b.at > 60_000) buckets.delete(k);
    }
    return true;
  };
}
