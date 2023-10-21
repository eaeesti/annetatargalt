import { strapiSectionNameToReactComponentName } from "@/utils/strapi";

export default function Section({ section, global, entity }) {
  const componentName = strapiSectionNameToReactComponentName(
    section.__component
  );
  const Component = require(`./sections/${componentName}`).default;

  return <Component {...section} global={global} entity={entity} />;
}
