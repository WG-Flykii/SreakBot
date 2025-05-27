const MAP_DATA = {
  "A Balanced World": {
    "aliases": ["abw", "a balanced world"],
    "distribution": "abaf_locations.webp"
  },
  "An Arbitrary World": {
    "aliases": ["aaw", "an arbitrary world"],
    "distribution": "aaw_locations.webp"
  },
  "A Pro World": {
    "aliases": ["apw", "a pro world"],
    "distribution": "apw_locations.webp"
  },
  "An Arbitrary Rural World": {
    "aliases": ["aarw", "an arbitrary rural world"],
    "distribution": "aarw_locations.webp"
  },
  "A Balanced South America": {
    "aliases": ["absa", "a balanced south america"],
    "distribution": "absa_locations.webp"
  },
  "A Balanced Europe": {
    "aliases": ["abe", "a balanced europe"],
    "distribution": "abe_locations.webp"
  },
  "A Balanced North America": {
    "aliases": ["abna", "a balanced north america"],
    "distribution": "abna_locations.webp"
  },
  "A Balanced Asia": {
    "aliases": ["aba", "a balanced asia"],
    "distribution": "aba_locations.webp"
  },
  "A Balanced Africa": {
    "aliases": ["abf", "a balanced africa"],
    "distribution": "abaf_locations.webp"
  },
  "A Balanced Oceania": {
    "aliases": ["abo", "a balanced oceania"],
    "distribution": "abo_locations.webp"
  }
};

export const AVAILABLE_MAP_NAMES = Object.keys(MAP_DATA);

export const MAPS = {};
AVAILABLE_MAP_NAMES.forEach(name => {
  MAPS[name] = name.toLowerCase().replace(/\s+/g, '-');
});

export const MAP_ALIASES = {};
export const MAP_IMAGES = {};
for (const [name, map] of Object.entries(MAP_DATA)) {
  for (const alias of map.aliases) {
    MAP_ALIASES[alias] = name;
    MAP_IMAGES[alias] = map.distribution;
  }
}