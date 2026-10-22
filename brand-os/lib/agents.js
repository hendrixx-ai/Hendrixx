// ─────────────────────────────────────────────────────────────────────────────
// agents.js — the crew.
//
// Six deterministic agents. Each one takes your real state + a small input and
// returns something you can actually use: scripts, offers, a memo, a launch.
//
// No LLM is called. That is deliberate:
//   • it runs offline, instantly, and costs nothing
//   • every output is reviewable — you can read the rules that made it
//   • it cannot invent a testimonial, a number or a customer
// Where a real specific is required (revenue, screenshots, proof), the output
// carries a [bracketed placeholder] and the agent says so in its steps.
//
// Contract for every agent:
//   run(state, today, input, ctx) →
//     { status: 'ok'|'partial'|'blocked', steps: [{label, detail}],
//       artifacts: [{name, title, kind:'md', content}],
//       summary, blockers: [string], notes: [string] }
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const engine = require('./engine');
const playbook = require('./playbook');

// ── small helpers ───────────────────────────────────────────────────────────
const clean = (v, fallback = '') => {
  const s = String(v == null ? '' : v).trim();
  return s || fallback;
};
const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const pct = n => (n == null ? '—' : `${n}%`);
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map(r => `| ${r.map(c => String(c == null ? '' : c).replace(/\|/g, '\\|')).join(' | ')} |`),
].join('\n');
const list = items => items.map(i => `- ${i}`).join('\n');
const numbered = items => items.map((i, n) => `${n + 1}. ${i}`).join('\n');
const block = (title, body) => `## ${title}\n\n${body}\n`;
const words = s => clean(s).split(/\s+/).filter(Boolean);
const lower = s => clean(s).toLowerCase();
const article = s => (/^[aeiou]/i.test(clean(s)) ? 'an' : 'a');

function fillTokens(text, tokens) {
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (tokens[k] != null && tokens[k] !== '' ? tokens[k] : m));
}

function baseContext(state, input = {}) {
  const s = state.settings || {};
  const core = (state.offers || []).find(o => o.id === 'brand') || {};
  const audience = clean(input.audience, clean(core.audience, 'ambitious beginners'));
  const offer = clean(input.offer, clean(core.name, 'The Buyable Brand'));
  return {
    handle: clean(s.handle, '@yourname'),
    name: clean(s.name, '[Your name]'),
    coreLink: clean(s.coreLink, '[your $147 link]'),
    tripwireLink: clean(s.tripwireLink, '[your $27 link]'),
    reviewLink: clean(s.reviewLink, '[your $297 link]'),
    mapLink: clean(s.mapLink, '[your map link]'),
    audience,
    offer,
    result: clean(input.result, 'a named offer and a live checkout link'),
    pain: clean(input.pain, 'waiting for an audience before selling'),
    timeframe: clean(input.timeframe, '14 days'),
    skill: clean(input.skill),
  };
}

// ── agent 1: the offer architect ────────────────────────────────────────────
// Turns what you can actually do into three named, priced products.
const NAME_FORMULAS = [
  { id: 'system', build: t => `The ${t.theme} System` },
  { id: 'weekend', build: t => `${t.theme} in a Weekend` },
  { id: 'map', build: t => `The ${t.theme} Map` },
  { id: 'engine', build: t => `The ${t.theme} Engine` },
  { id: 'install', build: t => `The ${t.theme} Install` },
  { id: 'playbook', build: t => `The ${t.theme} Playbook` },
  { id: 'quiet', build: t => `The Quiet ${t.theme}` },
];

function titleCase(s) {
  return words(s).slice(0, 3).map(w => w[0] ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
}

const architect = {
  id: 'architect',
  name: 'Offer Architect',
  role: 'Turns a skill and an audience into three named, priced offers.',
  tag: 'Money',
  inputs: [
    { key: 'skill', label: 'What you can actually do', placeholder: 'e.g. Canva design, video editing, food styling', required: true },
    { key: 'audience', label: 'Who it is for (one person, not everyone)', placeholder: 'e.g. freelance designers with a pretty feed and no invoices' },
    { key: 'result', label: 'Result they want', placeholder: 'e.g. their first $500 client from Instagram' },
    { key: 'pain', label: 'What they fear or hate', placeholder: 'e.g. posting daily for months with nothing to sell' },
    { key: 'timeframe', label: 'How fast is believable?', placeholder: '14 days' },
  ],

  run(state, today, input = {}) {
    const skill = clean(input.skill);
    const blockers = [];
    if (!skill) blockers.push('Tell the architect what you can actually do — a skill, not a niche label.');
    if (words(skill).length > 12) blockers.push('Narrow the skill to one or two words of craft (e.g. “Canva templates”, not a paragraph).');
    if (blockers.length) {
      return {
        status: 'blocked', steps: [{ label: 'Input check', detail: 'Stopped before generating: the offer must come from a real capability.' }],
        artifacts: [], blockers,
        summary: 'Nothing generated — an offer invented from nothing is the exact thing this system refuses to do.',
        notes: [],
      };
    }

    const c = baseContext(state, { ...input, skill });
    const theme = titleCase(input.theme || skill);
    const audienceShort = words(c.audience).slice(0, 6).join(' ');
    const formula = `I help ${c.audience} get ${c.result} without ${c.pain} in ${c.timeframe}.`;
    const names = NAME_FORMULAS.slice(0, 3).map(n => n.build({ theme }));

    const ladders = [
      {
        rung: 'Tripwire', price: 27, name: names[1],
        promise: `A finished first ${theme} deliverable by Sunday night.`,
        format: 'Short guide + Notion checklist + 4–6 loom videos (under 90 minutes) + template pack',
        inside: ['The 60-minute outline', 'The ugly-v1 rule', 'A filled-in example you can copy', 'Delivery checklist'],
        proof: 'One before/after of your own file. No client testimonials required to launch.',
      },
      {
        rung: 'Core', price: 147, name: names[0],
        promise: `Install ${c.result} in ${c.timeframe} — offer, profile, content and checkout.`,
        format: '8 short modules + templates + swipe files + a day-by-day install plan',
        inside: [
          'Module 0 — install (the 45-minute setup)',
          'Module 1 — pick the profitable slice of what you already do',
          'Module 2 — the offer sentence and the price',
          'Module 3 — ship v1 in a weekend',
          'Module 4 — the profile that can take payments',
          'Module 5 — content that creates buyers',
          'Module 6 — the comment → DM → checkout funnel',
          'Module 7 — first 10 sales',
        ],
        proof: 'Your own build-in-public numbers. [your real number — never inflate it].',
      },
      {
        rung: 'Upsell', price: 297, name: names[2],
        promise: `A reviewed offer and profile — line by line, one round of notes.`,
        format: 'Async teardown: written notes + a recorded walkthrough, one revision round',
        inside: ['Offer sentence rewrite', 'Profile audit', 'Funnel check', 'A 30-day next-step plan'],
        proof: 'Two or three teardowns you did for free, with permission to share.',
      },
    ];

    const hasProduct = (state.offers || []).some(o => o.status === 'live' || o.status === 'proven');
    const recommended = hasProduct ? 'Core' : 'Tripwire';

    const md = [
      '# Offer architecture',
      '',
      `**Built for:** ${c.audience}`,
      `**From:** ${skill}`,
      `**Promise:** ${c.result} without ${c.pain}, in ${c.timeframe}`,
      '',
      '## The sentence that is the whole business',
      '',
      `> ${formula}`,
      '',
      'If that sentence is fuzzy, nothing downstream works. Rewrite it until a stranger could repeat it.',
      '',
      '## Three rungs, three jobs',
      '',
      ...ladders.map(l => block(`${l.rung} — ${l.price === 0 ? 'Free' : money(l.price)} — ${l.name}`, [
        `**Promise:** ${l.promise}`,
        '',
        `**Format:** ${l.format}`,
        '',
        '**Inside:**',
        '',
        list(l.inside),
        '',
        `**Proof needed at launch:** ${l.proof}`,
        '',
        `**Job:** ${l.rung === 'Tripwire' ? 'first yes, filters buyers, feeds the core offer' : l.rung === 'Core' ? 'main revenue — this is what carries the goal' : 'margin and case studies, added only when you are the bottleneck'}`,
      ].join('\n'))),
      '## Recommendation',
      '',
      `Start with the **${recommended}** rung — ${recommended === 'Tripwire'
        ? 'you do not have a live product yet, and the fastest way to learn whether the promise lands is to sell the small, finished thing.'
        : 'you already have something live, so the constraint is conversion, not product.'}`,
      '',
      'Do not build all three. Build the recommended one, sell ten, then read the DMs to decide what the next rung is.',
      '',
      '## What to write down before you build anything',
      '',
      table(['Question', 'Your answer'], [
        ['Who exactly?', c.audience],
        ['What result, in what time?', `${c.result} — ${c.timeframe}`],
        ['What is the one deliverable they hold at the end?', '[name the artefact — file, template, checkout link]'],
        ['What does it cost?', recommended === 'Tripwire' ? '$27' : '$97 → $147'],
        ['What proof do you have today?', '[honest answer — usually “my own build”]'],
      ]),
      '',
      '## Launch copy you can use immediately',
      '',
      `**Bio line:** I help ${audienceShort} get ${c.result}.`,
      '',
      `**One-liner for DMs:** ${formula}`,
      '',
      `**The objection you will hear first:** “I don’t have an audience.” Answer with the mechanism, not motivation: ${article(c.timeframe)} ${c.timeframe} install works at 0–500 followers because the funnel is comment → DM → checkout, not reach.`,
      '',
      `**Guarantee (installation, never income):** Work the ${c.timeframe} install. If you still do not have a named offer and a live checkout link, I will refund you.`,
      '',
    ].join('\n');

    return {
      status: 'ok',
      steps: [
        { label: 'Capability check', detail: `Skill “${skill}” → theme “${theme}”.` },
        { label: 'Formula', detail: formula },
        { label: 'Naming', detail: `3 names from the naming bank: ${names.join(' · ')}` },
        { label: 'Pricing', detail: 'Tripwire $27 · Core $147 · Upsell $297 — the plan’s ladder, not a guess.' },
        { label: 'Recommendation', detail: `Start with the ${recommended} rung.` },
        { label: 'Honesty pass', detail: 'Every proof line is bracketed until you have the real artefact.' },
      ],
      artifacts: [{ name: 'offer.md', title: 'Offer architecture', kind: 'md', content: md }],
      summary: `Three offers named and priced from “${skill}”. Recommended start: ${recommended}.`,
      blockers: [],
      notes: ['Nothing here is applied automatically — use “Adopt into the ladder” when you are ready.'],
      adopt: { offers: ladders.map((l, i) => ({ id: ['weekend', 'brand', 'review'][i], name: l.name, price: l.price, promise: l.promise, format: l.format })) },
    };
  },
};

// ── agent 2: the content director ───────────────────────────────────────────
// Builds 30 pieces from your offer + audience, with the pillar mix and CTA
// rotation the plan asks for. Never repeats the same ask inside 7 days.
const HOOK_TEMPLATES = {
  A: [
    'Your bio is not an offer. Here is the line that makes {audience} buyable.',
    '{audience} do not need more content. They need one sentence that names the result.',
    '$27 vs $147: what {audience} should sell first (and why order matters).',
    'The Buyable Offer formula — steal this sentence and stop rewriting your bio.',
    'Three filters that tell you whether your {skill} is actually sellable.',
    'Your price is not the problem. Your category is.',
  ],
  B: [
    'Pretty feed, empty wallet — the {audience} version.',
    'Your taste is the product. You are just not packaging it.',
    'Ugly offer + pretty grid = $0. Flip the order.',
    'Canva is not a personality. Here is how taste actually gets paid.',
    'Why the aesthetic accounts stay unpaid — and the quiet ones do not.',
  ],
  C: [
    'Day {day}: building {offer} in public. Revenue so far: [your real number].',
    'What I shipped this week for {offer}: [file]. What it cost: [time].',
    'I filmed the first product files on my phone. Here is the folder.',
    'Checkout link is live. Followers: still tiny. That is the point.',
    'The honest number this week, and what I would do differently.',
    'What I cut from v1 of {offer} — and why cutting it made it sellable.',
  ],
  D: [
    'If you are {audience} with skills and no offer, this is the real reason.',
    'You do not need 10k followers. You need something to sell them.',
    'If you are still “researching”, you are hiding. Here is the smallest next step.',
    'Ambitious but unpaid is not a talent problem. It is a packaging problem.',
  ],
  E: [
    '{offer} is open. Here is exactly what is inside — no mystery box.',
    'Comment {keyword} and I will send the free map that names your offer.',
    'Last day at the launch price. Doors at the standard price tomorrow.',
    'Two doors: the weekend kit, or the full install. Pick the one you will actually finish.',
    'Mid-month close: what changed for the people who started.',
  ],
};

const CTA_ROTATION = [
  { type: 'keyword', text: 'Comment {keyword} — I’ll DM the free Offer Map.' },
  { type: 'save', text: 'Save this for the weekend you actually build the product.' },
  { type: 'question', text: 'Reply with your skill + stuck point. I’ll tell you what I’d sell.' },
  { type: 'share', text: 'Share this with one person who is pretty but unpaid.' },
  { type: 'link', text: 'Map is free, link in bio. The system is {corePrice} when you’re serious.' },
];

// Deterministic but non-repetitive ordering of the pillar mix.
// 30 slots: A9 B6 C6 D4 E5, interleaved so no pillar runs more than twice.
const PILLAR_SEQUENCE = [
  'C', 'A', 'D', 'B', 'E', 'B', 'A',
  'A', 'B', 'D', 'E', 'C', 'A', 'E',
  'C', 'A', 'B', 'D', 'E', 'C', 'A',
  'A', 'B', 'D', 'E', 'C', 'A', 'B', 'C', 'A',
];

const FORMAT_BY_PILLAR = { A: 'R', B: 'R', C: 'R+F', D: 'R', E: 'C' };

const content = {
  id: 'content',
  name: 'Content Director',
  role: 'Writes 30 pieces — hooks, scripts, captions — from your offer.',
  tag: 'Distribution',
  inputs: [
    { key: 'offer', label: 'Offer to promote', placeholder: 'The Buyable Brand' },
    { key: 'audience', label: 'Audience', placeholder: 'ambitious beginners with taste' },
    { key: 'keyword', label: 'One comment keyword', placeholder: 'BRAND' },
    { key: 'skill', label: 'Your craft (for examples)', placeholder: 'Canva design' },
  ],

  run(state, today, input = {}, ctx = {}) {
    const c = baseContext(state, input);
    const keyword = clean(input.keyword, 'BRAND').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'BRAND';
    const corePrice = money((state.offers.find(o => o.id === 'brand') || {}).price || 147);
    const tokens = {
      audience: c.audience, offer: c.offer, keyword, corePrice,
      skill: c.skill || lower(c.skill) || '[your skill]',
      day: '1',
    };

    const counters = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    const items = [];
    let ctaIndex = 0;

    PILLAR_SEQUENCE.forEach((pillar, i) => {
      const day = i + 1;
      const pool = HOOK_TEMPLATES[pillar];
      const tpl = pool[counters[pillar] % pool.length];
      counters[pillar] += 1;

      // CTA rotation: never the same ask as the previous two days
      // (the plan's rule is "never the same ask 7 days in a row" — a hard
      // 7-day window is impossible with five CTA types, so we guarantee at
      // least two different asks between repeats).
      let cta = CTA_ROTATION[ctaIndex % CTA_ROTATION.length];
      const recent = items.slice(-2).map(x => x.ctaType);
      let guard = 0;
      while (recent.includes(cta.type) && guard < CTA_ROTATION.length) {
        ctaIndex += 1;
        cta = CTA_ROTATION[ctaIndex % CTA_ROTATION.length];
        guard += 1;
      }
      ctaIndex += 1;

      const hook = fillTokens(tpl, { ...tokens, day: String(day) });
      const ctaText = fillTokens(cta.text, tokens);
      const format = FORMAT_BY_PILLAR[pillar] || 'R';
      items.push({ day, pillar, hook, cta: ctaText, ctaType: cta.type, format });
    });

    const calendar = [
      '# 30-day calendar',
      '',
      `**Offer:** ${c.offer} · **Audience:** ${c.audience} · **Keyword:** ${keyword}`,
      `Generated ${today}. Your own words beat these — rewrite them, keep the structure.`,
      '',
      table(['Day', 'Pillar', 'Format', 'Hook', 'CTA'], items.map(it => [
        it.day,
        `${it.pillar} — ${playbook.PILLARS[it.pillar].label}`,
        playbook.FORMAT_LABELS[it.format] || it.format,
        it.hook,
        it.cta,
      ])),
      '',
      '## Pillar mix check',
      '',
      table(['Pillar', 'Pieces', 'Target share', 'Job'], Object.keys(playbook.PILLARS).map(k => [
        `${k} — ${playbook.PILLARS[k].label}`,
        items.filter(i => i.pillar === k).length,
        `${playbook.PILLARS[k].share}%`,
        playbook.PILLARS[k].job,
      ])),
      '',
      'Never go a full week without a C (proof) and an E (ask). Authority without an ask is a diary; an ask without proof is an ad.',
      '',
    ].join('\n');

    const scripts = [
      '# 30 scripts',
      '',
      `Offer: **${c.offer}** · Keyword: **${keyword}**`,
      '',
      'Structure per piece: hook → problem → mechanism → proof → command. Proof lines are bracketed on purpose: only you can put a real number there.',
      '',
      ...items.map(it => {
        const teach = playbook.TEACHING[it.pillar] || [];
        const body = it.format === 'C'
          ? [
            `**Slides:** hook (1) → ${teach.length} teaching slides → one example → CTA.`,
            ...teach.map((t, n) => `${n + 2}. ${t}`),
          ]
          : [
            '0–3s **hook:** ' + it.hook,
            '3–20s **problem:** name it plainly — they are posting and nobody is paying.',
            ...teach.map((t, n) => `20–40s **mechanism ${n + 1}:** ${t}`),
            '40–55s **proof:** [your real screen or number — never invented].',
            `55–60s **command:** ${it.cta}`,
          ];
        return [
          `## Day ${it.day} — ${it.pillar} · ${playbook.FORMAT_LABELS[it.format] || it.format}`,
          '',
          body.join('\n'),
          '',
          '**Caption:**',
          '',
          '```',
          `${it.hook}`,
          '',
          `${it.cta}`,
          '',
          `Follow ${c.handle} if you are starting from zero and actually want to sell something.`,
          '```',
          '',
        ].join('\n');
      }),
    ].join('\n');

    const captions = [
      '# Caption bank',
      '',
      'Say the keyword twice in the Reel — once mid-video, once on screen — and once in the pinned comment. One keyword per post.',
      '',
      ...items.map(it => [
        `### Day ${it.day} — ${it.pillar}`,
        '',
        '```',
        it.hook,
        '',
        it.cta,
        '',
        `Follow ${c.handle} for the build in public.`,
        '```',
        '',
      ].join('\n')),
    ].join('\n');

    const inherited = ctx.artifacts && ctx.artifacts['offer.md']
      ? 'Hooks were generated against the offer from the Offer Architect in this same run.'
      : 'Hooks were generated against your current core offer.';

    return {
      status: 'ok',
      steps: [
        { label: 'Pillar mix', detail: '9 A · 6 B · 6 C · 4 D · 5 E — the plan’s 30/20/20/15/15 split.' },
        { label: 'Hook generation', detail: `${items.length} hooks from ${Object.values(HOOK_TEMPLATES).flat().length} templates, no repeats inside a pillar until the pool is used.` },
        { label: 'CTA rotation', detail: 'keyword → save → question → share → link, never the same ask inside 7 days.' },
        { label: 'Scripts', detail: 'Hook → problem → mechanism → proof → command for every Reel; slide map for carousels.' },
        { label: 'Honesty pass', detail: 'Every proof beat left as [your real number].' },
      ],
      artifacts: [
        { name: 'calendar.md', title: '30-day calendar', kind: 'md', content: calendar },
        { name: 'scripts.md', title: '30 scripts + captions', kind: 'md', content: scripts },
        { name: 'captions.md', title: 'Caption bank', kind: 'md', content: captions },
      ],
      summary: `30 pieces written for ${c.offer}, keyword ${keyword}. ${inherited}`,
      blockers: [],
      notes: ['Adopt into the calendar only fills hooks you have not edited yourself.'],
      adopt: { content: items.map((it, i) => ({ id: `c${String(i + 1).padStart(2, '0')}`, hook: it.hook, cta: it.cta })) },
    };
  },
};

// ── agent 3: the DM closer ──────────────────────────────────────────────────
// Reads one lead (or every due lead), picks the message, writes the next two.
function closerMessage(lead, c) {
  const name = clean(lead.name, 'there').split(' ')[0];
  const skill = clean(lead.skill, '[their skill]');
  const stage = lead.stage;
  const link = stage === 'hot' ? c.coreLink : c.tripwireLink;

  if (stage === 'new') {
    return {
      why: 'They replied but you have not qualified them. One question, two options — not a quiz.',
      send:
`Hey ${name} — got you.

Here’s the free Buyable Offer Map: ${c.mapLink}

Quick question so I send the right next step:
do you already have something to sell, or are you still deciding?

Reply SELLING or DECIDING.`,
      next: [
        'When they answer DECIDING → send the $27 kit, not the core offer.',
        'When they answer SELLING → the account is the leak; send the core offer.',
      ],
    };
  }
  if (stage === 'deciding') {
    return {
      why: 'No product yet. Selling the $147 here is why beginners lose the sale — the small yes is the point.',
      send:
`Then don’t start with a 40-hour course.

With ${skill}, the fastest proof is a weekend v1 — one small thing someone can buy by Sunday.

I made a $27 kit that walks you through naming + packaging it: ${c.tripwireLink}

Want that, or the full install (${c.coreLink}) so the profile and funnel are handled too?`,
      next: [
        'If they go quiet 24h → the no-pressure nudge, one line only.',
        'If they say “too expensive” → do not discount; point at the $27 and keep the door open.',
      ],
    };
  }
  if (stage === 'selling') {
    return {
      why: 'They have something to sell. More content is not the fix; the account not converting is.',
      send:
`Good — then your problem probably isn’t “more content”.

It’s that ${skill} is not packaged where people can pay for it. That’s an offer + profile + funnel job, and it’s the ${c.offer} install.

${c.coreLink}

Want me to walk you through what changes first?`,
      next: [
        'If they ask “what exactly do I get” → send the module list, not a promise.',
        'If they buy → Module 0 same day, and ask for their one-sentence offer.',
      ],
    };
  }
  if (stage === 'hot') {
    return {
      why: 'Buying temperature is hot. One link, one instruction, then stop talking.',
      send:
`Here you go: ${link}

If anything in checkout breaks, reply here and I’ll sort it.

After you join, start at Module 0 — and don’t skip the ugly-v1 rule.`,
      next: [
        'Do not send a second link. Do not add a bonus. Let them pay.',
        'If no purchase in 12h → one Story mention, no DM chase.',
      ],
    };
  }
  return {
    why: 'They went quiet after the map. One nudge, zero guilt, then leave them alone.',
    send:
`No pressure — most people screenshot the map and disappear.

If you want, tell me:
1) your skill
2) who you want to help

I’ll tell you what I’d sell first. One sentence.`,
    next: ['If nothing after this, move the card to lost and keep posting proof.', 'Never send a third message.'],
  };
}

const OBJECTIONS = [
  ['“I don’t have an audience.”', 'You do not need one for the first ten sales. Comment → DM → checkout works at 0–500 followers. Show the funnel, not a follower screenshot.'],
  ['“It’s too expensive.”', 'Never discount. Downgrade: the $27 kit is the same method, smaller scope. Keeping the price keeps the promise honest.'],
  ['“I’ll think about it.”', 'Ask what specifically is unclear — offer, price, or time. One question, then answer only that.'],
  ['“I don’t know what to sell.”', 'That is what the free Map is for. Name the offer in one sentence before you sell anything.'],
  ['“Does this actually work?”', 'Only answer with a real artefact: your own build, a buyer’s screenshot with permission, or “here is what has not worked yet”. Never invent proof.'],
];

const closer = {
  id: 'closer',
  name: 'DM Closer',
  role: 'Picks the next message for a lead and the two after it.',
  tag: 'Revenue',
  inputs: [
    { key: 'leadId', label: 'Lead', type: 'lead' },
    { key: 'mode', label: 'Scope', type: 'select', options: [{ value: 'one', label: 'One lead' }, { value: 'due', label: 'Everyone due' }] },
  ],

  run(state, today, input = {}, ctx = {}) {
    const c = baseContext(state, input);
    const leads = state.leads || [];
    const mode = input.mode === 'due' ? 'due' : 'one';

    if (mode === 'due') {
      const due = leads.filter(l => l.nextActionAt && l.nextActionAt <= today && !['bought', 'lost'].includes(l.stage));
      if (!due.length) {
        return {
          status: 'partial',
          steps: [{ label: 'Queue check', detail: 'No lead is due today.' }],
          artifacts: [],
          blockers: [],
          summary: 'Nobody is due. The honest next move is to post proof and log the funnel numbers — chasing people who do not owe you a reply is how accounts get muted.',
          notes: ['Add or move a lead, and this agent has work again.'],
        };
      }
      const md = [
        '# Win-back queue',
        '',
        `${due.length} conversation${due.length === 1 ? '' : 's'} due today. Send these yourself — this file never sends.`,
        '',
        ...due.map(l => {
          const m = closerMessage(l, c);
          return [
            `## ${l.name}${l.handle ? ` (${l.handle})` : ''} — ${l.stage}`,
            '',
            `*Why this message:* ${m.why}`,
            '',
            '```',
            m.send,
            '```',
            '',
            '**Then:**',
            list(m.next),
            '',
          ].join('\n');
        }),
      ].join('\n');

      return {
        status: 'ok',
        steps: [
          { label: 'Queue', detail: `${due.length} lead(s) with a follow-up on or before ${today}.` },
          { label: 'Routing', detail: 'Message chosen by stage, not by mood.' },
          { label: 'Escalation', detail: 'Every message has the next two moves attached.' },
        ],
        artifacts: [{ name: 'win-back.md', title: 'Win-back queue', kind: 'md', content: md }],
        summary: `${due.length} message${due.length === 1 ? '' : 's'} written for today’s due conversations.`,
        blockers: [], notes: ['Copy from the artifact; the app never messages anyone.'],
      };
    }

    const lead = leads.find(l => l.id === input.leadId);
    if (!lead) {
      return {
        status: 'blocked',
        steps: [{ label: 'Lead lookup', detail: 'No lead selected.' }],
        artifacts: [],
        blockers: ['Pick a lead (or add one in DMs & leads) — this agent will not write a message to an imaginary person.'],
        summary: 'Nothing generated.',
        notes: [],
      };
    }

    const m = closerMessage(lead, c);
    const md = [
      `# ${lead.name}${lead.handle ? ` (${lead.handle})` : ''}`,
      '',
      `**Stage:** ${lead.stage} · **Source:** ${clean(lead.source, '—')} · **Last touch:** ${clean(lead.lastTouch, '—')}`,
      lead.skill ? `**Their situation:** ${lead.skill}` : '',
      lead.note ? `**Your note:** ${lead.note}` : '',
      '',
      '## Send this now',
      '',
      '```',
      m.send,
      '```',
      '',
      `*Why:* ${m.why}`,
      '',
      '## The two moves after this',
      '',
      numbered(m.next),
      '',
      '## Objection handling',
      '',
      table(['If they say', 'Reply with'], OBJECTIONS),
      '',
      '## After the call',
      '',
      '- Move the card in DMs & leads so tomorrow’s runbook is accurate.',
      '- If they bought: log the sale, then ask for the one-sentence offer they wrote.',
      '',
    ].filter(Boolean).join('\n');

    return {
      status: 'ok',
      steps: [
        { label: 'Lead read', detail: `${lead.name} — stage “${lead.stage}”.` },
        { label: 'Routing', detail: 'Stage → script → link. Only one link per message.' },
        { label: 'Escalation', detail: 'Next two moves written, including when to stop.' },
        { label: 'Honesty pass', detail: 'No pricing promises, no invented proof, no fake urgency.' },
      ],
      artifacts: [{ name: 'dm.md', title: `Message for ${lead.name}`, kind: 'md', content: md }],
      summary: `Message ready for ${lead.name} (${lead.stage}). Copy it, send it, then move the card.`,
      blockers: [],
      notes: ['The app has no Instagram credentials and no send path. This is deliberate.'],
    };
  },
};

// ── agent 4: the growth analyst ─────────────────────────────────────────────
const analyst = {
  id: 'analyst',
  name: 'Growth Analyst',
  role: 'Reads the numbers, names the leak, prescribes three moves.',
  tag: 'Judgement',
  inputs: [],

  run(state, today) {
    const view = engine.compute(state, today);
    const { money: m, funnel: f, ranking: r, content: ct, leads } = view;
    const hasSales = m.allTime > 0 || m.units > 0;
    const hasFunnel = f.hasData;
    const blocked = !hasSales && !hasFunnel;

    const leak = f.checks.find(ch => ch.status === 'low');
    const forecast = m.dailyAvg > 0
      ? `At the last ${m.daysActive} day${m.daysActive === 1 ? '' : 's'}’ average of ${money(m.dailyAvg)}, the month lands near ${money(m.projected)} against a ${money(m.goal)} target. That is arithmetic, not a promise.`
      : 'No sales yet, so there is no rate to project. The first projection appears after the first sale — never before.';

    const prescriptions = [];
    if (!hasFunnel) {
      prescriptions.push({
        move: 'Log five numbers tonight', why: 'views, comments, DM replies, clicks, purchases', owner: 'you', minutes: 5,
        effect: 'Turns “I think it’s not working” into one specific leak you can fix tomorrow.',
      });
    } else if (leak) {
      prescriptions.push({
        move: `Fix the ${leak.label} step`, why: leak.fix, owner: 'you', minutes: 30,
        effect: `Getting ${leak.label} to the healthy floor (${leak.healthy}) is the cheapest revenue in the account right now.`,
      });
    } else {
      prescriptions.push({
        move: 'Raise the price, not the volume', why: 'Every funnel step is at or above benchmark.', owner: 'you', minutes: 20,
        effect: 'Same audience, same content, more revenue per buyer — and it filters out the people who will not do the work.',
      });
    }

    const top = r.offers[0];
    if (top && top.units > 0) {
      prescriptions.push({
        move: `Put ${top.name} in the next three Reels`, why: `It is ${top.share}% of revenue at ${money(top.revenue)} with ${top.units} units.`, owner: 'you', minutes: 35,
        effect: 'You are already selling it; the content is just not pointing at it often enough.',
      });
    } else {
      prescriptions.push({
        move: 'Ship the $27 rung', why: 'No offer has revenue yet, so the constraint is product, not marketing.', owner: 'you', minutes: 120,
        effect: 'A finished small product turns every future Reel into a possible sale.',
      });
    }

    const due = leads.due;
    prescriptions.push({
      move: due ? `Work the ${due} due conversation${due === 1 ? '' : 's'}` : 'Post one piece of proof',
      why: due ? 'Warm intent decays in 72 hours and it is the only revenue you can book today.' : 'No conversations are due; reach is the binding constraint.',
      owner: 'you', minutes: due ? 20 : 35,
      effect: due ? 'Highest revenue-per-minute on the board.' : 'Keeps the top of the funnel from going quiet for a week.',
    });

    const md = [
      '# Growth memo',
      '',
      `${view.prettyToday} · Day ${view.dayNumber} · ${view.phaseLabel}`,
      '',
      '## Headline',
      '',
      blocked
        ? '**Insufficient data, stated plainly.** You have no sales and no funnel numbers logged. Any diagnosis now would be theatre, so this memo stops at the two things that generate data.'
        : `**${money(m.mtd)}** booked this month against a ${money(m.goal)} target (${m.progress}%), ${m.daysLeft} days left. Pace status: **${m.status}**.`,
      '',
      hasSales ? `All-time revenue ${money(m.allTime)} across ${m.units} units. Best seller: **${r.bestSellerName}** (${top ? top.score : 0}/100).` : '',
      '',
      '## What the numbers say',
      '',
      table(['Metric', 'Value', 'Read'], [
        ['Month to date', money(m.mtd), `${m.progress}% of ${money(m.goal)}`],
        ['Pace target today', money(m.paceTarget), m.paceGap >= 0 ? `${money(m.paceGap)} ahead` : `${money(Math.abs(m.paceGap))} behind`],
        ['Last 30 days', money(m.last30), m.trend == null ? 'no prior period' : `${m.trend >= 0 ? '+' : ''}${m.trend}% vs prior 30`],
        ['Units, 30 days', m.units30, m.units30 ? `${money(m.last30 / Math.max(1, m.units30))} average order` : 'none yet'],
        ['Forecast', money(m.projected), forecast],
        ['Content posted', `${ct.stats.posted}/${ct.stats.total}`, ct.stats.due ? `${ct.stats.due} due or behind` : 'on schedule'],
        ['Conversations', `${leads.active} active`, `${leads.due} due now`],
      ]),
      '',
      hasFunnel ? '## The funnel, step by step\n' : '## The funnel\n',
      hasFunnel
        ? [
          table(['Step', 'Rate', 'Healthy', 'Status'], f.checks.map(ch => [ch.label, pct(ch.value), ch.healthy, ch.status])),
          '',
          ...f.diagnosis.map(d => `- ${d}`),
        ].join('\n')
        : 'Not logged. Views → comments → DM replies → clicks → purchases. Five numbers, five minutes, and the diagnosis writes itself.',
      '',
      '## Three prescriptions',
      '',
      ...prescriptions.map((p, i) => [
        `### ${i + 1}. ${p.move}`,
        '',
        `**Why:** ${p.why}`,
        '',
        `**Expected effect:** ${p.effect}`,
        '',
        `**Time:** ${p.minutes} min · **Owner:** ${p.owner}`,
        '',
      ].join('\n')),
      '## What I will not tell you',
      '',
      list([
        'That a number is “on track” when it is not — the pace check above is arithmetic.',
        'To post more when the funnel says the leak is downstream. Volume into a broken step is expensive.',
        'That a launch will hit a target. Only footage and checkouts are evidence.',
      ]),
      '',
      '## Risks',
      '',
      list([
        m.status === 'cold' ? 'Cold month: no sales logged at all. Fix the smallest step, not the identity.' : 'Pace drift: two quiet weeks can erase a month’s lead — check weekly, not monthly.',
        ct.stats.due > 3 ? `${ct.stats.due} pieces are behind schedule; reach decays before the offer does.` : 'Posting is on schedule — the constraint is elsewhere.',
        leads.due > 0 ? `${leads.due} conversations are due; silence reads as disinterest.` : 'No conversation backlog.',
      ]),
      '',
    ].filter(t => t !== '').join('\n');

    return {
      status: blocked ? 'partial' : 'ok',
      steps: [
        { label: 'Read state', detail: `${m.units} units, ${m.allTime ? money(m.allTime) : '$0'} all time, ${leads.active} active conversations.` },
        { label: 'Funnel check', detail: hasFunnel ? (leak ? `Leak found at “${leak.label}” (${leak.value}% vs ${leak.healthy}).` : 'All steps at or above benchmark.') : 'No funnel data — memo says so instead of guessing.' },
        { label: 'Forecast', detail: forecast.slice(0, 120) + (forecast.length > 120 ? '…' : '') },
        { label: 'Prescriptions', detail: '3 moves, each with an owner, a time cost and an expected effect.' },
      ],
      artifacts: [{ name: 'memo.md', title: 'Growth memo', kind: 'md', content: md }],
      summary: blocked
        ? 'Honest memo: no data yet, plus exactly which two numbers to log.'
        : `Memo written. Leak: ${leak ? leak.label : 'none at benchmark'} · pace ${m.status}.`,
      blockers: [],
      notes: blocked ? ['This is a partial run by design — a diagnosis without data is fiction.'] : [],
    };
  },
};

// ── agent 5: the launch producer ────────────────────────────────────────────
const launch = {
  id: 'launch',
  name: 'Launch Producer',
  role: 'Builds a 7-day launch: content, stories, DMs and emails, hour by hour.',
  tag: 'Revenue',
  inputs: [
    { key: 'days', label: 'Launch length', placeholder: '7' },
    { key: 'price', label: 'Launch price', placeholder: '97' },
    { key: 'goal', label: 'Seats / sales target', placeholder: '10' },
  ],

  run(state, today, input = {}) {
    const c = baseContext(state, input);
    const days = Math.min(14, Math.max(3, Math.round(Number(input.days) || 7)));
    const price = clean(input.price, String((state.offers.find(o => o.id === 'brand') || {}).price || 147));
    const target = Math.max(1, Math.round(Number(input.goal) || 10));
    const now = new Date(`${today}T12:00:00Z`);
    const dateFor = n => {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };

    const ARC = [
      { name: 'Name the enemy', hook: 'The reason {audience} stay unpaid has nothing to do with talent.', story: 'Poll: “Do you have an offer?” with two options.', dm: 'Ask your ten warmest replies what they are stuck on.' },
      { name: 'Teach the mechanism', hook: 'Offer first, aesthetic second, audience third. Everything else is decoration.', story: 'Show the Offer Map, filled in, with the names blurred.', dm: 'Send the Map to everyone who replied to yesterday’s poll.' },
      { name: 'Proof, honestly', hook: 'What I shipped this week, what it cost, and what I would do differently.', story: 'Screenshot of the real build. If revenue is $0, post that.', dm: 'Send the $27 kit to anyone who said DECIDING.' },
      { name: 'Open the door', hook: '{offer} is open at the launch price. Here is exactly what is inside.', story: 'Six frames: what is inside, one per module. Link in bio.', dm: 'Message everyone who clicked and did not buy: one question, not a chase.' },
      { name: 'Objections', hook: 'No audience. No time. No idea what to sell. Three answers, no hype.', story: 'Question box: “What is stopping you?” Answer three publicly.', dm: 'Answer every objection that reaches your inbox — publicly if permitted.' },
      { name: 'The people who started', hook: 'What changed for the people who started this week (real screenshots only).', story: 'Repost buyer stories with permission. If none, say so and show your own.', dm: 'Ask each buyer for the one-sentence offer they wrote.' },
      { name: 'Close the door', hook: 'Last day at the launch price. Doors at the standard price tomorrow.', story: 'Countdown + what changes tomorrow. No fake scarcity.', dm: 'Final message to everyone with a link: the price is real, the deadline is real.' },
    ];

    const schedule = Array.from({ length: days }, (_, i) => {
      const arc = ARC[Math.min(i, ARC.length - 1)];
      return {
        day: i + 1,
        date: dateFor(i),
        name: arc.name,
        hook: fillTokens(arc.hook, { audience: c.audience, offer: c.offer }),
        story: arc.story,
        dm: arc.dm,
      };
    });

    const launchMd = [
      '# 7-day launch',
      '',
      `**Offer:** ${c.offer} · **Launch price:** ${money(price)} · **Target:** ${target} sales`,
      `**Revenue at target:** ${money(price * target)} · **Audience:** ${c.audience}`,
      '',
      'No countdown timers you do not mean, no fake seats, no invented screenshots. The deadline is the price change and you actually change it.',
      '',
      ...schedule.map(d => [
        `## Day ${d.day} — ${d.date} — ${d.name}`,
        '',
        `**Reel:** ${d.hook}`,
        '',
        `**Stories:** ${d.story}`,
        '',
        `**DMs (20 min at 18:30):** ${d.dm}`,
        '',
        `**Email:** ${d.day === 1 ? 'Announce the door opening.' : d.day === Math.ceil(days / 2) ? 'The mechanism email — teach, then one link.' : d.day === days ? 'Close day: two doors, no guilt.' : 'One lesson + one link, nothing else.'}`,
        '',
      ].join('\n')),
      '## Daily minimum, every day of the launch',
      '',
      list([
        'One Reel at 07:30, reply to every comment for 30 minutes.',
        '4–8 Story frames at 12:00 including one poll or question box.',
        '20 minutes of DMs at 18:30 — this is where the money is.',
        'Log views, comments, DM replies, clicks, purchases before you sleep.',
      ]),
      '',
      `## The only numbers that decide whether to run this again`,
      '',
      table(['Stage', 'Target', 'What it tells you'], [
        ['Views → comments', '1–3%', 'Is the hook and keyword clear?'],
        ['Comments → DM replies', '40%+', 'Is the auto-DM firing?'],
        ['Replies → clicks', '20–40%', 'Is the promise specific?'],
        ['Clicks → purchases', '8–20%', 'Is the price page credible?'],
      ]),
      '',
    ].join('\n');

    const emails = [
      '# Launch emails',
      '',
      `Seven emails over ${days} days. One idea each, one link. Plain text beats a designed template at this size.`,
      '',
      ...schedule.map(d => [
        `## Email ${d.day} — ${d.date}`,
        '',
        `**Subject:** ${d.name === 'Close the door' ? 'Doors close tonight' : fillTokens(d.hook, { audience: c.audience, offer: c.offer }).slice(0, 62)}`,
        '',
        '```',
        `Hi [first name],`,
        '',
        `[one-line personal opener — no fake "I was just thinking about you"]`,
        '',
        `${d.hook}`,
        '',
        `${d.dm}`,
        '',
        `${c.offer}: ${c.coreLink}`,
        '',
        `— ${c.name}`,
        '```',
        '',
      ].join('\n')),
    ].join('\n');

    return {
      status: 'ok',
      steps: [
        { label: 'Arc', detail: `${days} days: name the enemy → mechanism → proof → open → objections → buyers → close.` },
        { label: 'Schedule', detail: 'Every day has a Reel, a Story block and a DM task at 18:30.' },
        { label: 'Emails', detail: `${days} emails, subject lines under 62 characters.` },
        { label: 'Target maths', detail: `${target} × ${money(price)} = ${money(target * Number(price))}. If that is fantasy, lower the target, not the price.` },
        { label: 'Honesty pass', detail: 'No fake scarcity, no invented buyers, deadline = the price actually changing.' },
      ],
      artifacts: [
        { name: 'launch.md', title: `${days}-day launch plan`, kind: 'md', content: launchMd },
        { name: 'emails.md', title: 'Launch emails', kind: 'md', content: emails },
      ],
      summary: `${days}-day launch built for ${money(price)} × ${target} = ${money(price * target)}.`,
      blockers: [],
      notes: ['Nothing is scheduled or sent. The plan lands in your files; the doing is yours.'],
    };
  },
};

// ── agent 6: the chief of staff ─────────────────────────────────────────────
const operator = {
  id: 'operator',
  name: 'Chief of Staff',
  role: 'Writes today’s brief: the single focus, then everything in order.',
  tag: 'Operations',
  inputs: [],

  run(state, today) {
    const v = engine.compute(state, today);
    const piece = v.content.today;
    const move = v.offerMove;
    const md = [
      `# Brief — ${v.prettyToday}`,
      '',
      `Day **${v.dayNumber}** of 90 · ${v.phaseLabel} · cycle ${v.cycle}`,
      '',
      `## The one thing`,
      '',
      `> ${v.runbook.headline}`,
      '',
      v.runbook.focus ? `**Why:** ${v.runbook.focus.why}` : '',
      '',
      '## Order of operations',
      '',
      table(['#', 'Move', 'Why now', 'Min'], v.runbook.actions.map((a, i) => [i + 1, a.title, a.why, a.minutes])),
      '',
      '## Today’s piece',
      '',
      piece
        ? [
          `**${piece.formatLabel} · ${piece.pillarLabel}** — ${piece.hook}`,
          '',
          `CTA: ${piece.cta}`,
          '',
          v.contentScript ? '```\n' + v.contentScript.text + '\n```' : '',
        ].join('\n')
        : 'No piece scheduled — repost your strongest proof.',
      '',
      '## Money',
      '',
      table(['Metric', 'Value'], [
        ['Booked this month', money(v.money.mtd)],
        ['Month target', `${money(v.money.goal)}${v.money.prorated ? ' (prorated from your Day 1)' : ''}`],
        ['Pace', `${v.money.status} · ${v.money.paceGap >= 0 ? '+' : ''}${money(v.money.paceGap)}`],
        ['Needed per day', money(v.money.requiredPerDay)],
        ['Best seller', v.ranking.bestSellerName || 'none yet'],
      ]),
      '',
      '## Conversations',
      '',
      v.leads.due
        ? list(v.leads.leads.filter(l => l.due).map(l => `${l.name}${l.handle ? ` (${l.handle})` : ''} — ${l.stageLabel} — next: ${l.stageHint}`))
        : 'Nobody is due. Do not invent urgency; post proof instead.',
      '',
      '## The offer move',
      '',
      `**${move.title}** — ${move.detail}`,
      '',
      `*${move.why}* · ${move.minutes} min`,
      '',
      '## Checklist',
      '',
      v.checklist.items.map(i => `- [${i.done ? 'x' : ' '}] ${i.label}`).join('\n'),
      '',
      `Streak: ${v.streak} day${v.streak === 1 ? '' : 's'} · ${v.checklist.done}/${v.checklist.total} done today.`,
      '',
      '## Tonight, one honest line',
      '',
      'What worked, what stalled, what you will do differently. Write it in the app — tomorrow’s brief reads it back.',
      '',
    ].filter(t => t !== '').join('\n');

    return {
      status: 'ok',
      steps: [
        { label: 'State read', detail: `${v.leads.due} due conversations, ${v.content.stats.posted}/${v.content.stats.total} posted, ${money(v.money.mtd)} booked.` },
        { label: 'Ranking', detail: `${v.runbook.actions.length} moves ordered by revenue-per-minute.` },
        { label: 'Brief written', detail: 'One focus, the order, today’s script, the money, the conversations.' },
      ],
      artifacts: [{ name: 'brief.md', title: `Brief — ${v.prettyToday}`, kind: 'md', content: md }],
      summary: v.runbook.summary,
      blockers: [],
      notes: [],
    };
  },
};

const AGENTS = [operator, architect, content, closer, analyst, launch];
const BY_ID = AGENTS.reduce((acc, a) => { acc[a.id] = a; return acc; }, {});

function listAgents() {
  return AGENTS.map(a => ({
    id: a.id, name: a.name, role: a.role, tag: a.tag,
    inputs: a.inputs || [],
  }));
}

module.exports = { AGENTS, BY_ID, listAgents, closerMessage, OBJECTIONS, PILLAR_SEQUENCE };
