export function getDay(date = null) {
  const targetDate = date ? new Date(date) : new Date();
  return targetDate.toISOString().split('T')[0];
}

export function capitalizeFirst(str) {
  return str[0].toUpperCase() + str.slice(1);
}

export function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.floor((milliseconds % 1000) / 10);

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export function findObjectIndex(obj, key) {
  return Object.keys(obj).findIndex(k => k === key);
}