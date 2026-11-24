# Requirements: Skeleton Contract

## Introduction
The skeleton contract defines how a child USSD app is declared so that the universal
skeleton in `core/` can run it without any domain code. It is the boundary that makes the
Skeleton Crew claim verifiable: one core, many apps, zero hardcoding.

## Glossary
- **Skeleton**: the code in `core/`.
- **App**: a folder `apps/<app_id>/` containing `manifest.json`, optionally `data.json` and `handlers.py`.
- **Node**: one USSD screen in the app graph (`menu`, `input`, `action`, `static`).
- **Handler**: a pure Python function exported by `handlers.py`.

## Requirement 1: App discovery
**User story:** As an app author, I want my app to be picked up automatically, so that I never edit `core/` to ship a new service.

### Acceptance criteria
1. WHEN the server starts THE SYSTEM SHALL load every `apps/*/manifest.json` in alphabetical folder order.
2. WHEN a manifest is loaded THE SYSTEM SHALL validate it against `schemas/app-manifest.schema.json` (JSON Schema Draft 2020-12).
3. IF a manifest `id` differs from its folder name THEN THE SYSTEM SHALL reject the app with an explicit error.
4. IF two apps declare the same `shortcode` THEN THE SYSTEM SHALL reject the second app with an explicit error.
5. THE SYSTEM SHALL load `data.json` when present and pass it read-only to handlers, defaulting to `{}`.
6. THE SYSTEM SHALL register every public top-level function defined in `handlers.py` using `importlib`, without any static import of app code.

## Requirement 2: Graph integrity
**User story:** As a maintainer, I want broken manifests to fail fast, so that judges never hit a dead screen.

### Acceptance criteria
1. IF `entryNode` is not a key of `nodes` THEN THE SYSTEM SHALL reject the app.
2. IF any option `next` or node `next` references an unknown node THEN THE SYSTEM SHALL reject the app and name the node.
3. IF an `action` node references a handler not exported by `handlers.py` THEN THE SYSTEM SHALL reject the app.
4. IF an option uses a reserved navigation key (`backKey`, `homeKey`, `nextPageKey`) THEN THE SYSTEM SHALL reject the app.
5. IF an `input` node has no `saveAs` or no `next` THEN THE SYSTEM SHALL reject the app.

## Requirement 3: Node semantics
**User story:** As an app author, I want four universal node types, so that I can express menus, forms and computed answers declaratively.

### Acceptance criteria
1. WHEN a `menu` node is rendered THE SYSTEM SHALL display its `title` followed by one `key. label` line per option.
2. WHEN a user picks a menu option that declares `set` THE SYSTEM SHALL merge those values into the session context before moving to `next`.
3. WHEN a value is submitted on an `input` node THE SYSTEM SHALL validate it with `validation` (`kind`, `pattern`, `min`, `max`), store it under `saveAs`, and move to `next`.
4. WHEN an `action` node is rendered THE SYSTEM SHALL call its handler with `(context, data)` and accept either a string or `{text, end, context}`.
5. WHEN a `static` node is rendered THE SYSTEM SHALL interpolate `{name}` placeholders from the session context.
6. WHERE a node declares `end: true` (or a handler returns `end: true`) THE SYSTEM SHALL close the session with an `END` frame.

## Requirement 4: Theme and demo metadata
**User story:** As a judge, I want each app to look and feel different, so that the Skeleton Crew contrast is obvious in seconds.

### Acceptance criteria
1. THE SYSTEM SHALL expose each app `theme`, `shortcode`, `quickPresets` and `nodes` through `GET /api/apps`.
2. WHEN the simulator switches app THE SYSTEM SHALL apply the theme only from that metadata, with no app-specific code in the frontend.

## Requirement 5: Zero hardcoding and size budget
**User story:** As a Skeleton Crew judge, I want proof that the core is generic and small.

### Acceptance criteria
1. THE SYSTEM SHALL keep `core/` strictly under 400 logical lines (not blank, not a comment, not a docstring).
2. THE SYSTEM SHALL contain no forbidden domain term (as listed in `scripts/check_skeleton_purity.py`) anywhere in `core/`.
3. WHEN `scripts/check_skeleton_purity.py` detects a violation THE SYSTEM SHALL exit with code 1 and list each file, line and term.
4. THE SYSTEM SHALL report the live audit result through `GET /api/metrics`.
