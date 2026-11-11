// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveNpsso } from "@/app/(site)/(banner)/settings/actions";
import { BannerForm, NpssoForm, UnobtainableForm } from "@/components/SettingsForms";

vi.mock("@/app/(site)/(banner)/settings/actions", () => ({
  resetBanner: vi.fn(),
  saveBannerPosition: vi.fn(),
  saveNpsso: vi.fn(),
  saveUnobtainableListUrl: vi.fn(),
  uploadBanner: vi.fn(),
}));

afterEach(cleanup);

describe("BannerForm", () => {
  it("frames the automatic banner at 25% whatever the stored position", () => {
    render(<BannerForm bannerUrl={null} posY={80} auto={{ url: "/media/b.jpg", gameName: "Cyberpunk 2077" }} />);
    expect(screen.getByRole("img", { name: "Banner preview" })).toHaveStyle({ backgroundPositionY: "25%" });
  });

  it("shows the automatic banner and its reset button without a custom banner", () => {
    render(<BannerForm bannerUrl={null} posY={50} auto={{ url: "/media/b.jpg", gameName: "Cyberpunk 2077" }} />);
    expect(screen.getByText("Automatic — last played game (Cyberpunk 2077)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use automatic banner" })).toBeInTheDocument();
    expect(screen.getByLabelText("Visible part")).toBeDisabled();
  });
});

describe("UnobtainableForm", () => {
  it("shows the address and Save", () => {
    render(<UnobtainableForm url="https://x.example/list.json" />);
    expect(screen.getByLabelText("List address")).toHaveValue("https://x.example/list.json");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});

describe("NpssoForm", () => {
  const TYPED = "a".repeat(64);

  it("keeps the pasted text after an error", async () => {
    vi.mocked(saveNpsso).mockResolvedValue({ ok: false, message: "Couldn't reach PSN. Try again." });
    render(<NpssoForm />);
    const input = screen.getByLabelText("npsso");
    fireEvent.change(input, { target: { value: TYPED } });
    fireEvent.click(screen.getByRole("button", { name: "Save token" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach PSN. Try again.");
    expect(input).toHaveValue(TYPED);
  });

  it("empties the field after a success", async () => {
    vi.mocked(saveNpsso).mockResolvedValue({ ok: true, message: "Token saved. A sync has started." });
    render(<NpssoForm />);
    const input = screen.getByLabelText("npsso");
    fireEvent.change(input, { target: { value: TYPED } });
    fireEvent.click(screen.getByRole("button", { name: "Save token" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Token saved");
    await waitFor(() => expect(input).toHaveValue(""));
  });
});
