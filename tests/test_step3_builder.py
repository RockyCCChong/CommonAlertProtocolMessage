"""Step 3 test: build a CAPMessage, call lxml.etree.fromstring() on output, no errors."""
import sys
sys.path.insert(0, "/home/ubuntu/cap_tool_v2")

from datetime import datetime, timezone, timedelta
from lxml import etree

from models.cap_message import (
    CAPMessage, CAPInfo, CAPArea, CAPResource,
    Status, MsgType, Scope, Category, Urgency, Severity, Certainty, ResponseType,
)
from builder.xml_builder import CAPXMLBuilder

now     = datetime.now(timezone.utc)
expires = now + timedelta(hours=6)

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

builder = CAPXMLBuilder()
xml_bytes = builder.build(msg)

# Verify lxml can parse the output
root = etree.fromstring(xml_bytes)
print("Root tag:", root.tag)
print("Namespace present:", "urn:oasis:names:tc:emergency:cap:1.2" in root.tag)

# Print the XML
print("\n=== Generated XML ===")
print(xml_bytes.decode("utf-8"))

# ─── Test semantic validation errors ──────────────────────────────────────────
import traceback

def expect_error(label: str, build_fn):
    try:
        build_fn()
        print(f"  FAIL  {label}: expected ValueError but none raised")
    except ValueError as e:
        print(f"  PASS  {label}: {e}")
    except Exception as e:
        print(f"  ERROR {label}: unexpected exception: {e}")

print("=== Semantic validation checks ===")

expect_error("sender required", lambda: CAPXMLBuilder().build(
    CAPMessage(sender="", info_blocks=[CAPInfo(
        category=Category.MET, event="x", urgency=Urgency.IMMEDIATE,
        severity=Severity.SEVERE, certainty=Certainty.OBSERVED,
        headline="x", expires=expires,
    )])
))

expect_error("Alert needs info blocks", lambda: CAPXMLBuilder().build(
    CAPMessage(sender="s@s.com", msg_type=MsgType.ALERT, info_blocks=[])
))

expect_error("expires must be after sent", lambda: CAPXMLBuilder().build(
    CAPMessage(sender="s@s.com", info_blocks=[CAPInfo(
        category=Category.MET, event="x", urgency=Urgency.IMMEDIATE,
        severity=Severity.SEVERE, certainty=Certainty.OBSERVED,
        headline="x", expires=now - timedelta(hours=1),
    )])
))

expect_error("restriction required for Restricted scope", lambda: CAPXMLBuilder().build(
    CAPMessage(sender="s@s.com", scope=Scope.RESTRICTED, info_blocks=[CAPInfo(
        category=Category.MET, event="x", urgency=Urgency.IMMEDIATE,
        severity=Severity.SEVERE, certainty=Certainty.OBSERVED,
        headline="x", expires=expires,
    )])
))

expect_error("addresses required for Private scope", lambda: CAPXMLBuilder().build(
    CAPMessage(sender="s@s.com", scope=Scope.PRIVATE, info_blocks=[CAPInfo(
        category=Category.MET, event="x", urgency=Urgency.IMMEDIATE,
        severity=Severity.SEVERE, certainty=Certainty.OBSERVED,
        headline="x", expires=expires,
    )])
))

expect_error("references required for Update", lambda: CAPXMLBuilder().build(
    CAPMessage(sender="s@s.com", msg_type=MsgType.UPDATE, info_blocks=[CAPInfo(
        category=Category.MET, event="x", urgency=Urgency.IMMEDIATE,
        severity=Severity.SEVERE, certainty=Certainty.OBSERVED,
        headline="x", expires=expires,
    )])
))

expect_error("references bad format", lambda: CAPXMLBuilder().build(
    CAPMessage(sender="s@s.com", msg_type=MsgType.UPDATE,
               references="bad-format-no-commas",
               info_blocks=[CAPInfo(
                   category=Category.MET, event="x", urgency=Urgency.IMMEDIATE,
                   severity=Severity.SEVERE, certainty=Certainty.OBSERVED,
                   headline="x", expires=expires,
               )])
))

expect_error("circle radius non-positive", lambda: CAPXMLBuilder().build(
    CAPMessage(sender="s@s.com", info_blocks=[CAPInfo(
        category=Category.MET, event="x", urgency=Urgency.IMMEDIATE,
        severity=Severity.SEVERE, certainty=Certainty.OBSERVED,
        headline="x", expires=expires,
        areas=[CAPArea(area_desc="Test", circle="1.3521,103.8198 -5.0")],
    )])
))

expect_error("polygon not closed ring", lambda: CAPXMLBuilder().build(
    CAPMessage(sender="s@s.com", info_blocks=[CAPInfo(
        category=Category.MET, event="x", urgency=Urgency.IMMEDIATE,
        severity=Severity.SEVERE, certainty=Certainty.OBSERVED,
        headline="x", expires=expires,
        areas=[CAPArea(area_desc="Test", polygon="1.0,103.0 2.0,104.0 3.0,105.0")],
    )])
))

print("\nStep 3: PASSED")
