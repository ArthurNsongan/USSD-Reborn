# Requirements: Retro Simulator

## Introduction
A web simulator that lets judges experience a 2G USSD session in under 15 seconds, switch
between apps in one click, and inspect every telecom frame. It contains no app-specific
code: everything comes from `GET /api/apps`.

## Requirement 1: App switcher
**User story:** As a judge, I want to switch between AgriPulse and Tontine-Check instantly, so that I see two different products on one skeleton.

### Acceptance criteria
1. WHEN the page loads THE SYSTEM SHALL fetch `/api/apps` and render one switcher entry per app with its name, shortcode and badge.
2. WHEN the user selects an app THE SYSTEM SHALL apply its theme through CSS variables (`--screen-bg`, `--screen-text`, `--brand-primary`, `--brand-accent`, `--bezel`) and dial its shortcode in a new session.
3. THE SYSTEM SHALL not hardcode any app name, colour or shortcode in `frontend/src`.

## Requirement 2: Retro phone
**User story:** As a judge, I want a believable feature-phone experience.

### Acceptance criteria
1. THE SYSTEM SHALL show the current frame body in a monospace LCD with subtle CRT scanlines, a 2G signal indicator and a battery indicator.
2. THE SYSTEM SHALL show the frame prefix (`CON`/`END`), a live `n / 160` character counter and a session countdown from `sessionTimeoutSec`.
3. THE SYSTEM SHALL provide a keypad (`0-9`, `*`, `#`), Send, Back (`0`), Home (`00`), Hang up and Dial buttons, and support physical keyboard digits, Enter, Backspace and Escape.
4. WHEN a frame is `END` THE SYSTEM SHALL disable input until the user dials again.
5. THE SYSTEM SHALL render one Quick Demo button per `quickPresets` entry that dials a new session with the preset text.

## Requirement 3: Inspection panels
**User story:** As a judge, I want to verify the telecom claims myself.

### Acceptance criteria
1. THE SYSTEM SHALL provide a Frame Inspector tab showing the raw frame, a `n/160` gauge, GSM-7 validity, compression mode and fallback reason, latency, page index, stack, context and the session history.
2. THE SYSTEM SHALL provide a Decision Tree tab listing the manifest nodes as a tree from `entryNode`, highlighting the current node and the visited path.
3. THE SYSTEM SHALL provide a Telecom Webhook tab that sends an `application/x-www-form-urlencoded` request in the Africa's Talking format, shows the plain-text answer, and offers a copyable `curl` command.
4. THE SYSTEM SHALL show a Skeleton Proof bar with `core` LOC vs 400, domain leak count, apps loaded and active sessions from `/api/metrics`.

## Requirement 4: Resilience
1. IF the backend is unreachable THEN THE SYSTEM SHALL show a clear message with the command to start it.
2. THE SYSTEM SHALL build with `npm run build` with TypeScript strict mode and no errors.
