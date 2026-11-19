# My City

An offline city builder. Build roads and houses, grow your income, buy exotic cars and drive around your city day and night.
All graphics are drawn by the game itself, so there are no image downloads. After the first visit it runs with zero data.

## Put it on GitHub Pages (same way as your other app)
1. Create a new public repo (for example `my-city`).
2. Upload all 7 files: `index.html`, `game.js`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`, `README.md`.
3. Repo Settings, then Pages, then Deploy from branch `main` / root. Wait a minute.
4. Open `https://YOUR-USERNAME.github.io/my-city/` on your phone.
5. Install it: Android Chrome shows the 📲 button (or menu, then Install app). iPhone Safari: Share, then Add to Home Screen.

## Updating later
Upload the new files, then change `VERSION = 'mycity-v1'` in `sw.js` to `mycity-v2` so your phone picks up the update.

## How to play
- Drag to move the camera, pinch (or mouse wheel) to zoom.
- 🛣️ Road: drag to paint roads ($20 per tile). Homes need a road next to them or they earn only 40%.
- 🏠 Homes / 🏙️ City: pick a building, then tap the map (phone: tap, then press Place).
- Trees and fountains within 3 tiles of a home add up to +30% income.
- 🧹 Demolish refunds 50%.
- 🚗 Cars: buy from the Showroom, repaint, then press Drive. Keys: W/A/S/D or arrows, Space to brake. On phones use the on-screen buttons.
- Your city saves automatically on your device.
