import RootHtml from "@/components/RootHtml";
import { layoutMetadata } from "@/components/CmsRoute";

export function generateMetadata() {
  return layoutMetadata("et");
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RootHtml locale="et">{children}</RootHtml>;
}
