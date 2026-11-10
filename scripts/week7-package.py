"""Package the week 7 source, docs and actual verification evidence."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output/week7-submission.zip"
TOP_LEVEL = [
    ".env.example", ".gitignore", ".gitattributes", ".prettierrc",
    ".oxlintrc.json", "README.md", "package.json", "package-lock.json",
    "pnpm-lock.yaml", "nest-cli.json", "tsconfig.json", "tsconfig.build.json",
    "vitest.config.ts", "vitest.config.e2e.ts",
]
DIRECTORIES = ["src", "test", "sql", "docs/week7", "output/week7"]
paths = {ROOT / name for name in TOP_LEVEL if (ROOT / name).is_file()}
for directory in DIRECTORIES:
    paths.update(path for path in (ROOT / directory).rglob("*") if path.is_file() and not path.is_symlink())
paths.update(path for path in (ROOT / "scripts").glob("week7-*") if path.is_file())

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as archive:
    for path in sorted(paths):
        relative = path.relative_to(ROOT)
        if path.name == ".env" or any(part in {"node_modules", ".git", ".tmp", "__pycache__"} for part in relative.parts):
            raise RuntimeError(f"Unexpected private or generated input: {relative}")
        archive.write(path, relative.as_posix())
with ZipFile(OUTPUT) as archive:
    bad = archive.testzip()
    if bad:
        raise RuntimeError(f"Invalid archive member: {bad}")
print(f"Created {OUTPUT} ({len(paths)} files, {OUTPUT.stat().st_size:,} bytes)")
