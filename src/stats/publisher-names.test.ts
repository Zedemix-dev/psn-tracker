import { describe, expect, it } from "vitest";
import { displayPublisher } from "./publisher-names";

describe("displayPublisher", () => {
  it("shortens a known name", () => expect(displayPublisher("CE EUROPE LIMITED")).toBe("Capcom"));
  it("leaves an unknown name as it is", () => expect(displayPublisher("Supergiant Games")).toBe("Supergiant Games"));
});
