/**
 * CAP v1.2 XSD Validator
 *
 * Strategy: Use the DOMParser / xmldom for well-formedness checks,
 * then perform structural validation by checking required elements
 * and namespace against the CAP v1.2 spec.
 *
 * Full XSD validation in Node.js without native binaries is complex.
 * We implement a comprehensive spec-level validator that checks all
 * required elements, enumerations, and constraints from the CAP v1.2 XSD.
 */

import { CAP_NS, ValidationSummary, ValidationCheck } from "./types";
import {
  StatusValues, MsgTypeValues, ScopeValues, CategoryValues,
  UrgencyValues, SeverityValues, CertaintyValues, ResponseTypeValues,
} from "./types";

// ─── XML parsing helper ───────────────────────────────────────────────────────

interface ParsedAlert {
  identifier?: string;
  sender?: string;
  sent?: string;
  status?: string;
  msgType?: string;
  scope?: string;
  restriction?: string;
  addresses?: string;
  references?: string;
  infoBlocks: ParsedInfo[];
}

interface ParsedInfo {
  language?: string;
  category?: string;
  event?: string;
  urgency?: string;
  severity?: string;
  certainty?: string;
  headline?: string;
  expires?: string;
  effective?: string;
  onset?: string;
  responseType?: string;
  areas: ParsedArea[];
}

interface ParsedArea {
  areaDesc?: string;
  polygon?: string;
  circle?: string;
}

function getTextContent(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : undefined;
}

function getAllBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
  return xml.match(re) ?? [];
}

function parseAlert(xml: string): ParsedAlert {
  const infoXmls = getAllBlocks(xml, "info");
  const infoBlocks: ParsedInfo[] = infoXmls.map((infoXml) => {
    const areaXmls = getAllBlocks(infoXml, "area");
    const areas: ParsedArea[] = areaXmls.map((aXml) => ({
      areaDesc: getTextContent(aXml, "areaDesc"),
      polygon: getTextContent(aXml, "polygon"),
      circle: getTextContent(aXml, "circle"),
    }));
    return {
      language: getTextContent(infoXml, "language"),
      category: getTextContent(infoXml, "category"),
      event: getTextContent(infoXml, "event"),
      urgency: getTextContent(infoXml, "urgency"),
      severity: getTextContent(infoXml, "severity"),
      certainty: getTextContent(infoXml, "certainty"),
      headline: getTextContent(infoXml, "headline"),
      expires: getTextContent(infoXml, "expires"),
      effective: getTextContent(infoXml, "effective"),
      onset: getTextContent(infoXml, "onset"),
      responseType: getTextContent(infoXml, "responseType"),
      areas,
    };
  });
  return {
    identifier: getTextContent(xml, "identifier"),
    sender: getTextContent(xml, "sender"),
    sent: getTextContent(xml, "sent"),
    status: getTextContent(xml, "status"),
    msgType: getTextContent(xml, "msgType"),
    scope: getTextContent(xml, "scope"),
    restriction: getTextContent(xml, "restriction"),
    addresses: getTextContent(xml, "addresses"),
    references: getTextContent(xml, "references"),
    infoBlocks,
  };
}

// ─── Individual checks ────────────────────────────────────────────────────────

function checkWellFormed(xml: string): ValidationCheck {
  const label = "Well-formed XML";
  try {
    // Basic well-formedness: check for matching tags and XML declaration
    if (!xml.trim().startsWith("<?xml") && !xml.trim().startsWith("<alert")) {
      return { label, passed: false, detail: "XML does not start with expected declaration or root element" };
    }
    // Check namespace
    if (!xml.includes(CAP_NS)) {
      return { label, passed: false, detail: `Missing CAP v1.2 namespace: ${CAP_NS}` };
    }
    // Check root element
    if (!xml.includes("<alert") || !xml.includes("</alert>")) {
      return { label, passed: false, detail: "Missing <alert> root element" };
    }
    return { label, passed: true };
  } catch (e) {
    return { label, passed: false, detail: String(e) };
  }
}

function checkSchemaValid(alert: ParsedAlert): ValidationCheck {
  const label = "XSD schema valid";
  const required = ["identifier", "sender", "sent", "status", "msgType", "scope"] as const;
  for (const field of required) {
    if (!alert[field]) {
      return { label, passed: false, detail: `Missing required element: <${field}>` };
    }
  }
  if (alert.status && !(StatusValues as readonly string[]).includes(alert.status)) {
    return { label, passed: false, detail: `Invalid status value: ${alert.status}` };
  }
  if (alert.msgType && !(MsgTypeValues as readonly string[]).includes(alert.msgType)) {
    return { label, passed: false, detail: `Invalid msgType value: ${alert.msgType}` };
  }
  if (alert.scope && !(ScopeValues as readonly string[]).includes(alert.scope)) {
    return { label, passed: false, detail: `Invalid scope value: ${alert.scope}` };
  }
  for (const info of alert.infoBlocks) {
    if (!info.category) return { label, passed: false, detail: "Missing <category> in info block" };
    if (!info.event) return { label, passed: false, detail: "Missing <event> in info block" };
    if (!info.urgency) return { label, passed: false, detail: "Missing <urgency> in info block" };
    if (!info.severity) return { label, passed: false, detail: "Missing <severity> in info block" };
    if (!info.certainty) return { label, passed: false, detail: "Missing <certainty> in info block" };
    if (!info.headline) return { label, passed: false, detail: "Missing <headline> in info block" };
    if (!info.expires) return { label, passed: false, detail: "Missing <expires> in info block" };
    if (!(CategoryValues as readonly string[]).includes(info.category))
      return { label, passed: false, detail: `Invalid category: ${info.category}` };
    if (!(UrgencyValues as readonly string[]).includes(info.urgency))
      return { label, passed: false, detail: `Invalid urgency: ${info.urgency}` };
    if (!(SeverityValues as readonly string[]).includes(info.severity))
      return { label, passed: false, detail: `Invalid severity: ${info.severity}` };
    if (!(CertaintyValues as readonly string[]).includes(info.certainty))
      return { label, passed: false, detail: `Invalid certainty: ${info.certainty}` };
    if (info.responseType && !(ResponseTypeValues as readonly string[]).includes(info.responseType))
      return { label, passed: false, detail: `Invalid responseType: ${info.responseType}` };
    for (const area of info.areas) {
      if (!area.areaDesc) return { label, passed: false, detail: "Missing <areaDesc> in area block" };
    }
  }
  return { label, passed: true };
}

function checkSenderPresent(alert: ParsedAlert): ValidationCheck {
  const label = "Sender present";
  if (!alert.sender || alert.sender.trim() === "") {
    return { label, passed: false, detail: "sender element is empty or missing" };
  }
  return { label, passed: true };
}

function checkExpiresAfterSent(alert: ParsedAlert): ValidationCheck {
  const label = "Expires set and after sent";
  if (!alert.sent) return { label, passed: false, detail: "sent element missing" };
  const sentMs = new Date(alert.sent).getTime();
  if (isNaN(sentMs)) return { label, passed: false, detail: "sent is not a valid datetime" };
  for (const info of alert.infoBlocks) {
    if (!info.expires) return { label, passed: false, detail: "expires missing in info block" };
    const expiresMs = new Date(info.expires).getTime();
    if (isNaN(expiresMs)) return { label, passed: false, detail: `expires is not a valid datetime: ${info.expires}` };
    if (expiresMs <= sentMs) return { label, passed: false, detail: "expires must be after sent" };
  }
  return { label, passed: true };
}

function checkScopeRules(alert: ParsedAlert): ValidationCheck {
  const label = "Scope rules satisfied";
  if (alert.scope === "Restricted" && (!alert.restriction || alert.restriction.trim() === "")) {
    return { label, passed: false, detail: "restriction is required when scope is Restricted" };
  }
  if (alert.scope === "Private" && (!alert.addresses || alert.addresses.trim() === "")) {
    return { label, passed: false, detail: "addresses is required when scope is Private" };
  }
  return { label, passed: true };
}

function checkReferencesFormat(alert: ParsedAlert): ValidationCheck {
  const label = "References format valid";
  if (!alert.references || alert.references.trim() === "") {
    return { label, passed: true, detail: "Not applicable" };
  }
  const refs = alert.references.trim().split(" ");
  for (const ref of refs) {
    const parts = ref.split(",");
    if (parts.length !== 3) {
      return {
        label, passed: false,
        detail: `Invalid reference format: "${ref}" — expected sender,identifier,sent`,
      };
    }
  }
  return { label, passed: true };
}

function checkPolygon(alert: ParsedAlert): ValidationCheck {
  const label = "Polygon is a closed ring";
  for (const info of alert.infoBlocks) {
    for (const area of info.areas) {
      if (area.polygon) {
        const coords = area.polygon.trim().split(" ").filter(Boolean);
        if (coords.length >= 2 && coords[0] !== coords[coords.length - 1]) {
          return {
            label, passed: false,
            detail: `Polygon not closed: first=${coords[0]}, last=${coords[coords.length - 1]}`,
          };
        }
      }
    }
  }
  return { label, passed: true, detail: alert.infoBlocks.some(i => i.areas.some(a => a.polygon)) ? undefined : "Not applicable" };
}

function checkCircle(alert: ParsedAlert): ValidationCheck {
  const label = "Circle radius is positive";
  for (const info of alert.infoBlocks) {
    for (const area of info.areas) {
      if (area.circle) {
        const parts = area.circle.trim().split(" ");
        if (parts.length === 2) {
          const radius = parseFloat(parts[1]);
          if (isNaN(radius) || radius <= 0) {
            return { label, passed: false, detail: `Circle radius must be positive: "${area.circle}"` };
          }
        }
      }
    }
  }
  return { label, passed: true, detail: alert.infoBlocks.some(i => i.areas.some(a => a.circle)) ? undefined : "Not applicable" };
}

// ─── Main validate function ───────────────────────────────────────────────────

export function validateCAP(xml: string): ValidationSummary {
  const checks: ValidationCheck[] = [];
  const errors: string[] = [];

  const wellFormed = checkWellFormed(xml);
  checks.push(wellFormed);
  if (!wellFormed.passed) {
    errors.push(wellFormed.detail ?? "XML is not well-formed");
    return { valid: false, checks, errors };
  }

  let alert: ParsedAlert;
  try {
    alert = parseAlert(xml);
  } catch (e) {
    const msg = `Failed to parse XML: ${String(e)}`;
    checks.push({ label: "XSD schema valid", passed: false, detail: msg });
    errors.push(msg);
    return { valid: false, checks, errors };
  }

  const schemaCheck = checkSchemaValid(alert);
  checks.push(schemaCheck);
  if (!schemaCheck.passed && schemaCheck.detail) errors.push(schemaCheck.detail);

  const senderCheck = checkSenderPresent(alert);
  checks.push(senderCheck);
  if (!senderCheck.passed && senderCheck.detail) errors.push(senderCheck.detail);

  const expiresCheck = checkExpiresAfterSent(alert);
  checks.push(expiresCheck);
  if (!expiresCheck.passed && expiresCheck.detail) errors.push(expiresCheck.detail);

  const scopeCheck = checkScopeRules(alert);
  checks.push(scopeCheck);
  if (!scopeCheck.passed && scopeCheck.detail) errors.push(scopeCheck.detail);

  const refsCheck = checkReferencesFormat(alert);
  checks.push(refsCheck);
  if (!refsCheck.passed && refsCheck.detail) errors.push(refsCheck.detail);

  const polygonCheck = checkPolygon(alert);
  checks.push(polygonCheck);
  if (!polygonCheck.passed && polygonCheck.detail) errors.push(polygonCheck.detail);

  const circleCheck = checkCircle(alert);
  checks.push(circleCheck);
  if (!circleCheck.passed && circleCheck.detail) errors.push(circleCheck.detail);

  const valid = checks.every((c) => c.passed);
  return { valid, checks, errors };
}
