from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── Flavor ────────────────────────────────────────────────────────────────────

class FlavorMatch(BaseModel):
    headers: dict[str, str] = Field(default_factory=dict)
    body: dict[str, Any] = Field(default_factory=dict)
    query: dict[str, str] = Field(default_factory=dict)


class FlavorResponse(BaseModel):
    status: int = 200
    headers: dict[str, str] = Field(default_factory=dict)
    body: Any = None
    delay_ms: int = 0


class FlavorCreate(BaseModel):
    name: str
    priority: int = 0
    is_default: bool = False
    match: FlavorMatch = Field(default_factory=FlavorMatch)
    response: FlavorResponse = Field(default_factory=FlavorResponse)


class FlavorUpdate(BaseModel):
    name: str | None = None
    priority: int | None = None
    is_default: bool | None = None
    match: FlavorMatch | None = None
    response: FlavorResponse | None = None


# ── Endpoint ──────────────────────────────────────────────────────────────────

class EndpointCreate(BaseModel):
    path: str
    method: str
    description: str | None = None
    is_active: bool = True
    flavors: list[FlavorCreate] = Field(default_factory=list)


class EndpointUpdate(BaseModel):
    path: str | None = None
    method: str | None = None
    description: str | None = None
    is_active: bool | None = None
    flavors: list[FlavorCreate] | None = None


# ── Gateway ───────────────────────────────────────────────────────────────────

class GatewayCreate(BaseModel):
    name: str
    base_path: str
    description: str | None = None
    is_active: bool = True


class GatewayUpdate(BaseModel):
    name: str | None = None
    base_path: str | None = None
    description: str | None = None
    is_active: bool | None = None


class GatewayResponse(BaseModel):
    id: str
    name: str
    base_path: str
    description: str | None = None
    is_active: bool
    created_at: datetime | None = None
    endpoints: list[dict] = Field(default_factory=list)
