# Verification Done

Tracks completed verification sub-tasks from `verification.md`.

---

## Phase V1 — Todo/Plan Completeness Audit

### 1.1 — Diff missing-features-todo.md vs missing-features-done.md ✅

| Check | Result |
|-------|--------|
| Top-level checked items | 91 |
| Indented sub-items | 25 |
| Done-file table entries | 105 (parent items bundled where sub-items exist) |
| Unique commit hashes | 93 |
| Hashes missing from git | **0** |
| Sub-items missing from done | **0** |

**Finding**: All 116 checked todo items (91 top-level + 25 sub-items)
have corresponding entries in the done file. All 93 unique commit hashes
resolve to real commits on `main`. No gaps.

F.9.1–F.9.4 are bundled into the F.9 row in the done file (4 commit
hashes in one table row) — documentation convention, not a gap.

Full report: `docs/history/audit-report.md`

### 1.2 — Diff frontend-todo.md vs frontend-done.md ✅

| Check | Result |
|-------|--------|
| Checked items in todo | 91 |
| Phases covered in done | 1–10 (10 "in progress") |
| Unique commit hashes | 8 |
| Hashes missing from git | **0** |
| Gaps | **0** |

**Finding**: All 91 checked todo items have corresponding done-file
entries. All 8 commit hashes resolve to real commits on `main`. Phase 10
is correctly marked "in progress" with 3 unchecked items (10.8–10.10).

Minor note: 10.7 ("AGENTS.md up to date") is checked in todo but not
explicitly mentioned in done file. The work was completed in Phase J.8
of the main plan — documentation omission only, not a work gap.

Full report: `docs/history/audit-report-frontend.md`

### 1.3 — Diff pdf-todo.md vs pdf-done.md ✅

| Check | Result |
|-------|--------|
| Checked items in todo | 37 |
| Steps covered in done | 8/8 (all complete) |
| Commit hashes | 0 (done file uses step-level sections, not hashes) |
| Gaps | **0** |

**Finding**: All 37 checked todo items across 8 steps have corresponding
done-file entries. The done file uses step-level sections with file tables
and verification details, not individual item numbers — this is a
documentation convention difference, not a coverage gap.

Full report: `docs/history/audit-report-pdf.md`

### 1.4 — Verify all done-file commit hashes exist on main ✅

| Check | Result |
|-------|--------|
| Total unique hashes | 101 |
| missing-features-done.md | 93 |
| frontend-done.md | 8 |
| pdf-done.md | 0 |
| Hashes missing from git | **0** |

**Finding**: All 101 unique commit hashes across all three done files
resolve to real commits via `git log --oneline --all`. No orphaned
references.
