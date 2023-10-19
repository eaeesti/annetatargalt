import { strapiSectionNameToReactComponentName } from "@/utils/strapi";

export default function Section({ section, global }) {
  const componentName = strapiSectionNameToReactComponentName(
    section.__component
  );
  const Component = require(`./sections/${componentName}`).default;

  return <Component data={section} global={global} />;
}
