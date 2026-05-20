"""
CAP v1.2 Tool — Flask GUI
=========================
Three routes:
  GET  /          → render blank compose form
  POST /compose   → validate → build → XSD validate → display result
  POST /parse     → accept raw XML → XSD validate → parse → display structured result
"""

from __future__ import annotations

import os
import sys

# Allow imports from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime, timezone
from lxml import etree
from flask import Flask, render_template, request

from models.cap_message import (
    CAPMessage, CAPInfo, CAPArea, CAPResource,
    Status, MsgType, Scope, Category, Urgency, Severity, Certainty, ResponseType,
)
from builder.xml_builder import CAPXMLBuilder
from validator.xml_validator import CAPValidator
from parser.xml_parser import CAPParser

app = Flask(__name__, template_folder="templates")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get(key: str, default: str = "") -> str:
    return request.form.get(key, default).strip()


def _parse_dt_field(val: str) -> datetime | None:
    """Parse a datetime-local form value to a timezone-aware datetime."""
    if not val:
        return None
    try:
        dt = datetime.fromisoformat(val)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def _run_validation_summary(xml_bytes: bytes, msg: CAPMessage) -> list[dict]:
    """
    Run all 8 validation checks and return a list of
    {"label": str, "passed": bool, "detail": str} dicts.
    """
    validator = CAPValidator()
    checks = []

    # 1. Well-formed XML
    try:
        etree.fromstring(xml_bytes)
        checks.append({"label": "Well-formed XML", "passed": True, "detail": ""})
    except etree.XMLSyntaxError as e:
        checks.append({"label": "Well-formed XML", "passed": False, "detail": str(e)})
        return checks  # No point continuing

    # 2. XSD schema valid
    ok, errors = validator.is_valid(xml_bytes)
    checks.append({
        "label": "XSD schema valid (OASIS CAP v1.2)",
        "passed": ok,
        "detail": errors[0] if errors else "",
    })

    # 3. Sender present
    sender_ok = bool(msg.sender and msg.sender.strip())
    checks.append({
        "label": "Sender present",
        "passed": sender_ok,
        "detail": "" if sender_ok else "sender is empty",
    })

    # 4. Expires after sent
    exp_ok = True
    exp_detail = ""
    for info in msg.info_blocks:
        if info.expires and info.expires <= msg.sent:
            exp_ok = False
            exp_detail = f"expires ({info.expires}) is not after sent ({msg.sent})"
            break
    checks.append({"label": "Expires after sent", "passed": exp_ok, "detail": exp_detail})

    # 5. Scope rules
    scope_ok = True
    scope_detail = ""
    if msg.scope == Scope.RESTRICTED and not (msg.restriction or "").strip():
        scope_ok = False
        scope_detail = "Restricted scope requires restriction field"
    if msg.scope == Scope.PRIVATE and not (msg.addresses or "").strip():
        scope_ok = False
        scope_detail = "Private scope requires addresses field"
    checks.append({"label": "Scope rules", "passed": scope_ok, "detail": scope_detail})

    # 6. References format
    ref_ok = True
    ref_detail = ""
    if msg.references and msg.references.strip():
        for ref in msg.references.strip().split(" "):
            if len(ref.split(",")) != 3:
                ref_ok = False
                ref_detail = f"Bad reference: {ref!r}"
                break
    checks.append({"label": "References format", "passed": ref_ok, "detail": ref_detail})

    # 7. Polygon closed ring
    poly_ok = True
    poly_detail = ""
    for info in msg.info_blocks:
        for area in info.areas:
            if area.polygon:
                coords = [c for c in area.polygon.strip().split(" ") if c]
                if len(coords) >= 2 and coords[0] != coords[-1]:
                    poly_ok = False
                    poly_detail = f"Polygon in area '{area.area_desc}' is not a closed ring"
                    break
    checks.append({"label": "Polygon closed ring", "passed": poly_ok, "detail": poly_detail})

    # 8. Circle radius positive
    circ_ok = True
    circ_detail = ""
    for info in msg.info_blocks:
        for area in info.areas:
            if area.circle:
                parts = area.circle.strip().split(" ")
                if len(parts) == 2:
                    try:
                        if float(parts[1]) <= 0:
                            circ_ok = False
                            circ_detail = f"Circle radius <= 0 in area '{area.area_desc}'"
                    except ValueError:
                        circ_ok = False
                        circ_detail = f"Non-numeric radius in area '{area.area_desc}'"
    checks.append({"label": "Circle radius positive", "passed": circ_ok, "detail": circ_detail})

    return checks


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def index():
    return render_template(
        "compose.html",
        statuses=list(Status),
        msg_types=list(MsgType),
        scopes=list(Scope),
        categories=list(Category),
        urgencies=list(Urgency),
        severities=list(Severity),
        certainties=list(Certainty),
        response_types=list(ResponseType),
        form_data={},
        errors=[],
        xml_output=None,
        validation_summary=None,
        parse_result=None,
        mode="compose",
    )


@app.route("/compose", methods=["POST"])
def compose():
    errors: list[str] = []
    xml_output: str | None = None
    validation_summary: list[dict] | None = None
    form_data = request.form.to_dict()

    try:
        # ── Alert-level fields ─────────────────────────────────────────────
        sent_val = _get("sent")
        sent_dt  = _parse_dt_field(sent_val) or datetime.now(timezone.utc)

        scope_val = _get("scope", "Public")
        try:
            scope = Scope(scope_val)
        except ValueError:
            scope = Scope.PUBLIC

        msg = CAPMessage(
            identifier  = _get("identifier") or None,  # None → auto UUID
            sender      = _get("sender"),
            sent        = sent_dt,
            status      = Status(_get("status", "Test")),
            msg_type    = MsgType(_get("msg_type", "Alert")),
            scope       = scope,
            restriction = _get("restriction") or None,
            addresses   = _get("addresses")   or None,
            note        = _get("note")         or None,
            references  = _get("references")  or None,
            incidents   = _get("incidents")   or None,
        )
        # Restore auto-UUID if identifier was blank
        if not _get("identifier"):
            import uuid
            msg.identifier = str(uuid.uuid4())

        # ── Info block ─────────────────────────────────────────────────────
        expires_dt = _parse_dt_field(_get("expires"))
        if expires_dt is None:
            errors.append("expires is required")
            raise ValueError("expires is required")

        rt_val = _get("response_type")
        response_type = ResponseType(rt_val) if rt_val else None

        # eventCode and parameter (single pair each from the form)
        event_codes: dict[str, str] = {}
        ec_name = _get("event_code_name")
        ec_val  = _get("event_code_value")
        if ec_name:
            event_codes[ec_name] = ec_val

        parameters: dict[str, str] = {}
        p_name = _get("parameter_name")
        p_val  = _get("parameter_value")
        if p_name:
            parameters[p_name] = p_val

        info = CAPInfo(
            language      = _get("language") or "en-SG",
            category      = Category(_get("category", "Other")),
            event         = _get("event"),
            urgency       = Urgency(_get("urgency", "Unknown")),
            severity      = Severity(_get("severity", "Unknown")),
            certainty     = Certainty(_get("certainty", "Unknown")),
            headline      = _get("headline"),
            expires       = expires_dt,
            description   = _get("description") or None,
            instruction   = _get("instruction") or None,
            effective     = _parse_dt_field(_get("effective")),
            onset         = _parse_dt_field(_get("onset")),
            sender_name   = _get("sender_name") or None,
            response_type = response_type,
            event_codes   = event_codes,
            parameters    = parameters,
        )

        # ── Area block (optional) ──────────────────────────────────────────
        area_desc = _get("area_desc")
        if area_desc:
            geocode: dict[str, str] = {}
            gc_name = _get("geocode_name")
            gc_val  = _get("geocode_value")
            if gc_name:
                geocode[gc_name] = gc_val

            alt_str  = _get("altitude")
            ceil_str = _get("ceiling")

            area = CAPArea(
                area_desc = area_desc,
                polygon   = _get("polygon")  or None,
                circle    = _get("circle")   or None,
                geocode   = geocode if geocode else None,
                altitude  = float(alt_str)  if alt_str  else None,
                ceiling   = float(ceil_str) if ceil_str else None,
            )
            info.areas.append(area)

        # ── Resource block (optional) ──────────────────────────────────────
        res_desc = _get("resource_desc")
        if res_desc:
            size_str = _get("resource_size")
            resource = CAPResource(
                resource_desc = res_desc,
                mime_type     = _get("mime_type") or "application/octet-stream",
                uri           = _get("resource_uri") or None,
                size          = int(size_str) if size_str else None,
                digest        = _get("resource_digest") or None,
            )
            info.resources.append(resource)

        msg.info_blocks.append(info)

        # ── Build XML ──────────────────────────────────────────────────────
        xml_bytes = CAPXMLBuilder().build(msg)
        xml_output = xml_bytes.decode("utf-8")

        # ── Validation summary ─────────────────────────────────────────────
        validation_summary = _run_validation_summary(xml_bytes, msg)

    except ValueError as e:
        if str(e) not in errors:
            errors.append(str(e))
    except Exception as e:
        errors.append(f"Unexpected error: {e}")

    return render_template(
        "compose.html",
        statuses=list(Status),
        msg_types=list(MsgType),
        scopes=list(Scope),
        categories=list(Category),
        urgencies=list(Urgency),
        severities=list(Severity),
        certainties=list(Certainty),
        response_types=list(ResponseType),
        form_data=form_data,
        errors=errors,
        xml_output=xml_output,
        validation_summary=validation_summary,
        parse_result=None,
        mode="compose",
    )


@app.route("/parse", methods=["POST"])
def parse_xml():
    errors: list[str] = []
    parse_result = None
    raw_xml = request.form.get("raw_xml", "").strip()

    if not raw_xml:
        errors.append("Please paste a CAP v1.2 XML message to parse.")
    else:
        try:
            xml_bytes = raw_xml.encode("utf-8")
            msg = CAPParser().parse(xml_bytes)
            parse_result = msg
        except etree.DocumentInvalid as e:
            errors.append(f"XSD validation failed: {e}")
        except etree.XMLSyntaxError as e:
            errors.append(f"XML syntax error: {e}")
        except Exception as e:
            errors.append(f"Parse error: {e}")

    return render_template(
        "compose.html",
        statuses=list(Status),
        msg_types=list(MsgType),
        scopes=list(Scope),
        categories=list(Category),
        urgencies=list(Urgency),
        severities=list(Severity),
        certainties=list(Certainty),
        response_types=list(ResponseType),
        form_data={},
        errors=errors,
        xml_output=None,
        validation_summary=None,
        parse_result=parse_result,
        raw_xml=raw_xml,
        mode="parse",
    )


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5050)
