# Features

A running list of features in the app.

## Platform

- PWA on iOS, Android, web, macOS, Windows
- Release mismatch banner: When a new version is available, a banner appears with changelog and Update button
- Blog (MDX file-based, routes /blog and /blog/[slug])
- Sign up page (email OTP, works with tab and friend invite flows)

## Real-time

- Real-time notifications
- Connection state (disconnected/reconnecting) shown on bottom navbar via border styling

## Social

- Poke your friends for fun
- Sort friends by first name, most recent expense, or most expenses

## Tabs

- Record settlements in any supported currency (converted to tab currency for balances; same Frankfurter FX pipeline as expenses)
- Settlements have a settlement date (like expense date) used for FX conversion and shown in activity and detail views
- 1 on 1 tab (direct tabs with friends)
- On a direct tab, a “Shared tabs” section lists group tabs you share with that friend (above balances)
- Group tabs
- Tab members can set expense currency via manage page
- Sort tabs by name, most recent expense, or most expenses
- Set currency when creating a new tab

## Expenses

- Choose expense currency when adding or editing (defaults to tab currency); amounts convert to tab currency using Frankfurter ECB rates with server-side cache
- FX works for any supported pair (e.g. AUD expense on an INR tab): the server looks up cached rates by expense date and expense currency; on a miss it fetches from Frankfurter and stores the result so repeat use is fast
- The API prefetches latest EUR and USD rate maps on startup and once daily (Europe/Berlin) to warm the cache for those bases; other currencies are not prefetched but still convert on first need
- Filter tab expenses by All, I'm involved, I'm owed, I owe
- Log Expense page (/expense/new) with AI/Manual pill slider; bottom nav plus opens page
- Unified add-expense flow with AI/Manual tabs; preference persisted in user preferences
- AI-powered voice expense creation
- Emoji reactions on expenses (add, remove, full emoji picker)
- Notifications when someone reacts to an expense you're part of
- Expense audit logs
- Import from Splitwise (CSV)

## Invites

- Invite friends with QR code
- Invite to tabs with QR code

## Testing

- Comprehensive service layer tests (111+ tests across expense, tab, settlement, friend, user, tab-invite)
- Vitest with mocked data layer; authorization, validation, and business logic coverage
