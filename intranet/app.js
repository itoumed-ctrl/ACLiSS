// ACLiSS 院内サーバー版。index.html と同じ場所にある master/ のCSVと images/ のPNGだけで動く。
// 画面の切り替えは「#/containers/121」のようにURLの#以降で行うので、置く場所を選ばない。
(function () {
  "use strict";

  const ZXING_JS = "vendor/zxing-browser.min.js?v=__BUILD_ID__";
  const CACHE_KEY = "acliss-intranet-master-v3";

  // 開発確認用のプレビュー（npm run build:intranet -- --preview）では、CSVと画像がページに埋め込まれている
  const preview = window.__ACLISS_PREVIEW__;

  // ================================================================ HTMLの組み立て

  // html`<p>${値}</p>` で画面のHTMLを作る。値は必ず文字として埋め込まれる（CSVの中身で画面が壊れない）。
  // html`` で作ったものや、その配列はHTMLのまま入る。null・false・undefined は何も出さない。
  function html(strings, ...values) {
    return { html: strings.reduce((out, s, i) => out + s + (i < values.length ? show(values[i]) : ""), "") };
  }

  function show(v) {
    if (v == null || v === false) return "";
    if (Array.isArray(v)) return v.map(show).join("");
    if (typeof v === "object" && "html" in v) return v.html;
    return String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  // 線のアイコン（24×24）
  const ICONS = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    light: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0012 3z"/>',
    cameraOff: '<path d="M3 3l18 18"/><path d="M9.5 5H15l1.5 2H19a2 2 0 012 2v8.5M17 19H5a2 2 0 01-2-2V9a2 2 0 012-2h1"/><path d="M9.9 10.1a3 3 0 004 4"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
  };

  const icon = (name) => ({ html: `<span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS[name]}</svg></span>` });

  // アプリに同梱した画像。icons/ のPNGは角丸の四角まで描いた正方形の絵
  const asset = (path) => (preview && preview.assets[path]) || `${path}?v=__BUILD_ID__`;
  const tile = (file) => html`<img class="tile" src="${asset(`icons/${file}`)}" alt="">`;

  // ================================================================ マスタ（CSV）

  // マスタはひな型（ACLiSSマスタ.xlsx）の「材料」「オーダ可能項目」シートをCSVで保存したもの。
  // 列名は各シートの1行目と同じ。

  // Excelの「CSV（コンマ区切り）」はShift_JIS、「CSV UTF-8」はUTF-8。どちらでも読む
  function decode(buffer) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      return new TextDecoder("shift_jis").decode(buffer);
    }
  }

  // CSV → 列名をキーにした行の並び。"" で囲んだ値の中のカンマ・改行にも対応する
  function parseCsv(text) {
    const rows = [[]];
    let value = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c !== '"') {
          value += c;
        } else if (text[i + 1] === '"') {
          value += c;
          i++;
        } else {
          quoted = false;
        }
      } else if (c === '"') {
        quoted = true;
      } else if (c === ",") {
        rows[rows.length - 1].push(value);
        value = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        rows[rows.length - 1].push(value);
        rows.push([]);
        value = "";
      } else {
        value += c;
      }
    }
    rows[rows.length - 1].push(value);

    const lines = rows.filter((r) => r.length > 1 || r[0] !== "");
    const columns = (lines[0] || []).map((name) => name.replace(/^﻿/, "").trim());
    const records = lines.slice(1).map((r) => Object.fromEntries(columns.map((name, i) => [name, r[i]])));
    return { columns, records };
  }

  async function readCsv(path, required) {
    let text = preview && preview.files[path];
    let lastModified = null;
    if (!preview) {
      const res = await fetch(path, { cache: "no-cache" });
      if (!res.ok) {
        throw new Error(`${path} を読み込めませんでした（${res.status}）。院内サーバーの master フォルダにファイルがあるか確認してください。`);
      }
      text = decode(await res.arrayBuffer());
      lastModified = Date.parse(res.headers.get("last-modified"));
    }
    const { columns, records } = parseCsv(text || "");
    const missing = required.filter((c) => !columns.includes(c));
    if (missing.length > 0) {
      throw new Error(`${path} の1行目（列名）に ${missing.join("、")} がありません。ひな型（ACLiSSマスタ.xlsx）と同じ列名にしてください。`);
    }
    return { records, lastModified };
  }

  // 空欄・空白だけ・Excelの参照エラー（#N/A）は null
  function text(value) {
    const v = (value || "").trim();
    return v && v !== "#N/A" ? v : null;
  }

  // 材料コードは3桁。ExcelでCSVを開き直すと先頭の0が消える（073 → 73）ので補う
  function code(value) {
    const v = text(value);
    return v && /^\d{1,2}$/.test(v) ? v.padStart(3, "0") : v;
  }

  // 内線番号の「-」は番号なし
  function phone(value) {
    const v = text(value);
    return v === "-" ? null : v;
  }

  // 容器写真は images/<画像コード>.png
  function photo(imageCode) {
    if (!imageCode) return null;
    if (preview) return preview.images[imageCode] || null;
    return `images/${encodeURIComponent(imageCode)}.png`;
  }

  function toContainer(row) {
    const containerCode = code(row["材料コード"]);
    if (!containerCode) return null;
    const amount = text(row["規定採取量"]);
    return {
      code: containerCode,
      vessel: text(row["VESSEL"]),
      material: text(row["MATERIAL"]),
      dispense: text(row["容器払い出し"]),
      dispensePhs: phone(row["内線番号①"]),
      inquiry: text(row["問い合わせ先"]),
      inquiryPhs: phone(row["内線番号②"]),
      // 採取量は数字だけで書かれているので単位を付ける（単位まで書かれた値はそのまま）
      amount: amount === "----" ? "規定なし" : amount && /^\d+(\.\d+)?$/.test(amount) ? `${amount} mL` : amount,
      // 指示ラベルは、指示①〜③に文が入っているものだけ出す
      instructions: [row["指示①"], row["指示②"], row["指示③"]].map(text).filter(Boolean),
      notes: text(row["注意事項"]),
      photo: photo(code(row["画像コード"])),
    };
  }

  function toTestItem(row) {
    const itemCode = text(row["項目コード"]);
    if (!itemCode) return null;
    return { code: itemCode, name: text(row["名称"]) || "", container: code(row["材料コード"]) };
  }

  async function loadMaster() {
    const [c, t] = await Promise.all([
      readCsv("master/containers.csv", ["材料コード"]),
      readCsv("master/test_items.csv", ["項目コード", "名称", "材料コード"]),
    ]);
    // 「最終更新」には、読み込んだ時刻ではなくCSVファイル自体の更新日時を出す
    const times = [c.lastModified, t.lastModified].filter((v) => v && !Number.isNaN(v));
    return {
      containers: c.records
        .map(toContainer)
        .filter(Boolean)
        .sort((a, b) => a.code.localeCompare(b.code, "ja", { numeric: true })),
      testItems: t.records.map(toTestItem).filter(Boolean),
      updatedAt: new Date(times.length > 0 ? Math.max(...times) : Date.now()).toISOString(),
    };
  }

  // 電波が弱い場所でも使えるよう、読み込んだマスタの控えを端末に残す（個人情報は含まない）
  function readCache() {
    try {
      const data = JSON.parse(localStorage.getItem(CACHE_KEY));
      return data && Array.isArray(data.containers) && Array.isArray(data.testItems) ? data : null;
    } catch {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // 保存できない端末でも表示は続ける
    }
  }

  const master = { data: readCache(), loaded: false, loading: false, error: null };
  const containers = () => (master.data ? master.data.containers : []);
  const testItems = () => (master.data ? master.data.testItems : []);

  // ページを開いている間に1回だけ読む。失敗した時は次に画面を移った時に読み直す
  function loadOnce() {
    if (master.loading || master.loaded) return;
    master.loading = true;
    master.error = null;
    loadMaster()
      .then((data) => {
        master.data = data;
        master.loaded = true;
        writeCache(data);
      })
      .catch((e) => {
        master.error = e instanceof Error ? e.message : "マスタを読み込めませんでした";
      })
      .finally(() => {
        master.loading = false;
        if (current.update) current.update();
      });
  }

  // ================================================================ 文字

  // 全角・半角、ひらがな・カタカナ、大文字・小文字の違いをそろえて検索する
  function normalize(value) {
    return value
      .normalize("NFKC")
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .replace(/　/g, " ")
      .toLowerCase();
  }

  const matches = (query, ...fields) => fields.some((f) => f && normalize(f).includes(query));
  const containerName = (c) => [c.vessel, c.material].filter(Boolean).join(" － ");

  // 検査バーコード（12桁）の9〜11桁目が容器コード（12桁目はチェックデジット）。例: 000000001210 → 121
  const codeFromBarcode = (raw) => (/^\d{12}$/.test(raw.trim()) ? raw.trim().slice(8, 11) : null);

  // 検査ラベルに印字された11桁の数字の末尾3桁が容器コード
  const codeFromDigits = (raw) => (/^\d{11}$/.test(raw.trim()) ? raw.trim().slice(-3) : null);

  // ================================================================ 画面の共通部品

  const toolbar = () =>
    html`<nav class="toolbar"><button type="button" data-back>${icon("back")}戻る</button><a href="#/">${icon("home")}ホーム</a></nav>`;

  function updatedAt(count) {
    if (!master.data) return null;
    const date = new Date(master.data.updatedAt).toLocaleString("ja-JP", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (master.error) return html`<p class="meta warn">オフラインのため前回のデータを表示中（最終更新 ${date}）</p>`;
    return html`<p class="meta">最終更新 ${date}${count != null && `・${count}件`}</p>`;
  }

  // データがまだ無い間だけ出す「読み込み中」「エラー」
  function waiting() {
    if (master.data) return null;
    if (master.loading) return html`<p class="state">読み込み中...</p>`;
    if (master.error) return html`<p class="alert">エラー: ${master.error}</p>`;
    return null;
  }

  // 一覧の1行。href がなければ押せない（灰色の）行
  function row({ href, lead, title, sub }) {
    const inner = html`${lead}<span class="row-text"><span class="row-title">${title}</span>${
      sub && html`<span class="row-sub">${sub}</span>`
    }</span>`;
    return href
      ? html`<li><a href="${href}" class="row">${inner}${icon("chevron")}</a></li>`
      : html`<li><div class="row off">${inner}</div></li>`;
  }

  // 検索欄つきの一覧画面（容器一覧・検査項目）。search(検索語) が行を返す
  function listPage({ title, placeholder, query, autofocus, search, empty, hint, onInput }) {
    return {
      html: html`<div class="page">${toolbar()}<h1 class="title">${title}</h1>
        <div class="search"><label>${icon("search")}<input type="search" placeholder="${placeholder}"${
          autofocus && html` autofocus`
        }></label><div data-meta></div></div><div data-body></div></div>`,
      mount(root) {
        const input = root.querySelector("input");
        input.value = query || "";
        function update() {
          const q = normalize(input.value.trim());
          const { rows, count } = search(q);
          root.querySelector("[data-meta]").innerHTML = show(updatedAt(count));
          root.querySelector("[data-body]").innerHTML = show(
            !master.data
              ? waiting()
              : rows.length > 0
                ? html`<ul class="card list">${rows}</ul>`
                : html`<p class="state">${q ? empty : hint}</p>`,
          );
        }
        input.addEventListener("input", () => {
          update();
          if (onInput) onInput(input.value);
        });
        return { update };
      },
    };
  }

  // ================================================================ トップ

  function homePage() {
    const scanner = barcodeScanner();
    return {
      html: html`<div class="page">${scanner.html}<nav class="card list menu">${menuItem(
        "#/containers",
        "menu-containers.png",
        "容器一覧から選ぶ",
        "容器コードや種類から探します",
      )}${menuItem("#/search", "menu-search.png", "検査項目から探す", "検査項目名で検索します")}</nav></div>`,
      mount: scanner.mount,
    };
  }

  const menuItem = (href, file, title, sub) =>
    html`<a href="${href}" class="row">${tile(file)}<span class="row-text"><span class="row-title">${title}</span><span class="row-sub">${sub}</span></span>${icon(
      "chevron",
    )}</a>`;

  // ================================================================ 容器一覧

  const containersPage = () =>
    listPage({
      title: "容器一覧から選ぶ",
      placeholder: "容器コード・種類で絞り込み",
      empty: "該当する容器が見つかりません",
      search(q) {
        const found = q ? containers().filter((c) => matches(q, c.code, c.vessel, c.material, c.dispense)) : containers();
        return {
          count: found.length,
          rows: found.map((c) =>
            row({
              href: `#/containers/${c.code}`,
              lead: html`<span class="code">${c.code}</span>`,
              title: c.vessel || c.material || "",
              sub: c.vessel && c.material,
            }),
          ),
        };
      },
    });

  // ================================================================ 検査項目検索

  const searchPage = (query) =>
    listPage({
      title: "検査項目から探す",
      placeholder: "検査項目名（例: グルコース）",
      query: new URLSearchParams(query).get("q"),
      autofocus: true,
      empty: "該当する検査項目が見つかりません",
      hint: "検査項目名の一部を入力してください",
      // 検索語をURLに残し、容器の画面から戻った時に検索語が消えないようにする
      onInput: (v) => history.replaceState(history.state, "", v ? `#/search?${new URLSearchParams({ q: v })}` : "#/search"),
      search(q) {
        if (!q) return { rows: [] };
        const byCode = new Map(containers().map((c) => [c.code, c]));
        const found = testItems().filter((t) => matches(q, t.name)).slice(0, 50);
        return {
          rows: found.map((t) => {
            if (!t.container) return row({ title: t.name, sub: "対応する容器コードが未設定です" });
            const c = byCode.get(t.container);
            return row({
              href: `#/containers/${t.container}`,
              title: t.name,
              sub: `容器 ${t.container}` + (c ? `・${containerName(c)}` : ""),
            });
          }),
        };
      },
    });

  // ================================================================ 容器詳細

  function containerPage(containerCode) {
    return {
      html: html`<div class="page"></div>`,
      mount(root) {
        const page = root.firstElementChild;
        function update() {
          const c = containers().find((x) => x.code === containerCode);
          page.innerHTML = show([
            toolbar(),
            c ? detail(c) : waiting() || html`<p class="alert">容器コード「${containerCode}」は見つかりませんでした。</p>`,
          ]);
        }
        return { update };
      },
    };
  }

  // 内線番号はタップすると電話の画面が開き、番号が入った状態になる（発信は本人が押す）
  function extension(phs) {
    if (!phs) return null;
    const number = phs.replace(/[^\d+*#]/g, "");
    if (!number) return html`<span class="fact-sub">内線 ${phs}</span>`;
    return html`<a class="call" href="tel:${number}">${icon("phone")}内線 ${phs}<span>電話をかける</span></a>`;
  }

  const fact = (label, value, sub, size) =>
    html`<div class="fact"><dt class="label">${label}</dt><dd${size && html` class="${size}"`}>${value}${sub}</dd></div>`;

  function detail(c) {
    return html`<header class="detail-head"><p class="label">容器コード</p><h1 class="detail-code">${c.code}</h1>${
      (c.vessel || c.material) &&
      html`<p class="detail-name">${c.vessel || c.material}${c.vessel && c.material && html`<span>${c.material}</span>`}</p>`
    }</header>${
      // 写真ファイルが無い・読めない時は、壊れた画像を出さずに枠ごと消す（下の error の処理）
      c.photo && html`<figure class="card photo"><img src="${c.photo}" alt="容器コード${c.code}の写真"></figure>`
    }<dl class="card facts">${fact("採取量", c.amount || "規定なし", null, "big")}${fact(
      "払い出し場所",
      c.dispense || "未設定",
      extension(c.dispensePhs),
      "big",
    )}${(c.inquiry || c.inquiryPhs) && fact("検査問い合わせ先", c.inquiry || "", extension(c.inquiryPhs))}</dl>${
      c.instructions.length > 0 &&
      html`<section class="note gold"><h2>${icon("tag")}指示ラベル</h2><ul>${c.instructions.map((s) => html`<li>${s}</li>`)}</ul></section>`
    }${c.notes && html`<section class="note"><h2>${icon("info")}注意事項</h2><p>${c.notes}</p></section>`}`;
  }

  // ================================================================ バーコード

  // 検査バーコードは1次元バーコード。形式を絞ると速く正確になる
  const NATIVE_FORMATS = ["code_128", "itf", "code_39", "codabar", "ean_13"];
  const ZXING_FORMATS = ["CODE_128", "ITF", "CODE_39", "CODABAR", "EAN_13"];

  // 細いバーを読めるよう高めの解像度と連続オートフォーカスを希望する（非対応の端末は無視する）
  const VIDEO = {
    facingMode: "environment",
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    advanced: [{ focusMode: "continuous" }],
  };

  // ブラウザ内蔵の読み取り（BarcodeDetector）が無い端末（iPhoneなど）だけ、同梱のZXingを読み込む
  function loadZxing() {
    if (window.ZXingBrowser) return Promise.resolve(window.ZXingBrowser);
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = ZXING_JS;
      script.onload = () => resolve(window.ZXingBrowser);
      script.onerror = () => reject(new Error("バーコードの読み取り部品（vendor フォルダ）を読み込めませんでした。"));
      document.head.append(script);
    });
  }

  function barcodeScanner() {
    return {
      // 狭い画面でも言葉の途中で改行しないよう、案内文は文節で区切る
      html: html`<section class="card scan"><header class="scan-head">${tile("menu-scan.png")}<div><h1>バーコードから検索</h1><p><span>検査ラベルのバーコードを</span><span>カメラで読み取ってください</span></p></div></header>
        <div class="viewport"><video muted playsinline></video><div class="guide"></div><span class="status">カメラを起動中</span><button type="button" class="torch" hidden>${icon(
          "light",
        )}<span>ライト</span></button></div><div class="camera-off" hidden></div><p class="scan-note" hidden></p>
        <form class="manual"><label for="label-digits">カメラがうまく読み取れない場合は、検査ラベルの11桁の数字を直接入力してください。</label><div class="input-group"><input id="label-digits" type="text" inputmode="numeric" autocomplete="off" placeholder="例: 00000000121"><button type="submit">検索</button></div><p class="field-error" hidden></p></form></section>`,
      mount: startScanner,
    };
  }

  function startScanner(root) {
    const $ = (selector) => root.querySelector(selector);
    const view = $(".viewport");
    const video = $("video");
    const status = $(".status");
    const torch = $(".torch");
    const note = $(".scan-note");
    let stopped = false;
    let done = false;
    let track = null; // ブラウザ内蔵の読み取りで使っているカメラ
    let zxing = null; // ZXingで読み取っている時の操作口
    let torchOn = false;
    const stops = [];
    video.muted = true;

    function stop() {
      stopped = true;
      stops.splice(0).forEach((fn) => fn());
    }

    function scanning() {
      view.classList.add("scanning");
      status.textContent = "スキャン中";
    }

    function detected(raw) {
      if (stopped || done) return;
      const found = codeFromBarcode(raw);
      if (!found) {
        note.innerHTML = show(html`読み取った内容 <span>${raw}</span><br>12桁の数字として認識できなかったため、容器コードへ変換できませんでした。`);
        note.hidden = false;
        return;
      }
      done = true;
      stops.splice(0).forEach((fn) => fn());
      view.classList.replace("scanning", "success");
      status.textContent = "読み取り完了";
      setTimeout(() => (location.hash = `/containers/${found}`), 400);
    }

    function offerTorch(capabilities) {
      if (capabilities && capabilities.torch) torch.hidden = false;
    }

    async function startNative() {
      if (!("BarcodeDetector" in window)) return false;
      const supported = await BarcodeDetector.getSupportedFormats().catch(() => []);
      const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
      if (formats.length === 0) return false;

      const detector = new BarcodeDetector({ formats });
      const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO });
      stops.push(() => stream.getTracks().forEach((t) => t.stop()));
      if (stopped) {
        stop();
        return true;
      }
      video.srcObject = stream;
      await video.play();
      track = stream.getVideoTracks()[0];
      try {
        offerTorch(track.getCapabilities && track.getCapabilities());
      } catch {
        // 確認できなくても読み取りは続ける
      }
      scanning();

      let frame = 0;
      let busy = false;
      const tick = () => {
        if (!busy && video.readyState >= 2) {
          busy = true;
          detector
            .detect(video)
            .then((codes) => codes.length > 0 && detected(codes[0].rawValue))
            .catch(() => {}) // 1コマの失敗は無視して次へ
            .finally(() => (busy = false));
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      stops.push(() => cancelAnimationFrame(frame));
      return true;
    }

    async function startZxing() {
      const ZX = await loadZxing();
      // 2 = 読む形式、3 = 時間をかけてでも正確に（ZXingの設定番号）
      const hints = new Map([
        [2, ZXING_FORMATS.map((f) => ZX.BarcodeFormat[f])],
        [3, true],
      ]);
      const controls = await new ZX.BrowserMultiFormatReader(hints).decodeFromConstraints({ video: VIDEO }, video, (result) => {
        if (result) detected(result.getText());
      });
      stops.push(() => controls.stop());
      if (stopped) {
        stop();
        return;
      }
      zxing = controls;
      scanning();
      try {
        offerTorch(controls.streamVideoCapabilitiesGet && controls.streamVideoCapabilitiesGet((t) => [t]));
      } catch {
        // 確認できなくても読み取りは続ける
      }
    }

    async function constrain(constraint) {
      if (track) await track.applyConstraints({ advanced: [constraint] });
      else if (zxing && zxing.streamVideoConstraintsApply) await zxing.streamVideoConstraintsApply({ advanced: [constraint] });
    }

    torch.addEventListener("click", async () => {
      const next = !torchOn;
      try {
        if (track) await constrain({ torch: next });
        else if (zxing && zxing.switchTorch) await zxing.switchTorch(next);
        torchOn = next;
        torch.classList.toggle("on", next);
        torch.lastElementChild.textContent = next ? "ライトを消す" : "ライト";
      } catch {
        // 非対応の端末では何もしない
      }
    });

    // タップした位置にピントを合わせる（主にAndroid。iPhoneのSafariでは効果はないがエラーにもならない）
    video.addEventListener("click", (e) => {
      const rect = video.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      view.insertAdjacentHTML("beforeend", `<div class="focus-ring" style="left:${x}px;top:${y}px"></div>`);
      const ring = view.lastElementChild;
      setTimeout(() => ring.remove(), 700);

      // 映像は枠いっぱいに拡大（object-fit: cover）しているので、カメラ映像上の位置に直す
      const w = video.videoWidth || rect.width;
      const hgt = video.videoHeight || rect.height;
      const scale = Math.max(rect.width / w, rect.height / hgt);
      const clamp = (n) => Math.min(1, Math.max(0, n));
      const point = {
        x: clamp((x - (rect.width - w * scale) / 2) / (w * scale)),
        y: clamp((y - (rect.height - hgt * scale) / 2) / (hgt * scale)),
      };
      constrain({ pointsOfInterest: [point], focusMode: "single-shot" })
        .then(() => setTimeout(() => constrain({ focusMode: "continuous" }).catch(() => {}), 1200))
        .catch(() => {});
    });

    $(".manual").addEventListener("submit", (e) => {
      e.preventDefault();
      const found = codeFromDigits($("#label-digits").value);
      const error = $(".field-error");
      error.hidden = Boolean(found);
      if (found) location.hash = `/containers/${found}`;
      else error.textContent = "11桁の数字で入力してください（検査ラベルに印字されている数字をそのまま）";
    });

    startNative()
      .then((started) => started || stopped || startZxing())
      .catch((e) => {
        if (stopped) return;
        view.hidden = true;
        // カメラはHTTPS（https://）で開いたページでしか使えない。その時は英語のエラーではなく理由を出す
        const reason =
          !window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia
            ? "この接続ではカメラを使えません。カメラはHTTPS（https://）で開いたときだけ使えます。"
            : e instanceof Error
              ? e.message
              : "カメラを起動できませんでした。カメラの利用を許可してください。";
        const off = $(".camera-off");
        off.innerHTML = show(html`${icon("cameraOff")}<div><strong>カメラを利用できません</strong>${reason}</div>`);
        off.hidden = false;
      });

    return { destroy: stop };
  }

  // ================================================================ 画面全体で受ける操作

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-back]")) history.back();
    // プレビュー（Claudeの画面の中）では電話の画面に移れず、プレビューが開けなくなるので発信しない
    const call = preview && e.target.closest(".call");
    if (call) {
      e.preventDefault();
      call.lastElementChild.textContent = "プレビューでは発信できません";
    }
  });

  // 容器写真が読めない時は枠ごと消す（error は泡立たないので、捕まえる段階で受ける）
  document.addEventListener(
    "error",
    (e) => {
      if (e.target.matches && e.target.matches(".photo img")) e.target.parentNode.remove();
    },
    true,
  );

  // ================================================================ 画面の切り替え

  function pageFor(path, query) {
    if (path === "/" || path === "/scan") return homePage();
    if (path === "/containers") return containersPage();
    if (path === "/search") return searchPage(query);
    const m = path.match(/^\/containers\/([^/]+)$/);
    if (m) return containerPage(decodeURIComponent(m[1]));
    return { html: html`<div class="page">${toolbar()}<p class="state">ページが見つかりません。</p></div>` };
  }

  const main = document.getElementById("main");
  let current = {};
  let currentPath = null;

  function render() {
    const [path, query = ""] = (location.hash.slice(1) || "/").split("?");
    if (path === currentPath) return;
    currentPath = path;

    // 画面ごとに作り直す（カメラのある画面を離れるとカメラも止まる）
    if (current.destroy) current.destroy();
    const page = pageFor(path || "/", query);
    main.innerHTML = page.html.html;
    current = page.mount ? page.mount(main) : {};
    loadOnce();
    if (current.update) current.update();
    const autofocus = main.querySelector("[autofocus]");
    if (autofocus) autofocus.focus();
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", render);
  render();
})();
