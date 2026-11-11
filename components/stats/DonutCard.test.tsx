// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChartTipProvider } from "@/components/stats/ChartTip";
import { DonutCard } from "@/components/stats/DonutCard";

afterEach(cleanup);

const segments = [
  { label: "PS5", value: 1, color: "#4F8FE8" },
  { label: "PS4", value: 3, color: "#2EAD7F" },
];
const draw = () =>
  render(
    <ChartTipProvider>
      <DonutCard title="Platforms" segments={segments} center="4" caption="Games" unit="games" />
    </ChartTipProvider>,
  );

describe("<DonutCard>", () => {
  it("draws one segment per value and lists each label with its value", () => {
    const { container } = draw();
    expect(container.querySelectorAll("circle.seg")).toHaveLength(2);
    expect(screen.getByText("PS5")).toBeInTheDocument();
    expect(screen.getByText("PS4")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Platforms" })).toBeInTheDocument();
  });

  it("shows the center and the caption", () => {
    const { container } = draw();
    expect(container.querySelector("text.big")).toHaveTextContent("4");
    expect(container.querySelector("text.cap")).toHaveTextContent("Games");
  });

  it("shows the share in the tooltip", () => {
    const { container } = draw();
    fireEvent.pointerMove(container.querySelectorAll("circle.seg")[0], { clientX: 50, clientY: 50 });
    const tip = document.body.querySelector(".st-tip") as HTMLElement;
    expect(tip).toHaveTextContent("PS5");
    expect(tip).toHaveTextContent("25.0%");
  });

  it("draws no segment and no NaN when the total is 0", () => {
    const { container } = render(
      <DonutCard title="Games" segments={[{ label: "a", value: 0, color: "#fff" }]} center="0" caption="Games" unit="games" />,
    );
    expect(container.querySelectorAll("circle.seg")).toHaveLength(0);
    expect(container.innerHTML).not.toContain("NaN");
  });
});
