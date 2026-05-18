# CAP Tool Pro — TODO

## Phase 1: Schema, Theme, Layout
- [x] DB schema: cap_messages table (id, userId, type, identifier, sender, status, severity, xml, createdAt)
- [x] DB schema: feed_runs table (id, userId, feedUrl, totalCount, passCount, failCount, errors JSON, createdAt)
- [x] Run migration SQL
- [x] Global dark theme CSS variables in index.css
- [x] DashboardLayout sidebar with nav items: Composer, Parser, History, Feed Ingestion
- [x] Severity badge component (Extreme=red, Severe=orange, Moderate=yellow, Minor=green)
- [x] Status badge component

## Phase 2: Backend tRPC Procedures
- [x] cap.build — build CAP v1.2 XML from structured input with full semantic validation
- [x] cap.validate — validate XML bytes against XSD schema, return validation summary
- [x] cap.parse — parse raw CAP XML into structured CAPMessage object
- [x] cap.compose — combined build+validate+save to history in one procedure
- [x] history.list — list all cap_messages for authenticated user
- [x] history.get — get single message with full XML
- [x] history.delete — delete a message
- [x] feed.run — fetch CAP feed URL, parse all messages, return stress-test report
- [x] feed.history — list past feed runs for user
- [x] Copy XSD schema file into server/cap/schemas/

## Phase 3: Landing Page
- [x] Public landing page with hero, feature grid, login CTA
- [x] Manus OAuth login button

## Phase 4: Composer Page
- [x] Alert section: sender, status, msgType, scope, restriction (conditional), addresses (conditional), references (conditional), note
- [x] Info section: language, category, event, urgency, severity, certainty, headline, description, instruction, effective, onset, expires, responseType, senderName
- [x] Area section: areaDesc, circle, polygon
- [x] Conditional field visibility (restriction/addresses/references)
- [x] Server-side validation with inline errors
- [x] Validation summary panel (8 checks with pass/fail)
- [x] Generated XML display with copy-to-clipboard
- [x] External validator link to cap-validator.appspot.com
- [x] Save to message history on success

## Phase 5: Parser Page
- [x] Textarea for pasting raw CAP XML
- [x] Structured field breakdown per info block
- [x] Error display on invalid XML
- [x] Save parsed message to history

## Phase 6: Message History
- [x] Table with columns: timestamp, type, identifier, sender, status, severity badge
- [x] Detail view modal/page with full XML display
- [x] Copy XML button in detail view
- [x] Delete message action

## Phase 7: Feed Ingestion
- [x] Feed URL input (NOAA, GDACS presets)
- [x] Run stress-test button
- [x] Progress indicator during fetch
- [x] Results report: pass/fail counts, per-message error details
- [x] Past run history table

## Phase 8: Tests
- [x] Vitest: cap.build semantic validation (8 cases)
- [x] Vitest: cap.validate XSD pass/fail (5 cases)
- [x] Vitest: cap.parse round-trip (5 cases)
- [x] Vitest: auth.logout guard (1 case)
- [x] All 19 tests passing

## Phase 9: Delivery
- [x] TypeScript: 0 errors
- [x] Checkpoint saved
- [x] Hosted URL delivered

## Phase 10: Map-Based Area Drawing (Leaflet)
- [x] Install leaflet, leaflet-draw, @types/leaflet, @types/leaflet-draw
- [x] Build MapAreaEditor component: Leaflet map with draw toolbar (polygon + circle)
- [x] Polygon draw: click to place vertices, double-click to close ring, auto-format as "lat,lon lat,lon ..." with first=last
- [x] Circle draw: click center + drag radius, auto-format as "lat,lon radius" (CAP circle format)
- [x] Display existing areas as overlays on the map (edit/delete support)
- [x] Replace manual polygon/circle text inputs in Compose page with MapAreaEditor
- [x] Show drawn shapes list below map with remove button per shape
- [x] Responsive map panel (min-height 400px, full-width in form layout)
- [x] TypeScript clean, tests passing, checkpoint saved

## Phase 11: DateTime Picker Widget
- [x] Build DateTimePicker component: shadcn Calendar popover + hour/minute dropdowns
- [x] Replace effective, onset, expires datetime-local inputs in InfoSubForm
- [x] Expires field marked required (red asterisk), effective and onset optional
- [x] Output ISO 8601 string to parent form state (same contract as before)
- [x] TypeScript clean, tests passing, checkpoint saved
