# Recovery Med Tracker

Small, phone-friendly medication tracking app for personal post-surgery recovery use. It helps you log doses quickly, see each medication's next allowed time, spot what is available now, and keep a clear editable history.

## What it does

- Shows one prominent "Next medication" card with the next allowed medication and countdown.
- Lets you log doses quickly with large buttons or a manual entry form.
- Tracks medication rules including default dose, repeat interval, optional daily max, and notes.
- Shows clear status cards with last dose and next allowed timestamps.
- Stores everything locally in `localStorage`.
- Supports export/import as JSON for backup and restore.
- Includes optional browser notification support when the browser permits it.

## How to run it

### Option 1: open directly

Open `index.html` in a browser.

### Option 2: tiny local server

Any small static server works. Example:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Reminder behavior

- The app always shows on-screen countdowns and "available now" states while the page is open.
- Optional browser notifications can fire when a medication becomes available if notification permission is granted and the browser is still active enough to run timers.
- Notifications are only a convenience layer. The app does not depend on them for core tracking.

## Mobile notification limitations

- Mobile browsers may delay or suppress JavaScript timers when the tab is in the background.
- Notifications may not fire reliably if the phone is asleep, low on power, or the browser has been suspended by the operating system.
- Because there is no backend, push service, or native app wrapper in v1, this app cannot guarantee alarms at exact times when the page is not actively running.
- Treat the app as a tracking aid, not a guaranteed alerting system.

## Notes

- The default Gas-X interval is set to 4 hours so the earliest allowed time is visible; you can change it to 6 hours or another value in Settings.
- The default Colace interval is set to 12 hours with a daily max of 2, and both are editable.
- This app is not medical advice. Follow your clinician's instructions and package labeling first.
