export const availableMapNames = [
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
  "Map With Broken Locations Only"
];

export const maps = {};
availableMapNames.forEach(name => {
  maps[name] = name.toLowerCase().replace(/\s+/g, '-');
});

export const mapAliases = {
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

  mwblo: "map with broken locations only",
  "map with broken locations only": "map with broken locations only"

};

const mapImages = {
  "a balanced africa": { name: "A Balanced Africa", file: "abaf_locations.png" },
  "abaf": { name: "A Balanced Africa", file: "abaf_locations.png" },

  "a balanced europe": { name: "A Balanced Europe", file: "abe_locations.png" },
  "abe": { name: "A Balanced Europe", file: "abe_locations.png" },

  "a balanced asia": { name: "A Balanced Asia", file: "aba_locations.png" },
  "aba": { name: "A Balanced Asia", file: "aba_locations.png" },

  "a balanced south america": { name: "A Balanced South America", file: "absa_locations.png" },
  "absa": { name: "A Balanced South America", file: "absa_locations.png" },

  "a balanced north america": { name: "A Balanced North America", file: "abna_locations.png" },
  "abna": { name: "A Balanced North America", file: "abna_locations.png" },

  "a balanced oceania": { name: "A Balanced Oceania", file: "abo_locations.png" },
  "abo": { name: "A Balanced Oceania", file: "abo_locations.png" },
};
