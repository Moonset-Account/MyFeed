"""Result data structures used by the contract comparator."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

Severity = Literal["compatible", "breaking", "unknown"]
Direction = Literal["request", "response"]


@dataclass
class Finding:
    severity: Severity
    kind: str
    direction: Direction
    message: str
    old_location: str
    new_location: str
    old_ref_chain: list[str] = field(default_factory=list)
    new_ref_chain: list[str] = field(default_factory=list)
    constraint: str = ""
    failure_example: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "severity": self.severity,
            "kind": self.kind,
            "direction": self.direction,
            "message": self.message,
            "oldLocation": self.old_location,
            "newLocation": self.new_location,
            "oldRefChain": self.old_ref_chain,
            "newRefChain": self.new_ref_chain,
            "constraint": self.constraint,
            "failureExample": self.failure_example,
        }


@dataclass
class OperationReport:
    path: str
    method: str
    old_operation_id: str | None
    new_operation_id: str | None
    findings: list[Finding]

    @property
    def severity(self) -> Severity:
        if any(item.severity == "breaking" for item in self.findings):
            return "breaking"
        if any(item.severity == "unknown" for item in self.findings):
            return "unknown"
        return "compatible"

    def to_dict(self) -> dict[str, Any]:
        return {
            "path": self.path,
            "method": self.method.upper(),
            "oldOperationId": self.old_operation_id,
            "newOperationId": self.new_operation_id,
            "severity": self.severity,
            "findings": [item.to_dict() for item in self.findings],
        }
