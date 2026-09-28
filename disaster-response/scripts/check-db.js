'use strict';

/**
 * Zero-dependency preflight: is MongoDB actually reachable?
 * Reads .env by hand — we cannot depend on `dotenv` because this runs BEFORE
 * `npm install`.
 */

const net = require('net');
const fs = require('fs');
const path = require('path');

function readEnv() {
  const p = path.resolve(process.cwd(), '.env');
  const env = { ...process.env };
  if (!fs.existsSync(p)) return env;
  for (const raw of fs.readFileSync(p, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!(k in env)) env[k] = v;
  }
  return env;
}

function parseUri(uri) {
  try {
    const u = new URL(uri.replace(/^mongodb\+srv:/, 'mongodb:'));
    return { host: u.hostname, port: Number(u.port) || 27017 };
  } catch {
    return null;
  }
}

const env = readEnv();
const uri = env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const parsed = parseUri(uri);

if (!parsed) {
  console.log('MONGODB_URI looks malformed. Skipping preflight.');
  process.exit(0);
}

const socket = net.connect({ host: parsed.host, port: parsed.port, timeout: 3000 });
socket.on('connect', () => {
  console.log(`MongoDB reachable at ${parsed.host}:${parsed.port}`);
  socket.end();
  process.exit(0);
});
socket.on('timeout', () => {
  console.error(`MongoDB unreachable at ${parsed.host}:${parsed.port} (timeout).`);
  console.error('  Start it with:  docker compose up -d mongo   or  mongod');
  socket.destroy();
  process.exit(1);
});
socket.on('error', (err) => {
  console.error(`MongoDB unreachable at ${parsed.host}:${parsed.port}: ${err.code || err.message}`);
  console.error('  Start it with:  docker compose up -d mongo   or  mongod');
  process.exit(1);
});
