# Code Reference

Module layout and stable import paths for developers extending question types, wiring features, or onboarding to the codebase.

**Related:** [ARCHITECTURE.md](ARCHITECTURE.md) · [DEVELOPMENT.md](DEVELOPMENT.md) · [ERROR_HANDLING.md](ERROR_HANDLING.md)

---

## Top-level components

Import from `@/components`:

| Export | Module | Purpose |
|--------|--------|---------|
| `LoginPage` | `auth/LoginPage` | Admin login |
| `Dashboard` | `dashboard/Dashboard` | Survey library home |
| `PlatformConsole` | `dashboard/PlatformConsole` | Platform owner vendor console |
| `PlatformSettings` | `dashboard/PlatformSettings` | Clients/topics admin |
| `SurveyBuilder` | `builder/SurveyBuilder` | Main builder UI |
| `SurveyMetadata` | `builder/SurveyMetadata` | Internal survey fields |
| `ExportManager` | `builder/ExportManager` | Response CSV export modal |
| `SurveyTestRunner` | `builder/test-runner` | Branch simulation modal |
| `SurveyPreview` | `taker/SurveyPreview` | Respondent-facing survey |

### Builder layout

```
builder/
├── panels/          AddPanel, StatsPanel, EmptyState
├── test-runner/     analyzeBranches, runSimulation, SurveyTestRunner
├── editors/         QuestionTypeEditor + type editors (registry)
├── items/           QuestionCard, PageBreakItem, GroupItem, …
└── SurveyBuilder.jsx
```

### Taker layout

```
taker/
├── questions/       QuestionRenderer + type renderers (registry)
├── screens/         CoverPage, CompletionScreen, TerminationScreen, ClosedSurveyScreen
└── SurveyPreview.jsx
```

### Shared UI

Import from `@/components/shared`:

| Export | Purpose |
|--------|---------|
| `RichTextEditor` | HTML content editor |
| `VisibilityEditor` | Conditional show/hide panel |
| `ConditionBuilder` | Shared condition list |
| `EditableListRow` | Ranking/constant-sum/textbox/maxdiff/card-sort rows |
| `DeletableTextInput` | Matrix row/column label inputs |
| `ErrorBoundary` | Render error recovery wrapper |

---

## Store

Import from `@/store/surveyStore` (backward-compatible barrel):

| Export | Module | Purpose |
|--------|--------|---------|
| `newId` | `store/id.js` | UUID generator |
| `makeQuestion`, `makeOption`, … | `store/factories.js` | Item/question factories |
| `INITIAL_STATE` | `store/initialState.js` | Default builder state |
| `surveyReducer` | `store/surveyReducer.js` | All dispatch actions |

### Key dispatch actions

| Action | Description |
|--------|-------------|
| `ADD_QUESTION`, `ADD_PAGE_BREAK`, `ADD_GROUP`, `ADD_TEXT_BLOCK`, `ADD_TERMINATION_BLOCK` | Insert items |
| `UPDATE_ITEM`, `DELETE_ITEM`, `DUPLICATE_ITEM`, `REORDER_ITEMS` | Item CRUD |
| `ADD_OPTION`, `UPDATE_OPTION`, `DELETE_OPTION`, `REORDER_OPTIONS` | Choice options |
| `UPDATE_MATRIX_*`, `ADD_MATRIX_*`, `DELETE_MATRIX_*` | Matrix rows/cols |
| `SET_ITEM_VISIBILITY_MODE`, `ADD/UPDATE/DELETE_VISIBILITY_CONDITION` | Visibility rules |
| `ADD/UPDATE/DELETE_TERMINATION_CONDITION` | Termination block conditions |
| `ADD/UPDATE/DELETE_TERMINATION_RULE` | Per-question termination rules |
| `SET_SURVEY_FIELD`, `SET_SURVEY_SETTING` | Survey metadata |

---

## Logic engines

Pure functions in `src/utils/survey/` — evaluated outside React components.

### Question metadata (single source of truth)

`@/utils/survey/questions/questionHelpers.js`

- `QUESTION_TYPES`, `QUESTION_TYPE_KEYS` — canonical type list
- `TYPE_ICONS`, `TYPE_COLORS` — builder UI tokens
- `isChoiceType(type)` — choice question check

### Condition evaluation

| Module | Exports | Used by |
|--------|---------|---------|
| `conditionConstants.js` | Operator labels | ConditionBuilder, TerminationEditor |
| `conditionEngine.js` | `evalCondition`, `evalConditionSet` | visibility, termination, test runner |
| `visibilityEngine.js` | `isItemVisible`, `buildVisiblePages` | taker, test runner |
| `terminationEngine.js` | `evalBlock`, `checkTermination` | taker, test runner |
| `branchEngine.js` | Page skip rules | taker |
| `externalRedirectEngine.js` | URL redirects on rule match | taker |

### Taker runtime

| Module | Exports |
|--------|---------|
| `answerValidation.js` | `validateAnswer(question, value)` |
| `shuffleArray.js` | Fisher–Yates shuffle |
| `piping.js` | Answer piping into text/options |

### CSV export

Import from `@/utils/csvExport`:

| Export | Module |
|--------|--------|
| `generateCSV` | `csv/generateCSV.js` |
| `generateTemplateCSV` | `csv/generateCSV.js` |
| `downloadCSV` | `csv/downloadCSV.js` |

---

## Persistence layer

Dual-mode stores branch on `useApi` (`src/config/api.js`):

| Module | Local mode | API mode |
|--------|------------|----------|
| `surveyLibrary.js` | localStorage | `api/surveys.js` |
| `responseStore.js` | localStorage | `api/responses.js` |
| `authStore.js` | localStorage credentials | HttpOnly cookies + sessionStorage |
| `dncStore.js` | localStorage | `api/dnc.js` |
| `platformStore.js` | localStorage | `api/platform.js` |

---

## Backend routes

| Prefix | Auth | Purpose |
|--------|------|---------|
| `/api/auth/*` | Mixed | Signup, login, logout, session |
| `/api/dashboard` | JWT | Survey library |
| `/api/surveys/:id` | JWT | Survey CRUD |
| `/api/surveys/:id/responses` | JWT | Response management |
| `/api/surveys/:id/dnc` | JWT | DNC list |
| `/api/platform/*` | JWT | Clients, topics, users |
| `/api/billing/*` | JWT (admin) | Subscription, brand, domain verification |
| `/api/vendor/*` | JWT (platform_owner) | Cross-org administration |
| `/api/admin/*` | JWT (admin) | Employee stats |
| `/api/public/*` | None | Live survey, response submit |
| `/api/internal/*` | Secret token | Caddy ask, embed CSP |

Route handlers: `server/src/routes/`. Business logic: `server/src/lib/`.

Global errors: `server/src/lib/httpErrors.js` → `publicErrorResponse()` (see [ERROR_HANDLING.md](ERROR_HANDLING.md)).

---

## Shared package

`shared/` — imported as `@shared/` (frontend) or relative path (backend):

| Module | Purpose |
|--------|---------|
| `surveyUrl.js` | Public paths, white-label URLs, hostname parsing |
| `planFeatures.js` | Subscription feature gates |
| `planCatalog.js` | Plan definitions and pricing |
| `matrixAnswer.js` | Matrix answer normalization |
| `brandTheme.js` | Brand kit validation |
| `domainVerification.js` | DNS verification state |

---

## Adding a new question type

1. Add entry to `QUESTION_TYPES` in `questionHelpers.js` (+ icon/color)
2. Add default config in `store/factories.js` → `makeQuestion`
3. Create builder editor — register in `QuestionTypeEditor.jsx`
4. Create taker renderer — register in `QuestionRenderer.jsx`
5. Add validation in `answerValidation.js` if needed
6. Add CSV formatting in `csv/formatAnswer.js` + `csv/sampleValue.js`
7. Run `npm run check:registries` — must pass with zero missing types

---

## Verification

### Registry parity

```bash
npm run check:registries
```

Ensures builder registry, taker registry, `TYPE_ICONS`, and `TYPE_COLORS` match `QUESTION_TYPES`.

### Manual smoke test

[SMOKE_CHECKLIST.md](SMOKE_CHECKLIST.md)

---

## Error boundaries

`ErrorBoundary` wraps major surfaces in `App.jsx`:

| Surface | Recovery |
|---------|----------|
| Dashboard | Library list errors |
| SurveyBuilder | Builder errors — reset returns to dashboard |
| SurveyPreview | Taker/preview errors — Try again / Reload |

Development shows the error message. Production shows a friendly recovery screen.

Full stack behavior (API mapping, `apiFetch`, auth codes, tests): [ERROR_HANDLING.md](ERROR_HANDLING.md).

---

## Registry pattern

```
questionHelpers.js  ← single source of truth for types
       │
       ├── QuestionTypeEditor (builder registry)
       └── QuestionRenderer (taker registry)
```

Both registries must stay in sync. `npm run check:registries` enforces this.
