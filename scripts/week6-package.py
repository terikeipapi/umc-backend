"""Package only source/configuration and reviewable week6 outputs; never secrets."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parents[1]
target = root / 'output/week6-submission.zip'
files = set()
for name in ['src', 'test', 'docs/week6', 'output/week6', 'output/pdf']:
    files.update(path for path in (root / name).rglob('*') if path.is_file())
files.update((root / 'scripts').glob('week6-*'))
for name in [
    'README.md', 'package.json', 'package-lock.json', 'pnpm-lock.yaml',
    'nest-cli.json', 'tsconfig.json', 'tsconfig.build.json',
    'vitest.config.ts', 'vitest.config.e2e.ts',
    '.env.example', '.gitignore', '.gitattributes', '.prettierrc', '.oxlintrc.json',
    'sql/week6-schema.sql',
]:
    files.add(root / name)
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    archive.writestr('START-HERE.md', '''# 6주차 백엔드 실습·필수 미션

먼저 docs/week6/SUBMISSION.md를 열어 제출물 목록과 핵심 코드 링크를 확인하세요.

- 보고서: output/pdf/week6-submission.pdf
- 인증 이미지 13장: output/week6/screenshots/
- 실제 요청·응답 보기: output/week6/report.html
- API 명세: docs/week6/API.md
- Postman: docs/week6/week6.postman_collection.json 및 environment.json
- 트러블슈팅: docs/week6/TROUBLESHOOTING.md

검증: 빌드 성공, 단위 1/1, E2E 106/106, 실제 HTTP 29/29.

실행은 .env.example을 참고해 로컬 MySQL의 기존 DB에 접속하는 .env를 준비한 후
npm install → npm run week6:db → npm run build → npm run start:prod 순서입니다.
DB가 없다면 먼저 로컬 MySQL에 DB를 생성하고 DB_NAME에 지정하세요.
별도 터미널에서 npm run week6:verify를 실행할 수 있습니다.

실제 비밀번호가 있는 .env와 node_modules는 포함하지 않았습니다.
스터디 모임 사진은 실제 촬영 사진을 별도로 첨부하세요.
GitHub 저장소: https://github.com/terikeipapi/umc-backend
UMC 제출 사이트 업로드는 별도로 진행하세요.
''')
    for path in sorted(files):
        relative = path.relative_to(root)
        assert path.is_file(), str(path)
        assert relative.as_posix() != '.env'
        assert not any(part in ['node_modules', '.git', '__pycache__'] for part in relative.parts)
        archive.write(path, relative.as_posix())

with ZipFile(target) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert 'docs/week6/SUBMISSION.md' in names
    assert 'output/pdf/week6-submission.pdf' in names
    assert len([name for name in names if name.startswith('output/week6/screenshots/') and name.endswith('.png')]) == 13
print(json.dumps({'path': str(target), 'fileCount': len(names), 'bytes': target.stat().st_size}, ensure_ascii=True))
