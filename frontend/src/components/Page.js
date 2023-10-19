import Navbar from "./Navbar";
import Section from "./Section";

export default function Page({ page, global }) {
  return (
    <>
      <Navbar global={global} />
      <main>
        {page.sections.map((section) => (
          <Section key={section.id} section={section} global={global} />
        ))}
      </main>
      <footer></footer>
    </>
  );
}
