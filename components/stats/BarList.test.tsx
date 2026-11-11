// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BarList } from "@/components/stats/BarList";

afterEach(cleanup);

const items = [
  { name: "Square Enix", value: 40 },
  { name: "Capcom", value: 10 },
  { name: "Other (48)", value: 25, other: true },
];

describe("<BarList>", () => {
  it("gives the longest bar the full width and writes each value", () => {
    const { container } = render(<BarList items={items} />);
    const bars = [...container.querySelectorAll<HTMLElement>(".b")];
    // jsdom normalizes "calc((100% - 34px) * 1)" to "calc(100% - 34px)"
    expect(bars[0].style.width).toBe("calc(100% - 34px)");
    expect(bars[1].style.width).toMatch(/0\.25|8\.5px|25%/);
    expect(bars[1].style.width).not.toBe(bars[0].style.width);
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("marks the Other row", () => {
    const { container } = render(<BarList items={items} />);
    const rows = container.querySelectorAll("li");
    expect(rows[2]).toHaveClass("o");
    expect(rows[0]).not.toHaveClass("o");
  });

  it("keeps the whole name in a title attribute", () => {
    render(<BarList items={items} />);
    expect(screen.getByText("Square Enix")).toHaveAttribute("title", "Square Enix");
  });

  it("has no NaN when every value is 0", () => {
    const { container } = render(<BarList items={[{ name: "x", value: 0 }]} />);
    expect(container.innerHTML).not.toContain("NaN");
  });
});
