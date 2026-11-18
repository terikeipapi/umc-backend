"""Render an honestly labeled excerpt of the actual transaction source.

This creates a code illustration from a source file. It does not imitate an
editor, a browser, or Postman, and it never rewrites any captured UI image.
"""
from hashlib import sha256
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/movie/movie-record.service.ts"
OUTPUT = ROOT / "output/week8-workbook/captures/07-transaction-source.png"
source_bytes = SOURCE.read_bytes()
source_lines = source_bytes.decode("utf-8").splitlines()
start = next(i for i, line in enumerate(source_lines) if "// Every lookup and write" in line)
transaction_line = next(i for i, line in enumerate(source_lines) if "return this.dataSource.transaction(" in line)
end = next(i for i in range(transaction_line + 1, len(source_lines)) if source_lines[i] == "    });") + 1
selected = [(number + 1, source_lines[number]) for number in range(start, end + 1)]

font_path = Path("C:/Windows/Fonts")
title = ImageFont.truetype(str(font_path / "malgunbd.ttf"), 35)
body = ImageFont.truetype(str(font_path / "malgun.ttf"), 23)
small = ImageFont.truetype(str(font_path / "malgun.ttf"), 20)
code = ImageFont.truetype(str(font_path / "consola.ttf"), 22)
korean_code = ImageFont.truetype(str(font_path / "malgun.ttf"), 22)
line_height = 29
gutter_width = 70
padding = 40
source_width = max(code.getlength(line) for _, line in selected)
width = max(1550, int(source_width + padding * 2 + gutter_width + 50))
header_height = 157
footer_height = 135
height = header_height + len(selected) * line_height + footer_height + 24
image = Image.new("RGB", (width, height), "#f1f5fa")
draw = ImageDraw.Draw(image)

draw.text((padding, 24), "8주차 · 평점과 즐겨찾기의 트랜잭션", font=title, fill="#142d4d")
draw.text((padding, 78), "실제 서비스 원본을 읽어 렌더링한 코드 자료 · Postman/편집기 화면 캡처 아님", font=body, fill="#425b77")
draw.text((padding, 115), "src/movie/movie-record.service.ts  |  원본 행 번호 유지 · 코드 생략 없음", font=small, fill="#5e728a")

left, top, right = padding, header_height, width - padding
draw.rounded_rectangle((left, top, right, top + len(selected) * line_height + 24), radius=10, fill="#ffffff", outline="#cbd7e5", width=2)
emphasized = ("return this.dataSource.transaction(", "savedRating = await ratingRepository.save(", "const savedFavorite = await favoriteRepository.save(")
for offset, (number, line) in enumerate(selected):
    y = top + 12 + offset * line_height
    if any(fragment in line for fragment in emphasized):
        draw.rectangle((left + 3, y - 1, right - 3, y + line_height - 1), fill="#e7f1ff")
    number_text = str(number)
    draw.text((left + gutter_width - 17 - code.getlength(number_text), y), number_text, font=code, fill="#7a8da4")
    chosen_font = korean_code if any("\uac00" <= character <= "\ud7a3" for character in line) else code
    draw.text((left + gutter_width, y), line, font=chosen_font, fill="#203b60")

footer_y = top + len(selected) * line_height + 43
draw.text((padding, footer_y), "평점과 즐겨찾기가 함께 성공해야 하므로, 두 번째 저장 실패 시 먼저 저장한 평점도 되돌립니다.", font=body, fill="#234565")
draw.text((padding, footer_y + 42), f"원본 SHA-256: {sha256(source_bytes).hexdigest()}", font=small, fill="#64788f")
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
image.save(OUTPUT)
print(f"Rendered {OUTPUT.relative_to(ROOT)} ({width}x{height}); original lines {start + 1}-{end + 1}.")
