export function buildMetadata(globalMetadata, pageMetadata) {
  let title = globalMetadata.title;
  if (pageMetadata.title) title = `${pageMetadata.title} • ${title}`;

  const metadata = {
    title,
    description: pageMetadata.description || globalMetadata.description,
  };

  return metadata;
}
