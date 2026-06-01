
# Round 4 — UFH Opportunity Hub Improvements

This plan groups 20+ requested changes into themed batches. Each item is concrete and scoped.

## 1. Registration & Role Selection
- Add a role selector on Auth signup form: **Student / Staff / Admin** (Admin requires invite — show as disabled or hidden behind code; default offer Student/Staff only, Admin requested via separate flow).
- Pass selected role into `signUp` metadata and update `handle_new_user()` trigger to read `raw_user_meta_data->>'role'` and assign accordingly (fall back to `student`).
- After sign-in, redirect: admin→`/admin`, others→`/dashboard`.

## 2. Profile Page Overhaul
- **Race field**: replace free text with `Select` (Black African, Coloured, Indian/Asian, White, Other, Prefer not to say) — SA EE Act categories.
- **Postal = Home toggle**: when on, postal hidden + auto-marked complete if home complete; persist as `addresses.kind='postal'` mirror or a flag in `profile_extra`.
- **Next of kin "same as home address" toggle**: hide NOK address inputs, copy home address on save.
- **Employment**: remove `supervisor_name` and `supervisor_contact` inputs (keep columns, just hide).
- **Staff number toggle**: "I have a staff number" checkbox; only show input when checked; don't block completion when unchecked.
- **Placeholders & examples**: add helpful placeholders/examples to every input across all profile sections.
- **Completion counter**: rewrite to include all 7 sections (Personal, Address, NoK, Employment, Banking, Financial, Documents) with both `n/n sections` AND percentage badge.
- **Missing info nudge**: banner on dashboard listing missing profile sections with "Complete now" CTA.

## 3. CV Parser Improvements
- Update `parse-cv` edge function prompt to extract structured data for: personal, addresses, next_of_kin, employment, banking, financial, qualifications/education.
- Return JSON shaped to upsert across all those tables.
- Client-side: after parse, upsert into each table (not just `profiles`).

## 4. Dashboard Cleanup
- Remove "Recent Activity" and "Latest Audit Events" widgets from `Dashboard.tsx` for non-admin users entirely.
- Move them to `Admin.tsx` (already partially there — consolidate).

## 5. Messaging Page
- New route `/messages` with list of application threads; per-thread view embeds existing `MessageThread`.
- Add a "Messages" icon (MessageSquare) to header nav with unread badge.

## 6. Application Form Fixes
- **Required documents**: fix step assignment so documents render in their own step, not the Review step. Audit `Apply.tsx` step grouping.
- **Submit confirmation**: `AlertDialog` "Are you sure all your information is correct?" before final submit.
- **Hide offer documents pre-approval**: in `OfferPanel.tsx` only render when an `offer` row exists AND `status IN ('sent','template_sent','approved',...)` — never show templates from other workflows. Confirm offer queries are scoped to `application_id`.
- Verify each workflow's offer documents are per-workflow (already are — `workflow_offer_templates.workflow_id`). Audit `SendOfferDialog` template list filter.

## 7. AI Assistant Enhancements
- **Auto-save suggestions per field**: store in `localStorage` keyed by `applicationId:fieldId`; restore on mount.
- **Rewrite-to-match button**: new action calling `ai-assist` with mode `rewrite` using current field value + workflow context.
- **Keyboard shortcuts**: Ctrl/Cmd+G generate, Ctrl/Cmd+I insert, Ctrl/Cmd+R regenerate; show hints in tooltip.

## 8. Eligibility Caching
- Cache `(user_id, workflow_id) → explanation` in `sessionStorage` (TTL 10 min). Open modal instantly when cached.

## 9. Admin Improvements
- **Delete workflows**: add delete button with confirm + cascade (workflow_fields, steps, documents, eligibility_rules, offer_templates).
- **Ranking explainer**: extend `rankApplications` to return per-document and per-profile-section contributions; render them in `RankingExplainer`.
- **Review notes button**: add visible "Review Notes" toggle/button in `ApplicationDetail.tsx` that opens an inline textarea bound to `applications.review_notes`, admin-only.

---

## Technical notes
- DB migrations needed: `handle_new_user` trigger update for role meta.
- No schema changes for race (still text) — enforced in UI.
- All UI changes preserve existing design tokens.

## Out-of-scope (defer)
- Admin invitation flow for the "Admin" role choice (will use code/secret check).
- Full real-time messaging socket layer (use existing supabase realtime already set up).

Approve to proceed; I'll batch implementation in parallel where safe.
