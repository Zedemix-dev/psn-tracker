export function guideSearchName(name: string): string {
  return name.replace(/[™®©]/g, "").replace(/\s+/g, " ").trim();
}

export function powerPyxRoadmapUrl(name: string): string {
  return `https://www.powerpyx.com/?s=${encodeURIComponent(`${name} roadmap`).replace(/%20/g, "+")}`;
}

export function psnProfilesGuidesUrl(name: string): string {
  return `https://psnprofiles.com/search/guides?q=${encodeURIComponent(name)}`;
}
