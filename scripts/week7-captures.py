"""Render four clearly labeled images from actual recorded HTTP responses."""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "output/week7/evidence.json").read_text(encoding="utf-8"))
if DATA.get("passed") is not True:
    raise RuntimeError("Only a successful actual HTTP evidence run may be rendered.")
OUTPUT = ROOT / "output/week7/captures"
OUTPUT.mkdir(parents=True, exist_ok=True)
FONT = "C:/Windows/Fonts/malgun.ttf"
BOLD = "C:/Windows/Fonts/malgunbd.ttf"
fonts = {
    "title": ImageFont.truetype(BOLD, 31),
    "heading": ImageFont.truetype(BOLD, 27),
    "label": ImageFont.truetype(BOLD, 20),
    "body": ImageFont.truetype(FONT, 20),
    "small": ImageFont.truetype(FONT, 17),
}
INK = "#172c45"
MUTED = "#60748d"
WIDTH = 1600
MARGIN = 40
GAP = 24
PANEL_W = (WIDTH - MARGIN * 2 - GAP) // 2
LINE = 31


def wrap(text, font, width):
    """Wrap without dropping any token characters or Korean glyphs."""
    lines = []
    for source in str(text).split("\n"):
        if not source:
            lines.append("")
            continue
        current = ""
        for character in source:
            if current and font.getlength(current + character) > width:
                lines.append(current)
                current = character
            else:
                current += character
        lines.append(current)
    return lines


def block_lines(value):
    return wrap(json.dumps(value, ensure_ascii=False, indent=2), fonts["body"], PANEL_W - 44)


for record_id in DATA["requiredCaptureIds"]:
    item = next(record for record in DATA["requests"] if record["id"] == record_id)
    headers = block_lines(item["request"]["headers"])
    body = block_lines(item["request"]["body"]) if item["request"]["body"] is not None else ["요청 본문 없음"]
    response = block_lines(item["response"]["body"])
    request_h = 178 + (len(headers) + len(body)) * LINE
    response_h = 120 + len(response) * LINE
    panels_h = max(request_h, response_h, 410)
    note = wrap(item.get("note") or "실제 로컬 서버의 요청·응답을 원본 기록으로 확인했습니다.", fonts["small"], WIDTH - MARGIN * 2 - 44)
    panels_top = 306 + len(note) * 25
    height = panels_top + panels_h + 132
    image = Image.new("RGB", (WIDTH, height), "#edf2f7")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, WIDTH, 126), fill="#13283f")
    draw.text((MARGIN, 20), "UMC BACKEND / WEEK 07", font=fonts["small"], fill="#b7d2f3")
    draw.text((MARGIN, 53), "실제 HTTP 실행 기록", font=fonts["title"], fill="white")
    draw.text((WIDTH - 400, 37), f"{DATA['passedCount']} / {DATA['requestCount']} 검증 통과", font=fonts["label"], fill="#a9e5c9")
    draw.text((WIDTH - 400, 75), DATA["runAtSeoul"] + "  KST", font=fonts["small"], fill="#c1d5ed")

    draw.text((MARGIN, 148), record_id, font=fonts["small"], fill=MUTED)
    draw.text((MARGIN, 181), item["title"], font=fonts["heading"], fill=INK)
    status = f"HTTP {item['response']['status']} {item['response']['statusText']}"
    status_color = "#a44028" if item["response"]["status"] >= 400 else "#08744c"
    draw.text((WIDTH - MARGIN - fonts["label"].getlength(status), 187), status, font=fonts["label"], fill=status_color)
    endpoint = item["request"]["method"] + "  " + DATA["baseUrl"] + item["request"]["path"]
    draw.text((MARGIN, 232), endpoint, font=fonts["body"], fill="#245b9f")
    draw.text((MARGIN, 270), f"{item['at']}  ·  실제 응답 {item['elapsedMs']}ms", font=fonts["small"], fill=MUTED)
    y = 306
    for line in note:
        draw.text((MARGIN, y), line, font=fonts["small"], fill=MUTED)
        y += 25

    for left in (MARGIN, MARGIN + PANEL_W + GAP):
        draw.rounded_rectangle((left, panels_top, left + PANEL_W, panels_top + panels_h), radius=12, fill="white", outline="#d9e3ef", width=2)
    left = MARGIN + 22
    right = MARGIN + PANEL_W + GAP + 22
    draw.text((left, panels_top + 18), "요청 REQUEST", font=fonts["label"], fill=INK)
    draw.text((right, panels_top + 18), "응답 RESPONSE", font=fonts["label"], fill=INK)
    y = panels_top + 63
    draw.text((left, y), "Headers", font=fonts["small"], fill=MUTED)
    y += 31
    for line in headers:
        draw.text((left, y), line, font=fonts["body"], fill="#264768")
        y += LINE
    y += 16
    draw.text((left, y), "JSON body", font=fonts["small"], fill=MUTED)
    y += 31
    for line in body:
        draw.text((left, y), line, font=fonts["body"], fill="#264768")
        y += LINE
    y = panels_top + 65
    for line in response:
        draw.text((right, y), line, font=fonts["body"], fill="#264768")
        y += LINE

    foot_y = panels_top + panels_h + 20
    draw.text((MARGIN, foot_y), "실제 HTTP 원본 데이터 렌더링 · Postman UI 캡처 아님 · source: output/week7/evidence.json", font=fonts["small"], fill=MUTED)
    token_notice = "표시된 A/B 토큰은 실행 종료 시 만료(401 AUTH401_4)를 확인했습니다." if DATA.get("jwt", {}).get("tokensExpiredAtVerification") else "토큰의 만료 확인 여부는 evidence.json을 참고하세요."
    draw.text((MARGIN, foot_y + 28), token_notice, font=fonts["small"], fill=MUTED)
    draw.text((MARGIN, foot_y + 56), "로컬 실습용 회원 정보만 포함하며 JWT 서명 비밀키와 DB 비밀번호는 기록하지 않습니다.", font=fonts["small"], fill=MUTED)
    destination = OUTPUT / (record_id + ".png")
    image.save(destination)
    print(destination)
