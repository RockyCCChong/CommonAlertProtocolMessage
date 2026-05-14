from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional
from uuid import uuid4


class CAPStatus(str, Enum):
    ACTUAL = "Actual"
    EXERCISE = "Exercise"
    SYSTEM = "System"
    TEST = "Test"
    DRAFT = "Draft"


class CAPMsgType(str, Enum):
    ALERT = "Alert"
    UPDATE = "Update"
    CANCEL = "Cancel"
    ACK = "Ack"
    ERROR = "Error"


class CAPScope(str, Enum):
    PUBLIC = "Public"
    RESTRICTED = "Restricted"
    PRIVATE = "Private"


class CAPCategory(str, Enum):
    GEO = "Geo"
    MET = "Met"
    SAFETY = "Safety"
    SECURITY = "Security"
    RESCUE = "Rescue"
    FIRE = "Fire"
    HEALTH = "Health"
    ENV = "Env"
    TRANSPORT = "Transport"
    INFRA = "Infra"
    CBRNE = "CBRNE"
    OTHER = "Other"


class CAPUrgency(str, Enum):
    IMMEDIATE = "Immediate"
    EXPECTED = "Expected"
    FUTURE = "Future"
    PAST = "Past"
    UNKNOWN = "Unknown"


class CAPSeverity(str, Enum):
    EXTREME = "Extreme"
    SEVERE = "Severe"
    MODERATE = "Moderate"
    MINOR = "Minor"
    UNKNOWN = "Unknown"


class CAPCertainty(str, Enum):
    OBSERVED = "Observed"
    LIKELY = "Likely"
    POSSIBLE = "Possible"
    UNLIKELY = "Unlikely"
    UNKNOWN = "Unknown"


class CAPResponseType(str, Enum):
    SHELTER = "Shelter"
    EVACUATE = "Evacuate"
    PREPARE = "Prepare"
    EXECUTE = "Execute"
    AVOID = "Avoid"
    MONITOR = "Monitor"
    ASSESS = "Assess"
    ALL_CLEAR = "AllClear"
    NONE = "None"


@dataclass
class CAPResource:
    resource_desc: str
    mime_type: Optional[str] = None
    size: Optional[int] = None
    uri: Optional[str] = None
    deref_uri: Optional[str] = None
    digest: Optional[str] = None


@dataclass
class CAPArea:
    area_desc: str
    polygon: Optional[List[str]] = None
    circle: Optional[List[str]] = None
    geocode: Optional[Dict[str, str]] = None
    altitude: Optional[int] = None
    ceiling: Optional[int] = None


@dataclass
class CAPInfo:
    language: Optional[str] = None
    category: Optional[List[CAPCategory]] = None
    event: Optional[str] = None
    response_type: Optional[List[CAPResponseType]] = None
    urgency: Optional[CAPUrgency] = None
    severity: Optional[CAPSeverity] = None
    certainty: Optional[CAPCertainty] = None
    audience: Optional[str] = None
    event_code: Optional[Dict[str, str]] = None
    effective: Optional[str] = None
    onset: Optional[str] = None
    expires: Optional[str] = None
    sender_name: Optional[str] = None
    headline: Optional[str] = None
    description: Optional[str] = None
    instruction: Optional[str] = None
    web: Optional[str] = None
    contact: Optional[str] = None
    parameter: Optional[Dict[str, str]] = None
    resource: List[CAPResource] = field(default_factory=list)
    area: List[CAPArea] = field(default_factory=list)


@dataclass
class CAPMessage:
    sender: str
    sent: str
    status: CAPStatus
    msg_type: CAPMsgType
    scope: CAPScope
    identifier: Optional[str] = None
    source: Optional[str] = None
    restriction: Optional[str] = None
    addresses: Optional[List[str]] = None
    code: Optional[List[str]] = None
    note: Optional[str] = None
    references: Optional[List[str]] = None
    incidents: Optional[List[str]] = None
    info: List[CAPInfo] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.identifier:
            self.identifier = str(uuid4())
