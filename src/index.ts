/* Failure As A Service (FaaS) - Cloudflare Worker
 *
 * “Enterprise-grade disappointment, delivered on demand.”
 */
import MESSAGES from "../data/messages.json";

type Tone = "safe" | "spicy";
type Category = keyof typeof MESSAGES.categories;

type FailureItem = {
  id: string;
  message: string;
  category: string;
  tone: Tone;
  httpStatusHint?: number;
};

function uuidLike(seed: number): string {
  // Deterministic-ish short id for traceability (not cryptographic)
  const n = Math.abs(seed) >>> 0;
  return `faas_${n.toString(16).padStart(8, "0")}`;
}

function clampInt(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** Simple seeded PRNG (Mulberry32). */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandom<T>(arr: readonly T[], rnd: () => number): T {
  const idx = Math.floor(rnd() * arr.length);
  return arr[Math.min(arr.length - 1, Math.max(0, idx))];
}

function asCategory(input: string | null): Category | null {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  if (key in MESSAGES.categories) return key as Category;
  return null;
}

function parseHttpStatusHint(pathname: string): number | undefined {
  // /v1/failure/http/404 or /v1/failure/404
  const m = pathname.match(/\/v1\/failure(?:\/http)?\/(\d{3})$/i);
  if (!m) return undefined;
  const code = Number(m[1]);
  if (code >= 100 && code <= 599) return code;
  return undefined;
}

function wantsText(formatParam: string | null, accept: string | null): boolean {
  if (formatParam) return formatParam.toLowerCase() === "text";
  if (!accept) return false;
  return accept.includes("text/plain");
}

function getTone(input: string | null): Tone {
  const t = (input ?? "").trim().toLowerCase();
  return t === "spicy" ? "spicy" : "safe";
}

function nowIso(): string {
  return new Date().toISOString();
}

function setCommonHeaders(
  res: Response,
  meta: { reason: string; category: string; tone: Tone; requestId: string; failureFailed?: boolean }
) {
  const h = new Headers(res.headers);
  h.set("Cache-Control", "no-store");
  h.set("X-FAAS-Reason", meta.reason);
  h.set("X-FAAS-Category", meta.category);
  h.set("X-FAAS-Tone", meta.tone);
  h.set("X-FAAS-Request-Id", meta.requestId);
  if (meta.failureFailed) h.set("X-FAAS-Failure-Failed", "true");
  return new Response(res.body, { status: res.status, headers: h });
}

function getMessagePool(category: Category, tone: Tone): readonly string[] {
  const bank = MESSAGES.categories[category];
  const chosen = bank?.[tone] ?? [];
  const safeFallback = bank?.safe ?? [];
  const pool = chosen.length > 0 ? chosen : safeFallback;
  return pool.length > 0 ? pool : ["I… don’t know what to say."];
}

function buildFailure(seed: number, category: Category, tone: Tone, httpStatusHint?: number): FailureItem {
  const rnd = mulberry32(seed);
  const pool = getMessagePool(category, tone);
  const message = pickRandom(pool, rnd);
  return {
    id: uuidLike(seed),
    message,
    category,
    tone,
    httpStatusHint
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2) + "\n", {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function homepage(): Response {
  const categories = Object.keys(MESSAGES.categories).join(", ");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Failure As A Service (FaaS)</title>
  <style>
    body{font-family: ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; margin:40px; line-height:1.5}
    code,pre{background:#f6f8fa; padding:2px 6px; border-radius:6px}
    pre{padding:12px; overflow:auto}
    .box{border:1px solid #d0d7de; border-radius:12px; padding:16px; max-width:900px}
    .muted{color:#57606a}
    button{padding:10px 14px; border-radius:10px; border:1px solid #d0d7de; background:white; cursor:pointer}
    button:hover{background:#f6f8fa}
    .row{display:flex; gap:12px; flex-wrap:wrap; align-items:center}
  </style>
</head>
<body>
  <h1>Failure As A Service (FaaS)</h1>
  <p class="muted">Enterprise-grade disappointment, delivered on demand.</p>

  <div class="box">
    <h2>Quick start</h2>
    <pre><code>curl -s ${"https://<your-domain>"}\/v1\/failure</code></pre>
    <div class="row">
      <button id="btn">Generate failure</button>
      <code id="out" class="muted">Click the button for a fresh excuse.</code>
    </div>
    <p class="muted">Categories: ${categories}</p>
    <p class="muted"><strong>tone=spicy</strong> is opt-in and may contain profanity.</p>
  </div>

  <h2>Endpoints</h2>
  <ul>
    <li><code>GET /v1/failure</code> = one failure</li>
    <li><code>GET /v1/failure/batch?n=5</code> = many failures</li>
    <li><code>GET /v1/categories</code> = category list</li>
    <li><code>GET /healthz</code> = health check</li>
  </ul>

  <h2>Parameters</h2>
  <ul>
    <li><code>category</code>: one of the categories above</li>
    <li><code>format</code>: <code>json</code> (default) or <code>text</code></li>
    <li><code>seed</code>: deterministic output (useful for tests/demos)</li>
    <li><code>tone</code>: <code>safe</code> (default) or <code>spicy</code> (may contain swearing)</li>
  </ul>

  <p class="muted">If the failure itself fails, we respond with: <strong>I… don’t know what to say.</strong></p>

<script>
  const btn = document.getElementById('btn');
  const out = document.getElementById('out');
  btn.addEventListener('click', async () => {
    out.textContent = 'Generating…';
    const r = await fetch('/v1/failure?format=text');
    out.textContent = await r.text();
  });
</script>
</body>
</html>`;
  return htmlResponse(html);
}

export default {
  async fetch(request: Request): Promise<Response> {
    const requestId = crypto.randomUUID?.() ?? `faas_${Math.random().toString(16).slice(2)}`;
    try {
      const url = new URL(request.url);
      const { pathname, searchParams } = url;

      if (request.method !== "GET") {
        const res = jsonResponse(
          { error: "method_not_allowed", message: "GET only, please. We’re failing politely." },
          405
        );
        return setCommonHeaders(res, {
          reason: "GET only, please. We’re failing politely.",
          category: "meta",
          tone: "safe",
          requestId
        });
      }

      if (pathname === "/" || pathname === "/index.html") return homepage();

      if (pathname === "/healthz") {
        const res = jsonResponse({ ok: true, service: "faas", time: nowIso() }, 200);
        return setCommonHeaders(res, { reason: "ok", category: "meta", tone: "safe", requestId });
      }

      if (pathname === "/v1/categories") {
        const res = jsonResponse({ categories: Object.keys(MESSAGES.categories), version: MESSAGES.version }, 200);
        return setCommonHeaders(res, { reason: "categories", category: "meta", tone: "safe", requestId });
      }

      // --- Failure endpoints ---
      if (pathname === "/v1/failure" || pathname === "/v1/failure/" || pathname.startsWith("/v1/failure/")) {
        const category = asCategory(searchParams.get("category")) ?? (MESSAGES.defaults.category as Category);
        const tone = getTone(searchParams.get("tone"));

        const httpStatusHint = parseHttpStatusHint(pathname);
        const seedParam = searchParams.get("seed");
        const seed = seedParam ? Number(seedParam) : (Date.now() ^ (Math.random() * 1e9));

        const item = buildFailure(seed, category, tone, httpStatusHint);

        const isText = wantsText(searchParams.get("format"), request.headers.get("accept"));
        const res = isText
          ? textResponse(item.message, 200)
          : jsonResponse(
              {
                id: item.id,
                message: item.message,
                category: item.category,
                tone: item.tone,
                httpStatusHint: item.httpStatusHint ?? null,
                time: nowIso(),
                requestId
              },
              200
            );

        return setCommonHeaders(res, { reason: item.message, category: item.category, tone: item.tone, requestId });
      }

      if (pathname === "/v1/failure/batch") {
        const category = asCategory(searchParams.get("category")) ?? (MESSAGES.defaults.category as Category);
        const tone = getTone(searchParams.get("tone"));
        const n = clampInt(Number(searchParams.get("n") ?? "5"), 1, MESSAGES.defaults.maxBatch);

        const seedParam = searchParams.get("seed");
        const baseSeed = seedParam ? Number(seedParam) : (Date.now() ^ (Math.random() * 1e9));
        const rnd = mulberry32(baseSeed);

        const items: FailureItem[] = [];
        for (let i = 0; i < n; i++) {
          const s = Math.floor(rnd() * 2 ** 32);
          items.push(buildFailure(s, category, tone));
        }

        const isText = wantsText(searchParams.get("format"), request.headers.get("accept"));
        const res = isText
          ? textResponse(items.map((x) => `• ${x.message}`).join("\n"), 200)
          : jsonResponse({ items, count: items.length, category, tone, time: nowIso(), requestId }, 200);

        return setCommonHeaders(res, { reason: `batch:${n}`, category: String(category), tone, requestId });
      }

      // Unknown route → 404 with a failure flavour
      const res = jsonResponse({ error: "not_found", message: "I… don’t know what to say.", path: pathname, requestId }, 404);
      return setCommonHeaders(res, { reason: "I… don’t know what to say.", category: "meta", tone: "safe", requestId });
    } catch (_err) {
      // The failure failed
      const res = jsonResponse({ error: "failure_failed", message: "I… don’t know what to say." }, 500);
      return setCommonHeaders(res, {
        reason: "I… don’t know what to say.",
        category: "meta",
        tone: "safe",
        requestId,
        failureFailed: true
      });
    }
  }
};
