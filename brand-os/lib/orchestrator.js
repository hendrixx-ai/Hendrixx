// ─────────────────────────────────────────────────────────────────────────────
// orchestrator.js — flows.
//
// An agent alone is a tool. A flow is a job: several agents in sequence, each
// receiving the artifacts of the ones before it, producing one run you can
// read, download and act on.
//
// Flows are declarative so the dependency order is visible:
//   { id, name, why, steps: [{ agent, input }] }
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const agents = require('./agents');

const FLOWS = [
  {
    id: 'daily',
    name: 'Daily brief',
    why: 'One page: the single focus, the ordered moves, today’s script, the money, the conversations.',
    minutes: 1,
    steps: [{ agent: 'operator', input: {} }],
  },
  {
    id: 'offer-build',
    name: 'Offer build',
    why: 'Skill → three named offers → 30 days of content pointing at the recommended one.',
    minutes: 3,
    inputs: [
      { key: 'skill', label: 'Your craft', placeholder: 'Canva templates', required: true },
      { key: 'audience', label: 'Who it is for', placeholder: 'freelance designers with no invoices' },
      { key: 'keyword', label: 'Comment keyword', placeholder: 'BRAND' },
    ],
    steps: [
      { agent: 'architect', input: { skill: '{{skill}}', audience: '{{audience}}' } },
      { agent: 'content', input: { audience: '{{audience}}', keyword: '{{keyword}}' } },
    ],
  },
  {
    id: 'content-sprint',
    name: 'Content sprint',
    why: 'Thirty pieces with scripts and captions, mixed to the plan’s pillar ratios.',
    minutes: 2,
    inputs: [
      { key: 'offer', label: 'Offer to promote', placeholder: 'The Buyable Brand' },
      { key: 'audience', label: 'Audience', placeholder: 'ambitious beginners' },
      { key: 'keyword', label: 'One keyword', placeholder: 'BRAND' },
    ],
    steps: [{ agent: 'content', input: { offer: '{{offer}}', audience: '{{audience}}', keyword: '{{keyword}}' } }],
  },
  {
    id: 'launch-kit',
    name: 'Launch kit',
    why: 'The full pack: offer architecture, 30 pieces, a 7-day launch, the emails and a growth memo.',
    minutes: 4,
    steps: [
      { agent: 'operator', input: {} },
      { agent: 'architect', input: { skill: '{{skill}}', audience: '{{audience}}' } },
      { agent: 'content', input: { audience: '{{audience}}', keyword: '{{keyword}}' } },
      { agent: 'launch', input: { days: '{{days}}', price: '{{price}}', goal: '{{goal}}' } },
      { agent: 'analyst', input: {} },
    ],
    inputs: [
      { key: 'skill', label: 'Your craft', placeholder: 'Canva templates', required: true },
      { key: 'audience', label: 'Who it is for', placeholder: 'freelance designers with no invoices' },
      { key: 'keyword', label: 'Comment keyword', placeholder: 'BRAND' },
      { key: 'days', label: 'Launch length', placeholder: '7' },
      { key: 'price', label: 'Launch price', placeholder: '97' },
      { key: 'goal', label: 'Sales target', placeholder: '10' },
    ],
  },
  {
    id: 'win-back',
    name: 'Win-back shift',
    why: 'A message for every conversation that is due, with the next two moves attached.',
    minutes: 1,
    steps: [{ agent: 'closer', input: { mode: 'due' } }],
  },
];

const FLOW_BY_ID = FLOWS.reduce((acc, f) => { acc[f.id] = f; return acc; }, {});

function resolve(template, input) {
  const out = {};
  for (const [k, v] of Object.entries(template || {})) {
    out[k] = typeof v === 'string' && /^\{\{\w+\}\}$/.test(v) ? (input[v.slice(2, -2)] || '') : v;
  }
  return out;
}

function missingInputs(flow, input) {
  const missing = [];
  for (const field of flow.inputs || []) {
    if (field.required && !String(input[field.key] || '').trim()) missing.push(field.label);
  }
  return missing;
}

// Runs a flow. Pure-ish: no I/O. Returns the full run object for jobs to persist.
function runFlow(flowId, { state, today, input = {} } = {}) {
  const flow = FLOW_BY_ID[flowId];
  if (!flow) throw new Error(`Unknown flow: ${flowId}`);

  const started = Date.now();
  const missing = missingInputs(flow, input);
  if (missing.length) {
    return {
      id: `run-${started}`,
      flowId, flowName: flow.name,
      status: 'blocked',
      startedAt: new Date().toISOString(),
      today,
      steps: [],
      artifacts: [],
      blockers: [`Missing: ${missing.join(', ')}`],
      summary: 'Nothing ran — the flow needs those inputs first.',
      durationMs: 0,
    };
  }

  const ctx = { artifacts: {}, shared: {} };
  const steps = [];
  const artifacts = [];
  const notes = [];
  const blockers = [];
  const adopt = { offers: [], content: [] };
  let status = 'ok';

  for (const step of flow.steps) {
    const agent = agents.BY_ID[step.agent];
    if (!agent) {
      blockers.push(`Unknown agent: ${step.agent}`);
      status = 'blocked';
      continue;
    }
    const stepInput = resolve(step.input, input);
    const t0 = Date.now();
    let result;
    try {
      result = agent.run(state, today, stepInput, ctx);
    } catch (err) {
      result = { status: 'blocked', steps: [], artifacts: [], blockers: [`${agent.name} failed: ${err.message}`], summary: 'Agent error.', notes: [] };
    }

    for (const a of result.artifacts || []) ctx.artifacts[a.name] = a.content;
    if (result.status === 'blocked') status = 'blocked';
    else if (result.status === 'partial' && status === 'ok') status = 'partial';

    steps.push({
      agentId: agent.id,
      agentName: agent.name,
      status: result.status,
      ms: Date.now() - t0,
      summary: result.summary,
      detail: result.steps || [],
      blockers: result.blockers || [],
      artifacts: (result.artifacts || []).map(a => a.name),
    });
    artifacts.push(...(result.artifacts || []).map(a => ({ ...a, agentId: agent.id, agentName: agent.name })));
    if (result.adopt) {
      if (Array.isArray(result.adopt.offers)) adopt.offers.push(...result.adopt.offers);
      if (Array.isArray(result.adopt.content)) adopt.content.push(...result.adopt.content);
    }
    notes.push(...(result.notes || []));
    blockers.push(...(result.blockers || []));
  }

  return {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    flowId,
    flowName: flow.name,
    status,
    startedAt: new Date().toISOString(),
    today,
    input,
    steps,
    artifacts,
    blockers,
    notes,
    adopt,
    summary: describe(flow, steps, artifacts),
    durationMs: Date.now() - started,
  };
}

function describe(flow, steps, artifacts) {
  const n = artifacts.length;
  if (!n) return `${flow.name}: no artifacts produced.`;
  const agentNames = [...new Set(steps.map(s => s.agentName))];
  return `${flow.name}: ${n} artifact${n === 1 ? '' : 's'} from ${agentNames.length} agent${agentNames.length === 1 ? '' : 's'} (${agentNames.join(' → ')}).`;
}

function listFlows() {
  return FLOWS.map(f => ({
    id: f.id, name: f.name, why: f.why, minutes: f.minutes,
    inputs: f.inputs || [],
    agents: f.steps.map(s => s.agent),
  }));
}

module.exports = { FLOWS, FLOW_BY_ID, listFlows, runFlow, resolve };
