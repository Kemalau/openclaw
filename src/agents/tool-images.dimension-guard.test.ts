import { beforeEach, describe, expect, it, vi } from "vitest";

const imageOps = vi.hoisted(() => ({
  getImageMetadata: vi.fn<() => Promise<{ width: number; height: number } | null>>(),
  resizeToJpeg: vi.fn<() => Promise<Buffer>>(),
}));

vi.mock("../media/image-ops.js", () => ({
  getImageMetadata: imageOps.getImageMetadata,
  resizeToJpeg: imageOps.resizeToJpeg,
}));

describe("sanitizeContentBlocksImages dimension guard", () => {
  beforeEach(() => {
    imageOps.getImageMetadata.mockReset();
    imageOps.resizeToJpeg.mockReset();
  });

  it("drops image blocks when resized output still exceeds max side", async () => {
    imageOps.getImageMetadata.mockResolvedValue({ width: 3200, height: 2400 });
    imageOps.resizeToJpeg.mockResolvedValue(Buffer.from("jpeg-output"));

    const { sanitizeContentBlocksImages } = await import("./tool-images.js");
    const result = await sanitizeContentBlocksImages(
      [{ type: "image", data: Buffer.from("input").toString("base64"), mimeType: "image/png" }],
      "test",
    );

    expect(imageOps.resizeToJpeg).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("text");
    if (result[0]?.type === "text") {
      expect(result[0].text).toContain("<=2000px per side");
    }
  });

  it("keeps image blocks when resized output is within dimension and size limits", async () => {
    imageOps.getImageMetadata
      .mockResolvedValueOnce({ width: 3200, height: 2400 })
      .mockResolvedValue({ width: 1800, height: 1200 });
    imageOps.resizeToJpeg.mockResolvedValue(Buffer.from("jpeg-output"));

    const { sanitizeContentBlocksImages } = await import("./tool-images.js");
    const result = await sanitizeContentBlocksImages(
      [{ type: "image", data: Buffer.from("input").toString("base64"), mimeType: "image/png" }],
      "test",
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("image");
  });
});
