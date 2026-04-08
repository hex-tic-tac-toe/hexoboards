import { DurableObject } from 'cloudflare:workers';

const SHARE_TABS = new Set(['editor', 'match', 'library']);
const SHARE_ID_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SHARE_ID_LENGTH = 12;
const MAX_SHARE_BYTES = 200_000;
const HEXO_API_BASE = 'https://hexo.did.science';
const KRAKEN_API_BASE = 'https://6-tac.com';

function normalizeForwardedHost(value) {
  if (!value) {
    return null;
  }

  const first = value.split(',')[0].trim();
  if (!first) {
    return null;
  }

  try {
    return new URL(`http://${first}`).hostname;
  } catch {
    return first.replace(/:\d+$/, '');
  }
}

function publicRequestUrl(request) {
  const forwardedHost = normalizeForwardedHost(request.headers.get('x-forwarded-host'));
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();

  const url = new URL(request.url);
  if (forwardedHost) {
    url.hostname = forwardedHost;
    url.port = '';
  }
  if (forwardedProto) {
    url.protocol = `${forwardedProto}:`;
  }

  url.hash = '';
  return url;
}

function publicUrl(request) {
  const url = publicRequestUrl(request);
  url.search = '';
  return url.toString();
}

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

function errorResponse(message, status = 400, headers = {}) {
  return jsonResponse({ error: message }, status, headers);
}

function methodNotAllowed(allow) {
  return errorResponse('method not allowed', 405, { allow: allow.join(', ') });
}

function isValidTab(tab) {
  return SHARE_TABS.has(tab);
}

function parseSharePath(pathname) {
  const match = pathname.match(/^\/share\/(editor|match|library)\/([A-Za-z0-9_-]{6,64})\/?$/);
  return match ? { tab: match[1], id: match[2] } : null;
}

function parseApiSharePath(pathname) {
  const match = pathname.match(/^\/api\/shares\/([A-Za-z0-9_-]{6,64})(?:\/(meta))?\/?$/);
  return match ? { id: match[1], meta: match[2] === 'meta' } : null;
}

function randomShareId(length = SHARE_ID_LENGTH) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let id = '';
  for (let i = 0; i < length; i += 1) {
    id += SHARE_ID_ALPHABET[bytes[i] % SHARE_ID_ALPHABET.length];
  }
  return id;
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function shareUrl(request, id, tab) {
  const url = publicRequestUrl(request);
  url.pathname = `/share/${tab}/${id}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

function shareAppHashUrl(request, id, tab) {
  const url = publicRequestUrl(request);
  url.pathname = '/';
  url.search = '';
  url.hash = `remote/cf/${id}/${tab}`;
  return url.toString();
}

function shareStub(env, id) {
  return env.GAME_SHARES.get(env.GAME_SHARES.idFromName(id));
}

async function createShare(request, env) {
  const body = await parseJson(request);
  const content = body?.content;
  const tab = body?.tab;

  if (typeof content !== 'string' || !content.trim()) {
    return errorResponse('content must be a non-empty JSON string');
  }
  if (content.length > MAX_SHARE_BYTES) {
    return errorResponse(`content exceeds ${MAX_SHARE_BYTES} bytes`, 413);
  }
  if (!isValidTab(tab)) {
    return errorResponse('tab must be editor, match, or library');
  }

  try {
    JSON.parse(content);
  } catch {
    return errorResponse('content must be valid JSON');
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = randomShareId();
    const stub = shareStub(env, id);
    const response = await stub.fetch('https://share.internal/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, tab, content }),
    });

    if (response.status === 409) {
      continue;
    }
    if (!response.ok) {
      return response;
    }

    const created = await response.json();
    return jsonResponse(
      {
        id: created.id,
        tab: created.tab,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        appUrl: shareUrl(request, created.id, created.tab),
        remoteUrl: shareAppHashUrl(request, created.id, created.tab),
      },
      201,
      { 'cache-control': 'no-store' },
    );
  }

  return errorResponse('failed to allocate share id', 500);
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

export class GameShare extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/create') {
      return this.create(request);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/content') {
      return this.content();
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/meta') {
      return this.meta();
    }

    return errorResponse('not found', 404);
  }

  async loadShare() {
    return this.ctx.storage.get('share');
  }

  async create(request) {
    const existing = await this.loadShare();
    if (existing) {
      return errorResponse('share id already exists', 409);
    }

    const body = await parseJson(request);
    const id = body?.id;
    const tab = body?.tab;
    const content = body?.content;

    if (typeof id !== 'string' || !id) {
      return errorResponse('id required');
    }
    if (!isValidTab(tab)) {
      return errorResponse('invalid tab');
    }
    if (typeof content !== 'string' || !content.trim()) {
      return errorResponse('content required');
    }

    const now = Date.now();
    const share = { id, tab, content, createdAt: now, updatedAt: now };
    await this.ctx.storage.put('share', share);

    return jsonResponse(
      {
        id: share.id,
        tab: share.tab,
        createdAt: share.createdAt,
        updatedAt: share.updatedAt,
      },
      201,
      { 'cache-control': 'no-store' },
    );
  }

  async content() {
    const share = await this.loadShare();
    if (!share) {
      return errorResponse('not found', 404);
    }

    return new Response(share.content, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=31536000, immutable',
        'x-hexoboards-share-id': share.id,
        'x-hexoboards-tab': share.tab,
      },
    });
  }

  async meta() {
    const share = await this.loadShare();
    if (!share) {
      return errorResponse('not found', 404);
    }

    return jsonResponse(
      {
        id: share.id,
        tab: share.tab,
        createdAt: share.createdAt,
        updatedAt: share.updatedAt,
      },
      200,
      { 'cache-control': 'public, max-age=31536000, immutable' },
    );
  }
}

async function proxyHexoApi(path, search) {
  try {
    const targetUrl = new URL(path, HEXO_API_BASE);
    targetUrl.search = search;
    const response = await fetch(targetUrl, {
      headers: {
        'accept': 'application/json',
      },
    });
    const data = await response.json();
    return jsonResponse(data, 200, {
      'cache-control': 'public, max-age=60',
      'access-control-allow-origin': '*',
    });
  } catch (e) {
    return errorResponse(`hexo api error: ${e.message}`, 502);
  }
}

async function proxyHexoGame(gameId) {
  try {
    const targetUrl = new URL(`/games/${gameId}`, HEXO_API_BASE);
    const response = await fetch(targetUrl, {
      headers: {
        'accept': 'text/html',
      },
    });
    const html = await response.text();
    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=3600',
        'access-control-allow-origin': '*',
      },
    });
  } catch (e) {
    return errorResponse(`hexo game error: ${e.message}`, 502);
  }
}

async function proxyKraken(pathname, search, request) {
  try {
    const targetUrl = new URL(pathname, KRAKEN_API_BASE);
    targetUrl.search = search;
    const body = await request.text();
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json',
      },
      body,
    });
    const data = await response.json();
    return jsonResponse(data, 200, {
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
  } catch (e) {
    return errorResponse(`kraken api error: ${e.message}`, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = publicRequestUrl(request);

    if (['/strategies', '/strategies/', '/posts', '/posts/'].includes(url.pathname)) {
      url.pathname = '/';
      url.search = '';
      return Response.redirect(url.toString(), 308);
    }

    if (url.pathname === '/api/shares') {
      if (request.method !== 'POST') {
        return methodNotAllowed(['POST']);
      }
      return createShare(request, env);
    }

    const apiShare = parseApiSharePath(url.pathname);
    if (apiShare) {
      if (!['GET', 'HEAD'].includes(request.method)) {
        return methodNotAllowed(['GET', 'HEAD']);
      }
      return shareStub(env, apiShare.id).fetch(`https://share.internal/${apiShare.meta ? 'meta' : 'content'}`);
    }

    if (url.pathname === '/api/hexo/finished-games') {
      if (!['GET', 'HEAD'].includes(request.method)) {
        return methodNotAllowed(['GET', 'HEAD']);
      }
      return proxyHexoApi('/api/finished-games', url.search);
    }

    if (url.pathname === '/api/hexo/sessions') {
      if (!['GET', 'HEAD'].includes(request.method)) {
        return methodNotAllowed(['GET', 'HEAD']);
      }
      return proxyHexoApi('/api/sessions', '');
    }

    if (url.pathname === '/api/hexo/games') {
      if (!['GET', 'HEAD'].includes(request.method)) {
        return methodNotAllowed(['GET', 'HEAD']);
      }
      const gameId = url.searchParams.get('id');
      if (!gameId) {
        return errorResponse('id parameter required');
      }
      return proxyHexoGame(gameId);
    }

    if (url.pathname.startsWith('/api/kraken/')) {
      const krakenPath = '/api' + (url.pathname.replace(/^\/api\/kraken/, '') || '/v1/best-move');
      return proxyKraken(krakenPath, url.search, request);
    }

    const share = parseSharePath(url.pathname);
    if (share) {
      if (!['GET', 'HEAD'].includes(request.method)) {
        return methodNotAllowed(['GET', 'HEAD']);
      }
      return Response.redirect(shareAppHashUrl(request, share.id, share.tab), 302);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    const contentType = assetResponse.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) {
      return assetResponse;
    }

    const canonicalUrl = publicUrl(request);

    return new HTMLRewriter()
      .on('link[rel="canonical"]', new SetAttribute('href', canonicalUrl))
      .on('meta[property="og:url"]', new SetAttribute('content', canonicalUrl))
      .transform(assetResponse);
  },
};
