/**
 * CAP v1.2 type definitions — mirrors the Python dataclasses in cap_message.py.
 * All enum values use the exact strings defined in the OASIS CAP v1.2 specification.
 */

export const CAP_NS = "urn:oasis:names:tc:emergency:cap:1.2";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const StatusValues = ["Actual", "Exercise", "System", "Test", "Draft"] as const;
export type Status = (typeof StatusValues)[number];

export const MsgTypeValues = ["Alert", "Update", "Cancel", "Ack", "Error"] as const;
export type MsgType = (typeof MsgTypeValues)[number];

export const ScopeValues = ["Public", "Restricted", "Private"] as const;
export type Scope = (typeof ScopeValues)[number];

export const CategoryValues = [
  "Geo", "Met", "Safety", "Security", "Rescue",
  "Fire", "Health", "Env", "Transport", "Infra", "CBRNE", "Other",
] as const;
export type Category = (typeof CategoryValues)[number];

export const UrgencyValues = ["Immediate", "Expected", "Future", "Past", "Unknown"] as const;
export type Urgency = (typeof UrgencyValues)[number];

export const SeverityValues = ["Extreme", "Severe", "Moderate", "Minor", "Unknown"] as const;
export type Severity = (typeof SeverityValues)[number];

export const CertaintyValues = ["Observed", "Likely", "Possible", "Unlikely", "Unknown"] as const;
export type Certainty = (typeof CertaintyValues)[number];

export const ResponseTypeValues = [
  "Shelter", "Evacuate", "Prepare", "Execute", "Avoid",
  "Monitor", "Assess", "AllClear", "None",
] as const;
export type ResponseType = (typeof ResponseTypeValues)[number];

// ─── Data structures ──────────────────────────────────────────────────────────

export interface CAPArea {
  areaDesc: string;
  polygon?: string;
  circle?: string;
  geocode?: Record<string, string>;
  altitude?: number;
  ceiling?: number;
}

export interface CAPResource {
  resourceDesc: string;
  mimeType: string;
  uri?: string;
  size?: number;
  digest?: string;
}

export interface CAPInfo {
  language: string;
  category: Category;
  event: string;
  urgency: Urgency;
  severity: Severity;
  certainty: Certainty;
  headline: string;
  expires: string; // ISO-8601 string
  description?: string;
  instruction?: string;
  effective?: string;
  onset?: string;
  senderName?: string;
  responseType?: ResponseType;
  eventCodes?: Record<string, string>;
  parameters?: Record<string, string>;
  areas?: CAPArea[];
  resources?: CAPResource[];
}

export interface CAPMessage {
  identifier: string;
  sender: string;
  sent: string; // ISO-8601 string
  status: Status;
  msgType: MsgType;
  scope: Scope;
  restriction?: string;
  addresses?: string;
  note?: string;
  references?: string;
  incidents?: string;
  infoBlocks: CAPInfo[];
}

// ─── Validation result ────────────────────────────────────────────────────────

export interface ValidationCheck {
  label: string;
  passed: boolean;
  detail?: string;
}

export interface ValidationSummary {
  valid: boolean;
  checks: ValidationCheck[];
  errors: string[];
}
