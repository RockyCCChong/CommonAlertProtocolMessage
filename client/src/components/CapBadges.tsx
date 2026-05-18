import React from "react";

type Severity = "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
type Status = "Actual" | "Exercise" | "System" | "Test" | "Draft";
type MsgType = "Alert" | "Update" | "Cancel" | "Ack" | "Error";

const severityClass: Record<Severity, string> = {
  Extreme: "badge badge-extreme",
  Severe: "badge badge-severe",
  Moderate: "badge badge-moderate",
  Minor: "badge badge-minor",
  Unknown: "badge badge-unknown",
};

const statusClass: Record<Status, string> = {
  Actual: "badge badge-actual",
  Exercise: "badge badge-exercise",
  System: "badge badge-system",
  Test: "badge badge-test",
  Draft: "badge badge-draft",
};

const msgTypeClass: Record<MsgType, string> = {
  Alert: "badge badge-actual",
  Update: "badge badge-system",
  Cancel: "badge badge-severe",
  Ack: "badge badge-minor",
  Error: "badge badge-extreme",
};

export function SeverityBadge({ severity }: { severity: string }) {
  const cls = severityClass[(severity as Severity)] ?? "badge badge-unknown";
  return <span className={cls}>{severity || "—"}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const cls = statusClass[(status as Status)] ?? "badge badge-test";
  return <span className={cls}>{status || "—"}</span>;
}

export function MsgTypeBadge({ msgType }: { msgType: string }) {
  const cls = msgTypeClass[(msgType as MsgType)] ?? "badge badge-test";
  return <span className={cls}>{msgType || "—"}</span>;
}
