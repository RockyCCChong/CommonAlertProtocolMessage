/**
 * CAP v1.2 XML Parser
 * Parses raw CAP XML into structured CAPMessage objects.
 * Mirrors the Python CAPParser exactly.
 */

import { CAPMessage, CAPInfo, CAPArea, CAPResource } from "./types";
import { validateCAP } from "./validator";

// ─── XML extraction helpers ───────────────────────────────────────────────────

function getText(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return undefined;
  return m[1]
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function getAllBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[0]);
  }
  return results;
}

function getKVBlocks(xml: string, tag: string): Record<string, string> {
  const blocks = getAllBlocks(xml, tag);
  const result: Record<string, string> = {};
  for (const block of blocks) {
    const name = getText(block, "valueName");
    const value = getText(block, "value");
    if (name && value !== undefined) result[name] = value;
  }
  return result;
}

// ─── Sub-parsers ──────────────────────────────────────────────────────────────

function parseArea(areaXml: string): CAPArea {
  const geocodeBlocks = getAllBlocks(areaXml, "geocode");
  const geocode: Record<string, string> = {};
  for (const b of geocodeBlocks) {
    const name = getText(b, "valueName");
    const value = getText(b, "value");
    if (name && value !== undefined) geocode[name] = value;
  }
  const altStr = getText(areaXml, "altitude");
  const ceilStr = getText(areaXml, "ceiling");
  return {
    areaDesc: getText(areaXml, "areaDesc") ?? "",
    polygon: getText(areaXml, "polygon"),
    circle: getText(areaXml, "circle"),
    geocode: Object.keys(geocode).length > 0 ? geocode : undefined,
    altitude: altStr !== undefined ? parseFloat(altStr) : undefined,
    ceiling: ceilStr !== undefined ? parseFloat(ceilStr) : undefined,
  };
}

function parseResource(resXml: string): CAPResource {
  const sizeStr = getText(resXml, "size");
  return {
    resourceDesc: getText(resXml, "resourceDesc") ?? "",
    mimeType: getText(resXml, "mimeType") ?? "",
    uri: getText(resXml, "uri"),
    size: sizeStr !== undefined ? parseInt(sizeStr, 10) : undefined,
    digest: getText(resXml, "digest"),
  };
}

function parseInfo(infoXml: string): CAPInfo {
  const areaXmls = getAllBlocks(infoXml, "area");
  const resourceXmls = getAllBlocks(infoXml, "resource");
  const eventCodes = getKVBlocks(infoXml, "eventCode");
  const parameters = getKVBlocks(infoXml, "parameter");

  return {
    language: getText(infoXml, "language") ?? "en",
    category: (getText(infoXml, "category") ?? "Other") as CAPInfo["category"],
    event: getText(infoXml, "event") ?? "",
    urgency: (getText(infoXml, "urgency") ?? "Unknown") as CAPInfo["urgency"],
    severity: (getText(infoXml, "severity") ?? "Unknown") as CAPInfo["severity"],
    certainty: (getText(infoXml, "certainty") ?? "Unknown") as CAPInfo["certainty"],
    headline: getText(infoXml, "headline") ?? "",
    expires: getText(infoXml, "expires") ?? "",
    description: getText(infoXml, "description"),
    instruction: getText(infoXml, "instruction"),
    effective: getText(infoXml, "effective"),
    onset: getText(infoXml, "onset"),
    senderName: getText(infoXml, "senderName"),
    responseType: getText(infoXml, "responseType") as CAPInfo["responseType"],
    eventCodes: Object.keys(eventCodes).length > 0 ? eventCodes : undefined,
    parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
    areas: areaXmls.map(parseArea),
    resources: resourceXmls.map(parseResource),
  };
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseCAP(xml: string): CAPMessage {
  // Validate first — throws if invalid
  const summary = validateCAP(xml);
  if (!summary.valid) {
    throw new Error(`CAP XML validation failed: ${summary.errors.join("; ")}`);
  }

  const infoXmls = getAllBlocks(xml, "info");

  return {
    identifier: getText(xml, "identifier") ?? "",
    sender: getText(xml, "sender") ?? "",
    sent: getText(xml, "sent") ?? "",
    status: (getText(xml, "status") ?? "Test") as CAPMessage["status"],
    msgType: (getText(xml, "msgType") ?? "Alert") as CAPMessage["msgType"],
    scope: (getText(xml, "scope") ?? "Public") as CAPMessage["scope"],
    restriction: getText(xml, "restriction"),
    addresses: getText(xml, "addresses"),
    note: getText(xml, "note"),
    references: getText(xml, "references"),
    incidents: getText(xml, "incidents"),
    infoBlocks: infoXmls.map(parseInfo),
  };
}
