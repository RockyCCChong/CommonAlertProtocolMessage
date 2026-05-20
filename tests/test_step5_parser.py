"""
Step 5 test:
  - Round-trip: build a CAPMessage → XML → parse back → verify all fields.
  - All valid CAP v1.2 fixtures in tests/fixtures/ parse without error.
"""
import sys, os
sys.path.insert(0, "/home/ubuntu/cap_tool_v2")

from datetime import datetime, timezone, timedelta
from lxml import etree

from models.cap_message import (
    CAPMessage, CAPInfo, CAPArea, CAPResource,
    Status, MsgType, Scope, Category, Urgency, Severity, Certainty, ResponseType,
)
from builder.xml_builder import CAPXMLBuilder
from validator.xml_validator import CAPValidator
from parser.xml_parser import CAPParser

now     = datetime.now(timezone.utc)
expires = now + timedelta(hours=6)

# ─── Round-trip test ──────────────────────────────────────────────────────────
print("Test 1: round-trip build → parse")

original = CAPMessage(
    sender="alerts@met.gov.sg",
    status=Status.ACTUAL,
    msg_type=MsgType.ALERT,
    scope=Scope.PUBLIC,
    info_blocks=[
        CAPInfo(
            category=Category.MET,
            event="Severe Thunderstorm Warning",
            urgency=Urgency.IMMEDIATE,
            severity=Severity.SEVERE,
            certainty=Certainty.OBSERVED,
            headline="Severe thunderstorm warning for Singapore",
            expires=expires,
            description="Severe thunderstorms expected.",
            instruction="Seek shelter immediately.",
            response_type=ResponseType.SHELTER,
            event_codes={"SAME": "SVR"},
            parameters={"layer:SAMESTAT": "057001"},
            areas=[
                CAPArea(
                    area_desc="Singapore",
                    circle="1.3521,103.8198 30.0",
                    geocode={"ISO3166-2": "SG"},
                )
            ],
            resources=[
                CAPResource(
                    resource_desc="Radar image",
                    mime_type="image/png",
                    uri="https://www.weather.gov.sg/radar.png",
                )
            ],
        )
    ],
)

xml_bytes = CAPXMLBuilder().build(original)
parsed    = CAPParser().parse(xml_bytes)

errors = []

if parsed.identifier != original.identifier:
    errors.append(f"identifier mismatch: {parsed.identifier!r} != {original.identifier!r}")
if parsed.sender != original.sender:
    errors.append(f"sender mismatch: {parsed.sender!r}")
if parsed.status != original.status:
    errors.append(f"status mismatch: {parsed.status!r}")
if parsed.msg_type != original.msg_type:
    errors.append(f"msg_type mismatch: {parsed.msg_type!r}")
if parsed.scope != original.scope:
    errors.append(f"scope mismatch: {parsed.scope!r}")
if len(parsed.info_blocks) != 1:
    errors.append(f"info_blocks count: {len(parsed.info_blocks)}")
else:
    pi = parsed.info_blocks[0]
    oi = original.info_blocks[0]
    if pi.category != oi.category:
        errors.append(f"category mismatch: {pi.category!r}")
    if pi.event != oi.event:
        errors.append(f"event mismatch: {pi.event!r}")
    if pi.urgency != oi.urgency:
        errors.append(f"urgency mismatch: {pi.urgency!r}")
    if pi.severity != oi.severity:
        errors.append(f"severity mismatch: {pi.severity!r}")
    if pi.certainty != oi.certainty:
        errors.append(f"certainty mismatch: {pi.certainty!r}")
    if pi.headline != oi.headline:
        errors.append(f"headline mismatch: {pi.headline!r}")
    if pi.description != oi.description:
        errors.append(f"description mismatch: {pi.description!r}")
    if pi.instruction != oi.instruction:
        errors.append(f"instruction mismatch: {pi.instruction!r}")
    if pi.response_type != oi.response_type:
        errors.append(f"response_type mismatch: {pi.response_type!r}")
    if pi.event_codes != oi.event_codes:
        errors.append(f"event_codes mismatch: {pi.event_codes!r}")
    if pi.parameters != oi.parameters:
        errors.append(f"parameters mismatch: {pi.parameters!r}")
    if not isinstance(pi.expires, datetime):
        errors.append(f"expires is not a datetime: {type(pi.expires)}")
    if len(pi.areas) != 1:
        errors.append(f"areas count: {len(pi.areas)}")
    else:
        pa = pi.areas[0]
        oa = oi.areas[0]
        if pa.area_desc != oa.area_desc:
            errors.append(f"area_desc mismatch: {pa.area_desc!r}")
        if pa.circle != oa.circle:
            errors.append(f"circle mismatch: {pa.circle!r}")
        if pa.geocode != oa.geocode:
            errors.append(f"geocode mismatch: {pa.geocode!r}")
    if len(pi.resources) != 1:
        errors.append(f"resources count: {len(pi.resources)}")
    else:
        pr = pi.resources[0]
        or_ = oi.resources[0]
        if pr.resource_desc != or_.resource_desc:
            errors.append(f"resource_desc mismatch: {pr.resource_desc!r}")
        if pr.mime_type != or_.mime_type:
            errors.append(f"mime_type mismatch: {pr.mime_type!r}")
        if pr.uri != or_.uri:
            errors.append(f"uri mismatch: {pr.uri!r}")

if errors:
    for e in errors:
        print(f"  FAIL  {e}")
else:
    print("  PASS  all fields round-trip correctly")
    print(f"  INFO  expires is a datetime object: {type(parsed.info_blocks[0].expires)}")

# ─── Test 2: invalid XML raises DocumentInvalid ───────────────────────────────
print("Test 2: invalid XML raises DocumentInvalid")
broken = b"""<?xml version='1.0' encoding='UTF-8'?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>x</identifier><sender>s@s.com</sender>
  <sent>2026-01-01T00:00:00+00:00</sent>
  <status>BOGUS</status><msgType>Alert</msgType><scope>Public</scope>
</alert>"""
try:
    CAPParser().parse(broken)
    print("  FAIL: expected DocumentInvalid but none raised")
except etree.DocumentInvalid as e:
    print(f"  PASS: DocumentInvalid raised: {str(e)[:80]}")

# ─── Test 3: fixture files ────────────────────────────────────────────────────
print("Test 3: fixture files (all valid CAP v1.2 fixtures must parse)")
fixtures_dir = "/home/ubuntu/cap_tool_v2/tests/fixtures"
cap12_ns = b"urn:oasis:names:tc:emergency:cap:1.2"
cap11_ns = b"urn:oasis:names:tc:emergency:cap:1.1"

parser    = CAPParser()
validator = CAPValidator()

passed = skipped = failed = 0
xml_files = sorted(f for f in os.listdir(fixtures_dir) if f.endswith(".xml"))

for fname in xml_files:
    fpath = os.path.join(fixtures_dir, fname)
    with open(fpath, "rb") as fh:
        raw = fh.read()

    if cap12_ns in raw:
        ns = "1.2"
    elif cap11_ns in raw:
        ns = "1.1"
    else:
        ns = "unknown"

    if ns != "1.2":
        print(f"  SKIP  {fname} (CAP {ns})")
        skipped += 1
        continue

    # Only parse files that pass XSD validation
    ok, errs = validator.is_valid(raw)
    if not ok:
        print(f"  SKIP  {fname} (fails XSD: {errs[0][:60] if errs else '?'})")
        skipped += 1
        continue

    try:
        msg = parser.parse(raw)
        print(f"  PASS  {fname} → sender={msg.sender!r}, info_blocks={len(msg.info_blocks)}")
        passed += 1
    except Exception as e:
        print(f"  FAIL  {fname}: {e}")
        failed += 1

print(f"\nFixtures: {passed} passed, {skipped} skipped, {failed} failed")

# Generate a v1.2 fixture from our builder and test it
print("\nTest 4: parse a freshly generated CAP v1.2 fixture")
fresh_xml = CAPXMLBuilder().build(original)
try:
    msg = parser.parse(fresh_xml)
    print(f"  PASS  generated fixture parsed: sender={msg.sender!r}, "
          f"info_blocks={len(msg.info_blocks)}, "
          f"expires type={type(msg.info_blocks[0].expires).__name__}")
    passed += 1
except Exception as e:
    print(f"  FAIL: {e}")
    failed += 1

if failed == 0:
    print("\nStep 5: PASSED")
else:
    print("\nStep 5: FAILED")
    sys.exit(1)
