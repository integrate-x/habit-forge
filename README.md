# Habit Forge — MVP

Local-first desktop productivity project.

## Included
- React + TypeScript + Vite dashboard
- Add/delete/complete habits
- Real append-only completion events in localStorage
- Current and longest streaks from scheduled active days
- Safe habit migration with recovery backup before rewriting legacy data
- Habit time and website configuration
- Repeat Routine button
- Minimal completion snapshot
- LocalStorage only; no backend/database/account
- Chrome Extension MV3 scaffold with scheduler alarm
- Extension bridge that syncs the dashboard's minimal local state into `chrome.storage.local`

## Run dashboard
```bash
npm install
npm run dev
```

## Test
```bash
npm test
```

The Phase 1 tests cover local date keys, one completion per local day, weekday-aware current and longest streaks, in-progress scheduled days, empty schedules, mixed current/legacy migration, and unsafe migration handling.

## Build
```bash
npm run build
```

## Load extension
Chrome → Extensions → Developer mode → Load unpacked → select `extension/`.

## Next implementation steps
1. Add configurable blocked websites.
2. Implement daily schedules and automatic site opening.
3. Add real completion verification for GitHub/LeetCode/Kaggle.
4. Add Tauri desktop shell only after browser MVP works.
