#!/usr/bin/env python3
"""Capture GitHub platform and immutable raw-file retrieval evidence."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import urllib.request


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def iso_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def fetch(url: str, token: str | None = None) -> bytes:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "garpa-external-distribution-observer/1.0",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
        headers["X-GitHub-Api-Version"] = "2022-11-28"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repository", required=True)
    parser.add_argument("--branch", required=True)
    parser.add_argument("--publish-sha", required=True)
    parser.add_argument("--release-dir", required=True)
    parser.add_argument("--evidence-dir", required=True)
    args = parser.parse_args()

    release_dir = Path(args.release_dir)
    evidence_dir = Path(args.evidence_dir)
    evidence_dir.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((release_dir / "release-manifest.json").read_text(encoding="utf-8"))
    index = json.loads((release_dir / "distribution-index.json").read_text(encoding="utf-8"))
    release_id = manifest["releaseId"]
    base_path = f"public/releases/{release_id}"
    raw_base = f"https://raw.githubusercontent.com/{args.repository}/{args.publish_sha}/{base_path}"
    destination_uri = (
        f"https://github.com/{args.repository}/tree/{args.publish_sha}/{base_path}"
    )
    token = os.environ.get("GITHUB_TOKEN")

    commit_api = f"https://api.github.com/repos/{args.repository}/commits/{args.publish_sha}"
    commit_payload = json.loads(fetch(commit_api, token).decode("utf-8"))
    observed_at = iso_now()
    published_at = commit_payload["commit"]["committer"]["date"]

    platform_receipt = {
        "schemaVersion": 1,
        "platform": "github",
        "repository": args.repository,
        "branch": args.branch,
        "publishCommit": args.publish_sha,
        "publishTree": commit_payload["commit"]["tree"]["sha"],
        "commitApiUri": commit_api,
        "commitHtmlUri": commit_payload["html_url"],
        "destinationUri": destination_uri,
        "releaseId": release_id,
        "releaseManifestDigest": manifest["manifestDigest"],
        "publishedAt": published_at,
        "capturedAt": observed_at,
        "commitVerification": commit_payload.get("commit", {}).get("verification"),
    }
    platform_path = evidence_dir / "platform-receipt.json"
    platform_path.write_text(json.dumps(platform_receipt, indent=2) + "\n", encoding="utf-8")

    observations: list[dict[str, object]] = []
    for expected in manifest["files"]:
        uri = f"{raw_base}/{expected['path']}"
        payload = fetch(uri)
        observed_sha = sha256(payload)
        observed_length = len(payload)
        matches = (
            observed_sha == expected["sha256"]
            and observed_length == expected["byteLength"]
        )
        observations.append(
            {
                "path": expected["path"],
                "uri": uri,
                "expectedSha256": expected["sha256"],
                "observedSha256": observed_sha,
                "expectedByteLength": expected["byteLength"],
                "observedByteLength": observed_length,
                "matches": matches,
            }
        )
        if not matches:
            raise RuntimeError(f"Immutable retrieval mismatch: {expected['path']}")

    archive_uri = f"{raw_base}/{index['archivePath']}"
    archive_payload = fetch(archive_uri)
    archive_sha = sha256(archive_payload)
    if archive_sha != index["archiveSha256"]:
        raise RuntimeError("Published archive digest mismatch.")

    manifest_uri = f"{raw_base}/release-manifest.json"
    manifest_payload = fetch(manifest_uri)
    retrieval_capture = {
        "schemaVersion": 1,
        "repository": args.repository,
        "branch": args.branch,
        "publishCommit": args.publish_sha,
        "destinationUri": destination_uri,
        "releaseId": release_id,
        "releaseManifestDigest": manifest["manifestDigest"],
        "releaseBundleDigest": index["releaseBundleDigest"],
        "observedAt": observed_at,
        "files": observations,
        "allReleaseFilesMatched": all(item["matches"] for item in observations),
        "archive": {
            "uri": archive_uri,
            "expectedSha256": index["archiveSha256"],
            "observedSha256": archive_sha,
            "observedByteLength": len(archive_payload),
            "matches": True,
        },
        "manifest": {
            "uri": manifest_uri,
            "observedSha256": sha256(manifest_payload),
            "observedByteLength": len(manifest_payload),
        },
    }
    retrieval_path = evidence_dir / "retrieval-capture.json"
    retrieval_path.write_text(json.dumps(retrieval_capture, indent=2) + "\n", encoding="utf-8")

    metadata = {
        "schemaVersion": 1,
        "repository": args.repository,
        "branch": args.branch,
        "publishCommit": args.publish_sha,
        "releaseId": release_id,
        "destinationUri": destination_uri,
        "publishedAt": published_at,
        "observedAt": observed_at,
        "platformReceiptPath": platform_path.relative_to(release_dir).as_posix(),
        "retrievalCapturePath": retrieval_path.relative_to(release_dir).as_posix(),
        "releaseManifestPath": "release-manifest.json",
        "releaseManifestObservedSha256": sha256(manifest_payload),
    }
    (evidence_dir / "event-metadata.json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
