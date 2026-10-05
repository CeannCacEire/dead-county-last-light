/* Dead County: Last Light - data tables (items, loot, recipes, traits). Original content. */
(function () {
  'use strict';
  const DC = window.DC;

  // ---- ground types ----
  const G = (DC.G = { GRASS: 0, DIRT: 1, ROAD: 2, SIDEWALK: 3, WOOD: 4, TILE: 5, CONCRETE: 6, DEEP: 7, SHALLOW: 8, GRAVEL: 9, LEAVES: 10, FARM: 11, CARPET: 12, BRIDGE: 13, PAD: 14, MUD: 15 });
  // noise multiplier, speed multiplier, sound class
  DC.GINFO = [
    { n: 'grass', nz: 0.7, sp: 1.0, snd: 'soft' }, { n: 'dirt', nz: 0.75, sp: 1.0, snd: 'soft' },
    { n: 'road', nz: 1.0, sp: 1.0, snd: 'hard' }, { n: 'sidewalk', nz: 1.0, sp: 1.0, snd: 'hard' },
    { n: 'wood floor', nz: 1.25, sp: 1.0, snd: 'wood' }, { n: 'tile', nz: 1.05, sp: 1.0, snd: 'hard' },
    { n: 'concrete', nz: 1.0, sp: 1.0, snd: 'hard' }, { n: 'deep water', nz: 2, sp: 0, snd: 'water' },
    { n: 'shallow water', nz: 1.7, sp: 0.6, snd: 'water' }, { n: 'gravel', nz: 1.5, sp: 0.95, snd: 'gravel' },
    { n: 'leaf litter', nz: 1.35, sp: 0.9, snd: 'leaves' }, { n: 'field', nz: 0.9, sp: 0.85, snd: 'soft' },
    { n: 'carpet', nz: 0.45, sp: 1.0, snd: 'soft' }, { n: 'bridge', nz: 1.1, sp: 1.0, snd: 'wood' },
    { n: 'helipad', nz: 1.0, sp: 1.0, snd: 'hard' }, { n: 'mud', nz: 1.1, sp: 0.8, snd: 'soft' },
  ];

  // ---- object types ----
  const O = (DC.O = {
    NONE: 0, WALL: 1, DOOR: 2, WINDOW: 3, TREE: 4, FENCE: 5, CAR: 6, BUSH: 7, ROCK: 8,
    BED: 10, COUCH: 11, TABLE: 12, CHAIR: 13, SHELF: 14, COUNTER: 15, FRIDGE: 16, WARDROBE: 17, CRATE: 18, LOCKER: 19,
    DESK: 20, SINK: 21, TOILET: 22, STOVE: 23, DUMPSTER: 24, MEDCAB: 25, HBED: 26, PUMP: 27, BARREL: 28, HAY: 29,
    CROP: 30, MAILBOX: 31, SHOPSHELF: 32, CABINET: 33, GUNCAB: 34, BEACON: 36, CHECKGATE: 37, LAMP: 38, SANDBAG: 39,
    BWALL: 50, BGATE: 51, BSTAIRS: 52, BSTORE: 53, BBED: 54, BBENCH: 55, BTABLE: 56, BCHAIR: 57, CAMPFIRE: 58,
    COLLECTOR: 59, SPIKES: 60, TRIPWIRE: 61,
  });
  // s solid, op opaque, c container {w,h,t}, n name
  const OD = (DC.OD = {});
  function od(id, n, s, op, c) { OD[id] = { n, s: !!s, op: !!op, c: c || null }; }
  od(O.WALL, 'Wall', 1, 1); od(O.DOOR, 'Door', 1, 0); od(O.WINDOW, 'Window', 1, 0); od(O.TREE, 'Tree', 1, 1);
  od(O.FENCE, 'Fence', 1, 0); od(O.CAR, 'Vehicle', 1, 0, { w: 5, h: 3, t: 'car' }); od(O.BUSH, 'Bush', 0, 0); od(O.ROCK, 'Rocks', 1, 0);
  od(O.BED, 'Bed', 1, 0); od(O.COUCH, 'Couch', 1, 0); od(O.TABLE, 'Table', 1, 0); od(O.CHAIR, 'Chair', 1, 0);
  od(O.SHELF, 'Shelf', 1, 0, { w: 4, h: 2, t: 'shelf' }); od(O.COUNTER, 'Counter', 1, 0, { w: 4, h: 2, t: 'counter' });
  od(O.FRIDGE, 'Fridge', 1, 0, { w: 4, h: 3, t: 'fridge', fridge: 1 }); od(O.WARDROBE, 'Wardrobe', 1, 0, { w: 4, h: 3, t: 'wardrobe' });
  od(O.CRATE, 'Crate', 1, 0, { w: 5, h: 3, t: 'crate' }); od(O.LOCKER, 'Locker', 1, 0, { w: 3, h: 3, t: 'locker' });
  od(O.DESK, 'Desk', 1, 0, { w: 3, h: 2, t: 'desk' }); od(O.SINK, 'Sink', 1, 0); od(O.TOILET, 'Toilet', 1, 0);
  od(O.STOVE, 'Stove', 1, 0); od(O.DUMPSTER, 'Dumpster', 1, 0, { w: 5, h: 3, t: 'dumpster' });
  od(O.MEDCAB, 'Medicine Cabinet', 1, 0, { w: 3, h: 2, t: 'medcab' }); od(O.HBED, 'Hospital Bed', 1, 0);
  od(O.PUMP, 'Fuel Pump', 1, 0); od(O.BARREL, 'Barrel', 1, 0, { w: 3, h: 2, t: 'barrel' }); od(O.HAY, 'Hay Bale', 1, 0);
  od(O.CROP, 'Crops', 0, 0); od(O.MAILBOX, 'Mailbox', 1, 0, { w: 2, h: 1, t: 'mailbox' });
  od(O.SHOPSHELF, 'Display Shelf', 1, 0, { w: 5, h: 3, t: 'shopshelf' }); od(O.CABINET, 'Cabinet', 1, 0, { w: 3, h: 2, t: 'cabinet' });
  od(O.GUNCAB, 'Equipment Cabinet', 1, 0, { w: 4, h: 2, t: 'guncab' }); od(O.BEACON, 'Signal Mast', 1, 0);
  od(O.CHECKGATE, 'Checkpoint Gate', 1, 0); od(O.LAMP, 'Street Lamp', 1, 0); od(O.SANDBAG, 'Sandbags', 1, 0);
  od(O.BWALL, 'Plank Wall', 1, 1); od(O.BGATE, 'Plank Gate', 1, 0); od(O.BSTAIRS, 'Lookout Steps', 0, 0);
  od(O.BSTORE, 'Storage Crate', 1, 0, { w: 6, h: 4, t: 'built' }); od(O.BBED, 'Bed', 1, 0); od(O.BBENCH, 'Workbench', 1, 0);
  od(O.BTABLE, 'Table', 1, 0); od(O.BCHAIR, 'Chair', 1, 0); od(O.CAMPFIRE, 'Campfire', 0, 0); od(O.COLLECTOR, 'Rain Collector', 1, 0);
  od(O.SPIKES, 'Spike Barricade', 1, 0); od(O.TRIPWIRE, 'Tin-Can Tripwire', 0, 0);

  // ---- items ----
  const I = (DC.ITEMS = {});
  function add(id, name, cat, w, h, wt, o) {
    I[id] = Object.assign({ id, name, cat, w, h, wt, stack: 1, ic: ['box', '#888', '#555'], d: '' }, o || {});
  }
  // FOOD  fd: h hunger, t thirst, hp, st stress delta, sick chance ; sp = shelf life hours
  add('beans', 'Canned Beans', 'food', 1, 1, 0.45, { fd: { h: 26, t: -2, st: -2 }, ic: ['can', '#9a5a32', '#ddd4bb'], d: 'Never spoils.' });
  add('soup', 'Canned Soup', 'food', 1, 1, 0.45, { fd: { h: 20, t: 6, st: -3 }, ic: ['can', '#a8402f', '#ddd4bb'] });
  add('peaches', 'Canned Peaches', 'food', 1, 1, 0.45, { fd: { h: 15, t: 9, st: -5 }, ic: ['can', '#d09a3a', '#ddd4bb'] });
  add('chips', 'Chips', 'food', 1, 1, 0.2, { fd: { h: 11, t: -4, st: -2 }, sp: 1500, ic: ['bag', '#c8a02c', '#8a2f25'] });
  add('choc', 'Chocolate Bar', 'food', 1, 1, 0.1, { fd: { h: 9, st: -12 }, sp: 1500, ic: ['bar', '#5a3322', '#c8a02c'] });
  add('apple', 'Apple', 'food', 1, 1, 0.2, { fd: { h: 9, t: 5 }, sp: 120, ic: ['round', '#a83a32', '#5a7a30'] });
  add('bread', 'Loaf of Bread', 'food', 1, 1, 0.5, { fd: { h: 22 }, sp: 90, ic: ['loaf', '#b88a4a', '#8a6030'] });
  add('sandwich', 'Sandwich', 'food', 1, 1, 0.3, { fd: { h: 28, st: -3 }, sp: 40, ic: ['loaf', '#d8c08a', '#6a8a40'] });
  add('cereal', 'Cereal Box', 'food', 1, 2, 0.5, { fd: { h: 24 }, sp: 700, ic: ['box', '#d0a030', '#a83a32'] });
  add('jerky', 'Dried Jerky', 'food', 1, 1, 0.15, { fd: { h: 20, t: -5 }, sp: 900, ic: ['bar', '#6a3a2a', '#4a2418'] });
  add('mre', 'Field Ration', 'food', 1, 1, 0.5, { fd: { h: 50, t: -3, st: -6 }, ic: ['box', '#5a6a3a', '#3a4426'], d: 'Military ration pack.' });
  add('egg', 'Raw Egg', 'food', 1, 1, 0.1, { fd: { h: 5, sick: 0.35 }, sp: 160, ic: ['round', '#e8dcc0', '#c8b890'], cook: 'egg_c' });
  add('egg_c', 'Boiled Egg', 'food', 1, 1, 0.1, { fd: { h: 15 }, sp: 72, ic: ['round', '#f0e8d0', '#e8c040'] });
  add('potato', 'Potato', 'food', 1, 1, 0.3, { fd: { h: 6, sick: 0.1 }, sp: 400, ic: ['round', '#9a7a4a', '#6a5030'], cook: 'potato_c' });
  add('potato_c', 'Roast Potato', 'food', 1, 1, 0.3, { fd: { h: 24 }, sp: 72, ic: ['round', '#c89a4a', '#8a6030'] });
  add('carrot', 'Carrot', 'food', 1, 1, 0.15, { fd: { h: 8, t: 3 }, sp: 220, ic: ['bar', '#c8702a', '#5a8a30'], cook: 'carrot_c' });
  add('carrot_c', 'Cooked Carrot', 'food', 1, 1, 0.15, { fd: { h: 15, t: 2 }, sp: 72, ic: ['bar', '#d88030', '#8a5020'] });
  add('petfood', 'Pet Food Tin', 'food', 1, 1, 0.4, { fd: { h: 8, sick: 0.5 }, animal: 1, ic: ['can', '#4a6a8a', '#ddd4bb'], d: 'Animals love this. Not for you.' });
  // WATER  u = uses
  add('bottle_empty', 'Empty Bottle', 'water', 1, 2, 0.1, { throw: 1, ic: ['bottle', '#9ab8c8', '#6a8898'], d: 'Fill at a sink, rain collector or boil water.' });
  add('water_clean', 'Clean Water', 'water', 1, 2, 0.8, { uses: 4, dr: { t: 16 }, ic: ['bottle', '#7ab0d8', '#3a6a98'] });
  add('water_dirty', 'Murky Water', 'water', 1, 2, 0.8, { uses: 4, dr: { t: 16, sick: 0.55 }, ic: ['bottle', '#8a8a4a', '#5a5a30'], d: 'Boil it or use purification tablets.' });
  add('soda', 'Soda', 'water', 1, 1, 0.35, { fd: { h: 4, t: 14, st: -2 }, ic: ['can', '#b83a3a', '#e8e8e8'] });
  // MEDICINE
  add('bandage', 'Bandage', 'med', 1, 1, 0.1, { stack: 5, med: { bleed: 1, heal: 6, clean: 1 }, ic: ['wrap', '#e8e4d8', '#b8b0a0'] });
  add('bandage_rough', 'Makeshift Bandage', 'med', 1, 1, 0.1, { stack: 5, med: { bleed: 0.75, heal: 2, clean: 0 }, ic: ['wrap', '#b0a890', '#807860'], d: 'Works, but risk of infection.' });
  add('antiseptic', 'Antiseptic', 'med', 1, 1, 0.2, { uses: 4, med: { disinfect: 1 }, ic: ['bottle', '#a8c898', '#587a48'] });
  add('painkillers', 'Painkillers', 'med', 1, 1, 0.05, { stack: 10, med: { pain: 1 }, ic: ['pill', '#e8e8e8', '#c84a4a'] });
  add('antibiotics', 'Antibiotics', 'med', 1, 1, 0.05, { stack: 6, med: { cure: 1 }, ic: ['pill', '#e8c050', '#a88030'] });
  add('firstaid', 'First Aid Kit', 'med', 2, 2, 1.2, { med: { bleed: 1, heal: 28, clean: 1, sprain: 1 }, ic: ['kit', '#e8e8e8', '#c83a3a'] });
  add('splint', 'Splint', 'med', 1, 2, 0.4, { med: { sprain: 1 }, ic: ['plank', '#c8c0a0', '#8a8060'] });
  add('water_tabs', 'Purification Tablets', 'med', 1, 1, 0.05, { stack: 10, ic: ['pill', '#98c8e8', '#4878a8'], d: 'Purifies a bottle of murky water.' });
  // TOOLS
  add('hammer', 'Claw Hammer', 'weapon', 1, 2, 0.9, { tl: ['hammer'], wp: { dmg: [9, 14], rng: 14, arc: 0.6, cd: 0.6, st: 7, nz: 6, kb: 8, dur: 90 }, ic: ['hammer', '#8a8a90', '#7a5a38'] });
  add('screwdriver', 'Screwdriver', 'tool', 1, 2, 0.2, { tl: ['pry', 'pick'], ic: ['hammer', '#b8b8c0', '#c8a028'], d: 'Can force simple locks (slow, quiet).' });
  add('crowbar', 'Crowbar', 'weapon', 1, 3, 1.3, { tl: ['pry', 'pick'], wp: { dmg: [13, 20], rng: 19, arc: 0.7, cd: 0.8, st: 10, nz: 8, kb: 12, dur: 130 }, ic: ['club', '#4a5058', '#6a7078'] });
  add('flashlight', 'Flashlight', 'tool', 1, 2, 0.4, { tl: ['light'], dur: 100, light: { r: 90, cone: 1 }, ic: ['flash', '#c8a82c', '#4a4a50'], d: 'Needs batteries.' });
  add('torch', 'Torch', 'tool', 1, 2, 0.5, { tl: ['light', 'fire'], dur: 360, light: { r: 62, fire: 1 }, ic: ['club', '#8a5a2a', '#e88a2a'], d: 'Burns while equipped.' });
  add('lighter', 'Lighter', 'tool', 1, 1, 0.05, { tl: ['fire'], dur: 40, ic: ['lighter', '#c83a3a', '#d8d8d8'] });
  add('matches', 'Matchbox', 'tool', 1, 1, 0.05, { tl: ['fire'], dur: 20, ic: ['box', '#c8a050', '#a02828'] });
  add('saw', 'Hand Saw', 'tool', 2, 1, 0.8, { tl: ['saw', 'cut'], ic: ['saw', '#a8a8b0', '#7a5a38'] });
  add('pot', 'Cooking Pot', 'tool', 2, 2, 0.9, { tl: ['pot'], ic: ['pot', '#6a6a70', '#3a3a40'] });
  add('rope', 'Rope', 'build', 1, 1, 0.4, { stack: 4, ic: ['coil', '#b89a5a', '#8a7038'] });
  add('pins', 'Bobby Pins', 'tool', 1, 1, 0.02, { stack: 10, tl: ['pick'], ic: ['pill', '#8a8a90', '#5a5a60'], d: 'Quiet lockpicking.' });
  add('map', 'County Map', 'misc', 1, 1, 0.1, { ic: ['paper', '#d8c898', '#a89860'], d: 'Reveals the layout of the town.' });
  add('radio', 'Handheld Radio', 'elec', 1, 2, 0.5, { tl: ['radio'], dur: 100, ic: ['radio', '#4a5a4a', '#c8c8a0'], d: 'Picks up emergency broadcasts.' });
  add('keycard', 'Checkpoint Keycard', 'misc', 1, 1, 0.02, { quest: 1, ic: ['card', '#3a7a5a', '#d8d8d8'], d: 'Opens the quarantine checkpoint gate.' });
  add('key_safe', 'Safehouse Key', 'misc', 1, 1, 0.02, { quest: 1, ic: ['key', '#c8a82c', '#8a7018'] });
  add('key_police', 'Evidence Room Key', 'misc', 1, 1, 0.02, { quest: 1, ic: ['key', '#8a9aa8', '#5a6a78'] });
  add('jerry_empty', 'Jerry Can (empty)', 'tool', 2, 2, 1.0, { ic: ['jerry', '#6a7a3a', '#3a4a20'] });
  add('jerry_full', 'Fuel Can', 'tool', 2, 2, 5.5, { quest: 0, ic: ['jerry', '#b83a2a', '#6a1a10'], d: 'Full of fuel. Heavy. Handle with care.' });
  add('shovel', 'Shovel', 'weapon', 1, 3, 1.8, { wp: { dmg: [14, 20], rng: 22, arc: 0.6, cd: 1.0, st: 12, nz: 8, kb: 14, dur: 80 }, ic: ['club', '#6a6a70', '#8a6a3a'] });
  // WEAPONS
  add('bat', 'Baseball Bat', 'weapon', 1, 3, 1.1, { wp: { dmg: [14, 22], rng: 22, arc: 0.75, cd: 0.85, st: 11, nz: 8, kb: 16, dur: 70 }, ic: ['club', '#b08a4a', '#8a6a30'] });
  add('knife', 'Kitchen Knife', 'weapon', 1, 2, 0.25, { tl: ['cut'], wp: { dmg: [9, 13], rng: 14, arc: 0.5, cd: 0.45, st: 5, nz: 3, kb: 4, dur: 50, stab: 1 }, ic: ['blade', '#c8c8d0', '#4a3a2a'] });
  add('pipe', 'Steel Pipe', 'weapon', 1, 3, 1.6, { wp: { dmg: [12, 19], rng: 21, arc: 0.7, cd: 0.8, st: 10, nz: 9, kb: 14, dur: 100 }, ic: ['club', '#7a8088', '#5a6068'] });
  add('hatchet', 'Hatchet', 'weapon', 1, 2, 1.0, { tl: ['chop', 'cut'], wp: { dmg: [15, 24], rng: 17, arc: 0.6, cd: 0.85, st: 11, nz: 8, kb: 8, dur: 75 }, ic: ['axe', '#9aa0a8', '#7a5a38'] });
  add('fire_axe', 'Fire Axe', 'weapon', 1, 3, 2.8, { tl: ['chop', 'cut'], wp: { dmg: [22, 34], rng: 24, arc: 0.85, cd: 1.25, st: 17, nz: 10, kb: 18, dur: 90 }, ic: ['axe', '#c83a2a', '#7a5a38'] });
  add('pan', 'Frying Pan', 'weapon', 1, 2, 0.9, { wp: { dmg: [8, 12], rng: 15, arc: 0.7, cd: 0.55, st: 6, nz: 7, kb: 7, dur: 60 }, ic: ['pan', '#3a3a40', '#6a6a70'] });
  add('baton', 'Police Baton', 'weapon', 1, 2, 0.7, { wp: { dmg: [11, 16], rng: 20, arc: 0.6, cd: 0.6, st: 7, nz: 6, kb: 10, dur: 160 }, ic: ['club', '#2a2a30', '#4a4a50'] });
  add('spear', 'Sharpened Spear', 'weapon', 1, 3, 0.8, { wp: { dmg: [12, 18], rng: 31, arc: 0.28, cd: 1.0, st: 9, nz: 4, kb: 10, dur: 22, stab: 1 }, ic: ['spear', '#a89a78', '#d8d8d8'] });
  add('nailbat', 'Nail Bat', 'weapon', 1, 3, 1.3, { wp: { dmg: [20, 30], rng: 22, arc: 0.7, cd: 0.9, st: 12, nz: 9, kb: 12, dur: 45 }, ic: ['club', '#b08a4a', '#c8c8d0'] });
  add('pistol', 'Pistol', 'weapon', 2, 1, 0.9, { wp: { dmg: [30, 42], rng: 176, arc: 0.06, cd: 0.7, st: 3, nz: 44, kb: 6, dur: 120, ranged: 1, ammo: 'ammo9' }, ic: ['gun', '#3a3a42', '#5a5a64'], d: 'Extremely loud. Draws every zombie nearby.' });
  add('ammo9', '9mm Rounds', 'ammo', 1, 1, 0.02, { stack: 30, ic: ['bullet', '#c8a02c', '#8a6a18'] });
  add('stone', 'Stone', 'misc', 1, 1, 0.6, { stack: 4, throw: 1, ic: ['round', '#8a8a86', '#5a5a58'], d: 'Throw to make a distraction.' });
  add('can_empty', 'Empty Can', 'misc', 1, 1, 0.08, { stack: 6, throw: 1, ic: ['can', '#a0a0a0', '#707070'], d: 'Throw it, or hang on a tripwire.' });
  // BUILDING
  add('plank', 'Wooden Plank', 'build', 3, 1, 0.8, { stack: 6, ic: ['plank', '#b08a58', '#80603a'] });
  add('nails', 'Box of Nails', 'build', 1, 1, 0.05, { stack: 60, ic: ['nail', '#a8a8b0', '#6a6a72'] });
  add('scrap', 'Scrap Metal', 'build', 1, 1, 0.8, { stack: 5, ic: ['scrap', '#7a7a80', '#5a4a3a'] });
  add('log', 'Log', 'build', 2, 1, 3.0, { stack: 2, ic: ['log', '#7a5a38', '#a88050'] });
  add('stick', 'Sticks', 'build', 1, 2, 0.3, { stack: 6, ic: ['stick', '#8a6a42', '#6a4a2a'] });
  add('sheet', 'Bed Sheet', 'build', 1, 1, 0.5, { stack: 4, ic: ['cloth', '#c8c8c0', '#98988c'] });
  add('rag', 'Cloth Strips', 'build', 1, 1, 0.05, { stack: 12, ic: ['cloth', '#b8b0a0', '#887f70'] });
  add('tarp', 'Plastic Tarp', 'build', 1, 1, 0.6, { stack: 2, ic: ['cloth', '#4a7a9a', '#2a4a6a'] });
  add('duct_tape', 'Duct Tape', 'build', 1, 1, 0.2, { dur: 60, ic: ['coil', '#8a8a90', '#5a5a60'], d: 'Use to patch your equipped weapon.' });
  add('wire', 'Wire', 'build', 1, 1, 0.2, { stack: 4, ic: ['coil', '#b87a3a', '#8a5a28'] });
  add('panel', 'Barricade Panel', 'build', 3, 1, 2.0, { stack: 2, ic: ['panel', '#a07a48', '#6a4a28'], d: 'Ready-made barricade: fits a door or window.' });
  // ELECTRONICS
  add('battery', 'Batteries', 'elec', 1, 1, 0.15, { stack: 6, ic: ['battery', '#d8a82c', '#4a4a4a'], d: 'Use to recharge a flashlight or radio.' });
  add('circuit', 'Circuit Board', 'elec', 1, 1, 0.1, { ic: ['chip', '#2a6a4a', '#c8a82c'] });
  add('alarm_clock', 'Wind-up Alarm Clock', 'elec', 1, 1, 0.4, { ic: ['clock', '#c8c8c0', '#a83a32'], d: 'Use to set it ringing here: a distraction.' });
  add('transmitter', 'Transmitter Core', 'elec', 2, 1, 1.2, { quest: 1, ic: ['chip', '#3a5a8a', '#c8c8d8'], d: 'Part of the signal beacon.' });
  add('battpack', 'Signal Battery Pack', 'elec', 2, 2, 3.0, { quest: 1, ic: ['battery', '#4a8a5a', '#2a4a30'], d: 'Part of the signal beacon.' });
  // MISC
  add('newspaper', 'Old Newspaper', 'misc', 1, 1, 0.1, { ic: ['paper', '#c8c0a8', '#807860'] });
  add('cash', 'Cash', 'misc', 1, 1, 0.01, { stack: 50, ic: ['paper', '#7a9a6a', '#4a6a3a'], d: 'Worthless now.' });
  add('note', 'Handwritten Note', 'misc', 1, 1, 0.01, { ic: ['paper', '#d8d0b0', '#98906c'], d: 'Read to add it to your journal.' });
  add('book_survival', "Survivor's Handbook", 'misc', 1, 1, 0.5, { book: { skill: 'stealth', xp: 60, learn: ['tripwire', 'spear'], txt: 'Noise, light and patience.' }, ic: ['book', '#4a6a3a', '#d8d8c8'] });
  add('book_carpentry', "Carpenter's Almanac", 'misc', 1, 1, 0.5, { book: { skill: 'build', xp: 80, learn: ['bbench', 'spikes', 'bstairs'], txt: 'Joints, frames and braces.' }, ic: ['book', '#7a5a2a', '#d8d8c8'] });
  add('book_firstaid', 'Field Medicine', 'misc', 1, 1, 0.5, { book: { skill: 'aid', xp: 80, learn: ['splint'], txt: 'Stop bleeding. Keep wounds clean.' }, ic: ['book', '#a83a32', '#d8d8c8'] });
  add('book_cooking', 'Campfire Cooking', 'misc', 1, 1, 0.5, { book: { skill: 'cook', xp: 80, learn: [], txt: 'Heat is a tool.' }, ic: ['book', '#c88a2a', '#d8d8c8'] });
  // CLOTHING  slot, warm(degC), prot(0..1), rain(0..1), cap [[w,h]], cb extra kg
  add('cap', 'Baseball Cap', 'cloth', 1, 1, 0.1, { slot: 'head', warm: 0.5, prot: 0.02, ic: ['hat', '#3a4a6a', '#2a3450'] });
  add('beanie', 'Wool Beanie', 'cloth', 1, 1, 0.1, { slot: 'head', warm: 2, prot: 0.02, ic: ['hat', '#6a3a32', '#4a2822'] });
  add('hardhat', 'Hard Hat', 'cloth', 1, 1, 0.5, { slot: 'head', warm: 0.5, prot: 0.15, ic: ['hat', '#d8a82c', '#a07818'] });
  add('tshirt', 'T-Shirt', 'cloth', 2, 2, 0.2, { slot: 'body', warm: 1, prot: 0.02, ic: ['shirt', '#6a7a6a', '#4a5a4a'] });
  add('hoodie', 'Hoodie', 'cloth', 2, 2, 0.6, { slot: 'body', warm: 4, prot: 0.06, cap: [[2, 1]], ic: ['shirt', '#4a4a58', '#32323e'] });
  add('jacket', 'Field Jacket', 'cloth', 2, 2, 0.9, { slot: 'body', warm: 6, prot: 0.1, rain: 0.35, cap: [[2, 2]], ic: ['shirt', '#5a6a42', '#3a4828'] });
  add('raincoat', 'Raincoat', 'cloth', 2, 2, 0.5, { slot: 'body', warm: 3, prot: 0.04, rain: 0.95, cap: [[2, 1]], ic: ['shirt', '#c8a82c', '#8a7418'] });
  add('vest_police', 'Ballistic Vest', 'cloth', 2, 2, 3.0, { slot: 'body', warm: 1, prot: 0.45, cap: [[3, 1]], ic: ['shirt', '#26303a', '#161c22'] });
  add('jeans', 'Jeans', 'cloth', 2, 2, 0.6, { slot: 'legs', warm: 2, prot: 0.12, ic: ['pants', '#3a4a6a', '#2a3450'] });
  add('cargo', 'Cargo Pants', 'cloth', 2, 2, 0.7, { slot: 'legs', warm: 2.5, prot: 0.15, cap: [[3, 2]], ic: ['pants', '#6a6a4a', '#4a4a32'] });
  add('sneakers', 'Sneakers', 'cloth', 2, 1, 0.5, { slot: 'feet', warm: 0.5, prot: 0.02, quiet: 0.9, ic: ['shoe', '#c8c8c8', '#6a6a6a'] });
  add('boots', 'Work Boots', 'cloth', 2, 1, 1.1, { slot: 'feet', warm: 1.5, prot: 0.14, quiet: 1.1, ic: ['shoe', '#5a4228', '#3a2a18'] });
  add('backpack_school', 'School Backpack', 'cloth', 2, 2, 0.6, { slot: 'back', cap: [[5, 4]], cb: 3, ic: ['pack', '#a83a32', '#6a2420'] });
  add('backpack_hike', 'Hiking Pack', 'cloth', 3, 3, 1.4, { slot: 'back', cap: [[7, 6]], cb: 7, ic: ['pack', '#4a6a3a', '#2e4424'] });
  add('duffel', 'Gym Duffel', 'cloth', 3, 2, 0.8, { slot: 'back', cap: [[6, 4]], cb: 4, noisy: 1.1, ic: ['pack', '#3a4458', '#252c3a'] });

  // ---- loot tables [id, weight] ----
  const L = (DC.LOOT = {
    kitchen: [['beans', 8], ['soup', 6], ['chips', 6], ['bread', 4], ['cereal', 4], ['peaches', 4], ['soda', 4], ['knife', 2], ['pan', 2], ['matches', 2], ['pot', 1.5], ['rag', 2], ['bottle_empty', 3], ['water_clean', 3], ['jerky', 2], ['petfood', 1.5]],
    fridge: [['sandwich', 6], ['egg', 6], ['apple', 5], ['soda', 5], ['carrot', 3], ['bread', 3], ['water_clean', 3], ['choc', 3], ['jerky', 2]],
    bedroom: [['sheet', 6], ['tshirt', 4], ['hoodie', 2.5], ['jeans', 3], ['jacket', 1.5], ['sneakers', 2.5], ['cap', 2], ['beanie', 2], ['alarm_clock', 3], ['cash', 4], ['flashlight', 2], ['battery', 3], ['backpack_school', 1.4], ['painkillers', 1.5], ['book_survival', 0.6], ['note', 2], ['rag', 2]],
    living: [['newspaper', 6], ['battery', 3], ['lighter', 3], ['cash', 3], ['radio', 1.2], ['sheet', 3], ['book_cooking', 0.8], ['book_firstaid', 0.8], ['note', 3], ['map', 0.8], ['matches', 3]],
    bath: [['painkillers', 4], ['bandage', 5], ['antiseptic', 3], ['rag', 3], ['water_tabs', 1], ['bottle_empty', 2]],
    garage: [['hammer', 4], ['screwdriver', 4], ['nails', 8], ['plank', 5], ['saw', 2], ['crowbar', 2], ['scrap', 5], ['rope', 3], ['duct_tape', 3], ['battery', 3], ['hatchet', 1.5], ['jerry_empty', 2], ['wire', 3], ['bat', 2], ['pipe', 3], ['shovel', 1.5], ['flashlight', 2], ['tarp', 2], ['cargo', 1], ['boots', 1.5], ['book_carpentry', 0.7]],
    desk: [['cash', 4], ['battery', 3], ['note', 4], ['newspaper', 2], ['circuit', 1.5], ['pins', 2], ['screwdriver', 1.5], ['map', 1], ['lighter', 2]],
    dumpster: [['rag', 4], ['scrap', 3], ['bottle_empty', 5], ['can_empty', 6], ['newspaper', 4], ['chips', 1], ['stick', 2], ['wire', 2], ['sheet', 1]],
    locker: [['sneakers', 3], ['tshirt', 4], ['backpack_school', 2], ['duffel', 1], ['cap', 3], ['water_clean', 3], ['jeans', 3], ['hoodie', 2], ['choc', 2], ['battery', 2], ['pins', 1]],
    shop_grocery: [['beans', 8], ['soup', 7], ['peaches', 5], ['chips', 6], ['bread', 4], ['cereal', 5], ['soda', 6], ['water_clean', 6], ['jerky', 4], ['choc', 4], ['apple', 3], ['mre', 0.6], ['petfood', 3], ['bottle_empty', 2]],
    shop_pharmacy: [['bandage', 8], ['painkillers', 7], ['antiseptic', 6], ['antibiotics', 3], ['firstaid', 3], ['splint', 2], ['water_tabs', 3], ['water_clean', 3], ['book_firstaid', 0.6]],
    shop_hardware: [['hammer', 4], ['screwdriver', 4], ['nails', 8], ['plank', 5], ['saw', 3], ['crowbar', 3], ['rope', 4], ['duct_tape', 4], ['tarp', 3], ['wire', 3], ['battery', 4], ['flashlight', 3], ['hatchet', 2], ['jerry_empty', 2], ['shovel', 2], ['scrap', 3], ['pipe', 2], ['lighter', 2], ['book_carpentry', 0.8], ['matches', 2]],
    shop_clothes: [['tshirt', 5], ['hoodie', 4], ['jacket', 3], ['raincoat', 2.5], ['jeans', 4], ['cargo', 3], ['sneakers', 4], ['boots', 3], ['cap', 3], ['beanie', 3], ['backpack_school', 2.5], ['backpack_hike', 1.2], ['duffel', 1.2]],
    shop_conv: [['chips', 7], ['soda', 7], ['choc', 5], ['battery', 4], ['lighter', 3], ['map', 2], ['water_clean', 4], ['jerky', 4], ['newspaper', 3], ['matches', 3], ['radio', 0.8], ['painkillers', 1.5]],
    police: [['baton', 3], ['pistol', 1.0], ['ammo9', 4], ['vest_police', 1.2], ['flashlight', 4], ['bandage', 3], ['radio', 2], ['boots', 2], ['jacket', 1.5], ['pins', 2], ['note', 2], ['water_clean', 3], ['battery', 3]],
    hospital: [['bandage', 8], ['painkillers', 6], ['antiseptic', 6], ['antibiotics', 4], ['firstaid', 3.5], ['splint', 3], ['water_tabs', 3], ['rag', 2], ['water_clean', 3], ['note', 1.5], ['book_firstaid', 0.5]],
    fire: [['fire_axe', 1.2], ['hatchet', 2], ['flashlight', 4], ['rope', 4], ['boots', 3], ['firstaid', 2], ['water_clean', 4], ['bandage', 3], ['hardhat', 2], ['jacket', 2], ['radio', 1.5], ['battery', 3], ['mre', 0.8], ['crowbar', 2]],
    warehouse: [['plank', 8], ['nails', 8], ['scrap', 6], ['tarp', 3], ['rope', 4], ['wire', 3], ['duct_tape', 3], ['hammer', 2], ['crowbar', 2], ['pipe', 2], ['battery', 2], ['cereal', 2], ['jerry_empty', 1.5], ['log', 0.5], ['sheet', 2], ['beans', 2]],
    gas: [['chips', 6], ['soda', 8], ['choc', 5], ['battery', 4], ['lighter', 3], ['jerry_empty', 2], ['map', 2], ['radio', 1], ['jerky', 3], ['water_clean', 4], ['screwdriver', 1.5], ['duct_tape', 2]],
    farm: [['carrot', 6], ['potato', 6], ['egg', 6], ['shovel', 2], ['rope', 3], ['hatchet', 2], ['bottle_empty', 2], ['jerky', 1.5], ['boots', 2], ['jacket', 1.5], ['petfood', 2], ['tarp', 1.5]],
    car: [['jacket', 2], ['water_clean', 3], ['flashlight', 2], ['screwdriver', 2], ['jerry_empty', 1.5], ['map', 2], ['battery', 3], ['chips', 2], ['soda', 2], ['rag', 3], ['tarp', 1], ['crowbar', 1], ['radio', 1], ['duct_tape', 1.5], ['note', 1.5]],
    cabinet: [['beans', 4], ['soup', 4], ['cereal', 3], ['pan', 1.5], ['pot', 1], ['matches', 2], ['chips', 3], ['jerky', 1], ['peaches', 3], ['bread', 2]],
    guncab: [['pistol', 1.4], ['ammo9', 5], ['baton', 2], ['vest_police', 1], ['flashlight', 2], ['radio', 1.5], ['keycard', 0.0]],
    barrel: [['stick', 3], ['rope', 2], ['scrap', 2], ['water_dirty', 2], ['carrot', 2]],
    mailbox: [['newspaper', 4], ['cash', 2], ['note', 2]],
    crate: [], // routed by building type
  });
  DC.CONTAINER_TABLE = { fridge: 'fridge', counter: 'kitchen', cabinet: 'cabinet', wardrobe: 'bedroom', shelf: 'living', desk: 'desk', dumpster: 'dumpster', medcab: 'bath', barrel: 'barrel', mailbox: 'mailbox', guncab: 'guncab', car: 'car', locker: 'locker', built: null };

  // ---- skills / traits / occupations ----
  DC.SKILLS = [
    { id: 'scav', n: 'Scavenging', d: 'Faster, luckier searching.' }, { id: 'craft', n: 'Crafting', d: 'Faster crafting and better results.' },
    { id: 'melee', n: 'Melee', d: 'More damage, better accuracy, less stamina.' }, { id: 'fit', n: 'Fitness', d: 'Stamina and carrying capacity.' },
    { id: 'aid', n: 'First Aid', d: 'Treatments work better.' }, { id: 'cook', n: 'Cooking', d: 'Cooked food is more nourishing.' },
    { id: 'build', n: 'Building', d: 'Faster, sturdier construction.' }, { id: 'stealth', n: 'Stealth', d: 'Quieter movement, harder to spot.' },
  ];
  DC.xpNeed = (lvl) => Math.round(40 * Math.pow(lvl + 1, 1.45));
  DC.TRAITS = [
    { id: 'strong', n: 'Strong', c: 2, d: '+6 kg capacity, +15% melee damage' }, { id: 'athletic', n: 'Athletic', c: 2, d: '+20% stamina, faster recovery' },
    { id: 'lightfoot', n: 'Light Footed', c: 2, d: 'Moves 20% more quietly' }, { id: 'handy', n: 'Handy', c: 2, d: 'Craft and build 25% faster' },
    { id: 'learner', n: 'Quick Learner', c: 2, d: '+40% skill XP' }, { id: 'hardy', n: 'Hardy', c: 2, d: 'Resists cold, slower hunger' },
    { id: 'keen', n: 'Keen Eyes', c: 1, d: 'See further in poor light' },
    { id: 'weak', n: 'Weak', c: -2, d: '-4 kg capacity, -15% melee damage' }, { id: 'unfit', n: 'Out of Shape', c: -2, d: '-20% stamina' },
    { id: 'clumsy', n: 'Clumsy', c: -2, d: 'Moves 25% more loudly' }, { id: 'slow', n: 'Slow Learner', c: -1, d: '-25% skill XP' },
    { id: 'myopic', n: 'Nearsighted', c: -1, d: 'Reduced sight range' }, { id: 'anxious', n: 'Anxious', c: -2, d: 'Stress builds 50% faster' },
    { id: 'stomach', n: 'Weak Stomach', c: -1, d: 'Twice as likely to fall ill from bad food' }, { id: 'insomniac', n: 'Insomniac', c: -1, d: 'Tires 25% faster' },
    { id: 'fragile', n: 'Fragile', c: -2, d: 'Maximum health 80' },
  ];
  DC.OCCUPATIONS = [
    { id: 'nurse', n: 'Night Nurse', sk: { aid: 3, cook: 1 }, kit: [['bandage', 3], ['painkillers', 2], ['antiseptic', 1], ['sneakers', 1]], d: 'Steady hands. First Aid +3.' },
    { id: 'carpenter', n: 'Carpenter', sk: { build: 3, craft: 1 }, kit: [['hammer', 1], ['nails', 20], ['plank', 3], ['boots', 1]], d: 'Builds fast. Building +3.' },
    { id: 'officer', n: 'Deputy', sk: { melee: 2, stealth: 1 }, kit: [['baton', 1], ['flashlight', 1], ['battery', 2], ['boots', 1]], d: 'Trained. Melee +2.' },
    { id: 'farmer', n: 'Farmhand', sk: { cook: 2, fit: 2 }, kit: [['hatchet', 1], ['potato', 2], ['carrot', 2], ['boots', 1]], d: 'Tough and practical.' },
    { id: 'mechanic', n: 'Mechanic', sk: { craft: 3, scav: 1 }, kit: [['crowbar', 1], ['screwdriver', 1], ['duct_tape', 1], ['scrap', 2]], d: 'Fixes things. Crafting +3.' },
    { id: 'courier', n: 'Bike Courier', sk: { fit: 3, stealth: 1 }, kit: [['water_clean', 1], ['jerky', 2], ['sneakers', 1], ['cap', 1]], d: 'Fast legs. Fitness +3.' },
    { id: 'burglar', n: 'Cat Burglar', sk: { stealth: 3, scav: 2 }, kit: [['pins', 4], ['screwdriver', 1], ['flashlight', 1], ['battery', 1]], d: 'Quiet and quick. Stealth +3.' },
  ];

  // ---- recipes ----
  // tools: tags (any item with tag), 'a|b' alternatives. station: 'heat' | 'bench'.
  DC.RECIPES = [
    { id: 'rags', n: 'Tear Sheet into Rags', out: ['rag', 4], ing: [['sheet', 1]], t: 3, un: 'start', sk: 'craft' },
    { id: 'bandage_rough', n: 'Makeshift Bandage', out: ['bandage_rough', 1], ing: [['rag', 2]], t: 4, un: 'start', sk: 'aid' },
    { id: 'torch', n: 'Torch', out: ['torch', 1], ing: [['stick', 1], ['rag', 1]], tools: ['fire'], t: 5, un: 'start', sk: 'craft' },
    { id: 'planks', n: 'Cut Planks from Log', out: ['plank', 3], ing: [['log', 1]], tools: ['saw|chop'], t: 8, un: 'start', sk: 'craft' },
    { id: 'sticks', n: 'Split Kindling', out: ['stick', 4], ing: [['log', 1]], tools: ['chop'], t: 5, un: 'start', sk: 'craft' },
    { id: 'nails', n: 'Forge Nails from Scrap', out: ['nails', 6], ing: [['scrap', 1]], tools: ['hammer'], station: 'bench', t: 8, un: 'start', sk: 'craft' },
    { id: 'panel', n: 'Barricade Panel', out: ['panel', 1], ing: [['plank', 2], ['nails', 4]], tools: ['hammer'], t: 7, un: 'start', sk: 'build' },
    { id: 'spear', n: 'Sharpened Spear', out: ['spear', 1], ing: [['stick', 2]], tools: ['cut'], t: 6, un: { book: 'spear' }, sk: 'craft' },
    { id: 'splint', n: 'Splint', out: ['splint', 1], ing: [['plank', 1], ['rag', 2]], t: 5, un: { skill: 'aid', lvl: 1 }, book: 'splint', sk: 'aid' },
    { id: 'nailbat', n: 'Nail Bat', out: ['nailbat', 1], ing: [['bat', 1], ['nails', 5]], tools: ['hammer'], station: 'bench', t: 10, un: { skill: 'craft', lvl: 2 }, sk: 'craft' },
    { id: 'purify', n: 'Purify Water (tablet)', out: ['water_clean', 1], ing: [['water_dirty', 1], ['water_tabs', 1]], inherit: 'uses', t: 4, un: 'start', sk: 'aid' },
    { id: 'boil', n: 'Boil Water', out: ['water_clean', 1], ing: [['water_dirty', 1]], tools: ['pot'], station: 'heat', inherit: 'uses', t: 9, un: 'start', sk: 'cook' },
    { id: 'cook_egg', n: 'Boil Egg', out: ['egg_c', 1], ing: [['egg', 1]], tools: ['pot'], station: 'heat', t: 6, un: 'start', sk: 'cook' },
    { id: 'cook_potato', n: 'Roast Potato', out: ['potato_c', 1], ing: [['potato', 1]], station: 'heat', t: 7, un: 'start', sk: 'cook' },
    { id: 'cook_carrot', n: 'Cook Carrot', out: ['carrot_c', 1], ing: [['carrot', 1]], station: 'heat', t: 5, un: 'start', sk: 'cook' },
  ];
  // buildables  o: object type, ground: set ground type instead
  DC.BUILDS = [
    { id: 'bwall', n: 'Plank Wall', o: O.BWALL, mats: [['plank', 3], ['nails', 4]], t: 6, un: 'start', d: 'Solid wall. Blocks sight.' },
    { id: 'bgate', n: 'Plank Gate', o: O.BGATE, mats: [['plank', 3], ['nails', 6]], t: 8, un: { skill: 'build', lvl: 1 }, d: 'A door you can open and lock.' },
    { id: 'bfloor', n: 'Wood Floor', ground: G.WOOD, mats: [['plank', 2], ['nails', 2]], t: 4, un: 'start', d: 'Quiet-ish dry flooring.' },
    { id: 'bstairs', n: 'Lookout Steps', o: O.BSTAIRS, mats: [['plank', 5], ['nails', 8]], t: 10, un: { skill: 'build', lvl: 3 }, book: 'bstairs', d: 'Standing here extends your sight range.' },
    { id: 'bstore', n: 'Storage Crate', o: O.BSTORE, mats: [['plank', 4], ['nails', 6]], t: 6, un: 'start', d: 'Large grid storage.' },
    { id: 'bbed', n: 'Bed', o: O.BBED, mats: [['plank', 3], ['sheet', 2], ['nails', 4]], t: 9, un: 'start', d: 'Best place to sleep.' },
    { id: 'bbench', n: 'Workbench', o: O.BBENCH, mats: [['plank', 6], ['nails', 10]], t: 12, un: { skill: 'build', lvl: 1 }, book: 'bbench', d: 'Needed for forging and weapon mods.' },
    { id: 'btable', n: 'Table', o: O.BTABLE, mats: [['plank', 3], ['nails', 4]], t: 6, un: 'start', d: 'Furniture.' },
    { id: 'bchair', n: 'Chair', o: O.BCHAIR, mats: [['plank', 2], ['nails', 3]], t: 4, un: 'start', d: 'Furniture.' },
    { id: 'campfire', n: 'Campfire', o: O.CAMPFIRE, mats: [['log', 1], ['stick', 3]], t: 5, un: 'start', d: 'Warmth, light and cooking. Needs a lighter.' },
    { id: 'collector', n: 'Rain Collector', o: O.COLLECTOR, mats: [['tarp', 1], ['rope', 1], ['plank', 2], ['nails', 3]], t: 8, un: { skill: 'build', lvl: 1 }, d: 'Collects murky water during rain.' },
    { id: 'spikes', n: 'Spike Barricade', o: O.SPIKES, mats: [['plank', 3], ['nails', 3], ['stick', 4]], t: 8, un: { skill: 'build', lvl: 2 }, book: 'spikes', d: 'Hurts zombies that press against it.' },
    { id: 'tripwire', n: 'Tin-Can Tripwire', o: O.TRIPWIRE, mats: [['can_empty', 3], ['rope', 1]], t: 4, un: { book: 'tripwire' }, d: 'Rattles when something walks through.' },
  ];

  // ---- presets ----
  DC.PRESETS = {
    easy: { name: 'Gentle', zombies: 0.5, loot: 1.6, weather: 0.5, dayLen: 24, needs: 0.6, powerDay: 9, waterDay: 6 },
    normal: { name: 'Survivor', zombies: 1, loot: 1, weather: 1, dayLen: 20, needs: 1, powerDay: 6, waterDay: 4 },
    hard: { name: 'Desperate', zombies: 1.5, loot: 0.7, weather: 1.4, dayLen: 16, needs: 1.3, powerDay: 4, waterDay: 3 },
    nightmare: { name: 'Last Light', zombies: 2, loot: 0.5, weather: 1.8, dayLen: 14, needs: 1.6, powerDay: 2, waterDay: 2 },
  };
  DC.DEFAULT_SETTINGS = {
    music: 0.45, sfx: 0.8, mute: false, gore: true, debug: false, zoom: 0, pauseInv: true, holdToggle: false, aimAssist: true,
    noiseRing: true, shadows: true, showTouch: false, hints: true, seen: {}, ctl: {},
  };

  // NPC / animal / lore
  DC.NPCS = [
    { id: 'marta', n: 'Marta Voss', role: 'retired nurse', home: 'house:3', lines: ['Keep your voice down. They hear everything.', 'The hospital had a supply room. Battery packs, mostly. Locked.', 'I have what I need. But a tin of anything would be kind.'], gift: 'firstaid', tip: 'The signal mast behind the fire station still has a mount. Someone needs the parts: a transmitter core, a battery pack, and fuel.' },
    { id: 'dale', n: 'Dale Okafor', role: 'mechanic', home: 'warehouse:0', lines: ['Fuel is the problem. The pumps are dry but the station kept cans out back.', 'Noise is a currency. Spend it carefully.', 'You look hungry. So am I.'], gift: 'crowbar', tip: 'There is a keycard in the police station. The checkpoint north on the county road still takes it.' },
    { id: 'jun', n: 'Jun Park', role: 'student', home: 'house:7', lines: ['I count the days. Eleven so far. Or twelve.', 'The power will go. It always goes.', 'Do you hear the dogs? They are not like the others.'], gift: 'map', tip: 'The police evidence room key is in a desk drawer. Search every desk.' },
  ];
  DC.LORE = [
    'Day 3. Radio says stay indoors. Radio says a lot of things. Water pressure dropped this morning.',
    'To whoever finds this: the fire station has a mast on the roof lot. If the grid ever comes back, call from there.',
    'Pharmacy was already empty. The hospital has a locked supply room on the east wing. Battery packs, maybe.',
    'They gather where it is loud. Do not run unless you must. Do not break glass at night.',
    'Evidence room key was in the sergeant\'s desk. I could not make myself go in. Maybe you can.',
    'Checkpoint north of town is still sealed. Keycard\'s with the police. If they open it, go. Do not look back.',
    'Boiled the creek water. Tastes like pennies. Alive, though.',
    'Barricade the windows. Leave one door you can escape from. Always one door.',
  ];
  DC.RADIO = [
    'EMERGENCY BROADCAST. Remain indoors. Conserve water. Do not approach the checkpoint.',
    'County alert: grid failure expected. Residents are advised to fill containers now.',
    '...repeating: a signal mast at the fire station is the last available relay in the county...',
    'This is the County Emergency Net. If you can hear this, someone is still listening. Stay quiet. Stay alive.',
    'Static... checkpoint north... sealed... keycards issued to sheriff office only...',
    'Reminder: noise attracts them. Light attracts them. Patience keeps you alive.',
  ];
})();
