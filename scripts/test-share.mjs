import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = 8799;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DEV_ARGS = ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1'];

function startDevServer() {
  const child = spawn('npx', DEV_ARGS, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      BROWSER: 'none',
      NO_COLOR: '1',
    },
  });

  let output = '';
  const collect = chunk => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(text);
  };

  child.stdout.on('data', collect);
  child.stderr.on('data', collect);

  return { child, getOutput: () => output };
}

async function waitForServer(child, getOutput) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`wrangler dev exited early (${child.exitCode})\n${getOutput()}`);
    }

    try {
      const response = await fetch(`${BASE_URL}/share/match/testshare`, { redirect: 'manual' });
      if (response.status >= 200) return;
    } catch {}

    await delay(500);
  }

  throw new Error(`timed out waiting for wrangler dev\n${getOutput()}`);
}

async function stopDevServer(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  for (let i = 0; i < 20; i += 1) {
    if (child.exitCode !== null) return;
    await delay(250);
  }
  child.kill('SIGKILL');
}

async function main() {
  const { child, getOutput } = startDevServer();

  try {
    await waitForServer(child, getOutput);

    const payload = JSON.stringify({
      type: 'hexoboards-match-compact',
      notation: 'a1,b2',
      title: 'Smoke Test',
      note: 'durable objects',
    });

    const createResponse = await fetch(`${BASE_URL}/api/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: payload, tab: 'match' }),
    });
    if (createResponse.status !== 201) {
      throw new Error(`create failed (${createResponse.status}): ${await createResponse.text()}`);
    }

    const created = await createResponse.json();
    assert.match(created.id, /^[A-Za-z0-9_-]{12}$/);
    assert.equal(created.tab, 'match');
    assert.equal(created.appUrl, `${BASE_URL}/share/match/${created.id}`);
    assert.equal(created.remoteUrl, `${BASE_URL}/#remote/cf/${created.id}/match`);

    const readResponse = await fetch(`${BASE_URL}/api/shares/${created.id}`);
    if (readResponse.status !== 200) {
      throw new Error(`read failed (${readResponse.status}): ${await readResponse.text()}`);
    }
    assert.equal(readResponse.headers.get('x-hexoboards-tab'), 'match');
    assert.equal(await readResponse.text(), payload);

    const metaResponse = await fetch(`${BASE_URL}/api/shares/${created.id}/meta`);
    if (metaResponse.status !== 200) {
      throw new Error(`meta failed (${metaResponse.status}): ${await metaResponse.text()}`);
    }
    const meta = await metaResponse.json();
    assert.equal(meta.id, created.id);
    assert.equal(meta.tab, 'match');
    assert.ok(meta.createdAt > 0);
    assert.ok(meta.updatedAt >= meta.createdAt);

    const redirectResponse = await fetch(created.appUrl, { redirect: 'manual' });
    assert.equal(redirectResponse.status, 302);
    assert.equal(redirectResponse.headers.get('location'), created.remoteUrl);

    const invalidResponse = await fetch(`${BASE_URL}/api/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: payload, tab: 'unknown' }),
    });
    assert.equal(invalidResponse.status, 400);

    console.log('\nshare smoke test passed');
  } finally {
    await stopDevServer(child);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
