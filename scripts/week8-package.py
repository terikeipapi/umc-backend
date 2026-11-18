"""Package current week 8 sources, documents and real verification artifacts.

Run after verification records, documentation and screenshots are final.
Only explicit source/configuration locations are included; local credentials,
installed dependencies, build output and temporary files are never traversed.
"""
import argparse
import json
from hashlib import sha256
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output/week8-workbook-submission.zip"
TOP_LEVEL = [
    ".env.example", ".gitignore", ".gitattributes", ".prettierrc",
    ".oxlintrc.json", "README.md", "package.json", "package-lock.json",
    "pnpm-lock.yaml", "nest-cli.json", "tsconfig.json", "tsconfig.build.json",
    "vitest.config.ts", "vitest.config.e2e.ts",
]
DIRECTORIES = ["src", "test", "sql", "docs/week8", "output/week8-workbook"]
REQUIRED_SCRIPTS = ["week6-db.mjs", "week7-db.mjs", "week8-db.mjs"]
FORBIDDEN_PARTS = {"node_modules", "dist", ".git", ".tmp", "__pycache__", ".pytest_cache"}
REQUIRED_EVIDENCE = [
    "output/week8-workbook/evidence.json",
    "output/week8-workbook/newman-results.json",
    "output/week8-workbook/captures/01-favorite-created-201.png",
    "output/week8-workbook/captures/02-favorite-duplicate-409.png",
    "output/week8-workbook/captures/03-favorite-list-200.png",
    "output/week8-workbook/captures/04-favorite-status-200.png",
    "output/week8-workbook/captures/05-favorite-deleted-200.png",
    "output/week8-workbook/captures/06-movie-record-created-201.png",
    "output/week8-workbook/captures/07-transaction-source.png",
    "docs/week8/SUBMISSION.md",
    "docs/week8/TROUBLESHOOTING.md",
    "docs/week8/API.md",
]


def collect_paths():
    paths = {ROOT / name for name in TOP_LEVEL if (ROOT / name).is_file()}
    for directory in DIRECTORIES:
        paths.update(path for path in (ROOT / directory).rglob("*") if path.is_file() and not path.is_symlink())
    paths.update(path for path in (ROOT / "scripts").glob("week8-*") if path.is_file() and not path.is_symlink())
    paths.update(ROOT / "scripts" / name for name in REQUIRED_SCRIPTS)
    for path in paths:
        relative = path.relative_to(ROOT)
        if not path.is_file():
            raise RuntimeError(f"Missing required source: {relative}")
        if any(part in FORBIDDEN_PARTS for part in relative.parts):
            raise RuntimeError(f"Unexpected generated/private input: {relative}")
        if path.name.startswith(".env") and path.name != ".env.example":
            raise RuntimeError(f"Credential input must never be packaged: {relative}")
        if path.suffix.lower() in {".zip", ".pyc"} or path.name.endswith(".tsbuildinfo"):
            raise RuntimeError(f"Unexpected archive/cache input: {relative}")
    return sorted(paths)


def verify_evidence():
    for name in REQUIRED_EVIDENCE:
        if not (ROOT / name).is_file():
            raise RuntimeError(f"Finalize this submission artifact before packaging: {name}")
    data = json.loads((ROOT / REQUIRED_EVIDENCE[0]).read_text(encoding="utf-8"))
    if data.get("allPassed") is not True:
        raise RuntimeError("Only a successful live verification record may be submitted.")
    newman = json.loads((ROOT / REQUIRED_EVIDENCE[1]).read_text(encoding="utf-8"))
    if newman.get("failures") or newman.get("stats", {}).get("assertions", {}).get("failed") != 0:
        raise RuntimeError("The Postman Collection must have no failed assertions.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list-only", action="store_true", help="Review package inputs without creating an archive.")
    args = parser.parse_args()
    paths = collect_paths()
    if args.list_only:
        for path in paths:
            print(path.relative_to(ROOT).as_posix())
        print(f"Reviewed {len(paths)} candidate files; archive not created.")
        return
    verify_evidence()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    manifest = {
        "purpose": "Backend week 8 workbook submission; source, reports and verification evidence.",
        "excluded": ["Real .env files", "node_modules", "dist", ".git", ".tmp", "Original course PDF"],
        "files": [{"path": path.relative_to(ROOT).as_posix(), "sha256": sha256(path.read_bytes()).hexdigest()} for path in paths],
    }
    with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as archive:
        for path in paths:
            archive.write(path, path.relative_to(ROOT).as_posix())
        archive.writestr("SUBMISSION-MANIFEST.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    with ZipFile(OUTPUT) as archive:
        bad = archive.testzip()
        if bad:
            raise RuntimeError(f"Invalid archive member: {bad}")
        members = archive.namelist()
        if len(members) != len(paths) + 1:
            raise RuntimeError("Archive manifest count does not match source files.")
    print(f"Created {OUTPUT.relative_to(ROOT)} ({len(paths)} source/artifact files plus manifest, {OUTPUT.stat().st_size:,} bytes).")


if __name__ == "__main__":
    main()
