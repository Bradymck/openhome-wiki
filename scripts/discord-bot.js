#!/usr/bin/env node
/**
 * OpenHome Intel Discord Bot
 *
 * Active (responds) in:   #openhome-intel only
 * Passive (monitors) in:  all other text channels with read access
 *
 * Features:
 *   - Conversational Q&A backed by wiki knowledge base
 *   - URL fetching: crawls links, checks llms.txt, parses GitHub READMEs
 *   - Live marketplace queries via OpenHome API
 *   - Community signal classification: spam, scams, sentiment, help needs
 *   - Daily brief with community health section
 *
 * Required env vars:
 *   DISCORD_BOT_TOKEN      — Discord bot token
 *   OPENAI_API_KEY         — OpenAI API key (gpt-4o-mini)
 *   INTEL_CHANNEL_ID       — Active channel ID (default: 1491929017576591401)
 *   OPENHOME_API_KEY       — OpenHome API key (for live marketplace queries, optional)
 */

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const { spawnSync } = require("child_process");
const { Pool } = require("pg");

// ── Config ───────────────────────────────────────────────────────────────────

const INTEL_CHANNEL_ID = process.env.INTEL_CHANNEL_ID || "1491929017576591401";
const WIKI_PATH = path.join(__dirname, "../wiki");
const MODEL = "gpt-4o-mini";
const MAX_WIKI_CHARS = 12000;
const BRIEF_HOUR_UTC = 13; // 8am ET
const URL_FETCH_TIMEOUT_MS = 8000;
const MARKETPLACE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const SIGNAL_WINDOW_MS = 24 * 60 * 60 * 1000;   // 24h rolling window

// Signal types for community monitoring
const SIGNAL = {
  SPAM:        "spam",
  SCAM:        "scam",
  NEEDS_HELP:  "needs-help",
  DISGRUNTLED: "disgruntled",
  POSITIVE:    "positive",
  NORMAL:      "normal",
};

// ── Credential resolution ────────────────────────────────────────────────────

function getSecret(envKey, keychainService) {
  if (process.env[envKey]) return process.env[envKey];
  const result = spawnSync(
    "security",
    ["find-generic-password", "-a", "openclaw", "-s", keychainService, "-w"],
    { encoding: "utf8" }
  );
  return result.stdout?.trim() || null;
}

const DISCORD_BOT_TOKEN = getSecret("DISCORD_BOT_TOKEN", "openhome-discord-bot-token");
const OPENAI_API_KEY    = getSecret("OPENAI_API_KEY",    "openai-api-key");
const OPENHOME_API_KEY  = getSecret("OPENHOME_API_KEY",  "openhome-api-key");

if (!DISCORD_BOT_TOKEN || !OPENAI_API_KEY) {
  console.error("ERROR: Missing DISCORD_BOT_TOKEN or OPENAI_API_KEY");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ── Knowledge base ───────────────────────────────────────────────────────────

function loadWikiContext(maxChars = MAX_WIKI_CHARS) {
  if (!fs.existsSync(WIKI_PATH)) {
    return "No wiki content yet. Run openhome-ingest to generate it.";
  }
  const sections = ["platform", "abilities", "builders", "concepts", "roadmap", "team", "guides"];
  const pages = [];
  for (const section of sections) {
    const sectionDir = path.join(WIKI_PATH, section);
    if (!fs.existsSync(sectionDir)) continue;
    for (const file of fs.readdirSync(sectionDir).sort()) {
      if (!file.endsWith(".md")) continue;
      const content = fs.readFileSync(path.join(sectionDir, file), "utf8");
      pages.push(`### ${section}/${file.replace(".md", "")}\n${content}`);
    }
  }
  let combined = pages.join("\n\n");
  if (combined.length > maxChars) {
    combined = combined.slice(0, maxChars) + "\n\n[... context truncated ...]";
  }
  return combined || "Wiki is empty — run openhome-ingest first.";
}

function getLastUpdated() {
  const indexPath = path.join(WIKI_PATH, "index.md");
  if (!fs.existsSync(indexPath)) return "unknown";
  const content = fs.readFileSync(indexPath, "utf8");
  const match = content.match(/Last updated: (\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "unknown";
}

// ── URL fetching + llms.txt ───────────────────────────────────────────────────

// Matches plain URLs and Discord's <url> suppressed-embed format
const URL_PATTERN = /<?(https?:\/\/[^\s<>"']+)>?/g;

function fetchUrl(url, timeoutMs = URL_FETCH_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const timer = setTimeout(() => resolve(null), timeoutMs);
    try {
      const req = lib.get(url, { headers: { "User-Agent": "OpenHome-Intel-Bot/1.0" } }, (res) => {
        if (res.statusCode >= 400) { clearTimeout(timer); resolve(null); return; }
        // Follow one redirect
        if (res.statusCode >= 300 && res.headers.location) {
          clearTimeout(timer);
          fetchUrl(res.headers.location, timeoutMs).then(resolve);
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          clearTimeout(timer);
          const text = Buffer.concat(chunks).toString("utf8").slice(0, 12000);
          resolve(text);
        });
        res.on("error", () => { clearTimeout(timer); resolve(null); });
      });
      req.on("error", () => { clearTimeout(timer); resolve(null); });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

function extractDomain(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function isGitHubRepo(url) {
  return /^https?:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(url);
}

function githubRawReadme(url) {
  // Convert github.com/owner/repo → raw.githubusercontent.com/owner/repo/main/README.md
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/main/README.md`;
}

async function fetchUrlContext(url) {
  const results = [];

  // 1. Check llms.txt at root domain
  const domain = extractDomain(url);
  if (domain) {
    const llmsTxt = await fetchUrl(`${domain}/llms.txt`);
    if (llmsTxt && llmsTxt.trim().length > 50) {
      results.push(`**llms.txt from ${domain}:**\n${llmsTxt.slice(0, 3000)}`);
    }
  }

  // 2. GitHub repo → fetch README directly
  if (isGitHubRepo(url)) {
    const readmeUrl = githubRawReadme(url);
    if (readmeUrl) {
      const readme = await fetchUrl(readmeUrl);
      if (readme) results.push(`**GitHub README:**\n${readme.slice(0, 4000)}`);
    }
  } else if (!results.length) {
    // 3. Fetch the page itself, strip HTML tags for readability
    const raw = await fetchUrl(url);
    if (raw) {
      const text = raw
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s{3,}/g, "\n")
        .slice(0, 4000);
      if (text.trim().length > 100) {
        results.push(`**Page content from ${url}:**\n${text}`);
      }
    }
  }

  return results.join("\n\n") || null;
}

async function resolveUrlsInMessage(content) {
  // Extract capture group 1 (the URL without angle brackets)
  const rawMatches = [];
  const re = /<?(https?:\/\/[^\s<>"']+)>?/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    rawMatches.push(m[1]);
  }
  const urls = [...new Set(rawMatches)].slice(0, 3); // max 3 per msg
  if (!urls.length) return null;

  console.log(`[url-fetch] resolving ${urls.length} URL(s): ${urls.join(", ")}`);
  const contexts = await Promise.all(urls.map(fetchUrlContext));
  const valid = contexts.filter(Boolean);
  console.log(`[url-fetch] fetched ${valid.length}/${urls.length} successfully`);
  return valid.length ? valid.join("\n\n---\n\n") : null;
}

// ── Live marketplace queries ──────────────────────────────────────────────────

let marketplaceCache = null;
let marketplaceCachedAt = 0;

async function getLiveMarketplace() {
  if (!OPENHOME_API_KEY) return null;
  if (Date.now() - marketplaceCachedAt < MARKETPLACE_CACHE_TTL_MS) return marketplaceCache;

  try {
    // Use get_personalities — lists all personalities + their installed abilities
    // (get-all-capability endpoint not yet deployed per CLI fallback logic)
    const res = await fetch("https://app.openhome.com/api/sdk/get_personalities", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENHOME_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ api_key: OPENHOME_API_KEY, with_image: false }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const personalities = data?.personalities || [];

    const lines = ["**Live personalities on this account:**"];
    for (const p of personalities) {
      const caps = (p.matching_capabilities || []).filter(Boolean);
      lines.push(`- **${p.name}** — ${caps.length ? `abilities: ${caps.join(", ")}` : "no abilities installed"}`);
    }

    marketplaceCache = lines.join("\n");
    marketplaceCachedAt = Date.now();
    return marketplaceCache;
  } catch {
    return null;
  }
}

// ── Community signal classifier ───────────────────────────────────────────────

// Fast heuristic pre-filter — catch obvious patterns without burning API tokens
const SCAM_PATTERNS = [
  /\b(dm me|message me).{0,30}(profit|earn|crypto|nft|free money)/i,
  /\b(guaranteed|100%)\s+(profit|return|roi)/i,
  /\b(pump|moon|rug|ape in)\b.{0,20}\b(now|fast|quick|today)/i,
  /\bhttps?:\/\/[^\s]+\.(xyz|top|click|tk|ml|ga)\b/i,
  /\b(airdrop|giveaway).{0,30}(wallet|seed|connect)/i,
  /connect.{0,15}(wallet|metamask|trust wallet).{0,30}(claim|receive|get)/i,
  /\bseed phrase\b/i,
  /\bsend.{0,10}(eth|bnb|sol|usdt).{0,20}(back|double|profit)/i,
];

const SPAM_PATTERNS = [
  /(.)\1{8,}/,       // character repetition
  /(https?:\/\/\S+\s*){4,}/i, // 4+ links in one message
  /\b(follow|sub|like).{0,20}back\b/i,
];

function quickSignalCheck(content) {
  for (const p of SCAM_PATTERNS) {
    if (p.test(content)) return SIGNAL.SCAM;
  }
  for (const p of SPAM_PATTERNS) {
    if (p.test(content)) return SIGNAL.SPAM;
  }
  return null; // needs LLM classification
}

// LLM classifier for nuanced signals (called only on non-obvious messages, rate-limited)
const classifierCooldowns = new Map();
const CLASSIFIER_USER_COOLDOWN_MS = 60_000; // max 1 LLM classify per user per minute

async function classifySignal(content, username, channelName) {
  const last = classifierCooldowns.get(username) || 0;
  if (Date.now() - last < CLASSIFIER_USER_COOLDOWN_MS) return SIGNAL.NORMAL;
  classifierCooldowns.set(username, Date.now());

  const prompt = `You are a community moderation classifier for OpenHome, a voice AI developer platform.

Classify this Discord message from @${username} in #${channelName}.

Message:
"""
${content.slice(0, 500)}
"""

Reply with EXACTLY one of these labels and nothing else:
- spam         (repetitive, off-topic self-promotion, flooding)
- scam         (crypto pump, phishing, fake giveaway, wallet draining)
- needs-help   (stuck, frustrated, asking for technical assistance)
- disgruntled  (expressing dissatisfaction with the platform, product, or team)
- positive     (excited, shipping something, celebrating progress)
- normal       (regular on-topic discussion)`;

  try {
    const res = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 10,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });
    const label = res.choices[0].message.content.trim().toLowerCase();
    return Object.values(SIGNAL).includes(label) ? label : SIGNAL.NORMAL;
  } catch {
    return SIGNAL.NORMAL;
  }
}

// ── Community health tracker ──────────────────────────────────────────────────

// Rolling 24h event log: { ts, userId, username, channelName, signal, excerpt }
const communityEvents = [];

async function recordSignal(userId, username, channelName, signal, content) {
  if (signal === SIGNAL.NORMAL) return;
  const excerpt = content.slice(0, 120);
  console.log(`[signal] @${username} #${channelName} → ${signal}`);

  if (db) {
    await db.query(
      "INSERT INTO community_signals (user_id, username, channel_name, signal, excerpt) VALUES ($1,$2,$3,$4,$5)",
      [userId, username, channelName, signal, excerpt]
    ).catch((e) => console.log("[signal] db error:", e.message));
    return;
  }

  // In-memory fallback
  const now = Date.now();
  while (communityEvents.length && communityEvents[0].ts < now - SIGNAL_WINDOW_MS) {
    communityEvents.shift();
  }
  communityEvents.push({ ts: now, userId, username, channelName, signal, excerpt });
}

async function getCommunityHealthSummary() {
  let events;

  if (db) {
    const res = await db.query(
      `SELECT username, channel_name AS "channelName", signal, excerpt
       FROM community_signals
       WHERE ts > NOW() - INTERVAL '24 hours'
       ORDER BY ts DESC LIMIT 200`
    ).catch(() => ({ rows: [] }));
    events = res.rows;
  } else {
    const cutoff = Date.now() - SIGNAL_WINDOW_MS;
    events = communityEvents.filter((e) => e.ts > cutoff);
  }

  if (!events.length) return null;

  const by = (sig) => events.filter((e) => e.signal === sig);
  const names = (arr) => [...new Set(arr.map((e) => `@${e.username}`))];
  const lines = ["**Community signals (last 24h):**"];

  const scams = by(SIGNAL.SCAM);
  if (scams.length) lines.push(`🚨 **Scam/fraud** (${scams.length}): ${names(scams).join(", ")}`);

  const spam = by(SIGNAL.SPAM);
  if (spam.length) lines.push(`🗑️ **Spam** (${spam.length}): ${names(spam).join(", ")}`);

  const disgruntled = by(SIGNAL.DISGRUNTLED);
  if (disgruntled.length) lines.push(`😤 **Disgruntled** (${disgruntled.length}): ${disgruntled.slice(0,5).map((e) => `@${e.username} in #${e.channelName}`).join(", ")}`);

  const needsHelp = by(SIGNAL.NEEDS_HELP);
  if (needsHelp.length) lines.push(`🙋 **Needs help** (${needsHelp.length}): ${needsHelp.slice(0,5).map((e) => `@${e.username} in #${e.channelName}`).join(", ")}`);

  const positive = by(SIGNAL.POSITIVE);
  if (positive.length) lines.push(`🚀 **Positive** (${positive.length}): ${names(positive).slice(0,8).join(", ")}`);

  return lines.join("\n");
}

// ── Passive monitoring handler ────────────────────────────────────────────────

async function handlePassiveMessage(message) {
  const content = message.content.trim();
  if (content.length < 10) return;

  const channelName = message.channel?.name || message.channelId;
  const username = message.author.username;
  const userId = message.author.id;

  // Fast heuristic check first — no API cost
  const quickSignal = quickSignalCheck(content);
  if (quickSignal === SIGNAL.SCAM || quickSignal === SIGNAL.SPAM) {
    recordSignal(userId, username, channelName, quickSignal, content);
    console.log(`[monitor] 🚨 ${quickSignal.toUpperCase()} detected from @${username} in #${channelName}`);
    return;
  }

  // LLM classify for nuanced signals (rate-limited per user)
  const signal = await classifySignal(content, username, channelName);
  if (signal !== SIGNAL.NORMAL) {
    recordSignal(userId, username, channelName, signal, content);
  }
}

// ── OpenHome Bot system prompt ────────────────────────────────────────────────

function buildSystemPrompt(wikiContext, urlContext, liveMarketplace) {
  const sections = [
    `You are the OpenHome Bot, a developer co-pilot for the OpenHome platform. You have deep expertise in OpenHome, voice AI development, and the Ability ecosystem. You are direct, knowledgeable, and energized — like the most plugged-in person in the Discord. You treat every developer as a pioneer.

IDENTITY & VOICE:
- Speak like a peer developer, not a support agent. Use "we" and "you're building" not "the platform allows users to."
- Use "ship" not "deploy." Use "ability" not "skill" or "plugin." Use "personality" not "assistant."
- Never use filler phrases like "Great question," "Absolutely," or "Of course." Just answer.
- Always end with one specific question that advances the developer's next step.
- Use Discord markdown (bold, bullet points, code blocks) for clarity.

KNOWLEDGE:
- OpenHome is a local, open-source voice AI platform with physical speakers — the alternative to Alexa/Google/Siri with no cloud lock-in.
- Personalities are the AI's soul — voice agents with their own style that adapt over time.
- Abilities are Python plugins (MatchingCapability classes) that extend Personalities. They run locally on the speaker using the CapabilityWorker SDK.
- The Marketplace is where abilities get discovered and installed by users.
- Grant program: $100 credits for first ability shipped, $1K at day 7, $5K–$20K at 30 days, up to $50K at 3–6 months.
- Key people: Jesse (CTO, @jesserank), Shannon (CEO, @openhome). Both active on X and Discord.
- Onboarding path: unbox → pair → app.openhome.com → explore personalities → read guides → code first ability → ship → post demo → grant application.
- The Live Editor is the fastest feedback loop for testing abilities.
- Spatial Intelligence is the frontier: ambient, always-on, context-aware abilities that understand the room without being asked.

URL & LINK HANDLING:
- This bot pre-fetches URLs before you respond. When LINKED CONTENT appears in your context, you have already read that page — act on it directly.
- NEVER say "I can't access links" or "I don't have the ability to browse" — that is false. The content is already in your context above.
- If linked content is present: lead with specific observations about what's actually there (code, README, features, structure). Don't summarize generically.
- If no linked content was fetched (fetch failed or no URL): say so honestly, don't pretend you read something you didn't.

CONVERSATION CONTEXT:
- The message history above shows this conversation. You have memory of the last several exchanges.
- NEVER respond as if each message is the first — reference prior context naturally.
- If someone mentioned a project, link, or idea earlier in this conversation, you remember it.

BOUNDARIES:
- NEVER promise specific grant approval or payouts. Say: "The grant structure is set up to reward exactly what you're building."
- NEVER provide legal or IP advice. Point to Discord where Jesse and Shannon engage directly.
- NEVER make up SDK syntax. Point to the Live Editor or GitHub repo instead.
- REFUSE to be a generic AI assistant. If asked something completely unrelated to OpenHome (poems, unrelated coding tasks, etc.), redirect: "I'm dialed in on OpenHome stuff — what are you building?" But treat anything shared in this channel — links, repos, ideas, questions — as OpenHome-related context and engage with it.
- If you don't know something specific, say so clearly — do not speculate.`,
  ];

  if (liveMarketplace) {
    sections.push(`LIVE MARKETPLACE (fetched ${new Date().toISOString().split("T")[0]}):\n${liveMarketplace}`);
  }

  if (urlContext) {
    sections.push(
      `LINKED CONTENT — FETCHED FROM URLS IN THIS MESSAGE:\n` +
      `You MUST reference this content in your response. Lead with what you actually found at the link.\n` +
      `Do NOT give a generic response when linked content is present — respond to what's actually there.\n` +
      `---\n${urlContext}\n---`
    );
  }

  sections.push(`WIKI CONTEXT (synthesized from Discord, GitHub, X/Twitter — last updated: ${getLastUpdated()}):\n---\n${wikiContext}`);

  return sections.join("\n\n");
}

// ── Q&A ───────────────────────────────────────────────────────────────────────

async function askAboutOpenHome(question, wikiContext, urlContext, liveMarketplace, history = []) {
  const systemPrompt = buildSystemPrompt(wikiContext, urlContext, liveMarketplace);
  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: question },
    ],
  });
  return response.choices[0].message.content;
}

// ── Daily brief ───────────────────────────────────────────────────────────────

async function generateDailyBrief(wikiContext, communityHealth, liveMarketplace) {
  const today = new Date().toISOString().split("T")[0];

  const systemLines = [
    "You are the OpenHome Intel bot. Generate a concise daily brief for the OpenHome team.",
    "Use Discord markdown. Keep it under 500 words.",
    "Structure (skip any section you have no data for):",
    "- **What's live** — active features/abilities",
    "- **In progress** — what's being built right now",
    "- **Community** — notable builder activity, shipping, momentum",
    "- **Needs attention** — people who need help, disgruntled members, unresolved issues",
    "- **Threats** — any spam/scam activity flagged in the last 24h",
    "- **Heads up** — anything else flagged as important or urgent",
    "Be factual, no filler. The team relies on this to know what's happening.",
  ];

  const userContent = [
    `Daily brief for ${today}.`,
    liveMarketplace ? `\nLive marketplace:\n${liveMarketplace}` : "",
    communityHealth ? `\nCommunity signals:\n${communityHealth}` : "",
    `\nWiki context:\n${wikiContext}`,
  ].filter(Boolean).join("\n");

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 700,
    messages: [
      { role: "system", content: systemLines.join("\n") },
      { role: "user", content: userContent },
    ],
  });
  return response.choices[0].message.content;
}

// ── Postgres (optional) ───────────────────────────────────────────────────────
// Falls back to in-memory if DATABASE_URL is not set.
// History is keyed per (channelId + userId) so multi-user conversations
// don't bleed into each other.

const db = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

async function initDb() {
  if (!db) {
    console.log("[db] No DATABASE_URL — using in-memory storage");
    return;
  }
  await db.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id          SERIAL PRIMARY KEY,
      channel_id  TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      username    TEXT NOT NULL,
      role        TEXT NOT NULL,
      content     TEXT NOT NULL,
      ts          TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS conversations_lookup
      ON conversations (channel_id, user_id, ts DESC);

    CREATE TABLE IF NOT EXISTS community_signals (
      id           SERIAL PRIMARY KEY,
      user_id      TEXT NOT NULL,
      username     TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      signal       TEXT NOT NULL,
      excerpt      TEXT,
      ts           TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS signals_ts ON community_signals (ts DESC);
  `);
  console.log("[db] Postgres ready");
}

// ── Conversation history ──────────────────────────────────────────────────────
// Keyed by channelId+userId so each person gets their own context thread.
// In a busy public channel this prevents A's conversation bleeding into B's.

const channelHistory = new Map(); // fallback when no DB
const MAX_HISTORY = 14; // 7 exchanges

function historyKey(channelId, userId) {
  return `${channelId}:${userId}`;
}

async function addToHistory(channelId, userId, username, role, content) {
  const key = historyKey(channelId, userId);

  if (db) {
    await db.query(
      "INSERT INTO conversations (channel_id, user_id, username, role, content) VALUES ($1,$2,$3,$4,$5)",
      [channelId, userId, username, role, content]
    );
    // Prune to last MAX_HISTORY rows for this user
    await db.query(`
      DELETE FROM conversations WHERE id IN (
        SELECT id FROM conversations
        WHERE channel_id=$1 AND user_id=$2
        ORDER BY ts DESC OFFSET $3
      )`, [channelId, userId, MAX_HISTORY]);
    console.log(`[history] db: @${username} in #${channelId}`);
  } else {
    if (!channelHistory.has(key)) channelHistory.set(key, []);
    const h = channelHistory.get(key);
    // Store with username prefix so model knows who said what
    h.push({ role, content: role === "user" ? `@${username}: ${content}` : content });
    if (h.length > MAX_HISTORY) h.splice(0, h.length - MAX_HISTORY);
    console.log(`[history] mem: @${username} → ${h.length} msgs`);
  }
}

async function getHistory(channelId, userId, username) {
  if (db) {
    const res = await db.query(
      `SELECT role, content, username FROM conversations
       WHERE channel_id=$1 AND user_id=$2
       ORDER BY ts ASC LIMIT $3`,
      [channelId, userId, MAX_HISTORY]
    );
    const rows = res.rows.map((r) => ({
      role: r.role,
      content: r.role === "user" ? `@${r.username}: ${r.content}` : r.content,
    }));
    if (rows.length) console.log(`[history] db: loaded ${rows.length} msgs for @${username}`);
    return rows;
  }
  const h = channelHistory.get(historyKey(channelId, userId)) || [];
  if (h.length) console.log(`[history] mem: loaded ${h.length} msgs for @${username}`);
  return h;
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

const userCooldowns = new Map();
const COOLDOWN_MS = 5000;

function isRateLimited(userId) {
  const last = userCooldowns.get(userId) || 0;
  if (Date.now() - last < COOLDOWN_MS) return true;
  userCooldowns.set(userId, Date.now());
  return false;
}

// ── Discord client ────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("clientReady", async () => {
  console.log(`[openhome-intel] Online as ${client.user.tag}`);
  console.log(`[openhome-intel] Active channel: ${INTEL_CHANNEL_ID}`);
  console.log(`[openhome-intel] Community monitoring: ALL channels`);
  console.log(`[openhome-intel] Live marketplace: ${OPENHOME_API_KEY ? "enabled" : "disabled (no API key)"}`);
  await initDb();
  scheduleDailyBrief();
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // ── Passive monitoring: all channels except intel ─────────────────────────
  if (message.channelId !== INTEL_CHANNEL_ID) {
    // Fire and forget — don't await, don't block
    handlePassiveMessage(message).catch((err) =>
      console.log(`[monitor] error: ${err.message}`)
    );
    return;
  }

  // ── Active: #openhome-intel ───────────────────────────────────────────────
  const question = message.content.trim();
  if (!question) return;
  if (isRateLimited(message.author.id)) return;

  const userId   = message.author.id;
  const username = message.author.username;

  try {
    // Keep typing indicator alive — it expires after 10s, refresh every 8s
    await message.channel.sendTyping();
    const typingInterval = setInterval(() => {
      message.channel.sendTyping().catch(() => {});
    }, 8000);

    let wikiContext, urlContext, liveMarketplace, history;
    try {
      [wikiContext, urlContext, liveMarketplace, history] = await Promise.all([
        Promise.resolve(loadWikiContext()),
        resolveUrlsInMessage(question),
        getLiveMarketplace(),
        getHistory(message.channelId, userId, username),
      ]);
    } finally {
      clearInterval(typingInterval);
    }

    const answer = await askAboutOpenHome(question, wikiContext, urlContext, liveMarketplace, history);

    // Store both sides of the exchange
    await Promise.all([
      addToHistory(message.channelId, userId, username, "user", question),
      addToHistory(message.channelId, userId, username, "assistant", answer),
    ]);

    await message.reply({
      content: answer,
      allowedMentions: { repliedUser: false },
    });

    // Silently classify for community health
    handlePassiveMessage(message).catch(() => {});
  } catch (err) {
    console.log("[openhome-intel] ERROR:", err.message);
    await message.reply("Couldn't reach the knowledge base. Try again shortly.");
  }
});

// ── Daily brief ───────────────────────────────────────────────────────────────

let briefSentToday = false;

function scheduleDailyBrief() {
  setInterval(async () => {
    const now = new Date();
    const isTime = now.getUTCHours() === BRIEF_HOUR_UTC && now.getUTCMinutes() < 5;
    if (!isTime) { briefSentToday = false; return; }
    if (briefSentToday) return;
    briefSentToday = true;

    try {
      const channel = await client.channels.fetch(INTEL_CHANNEL_ID);
      if (!channel?.isTextBased()) return;

      const [wikiContext, liveMarketplace, communityHealth] = await Promise.all([
        Promise.resolve(loadWikiContext()),
        getLiveMarketplace(),
        getCommunityHealthSummary(),
      ]);

      const brief = await generateDailyBrief(wikiContext, communityHealth, liveMarketplace);
      const dateStr = new Date().toISOString().split("T")[0];

      const healthSection = communityHealth
        ? `\n\n---\n${communityHealth}`
        : "";

      await channel.send(`**OpenHome Daily Brief — ${dateStr}**\n\n${brief}${healthSection}`);
      console.log(`[openhome-intel] Brief sent for ${dateStr}`);
    } catch (err) {
      console.error("[openhome-intel] Brief error:", err.message);
    }
  }, 60_000);
}

// ── Health check server ───────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  if (req.url === "/health/signals") {
    (async () => {
      let recent = [];
      let signals = {};
      if (db) {
        const r = await db.query(
          `SELECT username, channel_name, signal, excerpt,
                  EXTRACT(EPOCH FROM (NOW()-ts))/60 AS age_min
           FROM community_signals ORDER BY ts DESC LIMIT 20`
        ).catch(() => ({ rows: [] }));
        recent = r.rows;
        signals = recent.reduce((acc, e) => { acc[e.signal] = (acc[e.signal]||0)+1; return acc; }, {});
      } else {
        recent = communityEvents.slice(-10).map((e) => ({
          username: e.username, channel_name: e.channelName,
          signal: e.signal, excerpt: e.excerpt,
          age_min: Math.floor((Date.now() - e.ts) / 60000),
        }));
        signals = communityEvents.reduce((acc, e) => { acc[e.signal] = (acc[e.signal]||0)+1; return acc; }, {});
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ storage: db ? "postgres" : "memory", signals, recent }, null, 2));
    })().catch(() => { res.writeHead(500); res.end("error"); });
  } else {
    res.writeHead(200);
    res.end("ok");
  }
}).listen(PORT, () => {
  console.log(`[openhome-intel] Health check on port ${PORT}`);
});

// ── Boot ─────────────────────────────────────────────────────────────────────

client.login(DISCORD_BOT_TOKEN).catch((err) => {
  console.error("[openhome-intel] Login failed:", err.message);
  process.exit(1);
});
