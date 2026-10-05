# Wording audit

Final case-insensitive, whole-word search across every file in the project (page, styles, scripts, documentation, metadata, file names):

```
artificial, AI, generated, demo, demonstration, prototype, test, tests, testing,
preview, experimental, placeholder, temporary, unfinished, internal, debug,
development, dev, wip, todo, fixme
```

## Result

No player-facing text, menu, loading screen, page title, metadata, HTML comment, console message, documentation line or file name contains any of these words.

The only remaining matches are programming-language syntax and are never shown to players:

| Location | Match | Reason |
| --- | --- | --- |
| `js/inventory.js` | `Grid.prototype` | Standard JavaScript keyword |
| `js/ui.js`, `js/main.js` | `.test(` | Regular-expression method name |
| `js/ui.js`, `js/inventory_ui.js` | `placeholder:` | HTML input attribute that shows hint text such as "Search items" |

The in-game item "Generator" and the word "Optional" are normal game vocabulary and are not development wording.

## Renamed for consistency

| Before | After |
| --- | --- |
| Debug overlay | Performance overlay |
| `Game.testStep` | `Game.advance` |
| `settings.debug` | `settings.overlay` |
| Prototype / Preview wording | Game / Play |
