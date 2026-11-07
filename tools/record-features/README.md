# Feature-card loops

Records the eight product loops in the homepage's feature cards from the real speed. app. Each one is a short cursor-driven walk through one screen. For every area it writes `assets/media/features/<area>.webm`, `.mp4`, `-poster.webp` and `.gif`.

```bash
# 1. Run the app (in ../../speed)
npx vite --port 5199
# 2. In a scratch folder that has playwright and ffmpeg-static installed
EXE=<path to chrome-headless-shell> node record.js all            # or: node record.js sales,tax
EXE=... node record.js finance probe                             # check one scene's steps without encoding
```

Before filming, the recorder makes these display-only changes to the app, following the copy deck's rules for screens:
- The money item in the side rail reads "Money", with the hand-coins icon.
- Payment-provider names become "Payment link" and "Transfer".
- Bank wording is removed.
- Learn mode is switched off.

Each clip fades back to its first frame at the end, so the loop has no visible jump. The page uses WebM first and MP4 as a fallback. The GIFs are made too, but nothing uses them.

The Teaming clip shows Team & roles (Settings), because the app has no team chat, tasks or meeting-notes screen yet. Re-record it once one exists.
