// ─────────────────────────────────────────────────────────────────────────────
// Hendrixx Console — frontend logic. No framework, no build step.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = { data: null, mode: 'demo', inputs: {}, currentFile: null };

// ── api ──────────────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.error || `${res.status} ${res.statusText}`);
  return json;
}

// ── tiny markdown renderer (headings, tables, lists, quotes, bold, code) ─────
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$)/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
function renderMarkdown(md) {
  const lines = String(md ?? '').split('\n');
  const out = [];
  let i = 0, listType = null, inQuote = false;

  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };
  const closeQuote = () => { if (inQuote) { out.push('</blockquote>'); inQuote = false; } };

  while (i < lines.length) {
    const line = lines[i];

    // tables
    if (line.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      closeList(); closeQuote();
      const head = line.split('|').slice(1, -1).map(c => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim()));
        i++;
      }
      out.push('<table><thead><tr>' + head.map(h => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>'
        + rows.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
      continue;
    }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { closeList(); closeQuote(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) { closeList(); closeQuote(); out.push('<hr>'); i++; continue; }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      closeList();
      if (!inQuote) { out.push('<blockquote>'); inQuote = true; }
      out.push(quote[1].trim() ? `<p>${inline(quote[1])}</p>` : '');
      i++; continue;
    }
    closeQuote();

    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (ul || ol) {
      const want = ul ? 'ul' : 'ol';
      if (listType !== want) { closeList(); out.push(`<${want}>`); listType = want; }
      out.push(`<li>${inline((ul || ol)[2] ?? (ul || ol)[1])}</li>`);
      i++; continue;
    }
    closeList();

    if (!line.trim()) { i++; continue; }
    out.push(`<p>${inline(line)}</p>`);
    i++;
  }
  closeList(); closeQuote();
  return out.join('\n');
}

// ── boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  startClock();
  wireTabs();
  wireStaticHandlers();
  await refresh();
  await loadInputs();
}

function startClock() {
  const el = $('#clock');
  const tick = () => {
    el.textContent = new Intl.DateTimeFormat('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit',
      minute: '2-digit', timeZone: 'Africa/Dar_es_Salaam',
    }).format(new Date()) + ' EAT';
  };
  tick(); setInterval(tick, 30000);
}

function wireTabs() {
  $('#tabs').addEventListener('click', e => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    $$('#tabs button').forEach(b => b.classList.toggle('active', b === btn));
    $$('.tab').forEach(t => t.classList.toggle('active', t.id === `tab-${btn.dataset.tab}`));
  });
}

function wireStaticHandlers() {
  $('#checklistLink').addEventListener('click', e => { e.preventDefault(); $('#checklistModal').classList.remove('hidden'); });
  $('#closeModalBtn').addEventListener('click', () => $('#checklistModal').classList.add('hidden'));
  $('#checklistModal').addEventListener('click', e => { if (e.target.id === 'checklistModal') $('#checklistModal').classList.add('hidden'); });

  $('#addProspectBtn').addEventListener('click', () => $('#prospectForm').classList.toggle('hidden'));
  $('#prospectForm').addEventListener('submit', onAddProspect);

  $('#queueForm').addEventListener('submit', onAddQueueTopic);

  $('#modeSwitch').addEventListener('click', e => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    state.mode = btn.dataset.mode;
    $$('#modeSwitch button').forEach(b => b.classList.toggle('active', b === btn));
    renderModeNote();
    renderSteps();
  });

  $('#runRoutineBtn').addEventListener('click', () => runRoutine());

  $('#refreshFileBtn').addEventListener('click', () => state.currentFile && loadFile(state.currentFile));

  $('#fileList').addEventListener('click', e => {
    const btn = e.target.closest('button[data-file]');
    if (!btn) return;
    loadFile(btn.dataset.file);
  });
}

// ── data refresh ─────────────────────────────────────────────────────────────
async function refresh() {
  state.data = await api('/api/state');
  renderDashboard();
  renderPipeline();
  renderApprovals();
  renderFiles();
  $('#newProspectStage').innerHTML = state.data.stages
    .map(s => `<option value="${s.key}">${s.label}</option>`).join('');
}

async function loadInputs() {
  try {
    state.inputs = await api('/api/input');
    renderSteps();
    renderModeNote();
  } catch { /* inputs stay empty */ }
}

// ── dashboard ────────────────────────────────────────────────────────────────
function renderDashboard() {
  const d = state.data;
  const followDue = d.followUpsDue;
  const cards = [
    { num: d.prospects.length, lbl: 'Prospects tracked', cls: 'good' },
    { num: d.approvals.awaiting.length, lbl: 'Awaiting my approval', cls: d.approvals.awaiting.length ? 'danger' : '' },
    { num: d.overdueProspects.length, lbl: 'Stage timebox exceeded', cls: d.overdueProspects.length ? 'hot' : '' },
    { num: followDue, lbl: 'Follow-ups due', cls: followDue ? 'hot' : '' },
    { num: d.queue.pending.length, lbl: 'Research topics queued', cls: '' },
  ];
  $('#metricCards').innerHTML = cards.map(c =>
    `<div class="card ${c.cls}"><div class="num">${c.num}</div><div class="lbl">${c.lbl}</div></div>`).join('');

  // kanban
  const k = d.stages.map(s => {
    const chips = d.prospects.filter(p => p.stage === s.key)
      .map(p => `<div class="kchip ${p.overdue ? 'overdue' : ''}" title="${esc(p.name)} — ${esc(p.nextStep || '')}">${esc(p.name)}</div>`)
      .join('');
    return `<div class="kcol"><div class="khead"><b>${s.label}</b><span>${d.byStage[s.key]}</span></div>${chips || '<div class="empty">—</div>'}</div>`;
  }).join('');
  $('#kanban').innerHTML = k;

  // aging
  $('#agingList').innerHTML = d.overdueProspects.length
    ? `<ul class="clean">${d.overdueProspects.map(p =>
        `<li><b>${esc(p.name)}</b> <span class="stagechip s-${p.stage}">${p.stageLabel}</span>
         <span class="agechip overdue">${p.ageDays}d in stage (max ${p.timeboxDays}d)</span>
         <div class="pros-detail">Next: <span class="nextstep">${esc(p.nextStep || 'set one')}</span></div></li>`).join('')}</ul>`
    : `<div class="empty">No prospect has exceeded its stage timebox. ✅</div>`;

  // queue preview
  $('#queuePreview').innerHTML = d.queue.pending.length
    ? `<ul class="clean">${d.queue.pending.slice(0, 5).map(q =>
        `<li><b>${esc(q.topic)}</b>${q.why ? `<div class="small muted">${esc(q.why)}</div>` : ''}</li>`).join('')}</ul>`
    : `<div class="empty">Queue is empty — the RESEARCH step will skip (never invents a topic).</div>`;

  // report glance
  if (d.report && d.report.row.length) {
    $('#reportDate').textContent = d.report.date || '';
    const labels = ['📥 Inbox', '✍️ Replies', '📅 Meetings', '✅ Tasks', '🔔 Follow-ups', '⚠️ Needs me'];
    $('#reportGlance').innerHTML = d.report.row.map((v, i) =>
      `<div class="g"><b>${esc(v)}</b><span>${labels[i] || ''}</span></div>`).join('')
      + (d.productsReady ? '' : '<div class="empty" style="flex-basis:100%">⚠️ PRODUCTS.md still has placeholder specs — the employee will flag any spec/price question back to you rather than guess (Rule 2).</div>');
  } else {
    $('#reportGlance').innerHTML = '<div class="empty">No daily report on file yet — run the morning routine in the Workflow tab.</div>';
  }
}

// ── pipeline ─────────────────────────────────────────────────────────────────
function renderPipeline() {
  const d = state.data;
  $('#prospectCount').textContent = `${d.prospects.length} tracked · ${d.prospectSections.length} lists`;

  if (!d.prospects.length) {
    $('#prospectList').innerHTML = '<div class="empty">No prospects yet. Add the first one — real names only (Rule 2).</div>';
    return;
  }

  const bySection = {};
  for (const p of d.prospects) (bySection[p.section] = bySection[p.section] || []).push(p);

  $('#prospectList').innerHTML = Object.entries(bySection).map(([section, list]) => `
    <h3 class="section-title" style="margin:14px 0 8px;font-size:14px;color:var(--dim)">${esc(section)}</h3>
    <div style="overflow-x:auto"><table class="tbl">
      <thead><tr><th>Prospect</th><th>Stage</th><th>Age</th><th>Next step</th><th>Needs</th></tr></thead>
      <tbody>${list.map(p => `
        <tr>
          <td>
            <b>${esc(p.name)}</b>
            <div class="pros-detail">${esc(p.type)}</div>
            <div class="pros-detail"><b>Contact:</b> ${esc(p.contact)}</div>
            <div class="pros-detail"><b>Last:</b> ${esc(p.lastAction)}</div>
            ${p.notes && p.notes !== '—' ? `<div class="pros-detail">${esc(p.notes)}</div>` : ''}
          </td>
          <td>
            <select data-prospect="${esc(p.name)}" data-stage="${p.stage}">
              ${d.stages.map(s => `<option value="${s.key}" ${s.key === p.stage ? 'selected' : ''}>${s.label}</option>`).join('')}
            </select>
          </td>
          <td>${p.ageDays == null ? '<span class="muted">—</span>' :
            `<span class="agechip ${p.overdue ? 'overdue' : ''}">${p.ageDays}d${p.timeboxDays ? ` / ${p.timeboxDays}d` : ''}</span>`}</td>
          <td class="nextstep small">${esc(p.nextStep)}</td>
          <td class="small muted">${esc(p.needs)}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>
  `).join('');

  $('#prospectList').querySelectorAll('select[data-prospect]').forEach(sel => {
    sel.addEventListener('change', async () => {
      const name = sel.dataset.prospect;
      try {
        await api('/api/prospects/stage', { method: 'POST', body: { name, stage: sel.value } });
        toast(`✅ ${name} → moved. PROSPECTS.md updated + summary rolled up.`);
        refresh();
      } catch (err) { toast('❌ ' + err.message, true); }
    });
  });
}

async function onAddProspect(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    const res = await api('/api/prospects', { method: 'POST', body: data });
    toast(`✅ ${res.name} added to PROSPECTS.md`);
    form.reset();
    form.classList.add('hidden');
    refresh();
  } catch (err) { toast('❌ ' + err.message, true); }
}

async function onAddQueueTopic(e) {
  e.preventDefault();
  const input = $('#queueTopic');
  try {
    await api('/api/queue', { method: 'POST', body: { topic: input.value } });
    toast('✅ Topic queued in research-queue.md');
    input.value = '';
    refresh();
  } catch (err) { toast('❌ ' + err.message, true); }
}

// ── approvals ────────────────────────────────────────────────────────────────
const CHECKLIST = [
  ['Source verified', 'every name/number/spec is from real data — no invented facts'],
  ['Recipient verified', 'real person, current role, right desk'],
  ['Voice match', 'short, direct, "Best, Hendrixx" — no AI tells'],
  ['Ask is clear', 'one yes/no thing, concrete time window'],
  ['Timing is honest', 'only claim what\'s actually ready'],
  ['Security', 'no credentials, no confidential data, right account'],
  ['Permission', 'authorised to send in Hendrixx\'s voice'],
];

function renderApprovals() {
  const d = state.data;
  const n = d.approvals.awaiting.length;
  $('#approvalCount').textContent = n || '';

  $('#approvalList').innerHTML = n
    ? d.approvals.awaiting.map((a, i) => `
      <div class="approval-item" data-index="${i}">
        <div class="approval-title">${esc(a.title)}</div>
        <div class="approval-meta">
          ${a.context ? `(${esc(a.context)}) ` : ''}${a.detail ? esc(a.detail) : ''}
        </div>
        <div class="approval-actions">
          <input type="text" placeholder="Optional note (e.g. sent from Gmail 09:12, or why not)" data-note>
          <button class="btn btn-primary" data-decision="approve">☑ Approve &amp; log</button>
          <button class="btn btn-danger" data-decision="decline">✕ Decline</button>
        </div>
        <button class="checklist-toggle">▸ show the 7-point checklist</button>
        <div class="approval-checklist hidden">
          <ol class="checklist" style="margin:0;padding-left:18px">
            ${CHECKLIST.map(([t, s]) => `<li><b>${t}</b> — ${s}</li>`).join('')}
          </ol>
        </div>
      </div>`).join('')
    : '<div class="panel"><div class="empty">Nothing awaiting approval. Run the morning routine — external actions land here. ✅</div></div>';

  $$('#approvalList .approval-item').forEach(item => {
    const toggle = $('.checklist-toggle', item);
    toggle.addEventListener('click', () => {
      const box = $('.approval-checklist', item);
      box.classList.toggle('hidden');
      toggle.textContent = box.classList.contains('hidden') ? '▸ show the 7-point checklist' : '▾ hide the 7-point checklist';
    });
    $$('button[data-decision]', item).forEach(btn => {
      btn.addEventListener('click', async () => {
        const decision = btn.dataset.decision;
        const note = $('[data-note]', item).value.trim();
        if (decision === 'approve' && !confirm(`Approve "${d.approvals.awaiting[item.dataset.index].title}"?\n\nThis logs your yes — you still send it from Gmail. The console never sends.`)) return;
        btn.disabled = true;
        try {
          const res = await api('/api/approvals/decision', {
            method: 'POST', body: { index: Number(item.dataset.index), decision, note },
          });
          toast(decision === 'approve' ? `✅ Logged: ${res.item}` : `🚫 Declined: ${res.item}`);
          refresh();
        } catch (err) { toast('❌ ' + err.message, true); btn.disabled = false; }
      });
    });
  });

  $('#approvalLog').innerHTML = d.approvals.done.length
    ? `<div style="overflow-x:auto"><table class="tbl">
        <thead><tr><th>Date</th><th>Item</th><th>How it was done</th></tr></thead>
        <tbody>${d.approvals.done.map(r => `<tr><td>${esc(r.date)}</td><td><b>${esc(r.rest[0] || '')}</b></td><td class="small">${esc(r.rest.slice(1).join(' — '))}</td></tr>`).join('')}</tbody>
       </table></div>`
    : '<div class="empty">No approvals logged yet.</div>';
}

// ── workflow ─────────────────────────────────────────────────────────────────
const STEP_DEFS = [
  { key: 'inbox', title: '1️⃣ INBOX', desc: 'Sort emails → 🔴 Urgent / 🟡 Reply / 🟢 Task / ⚪ Ignore + draft replies in your voice. Drafts only.', input: 'emails', file: 'inbox.md', placeholder: 'Paste emails — format like demo/input/emails.md' },
  { key: 'research', title: '2️⃣ RESEARCH', desc: 'Takes the next topic from the research queue (or line 1 of the input) and lays out the brief. No web search — sections are flagged NEEDS SOURCE, never invented.', input: 'research', file: 'research.md', placeholder: 'Optional: a topic on line 1, pasted findings on the rest' },
  { key: 'calendar', title: '3️⃣ CALENDAR', desc: 'Meeting prep notes: context pulled from research + PROSPECTS.md, 3 talking points, desired outcome.', input: 'meetings', file: 'calendar.md', placeholder: 'Paste the meeting table — format like demo/input/meetings.md' },
  { key: 'tasks', title: '4️⃣ TASKS', desc: 'Reads the inbox + calendar outputs, does the safe work, queues every external action in approvals.md.', input: null, file: 'tasks.md', placeholder: '' },
  { key: 'followup', title: '5️⃣ FOLLOW-UP', desc: 'Parses past threads, computes who\'s due, drafts nudges per the bump scripts (crm/SEQUENCES.md).', input: 'threads', file: 'follow-up.md', placeholder: 'Paste threads — format like demo/input/threads.md' },
  { key: 'report', title: '6️⃣ REPORT', desc: 'Reads everything the routine produced and writes the honest end-of-day briefing.', input: null, file: 'report.md', placeholder: '' },
  { key: 'digest', title: '📧 DIGEST', desc: 'Formats the report as the morning email (templates/morning-digest.md). Draft only.', input: null, file: 'morning-digest.md', placeholder: '' },
];

function renderSteps() {
  // harvest current textarea values so a mode switch never loses edits
  $$('#stepCards textarea[data-input]').forEach(ta => { state.inputs[ta.dataset.input] = ta.value; });

  const wrap = $('#stepCards');
  wrap.innerHTML = STEP_DEFS.map(s => `
    <div class="step-card" data-step="${s.key}">
      <div class="row">
        <h3>${s.title}</h3>
        <button class="btn run-step">▶ Run</button>
      </div>
      <div class="desc">${s.desc}</div>
      ${s.input ? `<textarea data-input="${s.input}" placeholder="${s.placeholder}"></textarea>` : ''}
      <div class="out"></div>
    </div>`).join('');

  // pre-fill demo inputs
  for (const s of STEP_DEFS) {
    if (!s.input) continue;
    const ta = $(`#stepCards textarea[data-input="${s.input}"]`);
    if (ta && state.inputs[s.input]) ta.value = state.inputs[s.input];
  }

  $$('#stepCards .step-card').forEach(card => {
    $('.run-step', card).addEventListener('click', () => runStep(card.dataset.step, card));
  });
}

function renderModeNote() {
  $('#modeNote').textContent = state.mode === 'demo'
    ? '🧪 Demo mode — inputs come from demo/input/, outputs go to demo/output/. Your real daily/ files are untouched.'
    : '⚡ Live mode — outputs go to the real daily/ workflow files (and the research queue). Inputs are whatever you paste. This is the same behaviour as scripts/morning-routine.sh.';
}

function collectInputs() {
  const inputs = {};
  $$('#stepCards textarea[data-input]').forEach(ta => { inputs[ta.dataset.input] = ta.value; });
  return inputs;
}

async function runStep(step, card) {
  const btn = card ? $('.run-step', card) : null;
  const out = card ? $('.out', card) : null;
  if (btn) btn.disabled = true;
  if (out) out.textContent = 'running…';
  try {
    const res = await api('/api/run/step', {
      method: 'POST',
      body: { step, mode: state.mode, inputs: collectInputs() },
    });
    appendLog(res.log.join('\n'));
    if (out) out.textContent = res.ok ? `✓ ${res.file}` : '⚠ see log';
    toast(res.ok ? `✅ ${step} done` : '⚠ Step skipped — see log');
    refresh();
  } catch (err) {
    appendLog(`ERROR (${step}): ${err.message}`);
    if (out) out.textContent = '✗ failed';
    toast('❌ ' + err.message, true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function runRoutine() {
  const btn = $('#runRoutineBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Running…';
  appendLog(`— Morning routine starting (${state.mode} mode) —`);
  try {
    const res = await api('/api/run/routine', {
      method: 'POST',
      body: { mode: state.mode, inputs: collectInputs() },
    });
    appendLog(res.log.join('\n'));
    renderRunFiles(res.files || []);
    toast('✅ Routine complete — review the outputs, then approve what goes out');
    refresh();
  } catch (err) {
    appendLog(`ERROR: ${err.message}`);
    toast('❌ ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = '▶ Run full morning routine';
  }
}

function appendLog(text) {
  const el = $('#runLog');
  el.textContent = (el.textContent === 'No runs yet this session.' ? '' : el.textContent + '\n') + text + '\n';
  el.scrollTop = el.scrollHeight;
}

function renderRunFiles(files) {
  $('#runFiles').innerHTML = files.map(f =>
    `<button class="btn btn-ghost" data-file="${esc(f)}">${esc(f)}</button>`).join('');
  $$('#runFiles button').forEach(b => b.addEventListener('click', () => {
    loadFile(b.dataset.file);
    switchTab('files');
  }));
}

function switchTab(name) {
  $(`#tabs button[data-tab="${name}"]`).click();
}

// ── files browser ────────────────────────────────────────────────────────────
const FILE_GROUPS = [
  ['Pipeline', ['PROSPECTS.md', 'crm/PIPELINE.md', 'crm/SEQUENCES.md']],
  ['Rules & profile', ['CLAUDE.md', 'me.md', 'PRODUCTS.md', 'APPROVALS-CHECKLIST.md', 'voice-samples.md']],
  ['Daily', ['daily/inbox.md', 'daily/research.md', 'daily/calendar.md', 'daily/tasks.md', 'daily/approvals.md', 'daily/follow-up.md', 'daily/report.md', 'daily/morning-digest.md']],
  ['Queue', ['research-queue.md']],
  ['Reviews', ['weekly/weekly-review.md', 'monthly/monthly-review.md']],
  ['Demo input', ['demo/input/emails.md', 'demo/input/meetings.md', 'demo/input/threads.md', 'demo/input/research-queue.md']],
  ['Demo output', ['demo/output/inbox.md', 'demo/output/research.md', 'demo/output/calendar.md', 'demo/output/tasks.md', 'demo/output/approvals.md', 'demo/output/follow-up.md', 'demo/output/report.md', 'demo/output/morning-digest.md']],
];

function renderFiles() {
  const exists = (state.data && state.data.files) || {};
  $('#fileList').innerHTML = FILE_GROUPS.map(([group, files]) =>
    `<div class="group">${group}</div>` + files.map(f =>
      `<button data-file="${esc(f)}" class="${state.currentFile === f ? 'active' : ''}" ${exists[f] ? '' : 'style="opacity:.4"'} title="${exists[f] ? '' : 'not created yet'}">${esc(f)}</button>`).join('')
  ).join('');
}

async function loadFile(path) {
  state.currentFile = path;
  renderFiles();
  $('#fileName').textContent = path;
  $('#fileContent').innerHTML = '<div class="empty">Loading…</div>';
  try {
    const res = await api(`/api/file?path=${encodeURIComponent(path)}`);
    $('#fileContent').innerHTML = renderMarkdown(res.content);
  } catch (err) {
    $('#fileContent').innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

// ── toast ────────────────────────────────────────────────────────────────────
let toastTimer = null;
function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 4200);
}

boot().catch(err => {
  document.body.insertAdjacentHTML('afterbegin',
    `<div style="background:#63201e;color:#ffd9d7;padding:12px 20px;font-size:14px">
      Console failed to load: ${esc(err.message)} — is the server running? (<code>node app/server.js</code>)
     </div>`);
});
