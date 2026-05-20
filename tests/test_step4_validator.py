"""
Step 4 test:
  - Valid CAP v1.2 message passes XSD validation.
  - Deliberately broken XML raises DocumentInvalid.
  - All fixture files that are CAP v1.2 pass validation.
"""
import sys, os
sys.path.insert(0, "/home/ubuntu/cap_tool_v2")

from datetime import datetime, timezone, timedelta
from lxml import etree

from models.cap_message import (
    CAPMessage, CAPInfo, CAPArea,
    Status, MsgType, Scope, Category, Urgency, Severity, Certainty,
)
from builder.xml_builder import CAPXMLBuilder
from validator.xml_validator import CAPValidator

now     = datetime.now(timezone.utc)
expires = now + timedelta(hours=6)

def make_valid_msg() -> bytes:
    msg = CAPMessage(
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
                areas=[CAPArea(area_desc="Singapore")],
            )
        ],
    )
    return CAPXMLBuilder().build(msg)

validator = CAPValidator()

# ─── Test 1: valid message passes ─────────────────────────────────────────────
print("Test 1: valid message passes XSD validation")
xml_bytes = make_valid_msg()
try:
    validator.validate(xml_bytes)
    print("  PASS")
except etree.DocumentInvalid as e:
    print(f"  FAIL: {e}")

# ─── Test 2: is_valid returns (True, []) ──────────────────────────────────────
print("Test 2: is_valid() returns (True, []) for valid message")
ok, errors = validator.is_valid(xml_bytes)
if ok and errors == []:
    print("  PASS")
else:
    print(f"  FAIL: ok={ok}, errors={errors}")

# ─── Test 3: broken XML raises DocumentInvalid ────────────────────────────────
print("Test 3: broken XML raises DocumentInvalid")
broken = b"""<?xml version='1.0' encoding='UTF-8'?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>test-001</identifier>
  <sender>test@test.com</sender>
  <sent>2026-01-01T00:00:00+00:00</sent>
  <status>INVALID_STATUS_VALUE</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
</alert>"""
try:
    validator.validate(broken)
    print("  FAIL: expected DocumentInvalid but none raised")
except etree.DocumentInvalid as e:
    print(f"  PASS: DocumentInvalid raised: {str(e)[:80]}")

# ─── Test 4: is_valid returns (False, errors) for broken XML ──────────────────
print("Test 4: is_valid() returns (False, [...]) for broken XML")
ok, errors = validator.is_valid(broken)
if not ok and len(errors) > 0:
    print(f"  PASS: {len(errors)} error(s) returned")
else:
    print(f"  FAIL: ok={ok}, errors={errors}")

# ─── Test 5: fixture files ────────────────────────────────────────────────────
print("Test 5: fixture files")
fixtures_dir = "/home/ubuntu/cap_tool_v2/tests/fixtures"
xml_files = [f for f in os.listdir(fixtures_dir) if f.endswith(".xml")]
cap12_ns = "urn:oasis:names:tc:emergency:cap:1.2"
cap11_ns = "urn:oasis:names:tc:emergency:cap:1.1"

passed = 0
skipped = 0
failed = 0

for fname in sorted(xml_files):
    fpath = os.path.join(fixtures_dir, fname)
    with open(fpath, "rb") as fh:
        raw = fh.read()
    # Determine namespace
    if cap12_ns.encode() in raw:
        ns = "1.2"
    elif cap11_ns.encode() in raw:
        ns = "1.1"
    else:
        ns = "unknown"

    if ns != "1.2":
        print(f"  SKIP  {fname} (CAP {ns} — not v1.2)")
        skipped += 1
        continue

    ok, errors = validator.is_valid(raw)
    if ok:
        print(f"  PASS  {fname}")
        passed += 1
    else:
        print(f"  FAIL  {fname}: {errors[0][:80] if errors else 'unknown'}")
        failed += 1

print(f"\nFixtures: {passed} passed, {skipped} skipped (not v1.2), {failed} failed")

if failed == 0:
    print("\nStep 4: PASSED")
else:
    print("\nStep 4: FAILED")
    sys.exit(1)
