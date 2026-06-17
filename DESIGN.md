# HaCleanHouse — Documento di Design & Decisioni

App di gestione pulizie domestiche (ispirata a [Sweepy](https://apps.apple.com/it/app/sweepy-programma-pulizie/id1498897320)),
realizzata in casa e integrata nello stack Home Assistant di `/opt/homeassistant`.

> Questo file è il riassunto di quanto deciso in fase di progettazione. Va aggiornato man mano che le scelte evolvono.

## Obiettivo funzionale

Ricostruire le funzioni principali del modello Sweepy:
- Piani di pulizia **ricorrenti** divisi per **stanza/area**.
- Attività assegnate e **ruotate** tra i membri della famiglia, con **priorità** e minuti stimati.
- **Completamento** delle attività, storico/streak.
- ~~Gamification (monete, classifica)~~ — **concetto punteggio rimosso** dall'app.
- Supporto **più case**.

Valore aggiunto rispetto all'app originale: **integrazione con Home Assistant**
(eventi su Google Calendar, promemoria mirati, eventuale sensore in dashboard).

## Stack tecnologico

| Aspetto | Scelta |
|---------|--------|
| Framework | **Next.js 15 — App Router + Server Actions** |
| ORM | **Prisma** |
| Database | **PostgreSQL** in **container dedicato** (`next-app-db`, immagine `postgres:16`) — separato dal MariaDB di HA |
| Build immagine | Dockerfile multi-stage, output `standalone` |
| Cartella progetto | `/opt/homeassistant/hacleanhouse/` |
| Nome servizio Docker | `hacleanhouse` |

### Perché un container DB dedicato e separato dal MariaDB di HA
Il MariaDB esistente è il backend del **recorder di HA** (write-heavy, purge, sensibile alle versioni).
I DB delle app stanno su un'istanza separata per: isolare il blast radius, versionare in modo
indipendente, evitare contesa di performance, e rendere più semplice il restore.

## Networking (specifico di questo stack)

- L'app `hacleanhouse` e `next-app-db` girano sulla **bridge network** di default.
- App → DB: `postgresql://apps:...@next-app-db:5432/hacleanhouse` (per **nome servizio**, niente porta pubblicata).
- App → HA: HA è in `network_mode: host`, quindi **non** è `homeassistant:8123` dalla bridge.
  Si usa `http://host.docker.internal:8123` con `extra_hosts: ["host.docker.internal:host-gateway"]`
  (stesso trucco di `cloudflared`), oppure l'IP LAN `http://192.168.178.50:8123`.
- `next-app-db` **non pubblica porte** (più sicuro; raggiungibile solo dalla bridge).
- Bind mount `./next-app-db` → entra automaticamente nel backup restic notturno; `backup.sh` ferma tutti i
  container prima del backup, quindi lo snapshot del DB è consistente. Nessuna modifica a `backup.sh`.

## Embedding in Home Assistant — identità utente

**Decisione: `panel_custom` + verifica del token (opzione 2).**

- Un **iframe semplice** (`panel_iframe`) NON eredita il login di HA: origine diversa, cookie non condiviso.
- Si usa invece un **Custom Panel** (`panel_custom`): un piccolo web component (`hacleanhouse-panel.js`) che HA
  istanzia nel proprio frontend e a cui passa l'oggetto `hass` (con `hass.user` e
  `hass.auth.data.access_token`).
- Il pannello monta l'`<iframe>` della app Next e, via `postMessage`, le inoltra **identità + access token**.
- L'app, **lato server, valida il token** chiamando HA (`auth/current_user` via WebSocket) per ottenere
  l'utente in modo **certo**.
- Effetto collaterale: con quel token l'app può chiamare HA **come l'utente loggato**
  (incluso `calendar.create_event`) → **niente long-lived token** da gestire nel `.env`.
  Il token è a vita breve (~30 min); il pannello lo rinfresca e lo re-inoltra.

```
HA frontend (utente loggato)
  └─ panel_custom (hacleanhouse-panel.js — riceve hass.user + access token)
       └─ iframe → app Next.js   ← postMessage({ user, token })
                      └─ verifica token lato server via auth/current_user
```

## Membri = utenti HA

- Il `Member` non è testo libero: si aggancia all'utente HA.
- Campo chiave: **`haUserId`** (da `hass.user.id`).
- Campo opzionale: **`haPersonEntityId`** (es. `person.silvia`) per promemoria mirati
  (`notify.mobile_app_...`) invece che a tutta la casa.
- Lista membri sincronizzata dalle persone/utenti HA.

## Integrazione HA

1. **Calendario** — Google Calendar **già configurato in HA**. Ogni `TaskOccurrence` con scadenza →
   `calendar.create_event` via REST HA. Si salva l'id evento restituito (`haEventId`) per update/cancellazione.
   L'`entity_id` del calendario è parametrico (env `HA_CALENDAR_ENTITY`).
2. **Promemoria** — `notify.casa` (gruppo) o `notify` mirato sul dispositivo del membro assegnato.
3. **(Fase 2, opzionale)** — sensore MQTT "pulizie di oggi" con discovery → card su `dashboards/casa.yaml`.

## Generazione del piano

Le `TaskOccurrence` datate vengono generate dalle definizioni `Task` ricorrenti tramite un endpoint
**`/api/cron/generate`** dell'app, **innescato da un'automazione HA a tempo** (trigger giornaliero).
Scelto rispetto a uno scheduler interno perché è osservabile e gestibile dentro HA.

## Modello dati (Prisma / Postgres)

```
House       — più case
 └─ Member  — haUserId, haPersonEntityId?, displayName, color
 └─ Room    — nome, icona, ordine
 └─ Task    — definizione ricorrente:
              roomId, nome, priorità, minuti stimati,
              frequenza (giornaliera | settimanale | mensile | ogni N giorni),
              fine serie: repeatCount? | endDate? | nessuna (serie infinita),
              modalità assegnazione (FIXED: assignees[] m-n | ROTATION tra i membri)
       └─ TaskOccurrence — istanza datata:
              dueDate, assignedMemberId (solo ROTATION), stato (pending | done | skipped),
              completedAt, completedByMemberId, haEventId?, calendarRemoved
```

## Sviluppo

Due modi per lavorare in locale; in entrambi l'auth HA è bypassata con `DEV_HA_USER_ID=dev-user`
(auto-login mock, niente custom panel).

### A) Modalità dev in Docker (consigliata) — hot-reload

`Dockerfile.dev` esegue `next dev` invece della build `standalone`, e `docker-compose.dev.yml`
è un override del solo servizio `hacleanhouse` che monta il sorgente via bind mount (hot-reload)
e riusa lo stesso `next-app-db` della produzione. L'immagine dev è taggata **`hacleanhouse:dev`**,
distinta da quella di produzione, così i due build non si sovrascrivono.

```bash
cd /opt/homeassistant
# Primo avvio (o dopo modifiche a Dockerfile.dev / dipendenze): aggiungi --build
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build hacleanhouse
# Avvii successivi:
docker compose -f docker-compose.yml -f docker-compose.dev.yml up hacleanhouse
```

- App su `:3000` (`http://192.168.178.50:3000`); modifiche in `src/` ricaricate live.
- `node_modules` e `.next` restano in volumi anonimi, così non vengono oscurati dalle cartelle dell'host.
  Se cambi le dipendenze, rigenera i volumi: aggiungi `--renew-anon-volumes` alla `up`.
- ⚠️ Usa il **DB di produzione** (`next-app-db`): le scritture di test toccano i dati reali.

### Ripristino della build di produzione

L'override sostituisce il container `hacleanhouse` con la versione dev (stessa porta 3000).
Per tornare alla build di produzione basta riavviare il servizio **senza** il file di override
(`docker-compose.yml` da solo usa il `Dockerfile` multi-stage → `next build` standalone):

```bash
cd /opt/homeassistant
docker compose up -d --build hacleanhouse
```

`up` ricrea il container dalla configurazione di produzione (immagine `homeassistant-hacleanhouse`,
**non** `hacleanhouse:dev`). Il `--build` garantisce che l'immagine standalone sia rigenerata se il
sorgente è cambiato. L'immagine `hacleanhouse:dev` resta su disco inutilizzata: rimuovila con
`docker image rm hacleanhouse:dev` se vuoi liberare spazio.

### B) Modalità dev locale (npm) — senza Docker

Node è gestito da **Volta** (`package.json` fissa la versione). Richiede un Postgres su
`127.0.0.1:5433` (vedi `DATABASE_URL` in `.env`), tipicamente un container usa-e-getta:

```bash
docker run -d --name hacleanhouse-dev-db \
  -e POSTGRES_USER=apps -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=hacleanhouse \
  -p 5433:5432 postgres:16
cd /opt/homeassistant/hacleanhouse
npx prisma migrate deploy
npm run dev
```

## Roadmap a fasi

- **MVP (fase 1)**: case, stanze, membri (da HA), task ricorrenti, generazione occorrenze, vista "oggi",
  segna-come-fatto, push su Google Calendar via HA, custom panel con identità verificata.
- **Fase 2**: rotazione automatica, streak/storico, promemoria `notify`, sensore MQTT.
- ~~Fase 3 gamification~~: rimossa (niente punteggio).

## Punti aperti / da fornire

- [ ] `entity_id` del Google Calendar in HA (Strumenti per sviluppatori → Stati, filtro `calendar.`).
- [ ] Verificare in fase di build il rinnovo/inoltro del token dal custom panel (refresh ~30 min).
- [x] Nome app/cartella/servizio/DB: **`hacleanhouse`**.
