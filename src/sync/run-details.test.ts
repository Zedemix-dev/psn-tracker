import { expect, it } from "vitest";
import { formatRunDetails } from "./run-details";

const run = { error: null, titlesDone: 266, titlesTotal: 266, trophiesUpdated: 12434 };

it("groups the thousands", () => {
  expect(formatRunDetails(run)).toBe("266/266 games, 12,434 trophies");
  expect(formatRunDetails({ ...run, titlesDone: 1200, titlesTotal: 1500 })).toBe("1,200/1,500 games, 12,434 trophies");
});

it("shows the error instead when there is one", () => {
  expect(formatRunDetails({ ...run, error: "PSN token expired" })).toBe("PSN token expired");
});
