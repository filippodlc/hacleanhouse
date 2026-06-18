# Graph Report - .  (2026-06-18)

## Corpus Check
- 8 files · ~18,893 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 250 nodes · 391 edges · 19 communities (13 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.82)
- Token cost: 21,057 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Today Page & Occurrences|Today Page & Occurrences]]
- [[_COMMUNITY_Auth & Session|Auth & Session]]
- [[_COMMUNITY_Freshness & Status UI|Freshness & Status UI]]
- [[_COMMUNITY_shadcn Components Config|shadcn Components Config]]
- [[_COMMUNITY_Dev Dependencies|Dev Dependencies]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Architecture Design Docs|Architecture Design Docs]]
- [[_COMMUNITY_NPM Runtime Dependencies|NPM Runtime Dependencies]]
- [[_COMMUNITY_App Layout & Navigation|App Layout & Navigation]]
- [[_COMMUNITY_Icon & MDI System|Icon & MDI System]]
- [[_COMMUNITY_Data Model Design|Data Model Design]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_Next.js Fork Warning|Next.js Fork Warning]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_MQTT Sensor Phase 2|MQTT Sensor Phase 2]]
- [[_COMMUNITY_Robots.txt|Robots.txt]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 44 edges
2. `compilerOptions` - 16 edges
3. `getCurrentMember` - 8 edges
4. `Button()` - 7 edges
5. `tailwind` - 6 edges
6. `aliases` - 6 edges
7. `scripts` - 6 edges
8. `RoomIcon()` - 6 edges
9. `HaCleanHouse cleaning management app` - 6 edges
10. `RoomStatusBadge()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `HaCleanHouse cleaning management app` --conceptually_related_to--> `Next.js create-next-app project`  [INFERRED]
  DESIGN.md → README.md
- `POST()` --calls--> `loginWithHaToken()`  [EXTRACTED]
  src/app/api/session/route.ts → src/lib/auth.ts
- `RootLayout()` --calls--> `getCurrentMember`  [EXTRACTED]
  src/app/layout.tsx → src/lib/auth.ts
- `ManagePage()` --calls--> `getCurrentMember`  [EXTRACTED]
  src/app/manage/page.tsx → src/lib/auth.ts
- `TodayPage()` --calls--> `getCurrentMember`  [EXTRACTED]
  src/app/page.tsx → src/lib/auth.ts

## Import Cycles
- None detected.

## Communities (19 total, 6 thin omitted)

### Community 0 - "Today Page & Occurrences"
Cohesion: 0.11
Nodes (25): minutesByPerson(), TodayPage(), todayUTC(), WorkloadSummary(), OccurrenceRow(), OccurrenceVM, Unauthenticated(), cn() (+17 more)

### Community 1 - "Auth & Session"
Cohesion: 0.12
Nodes (21): RootLayout(), createBootstrapMember(), ensureDefaultHouse(), getCurrentMember, getHaAccessToken(), getOrCreateMember(), getSession(), loginWithHaToken() (+13 more)

### Community 2 - "Freshness & Status UI"
Cohesion: 0.16
Nodes (19): FreshnessBar(), freshnessColor(), freshnessLabel(), PRIORITY, dateFmt, fmtDate(), RoomStatusBadge(), TaskRow() (+11 more)

### Community 3 - "shadcn Components Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 4 - "Dev Dependencies"
Cohesion: 0.09
Nodes (21): devDependencies, eslint, eslint-config-next, prisma, tailwindcss, @tailwindcss/postcss, @types/node, @types/react (+13 more)

### Community 5 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 6 - "Architecture Design Docs"
Cohesion: 0.11
Nodes (19): Bridge network app-to-DB-to-HA connectivity, DEV_HA_USER_ID auth bypass, Docker dev mode with hot-reload (hacleanhouse:dev), Local npm dev mode (Volta + Postgres 5433), Gamification/scoring removed, HA MariaDB recorder backend, HaCleanHouse cleaning management app, hacleanhouse-panel.js web component (+11 more)

### Community 7 - "NPM Runtime Dependencies"
Cohesion: 0.11
Nodes (19): dependencies, class-variance-authority, clsx, @iconify-json/mdi, @iconify/react, iron-session, lucide-react, next (+11 more)

### Community 8 - "App Layout & Navigation"
Cohesion: 0.15
Nodes (10): geistMono, metadata, roboto, AuthBridge(), LINKS, MainNav(), ThemeBridge(), ThemeProvider() (+2 more)

### Community 9 - "Icon & MDI System"
Cohesion: 0.25
Nodes (9): IconPicker(), shortName(), RoomIcon(), collection, MDI_ICON_NAMES, normalizeRoomIcon(), Badge(), badgeVariants (+1 more)

### Community 10 - "Data Model Design"
Cohesion: 0.27
Nodes (10): Google Calendar integration via HA calendar.create_event, /api/cron/generate occurrence generation endpoint, HA timed automation cron trigger, Member bound to HA user (haUserId), House data model, Member data model, Room data model, Task recurring definition data model (+2 more)

## Knowledge Gaps
- **94 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+89 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Today Page & Occurrences` to `App Layout & Navigation`, `Icon & MDI System`, `Freshness & Status UI`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `dependencies` connect `NPM Runtime Dependencies` to `Dev Dependencies`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `getCurrentMember` connect `Auth & Session` to `App Layout & Navigation`, `Today Page & Occurrences`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _98 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Today Page & Occurrences` be split into smaller, more focused modules?**
  _Cohesion score 0.11088709677419355 - nodes in this community are weakly interconnected._
- **Should `Auth & Session` be split into smaller, more focused modules?**
  _Cohesion score 0.1206896551724138 - nodes in this community are weakly interconnected._
- **Should `shadcn Components Config` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._