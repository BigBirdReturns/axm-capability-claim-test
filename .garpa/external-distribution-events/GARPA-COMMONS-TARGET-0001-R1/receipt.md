# GARPA Commons-Seeded External Distribution Receipt

## State
- Case: GARPA-COMMONS-TARGET-0001
- Distribution receipt: external-distribution:GARPA-COMMONS-TARGET-0001-R1:github:1a90612ecf9d000207ff269be61fe3880b2a050f:v1
- Mode: observed_external_event
- Event kind: release_distribution
- Channel: public_repository_release
- Gate state: seeded_external_distribution_observed
- Receipt admitted: true
- External event observed: true
- Public release occurred: true
- Public registry published: false

## Governing release
- Release: GARPA-COMMONS-TARGET-0001-R1
- Manifest digest: aa23db73fcfa333d822fae938ad9b5d888138f640d833c69753ceca03f2eb0c1
- Bundle digest: 0d3b67fb7fe42a8a98b6f9060c236069dd2b2c8c5e48a07e8f3683ebd03928e6
- Registry entry digest: edd15c3f4ad344107d94a106c1c8b56a121e92e9d8603e9c965d13e1039190e6
- Destination: https://github.com/BigBirdReturns/axm-capability-claim-test/tree/1a90612ecf9d000207ff269be61fe3880b2a050f/public/releases/GARPA-COMMONS-TARGET-0001-R1

## Custody
- Expected files: 16
- Observed files: 16
- Evidence artifacts: 3
- Observation digest: d1dd9998117ad1a93c15f8eaac3dacff2201f4b040b307378e5c2444a99a251f
- Observed file-set digest: 334ace0b3064b8f1108e31ad707c29336497a60b4f95537a18667f5e60097439
- Evidence-artifact set digest: 6b6ca82aea2dae1b5d7d34a61d02a1fe652bd34fdea33ebf5b1c1df20b0bab21

## Evidence artifacts
- github-platform-receipt:1a90612ecf9d000207ff269be61fe3880b2a050f · platform_receipt · externally_attributed · 4c6120d474038a917f1bbfbd07f54486b3876aa50d89c3974b4967aa60a3a224
- github-retrieval-capture:1a90612ecf9d000207ff269be61fe3880b2a050f · retrieval_capture · local_measured · 61c7da86c41e1582ee66621825bc3ed840d164c0f648bf5f121a02236a48a8ec
- github-content-manifest:1a90612ecf9d000207ff269be61fe3880b2a050f · content_manifest · local_measured · 43a25e729ab48aeab0a24421f69fbfdea4cdf50f237a88c6400c9e4b82446ad1

## Findings
- None.

## Required actions
- None.

## Boundary
- A qualification fixture exercises receipt custody only and may never be represented as an observed external publication or distribution event.
- An observed external event requires the exact governing release bytes plus independently attributable platform and retrieval evidence; a claimant assertion alone is insufficient.
- External distribution or registry publication does not establish deployment authority or unrestricted product equivalence.
