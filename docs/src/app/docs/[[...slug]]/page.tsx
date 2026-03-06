import defaultMdxComponents from "fumadocs-ui/mdx";
import { DocsPage, DocsBody } from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { source } from "@/lib/source";
import type { ReactElement } from "react";

interface DocsPageData {
  title: string;
  description?: string;
  body: ReactElement;
  toc: { depth: number; url: string; title: string }[];
  full?: boolean;
}

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<ReactElement> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const data = page.data as unknown as DocsPageData;
  const MDX = data.body;

  return (
    <DocsPage toc={data.toc} full={data.full}>
      <DocsBody>
        {/* @ts-expect-error -- MDX body component from fumadocs-mdx */}
        <MDX components={{ ...defaultMdxComponents }} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams(): Array<{ slug: string[] }> {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<{ title?: string; description?: string }> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) return {};

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
