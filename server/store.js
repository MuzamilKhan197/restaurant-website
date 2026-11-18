import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { restaurant, dishes } from '../data.js';

export const digest = value => createHash('sha256').update(String(value)).digest('hex');
export const makeToken = () => randomBytes(32).toString('hex');
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function passwordMatches(password, encoded) {
  if (typeof password !== 'string' || password.length > 200 || !encoded) return false;
  const [salt, hash] = encoded.split(':');
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

export class Store {
  constructor(filename, { adminPassword = '', adminEmail = 'admin@restaurant.local' } = {}) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS menu (id TEXT PRIMARY KEY, document TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL,
        token_hash TEXT NOT NULL, document TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS records_kind ON records(kind, created_at);
      CREATE TABLE IF NOT EXISTS requests (key TEXT PRIMARY KEY, hash TEXT NOT NULL, response TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, action TEXT NOT NULL, target TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    `);
    this.transaction(() => {
      if (!this.getMeta('initialized')) {
        this.setMeta('settings', restaurant);
        for (const dish of dishes) this.saveDish({ ...dish, available: true, active: true, version: 1 });
        this.setMeta('initialized', true);
        this.setMeta('settingsVersion', 1);
      }
      if (!this.getMeta('adminPassword') && adminPassword.length >= 12) {
        this.setMeta('adminPassword', hashPassword(adminPassword));
        this.setMeta('adminEmail', adminEmail.toLowerCase());
      }
    });
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); this.db.exec('COMMIT'); return value; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  getMeta(key) { const row = this.db.prepare('SELECT value FROM meta WHERE key=?').get(key); return row ? JSON.parse(row.value) : null; }
  setMeta(key, value) { this.db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value)); }
  get settings() { return this.getMeta('settings'); }
  getMenu(includeInactive = false) {
    return this.db.prepare('SELECT document FROM menu ORDER BY rowid').all().map(row => JSON.parse(row.document)).filter(dish => includeInactive || dish.active);
  }
  saveDish(dish) { this.db.prepare('INSERT INTO menu(id,document) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document').run(dish.id, JSON.stringify(dish)); }
  list(kind, limit = 200) { return this.db.prepare('SELECT document FROM records WHERE kind=? ORDER BY created_at DESC LIMIT ?').all(kind, limit).map(row => JSON.parse(row.document)); }
  all(kind) { return this.db.prepare('SELECT document FROM records WHERE kind=?').all(kind).map(row => JSON.parse(row.document)); }
  getRecord(id, kind) {
    const row = this.db.prepare('SELECT * FROM records WHERE id=? AND kind=?').get(id, kind);
    return row ? { ...JSON.parse(row.document), tokenHash: row.token_hash } : null;
  }
  insertRecord(kind, document, token) {
    this.db.prepare('INSERT INTO records(id,kind,status,token_hash,document,created_at) VALUES(?,?,?,?,?,?)').run(document.id, kind, document.status, digest(token), JSON.stringify(document), document.createdAt);
  }
  saveRecord(kind, record) {
    const { tokenHash, ...document } = record;
    this.db.prepare('UPDATE records SET status=?,document=? WHERE id=? AND kind=?').run(document.status, JSON.stringify(document), document.id, kind);
  }
  audit(action, target) { this.db.prepare('INSERT INTO audit(action,target,created_at) VALUES(?,?,?)').run(action, target, new Date().toISOString()); }
  idempotent(key, body, fn) {
    if (typeof key !== 'string' || !/^[a-zA-Z0-9-]{16,100}$/.test(key)) throw Object.assign(new Error('A valid request key is required. Please refresh and try again.'), { status: 400 });
    return this.transaction(() => {
      const hash = digest(JSON.stringify(body));
      const previous = this.db.prepare('SELECT * FROM requests WHERE key=?').get(key);
      if (previous) {
        if (previous.hash !== hash) throw Object.assign(new Error('This request key was already used. Please try again.'), { status: 409 });
        return JSON.parse(previous.response);
      }
      const result = fn();
      this.db.prepare('INSERT INTO requests(key,hash,response,created_at) VALUES(?,?,?,?)').run(key, hash, JSON.stringify(result), Date.now());
      return result;
    });
  }
  rateLimit(key, max, milliseconds) {
    const now = Date.now();
    this.db.prepare('DELETE FROM limits WHERE expires<?').run(now);
    const previous = this.db.prepare('SELECT * FROM limits WHERE key=?').get(key);
    if (previous && previous.count >= max) return false;
    this.db.prepare('INSERT INTO limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key, now + milliseconds);
    return true;
  }
  createSession() {
    const token = makeToken();
    this.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
    this.db.prepare('INSERT INTO sessions(hash,expires) VALUES(?,?)').run(digest(token), Date.now() + 8 * 60 * 60 * 1000);
    return token;
  }
  validSession(token) { return Boolean(token && this.db.prepare('SELECT 1 FROM sessions WHERE hash=? AND expires>?').get(digest(token), Date.now())); }
  deleteSession(token) { this.db.prepare('DELETE FROM sessions WHERE hash=?').run(digest(token || '')); }
  close() { this.db.close(); }
}
