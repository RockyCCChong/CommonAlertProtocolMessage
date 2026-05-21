/**
 * CAP v1.2 XML Builder
 * Ports the Python CAPXMLBuilder exactly, preserving all semantic validation rules.
 * Uses the built-in Node.js string approach (no lxml equivalent needed in JS —
 * we build a well-formed XML string and validate it against the XSD separately).
 */

import { CAP_NS, CAPMessage, CAPInfo, CAPArea, CAPResource } from "./types";

// ─── Semantic validation ──────────────────────────────────────────────────────

export function validateSemantics(msg: CAPMessage): void {
  if (!msg.sender || msg.sender.trim() === "") {
    throw new Error("sender is required");
  }

  if (msg.msgType === "Alert" && (!msg.infoBlocks || msg.infoBlocks.length === 0)) {
    throw new Error("Alert msgType requires at least one info block");
  }

  for (const info of msg.infoBlocks) {
    if (!info.expires) {
      throw new Error("expires is required in every info block");
    }
    const sentMs = new Date(msg.sent).getTime();
    const expiresMs = new Date(info.expires).getTime();
    if (expiresMs <= sentMs) {
      throw new Error("expires must be after sent");
    }
  }

  if (msg.scope === "Restricted" && (!msg.restriction || msg.restriction.trim() === "")) {
    throw new Error("restriction is required when scope is Restricted");
  }

  if (msg.scope === "Private" && (!msg.addresses || msg.addresses.trim() === "")) {
    throw new Error("addresses is required when scope is Private");
  }

  if (
    (msg.msgType === "Update" || msg.msgType === "Cancel") &&
    (!msg.references || msg.references.trim() === "")
  ) {
    throw new Error("references is required for Update and Cancel messages");
  }

  if (msg.references && msg.references.trim() !== "") {
    const refs = msg.references.trim().split(" ");
    for (const ref of refs) {
      const parts = ref.split(",");
      if (parts.length !== 3) {
        throw new Error(
          "references format must be: sender,identifier,sent (space-separated for multiple)"
        );
      }
    }
  }

  for (const info of msg.infoBlocks) {
    for (const area of info.areas ?? []) {
      if (area.circle) {
        const parts = area.circle.trim().split(" ");
        if (parts.length === 2) {
          const radius = parseFloat(parts[1]);
          if (isNaN(radius) || radius <= 0) {
            throw new Error("circle radius must be a positive number");
          }
        }
      }
      if (area.polygon) {
        const coords = area.polygon.trim().split(" ").filter(Boolean);
        if (coords.length >= 2) {
          const first = coords[0];
          const last = coords[coords.length - 1];
          if (first !== last) {
            throw new Error(
              "polygon must be a closed ring (first and last coordinate must match)"
            );
          }
        }
      }
    }
  }
}

// ─── XML helpers ──────────────────────────────────────────────────────────────

function esc(val: string): string {
  return val
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function el(tag: string, value: string | number | undefined | null, indent = ""): string {
  if (value === undefined || value === null || value === "") return "";
  return `${indent}<${tag}>${esc(String(value))}</${tag}>\n`;
}

function fmtDatetime(iso: string): string {
  // Ensure the datetime has a timezone offset
  const d = new Date(iso);
  // Format as YYYY-MM-DDTHH:MM:SS+00:00
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getUTCFullYear();
  const month = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hour = pad(d.getUTCHours());
  const min = pad(d.getUTCMinutes());
  const sec = pad(d.getUTCSeconds());
  return `${year}-${month}-${day}T${hour}:${min}:${sec}+00:00`;
}

// ─── Area builder ─────────────────────────────────────────────────────────────

function buildArea(area: CAPArea, indent: string): string {
  let s = `${indent}<area>\n`;
  s += el("areaDesc", area.areaDesc, indent + "  ");
  if (area.polygon) s += el("polygon", area.polygon, indent + "  ");
  if (area.circle) s += el("circle", area.circle, indent + "  ");
  if (area.geocode) {
    for (const [name, value] of Object.entries(area.geocode)) {
      s += `${indent}  <geocode>\n`;
      s += el("valueName", name, indent + "    ");
      s += el("value", value, indent + "    ");
      s += `${indent}  </geocode>\n`;
    }
  }
  if (area.altitude !== undefined && area.altitude !== null)
    s += el("altitude", area.altitude, indent + "  ");
  if (area.ceiling !== undefined && area.ceiling !== null)
    s += el("ceiling", area.ceiling, indent + "  ");
  s += `${indent}</area>\n`;
  return s;
}

// ─── Resource builder ─────────────────────────────────────────────────────────

function buildResource(res: CAPResource, indent: string): string {
  let s = `${indent}<resource>\n`;
  s += el("resourceDesc", res.resourceDesc, indent + "  ");
  s += el("mimeType", res.mimeType, indent + "  ");
  if (res.uri) s += el("uri", res.uri, indent + "  ");
  if (res.size !== undefined && res.size !== null)
    s += el("size", res.size, indent + "  ");
  if (res.digest) s += el("digest", res.digest, indent + "  ");
  s += `${indent}</resource>\n`;
  return s;
}

// ─── Info builder ─────────────────────────────────────────────────────────────

function buildInfo(info: CAPInfo, indent: string): string {
  // Element order per XSD sequence:
  // language → category → event → responseType → urgency → severity →
  // certainty → effective → onset → expires → senderName → headline →
  // description → instruction → web → contact → eventCode → parameter →
  // resource → area
  let s = `${indent}<info>\n`;
  s += el("language", info.language, indent + "  ");
  s += el("category", info.category, indent + "  ");
  s += el("event", info.event, indent + "  ");
  if (info.responseType) s += el("responseType", info.responseType, indent + "  ");
  s += el("urgency", info.urgency, indent + "  ");
  s += el("severity", info.severity, indent + "  ");
  s += el("certainty", info.certainty, indent + "  ");
  if (info.effective) s += el("effective", fmtDatetime(info.effective), indent + "  ");
  if (info.onset) s += el("onset", fmtDatetime(info.onset), indent + "  ");
  s += el("expires", fmtDatetime(info.expires), indent + "  ");
  if (info.senderName) s += el("senderName", info.senderName, indent + "  ");
  s += el("headline", info.headline, indent + "  ");
  if (info.description) s += el("description", info.description, indent + "  ");
  if (info.instruction) s += el("instruction", info.instruction, indent + "  ");
  // eventCode blocks
  if (info.eventCodes) {
    for (const [name, value] of Object.entries(info.eventCodes)) {
      s += `${indent}  <eventCode>\n`;
      s += el("valueName", name, indent + "    ");
      s += el("value", value, indent + "    ");
      s += `${indent}  </eventCode>\n`;
    }
  }
  // parameter blocks
  if (info.parameters) {
    for (const [name, value] of Object.entries(info.parameters)) {
      s += `${indent}  <parameter>\n`;
      s += el("valueName", name, indent + "    ");
      s += el("value", value, indent + "    ");
      s += `${indent}  </parameter>\n`;
    }
  }
  for (const res of info.resources ?? []) s += buildResource(res, indent + "  ");
  for (const area of info.areas ?? []) s += buildArea(area, indent + "  ");
  s += `${indent}</info>\n`;
  return s;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildCAPXML(msg: CAPMessage): string {
  // Run semantic validation first — throws on any violation
  validateSemantics(msg);

  // Element order within <alert>:
  // identifier → sender → sent → status → msgType → scope →
  // restriction → addresses → note → references → incidents → info
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<alert xmlns="${CAP_NS}">\n`;
  xml += el("identifier", msg.identifier, "  ");
  xml += el("sender", msg.sender, "  ");
  xml += el("sent", fmtDatetime(msg.sent), "  ");
  xml += el("status", msg.status, "  ");
  xml += el("msgType", msg.msgType, "  ");
  xml += el("scope", msg.scope, "  ");
  if (msg.restriction) xml += el("restriction", msg.restriction, "  ");
  if (msg.addresses) xml += el("addresses", msg.addresses, "  ");
  if (msg.note) xml += el("note", msg.note, "  ");
  if (msg.references) xml += el("references", msg.references, "  ");
  if (msg.incidents) xml += el("incidents", msg.incidents, "  ");
  for (const info of msg.infoBlocks) xml += buildInfo(info, "  ");
  xml += `</alert>\n`;

  return xml;
}
