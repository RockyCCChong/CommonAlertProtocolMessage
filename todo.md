# CAP Tool v2 — Python/Flask Implementation TODO

## Phase 1: Project Setup
- [ ] Create directory structure: models/, builder/, validator/, parser/, gui/, schemas/, tests/fixtures/
- [ ] Install lxml>=4.9.0 and flask>=3.0.0
- [ ] Clone filtered-alert-hub, copy XSD and fixtures
- [ ] Write requirements.txt

## Phase 2: Data Models (cap_message.py)
- [ ] Implement all 8 enums with exact CAP v1.2 string values
- [ ] Implement CAPArea dataclass
- [ ] Implement CAPResource dataclass
- [ ] Implement CAPInfo dataclass with all fields and defaults
- [ ] Implement CAPMessage dataclass with uuid identifier default
- [ ] Step 2 test: instantiate CAPMessage with one CAPInfo, print all fields, no errors

## Phase 3: XML Builder (xml_builder.py)
- [ ] Implement CAPXMLBuilder class with build(msg: CAPMessage) -> bytes
- [ ] Implement all 10 semantic validation checks with exact error messages
- [ ] Implement lxml-based XML construction with correct element order
- [ ] Implement datetime formatting: %Y-%m-%dT%H:%M:%S%z
- [ ] Step 3 test: build a message, call lxml.etree.fromstring() on output, no errors

## Phase 4: XSD Validator (xml_validator.py)
- [ ] Implement CAPValidator class loading XSD at __init__
- [ ] Raise FileNotFoundError with exact message if XSD missing
- [ ] Implement validate(xml_bytes) -> None (raises DocumentInvalid on failure)
- [ ] Implement is_valid(xml_bytes) -> tuple[bool, list[str]] (does not raise)
- [ ] Step 4 test: valid message passes, broken XML raises DocumentInvalid, fixtures pass

## Phase 5: Parser/Interpreter (xml_parser.py)
- [ ] Implement CAPParser class with parse(xml_bytes: bytes) -> CAPMessage
- [ ] Call CAPValidator().validate() first, raise on invalid
- [ ] Parse all fields including info, area, resource blocks
- [ ] Parse eventCode and parameter blocks into dict[str, str]
- [ ] Parse all datetime fields using datetime.fromisoformat()
- [ ] Step 5 test: all valid fixtures in tests/fixtures/ parse without error

## Phase 6: Flask GUI (app.py + compose.html)
- [ ] Implement GET / route: render blank compose form
- [ ] Implement POST /compose: validate → build → validate XSD → display result
- [ ] Implement POST /parse: accept XML, parse, display structured result
- [ ] All form fields per spec (alert section, info section, area section)
- [ ] Conditional field visibility: restriction, addresses, references
- [ ] Inline error display, preserve other inputs on error
- [ ] Validation summary panel (8 checks, all green on success)
- [ ] External validator link: cap-validator.appspot.com
- [ ] Copy-to-clipboard button on XML output
- [ ] Pretty-printed XML in <pre> block

## Phase 7: End-to-End Tests
- [ ] Run all unit tests (Steps 2-5)
- [ ] End-to-end: compose in GUI, copy XML, paste into /parse, verify round-trip

## Phase 8: Delivery
- [ ] Package as cap_tool_v2.zip
- [ ] Push to GitHub: RockyCCChong/CommonAlertProtocolMessage
- [ ] Deliver to user
