# Survey import guide (Enterprise)

ReScope can create surveys from a **workbook**, **text outline**, or **automation webhook** (e.g. n8n + AI). Manual survey building in the dashboard is unchanged — import is an optional accelerator.

**Plan:** Survey import requires the **Enterprise** plan. Starter / Professional / Trial orgs do not see Import in the UI or the webhook.

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
| **Integration keys** (webhook)        | Enterprise **org admin**                                 |
| Set status to Live                    | Any editor with access to the survey                     |

Check import is enabled (logged in): `GET /api/surveys/import/capabilities` → `{ "surveyImport": true }`.

---

## 2. Review workflow (human in the loop)

```text
Import (any channel) → pending → human QA in builder → Draft or Live
```

1. Import completes → dashboard shows **pending** (distinct from **Draft**).
2. Open the survey in the builder — fix text, options, partial question types, logic.
3. In survey metadata, set **Draft** (more editing) or **Live** (publish).
4. Optional: use **Preview** before going Live.

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

### Sheet: Survey

Two columns: `key`, `value` (one setting per row).

| key | Example value |
|-----|----------------|
| title | Customer satisfaction study |
| internalName | CSAT wave 1 |
| surveyCode | CSAT01 |
| clientName | Exact name from Platform → Clients (optional) |
| topicName | Exact name from Topics (optional) |
| surveyTypeName | Exact name from Audience types (optional) |

### Sheet: Items

| Column | Required | Notes |
|--------|----------|--------|
| code | Yes | Unique, e.g. `Q1`, `PB1` |
| itemType | Yes | `question`, `page_break`, `text_block` |
| questionType | For questions | e.g. `single_select`, `multi_select`, `dropdown`, `open_text`, `matrix` |
| text | For questions | Question stem |
| required | Optional | `Y` / `N` (default Y for choice) |

### Sheet: Options

| Column | Required | Notes |
|--------|----------|--------|
| questionCode | Yes | Must match Items.code |
| optionCode | Yes | Unique, e.g. `Q1_O1` |
| text | Yes | Option label |
| terminates | Optional | `Y` = screenout on this option |
| isExclusive | Optional | Multi-select “none of the above” style |

### Question types (import tiers)

Canonical keys match the builder (`questionHelpers.js`). Workbook sheet **QuestionTypes** lists every type with text-outline hints.

- **Tier A (full):** `single_select`, `multi_select`, `dropdown`, `open_text`, `matrix` (defaults for rows/columns — review in builder), `page_break`, `text_block`
- **Tier B (partial stub):** `maxdiff`, `semantic_diff`, `bipolar_matrix`, `constant_sum`, `card_sort`, `ranking`, `slider`, `nps`, `star_rating`, `cascade`, `date`, `phone`, `textbox_list`, `image_choice_single`, `image_choice_multi` — stem + type imported; finish setup in builder (warnings shown)
- **Legacy JSON aliases** (normalized on import): `max_diff` → `maxdiff`, `semantic_differential` → `semantic_diff`, `bipolar` → `bipolar_matrix`, `image_choice` → `image_choice_single`
- **Images:** no binary image import; add images in the builder after import

`settings.onePerPage` in JSON/webhook can insert page breaks between questions when enabled (workbook path uses item list order as authored).

---

## 6. Integration API keys & n8n

### Create a key

1. **Platform settings** → **Integration keys** (Enterprise admin).
2. **Create key** — label e.g. `n8n production`.
3. Copy `rsk_live_…` immediately — it is **shown once**.
4. Store in n8n credentials (HTTP Header Auth or custom header).

### Revoke a key

Integration keys → trash icon on the key. All workflows using that key receive **401**. Create a new key and update n8n.

### Webhook endpoint

```http
POST /api/integrations/v1/surveys/import
```

- **Authentication (either):**
  - `Authorization: Bearer rsk_live_…`
  - `X-Rescope-Api-Key: rsk_live_…`
- **No browser session / CSRF** — API key only.
- **Idempotency:** header `Idempotency-Key: <unique>` and/or body field `externalId`. Repeating the same id returns **200** with the same `surveyId` (no duplicate survey).

**Local dev base URL:** `http://127.0.0.1:3003` (API).  
**Production:** your app API host (same origin as `/api` in production).

### Minimal JSON body (canonical schema v1)

Use **codes**, not database UUIDs. Do **not** set `status: live`.

```json
{
  "schemaVersion": 1,
  "externalId": "n8n-exec-12345",
  "survey": {
    "title": "Webhook test survey",
    "surveyCode": "WH01"
  },
  "items": [
    {
      "code": "Q1",
      "itemType": "question",
      "questionType": "single_select",
      "text": "How satisfied are you?",
      "required": true,
      "options": [
        { "code": "Q1_O1", "text": "Very satisfied" },
        { "code": "Q1_O2", "text": "Not satisfied", "terminates": true }
      ]
    },
    {
      "code": "Q2",
      "itemType": "question",
      "questionType": "open_text",
      "text": "Additional comments",
      "multiline": true
    }
  ]
}
```

**Success:** `201` with `surveyId`, `revision`, `status: "pending_review"`, optional `warnings`.  
**Validation failure:** `422` with `errors[]` (`path`, `code`, `message`).  
**Not Enterprise:** `403` `IMPORT_NOT_INCLUDED`.  
**Rate limit:** `429` on webhook (per organization).

### curl example (local)

```bash
curl -s -X POST 'http://127.0.0.1:3003/api/integrations/v1/surveys/import' \
  -H 'Authorization: Bearer rsk_live_YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: my-test-001' \
  -d @- <<'EOF'
{
  "schemaVersion": 1,
  "externalId": "my-test-001",
  "survey": { "title": "curl import test" },
  "items": [
    {
      "code": "Q1",
      "itemType": "question",
      "questionType": "single_select",
      "text": "Pick one",
      "options": [
        { "code": "Q1_O1", "text": "A" },
        { "code": "Q1_O2", "text": "B" }
      ]
    }
  ]
}
EOF
```

### n8n workflow outline

1. **Trigger** — manual, webhook, or schedule (for testing).
2. **Optional: AI node** — system prompt: output **only** JSON matching schema v1; use codes `Q1`, `Q1_O1`; never set Live; include `externalId` from execution id.
3. **HTTP Request**
   - Method: POST
   - URL: `{API_BASE}/api/integrations/v1/surveys/import`
   - Auth header: Bearer + integration key
   - Body: JSON from previous step
   - Header: `Idempotency-Key` = `{{ $execution.id }}`
4. **IF** status 201/200 → notify with `surveyId` and builder link `#/builder/{{surveyId}}`
5. **IF** 422 → surface `errors` for fixing the prompt or payload

---

## 7. Staff API (session cookie — not for n8n)

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
5. [ ] Create integration key → curl or n8n → **201** → open builder.
6. [ ] Repeat same `externalId` → **200** idempotent.
7. [ ] Revoke key → **401**; new key works.
8. [ ] Append on **Draft** survey → items grow.
9. [ ] Append on **Live** survey → **422** `IMPORT_STATUS_LOCKED`.
10. [ ] Set **Live** → public preview works.

**Automated:** `npm run test:survey-import` (unit + integration; integration needs API on `PORT` from `.env`).

---

## 9. AI / automation prompt hints

When generating webhook JSON:

- `schemaVersion: 1` only.
- One page break item between pages if `settings.onePerPage` is true (JSON).
- Screening: `terminates: true` on options or termination rules (advanced sheets — phase 2).
- Branch targets reference **page break codes** that appear later in `items[]`.
- Use builder `questionType` keys (`maxdiff`, `semantic_diff`, `bipolar_matrix`, `image_choice_single`, …). Legacy aliases above are accepted.
- Partial types: still emit `questionType` and `text` so the stub appears in the builder.

---

## Related docs

- [DEVELOPMENT.md](DEVELOPMENT.md) — local `dev:docker`, ports, seed accounts.
- [OPERATIONS.md](OPERATIONS.md) — production operations.