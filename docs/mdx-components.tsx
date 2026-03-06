import defaultComponents from "fumadocs-ui/mdx";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- MDX component types
type MDXComponents = Record<string, React.ComponentType<any>>;

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    ...components,
  } as MDXComponents;
}
