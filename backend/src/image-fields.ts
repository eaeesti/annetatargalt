/**
 * Images as an `elements.image` component: the file plus a description that
 * belongs to where the image is used, in that language, rather than one
 * description per file in the media library.
 */
import type { Core } from "@strapi/strapi";
import { errors } from "@strapi/utils";
import {
  IMAGE_COMPONENT,
  undescribedImages,
  type Schema,
} from "./utils/image-description";

/** The upload plugin's table linking files to whatever uses them. */
const FILE_LINKS = "files_related_mph";

/** Every content type's and component's schema, by uid. */
function schemas(strapi: Core.Strapi): Map<string, Schema> {
  const models: [string, Schema][] = [
    ...Object.entries(strapi.contentTypes),
    ...Object.entries(strapi.components),
  ];
  return new Map(models);
}

/** Every model and attribute that holds an image component. */
function imageFields(strapi: Core.Strapi): { uid: string; field: string }[] {
  return [...schemas(strapi)].flatMap(([uid, model]) =>
    Object.entries(model.attributes)
      .filter(
        ([, attribute]) =>
          attribute.type === "component" &&
          attribute.component === IMAGE_COMPONENT,
      )
      .map(([field]) => ({ uid, field })),
  );
}

/**
 * Refuses a save with an image that has neither a description nor its
 * decorative box ticked, naming where it is.
 */
export function requireImageDescriptions(strapi: Core.Strapi): void {
  const byUid = schemas(strapi);
  strapi.documents.use(async (context, next) => {
    if (context.action === "create" || context.action === "update") {
      const missing = undescribedImages(
        (uid) => byUid.get(uid),
        context.uid,
        "data" in context.params ? context.params.data : undefined,
      );
      if (missing.length > 0) {
        throw new errors.ValidationError(
          `Describe the image (${missing.join(", ")}), or tick "decorative" if it adds nothing to the text.`,
        );
      }
    }
    return next();
  });
}

/**
 * Turns a field that held a bare media file into an image component holding
 * that file, with the file's media-library description.
 *
 * When a field changes from media to a component, Strapi leaves the old link
 * between the file and the entry in place, under the same field name. Each one
 * becomes a component row, a link from the component to the file, and a link
 * from the entry to the component; the old link is then removed, so this only
 * ever finds what is left to convert. Every database row is handled on its
 * own, so drafts and each language keep their own image. A link to a row that
 * no longer exists is removed rather than converted: Strapi doesn't clean
 * those up when an entry is deleted.
 */
export async function migrateImageFields(strapi: Core.Strapi): Promise<void> {
  const knex = strapi.db.connection;
  const imageTable = strapi.db.metadata.get(IMAGE_COMPONENT).tableName;
  let migrated = 0;
  let orphaned = 0;

  for (const { uid, field } of imageFields(strapi)) {
    const model = strapi.db.metadata.get(uid);
    const attribute = model.attributes[field];
    const joinTable = "joinTable" in attribute ? attribute.joinTable : null;
    if (!joinTable || !("inverseJoinColumn" in joinTable)) continue;

    const legacy: { id: number; file_id: number; related_id: number }[] =
      await knex(FILE_LINKS)
        .where({ related_type: uid, field })
        .select("id", "file_id", "related_id");

    for (const link of legacy) {
      const outcome = await knex.transaction(async (trx) => {
        const entity = joinTable.joinColumn.name;
        const owner = await trx(model.tableName)
          .where({ id: link.related_id })
          .first("id");
        const existing = await trx(joinTable.name)
          .where({ [entity]: link.related_id, field })
          .first();
        if (owner && !existing) {
          const file = await trx("files")
            .where({ id: link.file_id })
            .first("alternative_text");
          const [image] = await trx(imageTable)
            .insert({ alt: file?.alternative_text ?? null, decorative: false })
            .returning("id");
          await trx(FILE_LINKS).insert({
            file_id: link.file_id,
            related_id: image.id,
            related_type: IMAGE_COMPONENT,
            field: "file",
            order: 1,
          });
          await trx(joinTable.name).insert({
            [entity]: link.related_id,
            [joinTable.inverseJoinColumn.name]: image.id,
            component_type: IMAGE_COMPONENT,
            field,
            [joinTable.orderColumnName ?? "order"]: 1,
          });
        }
        await trx(FILE_LINKS).where({ id: link.id }).delete();
        if (!owner) return "orphaned";
        return existing ? "already" : "moved";
      });
      if (outcome === "moved") migrated++;
      if (outcome === "orphaned") orphaned++;
    }
  }

  if (migrated > 0 || orphaned > 0) {
    strapi.log.info(
      `✅ Moved ${migrated} images into image components; removed ${orphaned} links to deleted entries`,
    );
  }
}
