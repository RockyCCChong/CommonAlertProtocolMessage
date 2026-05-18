import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { AlertTriangle, CheckCircle2, Code2, FileSearch, History, Rss, Shield, Zap } from "lucide-react";
import { useLocation } from "wouter";

const features = [
  {
    icon: Code2,
    title: "CAP v1.2 Composer",
    desc: "Build fully standards-compliant CAP XML messages with a guided form covering all alert, info, area, and resource fields.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Shield,
    title: "XSD Schema Validation",
    desc: "Every generated message is validated against the official OASIS CAP v1.2 XSD schema with a detailed per-check summary.",
    color: "text-[oklch(0.60_0.17_145)]",
    bg: "bg-[oklch(0.60_0.17_145)]/10",
  },
  {
    icon: FileSearch,
    title: "XML Parser & Interpreter",
    desc: "Paste any raw CAP v1.2 XML and receive a structured, human-readable breakdown of all fields and info blocks.",
    color: "text-[oklch(0.65_0.18_55)]",
    bg: "bg-[oklch(0.65_0.18_55)]/10",
  },
  {
    icon: History,
    title: "Message History",
    desc: "All composed and parsed messages are stored per user with timestamps, severity badges, and full XML access.",
    color: "text-[oklch(0.62_0.19_255)]",
    bg: "bg-[oklch(0.62_0.19_255)]/10",
  },
  {
    icon: Rss,
    title: "Feed Ingestion Pipeline",
    desc: "Stress-test the validator against thousands of real CAP messages from NOAA, GDACS, and custom Atom/RSS feeds.",
    color: "text-[oklch(0.75_0.16_90)]",
    bg: "bg-[oklch(0.75_0.16_90)]/10",
  },
  {
    icon: Zap,
    title: "Production-Grade Engine",
    desc: "Semantic validation, element ordering, datetime formatting, and scope rules — all ported exactly from the OASIS spec.",
    color: "text-[oklch(0.55_0.22_25)]",
    bg: "bg-[oklch(0.55_0.22_25)]/10",
  },
];

const validationChecks = [
  "Well-formed XML",
  "XSD schema valid",
  "Sender present",
  "Expires after sent",
  "Scope rules satisfied",
  "References format valid",
  "Polygon closed ring",
  "Circle radius positive",
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Top nav ── */}
      <nav className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <span className="font-bold tracking-tight text-foreground">CAP Tool Pro</span>
            <span className="text-xs text-muted-foreground ml-1 hidden sm:block">v1.2</span>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <button
                onClick={() => setLocation("/compose")}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Open App
              </button>
            ) : (
              <button
                onClick={() => { window.location.href = getLoginUrl(); }}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="container py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6">
              <Shield className="h-3 w-3" />
              OASIS CAP v1.2 Compliant
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6 text-foreground">
              The Professional<br />
              <span className="text-primary">CAP Alert Toolchain</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl leading-relaxed">
              Compose, validate, parse, and stress-test Common Alerting Protocol v1.2 messages.
              Built for emergency alert professionals and developers who need a reliable,
              standards-compliant CAP toolchain.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              {isAuthenticated ? (
                <button
                  onClick={() => setLocation("/compose")}
                  className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25 hover:shadow-xl"
                >
                  Open Composer →
                </button>
              ) : (
                <button
                  onClick={() => { window.location.href = getLoginUrl(); }}
                  className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25 hover:shadow-xl"
                >
                  Get Started — Sign in →
                </button>
              )}
              <a
                href="https://cap-validator.appspot.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-lg border border-border text-foreground font-semibold hover:bg-accent transition-colors text-center"
              >
                External CAP Validator ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Validation checks strip ── */}
      <section className="border-y border-border bg-card/30 py-6">
        <div className="container">
          <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center">
            {validationChecks.map((check) => (
              <div key={check} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-[oklch(0.60_0.17_145)] shrink-0" />
                {check}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature grid ── */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-3">Everything you need</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              A complete CAP v1.2 toolchain in a single, authenticated web application.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors group"
              >
                <div className={`inline-flex p-2.5 rounded-lg ${f.bg} mb-4`}>
                  <f.icon className={`h-5 w-5 ${f.color}`} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 border-t border-border">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <AlertTriangle className="h-10 w-10 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-3">
              Ready to build compliant CAP alerts?
            </h2>
            <p className="text-muted-foreground mb-8">
              Sign in with your Manus account to access the full toolchain.
            </p>
            {isAuthenticated ? (
              <button
                onClick={() => setLocation("/compose")}
                className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-lg"
              >
                Open the Composer →
              </button>
            ) : (
              <button
                onClick={() => { window.location.href = getLoginUrl(); }}
                className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-lg"
              >
                Sign in with Manus →
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <span>CAP Tool Pro — OASIS CAP v1.2</span>
          </div>
          <a
            href="https://cap-validator.appspot.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            External Validator ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
