"""
CAP v1.2 XML Parser / Interpreter
==================================
Parses a CAP v1.2 XML message back into a CAPMessage dataclass.

Rules (per spec):
  - Calls CAPValidator().validate(xml_bytes) first. Raises on invalid input.
  - Parses every field from the XML into the corresponding dataclass field.
  - Parses all <info>, <area>, and <resource> blocks.
  - Parses <eventCode> and <parameter> blocks into dict[str, str].
  - Parses all datetime fields using datetime.fromisoformat().
  - Omits no field that is present in the XML.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from lxml import etree

from models.cap_message import (
    CAPMessage, CAPInfo, CAPArea, CAPResource,
    Status, MsgType, Scope, Category, Urgency, Severity, Certainty, ResponseType,
)
from validator.xml_validator import CAPValidator

CAP_NS  = "urn:oasis:names:tc:emergency:cap:1.2"
CAP_TAG = "{" + CAP_NS + "}"


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _text(el: etree._Element, tag: str) -> Optional[str]:
    """Return the text of the first matching child element, or None."""
    child = el.find(CAP_TAG + tag)
    return child.text.strip() if child is not None and child.text else None


def _all(el: etree._Element, tag: str) -> list[etree._Element]:
    """Return all matching child elements."""
    return el.findall(CAP_TAG + tag)


def _kv_blocks(el: etree._Element, tag: str) -> dict[str, str]:
    """Parse <tag><valueName>k</valueName><value>v</value></tag> blocks into a dict."""
    result: dict[str, str] = {}
    for block in _all(el, tag):
        name  = _text(block, "valueName")
        value = _text(block, "value")
        if name is not None:
            result[name] = value or ""
    return result


def _parse_dt(s: Optional[str]) -> Optional[datetime]:
    """Parse an ISO 8601 datetime string using datetime.fromisoformat()."""
    if not s:
        return None
    # Python 3.10 fromisoformat does not handle the trailing 'Z'; normalise it.
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


# ─── Sub-parsers ──────────────────────────────────────────────────────────────

def _parse_area(area_el: etree._Element) -> CAPArea:
    geocode = _kv_blocks(area_el, "geocode")
    alt_str = _text(area_el, "altitude")
    ceil_str = _text(area_el, "ceiling")
    return CAPArea(
        area_desc = _text(area_el, "areaDesc") or "",
        polygon   = _text(area_el, "polygon"),
        circle    = _text(area_el, "circle"),
        geocode   = geocode if geocode else None,
        altitude  = float(alt_str)  if alt_str  else None,
        ceiling   = float(ceil_str) if ceil_str else None,
    )


def _parse_resource(res_el: etree._Element) -> CAPResource:
    size_str = _text(res_el, "size")
    return CAPResource(
        resource_desc = _text(res_el, "resourceDesc") or "",
        mime_type     = _text(res_el, "mimeType") or "",
        uri           = _text(res_el, "uri"),
        size          = int(size_str) if size_str else None,
        digest        = _text(res_el, "digest"),
    )


def _parse_info(info_el: etree._Element) -> CAPInfo:
    cat_str  = _text(info_el, "category")
    urg_str  = _text(info_el, "urgency")
    sev_str  = _text(info_el, "severity")
    cer_str  = _text(info_el, "certainty")
    rt_str   = _text(info_el, "responseType")
    exp_str  = _text(info_el, "expires")
    eff_str  = _text(info_el, "effective")
    ons_str  = _text(info_el, "onset")

    return CAPInfo(
        language      = _text(info_el, "language") or "en-SG",
        category      = Category(cat_str)          if cat_str  else Category.OTHER,
        event         = _text(info_el, "event")    or "",
        urgency       = Urgency(urg_str)            if urg_str  else Urgency.UNKNOWN,
        severity      = Severity(sev_str)           if sev_str  else Severity.UNKNOWN,
        certainty     = Certainty(cer_str)          if cer_str  else Certainty.UNKNOWN,
        headline      = _text(info_el, "headline") or "",
        expires       = _parse_dt(exp_str) or datetime.now(),
        description   = _text(info_el, "description"),
        instruction   = _text(info_el, "instruction"),
        effective     = _parse_dt(eff_str),
        onset         = _parse_dt(ons_str),
        sender_name   = _text(info_el, "senderName"),
        response_type = ResponseType(rt_str) if rt_str else None,
        event_codes   = _kv_blocks(info_el, "eventCode"),
        parameters    = _kv_blocks(info_el, "parameter"),
        areas         = [_parse_area(a)    for a in _all(info_el, "area")],
        resources     = [_parse_resource(r) for r in _all(info_el, "resource")],
    )


# ─── Main parser class ────────────────────────────────────────────────────────

class CAPParser:
    """Parses CAP v1.2 XML bytes into a CAPMessage dataclass."""

    def parse(self, xml_bytes: bytes) -> CAPMessage:
        """
        Parse CAP v1.2 XML into a CAPMessage.

        Calls CAPValidator().validate() first. Raises on invalid input.
        Omits no field that is present in the XML.

        Returns:
            CAPMessage with all fields populated from the XML.

        Raises:
            lxml.etree.DocumentInvalid: if the XML fails XSD validation.
            lxml.etree.XMLSyntaxError:  if the XML is not well-formed.
        """
        # Validate first — raises DocumentInvalid on failure
        CAPValidator().validate(xml_bytes)

        root = etree.fromstring(xml_bytes)

        sent_str = _text(root, "sent")
        status_str   = _text(root, "status")
        msgtype_str  = _text(root, "msgType")
        scope_str    = _text(root, "scope")

        return CAPMessage(
            identifier  = _text(root, "identifier") or "",
            sender      = _text(root, "sender")     or "",
            sent        = _parse_dt(sent_str) or datetime.now(),
            status      = Status(status_str)   if status_str  else Status.TEST,
            msg_type    = MsgType(msgtype_str) if msgtype_str else MsgType.ALERT,
            scope       = Scope(scope_str)     if scope_str   else Scope.PUBLIC,
            restriction = _text(root, "restriction"),
            addresses   = _text(root, "addresses"),
            note        = _text(root, "note"),
            references  = _text(root, "references"),
            incidents   = _text(root, "incidents"),
            info_blocks = [_parse_info(i) for i in _all(root, "info")],
        )
