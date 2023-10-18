import Head from "next/head";

export default function Page({ page, global }) {
  return (
    <div>
      <h1>{page.name}</h1>
      <h2>{page.metadata.title}</h2>
      <p>{page.metadata.description}</p>
    </div>
  );
}
