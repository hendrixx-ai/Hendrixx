// ─────────────────────────────────────────────────────────────────────────────
// store.js — the state file.
//
// One JSON file (brand-os/data/state.json, gitignored). Everything the plan
// says you should own — offers, sales, leads, content status, funnel numbers,
// 90-day plan — lives here. No database, no dependencies.
//
// Writes are atomic (tmp file + rename) and validated by shape before save, so
// a crash mid-write cannot leave you with a corrupt business.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const fs = require('fs');
const path = require('path');
const { freshState, normalize } = require('./state');

const DATA_DIR = process.env.BRAND_OS_DATA_DIR
  ? path.resolve(process.env.BRAND_OS_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

function load(today) {
  ensureDir();
  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    raw = null;
  }
  const state = normalize(raw, today);
  if (!raw) save(state);
  return state;
}

function save(state) {
  ensureDir();
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, STATE_FILE);
  return state;
}

function update(today, mutator) {
  const state = load(today);
  const result = mutator(state);
  if (result === false) return { changed: false, state };
  save(state);
  return { changed: true, state };
}

function reset(today) {
  const state = freshState(today);
  save(state);
  return state;
}

module.exports = { DATA_DIR, STATE_FILE, freshState, load, save, update, reset, normalize };
