from pydantic import BaseModel, Field
from typing import Any


class MatchRules(BaseModel):
    headers: dict[str, str] = Field(default_factory=dict)
    body: dict[str, Any] = Field(default_factory=dict)
    query: dict[str, str] = Field(default_factory=dict)


class MockResponse(BaseModel):
    status: int = 200
    headers: dict[str, str] = Field(default_factory=dict)
    body: Any = None
    delay_ms: int = 0


class Flavor(BaseModel):
    id: str
    name: str
    priority: int = 0
    is_default: bool = False
    match: MatchRules = Field(default_factory=MatchRules)
    response: MockResponse = Field(default_factory=MockResponse)


class Endpoint(BaseModel):
    id: str
    path: str
    method: str  # GET | POST | PUT | DELETE | PATCH | ANY
    is_active: bool = True
    flavors: list[Flavor] = Field(default_factory=list)


class Gateway(BaseModel):
    id: str
    name: str
    base_path: str
    is_active: bool = True
    endpoints: list[Endpoint] = Field(default_factory=list)


class EngineResult(BaseModel):
    matched: bool
    flavor_name: str | None = None
    response: MockResponse = Field(default_factory=MockResponse)
