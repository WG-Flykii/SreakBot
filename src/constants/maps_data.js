export const AVAILABLE_MAP_NAMES = [
  "A Balanced World",
  "An Arbitrary World",
  "A Pro World",
  "An Arbitrary Rural World",
  "A Balanced South America",
  "A Balanced Europe",
  "A Balanced North America",
  "A Balanced Asia",
  "A Balanced Africa",
  "A Balanced Oceania",
  /*"Map With Broken Locations Only",
  "50 50 Half Broken Locs"*/
];

export const MAPS = {};
AVAILABLE_MAP_NAMES.forEach(name => {
  MAPS[name] = name.toLowerCase().replace(/\s+/g, '-');
});

export const MAP_ALIASES = {
  abw: "A Balanced World",
  "a balanced world": "A Balanced World",

  aaw: "An Arbitrary World",
  "an arbitrary world": "An Arbitrary World",

  apw: "A Pro World",
  "a pro world": "A Pro World",

  aarw: "An Arbitrary Rural World",
  "an arbitrary rural world": "An Arbitrary Rural World",

  absa: "A Balanced South America",
  "a balanced south america": "A Balanced South America",

  abe: "A Balanced Europe",
  "a balanced europe": "A Balanced Europe",

  abna: "A Balanced North America",
  "a balanced north america": "A Balanced North America",

  aba: "A Balanced Asia",
  "a balanced asia": "A Balanced Asia",

  abf: "A Balanced Africa",
  "a balanced africa": "A Balanced Africa",

  abo: "A Balanced Oceania",
  "a balanced oceania": "A Balanced Oceania",

  /*mwblo: "Map With Broken Locations Only",
  "map with broken locations only": "Map With Broken Locations Only",

  hbl: "50 50 Half Broken Locs",
  "50 50 half broken locs": "50 50 Half Broken Locs"*/

};