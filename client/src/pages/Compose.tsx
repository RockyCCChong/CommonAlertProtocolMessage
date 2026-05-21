import DashboardLayout from "@/components/DashboardLayout";
import DateTimePicker from "@/components/DateTimePicker";
import MapAreaEditor, { DrawnShape } from "@/components/MapAreaEditor";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ClipboardCopy, ExternalLink,
  Loader2, Map, PlusCircle, Trash2, XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTS = ["Actual", "Exercise", "System", "Test", "Draft"] as const;
const MSGTYPE_OPTS = ["Alert", "Update", "Cancel", "Ack", "Error"] as const;
const SCOPE_OPTS = ["Public", "Restricted", "Private"] as const;
const CATEGORY_OPTS = ["Geo", "Met", "Safety", "Security", "Rescue", "Fire", "Health", "Env", "Transport", "Infra", "CBRNE", "Other"] as const;
const URGENCY_OPTS = ["Immediate", "Expected", "Future", "Past", "Unknown"] as const;
const SEVERITY_OPTS = ["Extreme", "Severe", "Moderate", "Minor", "Unknown"] as const;
const CERTAINTY_OPTS = ["Observed", "Likely", "Possible", "Unlikely", "Unknown"] as const;
const RESPONSE_OPTS = ["", "Shelter", "Evacuate", "Prepare", "Execute", "Avoid", "Monitor", "Assess", "AllClear", "None"] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface AreaForm {
  areaDesc: string;
  /** Drawn shapes from the map editor — each shape carries its CAP-formatted value */
  shapes: DrawnShape[];
}

interface InfoForm {
  language: string; category: string; event: string;
  urgency: string; severity: string; certainty: string;
  headline: string; description: string; instruction: string;
  effective: string; onset: string; expires: string;
  responseType: string; senderName: string;
  areas: AreaForm[];
}

interface AlertForm {
  sender: string; status: string; msgType: string; scope: string;
  restriction: string; addresses: string; references: string; note: string;
}

const defaultArea = (): AreaForm => ({ areaDesc: "", shapes: [] });
const defaultInfo = (): InfoForm => ({
  language: "en-SG", category: "Met", event: "", urgency: "Immediate",
  severity: "Severe", certainty: "Observed", headline: "", description: "",
  instruction: "", effective: "", onset: "", expires: "", responseType: "",
  senderName: "", areas: [],
});
const defaultAlert = (): AlertForm => ({
  sender: "", status: "Actual", msgType: "Alert", scope: "Public",
  restriction: "", addresses: "", references: "", note: "",
});

// ─── Form field helpers ───────────────────────────────────────────────────────

function Field({ label, error, children, required }: {
  label: string; error?: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label>
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
    </div>
  );
}

function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: readonly string[]; placeholder?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ─── Validation summary ───────────────────────────────────────────────────────

function ValidationSummary({ summary }: { summary: any }) {
  if (!summary) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        Validation Summary
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {summary.checks?.map((c: any) => (
          <div key={c.label} className="flex items-start gap-2 text-sm">
            {c.passed ? (
              <CheckCircle2 className="h-4 w-4 text-[oklch(0.60_0.17_145)] shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            )}
            <div>
              <span className={c.passed ? "check-pass" : "check-fail"}>{c.label}</span>
              {c.detail && c.detail !== "Not applicable" && (
                <p className="text-xs text-muted-foreground">{c.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      {summary.valid && (
        <div className="mt-4 pt-4 border-t border-border">
          <a
            href="https://cap-validator.appspot.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Verify externally at cap-validator.appspot.com
          </a>
          <p className="text-xs text-muted-foreground mt-1">
            Copy the XML below and paste it into the external validator to confirm OASIS CAP v1.2 compliance.
          </p>
        </div>
      )}
    </div>
  );
}

function Shield(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

// ─── XML output panel ─────────────────────────────────────────────────────────

function XmlOutput({ xml }: { xml: string }) {
  const copyXml = () => {
    navigator.clipboard.writeText(xml);
    toast.success("XML copied to clipboard");
  };
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium text-foreground">Generated CAP v1.2 XML</span>
        <button
          onClick={copyXml}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-accent transition-colors"
        >
          <ClipboardCopy className="h-3.5 w-3.5" />
          Copy XML
        </button>
      </div>
      <pre className="p-4 text-xs overflow-x-auto max-h-96 rounded-b-xl border-0 bg-transparent text-foreground">
        {xml}
      </pre>
    </div>
  );
}

// ─── Area sub-form (map-based) ────────────────────────────────────────────────

function AreaSubForm({ area, index, onChange, onRemove }: {
  area: AreaForm; index: number;
  onChange: (f: AreaForm) => void; onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground flex items-center gap-2">
          <Map className="h-4 w-4 text-primary" />
          Area {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive transition-colors"
          title="Remove area"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Area description */}
      <Field label="Area Description" required>
        <input
          value={area.areaDesc}
          onChange={(e) => onChange({ ...area, areaDesc: e.target.value })}
          placeholder="e.g. Singapore Island, Northern Region"
        />
      </Field>

      {/* Map editor */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          Draw Area on Map
        </label>
        <MapAreaEditor
          shapes={area.shapes}
          onShapesChange={(shapes) => onChange({ ...area, shapes })}
        />
      </div>

      {/* CAP output preview */}
      {area.shapes.length > 0 && (
        <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            CAP Output Preview
          </p>
          {area.shapes.map((shape) => (
            <div key={shape.id} className="text-xs">
              <span className="text-muted-foreground font-medium">
                {shape.type === "polygon" ? "<polygon>" : "<circle>"}:{" "}
              </span>
              <code className="text-foreground/80 font-mono break-all">
                {shape.capValue}
              </code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Info sub-form ────────────────────────────────────────────────────────────

function InfoSubForm({ info, index, onChange, onRemove, errors }: {
  info: InfoForm; index: number;
  onChange: (f: InfoForm) => void; onRemove: () => void;
  errors: Record<string, string>;
}) {
  const up = (k: keyof InfoForm, v: any) => onChange({ ...info, [k]: v });
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-accent/30 transition-colors rounded-xl"
      >
        <span className="font-semibold text-foreground">Info Block {index + 1}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-muted-foreground hover:text-destructive transition-colors p-1"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Language" required>
              <input value={info.language} onChange={(e) => up("language", e.target.value)} />
            </Field>
            <Field label="Category" required error={errors[`info.${index}.category`]}>
              <Select value={info.category} onChange={(v) => up("category", v)} options={CATEGORY_OPTS} />
            </Field>
            <Field label="Event" required error={errors[`info.${index}.event`]}>
              <input value={info.event} onChange={(e) => up("event", e.target.value)} placeholder="e.g. Severe Thunderstorm Warning" />
            </Field>
            <Field label="Urgency" required>
              <Select value={info.urgency} onChange={(v) => up("urgency", v)} options={URGENCY_OPTS} />
            </Field>
            <Field label="Severity" required>
              <Select value={info.severity} onChange={(v) => up("severity", v)} options={SEVERITY_OPTS} />
            </Field>
            <Field label="Certainty" required>
              <Select value={info.certainty} onChange={(v) => up("certainty", v)} options={CERTAINTY_OPTS} />
            </Field>
            <Field label="Response Type">
              <Select value={info.responseType} onChange={(v) => up("responseType", v)} options={RESPONSE_OPTS} placeholder="None" />
            </Field>
            <Field label="Sender Name">
              <input value={info.senderName} onChange={(e) => up("senderName", e.target.value)} placeholder="e.g. Meteorological Service Singapore" />
            </Field>
          </div>

          <Field label="Headline" required error={errors[`info.${index}.headline`]}>
            <input value={info.headline} onChange={(e) => up("headline", e.target.value)} placeholder="Brief summary of the alert" />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DateTimePicker
              label="Effective"
              value={info.effective}
              onChange={(v) => up("effective", v)}
            />
            <DateTimePicker
              label="Onset"
              value={info.onset}
              onChange={(v) => up("onset", v)}
            />
            <DateTimePicker
              label="Expires"
              required
              value={info.expires}
              onChange={(v) => up("expires", v)}
              error={errors[`info.${index}.expires`]}
            />
          </div>

          <Field label="Description">
            <textarea rows={3} value={info.description} onChange={(e) => up("description", e.target.value)} placeholder="Detailed description of the event" />
          </Field>
          <Field label="Instruction">
            <textarea rows={2} value={info.instruction} onChange={(e) => up("instruction", e.target.value)} placeholder="Recommended actions for the public" />
          </Field>

          {/* Areas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Map className="h-3.5 w-3.5" />
                Alert Areas
              </label>
              <button
                type="button"
                onClick={() => up("areas", [...info.areas, defaultArea()])}
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <PlusCircle className="h-3.5 w-3.5" /> Add Area
              </button>
            </div>
            <div className="space-y-4">
              {info.areas.map((area, ai) => (
                <AreaSubForm
                  key={ai} area={area} index={ai}
                  onChange={(a) => { const arr = [...info.areas]; arr[ai] = a; up("areas", arr); }}
                  onRemove={() => { const arr = info.areas.filter((_, i) => i !== ai); up("areas", arr); }}
                />
              ))}
              {info.areas.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <Map className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-muted-foreground">No areas defined.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click <strong>Add Area</strong> to open the map editor and draw polygons or circles.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Compose page ────────────────────────────────────────────────────────

export default function Compose() {
  const [alert, setAlert] = useState<AlertForm>(defaultAlert());
  const [infos, setInfos] = useState<InfoForm[]>([defaultInfo()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ xml: string; summary: any } | null>(null);

  const compose = trpc.cap.compose.useMutation({
    onSuccess: (data) => {
      setResult({ xml: data.xml, summary: data.summary });
      setErrors({});
      toast.success("CAP message built and validated successfully");
    },
    onError: (err) => {
      toast.error(err.message);
      setErrors({ _global: err.message });
    },
  });

  const upAlert = (k: keyof AlertForm, v: string) => setAlert((a) => ({ ...a, [k]: v }));

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!alert.sender.trim()) errs["sender"] = "Sender is required";
    if (alert.scope === "Restricted" && !alert.restriction.trim())
      errs["restriction"] = "Restriction is required when scope is Restricted";
    if (alert.scope === "Private" && !alert.addresses.trim())
      errs["addresses"] = "Addresses is required when scope is Private";
    if ((alert.msgType === "Update" || alert.msgType === "Cancel") && !alert.references.trim())
      errs["references"] = "References is required for Update and Cancel messages";
    infos.forEach((info, i) => {
      if (!info.event.trim()) errs[`info.${i}.event`] = "Event is required";
      if (!info.headline.trim()) errs[`info.${i}.headline`] = "Headline is required";
      if (!info.expires) errs[`info.${i}.expires`] = "Expires is required";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /**
   * Flatten drawn shapes from each area into the CAP area format.
   * Each DrawnShape produces either a polygon or circle element.
   * Multiple shapes in one area are emitted as separate area entries
   * (CAP allows multiple <area> blocks per info).
   */
  const buildAreaPayload = (area: AreaForm) => {
    if (area.shapes.length === 0) {
      // Area with description only, no geometry
      return [{ areaDesc: area.areaDesc }];
    }
    // One CAP <area> per drawn shape, all sharing the same areaDesc
    return area.shapes.map((shape) => ({
      areaDesc: area.areaDesc || `Area (${shape.type})`,
      polygon: shape.type === "polygon" ? shape.capValue : undefined,
      circle: shape.type === "circle" ? shape.capValue : undefined,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    compose.mutate({
      sender: alert.sender,
      status: alert.status as any,
      msgType: alert.msgType as any,
      scope: alert.scope as any,
      restriction: alert.restriction || undefined,
      addresses: alert.addresses || undefined,
      references: alert.references || undefined,
      note: alert.note || undefined,
      infoBlocks: infos.map((info) => ({
        language: info.language,
        category: info.category as any,
        event: info.event,
        urgency: info.urgency as any,
        severity: info.severity as any,
        certainty: info.certainty as any,
        headline: info.headline,
        expires: info.expires ? new Date(info.expires).toISOString() : "",
        description: info.description || undefined,
        instruction: info.instruction || undefined,
        effective: info.effective ? new Date(info.effective).toISOString() : undefined,
        onset: info.onset ? new Date(info.onset).toISOString() : undefined,
        senderName: info.senderName || undefined,
        responseType: (info.responseType || undefined) as any,
        areas: info.areas
          .filter((a) => a.areaDesc.trim() || a.shapes.length > 0)
          .flatMap(buildAreaPayload),
      })),
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-primary" />
            CAP v1.2 Composer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build a standards-compliant Common Alerting Protocol v1.2 XML message.
            Draw alert areas directly on the map using polygons or circles.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Alert section ── */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold text-foreground border-b border-border pb-3">Alert</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Sender" required error={errors["sender"]}>
                <input value={alert.sender} onChange={(e) => upAlert("sender", e.target.value)}
                  placeholder="e.g. alerts@met.gov.sg" />
              </Field>
              <Field label="Status" required>
                <Select value={alert.status} onChange={(v) => upAlert("status", v)} options={STATUS_OPTS} />
              </Field>
              <Field label="Message Type" required>
                <Select value={alert.msgType} onChange={(v) => upAlert("msgType", v)} options={MSGTYPE_OPTS} />
              </Field>
              <Field label="Scope" required>
                <Select value={alert.scope} onChange={(v) => upAlert("scope", v)} options={SCOPE_OPTS} />
              </Field>

              {alert.scope === "Restricted" && (
                <Field label="Restriction" required error={errors["restriction"]}>
                  <input value={alert.restriction} onChange={(e) => upAlert("restriction", e.target.value)}
                    placeholder="Restriction note" />
                </Field>
              )}

              {alert.scope === "Private" && (
                <Field label="Addresses" required error={errors["addresses"]}>
                  <input value={alert.addresses} onChange={(e) => upAlert("addresses", e.target.value)}
                    placeholder="Space-separated recipient addresses" />
                </Field>
              )}

              {(alert.msgType === "Update" || alert.msgType === "Cancel") && (
                <Field label="References" required error={errors["references"]}>
                  <input value={alert.references} onChange={(e) => upAlert("references", e.target.value)}
                    placeholder="sender,identifier,sent (space-separated for multiple)" />
                </Field>
              )}
            </div>
            <Field label="Note">
              <textarea rows={2} value={alert.note} onChange={(e) => upAlert("note", e.target.value)}
                placeholder="Optional note for this message" />
            </Field>
          </div>

          {/* ── Info blocks ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Info Blocks</h2>
              <button
                type="button"
                onClick={() => setInfos([...infos, defaultInfo()])}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-accent transition-colors"
              >
                <PlusCircle className="h-3.5 w-3.5" /> Add Info Block
              </button>
            </div>
            {infos.map((info, i) => (
              <InfoSubForm
                key={i} info={info} index={i} errors={errors}
                onChange={(f) => { const arr = [...infos]; arr[i] = f; setInfos(arr); }}
                onRemove={() => setInfos(infos.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>

          {/* Global error */}
          {errors["_global"] && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errors["_global"]}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={compose.isPending}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {compose.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Building CAP Message…</>
            ) : (
              "Build CAP Message"
            )}
          </button>
        </form>

        {/* ── Result ── */}
        {result && (
          <div className="space-y-4 pt-2">
            <ValidationSummary summary={result.summary} />
            <XmlOutput xml={result.xml} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
