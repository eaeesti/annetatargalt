import HeaderSection from "./HeaderSection";

export default function SpecialHeaderSection({
  entity,
  descriptionField,
  breadcrumbs,
  global,
}) {
  return (
    <HeaderSection
      title={entity.title}
      subtitle={entity[descriptionField]}
      breadcrumbs={breadcrumbs}
      global={global}
    />
  );
}
