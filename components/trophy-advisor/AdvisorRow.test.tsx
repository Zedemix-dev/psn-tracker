// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdvisorRow } from "@/components/trophy-advisor/AdvisorRow";
import type { AdvisorRow as AdvisorRowData } from "@/src/trophy-advisor/load";

vi.mock("next/link", () => ({
  default: ({ href, prefetch, children, ...rest }: { href: string; prefetch?: boolean; children: ReactNode }) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}));

const row = (over: Partial<AdvisorRowData> = {}): AdvisorRowData => ({
  key: "NPWR1_00:5",
  name: "Last Light",
  detail: "Finish the game.",
  iconSrc: "/media/icon.png",
  type: "gold",
  gameId: "NPWR1_00",
  gameName: "The Game",
  gameSrc: "/media/game.png",
  gameIsIcon: false,
  dlc: null,
  platforms: ["PS5"],
  counter: null,
  ratePct: "4.60%",
  tier: "Ultra rare",
  unobtainable: false,
  unobtainableNote: null,
  ...over,
});

afterEach(cleanup);

describe("AdvisorRow", () => {
  it("links the image and the name of the game", () => {
    const { container } = render(<AdvisorRow row={row()} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    for (const a of links) expect(a).toHaveAttribute("href", "/games/NPWR1_00");
    expect(container.firstElementChild).toHaveAttribute("data-key", "NPWR1_00:5");
    expect(container.firstElementChild).toHaveClass("log-row", "adv-row");
  });

  it("shows the DLC name, the platforms, the rarity and the type", () => {
    const { container } = render(<AdvisorRow row={row({ dlc: "Extra Pack", platforms: ["PS4", "PS5"] })} />);
    expect(screen.getByText("· Extra Pack")).toBeInTheDocument();
    expect(screen.getByText("PS4")).toBeInTheDocument();
    expect(screen.getByText("PS5")).toBeInTheDocument();
    expect(screen.getByText("4.60%")).toBeInTheDocument();
    expect(screen.getByText("Ultra rare")).toBeInTheDocument();
    expect(container.querySelector(".ti")).not.toBeNull();
  });

  it("shows the counter only when there is one", () => {
    const { container, rerender } = render(<AdvisorRow row={row()} />);
    expect(container.querySelector(".adv-count")).toBeEmptyDOMElement();
    expect(container.querySelector(".adv-count")).not.toHaveAttribute("title");
    rerender(<AdvisorRow row={row({ counter: "3,626/5,000" })} />);
    expect(screen.getByText("3,626/5,000")).toHaveAttribute("title", "Progress");
  });

  it("shows no number and no date", () => {
    const { container } = render(<AdvisorRow row={row()} />);
    expect(container.querySelector(".num")).toBeNull();
    expect(container.querySelector(".when")).toBeNull();
  });

  it("marks an unobtainable trophy: class lost, tooltip with the cause", () => {
    const { container, rerender } = render(<AdvisorRow row={row()} />);
    expect(container.firstElementChild).not.toHaveClass("lost");
    expect(container.querySelector(".unob")).toBeNull();
    rerender(<AdvisorRow row={row({ unobtainable: true, unobtainableNote: "Servers are off." })} />);
    expect(container.firstElementChild).toHaveClass("lost");
    expect(screen.getByRole("img", { name: "No longer obtainable. Servers are off." })).toBeInTheDocument();
  });
});
