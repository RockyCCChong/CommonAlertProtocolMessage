"""
CAP v1.2 XML Builder
====================
Builds a valid CAP v1.2 XML message from a CAPMessage dataclass using lxml.etree.
Semantic validation runs before XML construction and raises ValueError on any violation.
"""

from __future__ import annotations

from lxml import etree

from models.cap_message import (
    CAPMessage, CAPInfo, CAPArea, CAPResource, MsgType, Scope,
)

CAP_NS  = "urn:oasis:names:tc:emergency:cap:1.2"
CAP_TAG = "{" + CAP_NS + "}"


# ─── Semantic validation ───────────────────────────────────────────────────────

def _validate_semantics(msg: CAPMessage) -> None:
    """Run all semantic checks. Raises ValueError with a descriptive message."""

    if not msg.sender or msg.sender.strip() == "":
        raise ValueError("sender is required")

    if msg.msg_type == MsgType.ALERT and not msg.info_blocks:
        raise ValueError("Alert msgType requires at least one info block")

    for info in msg.info_blocks:
        if info.expires is None:
            raise ValueError("expires is required in every info block")
        if info.expires <= msg.sent:
            raise ValueError("expires must be after sent")

    if msg.scope == Scope.RESTRICTED and not (msg.restriction or "").strip():
        raise ValueError("restriction is required when scope is Restricted")

    if msg.scope == Scope.PRIVATE and not (msg.addresses or "").strip():
        raise ValueError("addresses is required when scope is Private")

    if msg.msg_type in (MsgType.UPDATE, MsgType.CANCEL) and not (msg.references or "").strip():
        raise ValueError("references is required for Update and Cancel messages")

    if msg.references and msg.references.strip():
        for ref in msg.references.strip().split(" "):
            if len(ref.split(",")) != 3:
                raise ValueError(
                    "references format must be: sender,identifier,sent "
                    "(space-separated for multiple)"
                )

    for info in msg.info_blocks:
        for area in info.areas:
            if area.circle:
                parts = area.circle.strip().split(" ")
                if len(parts) == 2:
                    try:
                        radius = float(parts[1])
                    except ValueError:
                        radius = -1.0
                    if radius <= 0:
                        raise ValueError("circle radius must be a positive number")

            if area.polygon:
                coords = area.polygon.strip().split(" ")
                coords = [c for c in coords if c]
                if len(coords) >= 2 and coords[0] != coords[-1]:
                    raise ValueError(
                        "polygon must be a closed ring "
                        "(first and last coordinate must match)"
                    )


# ─── XML helpers ──────────────────────────────────────────────────────────────

def _fmt_dt(dt) -> str:
    """Format a datetime as %Y-%m-%dT%H:%M:%S+HH:MM (always with timezone offset)."""
    # strftime %z gives +0000; CAP/XSD requires +00:00 (with colon)
    s = dt.strftime("%Y-%m-%dT%H:%M:%S%z")
    # Insert colon: +0000 → +00:00, -0530 → -05:30
    if len(s) >= 5 and s[-5] in ('+', '-'):
        s = s[:-2] + ':' + s[-2:]
    return s


def _sub(parent: etree._Element, tag: str, text: str | None) -> None:
    """Append a child element only when text is not None/empty."""
    if text is None or text == "":
        return
    el = etree.SubElement(parent, CAP_TAG + tag)
    el.text = text


# ─── Area builder ─────────────────────────────────────────────────────────────

def _build_area(info_el: etree._Element, area: CAPArea) -> None:
    area_el = etree.SubElement(info_el, CAP_TAG + "area")
    _sub(area_el, "areaDesc", area.area_desc)
    if area.polygon:
        _sub(area_el, "polygon", area.polygon)
    if area.circle:
        _sub(area_el, "circle", area.circle)
    if area.geocode:
        for name, value in area.geocode.items():
            gc_el = etree.SubElement(area_el, CAP_TAG + "geocode")
            _sub(gc_el, "valueName", name)
            _sub(gc_el, "value", value)
    if area.altitude is not None:
        _sub(area_el, "altitude", str(area.altitude))
    if area.ceiling is not None:
        _sub(area_el, "ceiling", str(area.ceiling))


# ─── Resource builder ─────────────────────────────────────────────────────────

def _build_resource(info_el: etree._Element, res: CAPResource) -> None:
    res_el = etree.SubElement(info_el, CAP_TAG + "resource")
    _sub(res_el, "resourceDesc", res.resource_desc)
    _sub(res_el, "mimeType", res.mime_type)
    if res.uri:
        _sub(res_el, "uri", res.uri)
    if res.size is not None:
        _sub(res_el, "size", str(res.size))
    if res.digest:
        _sub(res_el, "digest", res.digest)


# ─── Info builder ─────────────────────────────────────────────────────────────

def _build_info(alert_el: etree._Element, info: CAPInfo) -> None:
    """
    Element order per XSD sequence (authoritative):
    language → category → event → responseType → urgency → severity →
    certainty → audience → eventCode → effective → onset → expires →
    senderName → headline → description → instruction → web → contact →
    parameter → resource → area
    """
    info_el = etree.SubElement(alert_el, CAP_TAG + "info")
    _sub(info_el, "language",  info.language)
    _sub(info_el, "category",  info.category.value)
    _sub(info_el, "event",     info.event)
    if info.response_type:
        _sub(info_el, "responseType", info.response_type.value)
    _sub(info_el, "urgency",   info.urgency.value)
    _sub(info_el, "severity",  info.severity.value)
    _sub(info_el, "certainty", info.certainty.value)
    # eventCode blocks come BEFORE effective/onset/expires per XSD
    for name, value in (info.event_codes or {}).items():
        ec_el = etree.SubElement(info_el, CAP_TAG + "eventCode")
        _sub(ec_el, "valueName", name)
        _sub(ec_el, "value", value)
    if info.effective:
        _sub(info_el, "effective", _fmt_dt(info.effective))
    if info.onset:
        _sub(info_el, "onset", _fmt_dt(info.onset))
    _sub(info_el, "expires",    _fmt_dt(info.expires))
    if info.sender_name:
        _sub(info_el, "senderName", info.sender_name)
    _sub(info_el, "headline",     info.headline)
    if info.description:
        _sub(info_el, "description", info.description)
    if info.instruction:
        _sub(info_el, "instruction", info.instruction)
    # parameter blocks come AFTER instruction per XSD
    for name, value in (info.parameters or {}).items():
        p_el = etree.SubElement(info_el, CAP_TAG + "parameter")
        _sub(p_el, "valueName", name)
        _sub(p_el, "value", value)
    for res in info.resources:
        _build_resource(info_el, res)
    for area in info.areas:
        _build_area(info_el, area)


# ─── Main builder class ───────────────────────────────────────────────────────

class CAPXMLBuilder:
    """Builds a valid CAP v1.2 XML message from a CAPMessage dataclass."""

    def build(self, msg: CAPMessage) -> bytes:
        """
        Validate semantics then construct XML.

        Returns:
            UTF-8 encoded bytes with XML declaration.

        Raises:
            ValueError: if any semantic validation rule is violated.
        """
        _validate_semantics(msg)

        # Root <alert> element with CAP v1.2 namespace
        alert_el = etree.Element(CAP_TAG + "alert", nsmap={None: CAP_NS})

        # Element order within <alert>:
        # identifier → sender → sent → status → msgType → scope →
        # restriction → addresses → note → references → incidents → info
        _sub(alert_el, "identifier",  msg.identifier)
        _sub(alert_el, "sender",      msg.sender)
        _sub(alert_el, "sent",        _fmt_dt(msg.sent))
        _sub(alert_el, "status",      msg.status.value)
        _sub(alert_el, "msgType",     msg.msg_type.value)
        _sub(alert_el, "scope",       msg.scope.value)
        if msg.restriction:
            _sub(alert_el, "restriction", msg.restriction)
        if msg.addresses:
            _sub(alert_el, "addresses", msg.addresses)
        if msg.note:
            _sub(alert_el, "note", msg.note)
        if msg.references:
            _sub(alert_el, "references", msg.references)
        if msg.incidents:
            _sub(alert_el, "incidents", msg.incidents)
        for info in msg.info_blocks:
            _build_info(alert_el, info)

        return etree.tostring(
            alert_el,
            xml_declaration=True,
            encoding="UTF-8",
            pretty_print=True,
        )
