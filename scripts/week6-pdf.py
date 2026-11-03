"""Render the submission report from verified HTTP records and screen captures."""
import json
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak,
)
from PIL import Image as PILImage

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'output/week6/evidence.json').read_text(encoding='utf-8'))
RECORDS = {entry['id']: entry for entry in DATA['requests']}
OUTPUT = ROOT / 'output/pdf/week6-submission.pdf'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Malgun', 'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('MalgunBold', 'C:/Windows/Fonts/malgunbd.ttf'))
pdfmetrics.registerFontFamily('Malgun', normal='Malgun', bold='MalgunBold')

INK = colors.HexColor('#14253b')
BLUE = colors.HexColor('#2463d1')
MUTED = colors.HexColor('#52647a')
LIGHT = colors.HexColor('#f0f5fb')
styles = {
    'title': ParagraphStyle('title', fontName='MalgunBold', fontSize=26, leading=38, textColor=INK, spaceAfter=15, wordWrap='CJK'),
    'h1': ParagraphStyle('h1', fontName='MalgunBold', fontSize=20, leading=29, textColor=INK, spaceAfter=14, wordWrap='CJK'),
    'h2': ParagraphStyle('h2', fontName='MalgunBold', fontSize=12, leading=19, textColor=INK, spaceBefore=13, spaceAfter=7, wordWrap='CJK'),
    'body': ParagraphStyle('body', fontName='Malgun', fontSize=9.5, leading=16, textColor=INK, spaceAfter=8, wordWrap='CJK'),
    'small': ParagraphStyle('small', fontName='Malgun', fontSize=8, leading=12, textColor=MUTED, spaceAfter=6, wordWrap='CJK'),
    'code': ParagraphStyle('code', fontName='Malgun', fontSize=8, leading=12, textColor=INK, backColor=LIGHT, borderPadding=9, spaceAfter=11, wordWrap='CJK'),
}
story = []

def p(text, kind='body'):
    return Paragraph(text, styles[kind])

def add(text, kind='body'):
    story.append(p(text, kind))

def table(rows, widths, header=True):
    content = [[p(escape(str(cell)), 'small') for cell in row] for row in rows]
    t = Table(content, colWidths=widths, hAlign='LEFT')
    commands = [
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 9),
        ('RIGHTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LINEBELOW', (0, 0), (-1, -1), .4, colors.HexColor('#dce4ee')),
    ]
    if header:
        commands.append(('BACKGROUND', (0, 0), (-1, 0), LIGHT))
    t.setStyle(TableStyle(commands))
    story.append(t)
    story.append(Spacer(1, 8))

def code(text):
    add(escape(text).replace(' ', '&#160;').replace('\n', '<br/>'), 'code')

def page(title, label):
    if story:
        story.append(PageBreak())
    add(label, 'small')
    add(title, 'h1')

def shot(record_id):
    path = ROOT / 'output/week6/screenshots' / f'{record_id}.png'
    with PILImage.open(path) as image:
        width, height = image.size
    display_width = 505
    display_height = display_width * height / width
    if display_height > 385:
        display_width *= 385 / display_height
        display_height = 385
    story.append(Image(str(path), width=display_width, height=display_height, hAlign='LEFT'))
    story.append(Spacer(1, 8))
    add(f"실제 HTTP 실행 기록 화면 | {escape(DATA['runAtSeoul'])} (Asia/Seoul)", 'small')

def response(record_id):
    record = RECORDS[record_id]
    r = record['response']
    add(f"<b>{record['request']['method']} {escape(record['request']['path'])}</b> → {r['status']} {escape(r['statusText'])}")
    code(r['raw'] if r['raw'] else '(empty body)')

add('UMC BACKEND / WEEK 06', 'small')
add('회원가입과 영화 평점<br/>실습·필수 미션 수행 기록', 'title')
add(f"검증 일시: {escape(DATA['runAtSeoul'])} (Asia/Seoul)<br/>구현 스택: NestJS + MySQL / 실행 주소: {escape(DATA['baseUrl'])}")
table([
    ['자동 테스트', '실제 HTTP 검증', 'DB 확인'],
    ['단위 1/1 · E2E 106/106', f"{DATA['passedCount']}/{DATA['requestCount']} 통과", 'bcrypt · UNIQUE · 삭제 확인'],
], [168, 168, 169])
add('수행 내용', 'h2')
add('실습 1: 회원가입 DTO 검증, bcrypt cost 10 해시 저장, 공개 회원 정보만 반환.<br/>실습 2: 전역 예외 필터로 성공·실패의 공통 응답 구조 적용.<br/>실습 3 및 필수 미션: 평점 등록·수정·삭제, 소유자 확인, 중복·검증·없는 데이터 오류 처리.')
add('제출 자료 구성', 'h2')
table([
    ['자료', '프로젝트 내 위치'],
    ['제출 가이드', 'docs/week6/SUBMISSION.md'],
    ['API 명세', 'docs/week6/API.md'],
    ['Postman 컬렉션 · 환경', 'docs/week6/week6.postman_*.json'],
    ['실습 인증 및 미션 캡처', 'output/week6/screenshots/'],
    ['실제 요청·응답 · DB 확인', 'output/week6/evidence.json'],
    ['열어서 확인하는 실행 기록', 'output/week6/report.html'],
    ['트러블슈팅 및 전후 증거', 'docs/week6/TROUBLESHOOTING.md'],
], [165, 340])
add('캡처는 실제 로컬 서버 요청을 실행한 뒤 원본 JSON을 화면으로 표시한 기록이다. Postman GUI 캡처로 표기하지 않았다. 예시 회원의 비밀번호는 실습용 값이며 응답·DB 원문 해시는 자료에 포함하지 않았다.', 'small')

page('회원가입 성공', '실습 인증 1 / POST /members')
shot('01-signup-success')
add('확인 결과', 'h2')
response('01-signup-success')
add('HTTP 201로 회원이 생성됐으며 응답 result에는 memberId, email, nickname만 있다. password와 bcrypt 해시는 반환하지 않았다.')
add('핵심 코드: src/movie/member.controller.ts, member.service.ts, dto/create-member.dto.ts', 'small')

page('입력 검증 실패', '실습 인증 2 / 잘못된 이메일')
shot('02-validation-failure')
add('확인 결과', 'h2')
response('02-validation-failure')
add('잘못된 이메일은 DB 저장 전 DTO 검증에서 HTTP 400으로 거절했다. 실패 응답도 isSuccess, code, message, result 구조를 사용하고 result는 null이다.')
add('별점 6점·소수, 영화 ID 0, 후기 501자, 약한 비밀번호, 잘못된 닉네임 및 추가 필드도 실제 HTTP 요청에서 400으로 확인했다.')

page('평점 등록과 수정', '실습 인증 3 / POST 및 PATCH')
shot('16-rating-created')
add('등록 결과', 'h2')
response('16-rating-created')
add('회원의 TMDB 영화 ID 27205에 score 5와 후기를 등록했다. movieId는 외부 ID이며 로컬 movie 테이블 FK를 요구하지 않는다.')
add('수정 후 재조회', 'h2')
updated = RECORDS['24-updated-list']['response']['body']['result'][0]
add(f"PATCH 요청은 HTTP 200, result null을 반환했다. 이후 GET으로 score {updated['score']}, comment '{escape(updated['comment'])}'로 변경된 것을 확인했다. 수정 성공 캡처도 별도 제공한다.")

page('평점 삭제와 삭제 후 조회', '필수 미션 / DELETE 204')
shot('25-rating-deleted')
add('확인 결과', 'h2')
response('25-rating-deleted')
add('204 응답은 HTTP 규칙대로 JSON 본문을 보내지 않는다. 삭제 뒤 GET의 result는 빈 배열이며, 같은 평점을 다시 삭제하면 404를 반환했다.')
response('26-deleted-list')
add('핵심 코드: src/movie/rating.controller.ts, rating.service.ts', 'small')

page('실패 응답과 데이터 무결성', '필수 미션 / 400 · 403 · 404 · 409')
table([
    ['상황', 'HTTP', '실제 code'],
    ['이메일 형식·별점 범위 등 검증 실패', '400', 'COMMON4001'],
    ['다른 회원의 평점 수정·삭제', '403', 'RATING4031'],
    ['존재하지 않는 회원', '404', 'MEMBER4041'],
    ['존재하지 않는 평점 수정·삭제', '404', 'RATING4041'],
    ['이메일 중복', '409', 'MEMBER4091'],
    ['닉네임 중복', '409', 'MEMBER4092'],
    ['동일 회원·영화의 중복 평점', '409', 'RATING4091'],
], [245, 50, 210])
add('실제 MySQL 확인', 'h2')
pw = DATA['database']['password']
table([
    ['확인 항목', '관측값'],
    ['저장된 비밀번호', f"bcrypt / 길이 {pw['length']} / cost {pw['rounds']}"],
    ['원래 비밀번호와 bcrypt.compare', str(pw['matchesPassword']).lower()],
    ['평문과 다른 값으로 저장', str(pw['differsFromPlaintext']).lower()],
    ['중복 평점 시도 후 저장 행 수', DATA['database']['ratingRowsAfterDuplicate']],
    ['동시 회원가입 결과', '201 및 409 / 같은 이메일의 저장 행 1개'],
    ['DB UNIQUE 직접 위반', 'ER_DUP_ENTRY / errno 1062'],
], [245, 260])
add('DB UNIQUE 제약이 이메일·닉네임·회원과 영화 조합의 중복을 최종 방지한다. 사전 조회가 통과한 동시 요청도 INSERT 시점에는 충돌할 수 있으므로 전역 예외 필터에서 DB 중복 오류를 같은 업무 코드로 변환했다.')
add('원본: output/week6/evidence.json. 중복·소유권·없는 평점 캡처는 screenshots 폴더에 별도로 포함했다.', 'small')

page('트러블슈팅: 경로 ID 자동 변환', '실제 문제 재현 / 원인 / 수정 / 재검증')
add('이슈', 'h2')
add('컴파일한 서버에서 GET /members/1e0/ratings가 잘못된 경로 형식인데도 400이 아닌 404 MEMBER4041을 반환했다. 요청이 DTO·파이프 검증을 지나 회원 조회까지 도달한 것을 확인했다.')
add('원인', 'h2')
add('컨트롤러의 number 메타데이터를 보고 전역 ValidationPipe가 문자열 1e0을 숫자 1로 먼저 바꿨다. 뒤에서 동작하는 PositiveIdPipe는 원래 문자열을 확인할 수 없었다.')
add('해결', 'h2')
add('경로 인자를 unknown으로 선언해 Number 자동 변환을 피했다. 사용자 정의 파이프가 원래 문자열에 숫자 문자 패턴, 양수, 안전한 정수 범위를 적용한 뒤 서비스에 숫자를 전달한다.')
code("@Get(':memberId/ratings')\nasync getMemberRatings(\n  @Param('memberId', PositiveIdPipe) memberId: unknown,\n) {\n  return success('평점 조회에 성공했습니다.',\n    await this.ratings.getRatingsByMember(Number(memberId)));\n}")
add('재검증', 'h2')
table([
    ['요청', '수정 전', '수정 후'],
    ['/members/1e0/ratings', '404 MEMBER4041', '400 COMMON4001'],
    ['/members/+1/ratings', '-', '400 COMMON4001'],
    ['/members/0x1/ratings', '-', '400 COMMON4001'],
    ['/members/1/ratings/1e0 (DELETE)', '-', '400 COMMON4001'],
], [260, 120, 125])
add('수정 전후 원본: troubleshooting-before.json, troubleshooting-after.json<br/>상세 기록: docs/week6/TROUBLESHOOTING.md', 'small')
add('참고: <link href="https://docs.nestjs.com/application/validation" color="#2463d1">NestJS 공식 Validation 문서</link>, <link href="https://github.com/nestjs/nest/blob/master/packages/common/pipes/validation.pipe.ts" color="#2463d1">ValidationPipe 공식 소스</link>', 'small')

page('API와 핵심 코드 · 재현 방법', '제출 시 함께 첨부할 자료')
table([
    ['Method / 성공 상태', '경로'],
    ['POST / 201', '/members'],
    ['GET / 200', '/members/email/:email'],
    ['GET / 200', '/members/nickname/:nickname'],
    ['GET / 200', '/members/:memberId/ratings'],
    ['POST / 201', '/members/:memberId/ratings'],
    ['PATCH / 200', '/members/:memberId/ratings/:ratingId'],
    ['DELETE / 204', '/members/:memberId/ratings/:ratingId'],
], [145, 360])
add('핵심 코드 링크', 'h2')
add('제출 가이드의 상대 링크로 전체 소스를 열 수 있다. ZIP에도 동일한 소스 구조를 포함했다. GitHub 제출 시에는 업로드한 커밋의 같은 파일 경로로 링크하면 된다.')
code('src/movie/member.service.ts\nsrc/movie/dto/create-member.dto.ts\nsrc/movie/rating.controller.ts\nsrc/movie/rating.service.ts\nsrc/common/configure-app.ts\nsrc/common/http-exception.filter.ts\nsql/week6-schema.sql\ntest/movie.e2e-spec.ts')
add('실행 순서', 'h2')
code('npm install\n# .env.example을 참고해 로컬 MySQL 환경 설정\nnpm run week6:db\nnpm run build\nnpm run start:prod\n# 다른 터미널에서 실제 HTTP 검증\nnpm run week6:verify')
add('Postman Collection과 Environment를 가져온 뒤 순서대로 실행한다. 컬렉션은 테스트 회원 2명을 만들고, 평점을 등록·수정·삭제한다. 실제 HTTP 검증 스크립트는 동시 요청 검증용 회원 1명을 추가로 남긴다. 회원 삭제는 이번 미션 범위에 없다.', 'small')
add('외부 제출 사이트 업로드와 GitHub 게시를 수행한 자료는 아니다. 스터디 모임 사진이 필요한 경우 실제 촬영 사진을 별도로 첨부한다.', 'small')

def chrome(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#dce4ee'))
    canvas.line(45, 38, 550, 38)
    canvas.setFont('Malgun', 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(45, 25, 'UMC WEEK 06 | NestJS + MySQL | 실제 실행 기록')
    canvas.drawRightString(550, 25, str(doc.page))
    canvas.restoreState()

SimpleDocTemplate(
    str(OUTPUT), pagesize=A4, rightMargin=45, leftMargin=45,
    topMargin=40, bottomMargin=53,
    title='6주차 백엔드 실습 및 필수 미션 수행 기록',
    author='UMC Backend Study',
).build(story, onFirstPage=chrome, onLaterPages=chrome)
print(str(OUTPUT))
