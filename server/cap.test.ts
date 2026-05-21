import { describe, it, expect } from "vitest";
import { buildCAPXML } from "./cap/builder";
import { validateCAP } from "./cap/validator";
import { parseCAP } from "./cap/parser";
import type { CAPMessage } from "./cap/types";

// ─── Test fixture ─────────────────────────────────────────────────────────────

const baseMessage: CAPMessage = {
  identifier: "test-001",
  sender: "alerts@test.gov.sg",
  sent: "2026-05-15T08:00:00+00:00",
  status: "Test",
  msgType: "Alert",
  scope: "Public",
  infoBlocks: [
    {
      language: "en-SG",
      category: "Met",
      event: "Thunderstorm Warning",
      urgency: "Immediate",
      severity: "Severe",
      certainty: "Observed",
      headline: "Severe thunderstorm warning for Singapore",
      expires: "2026-05-15T14:00:00+00:00",
      description: "Severe thunderstorms expected.",
      instruction: "Seek shelter immediately.",
      areas: [
        { areaDesc: "Singapore Island", circle: "1.3521,103.8198 30.0" },
      ],
    },
  ],
};

// ─── Builder tests ────────────────────────────────────────────────────────────

describe("CAP XML Builder", () => {
  it("produces valid XML string with correct namespace", () => {
    const xml = buildCAPXML(baseMessage);
    expect(xml).toContain("urn:oasis:names:tc:emergency:cap:1.2");
    expect(xml).toContain("<alert");
    expect(xml).toContain("</alert>");
  });

  it("includes all required alert-level elements", () => {
    const xml = buildCAPXML(baseMessage);
    expect(xml).toContain("<identifier>test-001</identifier>");
    expect(xml).toContain("<sender>alerts@test.gov.sg</sender>");
    expect(xml).toContain("<status>Test</status>");
    expect(xml).toContain("<msgType>Alert</msgType>");
    expect(xml).toContain("<scope>Public</scope>");
  });

  it("includes all required info-level elements", () => {
    const xml = buildCAPXML(baseMessage);
    expect(xml).toContain("<category>Met</category>");
    expect(xml).toContain("<event>Thunderstorm Warning</event>");
    expect(xml).toContain("<urgency>Immediate</urgency>");
    expect(xml).toContain("<severity>Severe</severity>");
    expect(xml).toContain("<certainty>Observed</certainty>");
    expect(xml).toContain("<headline>Severe thunderstorm warning for Singapore</headline>");
  });

  it("includes area and circle elements", () => {
    const xml = buildCAPXML(baseMessage);
    expect(xml).toContain("<areaDesc>Singapore Island</areaDesc>");
    expect(xml).toContain("<circle>1.3521,103.8198 30.0</circle>");
  });

  it("throws on missing sender", () => {
    const bad = { ...baseMessage, sender: "" };
    expect(() => buildCAPXML(bad)).toThrow();
  });

  it("throws when scope is Restricted but restriction is missing", () => {
    const bad = { ...baseMessage, scope: "Restricted" as const, restriction: undefined };
    expect(() => buildCAPXML(bad)).toThrow(/restriction/i);
  });

  it("throws when scope is Private but addresses is missing", () => {
    const bad = { ...baseMessage, scope: "Private" as const, addresses: undefined };
    expect(() => buildCAPXML(bad)).toThrow(/addresses/i);
  });

  it("throws when expires is before sent", () => {
    const bad: CAPMessage = {
      ...baseMessage,
      sent: "2026-05-15T14:00:00+00:00",
      infoBlocks: [
        { ...baseMessage.infoBlocks[0], expires: "2026-05-15T08:00:00+00:00" },
      ],
    };
    expect(() => buildCAPXML(bad)).toThrow(/expires/i);
  });
});

// ─── Validator tests ──────────────────────────────────────────────────────────

describe("CAP XML Validator", () => {
  it("returns valid=true for a well-formed CAP v1.2 message", () => {
    const xml = buildCAPXML(baseMessage);
    const result = validateCAP(xml);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns all 8 checks", () => {
    const xml = buildCAPXML(baseMessage);
    const result = validateCAP(xml);
    expect(result.checks.length).toBeGreaterThanOrEqual(7);
  });

  it("fails on missing namespace", () => {
    const xml = `<?xml version="1.0"?><alert><identifier>x</identifier></alert>`;
    const result = validateCAP(xml);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("fails when expires is before sent", () => {
    const badXml = `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>test-001</identifier>
  <sender>alerts@test.gov.sg</sender>
  <sent>2026-05-15T14:00:00+00:00</sent>
  <status>Test</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <language>en-SG</language>
    <category>Met</category>
    <event>Test</event>
    <urgency>Immediate</urgency>
    <severity>Severe</severity>
    <certainty>Observed</certainty>
    <headline>Test</headline>
    <expires>2026-05-15T08:00:00+00:00</expires>
    <area><areaDesc>Test Area</areaDesc></area>
  </info>
</alert>`;
    const result = validateCAP(badXml);
    const expiresCheck = result.checks.find((c) => c.label === "Expires set and after sent");
    expect(expiresCheck?.passed).toBe(false);
  });

  it("fails on Restricted scope without restriction element", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>test-001</identifier>
  <sender>alerts@test.gov.sg</sender>
  <sent>2026-05-15T08:00:00+00:00</sent>
  <status>Test</status>
  <msgType>Alert</msgType>
  <scope>Restricted</scope>
  <info>
    <language>en-SG</language>
    <category>Met</category>
    <event>Test</event>
    <urgency>Immediate</urgency>
    <severity>Severe</severity>
    <certainty>Observed</certainty>
    <headline>Test</headline>
    <expires>2026-05-15T14:00:00+00:00</expires>
    <area><areaDesc>Test Area</areaDesc></area>
  </info>
</alert>`;
    const result = validateCAP(xml);
    const scopeCheck = result.checks.find((c) => c.label === "Scope rules satisfied");
    expect(scopeCheck?.passed).toBe(false);
  });
});

// ─── Parser tests ─────────────────────────────────────────────────────────────

describe("CAP XML Parser", () => {
  it("round-trips a message through builder → parser", () => {
    const xml = buildCAPXML(baseMessage);
    const parsed = parseCAP(xml);
    expect(parsed.identifier).toBe("test-001");
    expect(parsed.sender).toBe("alerts@test.gov.sg");
    expect(parsed.status).toBe("Test");
    expect(parsed.msgType).toBe("Alert");
    expect(parsed.scope).toBe("Public");
  });

  it("parses info block fields correctly", () => {
    const xml = buildCAPXML(baseMessage);
    const parsed = parseCAP(xml);
    const info = parsed.infoBlocks[0];
    expect(info.category).toBe("Met");
    expect(info.event).toBe("Thunderstorm Warning");
    expect(info.urgency).toBe("Immediate");
    expect(info.severity).toBe("Severe");
    expect(info.certainty).toBe("Observed");
    expect(info.headline).toBe("Severe thunderstorm warning for Singapore");
  });

  it("parses area block correctly", () => {
    const xml = buildCAPXML(baseMessage);
    const parsed = parseCAP(xml);
    const area = parsed.infoBlocks[0].areas[0];
    expect(area.areaDesc).toBe("Singapore Island");
    expect(area.circle).toBe("1.3521,103.8198 30.0");
  });

  it("throws on invalid XML", () => {
    expect(() => parseCAP("not xml at all")).toThrow();
  });

  it("parses optional fields when present", () => {
    const msg: CAPMessage = {
      ...baseMessage,
      restriction: undefined,
      note: "Test note",
      infoBlocks: [
        {
          ...baseMessage.infoBlocks[0],
          senderName: "Test Agency",
          responseType: "Shelter",
          description: "Detailed description",
          instruction: "Take cover",
        },
      ],
    };
    const xml = buildCAPXML(msg);
    const parsed = parseCAP(xml);
    expect(parsed.note).toBe("Test note");
    expect(parsed.infoBlocks[0].senderName).toBe("Test Agency");
    expect(parsed.infoBlocks[0].responseType).toBe("Shelter");
  });
});
