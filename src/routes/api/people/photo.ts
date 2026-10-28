import { createFileRoute } from "@tanstack/react-router";

const SAFE_EMAIL = /^[A-Za-z0-9._%+\-]+@primeeng\.com$/i;

async function graphToken() {
  const fromEnv = process.env.GRAPH_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const easyAuth = process.env.X_MS_TOKEN_AAD_ACCESS_TOKEN?.trim();
  return easyAuth || null;
}

async function graphPhoto(email: string, token: string) {
  const encoded = encodeURIComponent(email);
  const urls = [
    `https://graph.microsoft.com/v1.0/users/${encoded}/photos/64x64/$value`,
    `https://graph.microsoft.com/v1.0/users/${encoded}/photo/$value`,
  ];
  for (const url of urls) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) continue;
    const type = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    if (!type.startsWith("image/")) continue;
    const data = await res.arrayBuffer();
    if (!data.byteLength) continue;
    return { data, type };
  }
  return null;
}

export const Route = createFileRoute("/api/people/photo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const email = new URL(request.url).searchParams.get("email")?.trim() ?? "";
        if (!SAFE_EMAIL.test(email)) return new Response(null, { status: 400 });
        const token = await graphToken();
        if (!token) return new Response(null, { status: 404 });
        try {
          const photo = await graphPhoto(email, token);
          if (!photo) return new Response(null, { status: 404 });
          return new Response(photo.data, {
            headers: {
              "Content-Type": photo.type,
              "Cache-Control": "private, max-age=86400",
            },
          });
        } catch {
          return new Response(null, { status: 404 });
        }
      },
    },
  },
});
