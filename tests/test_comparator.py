from backend.src.comparator import compare_documents


def operation(method="post", path="/orders", request_schema=None, response_schema=None, status="201"):
    op = {
        "responses": {
            status: {
                "description": "old response" if request_schema is None else "new response",
                "content": {"application/json": {"schema": response_schema or {"type": "object"}}},
            }
        }
    }
    if request_schema is not None:
        op["requestBody"] = {
            "required": True,
            "description": "description changes are annotations",
            "content": {"application/json": {"schema": request_schema}},
        }
    return {"paths": {path: {method: op}}}


def doc(extra, components=None):
    data = {
        "openapi": "3.0.3",
        "info": {"title": "Contract", "version": "1.0.0", "description": "doc text"},
    }
    data.update(extra)
    if components:
        data["components"] = {"schemas": components}
    return data


def kinds(result, severity=None):
    findings = result["operations"][0]["findings"]
    if severity:
        findings = [item for item in findings if item["severity"] == severity]
    return [item["kind"] for item in findings]


def test_request_and_response_enum_direction_regression_with_local_refs():
    old = doc(
        operation(
            request_schema={"$ref": "#/components/schemas/Req"},
            response_schema={"$ref": "#/components/schemas/Resp"},
        ),
        {
            "Req": {
                "type": "object",
                "required": ["status"],
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "old explanatory text",
                        "enum": ["draft", "submitted"],
                        "nullable": True,
                    }
                },
            },
            "Resp": {
                "type": "object",
                "required": ["id", "status"],
                "properties": {
                    "id": {"type": "integer", "description": "identifier"},
                    "status": {"type": "string", "enum": ["draft", "submitted"]},
                },
            },
        },
    )
    new = doc(
        operation(
            request_schema={"$ref": "#/components/schemas/Req2"},
            response_schema={"$ref": "#/components/schemas/Resp2"},
        ),
        {
            "Req2": {
                "type": "object",
                "required": ["status", "tenantId"],
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "new explanatory text",
                        "enum": ["submitted"],
                        "nullable": False,
                    },
                    "tenantId": {"type": "string"},
                },
            },
            "Resp2": {
                "type": "object",
                "required": ["status"],
                "properties": {
                    "id": {"type": "integer", "description": "a changed identifier note"},
                    "status": {"type": "string", "enum": ["draft", "submitted", "cancelled"]},
                },
            },
        },
    )

    result = compare_documents(old, new)
    breaking = kinds(result, "breaking")

    assert "required-property-added" in breaking
    assert "request-enum-value-removed" in breaking
    assert "nullable-removed" in breaking
    assert "required-response-property-removed" in breaking
    assert "response-enum-value-added" in breaking
    assert result["operations"][0]["severity"] == "breaking"

    by_kind = {item["kind"]: item for item in result["operations"][0]["findings"]}
    required_example = by_kind["required-property-added"]["failureExample"]["request"]["body"]
    assert "tenantId" not in required_example
    assert by_kind["request-enum-value-removed"]["failureExample"]["request"]["body"]["status"] == "draft"
    assert by_kind["response-enum-value-added"]["failureExample"]["response"]["body"]["status"] == "cancelled"
    assert by_kind["request-enum-value-removed"]["oldRefChain"] == ["#/components/schemas/Req"]
    assert by_kind["response-enum-value-added"]["newRefChain"] == ["#/components/schemas/Resp2"]
    assert "description" not in {item["constraint"] for item in result["operations"][0]["findings"]}


def test_request_and_response_type_directions_are_not_symmetrical():
    old = doc(operation(request_schema={"type": "integer"}, response_schema={"type": "number"}))
    new = doc(operation(request_schema={"type": "number"}, response_schema={"type": "integer"}))
    result = compare_documents(old, new)
    assert kinds(result) == []

    old = doc(operation(request_schema={"type": "number"}, response_schema={"type": "integer"}))
    new = doc(operation(request_schema={"type": "integer"}, response_schema={"type": "number"}))
    result = compare_documents(old, new)
    assert set(kinds(result, "breaking")) == {"schema-type-incompatible"}
    directions = {
        item["direction"]
        for item in result["operations"][0]["findings"]
        if item["kind"] == "schema-type-incompatible"
    }
    assert directions == {"request", "response"}


def test_array_response_enum_widening_and_required_removal_are_reported():
    old = doc(
        operation(response_schema={
            "type": "object",
            "required": ["items"],
            "properties": {"items": {"type": "array", "items": {"type": "string", "enum": ["a"]}}},
        })
    )
    new = doc(
        operation(response_schema={
            "type": "object",
            "properties": {"items": {"type": "array", "items": {"type": "string", "enum": ["a", "b"]}}},
        })
    )
    result = compare_documents(old, new)
    breaking = kinds(result, "breaking")
    assert "required-response-property-removed" in breaking
    assert "response-enum-value-added" in breaking
    example = next(
        item["failureExample"]["response"]["body"]
        for item in result["operations"][0]["findings"]
        if item["kind"] == "response-enum-value-added"
    )
    assert example == {"items": ["b"]}


def test_local_unknown_does_not_swallow_deterministic_breaking_change():
    old = doc(
        operation(
            request_schema={
                "type": "object",
                "required": ["safe"],
                "properties": {"safe": {"type": "string", "format": "date"}, "external": {"type": "string"}},
            }
        )
    )
    new = doc(
        operation(
            request_schema={
                "type": "object",
                "required": ["safe", "added"],
                "properties": {
                    "safe": {"type": "string", "format": "date-time"},
                    "added": {"type": "string"},
                    "external": {"$ref": "https://example.com/schema.json#/External"},
                },
            }
        )
    )
    result = compare_documents(old, new)
    severity = {item["kind"]: item["severity"] for item in result["operations"][0]["findings"]}
    assert severity["required-property-added"] == "breaking"
    assert severity["external-schema-reference"] == "unknown"
    assert severity["out-of-scope-constraint"] == "unknown"


def test_local_schema_cycle_is_unknown_without_network_lookup():
    old = doc(
        operation(request_schema={"$ref": "#/components/schemas/NodeA"}),
        {"NodeA": {"type": "object", "properties": {"child": {"$ref": "#/components/schemas/NodeB"}}},
         "NodeB": {"type": "object", "properties": {"child": {"$ref": "#/components/schemas/NodeA"}}}},
    )
    new = doc(
        operation(
            request_schema={"$ref": "#/components/schemas/NodeA2"},
        ),
        {"NodeA2": {"type": "object", "required": ["id"], "properties": {"id": {"type": "string"}, "child": {"$ref": "#/components/schemas/NodeB2"}}},
         "NodeB2": {"type": "object", "properties": {"child": {"$ref": "#/components/schemas/NodeA2"}}}},
    )
    result = compare_documents(old, new)
    assert "cyclic-schema-reference" in kinds(result, "unknown")
    assert "required-property-added" in kinds(result, "breaking")


def test_description_only_change_is_compatible():
    old = doc(
        operation(
            request_schema={"type": "object", "description": "old", "properties": {"a": {"type": "string", "description": "x"}}},
            response_schema={"type": "object", "description": "old response", "properties": {"a": {"type": "string"}}},
        )
    )
    new = doc(
        operation(
            request_schema={"type": "object", "description": "new", "properties": {"a": {"type": "string", "description": "y"}}},
            response_schema={"type": "object", "description": "new response", "properties": {"a": {"type": "string"}}},
        )
    )
    result = compare_documents(old, new)
    assert result["summary"] == {"total": 1, "compatible": 1, "breaking": 0, "unknown": 0}
    assert result["operations"][0]["findings"] == []


def test_removed_operation_is_breaking_with_old_request_example():
    old = doc({"paths": {"/old": {"get": {"operationId": "old", "responses": {"200": {"description": "ok"}}}}}})
    new = doc({"paths": {}})
    result = compare_documents(old, new)
    assert kinds(result, "breaking") == ["operation-removed"]
    example = result["operations"][0]["findings"][0]["failureExample"]
    assert example["request"] == {"method": "GET", "path": "/old", "unavailable": True}


def test_required_query_parameter_added_has_old_request_without_parameter():
    old = doc({"paths": {"/search": {"get": {"parameters": [], "responses": {"200": {"description": "ok"}}}}}})
    new = doc({
        "paths": {
            "/search": {
                "get": {
                    "parameters": [
                        {"name": "tenant", "in": "query", "required": True, "schema": {"type": "string"}}
                    ],
                    "responses": {"200": {"description": "ok"}},
                }
            }
        }
    })
    result = compare_documents(old, new)
    assert "parameter-added" in kinds(result, "breaking")
    finding = next(item for item in result["operations"][0]["findings"] if item["kind"] == "parameter-added")
    assert finding["failureExample"]["request"]["parameters"] == []


def test_array_item_enum_direction_is_separate_for_request_and_response():
    request_old = doc(operation(request_schema={"type": "array"}))
    request_new = doc(operation(request_schema={"type": "array", "items": {"type": "string", "enum": ["only"]}}))
    request_result = compare_documents(request_old, request_new)
    request_kind = "request-enum-added"
    assert request_kind in kinds(request_result, "breaking")
    assert request_result["operations"][0]["findings"][0]["failureExample"]["request"]["body"] == ["unexpected"]

    response_old = doc(operation(response_schema={"type": "array", "items": {"type": "string", "enum": ["only"]}}))
    response_new = doc(operation(response_schema={"type": "array"}))
    response_result = compare_documents(response_old, response_new)
    assert "response-enum-removed" in kinds(response_result, "breaking")


def test_external_reference_is_reported_as_unknown_without_dropping_other_findings():
    old = doc(
        operation(request_schema={
            "type": "object",
            "properties": {"local": {"type": "string"}, "remote": {"type": "string"}},
        })
    )
    new = doc(
        operation(request_schema={
            "type": "object",
            "required": ["local", "added"],
            "properties": {
                "local": {"type": "string"},
                "added": {"type": "string"},
                "remote": {"$ref": "https://example.com/schemas#/Remote"},
            },
        })
    )
    result = compare_documents(old, new)
    findings = result["operations"][0]["findings"]
    external = next(item for item in findings if item["kind"] == "external-schema-reference")
    assert external["severity"] == "unknown"
    assert external["newRefChain"] == ["https://example.com/schemas#/Remote"]
    assert "required-property-added" in kinds(result, "breaking")


def test_existing_query_parameter_enum_narrowing_uses_parameter_example():
    def document(enum_values=None):
        schema = {} if enum_values is None else {"type": "string", "enum": enum_values}
        return doc({
            "paths": {
                "/search": {
                    "get": {
                        "parameters": [
                            {"name": "q", "in": "query", "required": False, "schema": schema}
                        ],
                        "responses": {"200": {"description": "ok"}},
                    }
                }
            }
        })

    result = compare_documents(document(["a", "b"]), document(["a"]))
    finding = next(item for item in result["operations"][0]["findings"] if item["kind"] == "request-enum-value-removed")
    assert finding["failureExample"]["request"]["parameters"][0]["value"] == "b"


def test_external_parameter_reference_is_unknown_without_losing_operation_context():
    old = doc({
        "paths": {
            "/search": {
                "get": {
                    "parameters": [
                        {"$ref": "https://example.com/params#/Query", "name": "q", "in": "query"}
                    ],
                    "responses": {"200": {"description": "ok"}},
                }
            }
        }
    })
    new = doc({
        "paths": {
            "/search": {
                "get": {
                    "parameters": [{"name": "q", "in": "query", "schema": {"type": "string"}}],
                    "responses": {"200": {"description": "ok"}},
                }
            }
        }
    })
    result = compare_documents(old, new)
    assert "parameter-reference-unresolved" in kinds(result, "unknown")
    assert result["operations"][0]["method"] == "GET"
