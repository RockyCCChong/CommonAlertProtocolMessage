"""Step 2 test: instantiate a CAPMessage with one CAPInfo block, print all fields."""
import sys
sys.path.insert(0, "/home/ubuntu/cap_tool_v2")

from datetime import datetime, timezone, timedelta
from models.cap_message import (
    CAPMessage, CAPInfo, CAPArea, CAPResource,
    Status, MsgType, Scope, Category, Urgency, Severity, Certainty, ResponseType,
)

now = datetime.now(timezone.utc)
expires = now + timedelta(hours=6)

info = CAPInfo(
    category=Category.MET,
    event="Severe Thunderstorm Warning",
    urgency=Urgency.IMMEDIATE,
    severity=Severity.SEVERE,
    certainty=Certainty.OBSERVED,
    headline="Severe thunderstorm warning for Singapore",
    expires=expires,
    language="en-SG",
    description="Severe thunderstorms expected across the island.",
    instruction="Seek shelter immediately.",
    effective=now,
    sender_name="Meteorological Service Singapore",
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

msg = CAPMessage(
    sender="alerts@met.gov.sg",
    status=Status.ACTUAL,
    msg_type=MsgType.ALERT,
    scope=Scope.PUBLIC,
    info_blocks=[info],
)

print("=== CAPMessage ===")
print(f"  identifier : {msg.identifier}")
print(f"  sender     : {msg.sender}")
print(f"  sent       : {msg.sent}")
print(f"  status     : {msg.status}")
print(f"  msg_type   : {msg.msg_type}")
print(f"  scope      : {msg.scope}")
print(f"  info_blocks: {len(msg.info_blocks)} block(s)")

info0 = msg.info_blocks[0]
print("\n=== CAPInfo[0] ===")
print(f"  language      : {info0.language}")
print(f"  category      : {info0.category}")
print(f"  event         : {info0.event}")
print(f"  urgency       : {info0.urgency}")
print(f"  severity      : {info0.severity}")
print(f"  certainty     : {info0.certainty}")
print(f"  headline      : {info0.headline}")
print(f"  expires       : {info0.expires}")
print(f"  response_type : {info0.response_type}")
print(f"  event_codes   : {info0.event_codes}")
print(f"  parameters    : {info0.parameters}")
print(f"  areas         : {len(info0.areas)} area(s)")
print(f"  resources     : {len(info0.resources)} resource(s)")

print("\nStep 2: PASSED")
