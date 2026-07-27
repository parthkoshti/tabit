# Features

A running list of features in the app.

## Platform

- Profile IANA timezone (Me): full zone list with suggested option at the top (from proxy headers or optional IP lookup on the API when enabled, otherwise this device); auto-saves on change; used for recurring rule calendar dates and date pickers; UTC when unset
- PWA on iOS, Android, web, macOS, Windows
- Release mismatch banner: When a new version is available, a banner appears with changelog and Update button
- Blog (MDX file-based, routes /blog and /blog/[slug])
- Sign up page (email OTP, works with tab and friend invite flows)

## Real-time

- Real-time notifications via Socket.IO on workers (`wrk.tabit.in`); session cookie auth (no separate WS token)
- BullMQ notification queue: socket emit plus web push on every notification (push even when connected)
- Connection state (disconnected/reconnecting) shown on bottom navbar via border styling
- Web push type **`payment_reminder`**: sent when someone uses **Remind** on a direct tab (friend must be owed); deep link opens that tab
- Offline queue: friend/tab invite actions, expense CRUD, and settlements sync when back online (server wins on conflict)

## Social

- Poke your friends for fun
- Sort friends by first name, most recent expense, or most expenses

## Tabs

- **Multi-currency (expenses and settlements)**: Both can be recorded in any supported currency; amounts convert to the tab's currency using Frankfurter rates by expense date or settlement date (same FX pipeline for both)—suited to travel and cross-currency groups
- Settlements have a settlement date (like expense date) used for FX conversion and shown in activity and detail views
- 1 on 1 tab (direct tabs with friends)
- **Payment reminders**: On a direct tab, when the friend **owes you**, **Remind** opens a dialog of iOS-style push previews; pick a tone (`gentle`, `friendly`, `firm`, `blunt`, `urgent`, `overkill` — some are playful or very direct) then **Send reminder**. oRPC `friends.sendPaymentReminder` with `{ friendTabId, tone }`; the server checks you are a member of that direct tab and that your balance is owed before publishing. Push title/body copy is defined in `packages/models` (`getPaymentReminderPushCopy`, `PAYMENT_REMINDER_TONE_META`)
- On a direct tab, a “Shared tabs” section lists group tabs you share with that friend (above balances), each with your net balance in that tab (same wording as the tabs list: you’re owed / you owe / settled)
- Group tabs
- **Pairwise balances (group tabs)**: Balances section shows who owes whom after simplifying nets—your total (“You are owed / You owe”), debts involving you (“Alice owes you”, “You owe Bob”), and debts between other members (“Alice owes Bob”)
- **Placeholder friends (placeholder participants)**: add named stand-ins on a group tab before someone joins or has the app; they appear in splits, settlements, recurring templates, and balances like members. Tab owners can **merge** a placeholder into an existing member in one irreversible step (ledger, expense history, tab activity, and a notification to the merged user). Create, rename, and merge from the tab **Members** screen (`/tabs/:tabId/members`)
- Tab members can set expense currency via manage page
- Sort tabs by name, most recent expense, or most expenses
- Set currency when creating a new tab

## Expenses

- Recurring expenses per tab (including direct tabs): repeat every N days from an anchor date, monthly on a day of the month (short months use the last day), or on selected weekdays; frozen amount, currency, description, payer, participants, and split template; FX on each occurrence date; start/end dates and max post count; pause/resume; workers cron posts with idempotent occurrence keys; owner profile timezone drives schedule math; push and expense history explain posts from a rule with a link to edit the rule at `/expense/recurring/:id`. From add expense, "Make recurring" keeps the schedule in the form until you save; the API creates the rule and links that expense as the first occurrence in one transaction (expense date must be on or after the rule start).
- Split types when adding or editing manually: equal (default), shares, percentage (must total 100%), or custom amounts; split dialog uses tabs; weights are stored and shown on expense detail (e.g. `40%` or `2 shares`) for percent and shares splits
- Choose expense currency when adding or editing (defaults to tab currency); amounts convert to tab currency using Frankfurter ECB rates with server-side cache
- FX works for any supported pair (e.g. AUD expense on an INR tab): the server looks up cached rates by expense date and expense currency; on a miss it fetches from Frankfurter and stores the result so repeat use is fast
- The API prefetches latest EUR and USD rate maps on startup and once daily (Europe/Berlin) to warm the cache for those bases; other currencies are not prefetched but still convert on first need
- Filter tab expenses by All, I'm involved, I'm owed, I owe
- Log Expense page (/expense/new) with AI/Manual pill slider; bottom nav plus opens page
- Unified add-expense flow with AI/Manual tabs; preference persisted in user preferences
- AI-powered voice expense creation
- Emoji reactions on expenses (add, remove, full emoji picker)
- New-expense notifications (push and real-time) name the **payer** (who paid), not only whoever logged the expense
- Notifications when someone reacts to an expense you're part of
- Expense audit logs
- Import from Splitwise (CSV)

## Invites

- Invite friends with QR code
- Invite to tabs with QR code

## Testing

- Comprehensive service layer tests (116+ tests across expense, tab, settlement, friend, user, tab-invite)
- Vitest with mocked data layer; authorization, validation, and business logic coverage
