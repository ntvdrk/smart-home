// Простое файловое хранилище (JSON). Для MVP этого достаточно.
// Для продакшена/масштабирования заменяется на PostgreSQL без изменения API-контракта.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedData } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let db;

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db = seedData();
    persist();
    console.log('[db] инициализирована тестовыми данными:', DB_FILE);
  }
}

function persist() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

load();

export const store = {
  get data() { return db; },
  save: persist,
  nextId(name) { db.counters[name] = (db.counters[name] || 0) + 1; persist(); return db.counters[name]; },
};
