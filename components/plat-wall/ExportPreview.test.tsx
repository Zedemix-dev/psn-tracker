// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportPreview } from "@/components/plat-wall/ExportPreview";
import type { PlatQuery } from "@/src/plat-wall/query";

const query: PlatQuery = { year: 2026, platform: "all", sort: "newest", show: ["art"] };
const img = () => document.querySelector(".ov-frame img") as HTMLImageElement;
const dl = () => screen.getByText("Download PNG").closest("a") as HTMLAnchorElement;

afterEach(cleanup);

describe("ExportPreview", () => {
  it("waits while the image is generated", () => {
    render(<ExportPreview query={query} fileName="x.png" onClose={() => {}} />);
    expect(screen.getByText("Generating your image…")).toBeInTheDocument();
    expect(dl()).not.toHaveAttribute("href");
    expect(dl()).toHaveAttribute("aria-disabled", "true");
  });

  it("offers the download once ready", () => {
    render(<ExportPreview query={query} fileName="Zmx969-plat-wall-2026.png" onClose={() => {}} />);
    Object.defineProperty(img(), "naturalWidth", { value: 2896 });
    Object.defineProperty(img(), "naturalHeight", { value: 4560 });
    fireEvent.load(img());
    expect(screen.getByText("2,896 × 4,560 px")).toBeInTheDocument();
    expect(dl()).toHaveAttribute("href", "/api/plat-wall/export?year=2026&download=1");
    expect(dl()).toHaveAttribute("download", "Zmx969-plat-wall-2026.png");
    expect(dl()).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByText("Generating your image…")).toBeNull();
  });

  it("offers a retry on failure", () => {
    render(<ExportPreview query={query} fileName="x.png" onClose={() => {}} />);
    const before = img().getAttribute("src");
    fireEvent.error(img());
    expect(screen.getByText("Couldn't generate the image.")).toBeInTheDocument();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5000);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(img().getAttribute("src")).not.toBe(before);
    expect(screen.getByText("Generating your image…")).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("closes with the button and with Escape", () => {
    const onClose = vi.fn();
    render(<ExportPreview query={query} fileName="x.png" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("locks the page scroll while open", () => {
    const { unmount } = render(<ExportPreview query={query} fileName="x.png" onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
