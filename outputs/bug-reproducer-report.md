# Bug Reproducer

## ✅ FIX_PROVEN — Bug reproduced and fix proven

> The same three focused reproducers changed from failing to passing and the full relevant suite passed.

**Project:** site-blocker
**Bug:** Regex parsing, path casing, and temporary-unblock navigation defects
**Environment:** Node.js 20 or newer, local unit-test harness, branch codex/reproduce-ranked-bugs
**Generated:** 2026-07-17

## Discovery scope

- README rule contracts and manifest
- Rule parsing and declarativeNetRequest generation
- Content-script fallback matching
- Popup validation and temporary-unblock navigation
- Existing unit tests and recent Git history

## Ranked and tested candidates

| # | Candidate | Contract evidence | Trigger | Location | Confidence | Outcome |
|---:|---|---|---|---|---|---|
| 1 | Question-mark regex quantifiers are silently truncated | README and validation support regular-expression path rules. | Enter example.com/^articles?$. | /Users/alfa/IdeaProjects/site-blocker/src/popup/validation.js:115 | high | REPRODUCED |
| 2 | DNR path matching is case-insensitive while fallback matching is case-sensitive | DNR and fallback layers implement the same stored rules. | Use example.com/news against https://example.com/News. | /Users/alfa/IdeaProjects/site-blocker/src/background/rules.js:135 | high | REPRODUCED |
| 3 | Unblocking a different listed rule reuses the current block-page URL | Each unblock action targets its displayed rule and opens that rule or its matching original URL. | From an example.com block page, unblock openai.com from the rule list. | /Users/alfa/IdeaProjects/site-blocker/src/popup/popup.js:436 | medium | REPRODUCED |

## Original report

No specific bug was supplied. The user requested a read-only scan, ranked candidates, focused reproduction tests, and fixes only after separate approval.

| Contract | Expected | Actual |
|---|---|---|
| Observed behavior | Regex syntax remains intact, both blocking layers use the same path casing, and an unblock action navigates to the selected rule. | Regex syntax was truncated, DNR overblocked case variants, and the popup navigated to an unrelated still-blocked URL. |

## Minimal reproduction

Three focused unit tests exercised popup normalization, DNR condition semantics, and a mismatched block-page/unblock selection.

**Confirming signal:** The approved targeted command failed exactly three tests with the predicted actual values.

### Reproduction files approved at Gate 1

- [popup-validation.test.js](/Users/alfa/IdeaProjects/site-blocker/tests/unit/popup-validation.test.js:31) — Proves regex quantifiers survive popup normalization.
- [rules.test.js](/Users/alfa/IdeaProjects/site-blocker/tests/unit/rules.test.js:235) — Proves DNR and fallback path casing agree.
- [popup-current-site.test.js](/Users/alfa/IdeaProjects/site-blocker/tests/unit/popup-current-site.test.js:249) — Proves a different selected rule does not reuse the current blocked URL.

## Red to green evidence

| Evidence | Before fix | After fix |
|---|---:|---:|
| Exit code | 1 | 0 |
| Timed out | False | False |
| Duration | 192.419 ms | 173.334 ms |
| Same command | — | True |
| Broader suite | — | passed |

### Before — failing evidence

```text
49 passed, 3 failed. Regex input example.com/^articles?$ was normalized to example.com/^articles. The DNR regex matched https://example.com/News while the fallback matcher did not. Unblocking openai.com from the example.com block page reopened https://example.com/private instead of https://openai.com/.
```

### After — fixed evidence

```text
53 passed, 0 failed.
```

## Root cause

Regex paths were split at question marks before regex recognition; DNR disabled case sensitivity globally; popup navigation reused currentBlockedUrl without verifying it belonged to the selected rule.

## Approved fix

Recognized regex paths before query stripping in all parsers, made DNR conditions path-case-sensitive, and gated original-URL reuse on an exact selected-rule match.

**Why this is causal:** Each change directly alters the condition responsible for its corresponding failing assertion, and the same assertions pass without weakening.

### Production files approved at Gate 2

- [validation.js](/Users/alfa/IdeaProjects/site-blocker/src/popup/validation.js:115) — Preserves regex question-mark syntax during validation.
- [rules.js](/Users/alfa/IdeaProjects/site-blocker/src/background/rules.js:27) — Preserves regex syntax and aligns DNR case semantics.
- [blocker.js](/Users/alfa/IdeaProjects/site-blocker/src/content/blocker.js:36) — Keeps fallback regex parsing aligned.
- [popup.js](/Users/alfa/IdeaProjects/site-blocker/src/popup/popup.js:436) — Uses an original URL only for its matching rule.

## Verification

| Check | Status | Evidence |
|---|---|---|
| Approved targeted reproducer | ✅ passed | Same command changed from 3 failures to 0 failures. |
| Content fallback regression | ✅ passed | Regex question-mark behavior passed through the real content script. |
| Full unit suite | ✅ passed | 81 tests passed. |
| Whitespace validation | ✅ passed | git diff --check reported no errors. |

## Reproduce

```bash
node --test tests/unit/popup-validation.test.js tests/unit/rules.test.js tests/unit/popup-current-site.test.js
```
```bash
node --test tests/unit/content-blocker.test.js
```
```bash
npm test
```

## Limitations

- No browser UI was used; declarativeNetRequest behavior is represented by its documented condition flag in the unit harness.

## Residual risks

- A packaged extension was not manually exercised in Chrome, Edge, or Firefox.

## Notes

- Gate 1 approved only the reproduction tests; Gate 2 separately approved the exact production fix.
- No dependencies, migrations, or unrelated cleanup were introduced.

---

Generated by `$bug-reproducer`. A fix is proven only by the same red-to-green reproducer plus relevant broader checks.
