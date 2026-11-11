/** Spec 18.9: raw PSN publisher names that are shortened for display. */
const NAMES: Record<string, string> = {
  "Square Enix LTD": "Square Enix",
  "BANDAI NAMCO ENTERTAINMENT EUROPE": "Bandai Namco",
  "Activision Blizzard Int'l BV": "Activision Blizzard",
  "SEGA EUROPE LTD": "SEGA",
  "EA Swiss Sarl": "Electronic Arts",
  "Koei Tecmo Europe Ltd": "Koei Tecmo",
  "TMG STUDIOS B.V.": "TMG Studios",
  "CE EUROPE LIMITED": "Capcom",
  "Team 17 Digital LTD": "Team17",
  "CD PROJEKT RED S.A.": "CD Projekt Red",
  "505 GAMES S.R.L.": "505 Games",
  "Larian Studios Games Ltd": "Larian Studios",
};

export function displayPublisher(raw: string): string {
  return Object.hasOwn(NAMES, raw) ? NAMES[raw] : raw;
}
