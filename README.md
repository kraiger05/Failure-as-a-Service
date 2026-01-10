<div align="center">

# Failure as a Service (FaaS)

**Enterprise-grade disappointment, delivered on demand.**  
A tiny HTTP service that returns a random failure reason from a curated library - for demos, placeholders, status pages, and catharsis.

<br/>

[![Status](https://img.shields.io/badge/status-live-brightgreen.svg)](https://faas.dansec.red/healthz)
[![API](https://img.shields.io/badge/api-OpenAPI%203.1.1-blue.svg)](./openapi.yaml)
[![CI](https://img.shields.io/github/actions/workflow/status/Sec-Dan/failure-as-a-service/ci.yml?label=ci)](./.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-black.svg)](./LICENSE)

<br/>

[![Try FaaS](https://img.shields.io/badge/Try%20it-faas.dansec.red-6f42c1.svg)](https://faas.dansec.red/)
[![Get a failure](https://img.shields.io/badge/%F0%9F%92%A5%20Get%20a%20failure-/v1/failure-ff69b4.svg)](https://faas.dansec.red/v1/failure)
[![Spicy](https://img.shields.io/badge/%F0%9F%8C%B6%EF%B8%8F%20Spicy%20mode-tone%3Dspicy-orange.svg)](https://faas.dansec.red/v1/failure?tone=spicy&format=text)

</div>

---

## Hosted service

**Base URL:** `https://faas.dansec.red`

This repo is primarily the **source of truth** for the service + the message library.  
You can absolutely deploy your own, but the docs below assume you’re calling the hosted API.

---

## What it does

- Returns **one** randomly selected failure message (`/v1/failure`)
- Returns a **batch** of messages (`/v1/failure/batch`)
- Lists supported categories (`/v1/categories`)
- Health endpoint (`/healthz`)
- Optional deterministic output via `seed`
- Two tones:
  - `tone=safe` (default): workplace-safe humour
  - `tone=spicy`: opt-in, ruder humour and **may include profanity**

If the service itself fails, it responds with:

> **I… don’t know what to say.**

…and sets `X-FAAS-Failure-Failed: true`

---

## Quick start

### One failure
```bash
curl -s https://faas.dansec.red/v1/failure
````

### One failure (plain text)

```bash
curl -s "https://faas.dansec.red/v1/failure?format=text"
```

### Spicy (plain text)

```bash
curl -s "https://faas.dansec.red/v1/failure?tone=spicy&format=text"
```

### Batch

```bash
curl -s "https://faas.dansec.red/v1/failure/batch?n=5&format=text"
```

### Deterministic output (great for tests/demos)

```bash
curl -s "https://faas.dansec.red/v1/failure?seed=12345&format=text"
curl -s "https://faas.dansec.red/v1/failure/batch?n=5&seed=12345"
```

---

## Endpoints

### `GET /v1/failure`

Returns a single failure message.

**Query params**

* `category` = choose a message category
* `tone` = `safe` (default) or `spicy`
* `seed` = deterministic output
* `format` = `json` (default) or `text`

### `GET /v1/failure/batch`

Returns multiple failure messages.

**Query params**

* `n` = number of messages (default `5`, max `50`)
* `category`, `tone`, `seed`, `format` = same as above

### `GET /v1/categories`

Returns the list of categories.

### `GET /healthz`

Health check.

### `GET /`

A small homepage with a “generate failure” button.

---

## Response headers

FaaS attaches a few helpful/funny headers:

* `X-FAAS-Reason` = the selected message (or `batch:<n>` for batch responses)
* `X-FAAS-Category` = the category served
* `X-FAAS-Tone` = `safe` / `spicy`
* `X-FAAS-Request-Id` = per-request identifier
* `X-FAAS-Failure-Failed: true` = only when the failure failed

---

## OpenAPI

This repo includes an OpenAPI 3.1.1 spec:

* `openapi.yaml`

Use it to generate clients, docs, or import into Postman/Insomnia.

---

## Message library

Messages live in:

* `data/messages.json`

Structure (per category + per tone):

* `categories.<category>.safe[]`
* `categories.<category>.spicy[]`

### Contributing messages

PRs welcome. Keep in mind:

* **safe** should remain workplace-safe
* **spicy** is allowed to be rude/profane, but aim for *funny*, not hateful
* No slurs, harassment, or targeting protected groups (ever)

---

## Roadmap

A lightweight “nice-to-have” roadmap (no promises, only dreams):

### Next up

* [ ] **Real HTTP code mode**: `/v1/failure/http/404` can optionally return an actual `404` (not just a hint in JSON)
* [ ] **Rate limiting / abuse guard**: basic protection for public traffic
* [ ] **Sticky / daily modes**:

  * [ ] `mode=daily` (same message for everyone that day)
  * [ ] `mode=sticky` (consistent per user/session)
* [ ] **Tags + search**:

  * [ ] `tag=kubernetes`
  * [ ] `/v1/failure/search?q=dns`
* [ ] **Incident comms generator**:

  * [ ] `/v1/incident/update` (corporate “we’re investigating” energy)
* [ ] **“Blame” field**:

  * [ ] `X-FAAS-Blame: dns|vendor|cosmic_rays|merge_conflict|unknown|me`

### Maybe later

* [ ] Locale variants (`en-GB`, `en-AU`, `en-US`) - spicy Aussie would go hard
* [ ] Optional external message storage (update library without redeploy)
* [ ] Minimal metrics endpoint (or export-friendly logs)

---

## Security

This is a joke service, but the repo is still run like a proper project.

* Please report security issues responsibly (see `SECURITY.md` if present).
* Don’t use FaaS to generate content for user-facing error messages in sensitive contexts unless you control tone and language.

---

## Licence

MIT. See [`LICENSE`](./LICENSE).