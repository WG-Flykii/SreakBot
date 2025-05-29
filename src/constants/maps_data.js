import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadJsonFile } from '../utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export let mapData, mapNames, maps, mapAliases, mapImages;

// To reset, simply delete maps_data.json
mapData = loadJsonFile(
  path.join(__dirname, 'maps_data.json'),
  loadJsonFile(path.join(__dirname, 'default_maps.json'))
);

// For a full refresh
export function refreshMaps() {
  mapNames = Object.keys(mapData);

  maps = {};
  mapNames.forEach(name => {
    maps[name] = name.toLowerCase().replace(/\s+/g, '-');
  });

  mapAliases = {};
  mapImages = {};
  for (const [name, map] of Object.entries(mapData)) {
    for (const alias of map.aliases) {
      mapAliases[alias] = name;
      mapImages[alias] = map.distribution;
    }
  }
  
  console.log('Maps successfully refreshed');
}

refreshMaps();