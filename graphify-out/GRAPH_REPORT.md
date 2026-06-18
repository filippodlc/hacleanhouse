# Graph Report - .  (2026-06-18)

## Corpus Check
- Corpus is ~18,696 words - fits in a single context window. You may not need a graph.

## Summary
- 340 nodes · 708 edges · 18 communities (12 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.82)
- Token cost: 54,334 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_UI Components & View Models|UI Components & View Models]]
- [[_COMMUNITY_Server Actions & Occurrences|Server Actions & Occurrences]]
- [[_COMMUNITY_NPM Dependencies|NPM Dependencies]]
- [[_COMMUNITY_Today Page & Freshness|Today Page & Freshness]]
- [[_COMMUNITY_Auth & HA Integration|Auth & HA Integration]]
- [[_COMMUNITY_Architecture Design Docs|Architecture Design Docs]]
- [[_COMMUNITY_App Layout & Navigation|App Layout & Navigation]]
- [[_COMMUNITY_shadcn Components Config|shadcn Components Config]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Freshness UI Badges|Freshness UI Badges]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_Next.js Fork Warning|Next.js Fork Warning]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_MQTT Sensor (Phase 2)|MQTT Sensor (Phase 2)]]
- [[_COMMUNITY_Robots.txt|Robots.txt]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 44 edges
2. `requireMember()` - 17 edges
3. `revalidateAll()` - 16 edges
4. `compilerOptions` - 16 edges
5. `updateTask()` - 13 edges
6. `rescheduleOccurrence()` - 12 edges
7. `pushSeriesToCalendar()` - 11 edges
8. `loadOcc()` - 11 edges
9. `getHaAccessToken()` - 11 edges
10. `createTask()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `HaCleanHouse cleaning management app` --conceptually_related_to--> `Next.js create-next-app project`  [INFERRED]
  DESIGN.md → README.md
- `pushSeriesToCalendar()` --calls--> `createCalendarEventWs()`  [EXTRACTED]
  src/app/actions.ts → src/lib/ha.ts
- `pushSeriesToCalendar()` --calls--> `resolveEventUid()`  [EXTRACTED]
  src/app/actions.ts → src/lib/ha.ts
- `pushSeriesToCalendar()` --calls--> `buildRRule()`  [EXTRACTED]
  src/app/actions.ts → src/lib/occurrences.ts
- `pushSeriesToCalendar()` --calls--> `firstCadenceOnOrAfter()`  [EXTRACTED]
  src/app/actions.ts → src/lib/occurrences.ts

## Import Cycles
- 3-file cycle: `src/app/actions.ts -> src/lib/occurrences.ts -> src/components/occurrence-row.tsx -> src/app/actions.ts`

## Hyperedges (group relationships)
- **Prisma data model entity relationships** — design_model_house, design_model_member, design_model_room, design_model_task, design_model_task_occurrence [EXTRACTED 1.00]
- **HA custom panel identity verification flow** — design_panel_custom, design_hacleanhouse_panel_js, design_postmessage_identity, design_token_verification [EXTRACTED 1.00]
- **Task occurrence generation pipeline** — design_ha_automation_trigger, design_cron_generate, design_model_task, design_model_task_occurrence [EXTRACTED 1.00]

## Communities (18 total, 6 thin omitted)

### Community 0 - "UI Components & View Models"
Cohesion: 0.08
Nodes (46): ConfirmButton(), IconPicker(), shortName(), FREQ_LABEL, MemberVM, Option, RoomVM, TaskVM (+38 more)

### Community 1 - "Server Actions & Occurrences"
Cohesion: 0.13
Nodes (45): addOccurrenceStandalone(), completeOccurrence(), createMember(), createRoom(), createTask(), dateOnlyUTC(), deleteMember(), deleteRoom() (+37 more)

### Community 2 - "NPM Dependencies"
Cohesion: 0.05
Nodes (40): dependencies, class-variance-authority, clsx, @iconify-json/mdi, @iconify/react, iron-session, lucide-react, next (+32 more)

### Community 3 - "Today Page & Freshness"
Cohesion: 0.13
Nodes (29): minutesByPerson(), TodayPage(), todayUTC(), WorkloadSummary(), OccurrenceRow(), OccurrenceVM, Unauthenticated(), globalForPrisma (+21 more)

### Community 4 - "Auth & HA Integration"
Cohesion: 0.12
Nodes (25): createBootstrapMember(), ensureDefaultHouse(), getOrCreateMember(), getSession(), loginWithHaToken(), provisionMember(), SessionData, sessionOptions (+17 more)

### Community 5 - "Architecture Design Docs"
Cohesion: 0.08
Nodes (29): Bridge network app-to-DB-to-HA connectivity, Google Calendar integration via HA calendar.create_event, /api/cron/generate occurrence generation endpoint, DEV_HA_USER_ID auth bypass, Docker dev mode with hot-reload (hacleanhouse:dev), Local npm dev mode (Volta + Postgres 5433), Gamification/scoring removed, HA timed automation cron trigger (+21 more)

### Community 6 - "App Layout & Navigation"
Cohesion: 0.10
Nodes (19): geistMono, metadata, roboto, RootLayout(), AuthBridge(), LINKS, MainNav(), MemberManager() (+11 more)

### Community 7 - "shadcn Components Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 8 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 9 - "Freshness UI Badges"
Cohesion: 0.38
Nodes (8): FreshnessBar(), freshnessColor(), freshnessLabel(), dateFmt, fmtDate(), RoomStatusBadge(), TaskRow(), DialogTrigger()

## Knowledge Gaps
- **110 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+105 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `UI Components & View Models` to `Freshness UI Badges`, `App Layout & Navigation`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `getCurrentMember` connect `App Layout & Navigation` to `Server Actions & Occurrences`, `Today Page & Freshness`, `Auth & HA Integration`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _114 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI Components & View Models` be split into smaller, more focused modules?**
  _Cohesion score 0.08432539682539683 - nodes in this community are weakly interconnected._
- **Should `Server Actions & Occurrences` be split into smaller, more focused modules?**
  _Cohesion score 0.1285024154589372 - nodes in this community are weakly interconnected._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `Today Page & Freshness` be split into smaller, more focused modules?**
  _Cohesion score 0.13068181818181818 - nodes in this community are weakly interconnected._