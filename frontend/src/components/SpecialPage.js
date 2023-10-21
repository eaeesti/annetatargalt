import Footer from "./Footer";
import Navbar from "./Navbar";
import Section from "./Section";

export default function SpecialPage({ page, global, entity }) {
  return (
    <>
      <Navbar global={global} />
      <main>
        {page.sections.map((section) => (
          <Section
            key={section.id}
            section={section}
            global={global}
            entity={entity}
          />
        ))}
      </main>
      <Footer global={global} />
    </>
  );
}
