const KRAKEN_UPSTREAM = "https://6-tac.com";

export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("__pathname") || "/v1/best-move";

  const upstreamUrl = new URL(path, KRAKEN_UPSTREAM);

  const headers = new Headers(request.headers);
  headers.set("x-forwarded-proto", "https");
  headers.delete("content-length");

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: upstreamResponse.headers,
  });
}
