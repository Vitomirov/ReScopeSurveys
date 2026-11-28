# Survey import guide (Enterprise)

ReScope can create surveys from a **workbook**, **text outline**, or **Claude MCP**. Manual survey building in the dashboard is unchanged — import is an optional accelerator.

**Plan:** Survey import requires the **Enterprise** plan. Starter / Professional / Trial orgs do not see Import in the UI or MCP.

**After every successful create import:** survey status is **pending** (`pending_review`). A person must open the builder, review content and logic, then set **Draft** or **Live**. Respondents only see **Live** surveys.

**Templates (download in app or from repo):**

| Asset | URL (local dev) | File |
|-------|-----------------|------|
| Excel workbook | `/templates/survey-import-template.xlsx` | `public/templates/survey-import-template.xlsx` |
| Text outline sample | `/templates/survey-import-text-outline-sample.txt` | `public/templates/survey-import-text-outline-sample.txt` |

Regenerate the workbook after schema changes: `node scripts/dev/generate-survey-import-template.mjs`.

---

## 1. Who can do what

| Action                                | Who                                                      |
| ------------------------------------- | -------------------------------------------------------- |
| Dashboard **Import** (file / text)    | Enterprise + builder access                              |
| Builder **Import** (append questions) | Enterprise; survey must be **Draft** or **pending** only |
| **Integration keys** (Claude MCP)       | Enterprise **org admin**                                 |
| Set status to Live                    | Any editor with access to the survey                     |

Check import is enabled (logged in): `GET /api/surveys/import/capabilities` → `{ "surveyImport": true }`.

---

## 2. Review workflow (human in the loop)

```text
Import (any channel) → pending → human QA in builder → Draft or Live
```

1. Import completes → dashboard shows **pending** (distinct from **Draft**).
2. Open the survey in the builder — the import review bar lists open items; each flagged question shows its own callout (missing options, stubs, matrix defaults, broken skips).
3. Fix or **Mark reviewed** on each item. Choice options clear automatically once added.
4. In survey metadata, set **Draft** or **Live** (Live asks to confirm if review flags remain).
5. Optional: use **Preview** before going Live.

**Append import** adds questions to an existing survey. Allowed only when status is **Draft** or **pending**. Append to **Live** surveys is blocked.

---

## 3. Dashboard — file or text import

1. Ensure the org is on **Enterprise**.
2. Click **Import** in the dashboard header.
3. **Download template** (Excel or text sample) if needed.
4. Choose **File** or **Text outline**.

### File tab

- Upload `.xlsx` (recommended) or `.csv` (Items/Options layout must match).
- Use the template workbook: sheets **Survey**, **Items**, **Options** (+ **README** for humans).

### Text outline tab

Paste plain text using **ReScope text outline** rules (blank line between blocks; lines starting with `#` are comments):

| Pattern | Question type |
|---------|----------------|
| Stem, then lines starting with `()` | `single_select` |
| Stem, then lines starting with `[]` | `multi_select` |
| “Select all that apply” in stem | `multi_select` |
| `@dropdown` + stem + `()` options | `dropdown` |
| Stem + one `____` line | Short `open_text` |
| Stem + multiple `____` lines | Long `open_text` |
| `@matrix` + stem + `row:` / `col:` lines | `matrix` |
| `@page_break` alone | Page break |
| `@text_block` (+ title) + body lines | Text block |
| `@nps`, `@slider`, `@date`, … | Tier B types (finish in builder) |
| Option line suffix `{screenout}` / `{terminates}` | Screening option |
| Option line suffix `{exclusive}` | Multi “none of the above” |

Full reference: `public/templates/survey-import-text-outline-sample.txt` and workbook sheet **QuestionTypes**. Use **Insert sample outline** in the modal for a quick test.

### After import

- You are taken to the builder (or refresh the dashboard list).
- Read any **warnings** (e.g. partial/advanced types).
- Survey status remains **pending** until you change it.

---

## 4. Builder — append questions

1. Open a **Draft** or **pending** survey.
2. Click **Import** in the builder header.
3. Paste a text outline (same rules as above).
4. Questions are appended to the end of the survey.

Codes in the import block are remapped automatically (no collision errors).

---

## 5. Workbook structure (Excel / CSV)

**Required sheets:** Survey, Items, Options  
**Optional sheets:** Logic, Matrix  
**Reference sheets (humans / AI):** README, Authoring, QuestionTypes

Regenerate the reference workbook: `node scripts/dev/generate-survey-import-template.mjs`.

### Sheet: Survey

Two columns: `key`, `value` (one setting per row).

| key | Example | Notes |
|-----|---------|--------|
| title | Customer satisfaction study | Required for a useful import |
| internalName | CSAT wave 1 | |
| surveyCode | CSAT01 | |
| description | … | Optional |
| clientName / topicName / surveyTypeName | Exact Platform list names | Optional |
| showCoverPage | Y / N | Default Y |
| startButtonText | Start | |
| onePerPage | Y / N | Default Y — inserts page breaks between questions on create |
| disableBackButton | Y / N | Typical **Y** on screeners |
| showProgressBar | Y / N | Default Y |
| fingerprinting | Y / N | Enables device fingerprint with recommended signals |
| navigationLockAllPagesSeconds | 10 | Blank = off; forces dwell on every page |
| terminateTitle / terminateMessage | … | Screenout copy |
| completeTitle / closedTitle / closedMessage / redirectTitle / redirectMessage | … | Optional screen copy |

### Sheet: Items

| Column | Required | Notes |
|--------|----------|--------|
| code | Yes | Unique, e.g. `Q1`, `PB1` |
| itemType | Yes | `question`, `page_break`, `text_block` (`group` / `termination_block` stubs OK) |
| questionType | For questions | See QuestionTypes sheet |
| text | For questions | Question stem |
| required | Optional | `Y` / `N` (default Y for choice) |
| multiline | Optional | `Y` for long `open_text` |
| randomizeOptions | Optional | `Y` / `N` |
| terminationLogic | Optional | `if_any` (default) or `if_none` (with Logic sheet) |
| branchLogic | Optional | `if_any` / `if_none` |
| branchNoneTargetCode | Optional | Page-break code or `__start__` |
| navigationLockSeconds | Optional | On `page_break` only — per-page dwell |
| title / content | Text blocks | |

### Sheet: Options

| Column | Required | Notes |
|--------|----------|--------|
| questionCode | Yes | Must match Items.code |
| optionCode | Yes | Unique, e.g. `Q1_O1` |
| text | Yes | Option label |
| terminates | Optional | `Y` = screenout when this option is selected |
| isExclusive | Optional | Multi-select “none of the above” |

**Do not** put `terminates=Y` on options when the rule is “selected *only* this / lacking any of X”. Use **Logic** + `terminationLogic` instead.

### Sheet: Logic (optional)

| Column | Notes |
|--------|--------|
| questionCode | Item code the rule hangs on |
| action | `terminate` or `branch` |
| optionCodes | Comma-separated option codes |
| matchMode | `any` (default) or `all` |
| targetPageCode | Required for `branch` — page_break code or `__start__` |
| note | Optional cause / builder label |
| ruleType | Usually `choice` (default) |

**Combo screenout pattern** (e.g. must use espresso *or* capsule *or* filter):

1. On Items: `terminationLogic = if_none`
2. On Logic: one `terminate` row with `optionCodes` = the qualifying options (`matchMode=any`)

Terminates when **none** of those options are selected.

**Skip-to-page:** `action=branch` + `targetPageCode` of a later page break. Only add when the brief needs routing.

### Sheet: Matrix (optional)

| Column | Notes |
|--------|--------|
| questionCode | Matrix question code |
| axis | `row` or `col` |
| text | Label |
| code | Optional stable code (`Q8_R1`) for future Logic refs |

If omitted, matrix questions keep builder defaults (warning).

### Senior authoring (AI / agency)

Workbook sheet **Authoring** encodes judgment rules. Summary:

- Hard single-choice screenouts → `terminates=Y`
- “Lacks any of…” multi-select → `if_none` + Logic
- Skip logic only when the brief requires it — do not invent branches
- Screener defaults: `onePerPage=Y`, `disableBackButton=Y`, `fingerprinting=Y` (online); leave dwell lock blank unless specified
- Do not turn on every setting on every survey

### Question types (import tiers)

Canonical keys match the builder (`questionHelpers.js`). Workbook sheet **QuestionTypes** lists every type with text-outline hints.

- **Tier A (full):** `single_select`, `multi_select`, `dropdown`, `open_text`, `matrix` (prefer Matrix sheet for rows/cols), `page_break`, `text_block`
- **Tier B (partial stub):** `maxdiff`, `semantic_diff`, `bipolar_matrix`, `constant_sum`, `card_sort`, `ranking`, `slider`, `nps`, `star_rating`, `cascade`, `date`, `phone`, `textbox_list`, `image_choice_single`, `image_choice_multi` — stem + type imported; finish setup in builder (warnings shown)
- **Choice without Options rows:** still imports (pending); warning `CHOICE_OPTIONS` — add options in builder before Live
- **Soft fields:** blank/invalid `ruleType`, `matchMode`, unknown `questionType`, messy codes are coerced (defaults / `open_text`) with warnings — import should not 422 on AI workbook noise
- **Legacy JSON aliases** (normalized on import): `max_diff` → `maxdiff`, `semantic_differential` → `semantic_diff`, `bipolar` → `bipolar_matrix`, `image_choice` → `image_choice_single`
- **Images:** no binary image import; add images in the builder after import

`settings.onePerPage` in JSON/workbook import inserts page breaks between questions when enabled.

---

## 6. Integration API keys & Claude MCP

### Create a key

1. **Platform settings** → **Integration keys** (Enterprise admin).
2. **Create key** — label e.g. `Claude MCP`.
3. Copy `rsk_live_…` immediately — it is **shown once**.
4. Paste into Claude as the connector `authorization` header value: `Bearer rsk_live_…`.

### Revoke a key

Integration keys → trash icon on the key. Claude (and any HTTP client) using that key receives **401**. Create a new key and update the connector header.

### Claude MCP

Claude Web / Desktop connects to Rescope as a **remote MCP custom connector**. Claude turns a screening brief into schema v1 and calls the `create_preview_survey` tool.

**Endpoint (Streamable HTTP):**

```http
POST /api/integrations/v1/mcp
```

- **Auth:**
  - Prefer header: `Authorization: Bearer rsk_live_…`
  - Also accepted: `X-Rescope-Api-Key: rsk_live_…`
- **No browser session / CSRF** — API key only.
- Enterprise gate; rate-limited per organization.

**Claude setup**

1. Platform settings → Integration keys → create a key (copy once).
2. Claude → Connectors → Add custom connector.
3. Server URL: `https://<public-host>/api/integrations/v1/mcp` (see local testing below).
4. Authentication: **No sign-in**.
5. Request headers: `authorization` = `Bearer rsk_live_…` (include the `Bearer ` prefix).
6. Paste a screening brief; Claude should call `create_preview_survey` and return a `builderUrl` (`{APP_URL}/#/builder/{surveyId}`).

**Tool:** `create_preview_survey` — args include `title`, `items[]` (schema v1), optional `externalId` / survey metadata. Always creates `pending_review`.

### Local testing

Claude’s remote connectors connect **from Anthropic’s cloud**, not from your laptop. A URL like `http://localhost:3003/...` or `http://127.0.0.1/...` will fail with “enter a public https:// URL”.

| Goal | How |
|------|-----|
| **Real Claude ↔ local API** | Run `npm run dev:docker`, then expose the API with a **public HTTPS tunnel on port 443** (e.g. Cloudflare Tunnel or ngrok) to `127.0.0.1:3003`. Paste `https://<tunnel-host>/api/integrations/v1/mcp` into Claude. |
| **Without Claude (API check)** | Create a key, then call MCP with curl against `http://127.0.0.1:3003` (see below), or run `npm run test:survey-import`. |
| **Production** | Use your live app host (same origin as `/api`). |

**curl MCP smoke (local, no Claude):**

```bash
# Initialize (optional) then tools/call — replace KEY
curl -s -X POST 'http://127.0.0.1:3003/api/integrations/v1/mcp' \
  -H 'Authorization: Bearer rsk_live_YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc":"2.0","id":1,"method":"tools/call",
    "params":{
      "name":"create_preview_survey",
      "arguments":{
        "title":"Local MCP smoke",
        "externalId":"local-mcp-001",
        "items":[{
          "code":"Q1","itemType":"question","questionType":"single_select",
          "text":"Pick one",
          "options":[
            {"code":"Q1_O1","text":"A"},
            {"code":"Q1_O2","text":"B"}
          ]
        }]
      }
    }
  }'
```

Optional HTTP import (same auth/create path as the MCP tool, useful for fixtures):

```http
POST /api/integrations/v1/surveys/import
```

```bash
curl -s -X POST 'http://127.0.0.1:3003/api/integrations/v1/surveys/import' \
  -H 'Authorization: Bearer rsk_live_YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: my-test-001' \
  -d '{"schemaVersion":1,"externalId":"my-test-001","survey":{"title":"curl import test"},"items":[{"code":"Q1","itemType":"question","questionType":"single_select","text":"Pick one","options":[{"code":"Q1_O1","text":"A"},{"code":"Q1_O2","text":"B"}]}]}'
```

**Success (HTTP import):** `201` with `surveyId`, `revision`, `status: "pending_review"`, optional `warnings`.  
**Validation failure:** `422` with `errors[]`. **Not Enterprise:** `403` `IMPORT_NOT_INCLUDED`.

---

## 7. Staff API (session cookie)

Used by the ReScope UI (`VITE_USE_API=true`):

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/surveys/import/capabilities` | `{ surveyImport: boolean }` |
| POST | `/api/surveys/import` | Multipart file, form `text`, or JSON body |
| POST | `/api/surveys/import/validate` | Validate canonical JSON without saving |

**Append (JSON):** `mode: "append"`, `surveyId`, `revision` (current from GET survey), plus `items[]`.

---

## 8. Testing checklist

1. [ ] Org on **Enterprise** (vendor console or billing).
2. [ ] `GET /api/surveys/import/capabilities` → `surveyImport: true`.
3. [ ] Download template → upload unchanged → **pending** survey with 4 questions.
4. [ ] Text outline sample → same.
5. [ ] Create integration key → curl MCP or HTTP import → pending survey → open builder.
6. [ ] Repeat same `externalId` → idempotent (same `surveyId`).
7. [ ] Revoke key → **401**; new key works.
8. [ ] Append on **Draft** survey → items grow.
9. [ ] Append on **Live** survey → **422** `IMPORT_STATUS_LOCKED`.
10. [ ] Set **Live** → public preview works.
11. [ ] Claude MCP (public HTTPS URL or tunnel) → `create_preview_survey` → open `builderUrl`.

**Automated:** `npm run test:survey-import` (unit + integration; integration needs API on `PORT` from `.env`).

---

## 9. AI / MCP prompt hints

When Claude / ChatGPT / Gemini builds a workbook or schema v1 JSON:

- Prefer the Excel template sheets (Survey / Items / Options / Logic / Matrix) or text outline; JSON uses the same item fields.
- `schemaVersion: 1` only.
- Follow **Authoring** sheet: only settings and logic the brief needs.
- Screening: simple fails → `terminates: true` / `terminates=Y`; combo multi-select → `terminationLogic: if_none` + Logic/`terminationRules`.
- Branch targets reference **page break codes** that appear later in `items[]` (`targetPageCode` / `targetPageBreakId`).
- Matrix grids: emit Matrix sheet rows/cols (or `matrixRows` / `matrixColumns` in JSON).
- Use builder `questionType` keys (`maxdiff`, `semantic_diff`, `bipolar_matrix`, `image_choice_single`, …). Legacy aliases above are accepted.
- Partial types: still emit `questionType` and `text` so the stub appears in the builder.
- Example production-shaped workbook: `public/templates/coffee-consumption-habits-screener.xlsx`.

---

## Related docs

- [DEVELOPMENT.md](DEVELOPMENT.md) — local `dev:docker`, ports, seed accounts.
- [OPERATIONS.md](OPERATIONS.md) — production operations.