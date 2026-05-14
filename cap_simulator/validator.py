from __future__ import annotations

from pathlib import Path

from lxml import etree

_SCHEMA_DIR = Path(__file__).resolve().parent / "schemas"
_SCHEMA_PATH = _SCHEMA_DIR / "cap-v1.2.xsd"


class _LocalSchemaResolver(etree.Resolver):
    """Resolve XSD includes/imports from the local schemas directory."""

    def resolve(self, url: str, pubid: str, context: object):
        local_path = _SCHEMA_DIR / url
        if local_path.exists():
            return self.resolve_filename(str(local_path), context)
        return None


# Parser tuned for schema-loading diagnostics in GUI contexts.
_schema_parser = etree.XMLParser(
    no_network=True,
    remove_blank_text=False,
    resolve_entities=False,
    recover=False,
)
_schema_parser.resolvers.add(_LocalSchemaResolver())

_schema_doc = etree.parse(str(_SCHEMA_PATH), _schema_parser)
_SCHEMA = etree.XMLSchema(_schema_doc)


def validate(xml_bytes: bytes) -> None:
    """Validate a CAP XML document.

    Raises:
        lxml.etree.DocumentInvalid: If the XML violates the CAP schema.
        lxml.etree.XMLSyntaxError: If XML is not well-formed.
    """

    xml_parser = etree.XMLParser(
        no_network=True,
        remove_blank_text=False,
        resolve_entities=False,
        recover=False,
    )
    document = etree.fromstring(xml_bytes, parser=xml_parser)
    _SCHEMA.assertValid(document)
