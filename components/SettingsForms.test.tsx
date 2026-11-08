// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BannerForm } from "@/components/SettingsForms";

vi.mock("@/app/(site)/(banner)/settings/actions", () => ({
  resetBanner: vi.fn(),
  saveBannerPosition: vi.fn(),
  saveNpsso: vi.fn(),
  uploadBanner: vi.fn(),
}));

afterEach(cleanup);

describe("BannerForm", () => {
  it("shows the automatic banner and its reset button without a custom banner", () => {
    render(<BannerForm bannerUrl={null} posY={50} auto={{ url: "/media/b.jpg", gameName: "Cyberpunk 2077" }} />);
    expect(screen.getByText("Automatic — last played game (Cyberpunk 2077)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use automatic banner" })).toBeInTheDocument();
    expect(screen.getByLabelText("Visible part")).toBeDisabled();
  });
});
