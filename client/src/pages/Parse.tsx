import DashboardLayout from "@/components/DashboardLayout";
import { SeverityBadge, StatusBadge, MsgTypeBadge } from "@/components/CapBadges";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2, ClipboardCopy, ExternalLink, Loader2, Radio, XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>sample-001</identifier>
  <sender>alerts@met.gov.sg</sender>
  <sent>2026-05-15T08:00:00+00:00</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <language>en-SG</language>
    <category>Met</category>
    <event>Severe Thunderstorm Warning</event>
    <urgency>Immediate</urgency>
    <severity>Severe</severity>
    <certainty>Observed</certainty>
    <headline>Severe thunderstorm warning for Singapore</headline>
    <expires>2026-05-15T14:00:00+00:00</expires>
    <description>Severe thunderstorms expected across the island.</description>
    <instruction>Seek shelter immediately. Avoid open areas.</instruction>
    <area>
      <areaDesc>Singapore Island</areaDesc>
      <circle>1.3521,103.8198 30.0</circle>
    </area>
  </info>
</alert>`;

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs font-mono text-muted-foreground w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground break-all">{value}</span>
    </div>
  );
}

function InfoBlock({ info, index }: { info: any; index: number }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-foreground">Info Block {index + 1}</span>
        <SeverityBadge severity={info.severity} />
      </div>
      <FieldRow label="language" value={info.language} />
      <FieldRow label="category" value={info.category} />
      <FieldRow label="event" value={info.event} />
      <FieldRow label="urgency" value={info.urgency} />
      <FieldRow label="severity" value={info.severity} />
      <FieldRow label="certainty" value={info.certainty} />
      <FieldRow label="responseType" value={info.responseType} />
      <FieldRow label="headline" value={info.headline} />
      <FieldRow label="effective" value={info.effective} />
      <FieldRow label="onset" value={info.onset} />
      <FieldRow label="expires" value={info.expires} />
      <FieldRow label="senderName" value={info.senderName} />
      <FieldRow label="description" value={info.description} />
      <FieldRow label="instruction" value={info.instruction} />

      {info.eventCodes && Object.keys(info.eventCodes).length > 0 && (
        <div className="pt-2">
          <p className="text-xs font-mono text-muted-foreground mb-1">eventCodes</p>
          {Object.entries(info.eventCodes).map(([k, v]) => (
            <div key={k} className="text-xs ml-4 text-foreground">{k}: {String(v)}</div>
          ))}
        </div>
      )}
      {info.parameters && Object.keys(info.parameters).length > 0 && (
        <div className="pt-2">
          <p className="text-xs font-mono text-muted-foreground mb-1">parameters</p>
          {Object.entries(info.parameters).map(([k, v]) => (
            <div key={k} className="text-xs ml-4 text-foreground">{k}: {String(v)}</div>
          ))}
        </div>
      )}

      {info.areas?.map((area: any, ai: number) => (
        <div key={ai} className="mt-3 rounded-lg border border-border/50 bg-muted/20 p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">area[{ai}]</p>
          <FieldRow label="areaDesc" value={area.areaDesc} />
          <FieldRow label="circle" value={area.circle} />
          <FieldRow label="polygon" value={area.polygon} />
          {area.altitude !== undefined && <FieldRow label="altitude" value={String(area.altitude)} />}
          {area.ceiling !== undefined && <FieldRow label="ceiling" value={String(area.ceiling)} />}
        </div>
      ))}

      {info.resources?.map((res: any, ri: number) => (
        <div key={ri} className="mt-3 rounded-lg border border-border/50 bg-muted/20 p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">resource[{ri}]</p>
          <FieldRow label="resourceDesc" value={res.resourceDesc} />
          <FieldRow label="mimeType" value={res.mimeType} />
          <FieldRow label="uri" value={res.uri} />
        </div>
      ))}
    </div>
  );
}

function ValidationSummary({ summary }: { summary: any }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Validation</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {summary.checks?.map((c: any) => (
          <div key={c.label} className="flex items-center gap-2 text-xs">
            {c.passed ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-[oklch(0.60_0.17_145)] shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            )}
            <span className={c.passed ? "check-pass" : "check-fail"}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Parse() {
  const [xml, setXml] = useState("");
  const [result, setResult] = useState<{ parsed: any; summary: any } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const parseMutation = trpc.cap.parse.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setParseError(null);
      toast.success("CAP XML parsed successfully");
    },
    onError: (err) => {
      setParseError(err.message);
      setResult(null);
    },
  });

  const handleParse = () => {
    if (!xml.trim()) { toast.error("Please paste CAP XML first"); return; }
    parseMutation.mutate({ xml: xml.trim() });
  };

  const loadSample = () => { setXml(SAMPLE_XML); setResult(null); setParseError(null); };

  const copyXml = () => {
    navigator.clipboard.writeText(xml);
    toast.success("XML copied to clipboard");
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" />
            CAP XML Parser
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Paste raw CAP v1.2 XML to receive a structured, human-readable breakdown of all fields.
          </p>
        </div>

        {/* Input panel */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">CAP v1.2 XML Input</label>
            <div className="flex items-center gap-2">
              <button onClick={loadSample} className="text-xs text-primary hover:text-primary/80 transition-colors">
                Load sample
              </button>
              {xml && (
                <button onClick={copyXml} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ClipboardCopy className="h-3 w-3" /> Copy
                </button>
              )}
            </div>
          </div>
          <textarea
            rows={12}
            value={xml}
            onChange={(e) => setXml(e.target.value)}
            placeholder="Paste your CAP v1.2 XML here…"
            className="font-mono text-xs"
            spellCheck={false}
          />
          <button
            onClick={handleParse}
            disabled={parseMutation.isPending}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {parseMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Parsing…</>
            ) : "Parse CAP XML"}
          </button>
        </div>

        {/* Error */}
        {parseError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Parse failed</p>
                <p className="mt-1 text-xs">{parseError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            <ValidationSummary summary={result.summary} />

            {/* Alert-level fields */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-semibold text-foreground">Alert</h2>
                <StatusBadge status={result.parsed.status} />
                <MsgTypeBadge msgType={result.parsed.msgType} />
              </div>
              <FieldRow label="identifier" value={result.parsed.identifier} />
              <FieldRow label="sender" value={result.parsed.sender} />
              <FieldRow label="sent" value={result.parsed.sent} />
              <FieldRow label="status" value={result.parsed.status} />
              <FieldRow label="msgType" value={result.parsed.msgType} />
              <FieldRow label="scope" value={result.parsed.scope} />
              <FieldRow label="restriction" value={result.parsed.restriction} />
              <FieldRow label="addresses" value={result.parsed.addresses} />
              <FieldRow label="note" value={result.parsed.note} />
              <FieldRow label="references" value={result.parsed.references} />
              <FieldRow label="incidents" value={result.parsed.incidents} />
            </div>

            {/* Info blocks */}
            {result.parsed.infoBlocks?.map((info: any, i: number) => (
              <InfoBlock key={i} info={info} index={i} />
            ))}

            {/* External validator */}
            <div className="rounded-xl border border-border bg-card/50 p-4">
              <a
                href="https://cap-validator.appspot.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Verify externally at cap-validator.appspot.com
              </a>
              <p className="text-xs text-muted-foreground mt-1">
                Copy the XML above and paste it into the external validator to confirm OASIS CAP v1.2 compliance.
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
