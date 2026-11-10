import { createPlaceStore, type PlaceSnapshot } from "@/components/place-snapshot";

export type LogSnapshot = PlaceSnapshot;

export const logPlaces = createPlaceStore("trophy-log-list", "trophyLogSnapshot");

export const saveLogSnapshot = logPlaces.save;
export const takeLogSnapshot = logPlaces.take;
