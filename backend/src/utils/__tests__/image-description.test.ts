import { describe, it, expect } from "vitest";
import { undescribedImages, type Schema } from "../image-description";

const SCHEMAS: Record<string, Schema> = {
  "api::cause.cause": {
    attributes: {
      title: { type: "string" },
      image: { type: "component", component: "elements.image" },
      metadata: { type: "component", component: "meta.metadata" },
      sections: {
        type: "dynamiczone",
        components: ["sections.power-section", "sections.text-section"],
      },
    },
  },
  "sections.power-section": {
    attributes: {
      columns: {
        type: "component",
        component: "elements.power-column",
        repeatable: true,
      },
    },
  },
  "elements.power-column": {
    attributes: {
      title: { type: "string" },
      image: { type: "component", component: "elements.image" },
    },
  },
  "sections.text-section": { attributes: { text: { type: "richtext" } } },
  "meta.metadata": {
    attributes: {
      title: { type: "string" },
      shareImage: { type: "component", component: "elements.image" },
    },
  },
  "elements.image": {
    attributes: {
      file: { type: "media" },
      alt: { type: "text" },
      decorative: { type: "boolean" },
    },
  },
};

const check = (data: unknown) =>
  undescribedImages((uid) => SCHEMAS[uid], "api::cause.cause", data);

describe("undescribedImages", () => {
  it("accepts a described image", () => {
    expect(check({ image: { file: 7, alt: "Cows in a field" } })).toEqual([]);
  });

  it("accepts a decorative image without a description", () => {
    expect(check({ image: { file: 7, alt: "", decorative: true } })).toEqual(
      [],
    );
  });

  it("flags an image with a file but no description", () => {
    expect(check({ image: { file: 7, alt: "  " } })).toEqual(["image"]);
    expect(check({ image: { file: { id: 7 }, decorative: false } })).toEqual([
      "image",
    ]);
  });

  it("leaves an image with no file alone", () => {
    expect(check({ image: { file: null, alt: "" } })).toEqual([]);
  });

  it("finds images inside dynamic zones and repeatable components", () => {
    expect(
      check({
        sections: [
          { __component: "sections.text-section", text: "Hi" },
          {
            __component: "sections.power-section",
            columns: [
              { title: "A", image: { file: 1, alt: "A chart" } },
              { title: "B", image: { file: 2, alt: "" } },
            ],
          },
        ],
      }),
    ).toEqual(["sections.1.columns.1.image"]);
  });

  it("lets a share image go without a description", () => {
    expect(check({ metadata: { shareImage: { file: 3, alt: "" } } })).toEqual(
      [],
    );
  });

  it("only checks what the save contains", () => {
    expect(check({ title: "Renamed" })).toEqual([]);
  });
});
