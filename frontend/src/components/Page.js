import Section from "./Section";

export default function Page({ page, global }) {
  return (
    <>
      <nav></nav>
      <main>
        {page.sections.map((section) => (
          <Section key={section.id} section={section} global={global} />
        ))}
      </main>
      <footer></footer>
    </>
  );
}
