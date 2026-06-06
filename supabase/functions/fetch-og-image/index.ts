// Best-effort Open Graph image scraper. Public, no auth required.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const pickMeta = (html: string, names: string[]): string | null => {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']`,
      "i",
    );
    const m = html.match(re);
    if (m?.[1]) return m[1];
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`,
      "i",
    );
    const m2 = html.match(re2);
    if (m2?.[1]) return m2[1];
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Basic SSRF guard: only http(s) and not internal addresses
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("Only http(s) URLs are allowed");
    const host = parsed.hostname;
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/i.test(host)) {
      throw new Error("Internal hosts blocked");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    let html = "";
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 UFHOpportunityHub/1.0 (+og-image-fetch)",
          "Accept": "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
        redirect: "follow",
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/html") && !ct.includes("xml")) {
        throw new Error("Not an HTML page");
      }
      html = (await res.text()).slice(0, 200_000);
    } finally { clearTimeout(timer); }

    let image = pickMeta(html, [
      "og:image:secure_url", "og:image", "twitter:image", "twitter:image:src",
    ]);
    if (image && image.startsWith("//")) image = parsed.protocol + image;
    if (image && image.startsWith("/")) image = parsed.origin + image;

    return new Response(JSON.stringify({ image_url: image }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ image_url: null, error: String((e as any)?.message ?? e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});