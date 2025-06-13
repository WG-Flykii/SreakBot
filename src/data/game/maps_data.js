import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadJsonFile } from '../../utils/json_utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export let mapData, mapNames, mapAliases;
export const mapToSlug = map => map.toLowerCase().replace(/\s+/g, '-');

// To reset, simply delete maps_data.json
mapData = loadJsonFile(
  path.join(__dirname, 'maps_data.json'),
  loadJsonFile(path.join(__dirname, 'default_maps.json'))
);

// For a full refresh
export function refreshMaps() {
  mapNames = Object.keys(mapData);

  mapAliases = {};
  for (const [name, map] of Object.entries(mapData)) {
    for (const alias of map.aliases) {
      mapAliases[alias.toLowerCase()] = name;
    }
  }
  
  console.log('Maps successfully refreshed');
}

refreshMaps();