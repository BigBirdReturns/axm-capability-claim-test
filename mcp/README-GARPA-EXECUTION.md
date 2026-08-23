# GARPA execution MCP server

This local MCP server exposes the receipt, preflight, and mission-evaluation stage of GARPA without granting the model execution authority.

## Start

```bash
cd mcp
npm install
npx tsx garpa-execution-server.ts
```

An MCP client can point at the same command:

```text
npx tsx /ABSOLUTE/PATH/TO/axm-capability-claim-test/mcp/garpa-execution-server.ts
```

## Tools

### `validate_garpa_execution_receipt`

Validates one of:

```text
authority
build_receipt
test_run_receipt
preflight_request
mission_evaluation_request
```

The validator refuses dirty build trees, assembled builds with blocking deviations, valid runs without raw-data or log custody, valid runs with aborts or invalidating anomalies, malformed metric results, and inconsistent evaluation requests.

### `run_garpa_preflight`

Runs the execution stop rule. It checks digest continuity, build readiness, execution class, venue authority, authorization references, instrumentation, operator roles, fixture state, data custody, clock readiness, run identity, and abort custody.

A blocked result contains the exact reasons. It does not produce an execution token or control hardware.

### `evaluate_garpa_mission`

Evaluates only valid receipts that match the frozen build and qualification digests. Essential metrics are noncompensatory. Aborted, invalidated, incomplete, stale, and custody-defective runs remain visible but cannot count toward acceptance.

The states are:

```text
matched
bounded_match
partial
failed
incomparable
unassessed
```

## Trust boundary

The calling model may draft receipts or evaluation requests. The code validates the objects and computes the gate state. This server does not operate equipment, transmit signals, purchase components, alter thresholds, or convert a candidate architecture into a measured result.
