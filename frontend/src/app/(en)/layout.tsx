import RootHtml from "@/components/RootHtml";
import { layoutMetadata } from "@/components/CmsRoute";

export function generateMetadata() {
  return layoutMetadata("en");
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RootHtml locale="en">{children}</RootHtml>;
}
