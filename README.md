# Habit Forge — MVP

Local-first desktop productivity project.

## Included
- React + TypeScript + Vite dashboard
- Add/delete/complete habits
- Habit time and website configuration
- Repeat Routine button
- Minimal completion snapshot
- LocalStorage only; no backend/database/account
- Chrome Extension MV3 scaffold with scheduler alarm

## Run dashboard
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Load extension
Chrome → Extensions → Developer mode → Load unpacked → select `extension/`.

## Next implementation steps
1. Connect extension to local app state.
2. Add configurable blocked websites.
3. Implement daily schedules and automatic site opening.
4. Add real completion verification for GitHub/LeetCode/Kaggle.
5. Add Tauri desktop shell only after browser MVP works.
