const PRODUCTION_ORIGIN = "https://hexoboards.mteam88.workers.dev";
const STAGING_ORIGIN = "https://hexoboards-staging.mteam88.workers.dev";
const STAGING_HOSTS = new Set(["staging.hexoboards.com"]);

export const config = {
  runtime: "edge",
};

function getPublicHost(request) {
  return (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "hexoboards.com"
  ).split(",")[0].trim().toLowerCase();
}

function getOriginForHost(host) {
  return STAGING_HOSTS.has(host) ? STAGING_ORIGIN : PRODUCTION_ORIGIN;
}

export default async function handler(request) {
  const host = getPublicHost(request);
  const targetOrigin = getOriginForHost(host);
  const incomingUrl = new URL(request.url);
  const pathname = incomingUrl.searchParams.get("__pathname") || "/";
  const search = new URLSearchParams(incomingUrl.search);
  search.delete("__pathname");
  const upstreamUrl = new URL(pathname, targetOrigin);
  upstreamUrl.search = search.toString();

  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", host);
  headers.set("x-forwarded-proto", "https");
  headers.set("host", new URL(targetOrigin).host);
  headers.delete("content-length");

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: upstreamResponse.headers,
  });
}
