# Dead County: Last Light

**An original, AI-generated demo.** A slow-paced, top-down zombie-survival game for mobile and desktop browsers, built with plain HTML, CSS and JavaScript on Canvas 2D. It is inspired by the general atmosphere of hardcore survival sandboxes, but contains no assets, names, maps, characters, interface layouts, sounds or code from Project Zomboid, Minecraft or any other game. All pixel art is drawn procedurally at runtime, all audio is synthesised with the Web Audio API, and the world is generated from a seed. There are no external files, libraries, fonts or network requests.

- No backend, database, login or build step. It is a static site and works on GitHub Pages.
- Saves live in the browser (`localStorage`). Nothing leaves the device.

## Run locally

Browsers block some features on `file://`, so use any static server from this folder:

```bash
# Python 3
python3 -m http.server 8000
# or Node
npx serve .
```

Open <http://localhost:8000>. To test on a phone on the same network, open `http://<your-computer-ip>:8000`.

## Deploy to GitHub Pages

1. Create a repository and push this folder to the `main` branch (the files in this folder must be at the repository root, or in `/docs`).
2. Open the repository on GitHub, then **Settings, Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then **Save**.
4. After a minute the game is live at `https://<user>.github.io/<repo>/`.

The `.nojekyll` file is included so Pages serves the files as they are. All paths are relative, so project sub-paths work.

## Controls

Touch (portrait and landscape):

| Control | Action |
| --- | --- |
| Drag anywhere on the lower-left | Floating joystick, 8 directions |
| Drag anywhere on the right half | Aim / look (tap to face a point) |
| ACT (bottom-right) | Context action: pick up, open, search, build. Hold for long actions |
| USE | Opens the full list of actions for the highlighted object |
| HIT | Attack with the equipped item |
| RUN / SNK | Sprint (uses stamina) / toggle crouch (quieter) |
| BAG | Inventory. Tap an item to select, then use the buttons. Pin it to the hotbar |
| Hotbar | Tap a slot to equip or use the pinned item |

Long actions (search, loot, break, barricade, build) need ACT held down. If you pick one from the USE menu, hold ACT to continue. Settings, Hold-to-toggle makes them tap-to-start instead.

Settings, Customise touch controls lets you drag and resize every control separately for portrait and landscape.

Keyboard and mouse: `WASD` move, `Shift` sprint, `Ctrl` or `C` crouch, `E` interact (hold), `F` action menu, mouse aim, left click or `Space` attack, `Tab` inventory, `1-6` hotbar, `R` craft, `B` build, `M` map, `J` journal, `K` skills, `Esc` pause, `F3` debug overlay. On desktop the on-screen buttons are hidden unless enabled in Settings.

## What is in the game

- World: a 224 by 224 tile procedural county, split into 16 by 16 tile chunks that are baked, cached and unloaded by distance. Town streets, houses, shops, a police station, fire station, hospital, gas station, warehouses, a farm, forest, ponds, fences, parking lots, cabins and a safehouse. Every building has an enterable interior with doors and windows that can be opened, closed, locked, barricaded or broken.
- Perception: line-of-sight rays, fog of war, a discovered-area minimap and a full map. Interiors are darker than exteriors.
- Zombies: states Idle, Wandering, Hearing, Searching, Chasing, Attacking and Returning. Noise and sight drive everything; zombies lose interest, follow trails, react to alarms and gather. Slow hordes migrate along roads. AI is limited by distance and pooled. A setting removes all combat gore.
- Survival: health, hunger, thirst, stamina, fatigue, panic, temperature, bleeding and injuries, bandages, painkillers, food spoilage, water purification, sleep, weather, day and night, power and water that eventually fail, alarms and events.
- Items: grid inventory, weights, backpacks, clothing with protection and storage, durability, stacks, loot tables by location, container searching, comparison and transfer.
- Combat: bats, knives, pipes, tools, thrown distractions. Range, cooldown, stamina cost, durability and noise all matter. Stealth takedowns and escape are viable.
- Crafting and building: bandages, torches, panels, tools, food, rain collectors, storage, beds, workbenches, walls, gates, floors, steps and defences, with a grid preview, invalid placement checks and build time.
- Others: friendly survivors (needs, schedules, dialogue, trust), friendly animals, eight skills that improve with use, traits and occupations, journal, statistics, death and victory screens.
- Modes: Story (three ways out), Endless survival, difficulty presets and sandbox sliders for zombies, loot, weather, day length and needs.

### Story objective routes

- Route A: collect a transmitter core, battery pack and full fuel can, install them on the signal mast, activate it, hold out for three in-game hours, then board the helicopter at the pad.
- Route B: find the checkpoint keycard in the police station and use it at the northern checkpoint gate.
- Route C: endure 21 days.

## Files

```
index.html          page shell and HUD containers
css/style.css       layout, controls, panels
js/util.js          helpers, RNG, events
js/data.js          tiles, items, recipes, traits, presets
js/world.js         procedural generation, chunks, tile state
js/inventory.js     grids, items, containers, loot
js/zombies.js       zombie AI, flow fields, hordes
js/player.js        movement, actions, combat, building
js/life.js          NPCs and animals
js/systems.js       clock, weather, survival, services, objectives
js/icons.js         procedural item icons
js/tiles.js         chunk baking
js/render.js        camera, lighting, fog, weather, minimap
js/audio.js         procedural audio (starts after first input)
js/input.js         touch, keyboard, mouse, control layout
js/ui.js            screens, HUD
js/inventory_ui.js  inventory, crafting, skills, journal, map
js/save.js          localStorage save and settings
js/main.js          boot and game loop
```

## Saves

Saves are versioned (`v1`) and stored under `deadcounty.save.v1`; settings and control layout under `deadcounty.settings.v1`. The world is regenerated from its seed and only changes are stored. Reset the save from Settings, Reset save, or clear site data. Permadeath: a save is removed when you die.

## Performance notes

Chunks outside the view are unloaded, distant zombies are dormant, particles and ground loot are pooled, and the lighting canvas is rendered at low resolution. The debug overlay (Settings, or `F3`) shows FPS, frame time, chunk and zombie counts.

## License

Original code and procedurally generated assets, released for demonstration purposes. No third-party assets are included.
