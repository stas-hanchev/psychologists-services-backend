import { spawn } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import { describe, test, before, after } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { Psychologist } from '../src/models/psychologist.js';
import { Session } from '../src/models/session.js';
import { Favorite } from '../src/models/favorite.js';
import { User } from '../src/models/user.js';

const BACKEND_ROOT = path.resolve(import.meta.dirname, '..');
const PORT = 40000 + Math.floor(Math.random() * 10000);
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'password123';

const seed = [
  ['Dr. Anna', 4.5, 10], ['Dr. Boris', 4.5, 20], ['Dr. Clara', 4.5, 15],
  ['Dr. Denis', 4.9, 30], ['Dr. Eva', 3.8, 5], ['Dr. Fedir', 4.5, 25],
  ['Dr. Galyna', 4.2, 12],
].map(([name, rating, price]) => ({
  name,
  rating,
  price_per_hour: price,
  avatar_url: 'https://example.com/avatar.jpg',
  experience: '5 years',
  reviews: [{ reviewer: 'Reviewer', rating: 5, comment: 'Good' }],
  license: 'License',
  specialization: 'Specialization',
  initial_consultation: 'Free',
  about: 'About',
}));

let mongo;
let server;
let serverOutput = '';
let seeded = [];

const startServer = (mongoUrl) =>
  new Promise((resolve, reject) => {
    server = spawn(process.execPath, ['src/server.js'], {
      cwd: BACKEND_ROOT,
      env: {
        ...process.env,
        MONGO_URL: mongoUrl,
        PORT: String(PORT),
        NODE_ENV: 'production',
        TRUST_PROXY: '1',
        CORS_ORIGINS: ORIGIN,
        DNS_SERVERS: '',
      },
    });
    const timer = setTimeout(() => reject(new Error(`Server did not start:\n${serverOutput}`)), 30000);
    const onData = (data) => {
      serverOutput += data;
      if (serverOutput.includes('Server is running')) {
        clearTimeout(timer);
        resolve();
      }
    };
    server.stdout.on('data', onData);
    server.stderr.on('data', onData);
    server.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited with code ${code}:\n${serverOutput}`));
    });
  });

before(async () => {
  mongo = await MongoMemoryServer.create();
  const mongoUrl = mongo.getUri('psychologists_test');
  await mongoose.connect(mongoUrl);
  seeded = await Psychologist.insertMany(seed);
  await startServer(mongoUrl);
});

after(async () => {
  server?.removeAllListeners('exit');
  server?.kill();
  await mongoose.disconnect();
  await mongo?.stop();
});

let ipCounter = 1;
const nextIp = () => {
  const n = ipCounter++;
  return `10.0.${Math.floor(n / 250)}.${(n % 250) + 1}`;
};

class Client {
  constructor() {
    this.jar = {};
    this.ip = nextIp();
  }

  cookieHeader() {
    return Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async req(method, url, { body, headers = {}, rawCookie, rawBody } = {}) {
    const requestHeaders = { 'x-forwarded-for': this.ip, ...headers };
    const cookie = rawCookie ?? this.cookieHeader();
    if (cookie) requestHeaders.cookie = cookie;
    if (body !== undefined || rawBody !== undefined) requestHeaders['content-type'] = 'application/json';

    const res = await fetch(BASE + url, {
      method,
      headers: requestHeaders,
      body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });

    const setCookies = res.headers.getSetCookie();
    for (const setCookie of setCookies) {
      const [pair] = setCookie.split(';');
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (value === '' || /expires=Thu, 01 Jan 1970/i.test(setCookie)) delete this.jar[name];
      else this.jar[name] = value;
    }

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }
    return { status: res.status, body: json, headers: res.headers, setCookies };
  }
}

const newObjectId = () => new mongoose.Types.ObjectId().toString();
const uniqueEmail = () => `user${Date.now()}${Math.random().toString(36).slice(2, 7)}@test.com`;

const registerUser = async (client = new Client()) => {
  const email = uniqueEmail();
  const res = await client.req('POST', '/auth/register', { body: { name: 'Test User', email, password: PASSWORD } });
  assert.equal(res.status, 201);
  return { client, email, user: res.body };
};

describe('General', () => {
  test('GET / returns 200', async () => {
    const res = await new Client().req('GET', '/');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { message: 'Hello world!' });
  });

  test('unknown GET route returns 404 JSON, not 401', async () => {
    const res = await new Client().req('GET', '/does-not-exist');
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { message: 'Route not found' });
  });

  test('unknown POST route returns 404', async () => {
    assert.equal((await new Client().req('POST', '/nope', { body: {} })).status, 404);
  });

  test('helmet headers are present and X-Powered-By is absent', async () => {
    const res = await new Client().req('GET', '/');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.ok(res.headers.get('x-content-type-options'));
    assert.ok(res.headers.get('content-security-policy'));
  });

  test('CORS allows configured origin with credentials', async () => {
    const res = await new Client().req('GET', '/', { headers: { origin: ORIGIN } });
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
  });

  test('CORS does not allow a foreign origin', async () => {
    const res = await new Client().req('GET', '/', { headers: { origin: 'http://evil.com' } });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  test('malformed JSON body returns 400', async () => {
    assert.equal((await new Client().req('POST', '/auth/login', { rawBody: '{bad json' })).status, 400);
  });

  test('body over 10kb returns 413', async () => {
    const res = await new Client().req('POST', '/auth/login', { body: { email: 'a@b.com', password: 'x'.repeat(11000) } });
    assert.equal(res.status, 413);
  });
});

describe('GET /psychologists', () => {
  test('default pagination returns page 1, perPage 3 and totals', async () => {
    const res = await new Client().req('GET', '/psychologists');
    assert.equal(res.status, 200);
    assert.equal(res.body.page, 1);
    assert.equal(res.body.perPage, 3);
    assert.equal(res.body.totalItems, 7);
    assert.equal(res.body.totalPages, 3);
    assert.equal(res.body.psychologists.length, 3);
  });

  test('last page contains the remainder', async () => {
    const res = await new Client().req('GET', '/psychologists?page=3');
    assert.equal(res.status, 200);
    assert.equal(res.body.psychologists.length, 1);
  });

  test('page beyond total returns an empty list', async () => {
    const res = await new Client().req('GET', '/psychologists?page=10');
    assert.equal(res.status, 200);
    assert.equal(res.body.psychologists.length, 0);
  });

  test('perPage=5 is applied', async () => {
    const res = await new Client().req('GET', '/psychologists?perPage=5');
    assert.equal(res.body.psychologists.length, 5);
    assert.equal(res.body.totalPages, 2);
  });

  test('sorts by name asc and desc', async () => {
    const client = new Client();
    const asc = (await client.req('GET', '/psychologists?sortBy=name&sortOrder=asc&perPage=20')).body.psychologists.map((p) => p.name);
    const desc = (await client.req('GET', '/psychologists?sortBy=name&sortOrder=desc&perPage=20')).body.psychologists.map((p) => p.name);
    assert.deepEqual(asc, [...asc].sort());
    assert.deepEqual(desc, [...asc].reverse());
  });

  test('sorts by price_per_hour asc', async () => {
    const res = await new Client().req('GET', '/psychologists?sortBy=price_per_hour&perPage=20');
    const prices = res.body.psychologists.map((p) => p.price_per_hour);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  });

  test('sorts by rating desc', async () => {
    const res = await new Client().req('GET', '/psychologists?sortBy=rating&sortOrder=desc&perPage=20');
    const ratings = res.body.psychologists.map((p) => p.rating);
    assert.deepEqual(ratings, [...ratings].sort((a, b) => b - a));
  });

  test('pagination with tied ratings has no duplicates or gaps', async () => {
    for (const order of ['asc', 'desc']) {
      const client = new Client();
      const ids = [];
      for (let page = 1; page <= 3; page++) {
        const res = await client.req('GET', `/psychologists?sortBy=rating&sortOrder=${order}&page=${page}`);
        ids.push(...res.body.psychologists.map((p) => p._id));
      }
      assert.equal(ids.length, 7);
      assert.equal(new Set(ids).size, 7, `duplicates with sortOrder=${order}`);
    }
  });

  const invalidQueries = [
    ['page=0', 'page 0'],
    ['page=-1', 'negative page'],
    ['page=abc', 'non-numeric page'],
    ['page=1.5', 'fractional page'],
    ['perPage=2', 'perPage below min'],
    ['perPage=21', 'perPage above max'],
    ['sortBy=password', 'invalid sortBy'],
    ['sortOrder=up', 'invalid sortOrder'],
    ['foo=bar', 'unknown query param'],
    ['sortBy[$ne]=x', 'operator injection in query'],
  ];
  for (const [query, description] of invalidQueries) {
    test(`returns 400 for ${description}`, async () => {
      const res = await new Client().req('GET', `/psychologists?${query}`);
      assert.equal(res.status, 400, JSON.stringify(res.body));
    });
  }
});

describe('GET /psychologists/:psychologistId', () => {
  test('existing id returns 200 with the full document', async () => {
    const res = await new Client().req('GET', `/psychologists/${seeded[0]._id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Dr. Anna');
    assert.equal(res.body.reviews.length, 1);
  });

  test('valid but non-existing id returns 404', async () => {
    const res = await new Client().req('GET', `/psychologists/${newObjectId()}`);
    assert.equal(res.status, 404);
    assert.equal(res.body.message, 'Psychologist not found');
  });

  test('invalid id returns 400', async () => {
    assert.equal((await new Client().req('GET', '/psychologists/abc')).status, 400);
  });
});

describe('POST /auth/register', () => {
  test('returns 201, user without password and 3 secure httpOnly cookies', async () => {
    const client = new Client();
    const email = uniqueEmail();
    const res = await client.req('POST', '/auth/register', { body: { name: '  Ivan  ', email, password: PASSWORD } });
    assert.equal(res.status, 201);
    assert.equal(res.body.password, undefined);
    assert.equal(res.body.email, email);
    assert.equal(res.body.name, 'Ivan');

    const cookieNames = res.setCookies.map((c) => c.split('=')[0]).sort();
    assert.deepEqual(cookieNames, ['accessToken', 'refreshToken', 'sessionId']);
    for (const setCookie of res.setCookies) {
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /Secure/i);
      assert.match(setCookie, /SameSite=Lax/i);
      assert.match(setCookie, /Path=\//);
    }

    const dbUser = await User.findOne({ email });
    assert.ok(dbUser.password.startsWith('$2b$12$'));
  });

  test('normalizes email to lowercase and trims it', async () => {
    const email = uniqueEmail();
    const res = await new Client().req('POST', '/auth/register', { body: { name: 'Ivan', email: `  ${email.toUpperCase()} `, password: PASSWORD } });
    assert.equal(res.status, 201);
    assert.equal(res.body.email, email);
  });

  test('duplicate email returns 409', async () => {
    const { email } = await registerUser();
    const res = await new Client().req('POST', '/auth/register', { body: { name: 'Ivan', email, password: PASSWORD } });
    assert.equal(res.status, 409);
    assert.equal(res.body.message, 'Email in use');
  });

  test('duplicate email in different case returns 409', async () => {
    const { email } = await registerUser();
    const res = await new Client().req('POST', '/auth/register', { body: { name: 'Ivan', email: email.toUpperCase(), password: PASSWORD } });
    assert.equal(res.status, 409);
  });

  test('concurrent duplicate registration returns 201 and 409, never 500', async () => {
    const email = uniqueEmail();
    const body = { name: 'Race', email, password: PASSWORD };
    const responses = await Promise.all([
      new Client().req('POST', '/auth/register', { body }),
      new Client().req('POST', '/auth/register', { body }),
    ]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await User.countDocuments({ email }), 1);
  });

  const invalidBodies = [
    [{ email: 'a@b.com', password: PASSWORD }, 'missing name'],
    [{ name: 'A', email: 'a@b.com', password: PASSWORD }, 'name too short'],
    [{ name: 'A'.repeat(31), email: 'a@b.com', password: PASSWORD }, 'name too long'],
    [{ name: 'Ivan', email: 'not-an-email', password: PASSWORD }, 'invalid email'],
    [{ name: 'Ivan', email: 'a@b.com', password: 'short' }, 'password too short'],
    [{ name: 'Ivan', email: 'a@b.com', password: 'x'.repeat(73) }, 'password too long'],
    [{ name: 'Ivan', email: 'a@b.com', password: PASSWORD, role: 'admin' }, 'unknown field'],
    [{ name: 'Ivan', email: { $gt: '' }, password: PASSWORD }, 'operator object as email'],
  ];
  for (const [body, description] of invalidBodies) {
    test(`returns 400 for ${description}`, async () => {
      assert.equal((await new Client().req('POST', '/auth/register', { body })).status, 400);
    });
  }

  test('returns 400, not 500, when the body is missing', async () => {
    assert.equal((await new Client().req('POST', '/auth/register')).status, 400);
    assert.equal((await new Client().req('POST', '/auth/login')).status, 400);
  });
});

describe('POST /auth/login', () => {
  test('returns 200, user without password and sets cookies', async () => {
    const { email } = await registerUser();
    const client = new Client();
    const res = await client.req('POST', '/auth/login', { body: { email, password: PASSWORD } });
    assert.equal(res.status, 200);
    assert.equal(res.body.email, email);
    assert.equal(res.body.password, undefined);
    assert.ok(client.jar.accessToken && client.jar.refreshToken && client.jar.sessionId);
  });

  test('email is case-insensitive', async () => {
    const { email } = await registerUser();
    const res = await new Client().req('POST', '/auth/login', { body: { email: email.toUpperCase(), password: PASSWORD } });
    assert.equal(res.status, 200);
  });

  test('wrong password returns 401 Invalid credentials', async () => {
    const { email } = await registerUser();
    const res = await new Client().req('POST', '/auth/login', { body: { email, password: 'wrongpass1' } });
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid credentials');
  });

  test('unknown email returns the same 401 message', async () => {
    const res = await new Client().req('POST', '/auth/login', { body: { email: uniqueEmail(), password: PASSWORD } });
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid credentials');
  });

  test('NoSQL injection in body returns 400', async () => {
    const res = await new Client().req('POST', '/auth/login', { body: { email: { $ne: null }, password: { $ne: null } } });
    assert.equal(res.status, 400);
  });

  test('each login creates a separate session', async () => {
    const { email, user } = await registerUser();
    await new Client().req('POST', '/auth/login', { body: { email, password: PASSWORD } });
    assert.equal(await Session.countDocuments({ userId: user._id }), 2);
  });
});

describe('GET /auth/me', () => {
  test('valid cookies return the user without password', async () => {
    const { client, email } = await registerUser();
    const res = await client.req('GET', '/auth/me');
    assert.equal(res.status, 200);
    assert.equal(res.body.email, email);
    assert.equal(res.body.password, undefined);
  });

  test('no cookies returns 401', async () => {
    const res = await new Client().req('GET', '/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Missing session credentials');
  });

  test('wrong access token returns 401', async () => {
    const { client } = await registerUser();
    client.jar.accessToken = 'f'.repeat(64);
    assert.equal((await client.req('GET', '/auth/me')).status, 401);
  });

  test('invalid sessionId returns 401, not 500', async () => {
    const { client } = await registerUser();
    client.jar.sessionId = 'not-an-objectid';
    assert.equal((await client.req('GET', '/auth/me')).status, 401);
  });

  test('JSON cookie injection returns 401', async () => {
    const injected = encodeURIComponent('j:{"$ne":null}');
    const res = await new Client().req('GET', '/auth/me', { rawCookie: `sessionId=${injected}; accessToken=${injected}` });
    assert.equal(res.status, 401);
  });

  test('access token from another session is rejected', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const rawCookie = `sessionId=${a.client.jar.sessionId}; accessToken=${b.client.jar.accessToken}`;
    assert.equal((await new Client().req('GET', '/auth/me', { rawCookie })).status, 401);
  });

  test('expired access token returns 401', async () => {
    const { client } = await registerUser();
    await Session.updateOne({ _id: client.jar.sessionId }, { accessTokenValidUntil: new Date(Date.now() - 1000) });
    const res = await client.req('GET', '/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Session expired');
  });

  test('deleted user returns 401 User not found', async () => {
    const { client, user } = await registerUser();
    await User.deleteOne({ _id: user._id });
    const res = await client.req('GET', '/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'User not found');
  });
});

describe('Session and refresh', () => {
  test('GET /auth/session with valid access token returns 200 without rotation', async () => {
    const { client } = await registerUser();
    const sessionBefore = client.jar.sessionId;
    const res = await client.req('GET', '/auth/session');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true });
    assert.equal(res.setCookies.length, 0);
    assert.equal(client.jar.sessionId, sessionBefore);
  });

  test('GET /auth/session with only refresh cookies rotates the session', async () => {
    const { client } = await registerUser();
    const oldSessionId = client.jar.sessionId;
    delete client.jar.accessToken;
    const res = await client.req('GET', '/auth/session');
    assert.equal(res.status, 200);
    assert.notEqual(client.jar.sessionId, oldSessionId);
    assert.ok(client.jar.accessToken);
    assert.equal(await Session.countDocuments({ _id: oldSessionId }), 0);
    assert.equal((await client.req('GET', '/auth/me')).status, 200);
  });

  test('GET /auth/session with expired access token rotates the session', async () => {
    const { client } = await registerUser();
    const oldSessionId = client.jar.sessionId;
    await Session.updateOne({ _id: oldSessionId }, { accessTokenValidUntil: new Date(Date.now() - 1000) });
    const res = await client.req('GET', '/auth/session');
    assert.equal(res.status, 200);
    assert.notEqual(client.jar.sessionId, oldSessionId);
  });

  test('GET /auth/session without cookies returns 401 and clears cookies', async () => {
    const res = await new Client().req('GET', '/auth/session');
    assert.equal(res.status, 401);
    assert.equal(res.setCookies.length, 3);
  });

  test('POST /auth/refresh rotates all tokens', async () => {
    const { client } = await registerUser();
    const old = { ...client.jar };
    const res = await client.req('POST', '/auth/refresh');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { message: 'Session refreshed' });
    for (const key of ['sessionId', 'accessToken', 'refreshToken']) {
      assert.notEqual(client.jar[key], old[key]);
    }
  });

  test('old access token stops working after refresh', async () => {
    const { client } = await registerUser();
    const old = { ...client.jar };
    await client.req('POST', '/auth/refresh');
    const rawCookie = `sessionId=${old.sessionId}; accessToken=${old.accessToken}`;
    assert.equal((await new Client().req('GET', '/auth/me', { rawCookie })).status, 401);
  });

  test('refresh token reuse is rejected', async () => {
    const { client } = await registerUser();
    const old = { ...client.jar };
    assert.equal((await client.req('POST', '/auth/refresh')).status, 200);
    const rawCookie = `sessionId=${old.sessionId}; refreshToken=${old.refreshToken}`;
    assert.equal((await new Client().req('POST', '/auth/refresh', { rawCookie })).status, 401);
  });

  test('concurrent refresh with the same token succeeds exactly once', async () => {
    const { client } = await registerUser();
    const rawCookie = client.cookieHeader();
    const responses = await Promise.all([
      new Client().req('POST', '/auth/refresh', { rawCookie }),
      new Client().req('POST', '/auth/refresh', { rawCookie }),
    ]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 401]);
  });

  test('expired refresh token returns 401', async () => {
    const { client } = await registerUser();
    await Session.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(client.jar.sessionId) },
      { $set: { refreshTokenValidUntil: new Date(Date.now() - 1000) } },
    );
    const res = await client.req('POST', '/auth/refresh');
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Session expired');
  });

  test('refresh without cookies returns 401', async () => {
    assert.equal((await new Client().req('POST', '/auth/refresh')).status, 401);
  });

  test('TTL index exists on refreshTokenValidUntil', async () => {
    const indexes = await Session.collection.indexes();
    assert.ok(indexes.some((i) => i.key.refreshTokenValidUntil === 1 && i.expireAfterSeconds === 0));
  });
});

describe('Favorites', () => {
  test('requires authentication for GET, POST and DELETE', async () => {
    const client = new Client();
    assert.equal((await client.req('GET', '/favorites')).status, 401);
    assert.equal((await client.req('POST', `/favorites/${seeded[0]._id}`)).status, 401);
    assert.equal((await client.req('DELETE', `/favorites/${seeded[0]._id}`)).status, 401);
  });

  test('new user has an empty list', async () => {
    const { client } = await registerUser();
    const res = await client.req('GET', '/favorites');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  test('add, idempotent add, populated list, remove, empty list', async () => {
    const { client } = await registerUser();
    const id = seeded[1]._id.toString();

    assert.equal((await client.req('POST', `/favorites/${id}`)).status, 201);
    assert.equal((await client.req('POST', `/favorites/${id}`)).status, 201);

    let res = await client.req('GET', '/favorites');
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0]._id, id);
    assert.equal(res.body[0].name, 'Dr. Boris');

    assert.equal((await client.req('DELETE', `/favorites/${id}`)).status, 204);
    res = await client.req('GET', '/favorites');
    assert.deepEqual(res.body, []);
    assert.equal((await client.req('DELETE', `/favorites/${id}`)).status, 204);
  });

  test('concurrent duplicate add creates a single record', async () => {
    const { client, user } = await registerUser();
    const id = seeded[2]._id.toString();
    const responses = await Promise.all([
      client.req('POST', `/favorites/${id}`),
      client.req('POST', `/favorites/${id}`),
      client.req('POST', `/favorites/${id}`),
    ]);
    assert.deepEqual(responses.map((r) => r.status), [201, 201, 201]);
    assert.equal(await Favorite.countDocuments({ userId: user._id }), 1);
  });

  test('favorites are isolated between users', async () => {
    const a = await registerUser();
    const b = await registerUser();
    await a.client.req('POST', `/favorites/${seeded[3]._id}`);
    assert.deepEqual((await b.client.req('GET', '/favorites')).body, []);
    await b.client.req('DELETE', `/favorites/${seeded[3]._id}`);
    assert.equal((await a.client.req('GET', '/favorites')).body.length, 1);
  });

  test('adding a non-existing psychologist returns 404', async () => {
    const { client } = await registerUser();
    assert.equal((await client.req('POST', `/favorites/${newObjectId()}`)).status, 404);
  });

  test('invalid id returns 400 for POST and DELETE', async () => {
    const { client } = await registerUser();
    assert.equal((await client.req('POST', '/favorites/abc')).status, 400);
    assert.equal((await client.req('DELETE', '/favorites/abc')).status, 400);
  });

  test('deleted psychologist is filtered out of the list', async () => {
    const { client } = await registerUser();
    const temp = await Psychologist.create({ ...seed[0], name: 'Temp' });
    await client.req('POST', `/favorites/${temp._id}`);
    await client.req('POST', `/favorites/${seeded[4]._id}`);
    await Psychologist.deleteOne({ _id: temp._id });
    const res = await client.req('GET', '/favorites');
    assert.equal(res.body.length, 1);
    assert.ok(!res.body.includes(null));
  });
});

describe('POST /auth/logout', () => {
  test('returns 204, clears cookies, deletes session and invalidates old cookies', async () => {
    const { client } = await registerUser();
    const oldCookies = client.cookieHeader();
    const sessionId = client.jar.sessionId;
    const res = await client.req('POST', '/auth/logout');
    assert.equal(res.status, 204);
    assert.equal(res.setCookies.length, 3);
    assert.equal(await Session.countDocuments({ _id: sessionId }), 0);
    assert.equal((await new Client().req('GET', '/auth/me', { rawCookie: oldCookies })).status, 401);
    assert.equal((await new Client().req('POST', '/auth/refresh', { rawCookie: oldCookies })).status, 401);
  });

  test('without cookies returns 204', async () => {
    assert.equal((await new Client().req('POST', '/auth/logout')).status, 204);
  });

  test('logging out one device keeps other sessions', async () => {
    const { client, email } = await registerUser();
    const other = new Client();
    await other.req('POST', '/auth/login', { body: { email, password: PASSWORD } });
    await client.req('POST', '/auth/logout');
    assert.equal((await other.req('GET', '/auth/me')).status, 200);
  });
});

describe('Rate limiting', () => {
  test('auth limiter returns 429 on the 21st request from one IP', async () => {
    const client = new Client();
    const statuses = [];
    for (let i = 0; i < 21; i++) {
      const res = await client.req('POST', '/auth/login', { body: { email: 'nobody@test.com', password: PASSWORD } });
      statuses.push(res.status);
    }
    assert.ok(statuses.slice(0, 20).every((s) => s === 401), statuses.join(','));
    assert.equal(statuses[20], 429);
  });

  test('auth limiter is per IP', async () => {
    const res = await new Client().req('POST', '/auth/login', { body: { email: 'nobody@test.com', password: PASSWORD } });
    assert.equal(res.status, 401);
  });

  test('API limiter returns 429 on the 501st request from one IP', async () => {
    const client = new Client();
    for (let i = 0; i < 500; i++) {
      assert.equal((await client.req('GET', '/')).status, 200, `request ${i + 1}`);
    }
    const res = await client.req('GET', '/');
    assert.equal(res.status, 429);
    assert.ok(res.headers.get('ratelimit-policy') || res.headers.get('ratelimit'));
  });
});

describe('Server health', () => {
  test('no 5xx responses or unhandled errors in server output', () => {
    assert.ok(!/"statusCode":5\d\d/.test(serverOutput), 'found 5xx in server logs');
    assert.ok(!/Unhandled/i.test(serverOutput));
    assert.equal(server.exitCode, null, 'server process died');
  });

  test('indexes are synced', async () => {
    const userIndexes = await User.collection.indexes();
    assert.ok(userIndexes.some((i) => i.key.email === 1 && i.unique));

    const favoriteIndexes = await Favorite.collection.indexes();
    assert.ok(favoriteIndexes.some((i) => i.key.userId === 1 && i.key.psychologistId === 1 && i.unique));

    const psychologistIndexes = await Psychologist.collection.indexes();
    for (const key of ['name', 'rating', 'price_per_hour']) {
      assert.ok(psychologistIndexes.some((i) => i.key[key] === 1 && i.key._id === 1), key);
    }
  });
});
