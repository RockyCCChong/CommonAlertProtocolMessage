"""
CAP v1.2 Data Models
====================
Python dataclasses and enums for the Common Alerting Protocol v1.2.
All enum string values match the OASIS CAP v1.2 specification exactly.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional


# ─── Enumerations ─────────────────────────────────────────────────────────────

class Status(str, Enum):
    ACTUAL   = "Actual"
    EXERCISE = "Exercise"
    SYSTEM   = "System"
    TEST     = "Test"
    DRAFT    = "Draft"


class MsgType(str, Enum):
    ALERT  = "Alert"
    UPDATE = "Update"
    CANCEL = "Cancel"
    ACK    = "Ack"
    ERROR  = "Error"


class Scope(str, Enum):
    PUBLIC     = "Public"
    RESTRICTED = "Restricted"
    PRIVATE    = "Private"


class Category(str, Enum):
    GEO       = "Geo"
    MET       = "Met"
    SAFETY    = "Safety"
    SECURITY  = "Security"
    RESCUE    = "Rescue"
    FIRE      = "Fire"
    HEALTH    = "Health"
    ENV       = "Env"
    TRANSPORT = "Transport"
    INFRA     = "Infra"
    CBRNE     = "CBRNE"
    OTHER     = "Other"


class Urgency(str, Enum):
    IMMEDIATE = "Immediate"
    EXPECTED  = "Expected"
    FUTURE    = "Future"
    PAST      = "Past"
    UNKNOWN   = "Unknown"


class Severity(str, Enum):
    EXTREME  = "Extreme"
    SEVERE   = "Severe"
    MODERATE = "Moderate"
    MINOR    = "Minor"
    UNKNOWN  = "Unknown"


class Certainty(str, Enum):
    OBSERVED = "Observed"
    LIKELY   = "Likely"
    POSSIBLE = "Possible"
    UNLIKELY = "Unlikely"
    UNKNOWN  = "Unknown"


class ResponseType(str, Enum):
    SHELTER   = "Shelter"
    EVACUATE  = "Evacuate"
    PREPARE   = "Prepare"
    EXECUTE   = "Execute"
    AVOID     = "Avoid"
    MONITOR   = "Monitor"
    ASSESS    = "Assess"
    ALL_CLEAR = "AllClear"
    NONE      = "None"


# ─── Data structures ──────────────────────────────────────────────────────────

@dataclass
class CAPArea:
    area_desc: str
    polygon:   Optional[str]       = None
    circle:    Optional[str]       = None
    geocode:   Optional[dict[str, str]] = None
    altitude:  Optional[float]     = None
    ceiling:   Optional[float]     = None


@dataclass
class CAPResource:
    resource_desc: str
    mime_type:     str
    uri:           Optional[str] = None
    size:          Optional[int] = None
    digest:        Optional[str] = None


@dataclass
class CAPInfo:
    category:      Category
    event:         str
    urgency:       Urgency
    severity:      Severity
    certainty:     Certainty
    headline:      str
    expires:       datetime
    language:      str                     = "en-SG"
    description:   Optional[str]          = None
    instruction:   Optional[str]          = None
    effective:     Optional[datetime]     = None
    onset:         Optional[datetime]     = None
    sender_name:   Optional[str]          = None
    response_type: Optional[ResponseType] = None
    event_codes:   dict[str, str]         = field(default_factory=dict)
    parameters:    dict[str, str]         = field(default_factory=dict)
    areas:         list[CAPArea]          = field(default_factory=list)
    resources:     list[CAPResource]      = field(default_factory=list)


@dataclass
class CAPMessage:
    sender:      str
    sent:        datetime              = field(default_factory=lambda: datetime.now(timezone.utc))
    status:      Status                = Status.TEST
    msg_type:    MsgType               = MsgType.ALERT
    scope:       Scope                 = Scope.PUBLIC
    identifier:  str                   = field(default_factory=lambda: str(uuid.uuid4()))
    restriction: Optional[str]         = None
    addresses:   Optional[str]         = None
    note:        Optional[str]         = None
    references:  Optional[str]         = None
    incidents:   Optional[str]         = None
    info_blocks: list[CAPInfo]         = field(default_factory=list)
