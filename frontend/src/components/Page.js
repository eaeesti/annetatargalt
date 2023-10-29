import Footer from "./Footer";
import Navbar from "./Navbar";
import Section from "./Section";

export default function Page({ page, global }) {
  return (
    <>
      <Navbar global={global} />
      {page.sections.map((section) => (
        <Section
          key={section.id}
          section={section}
          global={global}
          page={page}
        />
      ))}
      <Footer global={global} />
    </>
  );
}
