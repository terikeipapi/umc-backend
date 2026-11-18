import { mkdir, readFile, writeFile } from 'node:fs/promises';

const path = 'src/movie/movie-record.service.ts';
const lines = (await readFile(path, 'utf8')).split(/\r?\n/);
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const selected = [[31, 93]];
const blocks = selected.map(([start, end]) => lines.slice(start - 1, end).map((line, index) => `<div class="line"><span>${start + index}</span><code>${escape(line)}</code></div>`).join('')).join('<div class="gap">… 중복 검사·오류 처리 일부 생략 (전체 원본은 위 경로 참고) …</div>');
await mkdir('output/week8-workbook', { recursive: true });
await writeFile('output/week8-workbook/transaction-source.html', `<!doctype html><html lang="ko"><meta charset="utf-8"><title>8주차 트랜잭션 핵심 코드</title><style>*{box-sizing:border-box}body{margin:0;padding:24px 34px;background:#f2f5f9;color:#14243a;font-family:Arial,'Malgun Gothic',sans-serif}h1{font-size:22px;margin:0 0 7px}p{font-size:12px;margin:0 0 12px;color:#44556d}section{background:#fff;border:1px solid #cdd7e4;border-radius:10px;padding:12px 16px}.line{display:flex;gap:14px;font:12px/17px Consolas,monospace;white-space:pre}.line span{flex:none;width:26px;text-align:right;color:#6c7c92}.line code{color:#1c355b}.gap{font:11px/20px 'Malgun Gothic',sans-serif;color:#67758a;padding-left:40px}footer{font-size:12px;line-height:1.7;margin-top:12px;color:#334965}</style><h1>8주차 · 평점과 즐겨찾기의 원자적 저장</h1><p>실제 서비스 파일 발췌 / ${path} / 행 번호는 원본 기준</p><section>${blocks}</section><footer>두 저장이 하나의 영화 기록을 구성하므로, 즐겨찾기 저장이 실패하면 먼저 저장한 평점도 되돌리기 위해 같은 트랜잭션으로 묶었습니다.</footer></html>`);
console.log('Created source excerpt view from the actual transaction service.');
