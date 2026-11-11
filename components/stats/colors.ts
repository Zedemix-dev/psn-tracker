/** Chart colors, spec 18.11. Hex values because SVG attributes cannot rely on CSS variables everywhere. */
export const ACCENT = "#5AA9FF";
export const LEVEL = "#F2C462";
export const GRID = "rgba(255,255,255,.09)";
export const SURFACE = "#141B38";

export const TYPE_COLORS = { platinum: "#6C8AD8", gold: "#B48E26", silver: "#868FA3", bronze: "#C2703F" } as const;
/** Ultra rare to Common. */
export const RARITY_COLORS = ["#B3261E", "#D6502A", "#E8862A", "#F2B233", "#F7DC5A"] as const;
/** Highest band to lowest. */
export const COMPLETION_COLORS = ["#4CCB7A", "#3FAE66", "#339353", "#2A7845", "#216038"] as const;
export const PLATFORM_COLORS = { PS5: "#4F8FE8", PS4: "#2EAD7F" } as const;
