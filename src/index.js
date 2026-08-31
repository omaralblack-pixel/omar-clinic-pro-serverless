const SUPABASE_ORIGIN = "https://xaaydwxmpfvzawsfgayq.supabase.co";

const compressedAssets = new Map([
  [
    "/assets/index-NNS563dQ.js",
    { path: "/assets/index-NNS563dQ.js.gz", contentType: "text/javascript; charset=utf-8" }
  ],
  [
    "/assets/index-DH-0ItM8.css",
    { path: "/assets/index-DH-0ItM8.css.gz", contentType: "text/css; charset=utf-8" }
  ]
]);

const securityHeaders = {
  "Content-Security-Policy": `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${SUPABASE_ORIGIN} wss://xaaydwxmpfvzawsfgayq.supabase.co; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

export default {
  async fetch(request, env) {
    const requestedUrl = new URL(request.url);
    const compressed = compressedAssets.get(requestedUrl.pathname);
    let assetRequest = request;

    if (compressed) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = compressed.path;
      assetRequest = new Request(assetUrl, request);
    }

    const response = await env.ASSETS.fetch(assetRequest);
    const headers = new Headers(response.headers);
    const pathname = requestedUrl.pathname;

    for (const [name, value] of Object.entries(securityHeaders)) {
      headers.set(name, value);
    }

    if (compressed) {
      headers.set("Content-Encoding", "gzip");
      headers.set("Content-Type", compressed.contentType);
      headers.set("Vary", "Accept-Encoding");
    }

    if (pathname.startsWith("/assets/") || /\.(?:png|webp|svg|ico|woff2?)$/i.test(pathname)) {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
