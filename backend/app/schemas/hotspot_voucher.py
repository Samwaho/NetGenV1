import strawberry
from datetime import datetime
from typing import Optional, List
from dataclasses import field
from enum import Enum

@strawberry.enum
class VoucherStatus(str, Enum):
    ACTIVE = "active"
    IN_USE = "in_use"
    EXPIRED = "expired"
    DEPLETED = "depleted"  # For data-limited vouchers
    REVOKED = "revoked"

@strawberry.type
class HotspotVoucher:
    id: str
    code: str
    packageId: str
    organizationId: str
    macAddress: Optional[str] = None
    paymentMethod: str
    paymentReference: Optional[str] = None
    status: VoucherStatus
    createdAt: datetime
    expiresAt: datetime
    usedAt: Optional[datetime] = None
    # Data usage tracking
    dataUsed: Optional[int] = None
    dataLimit: Optional[int] = None
    dataLimitUnit: Optional[str] = None
    # Duration tracking
    duration: Optional[int] = None
    durationUnit: Optional[str] = None
    timeUsed: Optional[int] = None
    sessionStart: Optional[datetime] = None
    sessionEnd: Optional[datetime] = None

@strawberry.type
class HotspotVoucherResponse:
    success: bool
    message: str
    voucher: Optional[HotspotVoucher] = None

@strawberry.type
class HotspotVouchersResponse:
    success: bool
    message: str
    vouchers: List[HotspotVoucher] = field(default_factory=list)
    totalCount: Optional[int] = None

@strawberry.input
class GenerateVouchersInput:
    organizationId: str
    packageId: str
    count: int = 1
    prefix: Optional[str] = None
    expiryDate: Optional[datetime] = None
    # Data limit
    dataLimit: Optional[int] = None
    dataLimitUnit: Optional[str] = "MB"
    # Duration limit
    duration: Optional[int] = None
    durationUnit: Optional[str] = "hours"
