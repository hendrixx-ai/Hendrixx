// ─────────────────────────────────────────────────────────────────────────────
// playbook.js — the Buyable Brand plan, encoded as data.
//
// Every line here is lifted from BUYABLE-BRAND-BUSINESS-PLAN.md so the app and
// the plan cannot drift. Copy that uses a specific (a number, a customer, a
// testimonial) is a [bracketed placeholder] — the app never invents proof.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

// ── Offer ladder ────────────────────────────────────────────────────────────
// status: idea → building → live → proven
const OFFERS = [
  {
    id: 'map',
    layer: 'lead',
    name: 'The Buyable Offer Map',
    price: 0,
    status: 'idea',
    format: '1-page PDF (Canva) + optional 3-minute Loom',
    promise: 'Fill this in and you have a one-sentence offer you could sell this month.',
    role: 'Email + broadcast list. Top of every funnel.',
    next: 'Draft the one-pager — 7 lines, no design rabbit hole.',
    costNote: 'Free. Never charge for this.',
  },
  {
    id: 'weekend',
    layer: 'tripwire',
    name: 'First Product in a Weekend',
    price: 27,
    status: 'idea',
    format: 'Short guide + Notion checklist + Canva mockups + 4–6 looms (under 90 min)',
    promise: 'A finished first digital product by Sunday night — not a course, a weekend.',
    role: 'First yes, filters buyers, feeds the core offer.',
    next: 'Build YOUR v1 this week. You cannot sell "ship v1" if you have not shipped v1.',
    costNote: '$27 standard · $19 launch · $37 after 10 reviews',
  },
  {
    id: 'brand',
    layer: 'core',
    name: 'The Buyable Brand',
    price: 147,
    status: 'idea',
    format: '8 modules (video + written) + templates + swipe files + 14-day install plan',
    promise: 'In 14 days, install a buyable personal brand and your first digital product.',
    role: 'Main revenue. Carries the $10k/month system.',
    next: 'Open at $97 for the first 30 days, $147 after. Record Modules 0–8 as looms.',
    costNote: 'Launch $97 · Standard $147 · With feedback $297',
  },
  {
    id: 'review',
    layer: 'upsell',
    name: 'Offer + Bio Review',
    price: 297,
    status: 'idea',
    format: 'Async teardown, one round of written feedback',
    promise: 'A named offer and a bio that can take payments — reviewed line by line.',
    role: 'Margin + case studies. Add only when DMs outpace you.',
    next: 'Do not build this until the core offer is selling without force.',
    costNote: '$297 · first 20 buyers get a written teardown',
  },
  {
    id: 'circle',
    layer: 'later',
    name: 'Buyable Inner Circle',
    price: 497,
    status: 'idea',
    format: '4-week group round, monthly',
    promise: 'Install the system with other beginners and get your offers reviewed live.',
    role: 'Fewer sales, same money. Only after the core proves itself.',
    next: 'Decide at day 61–90, based on numbers — not ambition.',
    costNote: '$497 · later, not month one',
  },
];

// ── Content pillars (locked mix) ────────────────────────────────────────────
const PILLARS = {
  A: { key: 'A', label: 'Offer education', share: 30, job: 'Teach packaging, pricing, product types', color: 'blue' },
  B: { key: 'B', label: 'Taste = money', share: 20, job: 'Show why aesthetics sell', color: 'gold' },
  C: { key: 'C', label: 'Build in public', share: 20, job: 'Authority. Real numbers, screens, drafts', color: 'green' },
  D: { key: 'D', label: 'Beginner therapy', share: 15, job: 'Name their fear, then give a next step', color: 'rose' },
  E: { key: 'E', label: 'Proof / CTA', share: 15, job: 'Direct selling, teardowns, comment keyword', color: 'violet' },
};

// ── 30-day calendar (Meta-native: Instagram first, Facebook twin) ───────────
const CONTENT = [
  { day: 1, pillar: 'C', format: 'R', hook: 'Day 1 of building a buyable brand from zero. I’ll post the revenue, even if it’s $0.', cta: 'Follow + comment BRAND' },
  { day: 2, pillar: 'A', format: 'C', hook: 'Your bio is not an offer. 7 lines that make you unbuyable.', cta: 'Save this' },
  { day: 3, pillar: 'D', format: 'R', hook: 'You don’t need 10k followers to sell a $27 product.', cta: 'Comment BRAND' },
  { day: 4, pillar: 'B', format: 'R', hook: 'Ugly offer + pretty feed = $0. Flip it.', cta: 'Share to a friend who needs this' },
  { day: 5, pillar: 'E', format: 'C', hook: 'Free: The Buyable Offer Map — here’s what’s inside.', cta: 'Comment MAP' },
  { day: 6, pillar: 'C', format: 'R+F', hook: 'I filmed the first product files on my phone. Here’s the folder.', cta: 'Reply READY' },
  { day: 7, pillar: 'A', format: 'R', hook: 'Offer first, aesthetic second, audience third.', cta: 'Comment BRAND' },

  { day: 8, pillar: 'A', format: 'C', hook: 'The Buyable Offer formula (steal this sentence).', cta: 'Save + comment OFFER' },
  { day: 9, pillar: 'B', format: 'R', hook: 'Your taste is the product. You’re just not packaging it.', cta: 'Comment BRAND' },
  { day: 10, pillar: 'D', format: 'R', hook: 'Ambitious but unpaid? This is the real reason.', cta: 'Question box in Stories' },
  { day: 11, pillar: 'E', format: 'C', hook: 'Bio teardown: the $0 bio vs the buyable bio.', cta: 'Comment BIO' },
  { day: 12, pillar: 'C', format: 'R+F', hook: 'Checkout link is live. Followers: still tiny. That’s the point.', cta: 'Link in bio — $27 kit' },
  { day: 13, pillar: 'A', format: 'R', hook: '$27 vs $147: what beginners should sell first.', cta: 'Comment 27' },
  { day: 14, pillar: 'E', format: 'R', hook: 'If you want the first-product kit, comment WEEKEND.', cta: 'Keyword WEEKEND' },

  { day: 15, pillar: 'C', format: 'C', hook: 'What’s inside my $147 system (no mystery box).', cta: 'Comment 147' },
  { day: 16, pillar: 'A', format: 'R', hook: 'How the comment → DM → purchase funnel works. Watch me do it.', cta: 'Comment BRAND' },
  { day: 17, pillar: 'B', format: 'R', hook: 'Canva is not a personality. Paid taste looks like this.', cta: 'Share this' },
  { day: 18, pillar: 'D', format: 'F+R', hook: 'I was addicted to tutorials. Then I shipped an ugly v1.', cta: 'Reply READY' },
  { day: 19, pillar: 'E', format: 'C', hook: 'The 14-day install, day by day.', cta: 'Comment BRAND' },
  { day: 20, pillar: 'C', format: 'R', hook: 'Unfiltered: the DMs, the $0 days, the first yes (or the wait).', cta: 'Proof screenshot' },
  { day: 21, pillar: 'E', format: 'R', hook: 'Mid-month close: launch price ends in 7 days.', cta: 'Comment 147' },

  { day: 22, pillar: 'A', format: 'C', hook: 'First 10 sales with a small account — who I actually messaged.', cta: 'Save this' },
  { day: 23, pillar: 'B', format: 'R', hook: 'Digital products aren’t dead. Ugly ones are.', cta: 'Comment BRAND' },
  { day: 24, pillar: 'D', format: 'R', hook: 'If you’re still “researching,” you’re hiding.', cta: 'Question box: what’s the stall?' },
  { day: 25, pillar: 'E', format: 'C', hook: 'Objections: no audience / no skill / no time / no money.', cta: 'Comment 147' },
  { day: 26, pillar: 'C', format: 'R+F', hook: 'Public revenue + the lesson. And the price goes up.', cta: 'Link in bio' },
  { day: 27, pillar: 'A', format: 'R', hook: 'I’ll name your offer in the comments. Drop your skill.', cta: 'Engagement bait that sells' },
  { day: 28, pillar: 'E', format: 'R', hook: 'Last day at $97. Doors open at $147 tomorrow.', cta: 'Comment 147' },
  { day: 29, pillar: 'C', format: 'C', hook: '29 days: what I’d repeat, what I’d kill.', cta: 'Follow for the next 30' },
  { day: 30, pillar: 'E', format: 'R', hook: 'If you’re starting from zero next month, start here: map + system.', cta: 'Comment BRAND' },
];

const FORMAT_LABELS = {
  R: 'Reel',
  C: 'Carousel',
  'R+F': 'Reel + FB post',
  'F+R': 'FB post + Reel',
  S: 'Story block',
};

// ── 90-day execution plan ───────────────────────────────────────────────────
const PLAN = [
  {
    id: 'foundation',
    label: 'Days 1–7 — Foundation',
    from: 1,
    to: 7,
    outcome: 'Name, bio, colours, highlights locked. Offer Map drafted. Checkout page exists even if it says “coming soon”.',
    tasks: [
      'Lock the name, bio Option A, colours and highlights',
      'Draft The Buyable Offer Map (the lead magnet)',
      'Open Stan Store + a “coming soon” $147 waitlist page',
      'Film week-1 Reels (5 hooks, one outfit, one location)',
      'Post Day 1 build-in-public even if no one is watching',
    ],
  },
  {
    id: 'tripwire',
    label: 'Days 8–14 — Tripwire live',
    from: 8,
    to: 14,
    outcome: 'A real $27 product you built yourself, a working keyword auto-DM, and the first sales done in DMs.',
    tasks: [
      'Build First Product in a Weekend ($27) as your own first product',
      'Connect ManyChat (or your DM tool) to the comment keyword',
      'Sell the $27 kit in DMs to everyone who replies',
      'Put the free Map on an email gate and deliver it manually if needed',
    ],
  },
  {
    id: 'core',
    label: 'Days 15–30 — Core offer v1',
    from: 15,
    to: 30,
    outcome: 'Modules 0–8 recorded imperfect, first buyers onboarded at $97, five testimonials on file.',
    tasks: [
      'Record Modules 0–8 as looms — imperfect is the rule',
      'Enroll the first buyers at $97 and onboard them personally',
      'Collect 5 testimonials / screenshots',
      'Write the 7-email sequence and put it live',
    ],
  },
  {
    id: 'raise',
    label: 'Days 31–60 — Prove and raise',
    from: 31,
    to: 60,
    outcome: 'Core at $147, a weekly public teardown, the $297 review added only if DMs demand it, email list past 200.',
    tasks: [
      'Raise the core offer to $147',
      'Publish one public teardown every week',
      'Add the $297 review only when DMs outpace you',
      'Grow the email list past 200',
    ],
  },
  {
    id: 'launch',
    label: 'Days 61–90 — Mini-launch',
    from: 61,
    to: 90,
    outcome: 'A 7-day mini-launch done in public, a decision on the Inner Circle backed by numbers, and a 90-day review.',
    tasks: [
      'Run the first 7-day mini-launch (content + Stories + emails)',
      'Decide the Inner Circle only if the core sells without forcing',
      'Review the numbers against the $10k math — adjust the mix, not the identity',
      'Get to 10+ testimonials on file',
    ],
  },
];

// ── DM scripts (verbatim from the plan; links filled from settings) ─────────
const SCRIPTS = [
  {
    id: 'dm1',
    stage: 'trigger',
    title: 'Message 1 — auto-DM on BRAND / MAP',
    when: 'The second someone comments the keyword.',
    body:
`Got you.

Here’s the free Buyable Offer Map — the one-pager I wish I had before I posted 100 times with nothing to sell.

{{mapLink}}

Quick question so I send you the right next step:
Do you already have something to sell, or are you still deciding?
Reply: SELLING or DECIDING`,
  },
  {
    id: 'dm2a',
    stage: 'deciding',
    title: 'Message 2a — they reply DECIDING',
    when: 'No product yet. Do not sell the big thing first.',
    body:
`Then don’t start with a 40-hour course.

Start with a weekend v1.

I made a $27 kit that walks you through naming + packaging the first product (templates included).

Want me to send that, or do you want the full 14-day Buyable Brand system ($147) so the Instagram side is installed too?

Reply 27 or 147`,
  },
  {
    id: 'dm2b',
    stage: 'selling',
    title: 'Message 2b — they reply SELLING',
    when: 'They have something. The leak is the account, not the product.',
    body:
`Good. Then your problem is probably not “more content.”

It’s that the account doesn’t convert.

The Buyable Brand is the 14-day install: offer, profile, content pillars, and the Reel → DM → checkout funnel.

I can send the link — $147.

If you want me to personally teardown your offer + bio, that’s the $297 version.

Reply 147 or REVIEW`,
  },
  {
    id: 'dm3',
    stage: 'silent',
    title: 'Message 3 — silent after the Map (wait 24h)',
    when: 'They downloaded and vanished. One nudge, no guilt.',
    body:
`No pressure — most people screenshot the map and disappear.

If you want, tell me:
1) your skill
2) who you want to help

I’ll tell you what I’d sell first. One sentence.`,
  },
  {
    id: 'dm4',
    stage: 'broke',
    title: 'Message 4 — “I’m broke” / “too expensive”',
    when: 'Never argue price. Downgrade, don’t discount.',
    body:
`Totally fair.

Do the map this week. Build the $27 version of YOUR product first (that’s how you afford the next level).

If you want the exact kit I use to do that, it’s $27. Not a course. A weekend.

Link: {{tripwireLink}}

The $147 isn’t going anywhere.`,
  },
  {
    id: 'dm5',
    stage: 'hot',
    title: 'Message 5 — “send the link”',
    when: 'Buying temperature hot. Send one link and stop talking.',
    body:
`Here you go — The Buyable Brand:
{{coreLink}}

If anything in checkout breaks, reply here. I’ll sort it.

After you join, start at Module 0. Don’t skip the ugly-v1 rule.`,
  },
  {
    id: 'dm6',
    stage: 'review',
    title: 'Message 6 — they ask for the review',
    when: 'Only after they have a named offer to review.',
    body:
`Send me:
1) your one-sentence offer
2) your bio
3) the link you send people to

I’ll tear it down in writing and send one round of notes — $297 here: {{reviewLink}}

If the offer isn’t named yet, do the $147 install first. The review is wasted before that.`,
  },
];

const KEYWORDS = [
  { keyword: 'BRAND', usedOn: 'Most Reels', sends: 'Offer Map + SELLING/DECIDING qualifier', goal: 'Default net' },
  { keyword: 'MAP', usedOn: 'Explicit lead-magnet Reels', sends: 'Map only', goal: 'List growth' },
  { keyword: 'WEEKEND', usedOn: 'Product-building tutorials', sends: '$27 kit', goal: 'Tripwire' },
  { keyword: '147', usedOn: 'Proof / what’s-inside / deadline', sends: 'Core checkout', goal: 'Direct sale' },
  { keyword: 'BIO', usedOn: 'Teardown content', sends: '3-question bio audit in DM', goal: 'Warm consult' },
  { keyword: 'READY', usedOn: 'Stories', sends: 'Same as BRAND', goal: 'Catch story tap-throughs' },
];

// ── 7-email sequence ────────────────────────────────────────────────────────
const EMAILS = [
  { id: 'e1', day: 0, subject: 'Your Buyable Offer Map (open this)', job: 'Deliver the PDF. Tell them to fill lines 1–3 today. Ask for their one-sentence offer in a reply.' },
  { id: 'e2', day: 1, subject: 'Pretty is not a business model', job: 'Aesthetic accounts vs buyable accounts. Soft CTA: the $27 kit if they have no product.' },
  { id: 'e3', day: 2, subject: 'Offer first. Then the pretty grid.', job: 'Teach the backwards-order mistake. CTA: reply READY.' },
  { id: 'e4', day: 4, subject: '$0 followers is not the blocker', job: 'Your real numbers, screenshot if possible. CTA: $147 link. P.S. $27 if they’re not there yet.' },
  { id: 'e5', day: 6, subject: 'This bio cannot take payments', job: 'Before/after teardown. CTA: BIO keyword or checkout.' },
  { id: 'e6', day: 8, subject: '“I’ll build the product when I have time”', job: 'The weekend-v1 argument + the guarantee. CTA: $147.' },
  { id: 'e7', day: 10, subject: 'Two doors', job: 'Door 1: $27 kit. Door 2: $147 install. If they do nothing, they already know how that ends.' },
];

// ── Funnel benchmarks (from the plan) ───────────────────────────────────────
const BENCHMARKS = [
  { key: 'commentRate', label: 'Views → comments', min: 1, max: 3, unit: '%', healthy: '1–3%', fix: 'Your keyword is unclear or buried. Say it twice and put it on screen.' },
  { key: 'dmRate', label: 'Comments → DM replies', min: 40, max: 100, unit: '%', healthy: '40%+', fix: 'The auto-DM is not firing or the keyword is not trained. Test it yourself from a second account.' },
  { key: 'clickRate', label: 'Replies → checkout clicks', min: 20, max: 40, unit: '%', healthy: '20–40%', fix: 'The promise is fuzzy. Send one link and one next step — no PDF dumps.' },
  { key: 'closeRate', label: 'Clicks → purchases', min: 8, max: 20, unit: '%', healthy: '8–20%', fix: 'The price page is weak or trust is missing. Add proof, the guarantee, and what is inside.' },
];

// ── Voice: teaching beats per pillar (no invented specifics) ────────────────
const TEACHING = {
  A: [
    'Most beginners do it backwards: aesthetic first, offer last.',
    'The formula: I help [who] get [result] without [pain] in [time].',
    'Price before you feel ready. $27 is a decision, not a valuation.',
  ],
  B: [
    'Taste is only leverage when it is packaged.',
    'A pretty grid with no checkout is a moodboard.',
    'Beautiful and unspecified is unbuyable.',
  ],
  C: [
    'The honest number this week: [your real number — never inflate it].',
    'What I shipped: [file or screen]. What it cost: [time].',
    'What I would do differently: [one line].',
  ],
  D: [
    'You do not need followers. You need something to sell them.',
    'Consistency beats virality for the first 90 days.',
    'Pick one skill, one person, one outcome.',
  ],
  E: [
    'The free Map names your offer. That is the whole lead magnet.',
    'The system installs the profile, the content and the funnel.',
    'One link. One next step. No PDF dumps.',
  ],
};

const SCRIPT_FRAMES = {
  R: ['HOOK (0–3s)', 'PROBLEM (3–20s)', 'MECHANISM (20–40s)', 'PROOF (40–55s)', 'COMMAND (55–60s)'],
  C: ['SLIDE 1 — hook', 'SLIDES 2–8 — one idea each', 'SLIDE 9 — proof or example', 'SLIDE 10 — CTA'],
  'R+F': ['HOOK (0–3s)', 'PROBLEM (3–20s)', 'MECHANISM (20–40s)', 'PROOF (40–55s)', 'COMMAND (55–60s)'],
  'F+R': ['HOOK (0–3s)', 'PROBLEM (3–20s)', 'MECHANISM (20–40s)', 'PROOF (40–55s)', 'COMMAND (55–60s)'],
};

const BIO_OPTIONS = [
  {
    id: 'A',
    label: 'A — clearest (recommended)',
    text: `I make your taste buyable.

Digital products + a brand people pay.
Starting from zero, in public.

↓ Free: Buyable Offer Map`,
  },
  {
    id: 'B',
    label: 'B — beginner-direct',
    text: `For ambitious beginners with skills and $0 offers.

Learn the 14-day install:
Offer → Aesthetic → Funnel.

Map is free ↓`,
  },
  {
    id: 'C',
    label: 'C — authority / documentary',
    text: `Building a $10k/month buyable brand from zero.

No fake cars. Just offers, content, numbers.

Free Offer Map ↓`,
  },
];


const HOOKS = [
  'Pretty Instagram. Empty wallet. Here’s the part nobody posts.',
  'If your bio says “entrepreneur | creative | ✨vibes✨” you don’t have a business.',
  'I started from zero. I sold a digital product before I had 1,000 followers.',
  'Stop making content. Start making something people can buy.',
  'The most expensive mistake beginners make: building an audience with nothing to sell them.',
  'You don’t need a course. You need an offer that fits in one sentence.',
  'Day 1 of building a buyable brand from zero — I’ll post the revenue, even if it’s $0.',
  'Canva is not a personality. Here’s how creatives actually get paid.',
  'If I had to make my first $1,000 on Instagram in 30 days, I would not post this…',
  'Your taste is the product. You’re just not packaging it.',
  'Faceless page vs personal brand: only one of these can charge $147.',
  'Comment “BROKE” if you have skills and no offer. I’ll tell you what to sell.',
  'This bio made $0. This bio can take payments. Spot the difference.',
  'Digital products aren’t dead. Ugly digital products are.',
  'You don’t have a visibility problem. You have a “nothing to checkout” problem.',
  'I packed a $147 offer in a weekend. Here’s every file that went in it.',
  'Ambitious but unpaid? This 14-day install is for you.',
  'The algorithm doesn’t pay you. Buyers do.',
  'Save this if you want a personal brand that isn’t just a moodboard.',
  'I’m going to build a $10k/month brand in public. No fake Lamborghini. Just the work.',
];

const BIO = {
  promise: 'In 14 days, install a buyable personal brand and your first digital product — without a big following and without looking like a slimy guru.',
  mechanism: 'Offer first, aesthetic second, audience third.',
  enemy: 'Aesthetic accounts with no offer. Guru accounts with no taste. Faceless AI pages with no soul.',
  oneLine: 'Help ambitious beginners turn taste into a named digital offer and a small Instagram that can sell it — documented in public as you do it yourself.',
  category: 'Personal brand systems for people who will actually sell something.',
  guarantee: 'Work the 14-day install. If you still don’t have a named offer and a live checkout link, I’ll refund you. (The guarantee is installation — never income.)',
};

const DONTS = [
  'Waiting for a “perfect” course before selling.',
  'Rebranding every 11 days.',
  'Posting only quotes and sunsets.',
  'Buying followers.',
  'Teaching Instagram growth with no product.',
  'Guaranteeing $10k.',
  'Hiding your face forever and hiding the product. Pick at least one to show.',
  'Building software, a membership and a podcast in month 1.',
];

const CADENCE = [
  { time: '07:30', label: 'Post the Reel (pre-batched)', detail: 'Boost the first 30 minutes of comments.' },
  { time: '12:00', label: '4–8 Story frames', detail: 'Behind the scenes, a poll, one piece of proof.' },
  { time: '18:30', label: 'DM shift', detail: 'This is the sales shift — not a scroll.' },
  { time: 'Sunday', label: '90-minute batch', detail: '5 hooks, 5 scripts, film in one outfit, edit with captions.' },
];

const RULES = [
  'Nothing is sent from this app. Approving, copying and logging are local. You send, post and sell.',
  'Never invent a number, a testimonial or a customer. Placeholders stay bracketed until real.',
  'Never guarantee income. The guarantee is installation: a named offer and a live checkout link.',
  'One keyword per Reel. One link per DM. Complexity is how you hide.',
];

module.exports = {
  OFFERS, PILLARS, CONTENT, FORMAT_LABELS, PLAN, SCRIPTS, KEYWORDS, EMAILS,
  BENCHMARKS, TEACHING, SCRIPT_FRAMES, BIO_OPTIONS, CADENCE, RULES,
  HOOKS, BIO, DONTS,
};
