"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { motion, useInView } from "motion/react";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";

/* ─── Score Counter Hook ─────────────────────────────────────── */

function useCounter(target: number, duration = 2200): number {
  const [value, setValue] = useState(0);
  const started = useRef(false);
  const el = useRef<HTMLDivElement>(null);
  const inView = useInView(el as React.RefObject<Element>, { once: true });

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;
    const t0 = performance.now();
    function tick(now: number): void {
      const t = Math.min((now - t0) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - t, 3)) * target));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [inView, target, duration]);

  return value;
}

/* ─── Reveal wrapper ─────────────────────────────────────────── */

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}): ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
      className={`min-w-0 ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* ─── Mini Score Ring ────────────────────────────────────────── */

const CIRC = 2 * Math.PI * 45;

function MiniRing({ score, size = 44 }: { score: number; size?: number }): ReactElement {
  const offset = CIRC - (CIRC * score) / 1000;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="45" fill="none" stroke="var(--faint)" strokeWidth="4" />
      <circle
        cx="50" cy="50" r="45" fill="none"
        stroke="var(--fg)" strokeWidth="4" strokeLinecap="round"
        strokeDasharray={CIRC} strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
      />
    </svg>
  );
}

/* ─── Dashboard Mockup ───────────────────────────────────────── */

function DashboardMockup(): ReactElement {
  const agents = [
    { name: "payment-agent.eth", addr: "0x742d...bD18", score: 967, grade: "AAA", txns: 1284 },
    { name: "defi-router.eth", addr: "0x8f3a...c901", score: 843, grade: "AA", txns: 856 },
    { name: "nft-minter.eth", addr: "0x1b5e...7f22", score: 712, grade: "A", txns: 423 },
    { name: "swap-bot.eth", addr: "0xd4c8...e310", score: 534, grade: "BBB", txns: 197 },
  ];

  return (
    <div className="border border-[var(--border)] bg-[var(--surface)] overflow-hidden min-w-0">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-[var(--border)] bg-[var(--faint)]">
        <span className="w-2 h-2 rounded-full bg-[var(--dim)]" />
        <span className="w-2 h-2 rounded-full bg-[var(--dim)]" />
        <span className="w-2 h-2 rounded-full bg-[var(--dim)]" />
        <div className="flex-1 mx-4 sm:mx-8">
          <div className="bg-[var(--surface)] px-3 py-1 text-[10px] text-[var(--dim)] max-w-[240px] mx-auto text-center" style={{ fontFamily: "var(--font-mono)" }}>
            app.qova.cc
          </div>
        </div>
      </div>

      <div className="flex min-h-[260px] sm:min-h-[320px]">
        {/* Sidebar */}
        <div className="w-[140px] border-r border-[var(--border)] py-3 px-3 shrink-0 hidden sm:block">
          <div className="flex items-center gap-1.5 mb-5 px-1">
            <Image src="/qova-logo-banner.svg" alt="" width={48} height={15} className="opacity-60 logo-auto" />
          </div>
          {["Overview", "Agents", "Scores", "Transactions", "CRE", "Settings"].map((item, i) => (
            <div
              key={item}
              className={`text-[11px] px-2 py-1.5 mb-0.5 ${i === 1 ? "bg-[var(--faint)] text-[var(--fg)]" : "text-[var(--dim)]"}`}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {item}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-3 sm:p-4 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <div className="text-[11px] sm:text-xs font-medium">Registered Agents</div>
              <div className="text-[9px] sm:text-[10px] text-[var(--dim)]" style={{ fontFamily: "var(--font-mono)" }}>4 agents on Base L2</div>
            </div>
            <div className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-1 border border-[var(--border)] text-[var(--dim)]" style={{ fontFamily: "var(--font-mono)" }}>
              + Register
            </div>
          </div>

          {/* Agent rows */}
          <div className="border border-[var(--border)]">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_44px_38px] sm:grid-cols-[1fr_60px_50px_60px] gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 border-b border-[var(--border)] text-[8px] sm:text-[9px] uppercase tracking-wider text-[var(--dim)]" style={{ fontFamily: "var(--font-mono)" }}>
              <span>Agent</span>
              <span className="text-right">Score</span>
              <span className="text-center">Grade</span>
              <span className="text-right hidden sm:block">Txns</span>
            </div>
            {agents.map((a) => (
              <div key={a.addr} className="grid grid-cols-[1fr_44px_38px] sm:grid-cols-[1fr_60px_50px_60px] gap-1 sm:gap-2 items-center px-2 sm:px-3 py-1.5 sm:py-2 border-b border-[var(--border)] last:border-b-0">
                <div className="min-w-0">
                  <div className="text-[10px] sm:text-[11px] font-medium truncate">{a.name}</div>
                  <div className="text-[8px] sm:text-[9px] text-[var(--dim)] truncate" style={{ fontFamily: "var(--font-mono)" }}>{a.addr}</div>
                </div>
                <div className="text-[10px] sm:text-[11px] font-medium text-right" style={{ fontFamily: "var(--font-mono)" }}>{a.score}</div>
                <div className="text-center">
                  <span className="text-[8px] sm:text-[9px] font-bold px-1 sm:px-1.5 py-0.5 border border-[var(--border)]" style={{ fontFamily: "var(--font-mono)" }}>
                    {a.grade}
                  </span>
                </div>
                <div className="text-[10px] text-[var(--dim)] text-right hidden sm:block" style={{ fontFamily: "var(--font-mono)" }}>{a.txns}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Terminal Mockup ────────────────────────────────────────── */

function TerminalMockup(): ReactElement {
  return (
    <div className="border border-[var(--border)] bg-[var(--surface)] overflow-hidden min-w-0">
      {/* Terminal chrome */}
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-[var(--border)] bg-[var(--faint)]">
        <span className="w-2 h-2 rounded-full bg-[var(--dim)]" />
        <span className="w-2 h-2 rounded-full bg-[var(--dim)]" />
        <span className="w-2 h-2 rounded-full bg-[var(--dim)]" />
        <span className="ml-3 text-[10px] text-[var(--dim)]" style={{ fontFamily: "var(--font-mono)" }}>Terminal</span>
      </div>

      <pre className="p-3 sm:p-4 text-[10px] sm:text-[11px] leading-[1.9] text-[var(--fg-2)] overflow-x-auto" style={{ fontFamily: "var(--font-mono)" }}>
        <span className="text-[var(--dim)]">$</span> bun add @brnmwai/qova-core{"\n"}
        <span className="text-[var(--dim)]">+ @brnmwai/qova-core@1.0.0</span>{"\n"}
        {"\n"}
        <span className="text-[var(--dim)]">$</span> bun run example.ts{"\n"}
        {"\n"}
        <span className="text-[var(--dim)]">{">"}</span> Connecting to Base L2...{"\n"}
        <span className="text-[var(--dim)]">{">"}</span> Reading ReputationRegistry{"\n"}
        {"\n"}
        <span className="text-[var(--fg)]">Agent</span>    0x742d...bD18{"\n"}
        <span className="text-[var(--fg)]">Score</span>    967{"\n"}
        <span className="text-[var(--fg)]">Grade</span>    AAA{"\n"}
        <span className="text-[var(--fg)]">Status</span>   Registered{"\n"}
        <span className="text-[var(--fg)]">Txns</span>     1,284{"\n"}
        <span className="text-[var(--fg)]">Updated</span>  2 minutes ago{"\n"}
        {"\n"}
        <span className="text-[var(--dim)]">$</span> <span className="animate-pulse">_</span>
      </pre>
    </div>
  );
}

/* ─── Data ───────────────────────────────────────────────────── */

const GRADES = [
  { grade: "AAA", range: "950 - 1000", pct: 100 },
  { grade: "AA",  range: "850 - 949",  pct: 88 },
  { grade: "A",   range: "700 - 849",  pct: 72 },
  { grade: "BBB", range: "550 - 699",  pct: 58 },
  { grade: "BB",  range: "400 - 549",  pct: 44 },
  { grade: "B",   range: "250 - 399",  pct: 30 },
  { grade: "C",   range: "100 - 249",  pct: 18 },
  { grade: "D",   range: "0 - 99",     pct: 6 },
] as const;

const FEATURES = [
  {
    icon: "hn-chart-line",
    title: "On-chain scoring",
    detail: "Reputation computed from real transaction data, stored in smart contracts, verifiable by anyone.",
    meta: "ReputationRegistry.sol",
  },
  {
    icon: "hn-chart-network",
    title: "Chainlink CRE",
    detail: "Automated scoring workflows. Anomaly detection, budget monitoring, compliance checks.",
    meta: "3 active workflows",
  },
  {
    icon: "hn-badge-check",
    title: "World ID",
    detail: "Sybil-resistant identity. Prove the human behind the agent without revealing who.",
    meta: "Orb verification",
  },
  {
    icon: "hn-code",
    title: "TypeScript SDK",
    detail: "Typed functions for reading scores, registering agents, and executing actions. Works with any framework.",
    meta: "@brnmwai/qova-core",
  },
  {
    icon: "hn-analytics",
    title: "Real-time dashboard",
    detail: "Monitor every agent, score, and transaction. Live updates powered by Convex.",
    meta: "app.qova.cc",
  },
  {
    icon: "hn-globe",
    title: "Multi-chain ready",
    detail: "Deployed on Base L2 today. Architecture designed for cross-chain reputation portability.",
    meta: "Base L2 mainnet",
  },
] as const;

/* ─── Page ───────────────────────────────────────────────────── */

export default function Home(): ReactElement {
  const score = useCounter(967);

  return (
    <>
      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)] backdrop-blur-md" style={{ backgroundColor: "color-mix(in srgb, var(--bg) 90%, transparent)" }}>
        <div className="mx-auto max-w-[1200px] flex items-center justify-between px-3 sm:px-6 h-12">
          <a href="/" className="flex items-center shrink-0">
            <Image src="/qova-logo-banner.svg" alt="Qova" width={64} height={20} className="opacity-90 logo-auto sm:w-[80px]" />
          </a>

          <div className="hidden md:flex items-center gap-5 text-[13px] text-[var(--muted)]">
            <a href="#how" className="hover:text-[var(--fg)] transition-colors">How it works</a>
            <a href="#features" className="hover:text-[var(--fg)] transition-colors">Features</a>
            <a href="#integrations" className="hover:text-[var(--fg)] transition-colors">Integrations</a>
            <a href="#sdk" className="hover:text-[var(--fg)] transition-colors">SDK</a>
            <a href="https://docs.qova.cc" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--fg)] transition-colors">
              Docs <i className="hn hn-external-link text-[9px] opacity-40" />
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <a
              href="https://github.com/brn-mwai/qova"
              target="_blank" rel="noopener noreferrer"
              className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
              aria-label="GitHub"
            >
              <i className="hn hn-github text-[15px]" />
            </a>
            <ThemeToggle />
            <a
              href="https://app.qova.cc"
              className="text-[12px] sm:text-[13px] font-medium border border-[var(--fg)] text-[var(--fg)] px-2.5 sm:px-3.5 py-1 hover:bg-[var(--fg)] hover:text-[var(--bg)] transition-all whitespace-nowrap"
            >
              Open App
            </a>
          </div>
        </div>
      </nav>

      <main>
        {/* ── Hero ────────────────────────────────────────── */}
        <section className="pt-24 pb-16 sm:pt-28 sm:pb-20 lg:pt-36 lg:pb-28">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            {/* Text */}
            <div className="max-w-2xl">
              <Reveal>
                <p className="text-[var(--muted)] text-xs sm:text-sm mb-4 sm:mb-5" style={{ fontFamily: "var(--font-mono)" }}>
                  Financial infrastructure for autonomous agents
                </p>
              </Reveal>

              <Reveal delay={0.08}>
                <h1 className="text-[clamp(1.75rem,6vw,3.5rem)] font-semibold leading-[1.08] tracking-[-0.025em]">
                  The credit bureau<br />for AI agents.
                </h1>
              </Reveal>

              <Reveal delay={0.16}>
                <p className="text-[var(--muted)] text-[15px] sm:text-[17px] leading-relaxed mt-5 sm:mt-6 max-w-[520px]">
                  Qova computes verifiable reputation scores from on-chain
                  transaction data. Any protocol can read an agent&apos;s
                  trustworthiness before extending credit, insurance, or access.
                </p>
              </Reveal>

              <Reveal delay={0.24}>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-8">
                  <a
                    href="https://app.qova.cc"
                    className="text-sm font-medium bg-[var(--fg)] text-[var(--bg)] px-5 py-2.5 hover:opacity-85 transition-opacity"
                  >
                    Launch Dashboard
                  </a>
                  <a
                    href="https://docs.qova.cc"
                    className="text-sm font-medium border border-[var(--faint)] text-[var(--muted)] px-5 py-2.5 hover:text-[var(--fg)] hover:border-[var(--dim)] transition-all"
                  >
                    Documentation
                  </a>
                </div>
              </Reveal>
            </div>

            {/* Hero visuals: Dashboard + Terminal */}
            <Reveal delay={0.3} className="min-w-0">
              <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4 mt-10 sm:mt-16 min-w-0">
                <DashboardMockup />
                <TerminalMockup />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Data strip ─────────────────────────────────── */}
        <div className="border-y border-[var(--border)]">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-0 grid grid-cols-2 sm:grid-cols-4 divide-x divide-[var(--border)] [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:sm:border-t-0">
            {[
              { label: "Score range", value: "0 - 1000" },
              { label: "Deployed on", value: "Base L2" },
              { label: "Computation", value: "<100ms" },
              { label: "Verification", value: "On-chain" },
            ].map((item) => (
              <div key={item.label} className="px-4 sm:px-6 py-4">
                <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--dim)] mb-1" style={{ fontFamily: "var(--font-mono)" }}>
                  {item.label}
                </div>
                <div className="text-sm font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Problem ────────────────────────────────────── */}
        <section className="py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <div className="grid lg:grid-cols-[1fr_1fr] gap-10 sm:gap-16 lg:gap-24">
              <Reveal>
                <p className="text-[clamp(1.15rem,3.5vw,1.9rem)] font-medium leading-[1.3] tracking-[-0.015em]">
                  AI agents move capital, execute trades, and manage funds autonomously.
                  <span className="text-[var(--dim)]">
                    {" "}Most have zero verifiable credit history.
                  </span>
                </p>
              </Reveal>

              <div className="grid gap-4 lg:pt-1">
                {[
                  { icon: "hn-times-circle", title: "No credit history", desc: "Every agent interaction is a blind bet. No track record, no accountability, no way to assess risk." },
                  { icon: "hn-eye-cross", title: "Opaque transactions", desc: "Protocols can't distinguish a battle-tested agent from one deployed five minutes ago." },
                  { icon: "hn-unlock", title: "No consequences", desc: "When agents behave maliciously, there is no reputation penalty. Bad actors blend in with good ones." },
                ].map((item, i) => (
                  <Reveal key={item.title} delay={i * 0.08}>
                    <div className="border border-[var(--border)] bg-[var(--surface)] p-5 flex items-start gap-4 hover:border-[var(--dim)] transition-colors">
                      <i className={`hn ${item.icon} text-[var(--dim)] text-base mt-0.5 shrink-0`} />
                      <div>
                        <p className="text-sm font-medium mb-1">{item.title}</p>
                        <p className="text-[13px] text-[var(--muted)] leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Divider />

        {/* ── How it works ───────────────────────────────── */}
        <section className="py-16 sm:py-24 lg:py-32" id="how">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <Reveal>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dim)] mb-12" style={{ fontFamily: "var(--font-mono)" }}>
                How it works
              </p>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  num: "01",
                  title: "Register your agent",
                  body: "One on-chain transaction creates a permanent identity in the ReputationRegistry contract.",
                  code: `client.registerAgent("0x742d...bD18")`,
                  icon: "hn-user-check",
                },
                {
                  num: "02",
                  title: "Execute transactions",
                  body: "Route agent actions through QovaCore. Each transaction is recorded and categorized.",
                  code: `client.executeAgentAction(agent, tx, amt, type)`,
                  icon: "hn-receipt",
                },
                {
                  num: "03",
                  title: "Score is computed",
                  body: "Chainlink CRE workflows analyze patterns and compute scores in real-time.",
                  code: `client.getScore("0x742d...bD18") // 967`,
                  icon: "hn-badge-check",
                },
              ].map((step, i) => (
                <Reveal key={step.num} delay={i * 0.1}>
                  <div className="border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 h-full flex flex-col hover:border-[var(--dim)] transition-colors overflow-hidden">
                    <div className="flex items-center justify-between mb-5">
                      <span className="text-[var(--dim)] text-xs" style={{ fontFamily: "var(--font-mono)" }}>
                        {step.num}
                      </span>
                      <i className={`hn ${step.icon} text-[var(--dim)] text-base`} />
                    </div>
                    <h3 className="text-sm font-medium mb-2">{step.title}</h3>
                    <p className="text-[13px] text-[var(--muted)] leading-relaxed mb-5 flex-1">{step.body}</p>
                    <div className="bg-[var(--faint)] border border-[var(--border)] px-3 py-2 mt-auto overflow-x-auto">
                      <code className="text-[10px] sm:text-[11px] text-[var(--dim)] whitespace-nowrap" style={{ fontFamily: "var(--font-mono)" }}>
                        {step.code}
                      </code>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <Divider />

        {/* ── Features ───────────────────────────────────── */}
        <section className="py-16 sm:py-24 lg:py-32" id="features">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <Reveal>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dim)] mb-3" style={{ fontFamily: "var(--font-mono)" }}>
                Capabilities
              </p>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 className="text-[clamp(1.25rem,4vw,2rem)] font-semibold leading-[1.1] tracking-[-0.02em] mb-8 sm:mb-12">
                Everything you need to<br />build trust infrastructure.
              </h2>
            </Reveal>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={i * 0.06}>
                  <div className="border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 h-full flex flex-col group hover:border-[var(--dim)] transition-colors overflow-hidden">
                    <div className="flex items-center justify-between gap-2 mb-5">
                      <i className={`hn ${f.icon} text-[var(--fg)] text-lg shrink-0`} />
                      <span className="text-[10px] text-[var(--dim)] truncate" style={{ fontFamily: "var(--font-mono)" }}>
                        {f.meta}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium mb-2">{f.title}</h3>
                    <p className="text-[13px] text-[var(--muted)] leading-relaxed">{f.detail}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <Divider />

        {/* ── Score table ────────────────────────────────── */}
        <section className="py-16 sm:py-24 lg:py-32" id="scores">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <div className="grid lg:grid-cols-[1fr_1fr] gap-10 sm:gap-16 lg:gap-24">
              <div>
                <Reveal>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dim)] mb-6" style={{ fontFamily: "var(--font-mono)" }}>
                    Scoring system
                  </p>
                </Reveal>
                <Reveal delay={0.08}>
                  <h2 className="text-[clamp(1.25rem,4vw,2rem)] font-semibold leading-[1.1] tracking-[-0.02em]">
                    Like FICO, but for<br />autonomous agents.
                  </h2>
                </Reveal>
                <Reveal delay={0.16}>
                  <p className="text-[var(--muted)] text-sm sm:text-[15px] leading-relaxed mt-5 sm:mt-6 max-w-md">
                    Scores range from 0 to 1000, computed from transaction volume,
                    frequency, success rate, and behavioral patterns. Eight grades
                    from AAA to D give instant, human-readable risk assessment.
                  </p>
                </Reveal>
                <Reveal delay={0.24}>
                  <div className="grid grid-cols-2 gap-px mt-8 bg-[var(--border)] overflow-hidden">
                    {[
                      { label: "Factors", value: "Volume, frequency, success rate, age" },
                      { label: "Updates", value: "Real-time via Chainlink CRE" },
                      { label: "Storage", value: "On-chain (ReputationRegistry)" },
                      { label: "Access", value: "SDK, API, or direct contract read" },
                    ].map((item) => (
                      <div key={item.label} className="bg-[var(--bg)] p-3 sm:p-4">
                        <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--dim)] mb-1" style={{ fontFamily: "var(--font-mono)" }}>
                          {item.label}
                        </div>
                        <div className="text-xs text-[var(--fg-2)]">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </Reveal>
              </div>

              {/* Grade table */}
              <Reveal delay={0.1}>
                <div className="border border-[var(--border)]">
                  <div className="grid grid-cols-[40px_1fr_70px] sm:grid-cols-[60px_1fr_100px] gap-2 sm:gap-4 px-3 sm:px-5 py-3 border-b border-[var(--border)] text-[10px] uppercase tracking-[0.15em] text-[var(--dim)]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    <span>Grade</span>
                    <span>Distribution</span>
                    <span className="text-right">Range</span>
                  </div>

                  {GRADES.map((g, i) => (
                    <motion.div
                      key={g.grade}
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                      className="grid grid-cols-[40px_1fr_70px] sm:grid-cols-[60px_1fr_100px] gap-2 sm:gap-4 items-center px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[var(--border)] last:border-b-0"
                    >
                      <span
                        className="text-sm font-semibold"
                        style={{
                          fontFamily: "var(--font-mono)",
                          opacity: 0.3 + (g.pct / 100) * 0.7,
                        }}
                      >
                        {g.grade}
                      </span>
                      <div className="h-4 bg-[var(--surface)] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${g.pct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.6, delay: i * 0.05 + 0.2, ease: "easeOut" }}
                          className="h-full bg-[var(--fg)]"
                          style={{ opacity: 0.12 + (g.pct / 100) * 0.18 }}
                        />
                      </div>
                      <span className="text-xs text-[var(--dim)] text-right" style={{ fontFamily: "var(--font-mono)" }}>
                        {g.range}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <Divider />

        {/* ── SDK ────────────────────────────────────────── */}
        <section className="py-16 sm:py-24 lg:py-32" id="sdk">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <div className="grid lg:grid-cols-[380px_1fr] gap-10 sm:gap-16 lg:gap-20">
              <div>
                <Reveal>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dim)] mb-6" style={{ fontFamily: "var(--font-mono)" }}>
                    Developer experience
                  </p>
                </Reveal>
                <Reveal delay={0.08}>
                  <h2 className="text-[clamp(1.25rem,4vw,2rem)] font-semibold leading-[1.1] tracking-[-0.02em]">
                    Ship trust<br />in five lines.
                  </h2>
                </Reveal>
                <Reveal delay={0.16}>
                  <p className="text-[var(--muted)] text-sm sm:text-[15px] leading-relaxed mt-4 sm:mt-5">
                    Typed functions for reading scores, registering agents, and
                    executing actions. Works with any framework. Powered by viem.
                  </p>
                </Reveal>

                <Reveal delay={0.24}>
                  <div className="mt-6 border border-[var(--border)] bg-[var(--surface)] px-3 sm:px-4 py-2.5 inline-block max-w-full overflow-x-auto">
                    <code className="text-[11px] sm:text-xs text-[var(--fg-2)] whitespace-nowrap" style={{ fontFamily: "var(--font-mono)" }}>
                      <span className="text-[var(--dim)]">$</span> bun add @brnmwai/qova-core
                    </code>
                  </div>
                </Reveal>

                <Reveal delay={0.32}>
                  <div className="flex gap-4 mt-8 text-sm">
                    <a href="https://docs.qova.cc" className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors underline underline-offset-4 decoration-[var(--faint)]">
                      Docs
                    </a>
                    <a href="https://github.com/brn-mwai/qova" target="_blank" rel="noopener noreferrer" className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors underline underline-offset-4 decoration-[var(--faint)]">
                      GitHub
                    </a>
                  </div>
                </Reveal>
              </div>

              <Reveal delay={0.12} className="min-w-0">
                <div className="border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[var(--border)]">
                    <span className="w-2 h-2 rounded-full bg-[var(--faint)]" />
                    <span className="w-2 h-2 rounded-full bg-[var(--faint)]" />
                    <span className="w-2 h-2 rounded-full bg-[var(--faint)]" />
                    <span className="ml-3 text-[11px] text-[var(--dim)]" style={{ fontFamily: "var(--font-mono)" }}>
                      example.ts
                    </span>
                  </div>
                  <pre className="p-3 sm:p-5 overflow-x-auto text-[11px] sm:text-[13px] leading-[1.85] text-[var(--fg-2)]" style={{ fontFamily: "var(--font-mono)" }}>
{`import { createQovaClient } from "@brnmwai/qova-core";

// Initialize
const client = createQovaClient({ chain: "base" });

// Read an agent's reputation
const score = await client.getScore("0x742d...bD18");
console.log(score); // 967

// Full agent details
const agent = await client.getAgentDetails(addr);
// { score: 967, isRegistered: true, updateCount: 42 }

// Register a new agent
const txHash = await client.registerAgent(addr);

// Execute an action (register + record + score)
await client.executeAgentAction(
  agent, txHash, amount, TX_TYPE.PAYMENT
);`}
                  </pre>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <Divider />

        {/* ── Badge ──────────────────────────────────────── */}
        <section className="py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-10 sm:gap-16 lg:gap-24">
              <div>
                <Reveal>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dim)] mb-6" style={{ fontFamily: "var(--font-mono)" }}>
                    Embeddable
                  </p>
                </Reveal>
                <Reveal delay={0.08}>
                  <h2 className="text-[clamp(1.25rem,4vw,2rem)] font-semibold leading-[1.1] tracking-[-0.02em]">
                    Trust badges<br />anywhere.
                  </h2>
                </Reveal>
                <Reveal delay={0.16}>
                  <p className="text-[var(--muted)] text-sm sm:text-[15px] leading-relaxed mt-4 sm:mt-5 max-w-md">
                    One URL generates a live SVG badge showing any agent&apos;s current
                    score and grade. Embed in READMEs, protocol UIs, or agent profiles.
                  </p>
                </Reveal>

                <Reveal delay={0.24}>
                  <div className="mt-8 inline-flex items-center border border-[var(--border)] divide-x divide-[var(--border)]">
                    <span className="text-xs text-[var(--muted)] px-3 py-1.5" style={{ fontFamily: "var(--font-mono)" }}>
                      qova score
                    </span>
                    <span className="text-xs font-semibold text-[var(--fg)] px-3 py-1.5 bg-[var(--surface)]" style={{ fontFamily: "var(--font-mono)" }}>
                      AAA 967
                    </span>
                  </div>
                </Reveal>
              </div>

              <Reveal delay={0.12} className="min-w-0">
                <div className="border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[var(--border)]">
                    <span className="w-2 h-2 rounded-full bg-[var(--faint)]" />
                    <span className="w-2 h-2 rounded-full bg-[var(--faint)]" />
                    <span className="w-2 h-2 rounded-full bg-[var(--faint)]" />
                    <span className="ml-3 text-[11px] text-[var(--dim)]" style={{ fontFamily: "var(--font-mono)" }}>
                      README.md
                    </span>
                  </div>
                  <pre className="p-3 sm:p-5 overflow-x-auto text-[11px] sm:text-[13px] leading-[1.85] text-[var(--fg-2)]" style={{ fontFamily: "var(--font-mono)" }}>
{`<!-- Markdown -->
![Qova Score](https://app.qova.cc/api/badge/0x742d...bD18)

<!-- HTML -->
<img
  src="https://app.qova.cc/api/badge/0x742d...bD18"
  alt="Qova Score"
/>`}
                  </pre>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <Divider />

        {/* ── Built on ─────────────────────────────────── */}
        <section className="py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <Reveal>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dim)] mb-12" style={{ fontFamily: "var(--font-mono)" }}>
                Built on
              </p>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 border border-[var(--border)] divide-x divide-y divide-[var(--border)]">
                {([
                  { name: "Base L2", role: "Contracts", logo: "/logos/base.png", href: "https://base.org" },
                  { name: "Chainlink", role: "CRE Automation", logo: "/logos/chainlink.png", href: "https://chain.link" },
                  { name: "SKALE", role: "Zero Gas L3", logo: "/logos/skale.png", href: "https://skale.space" },
                  { name: "Coinbase", role: "Wallets", logo: "/logos/coinbase.png", href: "https://www.coinbase.com" },
                  { name: "World ID", role: "Identity", logo: "/logos/worldid.png", href: "https://worldcoin.org" },
                  { name: "x402", role: "Payments", logo: "/logos/x402-brand.svg", href: "https://www.x402.org" },
                ] as const).map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-4 sm:py-5 hover:bg-[var(--faint)] transition-colors group"
                  >
                    <Image
                      src={item.logo}
                      alt={item.name}
                      width={32}
                      height={32}
                      className="opacity-80 group-hover:opacity-100 transition-opacity object-contain"
                    />
                    <div className="text-center">
                      <div className="text-xs sm:text-sm font-medium mb-0.5" style={{ fontFamily: "var(--font-mono)" }}>
                        {item.name}
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-[var(--dim)]">{item.role}</div>
                    </div>
                  </a>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <Divider />

        {/* ── Integrations ────────────────────────────────── */}
        <section className="py-16 sm:py-24 lg:py-32" id="integrations">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <Reveal>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dim)] mb-3" style={{ fontFamily: "var(--font-mono)" }}>
                Integrations
              </p>
            </Reveal>
            <Reveal delay={0.06}>
              <h2 className="text-[clamp(1.25rem,4vw,2rem)] font-semibold leading-[1.1] tracking-[-0.02em] mb-4">
                How every piece connects.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="text-[var(--muted)] text-sm sm:text-[15px] leading-relaxed max-w-lg">
                Qova combines on-chain contracts, decentralized automation, and real-time infrastructure into a single trust layer for autonomous agents.
              </p>
            </Reveal>

            {/* Stats bar */}
            <Reveal delay={0.14}>
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-6 mb-12 sm:mb-14">
                {[
                  { count: "5", label: "Core" },
                  { count: "1", label: "Connected" },
                  { count: "9", label: "Available" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="text-lg sm:text-xl font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{s.count}</span>
                    <span className="text-[12px] text-[var(--dim)]">{s.label}</span>
                  </div>
                ))}
              </div>
            </Reveal>

            {/* Category labels */}
            <Reveal delay={0.16}>
              <div className="flex flex-wrap gap-2 mb-8">
                {([
                  { label: "Blockchain", count: 3 },
                  { label: "Payment", count: 2 },
                  { label: "Notification", count: 3 },
                  { label: "AI Framework", count: 4 },
                  { label: "Analytics", count: 2 },
                  { label: "Identity", count: 1 },
                ] as const).map((cat) => (
                  <span key={cat.label} className="text-[11px] px-2.5 py-1 border border-[var(--border)] text-[var(--dim)]" style={{ fontFamily: "var(--font-mono)" }}>
                    {cat.label} {cat.count}
                  </span>
                ))}
              </div>
            </Reveal>

            {/* Integration cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {([
                { logo: "/logos/base.png", name: "Base", desc: "Primary L2 network for Qova smart contracts. All agent scores, transactions, and budget enforcement run on Base.", active: "4 contracts deployed on Base Sepolia", cat: "Blockchain", status: "core" as const },
                { logo: "/logos/chainlink.png", name: "Chainlink CRE", desc: "Compute Runtime Environment powers Qova's decentralized scoring. Workflows run across Chainlink oracle nodes to compute agent credit scores.", active: "5 scoring workflows active", cat: "Blockchain", status: "core" as const },
                { logo: "/logos/skale.png", name: "SKALE Base", desc: "SKALE L3 on Base with zero gas fees, instant finality, and encrypted transactions. Pre-paid compute credits replace variable gas costs.", active: "Zero gas, USDC.e native", cat: "Blockchain", status: "core" as const },
                { logo: "/logos/x402-brand.svg", name: "x402 Protocol", desc: "HTTP-native micropayment protocol for agent-to-agent transactions. Every x402 payment is automatically recorded and scored by Qova.", active: "Recording agent payment flows", cat: "Payment", status: "core" as const },
                { logo: "/logos/coinbase.png", name: "Coinbase", desc: "Agent wallet infrastructure via Coinbase Developer Platform. Wallet creation, USDC flows, and balance monitoring are built into Qova.", active: "CDP wallet management active", cat: "Payment", status: "core" as const },
                { logo: "/logos/telegram.png", name: "Telegram", desc: "Receive instant notifications via Telegram bot. Query agent scores, get budget alerts, and monitor CRE executions on mobile.", cat: "Notification", status: "connected" as const },
                { logo: "/logos/slack.png", name: "Slack", desc: "Real-time alerts to Slack channels: score changes, budget warnings, CRE execution results, and verification events.", cat: "Notification", status: "available" as const },
                { logo: "/logos/discord.png", name: "Discord", desc: "Push score updates, budget alerts, and system notifications to Discord channels via webhooks.", cat: "Notification", status: "available" as const },
                { logo: "/logos/openai.png", name: "OpenAI Agents SDK", desc: "Embed Qova trust checks into OpenAI agent pipelines. Gate tool calls, validate counterparties, and log trust decisions.", cat: "AI Framework", status: "available" as const },
                { logo: "/logos/langchain.png", name: "LangChain", desc: "Use Qova as a LangChain tool for trust-gated operations. Connect LangSmith for observability of Qova trust checks in your agent pipelines.", cat: "AI Framework", status: "available" as const },
                { logo: "/logos/vercel.png", name: "Vercel AI SDK", desc: "Add Qova credit checks as tool calls in Vercel AI SDK agent workflows. Connect your Vercel account for deployment-level integration.", cat: "AI Framework", status: "available" as const },
                { logo: "/logos/openclaw.png", name: "OpenClaw", desc: "Open-source AI agent framework with multi-channel Gateway. Connect your OpenClaw agents to Qova for trust-gated autonomous transactions.", cat: "AI Framework", status: "available" as const },
                { logo: "/logos/moltbook.png", name: "Moltbook", desc: "The social network for AI agents. Sync agent identity and reputation data between Moltbook profiles and Qova credit scores.", cat: "Analytics", status: "available" as const },
                { logo: "/logos/dune.png", name: "Dune Analytics", desc: "Export on-chain score data, CRE execution metrics, and transaction volumes to custom Dune dashboards.", cat: "Analytics", status: "available" as const },
                { logo: "/logos/worldid.png", name: "World ID", desc: "Verify agent operators are unique humans via World ID proof of personhood. Boost trust scores for verified identities.", cat: "Identity", status: "available" as const },
              ] as const).map((item, i) => (
                <Reveal key={item.name} delay={Math.min(i * 0.04, 0.4)}>
                  <div className="border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 h-full flex flex-col hover:border-[var(--dim)] transition-colors group">
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <Image
                        src={item.logo}
                        alt={item.name}
                        width={28}
                        height={28}
                        className="opacity-80 group-hover:opacity-100 transition-opacity object-contain shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[var(--dim)]" style={{ fontFamily: "var(--font-mono)" }}>{item.cat}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 border shrink-0 ${
                        item.status === "core"
                          ? "border-[var(--fg)] text-[var(--fg)] opacity-60"
                          : item.status === "connected"
                            ? "border-green-500/40 text-green-500"
                            : "border-[var(--border)] text-[var(--dim)]"
                      }`} style={{ fontFamily: "var(--font-mono)" }}>
                        {item.status === "core" ? "Core" : item.status === "connected" ? "Connected" : "Available"}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-[12px] sm:text-[13px] text-[var(--muted)] leading-relaxed flex-1">{item.desc}</p>

                    {/* Active label for core/connected */}
                    {"active" in item && item.active && (
                      <div className="mt-3 pt-3 border-t border-[var(--border)]">
                        <div className="text-[11px] text-[var(--dim)]" style={{ fontFamily: "var(--font-mono)" }}>
                          {item.active}
                        </div>
                      </div>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <Divider />

        {/* ── CTA ────────────────────────────────────────── */}
        <section className="py-16 sm:py-28 lg:py-40">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <Reveal>
              <h2 className="text-[clamp(1.4rem,5vw,2.6rem)] font-semibold leading-[1.05] tracking-[-0.025em] max-w-2xl">
                Give your agents<br />a credit score.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="text-[var(--muted)] text-[15px] sm:text-[17px] mt-5 sm:mt-6 max-w-md">
                Register, transact, and let Qova handle the trust.
                Verifiable by anyone, updated in real-time.
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-8 sm:mt-10">
                <a
                  href="https://app.qova.cc"
                  className="text-sm font-medium bg-[var(--fg)] text-[var(--bg)] px-6 py-3 hover:opacity-85 transition-opacity"
                >
                  Launch Dashboard
                </a>
                <a
                  href="https://docs.qova.cc"
                  className="text-sm font-medium border border-[var(--faint)] text-[var(--muted)] px-6 py-3 hover:text-[var(--fg)] hover:border-[var(--dim)] transition-all"
                >
                  Read the Docs
                </a>
                <a
                  href="https://github.com/brn-mwai/qova"
                  target="_blank" rel="noopener noreferrer"
                  className="text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors ml-1 sm:ml-2"
                >
                  <i className="hn hn-github text-lg" />
                </a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)]">
        {/* Main footer grid */}
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-10 sm:py-14">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-[1.5fr_1fr_1fr_1fr] gap-8 sm:gap-10 lg:gap-16">
            {/* Brand column */}
            <div className="col-span-2 sm:col-span-4 lg:col-span-1">
              <Image src="/qova-logo-banner.svg" alt="Qova" width={72} height={23} className="logo-auto mb-5 opacity-80" />
              <p className="text-[13px] text-[var(--muted)] leading-relaxed max-w-[260px]">
                Financial trust infrastructure for autonomous AI agents. On-chain reputation scoring on Base L2.
              </p>
              <div className="flex items-center gap-3 mt-5">
                <a href="https://github.com/brn-mwai/qova" target="_blank" rel="noopener noreferrer" className="text-[var(--dim)] hover:text-[var(--fg)] transition-colors" aria-label="GitHub">
                  <i className="hn hn-github text-[15px]" />
                </a>
                <a href="https://x.com/qova_cc" target="_blank" rel="noopener noreferrer" className="text-[var(--dim)] hover:text-[var(--fg)] transition-colors" aria-label="X / Twitter">
                  <i className="hn hn-twitter text-[15px]" />
                </a>
              </div>
            </div>

            {/* Product column */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--dim)] mb-4" style={{ fontFamily: "var(--font-mono)" }}>
                Product
              </p>
              <div className="flex flex-col gap-2.5">
                {([
                  { label: "Dashboard", href: "https://app.qova.cc" },
                  { label: "Score Lookup", href: "https://app.qova.cc" },
                  { label: "API Badge", href: "#badge" },
                  { label: "SDK", href: "#sdk" },
                ] as readonly { label: string; href: string }[]).map((link) => (
                  <a key={link.label} href={link.href} className="text-[13px] text-[var(--muted)] hover:text-[var(--fg)] transition-colors">
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Developers column */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--dim)] mb-4" style={{ fontFamily: "var(--font-mono)" }}>
                Developers
              </p>
              <div className="flex flex-col gap-2.5">
                {([
                  { label: "Documentation", href: "https://docs.qova.cc" },
                  { label: "GitHub", href: "https://github.com/brn-mwai/qova", external: true },
                  { label: "Smart Contracts", href: "https://docs.qova.cc" },
                  { label: "Changelog", href: "https://github.com/brn-mwai/qova/releases", external: true },
                ] as readonly { label: string; href: string; external?: boolean }[]).map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="text-[13px] text-[var(--muted)] hover:text-[var(--fg)] transition-colors inline-flex items-center gap-1"
                  >
                    {link.label}
                    {link.external && <i className="hn hn-external-link text-[8px] opacity-40" />}
                  </a>
                ))}
              </div>
            </div>

            {/* Infrastructure column */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--dim)] mb-4" style={{ fontFamily: "var(--font-mono)" }}>
                Infrastructure
              </p>
              <div className="flex flex-col gap-2.5">
                {([
                  { label: "Base L2", href: "https://base.org", external: true },
                  { label: "Chainlink CRE", href: "https://chain.link", external: true },
                  { label: "SKALE", href: "https://skale.space", external: true },
                  { label: "World ID", href: "https://worldcoin.org", external: true },
                  { label: "Coinbase", href: "https://www.coinbase.com", external: true },
                ] as readonly { label: string; href: string; external?: boolean }[]).map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[13px] text-[var(--muted)] hover:text-[var(--fg)] transition-colors inline-flex items-center gap-1"
                  >
                    {link.label}
                    <i className="hn hn-external-link text-[8px] opacity-40" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[var(--border)]">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-[var(--dim)]" style={{ fontFamily: "var(--font-mono)" }}>
              {new Date().getFullYear()} Qova. Open-source under MIT.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-[var(--dim)]" style={{ fontFamily: "var(--font-mono)" }}>
              <span>Base L2</span>
              <span className="w-px h-3 bg-[var(--border)] hidden sm:block" />
              <span>Chainlink CRE</span>
              <span className="w-px h-3 bg-[var(--border)] hidden sm:block" />
              <span>SKALE</span>
              <span className="w-px h-3 bg-[var(--border)] hidden sm:block" />
              <span>Coinbase</span>
              <span className="w-px h-3 bg-[var(--border)] hidden sm:block" />
              <span>World ID</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

/* ─── Divider ────────────────────────────────────────────────── */

function Divider(): ReactElement {
  return (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
      <div className="h-px bg-[var(--border)]" />
    </div>
  );
}
