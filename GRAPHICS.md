# Graphics settings

Open **Settings, Graphics**. Every option takes effect immediately.

## Quality levels

| Level | Intended for | What changes |
| --- | --- | --- |
| Auto | Most players | Starts at the best level for the device and lowers detail if the frame rate drops |
| Performance | Older phones, battery saving | Lighting and shadows off (time-of-day brightness remains), about 40 percent of the particles, lighter weather, fewer ground decorations, slightly shorter view distance. The game remains fully readable |
| Low | Budget devices | Simple lighting and shadows, about 60 percent of the particles, thinner decoration, no foliage sway or film grain |
| Medium | Mid-range devices | Full lighting with soft shadows, foliage sway, film grain, higher render and terrain resolution |
| High | Modern devices and desktops | Highest render and terrain resolution, full lighting, ambient occlusion and richer colour grading, the most particles |

Adjust quality automatically can be switched off to keep a chosen level.

## Effects

- **Colour grading and vignette**: time-of-day colour, plus subtle edge darkening for danger, panic, low health, fatigue and darkness. It never hides the controls or the area around the player.
- **Film grain**: optional.
- **Reduced particles**: fewer leaves, dust, smoke and sparks.
- **Reduced shadows**: removes cast shadows and ambient occlusion.
- **Reduced lighting**: simple brightness instead of per-light glow.
- **Reduced weather effects**: lighter rain, fog and puddles.
- **Reduced camera shake** and **Reduce motion** (Accessibility): calmer camera, no foliage sway, simpler interface animation.

## What you will see

- Distinct biomes (forest, meadow, farmland, town, water) with blended edges and ground decals.
- Cool outdoor night light, warm indoor light, street lights, lamps, flashlights, vehicle headlights, candles, emergency lights and generators, with flicker.
- Interiors lit separately from the outdoors, so lights inside a house do not leak onto the street.
- Rain, fog by weather and time, puddles, dust, smoke, sparks, leaves and drifting indoor dust.
- Darkness when the power fails, and a warm lit safehouse.

## Performance

- Terrain is baked in 16 by 16 tile chunks, cached and unloaded by distance. Unloaded areas are never revealed by the camera.
- Particles, ground loot and audio voices are pooled and capped.
- Distant creatures are dormant and updates are throttled by distance.
- The overlay (Settings, Performance overlay, or `F3`) shows frame rate, frame time and counts, and can be hidden.
