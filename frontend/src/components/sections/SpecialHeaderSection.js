import HeaderSection from "./HeaderSection";

export default function SpecialHeaderSection({ data, global, entity }) {
  return (
    <HeaderSection
      data={{
        title: entity.title,
        subtitle: entity.introduction,
        breadcrumbs: [],
      }}
    />
  );
}
