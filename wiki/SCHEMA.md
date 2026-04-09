# OpenHome Wiki Schema

Entity taxonomy for the openhome-ingest pipeline.
All pages are synthesized from Discord, X, GitHub, and manual docs.
Do not edit wiki pages manually — they are auto-generated.

---

## Entity Types

### `platform/`
Core platform concepts — what OpenHome is, how it works, its architecture.

**Required fields:**
- `what-it-is` — one-paragraph definition
- `how-it-works` — technical or user-facing explanation
- `current-status` — live / beta / planned / deprecated
- `connects-to` — wikilinks to related pages

**Pages:**
- `platform/openhome` — the platform itself
- `platform/speakers` — physical speaker hardware
- `platform/abilities` — plugin system overview
- `platform/dashboard` — app.openhome.com
- `platform/voice-ai` — voice AI layer
- `platform/local-link` — local network device discovery

---

### `abilities/`
Individual abilities (plugins) — what they do, how to build them, status.

**Required fields:**
- `what-it-does` — user-facing description
- `how-to-build` — builder notes, API surface
- `category` — utility / entertainment / productivity / web3
- `status` — live / in-review / planned
- `connects-to` — wikilinks

**Seeded pages:**
- `abilities/aquaprime` — AquaPrime game companion ability
- `abilities/deadman-fm` — deadman.fm radio station player
- `abilities/trivia` — trivia game
- `abilities/news-brief` — daily news briefing

---

### `builders/`
People building on OpenHome — who they are, what they've shipped, how to contact.

**Required fields:**
- `who-they-are` — 1-2 sentence bio
- `what-they-built` — abilities or integrations shipped
- `web3-presence` — wallet / ENS / social
- `connects-to` — wikilinks to their abilities

**Auto-populated from:** Discord builder roles, GitHub contributors, ability submissions.

---

### `concepts/`
Foundational concepts that underpin OpenHome.

**Required fields:**
- `definition` — plain-language explanation
- `why-it-matters` — relevance to OpenHome
- `how-it-manifests` — where this concept appears in the platform
- `connects-to` — wikilinks

**Seeded pages:**
- `concepts/abilities-as-apps` — the OpenHome app paradigm
- `concepts/voice-first` — voice as primary interface
- `concepts/local-first` — on-device computation philosophy
- `concepts/web3-native` — crypto-native design choices
- `concepts/dead-mans-switch` — liveness protocol

---

### `roadmap/`
What's coming, what's in progress, what shipped.

**Required fields:**
- `what-it-is` — feature or milestone description
- `status` — shipped / in-progress / planned / cancelled
- `why-it-matters` — motivation
- `eta` — rough timeline if known
- `connects-to` — wikilinks

---

## Ingest Rules

1. **Public only** — no DMs, private channels, or internal docs
2. **Synthesize, don't dump** — each page is a compact summary, not a raw transcript
3. **Cite sources** — link Discord thread, GitHub issue, or X post in frontmatter
4. **Cross-reference minimum 2 pages** — every page must have `connects-to` entries
5. **Keep current** — mark stale pages with `status: outdated` when newer info supersedes

---

## Supported Commands

```
openhome-ingest all          # full ingest + index + lint
openhome-ingest platform     # platform pages only
openhome-ingest abilities    # abilities pages only
openhome-ingest builders     # builder profiles only
openhome-ingest concepts     # concept pages only
openhome-ingest roadmap      # roadmap pages only
openhome-ingest index        # regenerate wiki/index.md
openhome-ingest lint         # orphans + broken links
openhome-ingest query "..."  # ask a question about OpenHome
```
