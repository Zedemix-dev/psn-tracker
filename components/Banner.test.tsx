// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);
import { Banner } from "@/components/Banner";

describe("Banner", () => {
  it("renders the logo image when given", () => {
    const { container } = render(
      <Banner hasImage logo={{ src: "/media/logo.png", alt: "Some Game" }} />,
    );
    const img = container.querySelector("img.hero-logo");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/media/logo.png");
    expect(img?.getAttribute("alt")).toBe("Some Game");
  });

  it("renders no image without a logo", () => {
    const { container } = render(<Banner hasImage />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows an empty band, without link, when settingsLink is off", () => {
    const { container } = render(<Banner hasImage={false} settingsLink={false} />);
    expect(screen.queryByRole("link", { name: "Choose a banner in Settings" })).toBeNull();
    expect(container.querySelector(".hero")).not.toBeNull();
  });

  it("keeps the settings link when there is no banner", () => {
    render(<Banner hasImage={false} />);
    expect(screen.getByRole("link", { name: "Choose a banner in Settings" })).toBeTruthy();
  });
});
