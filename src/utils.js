import fs from 'fs';
import path from 'path';

export function loadJsonFile(filePath, defaultValue = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
    console.log(`File ${filePath} not found, creating new one`);
    saveJsonFile(filePath, defaultValue);
    return defaultValue;
  } catch (error) {
    console.error(`Error loading file ${filePath}:`, error);
    return defaultValue;
  }
}

export function saveJsonFile(filePath, data) {
  try {
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error saving to ${filePath}:`, error);
  }
}