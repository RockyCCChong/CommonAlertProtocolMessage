import DashboardLayout from "@/components/DashboardLayout";
import { SeverityBadge, StatusBadge, MsgTypeBadge } from "@/components/CapBadges";
import { trpc } from "@/lib/trpc";
import {
  ClipboardCopy, ExternalLink, History as HistoryIcon, Loader2,
  Trash2, X, FileCode2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function DetailModal({ msgId, onClose }: { msgId: number; onClose: () => void }) {
  const { data, isLoading } = trpc.history.get.useQuery({ id: msgId });

  const copyXml = () => {
    if (data?.xml) {
      navigator.clipboard.writeText(data.xml);
      toast.success("XML copied to clipboard");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <FileCode2 className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Message Detail</h2>
            {data && (
              <>
                <StatusBadge status={data.status ?? ""} />
                <MsgTypeBadge msgType={data.msgType ?? ""} />
              </>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {data && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Identifier</p>
                  <p className="text-foreground font-mono text-xs truncate">{data.identifier ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Sender</p>
                  <p className="text-foreground text-xs truncate">{data.sender ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Created</p>
                  <p className="text-foreground text-xs">{formatDate(data.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Severity</p>
                  <SeverityBadge severity={data.severity ?? "Unknown"} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Type</p>
                  <span className="badge badge-system text-xs">{data.type}</span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-xs font-medium text-muted-foreground">CAP v1.2 XML</span>
                  <div className="flex items-center gap-2">
                    <button onClick={copyXml} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-accent transition-colors">
                      <ClipboardCopy className="h-3 w-3" /> Copy
                    </button>
                    <a
                      href="https://cap-validator.appspot.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs hover:bg-accent transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" /> Validate
                    </a>
                  </div>
                </div>
                <pre className="p-4 text-xs overflow-x-auto max-h-64 text-foreground bg-transparent border-0 rounded-b-xl">
                  {data.xml}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { data: messages, isLoading, refetch } = trpc.history.list.useQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const deleteMutation = trpc.history.delete.useMutation({
    onSuccess: () => { toast.success("Message deleted"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <HistoryIcon className="h-6 w-6 text-primary" />
            Message History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All CAP messages composed or parsed in this session.
          </p>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !messages || messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <HistoryIcon className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No messages yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Compose or parse a CAP message to see it here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Timestamp</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Identifier</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Sender</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Severity</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">MsgType</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {messages.map((msg) => (
                    <tr
                      key={msg.id}
                      className="border-b border-border/50 hover:bg-accent/20 transition-colors cursor-pointer"
                      onClick={() => setSelectedId(msg.id)}
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(msg.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${msg.type === "composed" ? "badge-system" : "badge-exercise"}`}>
                          {msg.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground max-w-[140px] truncate">
                        {msg.identifier ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground max-w-[140px] truncate">
                        {msg.sender ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={msg.status ?? ""} />
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={msg.severity ?? "Unknown"} />
                      </td>
                      <td className="px-4 py-3">
                        <MsgTypeBadge msgType={msg.msgType ?? ""} />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => deleteMutation.mutate({ id: msg.id })}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedId !== null && (
        <DetailModal msgId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </DashboardLayout>
  );
}
