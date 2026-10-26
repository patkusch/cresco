import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { getJSON, getText } from '../server/collectors/http.ts';

let server: Server;
let base = '';
let lastHeaders: Record<string, string | string[] | undefined> = {};

before(async () => {
  server = createServer((req, res) => {
    lastHeaders = req.headers;
    if (req.url === '/json') return void res.writeHead(200, { 'content-type': 'application/json' }).end('{"n":1}');
    if (req.url === '/bad-json') return void res.writeHead(200).end('not json');
    if (req.url === '/text') return void res.writeHead(200).end('a,b\n1,2\n');
    if (req.url === '/slow') return void setTimeout(() => res.writeHead(200).end('{}'), 1000);
    res.writeHead(404).end('nope');
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server.closeAllConnections?.() ?? server.close());

test('getJSON returns the parsed body on success', async () => {
  assert.deepEqual(await getJSON(`${base}/json`), { n: 1 });
});

test('getJSON gives null instead of throwing for a 404, a bad body, a refused connection and a timeout', async () => {
  assert.equal(await getJSON(`${base}/missing`), null);
  assert.equal(await getJSON(`${base}/bad-json`), null);
  assert.equal(await getJSON('http://127.0.0.1:1/x', { timeoutMs: 500 }), null);
  assert.equal(await getJSON(`${base}/slow`, { timeoutMs: 100 }), null);
});

test('getJSON asks for JSON, names itself, and lets the caller add headers', async () => {
  await getJSON(`${base}/json`, { headers: { 'x-test': 'yes' } });
  assert.equal(lastHeaders.accept, 'application/json');
  assert.match(String(lastHeaders['user-agent']), /cresco/);
  assert.equal(lastHeaders['x-test'], 'yes');
});

test('getText returns the body as text, and null for a 404', async () => {
  assert.equal(await getText(`${base}/text`), 'a,b\n1,2\n');
  assert.equal(await getText(`${base}/missing`), null);
});

test('a caller can override the default user agent', async () => {
  await getText(`${base}/text`, { headers: { 'user-agent': 'custom/9' } });
  assert.equal(lastHeaders['user-agent'], 'custom/9');
});
