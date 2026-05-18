import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, Rss, XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PRESET_FEEDS = [
  {
    name: "NOAA NWS CAP Alerts (US)",
    url: "https://alerts.weather.gov/cap/us.php?x=1",
  },
  {
    name: "GDACS Global Alerts",
    url: "https://www.gdacs.org/xml/rss.xml",
  },
  {
    name: "Canada EC Alerts",
    url: "https://dd.weather.gc.ca/alerts/cap/",
  },
];

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function PassRateBar({ pass, total }: { pass: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((pass / total) * 100);
  const color =
    pct >= 90 ? "bg-[oklch(0.60_0.17_145)]" :
    pct >= 60 ? "bg-[oklch(0.75_0.16_90)]" :
    "bg-[oklch(0.55_0.22_25)]";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Pass rate</span>
        <span className="font-semibold text-foreground">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ErrorAccordion({ errors }: { errors: Array<{ identifier: string; error: string }> }) {
  const [open, setOpen] = useState(false);
  if (!errors || errors.length === 0) return null;
  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-destructive/10 transition-colors"
      >
        <span className="font-medium text-destructive">
          {errors.length} error{errors.length !== 1 ? "s" : ""} — click to expand
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-destructive" /> : <ChevronDown className="h-4 w-4 text-destructive" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 max-h-64 overflow-y-auto">
          {errors.map((e, i) => (
            <div key={i} className="rounded-lg bg-card border border-border p-3">
              <p className="text-xs font-mono text-muted-foreground mb-1">{e.identifier}</p>
              <p className="text-xs text-destructive">{e.error}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RunResult({ result }: { result: any }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-foreground">Run Result</h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-2xl font-bold text-foreground">{result.totalCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total</p>
        </div>
        <div className="rounded-lg bg-[oklch(0.60_0.17_145)]/10 p-3">
          <p className="text-2xl font-bold text-[oklch(0.60_0.17_145)]">{result.passCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Passed</p>
        </div>
        <div className="rounded-lg bg-destructive/10 p-3">
          <p className="text-2xl font-bold text-destructive">{result.failCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Failed</p>
        </div>
      </div>
      <PassRateBar pass={result.passCount} total={result.totalCount} />
      {result.totalCount === 0 && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
          No CAP v1.2 messages were found in this feed. The feed may use a different format
          (e.g., links to individual CAP files) or may not be publicly accessible.
          Try the NOAA preset feed or paste a direct Atom feed URL that embeds CAP XML.
        </div>
      )}
      <ErrorAccordion errors={result.errors ?? []} />
    </div>
  );
}

export default function FeedPage() {
  const [feedUrl, setFeedUrl] = useState("");
  const [feedName, setFeedName] = useState("");
  const [runResult, setRunResult] = useState<any>(null);

  const { data: history, refetch: refetchHistory } = trpc.feed.history.useQuery();

  const runMutation = trpc.feed.run.useMutation({
    onSuccess: (data) => {
      setRunResult(data);
      refetchHistory();
      toast.success(`Feed run complete: ${data.passCount}/${data.totalCount} passed`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleRun = () => {
    if (!feedUrl.trim()) { toast.error("Please enter a feed URL"); return; }
    setRunResult(null);
    runMutation.mutate({ feedUrl: feedUrl.trim(), feedName: feedName.trim() || undefined });
  };

  const loadPreset = (preset: { name: string; url: string }) => {
    setFeedUrl(preset.url);
    setFeedName(preset.name);
    setRunResult(null);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Rss className="h-6 w-6 text-primary" />
            Feed Ingestion Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stress-test the CAP v1.2 validator against real-world Atom/RSS feeds from NOAA, GDACS, and custom sources.
          </p>
        </div>

        {/* Preset feeds */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-semibold text-foreground text-sm">Preset Feeds</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PRESET_FEEDS.map((p) => (
              <button
                key={p.url}
                onClick={() => loadPreset(p)}
                className="text-left p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-accent/30 transition-colors"
              >
                <p className="text-xs font-medium text-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.url}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Custom feed form */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-foreground text-sm">Run Feed</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Feed URL</label>
              <input
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                placeholder="https://alerts.weather.gov/cap/us.php?x=1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Feed Name (optional)</label>
              <input
                value={feedName}
                onChange={(e) => setFeedName(e.target.value)}
                placeholder="My Feed"
              />
            </div>
          </div>
          <button
            onClick={handleRun}
            disabled={runMutation.isPending}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {runMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Running feed ingestion…</>
            ) : "Run Feed Ingestion"}
          </button>
          <p className="text-xs text-muted-foreground">
            The pipeline fetches the feed, extracts all embedded CAP v1.2 XML messages, and validates each one.
            Feeds that link to individual CAP files (rather than embedding XML) are noted as empty.
          </p>
        </div>

        {/* Run result */}
        {runResult && <RunResult result={runResult} />}

        {/* History */}
        {history && history.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground text-sm">Run History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Feed</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Pass</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Fail</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((run) => {
                    const pct = run.totalCount === 0 ? 0 : Math.round(((run.passCount ?? 0) / run.totalCount) * 100);
                    return (
                      <tr key={run.id} className="border-b border-border/50 hover:bg-accent/10 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(run.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground max-w-[200px]">
                          <p className="font-medium truncate">{run.feedName ?? "—"}</p>
                          <p className="text-muted-foreground truncate">{run.feedUrl}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-right text-foreground">{run.totalCount}</td>
                        <td className="px-4 py-3 text-xs text-right text-[oklch(0.60_0.17_145)]">{run.passCount ?? 0}</td>
                        <td className="px-4 py-3 text-xs text-right text-destructive">{run.failCount ?? 0}</td>
                        <td className="px-4 py-3 text-xs text-right">
                          <span className={`font-semibold ${pct >= 90 ? "text-[oklch(0.60_0.17_145)]" : pct >= 60 ? "text-[oklch(0.75_0.16_90)]" : "text-destructive"}`}>
                            {pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
