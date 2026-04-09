# OpenHome Wiki Schema

Entity taxonomy for the openhome-ingest pipeline.
All pages are synthesized from Discord, GitHub, and X/Twitter.
Do not edit wiki pages manually — they are auto-generated.

---

## Discord Role → Wiki Entity Mapping

| Discord Role | Role ID | Wiki Entity Type |
|---|---|---|
| Admin | 1197745415131504690 | `team/` |
| Server Admin | 1464301569485832469 | `team/` |
| Internal | 1491928483172188221 | `partners/` |
| Moderator | 1203058871036280963 | `moderators/` |
| Community Guide | 1474669044002197515 | `guides/` |
| Homie | 1203080015479312415 | `builders/` |
| User | 1203058633307463731 | `builders/` |

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
- `platform/openhome`
- `platform/speakers`
- `platform/abilities`
- `platform/dashboard`
- `platform/voice-ai`
- `platform/local-link`
- `platform/marketplace`
- `platform/live-editor`

---

### `team/`
Core OpenHome team members (Admin + Server Admin roles).

**Required fields:**
- `who-they-are` — role at OpenHome, background
- `what-they-own` — areas of the platform they lead
- `how-to-reach` — Discord handle, X/Twitter, preferred contact
- `connects-to` — wikilinks to their projects/areas

**Seeded pages:**
- `team/jesse` — Jesse, CTO (@jesserank)
- `team/shannon` — Shannon, CEO (@openhome)

---

### `partners/`
Partners and internal collaborators (Internal role).

**Required fields:**
- `who-they-are` — what they do, how they connect to OpenHome
- `what-they-bring` — their contribution or integration
- `how-to-reach` — Discord handle or public contact
- `connects-to` — wikilinks

---

### `moderators/`
Community moderators (Moderator role).

**Required fields:**
- `who-they-are` — brief bio, community focus
- `what-they-moderate` — channels or areas they manage
- `how-to-reach` — Discord handle
- `connects-to` — wikilinks

---

### `guides/`
Community Guides — power users who help onboard others (Community Guide role).

**Required fields:**
- `who-they-are` — background, expertise
- `what-they-help-with` — their specialty (abilities, hardware, APIs, etc.)
- `how-to-reach` — Discord handle
- `connects-to` — wikilinks

---

### `builders/`
Active community builders (Homie + User roles) — devkit holders shipping abilities.

**Required fields:**
- `who-they-are` — background, what they're building
- `what-they-built` — shipped abilities or integrations
- `grant-status` — none / applied / $100 / $1K / $5K-$20K / $50K
- `how-to-reach` — Discord handle, GitHub, X
- `connects-to` — wikilinks to their abilities

---

### `abilities/`
Individual abilities (plugins) built by the community.

**Required fields:**
- `what-it-does` — user-facing description
- `how-to-build` — builder notes, API surface
- `category` — utility / entertainment / productivity / web3 / smart-home / ambient
- `built-by` — wikilink to builder page
- `status` — live / in-review / planned
- `connects-to` — wikilinks

**Seeded pages:**
- `abilities/aquaprime`
- `abilities/deadman-fm`
- `abilities/trivia`
- `abilities/news-brief`

---

### `concepts/`
Foundational concepts that underpin OpenHome.

**Required fields:**
- `definition` — plain-language explanation
- `why-it-matters` — relevance to OpenHome
- `how-it-manifests` — where this concept appears in the platform
- `connects-to` — wikilinks

**Seeded pages:**
- `concepts/abilities-as-apps`
- `concepts/voice-first`
- `concepts/local-first`
- `concepts/web3-native`
- `concepts/dead-mans-switch`
- `concepts/spatial-intelligence`
- `concepts/grant-program`

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
3. **No speculation** — only include what sources confirm; mark unknowns as `status: stub`
4. **Cross-reference minimum 2 pages** — every page must have `connects-to` entries
5. **Role accuracy** — tag people pages with their actual Discord role, not assumed title
6. **Keep current** — mark stale pages with `status: outdated` when newer info supersedes

---

## Supported Commands

```
openhome-ingest all           # full ingest + index + lint
openhome-ingest platform      # platform pages
openhome-ingest team          # team member pages
openhome-ingest partners      # partner pages
openhome-ingest moderators    # moderator pages
openhome-ingest guides        # community guide pages
openhome-ingest builders      # builder profiles
openhome-ingest abilities     # ability pages
openhome-ingest concepts      # concept pages
openhome-ingest roadmap       # roadmap pages
openhome-ingest index         # regenerate wiki/index.md
openhome-ingest lint          # orphans + broken links
openhome-ingest query "..."   # ask a question
```
