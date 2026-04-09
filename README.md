# OpenHome Wiki

Community knowledge base for the [OpenHome](https://openhome.com) platform.

Synthesized daily from Discord, X/Twitter, and GitHub using the [Karpathy wiki pattern](https://karpathy.github.io/2014/07/01/hallucinations/).

## What's here

- **[platform/](wiki/platform/)** — How OpenHome works, core concepts, architecture
- **[abilities/](wiki/abilities/)** — Individual abilities (plugins) — what they do, how to build them
- **[builders/](wiki/builders/)** — People building on OpenHome
- **[concepts/](wiki/concepts/)** — Foundational concepts (voice-first, local-first, web3-native)
- **[roadmap/](wiki/roadmap/)** — What's shipped, in-progress, and planned

## Contributing

Wiki pages are auto-generated. To improve them:

1. **Talk in Discord** — The ingest pipeline reads public channels. The best way to improve the wiki is to discuss things clearly in the community.
2. **Open an issue** — Flag inaccurate or missing information via GitHub Issues.
3. **Edit the schema** — [wiki/SCHEMA.md](wiki/SCHEMA.md) controls what gets synthesized and what fields matter.

Do not edit wiki pages directly — changes will be overwritten on the next daily ingest.

## How it works

```
Discord + X + GitHub
        ↓
openhome-ingest (GitHub Actions, daily)
        ↓
Claude synthesizes each entity into a structured wiki page
        ↓
wiki/ committed to this repo
```

The ingest bot is **read-only**. It never posts, never responds, never listens in real-time.

## Local development

```bash
# Prerequisites: jq, curl, bash 5+
export ANTHROPIC_API_KEY=sk-ant-...
export DISCORD_BOT_TOKEN=...
export DISCORD_SERVER_ID=1197724389630824508

# Run full ingest
bash scripts/openhome-ingest.sh all

# Single page
bash scripts/openhome-ingest.sh platform/speakers

# Ask a question
bash scripts/openhome-ingest.sh query "how do I build an ability?"
```

## GitHub Actions secrets required

| Secret | Purpose |
|--------|---------|
| `ANTHROPIC_API_KEY` | Claude API for synthesis |
| `DISCORD_BOT_TOKEN` | Read-only Discord bot (View Channels + Read Message History only) |
| `X_BEARER_TOKEN` | Optional — X/Twitter search |
