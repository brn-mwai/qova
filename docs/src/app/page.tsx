import Link from "next/link";

const cards = [
  {
    title: "Get Started",
    description: "Install the SDK, register your first agent, and query a score in under 5 minutes.",
    href: "/docs/get-started",
    icon: "->",
  },
  {
    title: "SDK Reference",
    description: "TypeScript SDK for querying agent scores, recording transactions, and managing budgets.",
    href: "/docs/sdk",
    icon: "{}",
  },
  {
    title: "REST API",
    description: "21 endpoints for programmatic access to scores, transactions, budgets, and verification.",
    href: "/docs/api",
    icon: "//",
  },
  {
    title: "Smart Contracts",
    description: "On-chain reputation registry, transaction validator, and budget enforcer on Base L2.",
    href: "/docs/contracts",
    icon: "0x",
  },
  {
    title: "Chainlink CRE",
    description: "4 decentralized scoring workflows running on the Chainlink CRE Network.",
    href: "/docs/cre",
    icon: "<>",
  },
  {
    title: "Dashboard",
    description: "Real-time analytics dashboard with 21+ pages at app.qova.cc.",
    href: "/docs/dashboard",
    icon: "[]",
  },
];

export default function DocsHome(): React.ReactElement {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="mb-16">
          <p className="text-sm font-mono text-yellow-400 mb-3 tracking-wider uppercase">
            Documentation
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Qova Docs
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl">
            Financial trust infrastructure for AI agents. Compute verifiable
            reputation scores from on-chain transaction data using Chainlink CRE,
            then write those scores back on-chain for any protocol to consume.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group block rounded-xl border border-neutral-800 bg-neutral-950 p-6 hover:border-yellow-400/40 hover:bg-neutral-900/50 transition-all"
            >
              <span className="inline-flex items-center justify-center size-10 rounded-lg bg-neutral-800 font-mono text-sm text-yellow-400 mb-4 group-hover:bg-yellow-400/10 transition-colors">
                {card.icon}
              </span>
              <h2 className="text-base font-semibold mb-1.5">{card.title}</h2>
              <p className="text-sm text-neutral-500 leading-relaxed">
                {card.description}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-16 rounded-xl border border-neutral-800 bg-neutral-950 p-6">
          <p className="text-sm text-neutral-400">
            <span className="text-yellow-400 font-medium">Quick links:</span>{" "}
            <a href="https://app.qova.cc" className="underline hover:text-white transition-colors">
              Dashboard
            </a>
            {" / "}
            <a href="https://github.com/brn-mwai/qova" className="underline hover:text-white transition-colors">
              GitHub
            </a>
            {" / "}
            <a href="https://qova.cc" className="underline hover:text-white transition-colors">
              Website
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
