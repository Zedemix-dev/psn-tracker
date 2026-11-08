// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GameInfoPanel } from "@/components/game/GameInfoPanel";
import type { GameDetail } from "@/src/games/detail";

afterEach(cleanup);

const detail = (o: Partial<GameDetail> = {}): GameDetail => ({
  id: "NPWR1_00",
  name: "Game",
  platforms: ["PS5"],
  coverSrc: "/c.png",
  coverIsIcon: false,
  bannerPath: null,
  logoSrc: null,
  metaParts: [],
  counts: { platinum: [1, 1], gold: [5, 6], silver: [10, 11], bronze: [31, 40] },
  progress: 81,
  rank: "B",
  status: "plat-earned",
  earnedTotal: 47,
  definedTotal: 58,
  points: { total: 1485, earned: 1320 },
  groups: [],
  trophies: [],
  breakdown: { "Ultra rare": 1, "Very rare": 2, Rare: 3, Uncommon: 4, Common: 5 },
  rarity: { average: "30.10%", lowest: "1.20%", median: "25.00%", highest: "80.00%" },
  publisher: "CD Projekt",
  genres: "RPG",
  releaseDate: "10 Dec 2020",
  guides: { powerPyx: "https://pyx.example/x", psnProfiles: "https://psnp.example/y" },
  timeline: [],
  ...o,
});

describe("GameInfoPanel", () => {
  it("shows the total and earned lines", () => {
    const { container } = render(<GameInfoPanel detail={detail()} />);
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Earned")).toBeInTheDocument();
    expect(container.textContent).toContain("58 trophies · 1,485 points");
    expect(container.textContent).toContain("47 trophies · 1,320 points");
  });

  it("omits the Publisher row without a publisher", () => {
    render(<GameInfoPanel detail={detail({ publisher: null })} />);
    expect(screen.queryByText("Publisher")).toBeNull();
    expect(screen.getByText("Genre")).toBeInTheDocument();
  });

  it("titles the three spread values", () => {
    const { container } = render(<GameInfoPanel detail={detail()} />);
    const spans = [...container.querySelectorAll(".spread span")];
    expect(spans.map((s) => s.getAttribute("title"))).toEqual(["Lowest", "Median", "Highest"]);
    expect(spans.map((s) => s.textContent)).toEqual(["1.20%", "25.00%", "80.00%"]);
  });

  it("omits the rarity row without rarity", () => {
    render(<GameInfoPanel detail={detail({ rarity: null })} />);
    expect(screen.queryByText("Avg. rarity")).toBeNull();
  });

  it("links to both guides", () => {
    render(<GameInfoPanel detail={detail()} />);
    const pyx = screen.getByRole("link", { name: /PowerPyx roadmap/ });
    const psnp = screen.getByRole("link", { name: /PSNProfiles guides/ });
    expect(pyx).toHaveAttribute("href", "https://pyx.example/x");
    expect(psnp).toHaveAttribute("href", "https://psnp.example/y");
    expect(pyx).toHaveAttribute("target", "_blank");
    expect(pyx).toHaveAttribute("rel", "noopener");
  });
});
