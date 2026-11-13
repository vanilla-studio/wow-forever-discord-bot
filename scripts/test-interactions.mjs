// Local end-to-end test for the /interactions endpoint. Generates an Ed25519
// keypair, prints the public key (to be set as DISCORD_APP_PUBLIC_KEY on the
// dev server), and sends signed PING + command payloads just like Discord does.
//
// Usage:
//   1. node scripts/test-interactions.mjs --genkey   -> prints PUBLIC_KEY=...
//   2. start `wrangler dev` with that DISCORD_APP_PUBLIC_KEY
//   3. node scripts/test-interactions.mjs <privateKeyHex>  -> runs the suite

import { webcrypto } from 'node:crypto';

const { subtle } = webcrypto;

function toHex(buf) {
  return Buffer.from(buf).toString('hex');
}
function fromHex(hex) {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

async function genKey() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await subtle.exportKey('raw', kp.publicKey);
  const priv = await subtle.exportKey('pkcs8', kp.privateKey);
  console.log(`PUBLIC_KEY=${toHex(pub)}`);
  console.log(`PRIVATE_KEY=${toHex(priv)}`);
}

async function sign(privPkcs8Hex, message) {
  const key = await subtle.importKey('pkcs8', fromHex(privPkcs8Hex), { name: 'Ed25519' }, false, [
    'sign',
  ]);
  const sig = await subtle.sign({ name: 'Ed25519' }, key, new TextEncoder().encode(message));
  return toHex(sig);
}

async function send(privHex, payload) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify(payload);
  const signature = await sign(privHex, timestamp + body);
  const res = await fetch('http://localhost:8787/interactions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-signature-ed25519': signature,
      'x-signature-timestamp': timestamp,
    },
    body,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const member = (id, admin) => ({
  user: { id, username: `user${id}` },
  permissions: admin ? '8' : '0',
});
// Builds a /wow-forever <sub> interaction. type 1 = SUB_COMMAND, 3 = STRING.
const cmd = (sub, character, m) => ({
  type: 2,
  guild_id: 'test-guild',
  member: m,
  data: {
    name: 'wow-forever',
    options: [
      {
        name: sub,
        type: 1,
        options: character ? [{ name: 'character', type: 3, value: character }] : [],
      },
    ],
  },
});

async function main() {
  const arg = process.argv[2];
  if (arg === '--genkey') {
    await genKey();
    return;
  }
  if (!arg) {
    console.error('Pass the private key hex, or --genkey.');
    process.exit(1);
  }
  const priv = arg;
  const log = (label, r) => console.log(`${label}: HTTP ${r.status} ->`, JSON.stringify(r.json));

  // 1. PING handshake
  log('PING', await send(priv, { type: 1 }));

  // 2. /follow by a normal user (allowed)
  log('follow (user A)', await send(priv, cmd('follow', 'raekwon-rosebrook', member('A', false))));

  // 3. /follow invalid slug
  log('follow invalid', await send(priv, cmd('follow', 'notaslug!!', member('A', false))));

  // 4. /list by non-admin (denied)
  log('list (non-admin)', await send(priv, cmd('list', null, member('A', false))));

  // 5. /list by admin (allowed)
  log('list (admin)', await send(priv, cmd('list', null, member('Z', true))));

  // 6. /unfollow by a different non-owner non-admin (denied)
  log(
    'unfollow (stranger)',
    await send(priv, cmd('unfollow', 'raekwon-rosebrook', member('B', false))),
  );

  // 7. /unfollow by owner (allowed)
  log(
    'unfollow (owner A)',
    await send(priv, cmd('unfollow', 'raekwon-rosebrook', member('A', false))),
  );

  // 8. bad signature (tampered) should 401
  const ts = String(Math.floor(Date.now() / 1000));
  const bad = await fetch('http://localhost:8787/interactions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-signature-ed25519': '00'.repeat(64),
      'x-signature-timestamp': ts,
    },
    body: JSON.stringify({ type: 1 }),
  });
  console.log(`bad signature: HTTP ${bad.status} (expected 401)`);
}

main();
