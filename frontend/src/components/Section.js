import { strapiSectionNameToReactComponentName } from "@/utils/strapi";

export default function Section({ section, global, entity, page }) {
  const componentName = strapiSectionNameToReactComponentName(
    section.__component
  );
  const Component = require(`./sections/${componentName}`).default;

  return <Component {...section} global={global} entity={entity} page={page} />;
}
