function normalizeForwardedHost(value) {
  if (!value) {
    return null;
  }

  const first = value.split(",")[0].trim();
  if (!first) {
    return null;
  }

  try {
    return new URL(`http://${first}`).hostname;
  } catch {
    return first.replace(/:\d+$/, "");
  }
}

function publicUrl(request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = normalizeForwardedHost(request.headers.get("x-forwarded-host"));
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();

  const url = new URL(request.url);
  if (forwardedHost) {
    url.hostname = forwardedHost;
    url.port = "";
  }
  if (forwardedProto) {
    url.protocol = `${forwardedProto}:`;
  }

  url.pathname = requestUrl.pathname;
  url.search = "";
  url.hash = "";
  return url.toString();
}

class SetAttribute {
  constructor(name, value) {
    this.name = name;
    this.value = value;
  }

  element(element) {
    element.setAttribute(this.name, this.value);
  }
}

export default {
  async fetch(request, env) {
    const assetResponse = await env.ASSETS.fetch(request);
    const contentType = assetResponse.headers.get("content-type") || "";

    if (!contentType.includes("text/html")) {
      return assetResponse;
    }

    const url = publicUrl(request);

    return new HTMLRewriter()
      .on('link[rel="canonical"]', new SetAttribute("href", url))
      .on('meta[property="og:url"]', new SetAttribute("content", url))
      .transform(assetResponse);
  },
};
