# My City

An offline city-builder where you are the mayor. Zone land, connect power and water, build police, fire, clinics and schools, set taxes,
and grow your town into a metropolis, then drive exotic cars through it day and night.
All graphics are drawn by the game itself, so there are no image downloads. After the first visit it runs with zero data.

## Put it on GitHub Pages
Upload all 8 files to a new public repo: `index.html`, `game.js`, `gfx.js`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`, `README.md`.
Then Settings, Pages, Deploy from branch `main` / root. Open `https://YOUR-USERNAME.github.io/REPO-NAME/` and install it.
After any update change `VERSION` in `sw.js` (for example `mycity-v3`) so phones pick up the new files.

## How to play
- Roads: drag to paint ($20/tile). Everything needs a road within 2 tiles.
- Zones: drag a rectangle. Green = Residential, Blue = Commercial, Yellow = Industrial ($10/tile). Buildings grow on their own when there is demand (the R/C/I bars at the top).
- Utilities: power plants and water towers must touch a road. Power and water travel along connected roads. Watch the supply vs demand in City Hall.
- Services: police, fire, clinic, school and parks cover nearby homes, raising approval and land value so buildings upgrade (houses, then townhouses, then apartments).
- City Hall (📊): set the tax rate, see income and expenses, and read your advisor's tips. Tap the city name to rename.
- Keep industry and coal plants away from homes (pollution). Make sure there are jobs for your citizens.
- Homes tab: place luxury homes yourself (villa, mansion, tower). Extras: garage, trees, fountain.
- Cars: buy from the Showroom and drive. The garage holds your cars.
- Speed button (▶): 1x, 2x, 3x, pause. Pinch or scroll to zoom. Right-click drag also pans on a computer.
