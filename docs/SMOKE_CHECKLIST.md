# Manual Smoke Checklist

Run after changes that touch builder, taker, visibility, termination, export, or API persistence.

**How to run (API mode):** `npm run dev:docker` → log in at http://localhost:5173. For public routes, open `#/take/SURVEY_ID` or the shareable URL.

Use a survey with **at least one of each** question type when possible.

---

## 1. Auth & dashboard

- [ ] Login with valid credentials
- [ ] Dashboard loads survey list
- [ ] Create new survey opens builder
- [ ] Open existing survey loads items correctly
- [ ] Logout returns to login page

---

## 2. Builder — structure

- [ ] Add each question type from sidebar (or spot-check key types)
- [ ] Add page break, group, text block, termination block
- [ ] Drag-reorder items
- [ ] Duplicate and delete a question
- [ ] Collapse/expand a group
- [ ] Survey title edits persist after reload
- [ ] Auto-save: refresh dashboard — changes still present

---

## 3. Builder — question editing

- [ ] Change question type via type badge menu
- [ ] Required toggle on/off
- [ ] Piping token inserted into question text
- [ ] Visibility rules: add condition, AND/OR toggle, save
- [ ] Choice question: options, exclusive, open-text companion, instant terminate
- [ ] Email capture field (DNC) — only one per survey

---

## 4. Cover page & branding

- [ ] Cover page enabled — shows title, description, start button in preview
- [ ] Cover page disabled — skips to Q1
- [ ] Company logo / cover image display
- [ ] Branding settings (logo position, start button text)

---

## 5. Preview mode (builder)

- [ ] Preview opens from builder toolbar
- [ ] Exit preview returns to builder
- [ ] Progress bar on multi-page surveys
- [ ] Back / Next navigation
- [ ] Validation errors on required empty fields
- [ ] Submit shows completion screen
- [ ] Download CSV from completion screen

---

## 6. Public route

- [ ] Valid survey ID loads taker (no login)
- [ ] Invalid ID shows "Survey not found"
- [ ] Finish shows "Saving your response…" and then the existing completion screen
- [ ] Closed survey shows closed screen
- [ ] Draft survey behavior matches expectation
- [ ] Complete survey — response saved (check Export Manager)

---

## 7. Visibility

- [ ] Question hidden until prior answer matches rule
- [ ] Question shown when rule matches (`show_if`)
- [ ] Question hidden when rule matches (`hide_if`)
- [ ] AND/OR precedence: `A AND B OR C` behaves as `(A AND B) OR C`
- [ ] Hidden page break merges pages correctly
- [ ] Hidden group hides all questions inside

---

## 8. Termination / screen-out

- [ ] Instant terminate on single-select option
- [ ] Instant terminate on multi-select option
- [ ] Per-question termination rule (`if_any` / `if_none`)
- [ ] Termination block fires on page next
- [ ] Screen-out page shows correct message
- [ ] Terminated response appears in exports

---

## 9. Piping

- [ ] Question text pipes prior answer
- [ ] Piped options from earlier choice question
- [ ] Text block title/content piping in preview

---

## 10. Question types (taker)

| Type | Answer & submit |
|------|-----------------|
| single_select | |
| multi_select | |
| dropdown | |
| open_text | |
| date | |
| matrix | |
| bipolar_matrix | |
| maxdiff | |
| card_sort | |
| constant_sum | |
| slider | |
| nps | |
| star_rating | |
| ranking | |
| textbox_list | |
| semantic_diff | |
| cascade | |
| image_choice_single | |
| image_choice_multi | |

---

## 11. Test runner

- [ ] Open Test Runner from builder
- [ ] Branch list includes completion + screen-out paths
- [ ] Run simulation on a branch — log shows expected path
- [ ] No console errors

---

## 12. Export

- [ ] CSV template download from builder
- [ ] Export Manager lists saved responses
- [ ] Download response CSV — columns match question types
- [ ] NPS / MaxDiff columns present where applicable
- [ ] DNC flag on email match (if configured)

---

## 13. Platform & billing (API mode)

- [ ] Platform settings save and reload
- [ ] Billing overview shows current plan
- [ ] Fingerprint toggle affects preview header badge
- [ ] DNC list upload / management

---

## 14. Automated guardrails

```bash
npm run check:registries
npm run build
```

- [ ] `check:registries` exits 0
- [ ] `build` completes without errors

---

## Test log

| Date | Tester | Branch / commit | Failures |
|------|--------|-----------------|----------|
|      |        |                 |          |
