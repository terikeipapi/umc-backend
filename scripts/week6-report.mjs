import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const output = new URL('../output/week6/', import.meta.url);
const evidenceUrl = new URL('evidence.json', output);
const reportUrl = new URL('report.html', output);
const evidence = JSON.parse(await readFile(evidenceUrl, 'utf8'));
if (!Array.isArray(evidence.requests) || evidence.requests.length === 0) {
  throw new Error('evidence.json must contain actual HTTP request records.');
}

// Prevent archived request data from terminating the standalone script element.
const serialized = JSON.stringify(evidence)
  .replaceAll('<', '\\u003c')
  .replaceAll('\u2028', '\\u2028')
  .replaceAll('\u2029', '\\u2029');

const template = String.raw`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6주차 실습 인증 | 실제 HTTP 실행 기록</title>
  <style>
    :root{color-scheme:light;--ink:#152338;--muted:#617086;--line:#dbe3ed;--green:#087654;--blue:#2456bc;--red:#ad3d36;--navy:#172a48}
    *{box-sizing:border-box}body{margin:0;background:#eef2f7;color:var(--ink);font-family:"Malgun Gothic","Noto Sans KR",Arial,sans-serif;font-size:14px;line-height:1.55}
    .masthead{background:var(--navy);color:white;padding:28px 38px 25px;display:flex;justify-content:space-between;gap:32px;align-items:center}
    .eyebrow{color:#b2c6e8;font-size:11px;font-weight:700;letter-spacing:2.4px;margin:0 0 8px}h1{font-size:27px;line-height:1.35;letter-spacing:-.8px;margin:0 0 7px}.subtitle{margin:0;color:#c5d1e4;font-size:13px}.run{min-width:215px;text-align:right}.run .pass{display:inline-block;background:#d8faeb;color:#075c42;border:1px solid #93dfbd;padding:5px 13px;border-radius:30px;font-weight:700}.date{font-size:12px;color:#c5d1e4;margin-top:11px}
    .workspace{display:grid;grid-template-columns:275px minmax(0,1fr);gap:22px;padding:24px 28px 28px;max-width:1600px;margin:0 auto}.sidebar{background:white;border:1px solid var(--line);border-radius:13px;overflow:hidden;align-self:start}.navheading{padding:17px 17px 13px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700}.navheading span{background:#edf2f8;padding:1px 8px;border-radius:20px;color:var(--muted)}.requests{padding:7px;max-height:710px;overflow:auto;scrollbar-width:thin}.case{display:grid;grid-template-columns:29px 1fr 31px;gap:7px;align-items:center;width:100%;border:1px solid transparent;border-radius:7px;padding:9px 7px;margin:2px 0;background:white;text-align:left;color:#485a72;font:inherit;font-size:11px;cursor:pointer}.case:hover{background:#f3f6fb}.case.active{background:#eaf0fd;border-color:#b9caf0;color:#143d89;font-weight:700}.case .index{color:#7b899d;font-size:10px}.case .mini{font-size:10px;text-align:right;font-weight:700}.navfooter{font-size:11px;color:var(--muted);padding:12px 17px;border-top:1px solid var(--line);background:#fafbfd}
    main{min-width:0}.overview{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:17px}.metric{background:#fff;border:1px solid var(--line);border-radius:10px;padding:13px 17px}.metric .label{font-size:11px;color:var(--muted);display:block}.metric strong{display:block;font-size:15px;margin-top:3px}.metric .sub{font-size:11px;color:var(--muted)}
    .record{background:white;border:1px solid var(--line);border-radius:13px;overflow:hidden}.recordhead{padding:20px 23px 17px;border-bottom:1px solid var(--line)}.recordtop{display:flex;justify-content:space-between;align-items:center;gap:15px}.recordid{font-size:10px;font-weight:700;letter-spacing:1.3px;color:#7a8aa1;margin:0 0 6px}h2{font-size:21px;line-height:1.4;margin:0;letter-spacing:-.6px}.httpstatus{border-radius:7px;padding:6px 11px;white-space:nowrap;font-family:Consolas,monospace;font-size:14px;font-weight:700;background:#dff6eb;color:var(--green)}.httpstatus.error{background:#fff0e9;color:#a23a23}.endpoint{margin-top:15px;display:flex;gap:10px;align-items:center;min-width:0}.method{font-size:11px;font-weight:800;color:var(--blue);background:#e8effe;border-radius:4px;padding:4px 8px}.method.DELETE{color:#b24531;background:#fff0eb}.method.PATCH{color:#986015;background:#fff5dc}.method.GET{color:#097457;background:#e3f6ee}.url{font-family:Consolas,"Malgun Gothic",monospace;font-size:13px;word-break:break-all}.metadata{margin-top:9px;color:var(--muted);font-size:11px}.explanation{padding:11px 23px;background:#f6f8fc;border-bottom:1px solid var(--line);font-size:12px;color:#4c607d}
    .panels{display:grid;grid-template-columns:1fr 1fr;gap:0}.panel{min-width:0}.panel+ .panel{border-left:1px solid var(--line)}.paneltitle{padding:13px 20px 10px;font-size:12px;font-weight:700;display:flex;justify-content:space-between;gap:10px}.paneltitle span{font-family:Consolas,monospace;font-size:10px;color:var(--muted);font-weight:400}.code{margin:0 13px 15px;border:1px solid #e3e9f1;border-radius:8px;background:#f8fafd;color:#263b59;padding:17px;font:12px/1.75 Consolas,"Malgun Gothic",monospace;white-space:pre-wrap;overflow-wrap:anywhere;overflow:auto;min-height:255px;max-height:310px;tab-size:2}.key{color:#7551a1}.string{color:#16745e}.number{color:#b0681f}.literal{color:#2864b5}.empty{display:flex;align-items:center;justify-content:center;flex-direction:column;color:#74849b;gap:9px;min-height:255px}.empty strong{font-family:Consolas,monospace;font-size:24px;font-weight:400;color:#9baabd}.empty small{font-family:"Malgun Gothic",sans-serif;text-align:center;font-size:11px}.note{padding:0 20px 14px;color:var(--muted);font-size:10px}
    .database{margin-top:17px;background:white;border:1px solid var(--line);border-radius:11px;padding:16px 20px}.dbtitle{display:flex;justify-content:space-between;gap:15px;font-size:13px;font-weight:700;margin-bottom:12px}.dbtitle span{font-weight:400;font-size:10px;color:var(--muted)}.dbgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:15px}.dbitem{font-size:11px;color:var(--muted)}.dbitem strong{display:block;color:var(--green);font-size:13px;margin-top:4px}.footnote{font-size:10px;line-height:1.65;color:#77859a;margin:11px 3px 0}
    @media(max-width:1000px){.workspace{grid-template-columns:220px minmax(0,1fr);padding:17px;gap:15px}.panels{grid-template-columns:1fr}.panel+ .panel{border-left:0;border-top:1px solid var(--line)}.overview{grid-template-columns:1fr}.dbgrid{grid-template-columns:1fr 1fr}.masthead{padding:25px}.run{min-width:170px}}@media(max-width:650px){.workspace{display:block}.sidebar{margin-bottom:17px}.requests{max-height:180px}.masthead{display:block}.run{text-align:left;margin-top:17px}}
  </style>
</head>
<body>
  <header class="masthead"><div><p class="eyebrow">UMC BACKEND / WEEK 06</p><h1>실제 HTTP 실행 기록</h1><p class="subtitle">회원가입과 평점 저장 API · 실습 인증 및 필수 미션 검증</p></div><div class="run"><div class="pass" id="run-status"></div><div class="date" id="run-date"></div></div></header>
  <div class="workspace">
    <aside class="sidebar"><div class="navheading">요청 목록 <span id="count"></span></div><nav class="requests" id="requests" aria-label="기록된 요청 선택"></nav><div class="navfooter">기록을 선택하면 실제 요청과 응답을 확인할 수 있습니다.</div></aside>
    <main>
      <div class="overview"><div class="metric"><span class="label">실행 대상</span><strong>컴파일된 NestJS</strong><span class="sub" id="base-url"></span></div><div class="metric"><span class="label">저장소 검증</span><strong>실제 로컬 MySQL</strong><span class="sub">bcrypt 저장 · UNIQUE 제약 확인</span></div><div class="metric"><span class="label">공통 응답 구조</span><strong>성공·실패 형식 일치</strong><span class="sub">DELETE 성공 시 204 · 응답 본문 없음</span></div></div>
      <section class="record" aria-label="선택된 HTTP 기록"><div class="recordhead"><div class="recordtop"><div><p class="recordid" id="record-id"></p><h2 id="title"></h2></div><div class="httpstatus" id="status"></div></div><div class="endpoint"><span class="method" id="method"></span><span class="url" id="url"></span></div><div class="metadata" id="metadata"></div></div><div class="explanation" id="explanation"></div><div class="panels"><section class="panel"><div class="paneltitle">요청 본문 <span id="request-type"></span></div><pre class="code" id="request-body"></pre><div class="note" id="request-note"></div></section><section class="panel"><div class="paneltitle">응답 본문 <span id="response-type"></span></div><pre class="code" id="response-body"></pre><div class="note" id="response-note"></div></section></div></section>
      <section class="database" aria-label="실제 데이터베이스 검증"><div class="dbtitle">데이터베이스 직접 검증 <span>같은 실행에서 SQL 조회 및 assert로 확인</span></div><div class="dbgrid" id="database"></div></section>
      <p class="footnote">이 화면은 evidence.json에 보관한 실제 HTTP 요청·응답을 표시합니다. 캡처는 실행 기록의 보관용 화면입니다.<br>요청에 표시한 비밀번호는 실습용 예시입니다. 응답에는 비밀번호와 저장 해시가 포함되지 않습니다.</p>
    </main>
  </div>
  <script id="evidence" type="application/json">__EVIDENCE_DATA__</script>
  <script>
    'use strict';
    const evidence = JSON.parse(document.getElementById('evidence').textContent);
    const get = (id) => document.getElementById(id);
    const text = (id, value) => { get(id).textContent = value; };
    const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    function jsonMarkup(value) {
      return escapeHtml(JSON.stringify(value, null, 2)).replace(/(&quot;(?:\\.|(?!&quot;).)*?&quot;\s*:|&quot;(?:\\.|(?!&quot;).)*?&quot;|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?\b)/g, (token) => {
        const type = token.startsWith('&quot;') ? (token.trimEnd().endsWith(':') ? 'key' : 'string') : /^(true|false|null)$/.test(token) ? 'literal' : 'number';
        return '<span class="' + type + '">' + token + '</span>';
      });
    }
    function emptyBody(element, response) {
      element.classList.add('empty');
      element.innerHTML = '<strong>' + (response ? '204 No Content' : 'NO BODY') + '</strong><small>' + (response ? '삭제 성공 · HTTP 응답 본문 길이 0바이트' : '이 요청은 본문을 전송하지 않습니다.') + '</small>';
    }
    const notes = {
      '01-signup-success':'확인: 201 생성 성공 · memberId/email/nickname만 응답 · 비밀번호 필드 제외',
      '02-validation-failure':'확인: 잘못된 이메일 형식을 DTO에서 거절 · 공통 오류 응답 · result는 null',
      '16-rating-created':'확인: 1~5 정수 별점과 후기를 저장 · 201 생성 성공 · 생성된 ratingId 응답',
      '17-duplicate-rating':'확인: 같은 회원·영화의 중복 평점을 409로 차단 · 실제 DB에는 1건만 저장',
      '19-owner-forbidden-patch':'확인: 요청 회원과 평점 소유자가 다르면 수정 요청을 403으로 차단',
      '20-owner-forbidden-delete':'확인: 요청 회원과 평점 소유자가 다르면 삭제 요청을 403으로 차단',
      '21-missing-rating-patch':'확인: 존재하지 않는 평점에 대한 수정은 404 · result는 null',
      '23-rating-updated':'확인: 본인 평점 수정 성공 · 200 응답 · 다음 조회에서 수정 내용 확인',
      '25-rating-deleted':'확인: 본인 평점 삭제 성공 · 204 응답 · 빈 본문 · 다음 조회에서 빈 목록 확인',
    };
    const requests = evidence.requests;
    text('count', requests.length + '건');
    text('run-status', evidence.passedCount + ' / ' + evidence.requestCount + ' HTTP 검증 ' + (evidence.passed ? '통과' : '확인 필요'));
    text('run-date', (evidence.runAtSeoul || evidence.runAt) + ' · Asia/Seoul');
    text('base-url', evidence.baseUrl);
    get('requests').innerHTML = requests.map((entry, index) => '<button type="button" class="case" data-id="' + escapeHtml(entry.id) + '"><span class="index">' + String(index + 1).padStart(2, '0') + '</span><span>' + escapeHtml(entry.title) + '</span><span class="mini">' + entry.response.status + '</span></button>').join('');
    get('requests').addEventListener('click', (event) => { const button = event.target.closest('[data-id]'); if (button) location.hash = button.dataset.id; });
    const db = evidence.database || {};
    const hash = db.password || {};
    const dbChecks = [
      ['비밀번호 저장', (hash.algorithm || '미확인') + ' · ' + (hash.length ?? '?') + '자 · cost ' + (hash.rounds ?? '?')],
      ['원문과 해시 비교', hash.differsFromPlaintext && hash.matchesPassword ? '평문 저장 없음 · compare 일치' : '검증 결과 확인 필요'],
      ['중복 평점 저장 수', (db.ratingRowsAfterDuplicate ?? '?') + '건 · 중복 INSERT 차단'],
      ['동시 회원가입 저장 수', (evidence.concurrency?.storedRows ?? '?') + '건 · 응답 ' + (evidence.concurrency?.statuses || []).join(' / ')],
    ];
    get('database').innerHTML = dbChecks.map(([label, result]) => '<div class="dbitem">' + escapeHtml(label) + '<strong>' + escapeHtml(result) + '</strong></div>').join('');
    function render() {
      const requested = decodeURIComponent(location.hash.slice(1));
      const entry = requests.find((item) => item.id === requested) || requests[0];
      text('record-id', entry.id.toUpperCase());
      text('title', entry.title);
      text('status', entry.response.status + ' ' + (entry.response.statusText || ''));
      get('status').classList.toggle('error', entry.response.status >= 400);
      text('method', entry.request.method);
      get('method').className = 'method ' + entry.request.method;
      text('url', evidence.baseUrl + entry.request.path);
      const at = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul', dateStyle:'short', timeStyle:'medium'}).format(new Date(entry.at));
      text('metadata', '기록 시각 ' + at + ' KST  ·  ' + entry.elapsedMs + ' ms  ·  실제 HTTP 상태 및 응답 assert ' + (entry.passed ? '통과' : '확인 필요'));
      text('explanation', notes[entry.id] || '확인: ' + entry.request.method + ' 요청의 HTTP 상태, 공통 응답 구조, 오류 코드와 비밀번호 노출 여부를 검사했습니다.');
      const req = get('request-body'); const res = get('response-body');
      req.classList.remove('empty'); res.classList.remove('empty');
      if (entry.request.body === null) emptyBody(req, false); else req.innerHTML = jsonMarkup(entry.request.body);
      if (entry.response.status === 204) emptyBody(res, true); else res.innerHTML = jsonMarkup(entry.response.body);
      req.scrollTop = 0; res.scrollTop = 0;
      text('request-type', entry.request.body === null ? 'BODY 없음' : 'application/json');
      text('response-type', entry.response.status === 204 ? '0 bytes' : 'application/json');
      text('request-note', entry.request.body && Object.hasOwn(entry.request.body, 'password') ? 'password는 실습용 입력값입니다. 서버에는 bcrypt 해시로 저장됩니다.' : '경로의 memberId로 요청 회원을 구분하는 6주차 API입니다.');
      text('response-note', entry.response.status === 204 ? '204 응답에는 공통 JSON 본문도 포함하지 않습니다.' : 'isSuccess · code · message · result 네 필드 형식을 확인했습니다.');
      document.querySelectorAll('.case').forEach((button) => { const active = button.dataset.id === entry.id; button.classList.toggle('active', active); button.setAttribute('aria-current', String(active)); if (active) button.scrollIntoView({block:'nearest'}); });
      document.body.dataset.currentId = entry.id;
    }
    window.addEventListener('hashchange', render); render();
  </script>
</body>
</html>`;

await mkdir(output, { recursive: true });
await writeFile(
  reportUrl,
  template.replace('__EVIDENCE_DATA__', serialized),
  'utf8',
);
console.log(
  `Archived HTTP viewer: ${fileURLToPath(reportUrl)} (${evidence.requests.length} requests)`,
);

if (process.argv.includes('--screenshots')) {
  const runtimeModule =
    process.env.WEEK6_PLAYWRIGHT_MODULE ||
    'C:/Users/rlaxo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
  const { chromium } = await import(
    runtimeModule.startsWith('file:')
      ? runtimeModule
      : pathToFileURL(runtimeModule).href
  );
  const candidates = [
    process.env.WEEK6_BROWSER_PATH,
    chromium.executablePath(),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].filter(Boolean);
  let browser;
  const errors = [];
  for (const executablePath of [...new Set(candidates)]) {
    try {
      await access(executablePath);
      browser = await chromium.launch({
        executablePath,
        headless: true,
        args: ['--disable-gpu'],
      });
      break;
    } catch (error) {
      errors.push(`${executablePath}: ${error.message.split('\n')[0]}`);
    }
  }
  if (!browser)
    throw new Error(
      'Unable to launch a local headless Chromium browser.\n' +
        errors.join('\n'),
    );
  const screenshotDir = new URL('screenshots/', output);
  await mkdir(screenshotDir, { recursive: true });
  const captureIds = process.argv.includes('--all')
    ? evidence.requests.map((entry) => entry.id)
    : [
        '01-signup-success',
        '02-validation-failure',
        '16-rating-created',
        '23-rating-updated',
        '25-rating-deleted',
        '17-duplicate-rating',
        '19-owner-forbidden-patch',
        '21-missing-rating-patch',
        '05-duplicate-email',
        '06-duplicate-nickname',
        '11-invalid-score',
        '28-race-1',
        '28-race-2',
      ];
  const captures = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 1000 },
      deviceScaleFactor: 1,
    });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(reportUrl.href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    for (const id of captureIds) {
      const entry = evidence.requests.find((item) => item.id === id);
      if (!entry)
        throw new Error(`Requested screenshot record does not exist: ${id}`);
      await page.evaluate((currentId) => {
        location.hash = currentId;
      }, id);
      await page.waitForFunction(
        (currentId) => document.body.dataset.currentId === currentId,
        id,
      );
      const target = fileURLToPath(new URL(`${id}.png`, screenshotDir));
      await page.screenshot({
        path: target,
        fullPage: true,
        animations: 'disabled',
      });
      captures.push({
        id,
        title: entry.title,
        status: entry.response.status,
        path: path
          .relative(fileURLToPath(output), target)
          .replaceAll('\\', '/'),
      });
    }
    if (pageErrors.length)
      throw new Error(
        'Evidence viewer browser errors: ' + pageErrors.join('; '),
      );
    await writeFile(
      new URL('index.json', screenshotDir),
      JSON.stringify(
        {
          source:
            'Actual HTTP request/response records in ../evidence.json, rendered as archival evidence.',
          runAt: evidence.runAt,
          generatedAt: new Date().toISOString(),
          captures,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
    console.log(
      `Archived evidence screenshots: ${captures.length} files in ${fileURLToPath(screenshotDir)}`,
    );
  } finally {
    await browser.close();
  }
}
