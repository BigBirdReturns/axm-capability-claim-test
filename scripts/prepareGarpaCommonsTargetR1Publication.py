#!/usr/bin/env python3
"""Materialize the exact governed R1 payload from qualified gate evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import zipfile


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence-zip", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    evidence_zip = Path(args.evidence_zip)
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(evidence_zip) as archive:
        request = json.loads(archive.read("request.json"))

    release_request = request["seededPublicRegistryRequest"]["seededReleaseRequest"]
    manifest = release_request["releaseManifest"]
    release_files = sorted(release_request["releaseFiles"], key=lambda item: item["path"])
    release_envelope = release_request["releaseEnvelope"]

    if manifest["releaseId"] != "GARPA-COMMONS-TARGET-0001-R1":
        raise RuntimeError(f"Unexpected release ID: {manifest['releaseId']}")
    if len(release_files) != len(manifest["files"]):
        raise RuntimeError("Release payload and manifest file counts differ.")

    observed: list[dict[str, object]] = []
    for item in release_files:
        path = output / item["path"]
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = item["content"].encode("utf-8")
        actual_sha = sha256(payload)
        actual_length = len(payload)
        if actual_sha != item["sha256"]:
            raise RuntimeError(f"Digest mismatch before publication: {item['path']}")
        if actual_length != item["byteLength"]:
            raise RuntimeError(f"Length mismatch before publication: {item['path']}")
        path.write_bytes(payload)
        observed.append(
            {
                "path": item["path"],
                "sha256": actual_sha,
                "byteLength": actual_length,
                "mediaType": item["mediaType"],
                "role": item["role"],
                "required": item["required"],
            }
        )

    manifest_path = output / "release-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    archive_path = output / "GARPA-COMMONS-TARGET-0001-R1.zip"
    with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for item in release_files:
            payload = item["content"].encode("utf-8")
            info = zipfile.ZipInfo(item["path"], date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            info.create_system = 3
            archive.writestr(info, payload, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

    archive_bytes = archive_path.read_bytes()
    index = {
        "schemaVersion": 1,
        "releaseId": manifest["releaseId"],
        "caseId": manifest["caseId"],
        "releaseNumber": manifest["releaseNumber"],
        "releaseManifestDigest": manifest["manifestDigest"],
        "releaseBundleDigest": release_envelope["bundleDigest"],
        "releaseFileSetDigest": release_envelope["fileSetDigest"],
        "archivePath": archive_path.name,
        "archiveSha256": sha256(archive_bytes),
        "archiveByteLength": len(archive_bytes),
        "fileCount": len(observed),
        "files": observed,
        "publicReleaseOccurred": False,
        "publicRegistryPublished": False,
    }
    (output / "distribution-index.json").write_text(
        json.dumps(index, indent=2) + "\n", encoding="utf-8"
    )

    checksums = []
    for path in sorted(item for item in output.rglob("*") if item.is_file()):
        if path.name == "SHA256SUMS":
            continue
        checksums.append(f"{sha256(path.read_bytes())}  {path.relative_to(output).as_posix()}")
    (output / "SHA256SUMS").write_text("\n".join(checksums) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
