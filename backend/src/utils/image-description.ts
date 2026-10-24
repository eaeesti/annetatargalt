/**
 * Finding images that are missing a description, in the data a save sends.
 *
 * An image is an `elements.image` component: the file, a description (`alt`),
 * and a `decorative` box for images that add nothing to the text. Strapi can't
 * make the description required only when that box is unticked, so this does.
 */

export const IMAGE_COMPONENT = "elements.image";

/**
 * Image fields whose description may stay empty. A share image's description
 * only becomes the link preview's alt text, which most sites ignore.
 */
const DESCRIPTION_OPTIONAL = new Set(["meta.metadata.shareImage"]);

export interface SchemaAttribute {
  type: string;
  component?: string;
  components?: string[];
  repeatable?: boolean;
}

export interface Schema {
  attributes: Record<string, SchemaAttribute>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function needsDescription(image: Record<string, unknown>): boolean {
  const hasFile = Boolean(image.file);
  const described = typeof image.alt === "string" && image.alt.trim() !== "";
  return hasFile && !described && image.decorative !== true;
}

/**
 * The paths (like "sections.2.columns.0.image") of every image in `data` that
 * has a file but neither a description nor the decorative box ticked. Only
 * walks what `data` contains, so a partial update checks only what it changes.
 */
export function undescribedImages(
  schemaOf: (uid: string) => Schema | undefined,
  uid: string,
  data: unknown,
  path: string[] = [],
): string[] {
  const schema = schemaOf(uid);
  if (!schema || !isRecord(data)) return [];

  const found: string[] = [];
  const visit = (
    componentUid: string,
    value: unknown,
    at: string[],
    field: string,
  ) => {
    if (!isRecord(value)) return;
    if (componentUid === IMAGE_COMPONENT) {
      const optional = DESCRIPTION_OPTIONAL.has(`${uid}.${field}`);
      if (!optional && needsDescription(value)) found.push(at.join("."));
    } else {
      found.push(...undescribedImages(schemaOf, componentUid, value, at));
    }
  };

  for (const [name, attribute] of Object.entries(schema.attributes)) {
    const value = data[name];
    if (value === undefined || value === null) continue;

    if (attribute.type === "component" && attribute.component) {
      const componentUid = attribute.component;
      if (Array.isArray(value)) {
        value.forEach((item, i) =>
          visit(componentUid, item, [...path, name, String(i)], name),
        );
      } else {
        visit(componentUid, value, [...path, name], name);
      }
    } else if (attribute.type === "dynamiczone" && Array.isArray(value)) {
      value.forEach((item, i) => {
        if (isRecord(item) && typeof item.__component === "string") {
          visit(item.__component, item, [...path, name, String(i)], name);
        }
      });
    }
  }
  return found;
}
