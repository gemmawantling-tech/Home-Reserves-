# Product groups — implementation and data protection

Project checked: `/workspace/reserves`, remote `gemmawantling-tech/Home-Reserves-`, existing GitHub Pages PWA. This is Home Reserves, not Household Organiser. app.js uses `home_reserves_inventory_v1` localStorage and IndexedDB recovery copies. There is no Firebase configuration, authentication, household sharing or server-side permission system in this repository. No Firebase migration, security rules or deployed database writes are involved; sign-in/member-access testing is therefore not applicable. Private phone inventories are not available in the workspace. All browser tests use isolated synthetic records.

## Backwards-compatible fields

- Optional root `productGroups`: `{id, name, category, unit, target}` records. There is deliberately no group quantity field.
- Optional item `productGroupId`, `flavour`, `purchasePrice` (GBP per counted stock unit). Existing brand, pack size, expiry, location, notes, barcode, nutrition, portions and batch arrays stay on each variety.
- No startup assignment/migration rewrites existing items. Old inventories remain ungrouped. Malformed group metadata is rejected on backup validation, using the existing non-destructive startup-recovery flow; optional groups absent/null remain valid.
- JSON exports and all existing recovery snapshots include the optional fields automatically. Readable CSV keeps its old columns and adds product group, brand, flavour and purchase price.

## Group semantics

Groups are scoped to one existing category. This keeps category navigation coherent and prevents moving products between food/nonfood calculations merely by grouping them. Assignments require matching categories and compatible counted units. Grams/kg and ml/litres convert explicitly. Pack/packet/pouch are counted physical packages; package sizes remain separate and can differ. Jars, tins, bottles and mass are never combined as if equivalent. Unknown quantities remain flagged, not invented. Imported incompatible memberships remain visible and excluded from the aggregate with a warning until corrected.

Group totals sum recorded individual quantities once per record ID. Batches are not separately added to that sum. Individual add/use/set/batch edits and deletion therefore immediately update totals. Targets represent recorded stock, including stock whose dates need review; food coverage retains its existing usable-date calculations. Filters show global group totals/target and disclose the matching subset when fewer varieties are visible. Food/portion/recipe calculations still iterate stock records, never group totals.

Create/rename/edit target, reviewed assignment, moving, ungrouping, optional price/flavour and ungrouped-only browsing are available. Name-based suggestions never move or create anything until a user saves. Exact duplicate group names in a category are prevented during creation; imported duplicates can be merged. Merge requires same category and compatible units, explicit confirmation, and a recovery copy. It retains destination name/unit/target (targets are not summed), redirects memberships including remembered catalogue records, and removes only the source group definition. Remove-group also confirms, creates a safety copy, and ungroups products without deleting them. Household quantity/expiry records are never merged or deleted by group operations.

Changing a grouped product's category/unit must keep membership valid or explicitly ungroup it. Organise Food validates all proposed category changes atomically before saving and explains conflicts. Main Edit corrections update the product catalogue so later scans retain group/flavour/price corrections.

## Accordions and mobile

Each main category, subcategory and product-group level allows one open sibling. Native details/name semantics are supplemented by keyboard/touch JS fallback. Closing a parent closes descendants. Expansion state is in memory only; first entry to Pantry and a refreshed app start collapsed. Old stored expansion preferences are ignored without touching inventory. “Expand all” becomes “Open first section” so controls do not contradict the exclusive behaviour. Chevron rotation/content fade are brief and respect reduced-motion preferences. Existing bottom navigation and safe-area spacing remain intact.

## Verification

Pure tests cover derived totals, unit conversion, uncounted/zero stock, duplicate IDs, immutable assignment/merge, incompatible operations, catalogue retention and optional backup validation. Browser tests cover real UI create/rename/move/unassign/merge, parent totals, targets, plus/minus, earliest-first consumption, batch addition/edit/removal, deleting a single variety, catalogue recall, backup snapshots, JSON reload, keyboard/touch accordions and 360/384/412/430px layouts. Older navigation tests were updated for deliberately collapsed/exclusive behaviour. Existing portions, energy, scanner, stocktake, recipes, expiry, backup-denial and offline-update regressions are also run. No illustrative sample quantities are installed in production.
