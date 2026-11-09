// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);
import { RarityBreakdown } from "@/components/RarityBreakdown";

describe("RarityBreakdown", () => {
  it("shows the five tier labels and formatted counts", () => {
    render(
      <RarityBreakdown
        breakdown={{ "Ultra rare": 3, "Very rare": 12, Rare: 40, Uncommon: 200, Common: 1314 }}
      />,
    );
    for (const l of ["Ultra rare", "Very rare", "Rare", "Uncommon", "Common"]) {
      expect(screen.getByText(l)).toBeTruthy();
    }
    expect(screen.getByText("1,314")).toBeTruthy();
  });
});
