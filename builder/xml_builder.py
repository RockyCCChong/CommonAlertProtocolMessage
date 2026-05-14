from __future__ import annotations

from datetime import datetime
from typing import Any

from lxml import etree

CAP_NS = "urn:oasis:names:tc:emergency:cap:1.2"


class CAPXMLBuilder:
    """Build CAP 1.2 XML payloads from a message model."""

    def __init__(self, *, pretty_print: bool = False) -> None:
        self.pretty_print = pretty_print

    def build(self, message: "CAPMessage") -> bytes:
        self._validate(message)

        root = etree.Element(f"{{{CAP_NS}}}alert", nsmap={None: CAP_NS})

        self._add_alert_fields(root, message)

        infos = self._get_field(message, "info") or []
        for info in infos:
            info_el = etree.SubElement(root, f"{{{CAP_NS}}}info")
            self._add_info_fields(info_el, info)

        return etree.tostring(
            root,
            encoding="UTF-8",
            xml_declaration=True,
            pretty_print=self.pretty_print,
        )

    def _validate(self, message: Any) -> None:
        sender = self._get_field(message, "sender")
        if not sender:
            raise ValueError("sender is required")

        msg_type = self._get_field(message, "msgType")
        scope = self._get_field(message, "scope")
        info_blocks = self._get_field(message, "info") or []

        has_expires = any(self._get_field(info, "expires") for info in info_blocks)
        if not has_expires:
            raise ValueError("expires is required in at least one info block")

        if msg_type == "Alert" and not info_blocks:
            raise ValueError("msgType=Alert requires at least one info block")

        if scope == "Restricted" and not self._get_field(message, "restriction"):
            raise ValueError("scope=Restricted requires restriction")

        if scope == "Private" and not self._get_field(message, "addresses"):
            raise ValueError("scope=Private requires addresses")

        if msg_type in {"Update", "Cancel"} and not self._get_field(message, "references"):
            raise ValueError("msgType=Update/Cancel requires references")

    def _add_alert_fields(self, root: etree._Element, message: Any) -> None:
        for field in (
            "identifier",
            "sender",
            "sent",
            "status",
            "msgType",
            "source",
            "scope",
            "restriction",
            "addresses",
            "code",
            "note",
            "references",
            "incidents",
        ):
            self._append_value(root, field, self._get_field(message, field))

    def _add_info_fields(self, info_el: etree._Element, info: Any) -> None:
        for field in (
            "language",
            "category",
            "event",
            "responseType",
            "urgency",
            "severity",
            "certainty",
            "audience",
            "eventCode",
            "effective",
            "onset",
            "expires",
            "senderName",
            "headline",
            "description",
            "instruction",
            "web",
            "contact",
            "parameter",
        ):
            self._append_value(info_el, field, self._get_field(info, field))

    def _append_value(self, parent: etree._Element, name: str, value: Any) -> None:
        if value is None:
            return
        tag = f"{{{CAP_NS}}}{name}"
        if isinstance(value, list):
            for item in value:
                self._append_scalar(parent, tag, item)
            return
        self._append_scalar(parent, tag, value)

    def _append_scalar(self, parent: etree._Element, tag: str, value: Any) -> None:
        child = etree.SubElement(parent, tag)
        child.text = self._serialize_value(value)

    def _serialize_value(self, value: Any) -> str:
        if isinstance(value, datetime):
            if value.tzinfo is None or value.utcoffset() is None:
                raise ValueError("datetime values must include timezone offset")
            return value.isoformat(timespec="seconds")
        return str(value)

    @staticmethod
    def _get_field(obj: Any, name: str) -> Any:
        if obj is None:
            return None
        if isinstance(obj, dict):
            return obj.get(name)
        return getattr(obj, name, None)
