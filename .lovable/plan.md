# UFH Opportunity Hub — Round 5 Improvements

This round bundles 17 related fixes spanning the bulletin extractor, eligibility engine, profile, dashboard, admin workflow management, and AI assistant. Grouped into 6 themes so each migration / file touches once.

## 1. Bulletin Extraction – auditing, re-runs, externals, publish

- Add `bulletin_runs` table (id, uploaded_by, file_name, file_hash, created_at, opportunities jsonb, drafts_created jsonb). Admin-only RLS.
- `extract-bulletin` writes a row per run and returns `run_id`.
- `BulletinExtractor`:
  - Persist last uploaded PDF in component state so "Re-run extraction" works without re-upload.
  - Show prior runs for same hash + diff view (added/removed titles).
  - Extract eligibility hints (`requires_honours`, `requires_masters`, `target_role`, etc.) so created workflows get auto-eligibility rules.
  - "Create draft" for **external** opportunities now inserts into `external_opportunities` with `status='draft'` and logs the draft id to the run.
  - Internal drafts default to `is_active=false` (draft) instead of immediate publish.
- New "Bulletin runs" sub-tab in Admin → shows runs + their created drafts.

## 2. Workflow Draft Publish + External Drafts in list

- `workflows.is_active=false` = draft. Admin workflow list shows Drafts section with **Publish** button (sets `is_active=true`).
- Admin workflow list also includes `external_opportunities` (both draft and published) with their own Publish/Edit/Delete actions.
- Public Dashboard only shows `is_active=true` workflows and `status='published'` external opps (already correct for externals; add filter for workflow drafts on user side).

## 3. Eligibility Engine Overhaul

- Profile additions: `highest_qualification_completed` (e.g. Matric, Diploma, Bachelors, Honours, Masters, PhD) and `current_qualification` (what they're pursuing). `year_of_study` becomes a Select: 1, 2, 3, 4, Honours, Masters, Doctorate, Professor.
- Add `is_postgraduate` derivation: completed Bachelors OR currently in Honours/Masters/Doctorate.
- Rewrite `src/lib/eligibility.ts`:
  - New rule types: `requires_qualification_completed`, `requires_current_qualification`, `min_year_of_study`, `has_student_number`, `has_staff_number`, `is_postgraduate`, `target_role`.
  - Remove name/phone-style "rules" (those are app-level required fields).
  - Returns positive matches + blocking reasons + score (existing) but with the richer rule set.
- `EligibilityExplainer` updated language for postgrad logic.
- Admin `EligibilityRules` UI: dropdown of meaningful rule types (no free-text on `full_name`); shows friendly labels.
- Block ineligible users from starting an application: `Apply.tsx` checks eligibility on mount; if not eligible, shows message + back button (no draft created). Opportunity card "Apply" disabled when ineligible, with tooltip.

## 4. Opportunity Details + Apply gating

- New `OpportunityDetailsDialog` opens when clicking a card on Dashboard. Shows description, requirements, deadline, eligibility check (re-uses `EligibilityExplainer` content inline), and primary CTA "Start application" (disabled if ineligible) or "Apply externally" for external opps.
- "Apply externally" logs an `external_application_clicks` row (user_id, opportunity_id, clicked_at) and opens link in new tab.

## 5. Dashboard polish + Approval celebration

- Make stat cards clickable: "My applications" scrolls to / filters Applications section; "Unread messages" → /messages (existing); "Available opportunities" → opportunities section.
- Application withdraw: only allow when `status='submitted'` (not `under_review`/`approved`/`rejected`). Update `withdraw_application` RPC + UI button visibility.
- When an application transitions to `approved` or `rejected`, show a one-time celebration/condolence dialog using `framer-motion` confetti-style animation. Track "seen" in localStorage keyed by application id.
- Hide offer/affidavit UI on dashboard unless `offers` row exists with `status IN ('sent','template_sent','revision_requested','signed_uploaded','approved')` — i.e. only after admin explicitly sends.

## 6. AI Assistant — admin context

- `ai-assist` action `suggest` accepts a `context` field. When `context='admin_workflow_description'`, system prompt becomes: "You help a UFH administrator write a clear, professional opportunity/workflow description for prospective applicants. 3-5 sentences, formal, descriptive of purpose, requirements, and outcomes."
- `WorkflowEditor` + `AIWorkflowDialog` pass that context.

## 7. Admin workflow cards clickable

- Whole card opens editor; hover reveals quick actions (Publish/Unpublish, Duplicate, Delete) without nested click conflicts.

## Technical Notes

- 1 migration: new tables `bulletin_runs`, `external_application_clicks`, profile column additions, updated `withdraw_application`. Includes GRANTs.
- Updated edge function `extract-bulletin` for run logging + eligibility hints.
- Updated edge function `ai-assist` for admin context.
- ~12 frontend files touched. No breaking schema changes for existing data; new columns nullable with sensible defaults.

## Out of scope

- Email notifications for bulletin runs (audit log only).
- Diff visualization beyond title-level add/remove (no inline content diff).
- Rich confetti library — use lightweight inline CSS/framer-motion.
