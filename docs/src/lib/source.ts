import { docs } from "@/../.source";
import { loader } from "fumadocs-core/source";
import { createMDXSource } from "fumadocs-mdx";

const mdxSource = createMDXSource(docs.docs, docs.meta);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- version compat between fumadocs-core and fumadocs-mdx
const files = typeof mdxSource.files === "function" ? (mdxSource as any).files() : mdxSource.files;

export const source = loader({
  baseUrl: "/docs",
  source: { files },
});
