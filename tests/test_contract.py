from backend.contract import compare_contracts


def operation(result, method="GET", path="/things"):
    for group in result["operations"]:
        if group["method"] == method and group["path"] == path:
            return group
    raise AssertionError(f"operation {method} {path} not found")


def constraints(group):
    return {item["constraint"]: item for item in group["findings"]}


def statuses(result):
    return result["summary"]


def json_body(schema):
    return {"content": {"application/json": {"schema": schema}}}


def get_doc(path="/things", query=None, response_schema=None, body=None):
    parameters = []
    if query is not None:
        parameters.append({"name": "mode", "in": "query", "required": False, "schema": query})
    operation = {"responses": {"200": {"description": "ok", **json_body(response_schema)}}}
    if parameters:
        operation["parameters"] = parameters
    if body is not None:
        operation["requestBody"] = body
    return {"openapi": "3.0.0", "paths": {path: {"get": operation}}}


def post_doc(request_schema, old_required=True):
    return {
        "openapi": "3.0.0",
        "paths": {
            "/things": {
                "post": {
                    "requestBody": {
                        "required": old_required,
                        "content": {"application/json": {"schema": request_schema}},
                    },
                    "responses": {"201": {"description": "created"}},
                }
            }
        },
    }


def test_request_and_response_enum_have_opposite_breaking_directions():
    old = get_doc(
        query={"type": "string", "enum": ["fast", "safe"], "description": "old"},
        response_schema={"type": "string", "enum": ["new", "paid"], "description": "old"},
    )
    new = get_doc(
        query={"type": "string", "enum": ["safe"], "description": "new"},
        response_schema={"type": "string", "enum": ["new", "paid", "refunded"], "description": "new"},
    )

    result = compare_contracts(old, new)
    group = operation(result)

    assert result["status"] == "breaking"
    enum_findings = [f for f in group["findings"] if f["constraint"] == "enum"]
    assert len(enum_findings) == 2
    request_finding = next(f for f in enum_findings if f["direction"] == "request")
    response_finding = next(f for f in enum_findings if f["direction"] == "response")
    assert request_finding["sample"]["oldRequest"]["query"] == {"mode": "fast"}
    assert response_finding["sample"]["newResponse"]["body"] == "refunded"


def test_required_changes_are_directional():
    old_doc = post_doc({
        "type": "object",
        "required": ["id"],
        "properties": {"id": {"type": "string"}, "name": {"type": "string"}},
    })
    new_doc = post_doc({
        "type": "object",
        "required": ["id", "name"],
        "properties": {"id": {"type": "string"}, "name": {"type": "string"}},
    })
    request_result = compare_contracts(old_doc, new_doc)
    request_group = operation(request_result, "POST")
    request_finding = constraints(request_group)["object.required"]
    assert request_finding["status"] == "breaking"
    assert request_finding["sample"]["oldRequest"]["body"] == {"id": "example"}

    old_response = get_doc(response_schema={
        "type": "object",
        "required": ["id", "state"],
        "properties": {"id": {"type": "string"}, "state": {"type": "string"}},
    })
    new_response = get_doc(response_schema={
        "type": "object",
        "required": ["id"],
        "properties": {"id": {"type": "string"}, "state": {"type": "string"}},
    })
    response_result = compare_contracts(old_response, new_response)
    response_group = operation(response_result)
    response_finding = constraints(response_group)["object.required"]
    assert response_finding["status"] == "breaking"
    assert response_finding["sample"]["newResponse"]["body"] == {"id": "example"}


def test_descriptions_and_identical_constraints_do_not_report():
    old = {
        "openapi": "3.0.0",
        "info": {"title": "old", "version": "1.0.0", "description": "old"},
        "paths": {
            "/things": {
                "get": {
                    "description": "old operation",
                    "responses": {
                        "200": {
                            "description": "old response",
                            "content": {"application/json": {"schema": {
                                "type": "object",
                                "description": "old object",
                                "required": ["id"],
                                "properties": {"id": {"type": "string", "description": "old id"}},
                            }}},
                        }
                    },
                }
            }
        },
    }
    new = deepcopy_docs(old)
    new["info"]["description"] = "new"
    schema = new["paths"]["/things"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]
    schema["description"] = "new object"
    schema["properties"]["id"]["description"] = "new id"

    result = compare_contracts(old, new)
    assert result["status"] == "compatible"
    assert result["summary"] == {"compatible": 1, "breaking": 0, "unknown": 0}
    assert result["findings"][0]["constraint"] == "operation"


def test_local_references_are_resolved():
    old = {
        "openapi": "3.0.0",
        "paths": {"/things/{id}": {"get": {"parameters": [
            {"name": "id", "in": "path", "required": True, "schema": {"$ref": "#/components/schemas/Id"}}
        ], "responses": {"200": {"description": "ok", **json_body({"$ref": "#/components/schemas/Thing"})}}}}},
        "components": {"schemas": {
            "Id": {"type": "string"},
            "Thing": {"type": "object", "required": ["id"], "properties": {"id": {"$ref": "#/components/schemas/Id"}}},
        }},
    }
    new = deepcopy_docs(old)
    new["components"]["schemas"]["Thing"]["required"] = []

    result = compare_contracts(old, new)
    group = operation(result, path="/things/{id}")
    assert constraints(group)["object.required"]["status"] == "breaking"
    chain = constraints(group)["object.required"]["referenceChains"]["old"]
    assert chain == ["#/components/schemas/Thing"]


def test_external_reference_is_unknown_but_does_not_hide_breaking_difference():
    old = get_doc(
        query={"type": "string", "enum": ["fast", "safe"]},
        response_schema={"$ref": "other.json#/components/schemas/Thing"},
    )
    new = get_doc(
        query={"type": "string", "enum": ["safe"]},
        response_schema={"$ref": "other.json#/components/schemas/Thing"},
    )

    result = compare_contracts(old, new)
    group = operation(result)
    assert group["status"] == "breaking"
    by_constraint = constraints(group)
    assert by_constraint["enum"]["status"] == "breaking"
    assert by_constraint["$ref"]["status"] == "unknown"
    assert "外部引用" in by_constraint["$ref"]["message"]


def test_cyclic_reference_is_unknown_but_does_not_hide_breaking_difference():
    old = get_doc(
        query={"type": "string", "enum": ["fast", "safe"]},
        response_schema={"$ref": "#/components/schemas/Loop"},
    )
    old["components"] = {"schemas": {"Loop": {"$ref": "#/components/schemas/Loop"}}}
    new = get_doc(
        query={"type": "string", "enum": ["safe"]},
        response_schema={"$ref": "#/components/schemas/Loop"},
    )
    new["components"] = {"schemas": {"Loop": {"$ref": "#/components/schemas/Loop"}}}

    result = compare_contracts(old, new)
    group = operation(result)
    by_constraint = constraints(group)
    assert by_constraint["enum"]["status"] == "breaking"
    assert by_constraint["$ref"]["status"] == "unknown"
    assert "循环引用" in by_constraint["$ref"]["message"]


def test_nullable_is_directional():
    old = get_doc(response_schema={"type": "string", "nullable": True})
    new = get_doc(response_schema={"type": "string", "nullable": False})
    # Response becoming non-nullable strengthens the guarantee, compatible.
    assert compare_contracts(old, new)["status"] == "compatible"

    old_request = get_doc(query={"type": "string", "nullable": True})
    new_request = get_doc(query={"type": "string", "nullable": False})
    request_result = compare_contracts(old_request, new_request)
    assert constraints(operation(request_result))["nullable"]["status"] == "breaking"

    old_response = get_doc(response_schema={"type": "string", "nullable": False})
    new_response = get_doc(response_schema={"type": "string", "nullable": True})
    response_result = compare_contracts(old_response, new_response)
    assert constraints(operation(response_result))["nullable"]["status"] == "breaking"


def test_number_integer_and_unknown_constraint_do_not_mask_each_other():
    old = get_doc(
        query={"type": "number", "minimum": 1},
        response_schema={"type": "integer", "minimum": 1},
    )
    new = get_doc(
        query={"type": "integer", "minimum": 2},
        response_schema={"type": "number", "minimum": 2},
    )
    result = compare_contracts(old, new)
    group = operation(result)
    by_constraint = constraints(group)
    assert len(by_constraint["type"]) if isinstance(by_constraint["type"], list) else True
    type_findings = [f for f in group["findings"] if f["constraint"] == "type"]
    assert {f["direction"] for f in type_findings} == {"request", "response"}
    assert all(f["status"] == "breaking" for f in type_findings)
    assert any(f["constraint"] == "minimum" and f["status"] == "unknown" for f in group["findings"])


def test_array_item_and_type_breakages_are_concrete():
    old = get_doc(response_schema={"type": "array", "items": {"type": "string", "enum": ["a", "b"]}})
    new = get_doc(response_schema={"type": "array", "items": {"type": "string", "enum": ["a", "c"]}})
    result = compare_contracts(old, new)
    group = operation(result)
    finding = constraints(group)["enum"]
    assert finding["status"] == "breaking"
    assert finding["sample"]["newResponse"]["body"] == ["c"]


def deepcopy_docs(value):
    import copy
    return copy.deepcopy(value)
