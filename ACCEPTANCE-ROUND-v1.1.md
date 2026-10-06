# LiftEngine v1.1 — Acceptance Round

Date: 2026-10-06  
Branch: `v1.1-exercise-library`  
Development version: `1.1.0-alpha.1`

## Automated acceptance

The acceptance gate validates the First Pack as a real product surface rather than only validating schema integrity.

### Search and discovery
- canonical Spanish names;
- English aliases;
- accent-insensitive aliases;
- muscle-group queries such as `pecho` and `espalda`;
- equipment queries such as `barra`;
- muscle filter including primary, secondary and stabilizer roles;
- equipment and movement-pattern filters.

### UI and accessibility
- six primary navigation tabs on desktop and mobile;
- Exercise Library browser controls;
- ARIA tablist/tab/tabpanel semantics;
- Arrow Left/Right, Home and End keyboard navigation;
- training becomes inert while the technical sheet is open;
- interaction is restored when the sheet closes.

### Visual pack
- every referenced asset exists;
- canonical per-exercise folders;
- no duplicate asset references;
- SVG viewBox and image semantics;
- no scripts, foreignObject or inline event handlers;
- no essential embedded text;
- standard LiftEngine visual palette;
- visual pack byte budget.

### Offline and reliability
- Exercise Library resources are present in the non-critical offline manifest;
- bulk educational assets do not block core app-shell installation;
- background library warmup is wired through the Service Worker.

## Physical acceptance still required

Automation cannot certify how the visual system feels on a real display. Before promoting v1.1, perform:

1. iPhone/Safari or installed PWA — browse all 15 cards and open at least five sheets.
2. Active workout — open a technical sheet, move across all five internal tabs, close it and confirm the same workout/set remains active.
3. Desktop Chrome and Brave — verify six-tab navigation, search, filters and sheet sizing.
4. Offline — after one connected launch, disconnect network and confirm browser + at least three complete exercise sheets still open.
5. Visual comparison — inspect hero, muscle map, steps and mistakes at normal phone brightness and note any anatomy/contrast/scale inconsistency.

Any issue found in physical acceptance is treated as a v1.1 defect, not as a reason to expand the catalog.
