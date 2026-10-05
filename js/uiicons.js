/* Dead County: Last Light - interface icon set (vector paths drawn for this game). */
(function () {
  'use strict';
  const DC = window.DC;
  const P = {
    heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
    food: 'M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M9 3v5M17 21V3c-2.6 1.4-3.6 4-3.6 7s1 4 3.6 4',
    drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
    bolt: 'M13 2L5 14h6l-1 8 8-12h-6l1-8z',
    moon: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z',
    pulse: 'M3 12h3l2.5-6 4 12 3-9 1.5 3H21',
    thermo: 'M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z',
    sword: 'M14.5 5.5L19 5l-.5 4.5L8 20l-4-4zM6 14l4 4M3 21l3-3',
    hand: 'M8 13V6.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2.4 7-6 7-3 0-4.4-1.6-5.8-4l-1.6-3a1.5 1.5 0 0 1 2.5-1.6L8 13',
    sprint: 'M6 11l6-6 6 6M6 18l6-6 6 6',
    crouch: 'M12 4v10M7 10l5 5 5-5M5 20h14',
    bag: 'M8 8V6a4 4 0 0 1 8 0v2M5 8h14l1 13H4L5 8zM9 13h6',
    map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6zM9 4v14M15 6v14',
    book: 'M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2V5zM6 21h13v-3',
    pause: 'M8 5v14M16 5v14',
    flash: 'M9 3h6l1 5H8zM8 8l1 13h6l1-13M12 12v3',
    plus: 'M12 5v14M5 12h14',
    gear: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
    close: 'M6 6l12 12M18 6L6 18',
    back: 'M15 5l-7 7 7 7',
    noise: 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    weight: 'M7 8h10l3 13H4L7 8zM9 8a3 3 0 0 1 6 0',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
    sort: 'M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4',
    menu: 'M5 7h14M5 12h14M5 17h14',
    skull: 'M12 3a7 7 0 0 0-5 12v3h10v-3A7 7 0 0 0 12 3zM9.5 11.5h.01M14.5 11.5h.01M10 18v2M14 18v2',
    check: 'M5 12l5 5 9-10',
    lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
    compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z',
    target: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    skill: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z',
    hammer: 'M14 4l6 6-3 3-6-6zM12 9L4 17l3 3 8-8',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    save: 'M5 4h12l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
    home: 'M4 11l8-7 8 7M6 10v10h12V10M10 20v-6h4v6',
    volume: 'M4 9v6h4l5 4V5L8 9z',
    mute: 'M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6',
    play: 'M8 5v14l11-7z',
    trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
    split: 'M12 4v16M5 8l-2 4 2 4M19 8l2 4-2 4',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
    cloud: 'M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5 4.5 4.5 0 0 1 17 18z',
    rain: 'M7 14a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 4.5 4.5 4.5 0 0 1 17 14zM8 17l-1 3M12 17l-1 3M16 17l-1 3',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.01',
  };
  DC.UIICONS = P;
  DC.uiIcon = function (name, size) {
    const d = P[name] || P.info;
    return '<svg viewBox="0 0 24 24" width="' + (size || 20) + '" height="' + (size || 20) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  };
  DC.hydrateIcons = function (root) {
    (root || document).querySelectorAll('.ico[data-i]').forEach((el) => { if (!el.firstChild) el.innerHTML = DC.uiIcon(el.getAttribute('data-i'), el.getAttribute('data-s') || 24); });
  };
})();
