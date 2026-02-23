import { beforeEach, describe, expect, it, vi } from "vitest";

const imageOps = vi.hoisted(() => ({
  getImageMetadata: vi.fn<() => Promise<{ width: number; height: number } | null>>(),
  resizeToJpeg: vi.fn<() => Promise<Buffer>>(),
}));

vi.mock("../media/image-ops.js", () => ({
  getImageMetadata: imageOps.getImageMetadata,
  resizeToJpeg: imageOps.resizeToJpeg,
}));

describe("normalizeBrowserScreenshot dimension guard", () => {
  beforeEach(() => {
    imageOps.getImageMetadata.mockReset();
    imageOps.resizeToJpeg.mockReset();
  });

  it("rejects resized outputs that still exceed max side", async () => {
    imageOps.getImageMetadata.mockResolvedValue({ width: 3200, height: 2400 });
    imageOps.resizeToJpeg.mockResolvedValue(Buffer.from("jpeg-output"));

    const { normalizeBrowserScreenshot } = await import("./screenshot.js");
    await expect(
      normalizeBrowserScreenshot(Buffer.from("input"), {
        maxSide: 2000,
        maxBytes: 5 * 1024 * 1024,
      }),
    ).rejects.toThrow("<=2000px per side");
  });

  it("accepts resized output when dimensions are within max side", async () => {
    imageOps.getImageMetadata
      .mockResolvedValueOnce({ width: 3200, height: 2400 })
      .mockResolvedValue({ width: 1800, height: 1200 });
    imageOps.resizeToJpeg.mockResolvedValue(Buffer.from("jpeg-output"));

    const { normalizeBrowserScreenshot } = await import("./screenshot.js");
    const result = await normalizeBrowserScreenshot(Buffer.from("input"), {
      maxSide: 2000,
      maxBytes: 5 * 1024 * 1024,
    });

    expect(result.contentType).toBe("image/jpeg");
  });
});
