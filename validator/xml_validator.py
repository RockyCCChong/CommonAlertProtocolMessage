"""
CAP v1.2 XSD Validator
======================
Loads the official OASIS CAP v1.2 XSD schema at initialisation and validates
XML bytes against it using lxml.etree.XMLSchema.

This is genuine schema-driven validation — not a hand-written structural check.
Any XML that violates the XSD will raise lxml.etree.DocumentInvalid.
"""

from __future__ import annotations

import os
from lxml import etree

# Default path to the XSD file (relative to the project root)
_DEFAULT_XSD = os.path.join(
    os.path.dirname(__file__),   # validator/
    "..",                         # project root
    "schemas",
    "cap1-2.xsd",
)


class CAPValidator:
    """
    Validates CAP v1.2 XML bytes against the official OASIS XSD schema.

    The XSD is loaded once at __init__ and reused for all subsequent calls.

    Raises:
        FileNotFoundError: if the XSD file is missing at initialisation.
    """

    def __init__(self, xsd_path: str | None = None) -> None:
        path = os.path.abspath(xsd_path or _DEFAULT_XSD)
        if not os.path.isfile(path):
            raise FileNotFoundError(
                f"schemas/cap-v1.2.xsd not found. Run Step 1 of setup."
            )
        with open(path, "rb") as fh:
            xsd_doc = etree.parse(fh)
        self._schema = etree.XMLSchema(xsd_doc)

    def validate(self, xml_bytes: bytes) -> None:
        """
        Validate XML bytes against the CAP v1.2 XSD.

        Raises:
            lxml.etree.DocumentInvalid: if the XML fails schema validation.
            lxml.etree.XMLSyntaxError:  if the XML is not well-formed.
        """
        doc = etree.fromstring(xml_bytes)
        self._schema.assertValid(doc)

    def is_valid(self, xml_bytes: bytes) -> tuple[bool, list[str]]:
        """
        Validate XML bytes without raising.

        Returns:
            (True, [])                    on success.
            (False, [error_message, ...]) on failure.
        """
        try:
            doc = etree.fromstring(xml_bytes)
        except etree.XMLSyntaxError as e:
            return False, [f"XML syntax error: {e}"]

        valid = self._schema.validate(doc)
        if valid:
            return True, []
        errors = [str(err) for err in self._schema.error_log]
        return False, errors
