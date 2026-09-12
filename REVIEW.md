# Norwood tool review — September 12, 2026

Source reviewed: main at `a270404`. This is a source-code review, with focused automated checks of the sync guard. It does not verify production Firestore rules, live business records, or every screen in a browser.

## Completed fixes

- **Accurate sync acknowledgements:** the sync guard now compares the content actually uploaded with the current local record before marking it synced or failed. An earlier upload's callback cannot certify a different, newer edit. The comparison includes content, not just timestamps, so edits in the same millisecond are distinguished.
- **Persistent pending warning:** showing pending uploads cancels an earlier success badge's hide timer. A newly displayed warning no longer disappears because a previous save succeeded.

Run the four regression checks with `node --test tests/sync-guard.test.cjs`. They cover old acknowledgements, late failures, same-timestamp edits, and warning visibility. The checks use fake storage and upload promises and do not write live customer data.

## Recommended next changes, in priority order

1. **Consolidate quote synchronization.** `norwood-patch.js` wraps `saveQuotesToStorage` and uploads every record in the supplied list. `norwood-sync-guard.js` also uploads the saved record, and `index.html` contains another reconciliation mechanism. This creates overlapping writes and makes offline/conflict behavior difficult to establish. Use one upload queue, track the exact acknowledged revision, and test two-device edits and deletions before replacing existing sync paths. The fixes above only correct the guard's local status reporting; they do not solve all cross-device conflicts.
2. **Protect work during application updates.** `ns-version.js` checks on return to the foreground and automatically reloads when the build changes. It does not check for an unfinished quote. Offer an update action and preserve the current draft before refreshing. Confirm restoration behavior for customers, line items, and invoice state.
3. **Separate sales tax from reported profit.** In `saveCurrentQuote`, `grand` includes tax and delivery, and the stored `profit` is `grand - cost`. This includes collected sales tax in that field. Establish the intended treatment of delivery income/cost and discounts, then make the saved calculation and reports consistent. No pricing or business formulas were changed in this patch.
4. **Make record retention explicit.** `saveCurrentQuote` truncates local history to 500 records, while cloud reconciliation can restore a larger collection. Reconcile these policies and ensure pending uploads cannot be discarded when the limit is reached. Provide reliable searchable history rather than depending on whichever records happen to be cached.
5. **Organize the active application.** The root contains several older pricing-tool HTML copies, a backup JSON, and both root and `scripts/` delivery patches. The main page is about 4 MB, and the README contains only a title. Document which files serve each screen, map dependencies, and move confirmed unused versions into a clearly identified archive after checking links. Split embedded data and code incrementally to reduce maintenance risk.

## Release validation still needed

Before deployment, check creating and editing a quote, invoice payments, weak-signal retries, cross-device synchronization, and printed output in the actual application. The four automated tests establish the narrow fixes above, not end-to-end production readiness.
