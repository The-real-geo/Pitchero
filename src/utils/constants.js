// src/utils/constants.js
export const sections = ["A", "B", "C", "D", "E", "F", "G", "H"];

export const pitches = [
  { id: "pitch2", name: "Pitch 2 - Grass", hasGrassArea: true },
  { id: "pitch1", name: "Pitch 1 - Astro", hasGrassArea: false }
];

export const defaultTeams = [
  { name: "Under 6", color: "#00FFFF" },
  { name: "Under 8", color: "#FF0000" },
  { name: "Under 9", color: "#0000FF" },
  { name: "Under 10", color: "#00AA00" },
  { name: "Under 11 - Red", color: "#CC0000" },
  { name: "Under 11 - Black", color: "#000000" },
  { name: "Under 12 YPL", color: "#FFD700" },
  { name: "Under 12 YSL", color: "#FF6600" },
  { name: "Under 13 YCC", color: "#8B00FF" },
  { name: "Under 14 YCC", color: "#FF1493" },
  { name: "Under 14 YSL", color: "#00CED1" },
  { name: "Under 15 YCC", color: "#8B4513" },
  { name: "Under 16 YCC", color: "#696969" }
];

export const timeSlots = (start = 17, end = 21) => {
  const slots = [];
  for (let h = start; h < end; h++) {
    slots.push(`${h}:00`, `${h}:30`);
  }
  return slots;
};

export const matchDayTimeSlots = (start = 8, end = 21) => {
  const slots = [];
  for (let h = start; h < end; h++) {
    for (let m = 0; m < 60; m += 15) {
      const minutes = m.toString().padStart(2, '0');
      slots.push(`${h}:${minutes}`);
    }
  }
  slots.push(`${end}:00`);
  return slots;
};

export function isLightColor(color) {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return brightness > 155;
}

export function getDefaultPitchAreaForTeam(teamName) {
  if (teamName.includes('Under 6') || teamName.includes('Under 7')) {
    return 'Under 6 & 7';
  } else if (teamName.includes('Under 8') || teamName.includes('Under 9')) {
    return 'Under 8 & 9';
  } else if (teamName.includes('Under 10') || teamName.includes('Under 11') || teamName.includes('Under 12') || teamName.includes('Under 13')) {
    return 'Under 10-13';
  } else if (teamName.includes('Under 14') || teamName.includes('Under 15') || teamName.includes('Under 16')) {
    return 'Under 14+';
  } else {
    return 'Under 10-13';
  }
}