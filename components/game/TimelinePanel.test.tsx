// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TimelinePanel } from "@/components/game/TimelinePanel";

afterEach(cleanup);

describe("TimelinePanel", () => {
  it("shows an unearned Platinum as Not earned yet with a dash", () => {
    const { container } = render(
      <TimelinePanel
        rows={[
          { label: "First trophy", note: "2 days ago", date: "5 Nov 2026", time: "10:00" },
          { label: "Platinum", note: "Not earned yet", date: "—", time: null },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByText("Not earned yet")).toBeInTheDocument();
    const plat = screen.getByText("Platinum").closest("li")!;
    expect(plat.querySelector(".v")!.textContent).toBe("—");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText("5 Nov 2026")).toBeInTheDocument();
  });
});
