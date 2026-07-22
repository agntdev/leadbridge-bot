# B2B Lead Qualifier — Bot specification

**Archetype:** crm

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot that collects and validates B2B lead information, confirms details with the user, and notifies a shared sales email with structured lead data for manual follow-up.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- B2B prospective customers
- sales team members

## Success criteria

- Lead submission with valid contact details and budget range
- Successful email notification to sales@company.com

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open qualification flow with greeting and consent prompt
- **Cancel** (button, actor: user, callback: flow:cancel) — Abort qualification process at any step
- **Back** (button, actor: user, callback: flow:back) — Edit previous answer in qualification sequence

## Flows

### Lead Qualification
_Trigger:_ /start

1. Display greeting and consent request
2. Collect company name
3. Collect contact person
4. Collect email with validation
5. Collect phone with validation
6. Select budget range from presets
7. Optional notes input
8. Display summary with edit options
9. Send confirmation and sales notification

_Data touched:_ Lead, Qualification session

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **Lead** _(retention: persistent)_ — Qualified B2B lead record for sales handoff
  - fields: company name, contact person, email, phone, budget range, notes, timestamp, source
- **Qualification session** _(retention: session)_ — Temporary state tracking for in-progress lead qualification
  - fields: current step, collected fields, validation status

## Integrations

- **Telegram** (required) — Bot API messaging
- **Email** (required) — Send structured lead notification to sales@company.com
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Configure lead source capture from deep links/referrers
- Adjust budget range presets
- Modify SLA confirmation message
- Manage lead data retention policies

## Notifications

- User confirmation message with SLA timeline
- Structured email to sales@company.com with lead details
- Optional lead source tracking from entry point

## Permissions & privacy

- Explicit user consent required for data collection
- Anonymize non-essential fields if not needed
- Comply with data retention preferences

## Edge cases

- User cancels qualification at any step
- Invalid email/phone format entered
- Budget range selection out of bounds
- Incomplete lead submission before session expiration

## Required tests

- End-to-end qualification flow with validation checks
- Email notification delivery with sample lead data
- Cancel/back navigation across all steps

## Assumptions

- Budget ranges use preset options (<$5k, $5k–$20k, etc.)
- SLA confirmation message is fixed as '48 hours'
- Lead source is captured from entry context if available
