import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import Image from "next/image";
import { source } from "@/lib/source";

export default function Layout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: (
          <div className="flex items-center gap-2">
            <Image
              src="/qova-logo-mark.svg"
              alt="Qova"
              width={32}
              height={28}
              className="invert dark:invert-0"
            />
            <span className="font-semibold tracking-tight text-lg leading-none">
              Qova <span className="text-neutral-500 font-normal text-base ml-0.5">docs</span>
            </span>
          </div>
        ),
        url: "/",
      }}
      links={[
        { text: "Dashboard", url: "https://app.qova.cc" },
        { text: "GitHub", url: "https://github.com/brn-mwai/qova" },
      ]}
      sidebar={{
        defaultOpenLevel: 1,
      }}
    >
      {children}
    </DocsLayout>
  );
}
