#!/usr/bin/env node
/**
 * OpenHome Intel Discord Bot
 *
 * Listens in #openhome-intel only.
 * Answers questions about OpenHome using the wiki knowledge base + Claude Haiku.
 * Posts daily briefs on a schedule.
 *
 * Usage:
 *   node scripts/discord-bot.js
 *
 * Required env vars:
 *   DISCORD_BOT_TOKEN     — Discord bot token
 *   OPENAI_API_KEY        — OpenAI API key (gpt-4o-mini)
 *   INTEL_CHANNEL_ID      — Discord channel ID (default: 1491929017576591401)
 */

const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawnSync } = require("child_process");

// ── Config ───────────────────────────────────────────────────────────────────

const INTEL_CHANNEL_ID =
  process.env.INTEL_CHANNEL_ID || "1491929017576591401";
const WIKI_PATH = path.join(__dirname, "../wiki");
const MODEL = "gpt-4o-mini";
const MAX_WIKI_CHARS = 12000;
const BRIEF_HOUR_UTC = 13; // 8am ET

// ── Credential resolution ────────────────────────────────────────────────────

function getSecret(envKey, keychainService) {
  if (process.env[envKey]) return process.env[envKey];
  // macOS Keychain via spawnSync (no shell injection — args are an array)
  const result = spawnSync(
    "security",
    ["find-generic-password", "-a", "openclaw", "-s", keychainService, "-w"],
    { encoding: "utf8" }
  );
  const value = result.stdout?.trim();
  return value || null;
}

const DISCORD_BOT_TOKEN = getSecret("DISCORD_BOT_TOKEN", "openhome-discord-bot-token");
const OPENAI_API_KEY = getSecret("OPENAI_API_KEY", "openai-api-key");

if (!DISCORD_BOT_TOKEN || !OPENAI_API_KEY) {
  console.error("ERROR: Missing DISCORD_BOT_TOKEN or OPENAI_API_KEY");
  process.exit(1);
}

// ── Knowledge base ───────────────────────────────────────────────────────────

function loadWikiContext(maxChars = MAX_WIKI_CHARS) {
  if (!fs.existsSync(WIKI_PATH)) {
    return "No wiki content yet. Run openhome-ingest to generate it.";
  }

  const sections = ["platform", "abilities", "builders", "concepts", "roadmap"];
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

// ── Claude Haiku ─────────────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function askAboutOpenHome(question, context) {
  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "system",
        content: [
          "You are the OpenHome Intel bot. You answer questions about OpenHome — the voice AI platform with physical speakers and a plugin system called \"abilities\".",
          "Your knowledge comes from the OpenHome wiki, synthesized from Discord, GitHub, and X/Twitter.",
          "Be concise and direct. Use Discord markdown (bold, bullet points).",
          "If you don't know something, say so clearly — do not speculate.",
          "Do not roleplay or add personality. Just answer the question.",
          `Wiki last updated: ${getLastUpdated()}`,
          "---",
          context,
        ].join("\n"),
      },
      { role: "user", content: question },
    ],
  });

  return response.choices[0].message.content;
}

async function generateDailyBrief(context) {
  const today = new Date().toISOString().split("T")[0];
  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 600,
    messages: [
      {
        role: "system",
        content: [
          "You are the OpenHome Intel bot. Generate a concise daily brief for the OpenHome team.",
          "Use Discord markdown. Keep it under 500 words.",
          "Structure (skip any section you have no data for):",
          "- **What's live** — active features/abilities",
          "- **In progress** — what's being built right now",
          "- **Community** — notable builder activity",
          "- **Heads up** — anything flagged as important or urgent",
          "Be factual, no filler.",
        ].join("\n"),
      },
      {
        role: "user",
        content: `Daily brief for ${today}.\n\nWiki context:\n${context}`,
      },
    ],
  });

  return response.choices[0].message.content;
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

client.once("clientReady", () => {
  console.log(`[openhome-intel] Online as ${client.user.tag}`);
  console.log(`[openhome-intel] Channel: ${INTEL_CHANNEL_ID}`);
  scheduleDailyBrief();
});

client.on("messageCreate", async (message) => {
  if (message.channelId !== INTEL_CHANNEL_ID) return;
  if (message.author.bot) return;

  const question = message.content.trim();
  if (!question) return;
  if (isRateLimited(message.author.id)) return;

  try {
    await message.channel.sendTyping();
    const context = loadWikiContext();
    const answer = await askAboutOpenHome(question, context);
    await message.reply({
      content: answer,
      allowedMentions: { repliedUser: false },
    });
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
    const isTime =
      now.getUTCHours() === BRIEF_HOUR_UTC && now.getUTCMinutes() < 5;

    if (!isTime) {
      briefSentToday = false;
      return;
    }
    if (briefSentToday) return;
    briefSentToday = true;

    try {
      const channel = await client.channels.fetch(INTEL_CHANNEL_ID);
      if (!channel?.isTextBased()) return;

      const context = loadWikiContext();
      const brief = await generateDailyBrief(context);
      const dateStr = new Date().toISOString().split("T")[0];

      await channel.send(`**OpenHome Daily Brief — ${dateStr}**\n\n${brief}`);
      console.log(`[openhome-intel] Brief sent for ${dateStr}`);
    } catch (err) {
      console.error("[openhome-intel] Brief error:", err.message);
    }
  }, 60_000);
}

// ── Health check server (required for Railway) ────────────────────────────────

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("ok");
}).listen(PORT, () => {
  console.log(`[openhome-intel] Health check listening on port ${PORT}`);
});

// ── Boot ─────────────────────────────────────────────────────────────────────

client.login(DISCORD_BOT_TOKEN).catch((err) => {
  console.error("[openhome-intel] Login failed:", err.message);
  process.exit(1);
});
