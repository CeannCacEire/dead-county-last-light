# Dead County: Last Light

A slow-paced, top-down survival game for mobile and desktop browsers. A quarantine has failed across a rural county. You have a boarded-up safehouse, a few days of supplies and three ways out. Scavenge, craft, build, stay quiet, and decide how far you are willing to go before the lights go out.

The game is made with plain HTML, CSS and JavaScript on Canvas 2D. There is no backend, no build step, no external file, no library and no network request. All artwork is drawn in code, all sound is synthesised in the browser, and the county is built from a seed.

- Plays in portrait and landscape on phones and tablets, and with keyboard and mouse on desktop.
- Saves stay in the browser. Nothing leaves your device.
- Works as a static site on GitHub Pages.

## Quick start

1. Open the game and choose **Play**.
2. Create a survivor (name, occupation, traits) and pick a mode and difficulty.
3. Read **How to play** from the title screen or the pause menu for the controls that match your device.

## Controls

Full touch and keyboard reference: [CONTROLS.md](CONTROLS.md).

| Device | Move | Aim | Main actions |
| --- | --- | --- | --- |
| Touch | Floating joystick, lower left | Drag on the right half | Act, Attack, Search, Sprint, Crouch, Pack, Map, Light, Heal, Pause |
| Keyboard and mouse | `WASD` | Mouse | `E` interact (hold), `F` action list, `Space` or click attack, `Shift` sprint, `C` crouch, `Tab` inventory, `M` map, `L` flashlight, `H` quick heal, `Esc` pause |

## What is in the game

- **A county to explore.** A 224 by 224 tile county with town streets, houses, shops, a police station, fire station, hospital, gas station, warehouses, a farm, forest, ponds, parking lots, cabins and your safehouse. Every building has an interior lit separately from the outside. Doors and windows can be opened, closed, locked, damaged, barricaded or broken.
- **Survival systems.** Health, hunger, thirst, stamina, fatigue, stress, temperature, bleeding and injuries, food spoilage, water purification, sleep, weather, day and night, and a power and water supply that eventually fails.
- **A living threat.** The infected hear and see. Noise, light and movement draw them in, they follow trails, react to alarms and gather into slow hordes along the roads. Friendly survivors and animals share the county with them.
- **Inventory and crafting.** Grid inventory with weight, backpacks, clothing slots (including gloves and scarf), condition, stacks, search, category filters, sorting, hold-to-split, and drag and drop on desktop. Recipe cards show missing materials at a glance.
- **Building.** Barricades, walls, gates, floors, beds, workbenches, storage, rain collectors and defences, with a placement grid and build time.
- **Skills.** Eight skills that improve with use, plus traits and occupations.
- **Three ways out.** Signal beacon and rescue helicopter, the quarantine checkpoint, or survive 21 days. Endless mode and difficulty presets are available.

## Graphics, audio and accessibility

- [GRAPHICS.md](GRAPHICS.md): quality levels, lighting, weather, performance mode.
- [AUDIO.md](AUDIO.md): mixer, surfaces, music layers, low-power mode.
- [CONTROLS.md](CONTROLS.md): touch layout, left-handed layout, button editor.
- Accessibility options: reduced motion, high-contrast interface, colour-blind friendly colours, larger text, compact HUD, optional gore removal, and a fully muted mode.

## Run locally

Browsers block some features on `file://`, so serve the folder with any static server:

```bash
# Python 3
python3 -m http.server 8000
# or Node
npx serve .
```

Open <http://localhost:8000>. To try it on a phone on the same network, open `http://<your-computer-ip>:8000`.

Checklist for a local check:

1. The title screen appears and no sound plays until you tap or press a key.
2. Start a new game. Move and aim at the same time (touch: left and right thumbs).
3. Open the inventory, crafting, map and pause screens.
4. Save from the pause menu, reload the page and choose **Continue**.
5. In **Settings, Graphics**, switch between Performance, Low, Medium and High.

## Deploy to GitHub Pages

1. Create a repository and push this folder to the `main` branch. The files in this folder must sit at the repository root (or in `/docs`).
2. Open the repository on GitHub, then **Settings, Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then **Save**.
4. After a minute the game is live at `https://<user>.github.io/<repo>/`.

The `.nojekyll` file is included so Pages serves the files as they are. All paths are relative, so project sub-paths work.

## Project layout

```
index.html          page shell, HUD and control containers
css/style.css       layout, HUD, panels, accessibility styles
js/util.js          helpers, random numbers, events
js/data.js          tiles, items, recipes, traits, presets
js/world.js         county layout, chunks, tile state
js/inventory.js     grids, items, containers, loot
js/zombies.js       infected behaviour, flow fields, hordes
js/player.js        movement, actions, combat, building
js/life.js          survivors and animals
js/systems.js       clock, weather, survival, services, objectives
js/icons.js         item icons drawn in code
js/uiicons.js       interface icons
js/gfx.js           quality levels and effect budgets
js/sprites.js       characters, creatures and animals
js/art.js           props, vegetation, vehicles, furniture
js/tiles.js         terrain and chunk baking
js/render.js        camera, lighting, weather, post effects, minimap
js/audio.js         audio engine, mixer, music and effects
js/input.js         touch, keyboard, mouse, control layout
js/ui.js            screens, HUD, settings
js/inventory_ui.js  inventory, crafting, skills, journal, map
js/title.js         animated title screen
js/save.js          saves and settings
js/main.js          boot and game loop
```

## Saves

Saves are versioned and stored in the browser under `deadcounty.save.v1`. Settings and control layout use `deadcounty.settings.v1`. The world is rebuilt from its seed and only changes are stored. Delete the save from **Settings, Game**, or clear site data. Death is permanent: a save is removed when you die.

## Credits and licence

All artwork, sound and code are original to this project. See [CREDITS.md](CREDITS.md) and [LICENSE](LICENSE). No third-party assets are included.

See [CHANGELOG.md](CHANGELOG.md) for release notes and [SEARCH_REPORT.md](SEARCH_REPORT.md) for the wording audit.
