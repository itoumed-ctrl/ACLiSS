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
    message: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
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

  // 電話帳（master/phonebook.csv）の1行。大分類 ▶ 小分類 ▶ 内線番号 の順に並べる。
  // 小分類と内線番号のどちらかが空の行は使わない
  function toPhone(row) {
    const name = text(row["小分類"]);
    const number = text(row["内線番号"]);
    if (!name || !number) return null;
    return { group: text(row["大分類"]) || "その他", name, number, note: text(row["説明"]) };
  }

  async function loadMaster() {
    const [c, t, p] = await Promise.all([
      readCsv("master/containers.csv", ["材料コード"]),
      readCsv("master/test_items.csv", ["項目コード", "名称", "材料コード"]),
      // 電話帳は置かなくても使えるよう、読めなくても容器・検査項目の表示は止めない
      readCsv("master/phonebook.csv", ["大分類", "小分類", "内線番号"]).catch(() => ({})),
    ]);
    // 「最終更新」には、読み込んだ時刻ではなくCSVファイル自体の更新日時を出す
    const times = [c.lastModified, t.lastModified, p.lastModified].filter((v) => v && !Number.isNaN(v));
    return {
      phonebook: p.records ? p.records.map(toPhone).filter(Boolean) : null,
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

  // 容器コードから容器を引く表。マスタを読み直した時だけ作り直す
  const byCodeCache = new WeakMap();
  function containerByCode(containerCode) {
    if (!master.data) return null;
    let map = byCodeCache.get(master.data);
    if (!map) {
      map = new Map(master.data.containers.map((c) => [c.code, c]));
      byCodeCache.set(master.data, map);
    }
    return map.get(containerCode) || null;
  }

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
        log("master-error");
      })
      .finally(() => {
        master.loading = false;
        if (current.update) current.update();
      });
  }

  // ================================================================ 利用の記録（ログ）

  // 操作のたびに、空の画像 log.gif を「log.gif?e=view&code=121&via=scan」のように取りに行く。
  // サーバーは何もせずファイルを渡すだけだが、? 以降がWebサーバーのアクセスログに残り、それが利用の記録になる。
  // 患者さんの情報や検索した言葉は送らない。記録できなくてもアプリの動きは変わらない。
  //   e=open      アプリを開いた
  //   e=view      容器の画面を開いた（code=容器コード、via=scan・digits・list・search・direct）
  //   e=notfound  マスタにない容器コードを開いた（code・via は view と同じ）
  //   e=camera    カメラが使えなかった（reason=https・denied・nodevice・other）
  //   e=feedback  ご意見箱から送った（下の feedbackPage を参照）
  function log(event, details) {
    if (preview) return; // 開発確認用のプレビューでは記録しない
    send(event, details).catch(() => {});
  }

  // log.gif を取りに行き、届いたかどうかを返す
  function send(event, details) {
    const params = new URLSearchParams({ e: event, ...details, t: Date.now() });
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = reject;
      img.src = `log.gif?${params}`;
    });
  }

  // どこから容器の画面を開いたか。容器の画面を開いた時に記録して direct（URL・戻る）に戻す
  let via = "direct";
  // カメラが使えなかった記録は、トップを開くたびではなく1回だけ残す
  let cameraLogged = false;

  // ================================================================ 文字

  // 全角・半角、ひらがな・カタカナ、大文字・小文字の違いをそろえて検索する
  function normalize(value) {
    return value
      .normalize("NFKC")
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .replace(/　/g, " ")
      .toLowerCase();
  }

  // 検索用にそろえた文字は、マスタを読んだ後に1件につき1回だけ作って覚えておく（入力のたびに作り直さない）。
  // 項目は改行でつなぐので、検索語が2つの項目にまたがって一致することはない
  const searchKeys = new WeakMap();
  function searchKey(record, ...fields) {
    let key = searchKeys.get(record);
    if (key === undefined) {
      key = normalize(fields.filter(Boolean).join("\n"));
      searchKeys.set(record, key);
    }
    return key;
  }
  const containerName = (c) => [c.vessel, c.material].filter(Boolean).join(" － ");

  // 検査バーコード（12桁）の9〜11桁目が容器コード（12桁目はチェックデジット）。例: 000000001210 → 121
  const codeFromBarcode = (raw) => (/^\d{12}$/.test((raw = raw.trim())) ? raw.slice(8, 11) : null);

  // 検査ラベルに印字された11桁の数字の末尾3桁が容器コード
  const codeFromDigits = (raw) => (/^\d{11}$/.test((raw = raw.trim())) ? raw.slice(-3) : null);

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
  function row({ href, lead, title, sub, from }) {
    const inner = html`${lead}<span class="row-text"><span class="row-title">${title}</span>${
      sub && html`<span class="row-sub">${sub}</span>`
    }</span>`;
    return href
      ? html`<li><a href="${href}" class="row" data-via="${from}">${inner}${icon("chevron")}</a></li>`
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
        const meta = root.querySelector("[data-meta]");
        const body = root.querySelector("[data-body]");
        input.value = query || "";
        function update() {
          const q = normalize(input.value.trim());
          // マスタをまだ読めていない間は探さない（下で「読み込み中」を出す）
          const { rows, count } = master.data ? search(q) : { rows: [] };
          meta.innerHTML = show(updatedAt(count));
          body.innerHTML = show(
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
      )}${menuItem("#/search", "menu-search.png", "検査項目から探す", "検査項目名で検索します")}</nav>${
        // 電話帳は容器を調べる2つとは用途が違うので、枠を分けて間をあける
        html`<nav class="card list menu">${menuItem("#/phonebook", "menu-phonebook.png", "電話帳", "各検査部署へ電話します")}</nav>`
      }<a class="footer-link" href="#/feedback">${icon("message")}ご意見箱（内容の誤り・ご要望）</a></div>`,
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
        const found = q
          ? containers().filter((c) => searchKey(c, c.code, c.vessel, c.material, c.dispense).includes(q))
          : containers();
        return {
          count: found.length,
          rows: found.map((c) =>
            row({
              href: `#/containers/${c.code}`,
              from: "list",
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
        // 表示するのは50件までなので、50件見つかった所で探すのをやめる
        const found = [];
        for (const t of testItems()) {
          if (!searchKey(t, t.name).includes(q)) continue;
          found.push(t);
          if (found.length === 50) break;
        }
        return {
          rows: found.map((t) => {
            if (!t.container) return row({ title: t.name, sub: "対応する容器コードが未設定です" });
            const c = containerByCode(t.container);
            return row({
              href: `#/containers/${t.container}`,
              from: "search",
              title: t.name,
              sub: `容器 ${t.container}` + (c ? `・${containerName(c)}` : ""),
            });
          }),
        };
      },
    });

  // ================================================================ 電話帳

  // 内線番号から電話の画面に渡せる文字（数字と + * #）だけを残す。何も残らなければ押せる番号にしない
  const dialable = (value) => value.replace(/[^\d+*#]/g, "");

  // 番号をタップすると電話の画面が開き、番号が入った状態になる（発信は本人が押す）
  function phoneButton(p) {
    const number = dialable(p.number);
    if (!number) return html`<span class="row-sub">${p.number}</span>`;
    return html`<a class="call-sm" href="tel:${number}" aria-label="${p.name}（${p.number}）に電話をかける">${icon(
      "phone",
    )}<span>${p.number}</span></a>`;
  }

  // 検索欄は置かず、大分類の見出しの下に小分類（説明つき）と番号を並べる（並びはCSVに書いた順）
  function phonebookPage() {
    return {
      html: html`<div class="page">${toolbar()}<h1 class="title">電話帳</h1><div data-meta></div><div data-body></div></div>`,
      mount(root) {
        const meta = root.querySelector("[data-meta]");
        const body = root.querySelector("[data-body]");
        function update() {
          const book = master.data && master.data.phonebook;
          meta.innerHTML = show(book && updatedAt(book.length));
          if (!master.data || !book || book.length === 0) {
            body.innerHTML = show(
              waiting() ||
                html`<p class="state">電話帳がまだありません。院内サーバーの master フォルダの phonebook.csv に番号を書き足すと、ここに出ます。</p>`,
            );
            return;
          }
          // 大分類ごとにまとめる（並びはCSVに最初に出てきた順）
          const groups = new Map();
          for (const p of book) {
            if (!groups.has(p.group)) groups.set(p.group, []);
            groups.get(p.group).push(p);
          }
          body.innerHTML = show(
            html`<ul class="card list">${[...groups].map(([group, items]) => [
              html`<li class="group">${group}</li>`,
              items.map(
                (p) =>
                  html`<li><div class="row"><span class="row-text"><span class="row-title">${p.name}</span>${
                    p.note && html`<span class="row-sub">${p.note}</span>`
                  }</span>${phoneButton(p)}</div></li>`,
              ),
            ])}</ul>`,
          );
        }
        return { update };
      },
    };
  }

  // ================================================================ ご意見箱

  // 送った内容は、利用の記録と同じく log.gif を取りに行くことで、Webサーバーのアクセスログに残す
  // （サーバー側にプログラムを置かない）。読むのはログ集計ツールの「ご意見箱」。
  // IISは「?」以降が2048バイトを超えると受け付けないので、本文は120文字ずつに分けて送り、
  // 同じ id・part（何番目）・parts（全部で何通）を付けて、集計ツールでつなぎ直す。
  const FEEDBACK_KINDS = { error: "内容の誤り", trouble: "使いにくい・不具合", idea: "ほしい機能", other: "その他" };
  const FEEDBACK_MAX = 400;
  const FEEDBACK_PART = 120;

  function feedbackPage(query) {
    const containerCode = new URLSearchParams(query).get("code") || "";
    return {
      html: html`<div class="page">${toolbar()}<h1 class="title">ご意見箱</h1>
        <p class="lead">ACLiSSの内容の誤り、使いにくい点、ほしい機能などを教えてください。臨床検査科で確認します（個別の返信はできません）。</p>
        <form class="card feedback" novalidate>
          <fieldset><legend class="label">種類</legend><div class="choices">${Object.entries(FEEDBACK_KINDS).map(
            ([value, label]) =>
              html`<label><input type="radio" name="kind" value="${value}"${containerCode && value === "error" && html` checked`}><span>${label}</span></label>`,
          )}</div></fieldset>
          <label class="field"><span class="label">内容</span><textarea name="message" rows="6" maxlength="${FEEDBACK_MAX}" placeholder="例: 容器006の採取量が新しい手順書と違います"></textarea><span class="counter">0 / ${FEEDBACK_MAX}</span></label>
          <div class="field-row">
            <label class="field"><span class="label">容器コード（任意）</span><input name="code" type="text" inputmode="numeric" maxlength="3" autocomplete="off" value="${containerCode}"></label>
            <label class="field"><span class="label">部署（任意）</span><input name="dept" type="text" maxlength="20" autocomplete="off" placeholder="例: 4E"></label>
          </div>
          <p class="caution">${icon("info")}患者さんの氏名・ID・病名などは書かないでください。</p>
          <p class="field-error" hidden></p>
          <button type="submit" class="primary">送信する</button>
        </form></div>`,
      mount(root) {
        const form = root.querySelector("form");
        const message = form.elements.message;
        const counter = form.querySelector(".counter");
        const error = form.querySelector(".field-error");
        message.addEventListener("input", () => (counter.textContent = `${message.value.length} / ${FEEDBACK_MAX}`));
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const kind = form.elements.kind.value;
          const text = message.value.trim();
          error.hidden = Boolean(kind && text);
          if (!kind || !text) {
            error.textContent = !kind ? "種類を選んでください" : "内容を入力してください";
            return;
          }
          const button = form.querySelector("button");
          button.disabled = true;
          button.textContent = "送信中...";
          const id = Math.random().toString(36).slice(2, 8);
          const pieces = [];
          for (let i = 0; i < text.length; i += FEEDBACK_PART) pieces.push(text.slice(i, i + FEEDBACK_PART));
          try {
            if (!preview) {
              await Promise.all(
                pieces.map((msg, i) =>
                  send("feedback", {
                    id,
                    part: i + 1,
                    parts: pieces.length,
                    // 種類・容器コード・部署は1通目にだけ付ける
                    ...(i === 0 && { kind, code: form.elements.code.value.trim(), dept: form.elements.dept.value.trim() }),
                    msg,
                  }),
                ),
              );
            }
            form.outerHTML = show(
              html`<section class="card sent">${icon("check")}<h2>送信しました</h2><p>ご意見ありがとうございます。${
                preview && "（プレビューでは実際には送信しません）"
              }</p><div class="sent-actions"><a class="primary" href="#/">ホームに戻る</a><a href="#/feedback" data-again>続けて送る</a></div></section>`,
            );
          } catch {
            button.disabled = false;
            button.textContent = "送信する";
            error.textContent = "送信できませんでした。電波の届く場所で、もう一度お試しください。";
            error.hidden = false;
          }
        });
        return {};
      },
    };
  }

  // ================================================================ 容器詳細

  function containerPage(containerCode) {
    return {
      html: html`<div class="page"></div>`,
      mount(root) {
        const page = root.firstElementChild;
        const from = via;
        via = "direct";
        let logged = false;
        function update() {
          const c = containerByCode(containerCode);
          page.innerHTML = show([
            toolbar(),
            c ? detail(c) : waiting() || html`<p class="alert">容器コード「${containerCode}」は見つかりませんでした。</p>`,
          ]);
          // 見つかった時はすぐ、見つからない時は最新のマスタを読み終えてから1回だけ記録する
          if (!logged && (c || (!master.loading && master.data))) {
            logged = true;
            log(c ? "view" : "notfound", { code: containerCode, via: from });
          }
        }
        return { update };
      },
    };
  }

  // 容器画面の内線番号。電話帳と同じく、タップすると番号が入った電話の画面が開く
  function extension(phs) {
    if (!phs) return null;
    const number = dialable(phs);
    if (!number) return html`<span class="fact-sub">内線 ${phs}</span>`;
    return html`<a class="call" href="tel:${number}">${icon("phone")}内線 ${phs}<span>電話をかける</span></a>`;
  }

  const fact = (label, value, sub, size) =>
    html`<div class="fact"><dt class="label">${label}</dt><dd${size && html` class="${size}"`}>${value}${sub}</dd></div>`;

  // 採取量は数字を大きく、単位の mL を小さく出す。「規定なし」など言葉の時は文字を控えめにする
  function amount(value) {
    const m = (value || "").match(/^(.+) mL$/);
    return m ? html`${m[1]}<small>mL</small>` : value || "規定なし";
  }

  function detail(c) {
    // 採取量は容器コードの右に、容器コードから容器名の下の行までの高さの枠で並べる
    return html`<header class="detail-head"><div><p class="label">容器コード</p><h1 class="detail-code">${c.code}</h1>${
      (c.vessel || c.material) &&
      html`<p class="detail-name">${c.vessel || c.material}${c.vessel && c.material && html`<span>${c.material}</span>`}</p>`
    }</div><div class="amount"><p class="label">採取量</p><p class="amount-value${
      !/ mL$/.test(c.amount || "") && html` words`
    }">${amount(c.amount)}</p></div></header>${
      // 写真ファイルが無い・読めない時は、壊れた画像を出さずに枠ごと消す（下の error の処理）
      c.photo && html`<figure class="card photo"><img src="${c.photo}" alt="容器コード${c.code}の写真"></figure>`
    }<dl class="card facts">${fact(
      "払い出し場所",
      c.dispense || "未設定",
      extension(c.dispensePhs),
      "big",
    )}${(c.inquiry || c.inquiryPhs) && fact("検査問い合わせ先", c.inquiry || "", extension(c.inquiryPhs))}</dl>${
      c.instructions.length > 0 &&
      html`<section class="note gold"><h2>${icon("tag")}指示ラベル</h2><ul>${c.instructions.map((s) => html`<li>${s}</li>`)}</ul></section>`
    }${c.notes && html`<section class="note"><h2>${icon("info")}注意事項</h2><p>${c.notes}</p></section>`}<a class="footer-link" href="#/feedback?code=${encodeURIComponent(
      c.code,
    )}">${icon("message")}この容器の情報の誤りを知らせる</a>`;
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
      via = "scan";
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
      if (found) {
        via = "digits";
        location.hash = `/containers/${found}`;
      } else {
        error.textContent = "11桁の数字で入力してください（検査ラベルに印字されている数字をそのまま）";
      }
    });

    startNative()
      .then((started) => started || stopped || startZxing())
      .catch((e) => {
        if (stopped) return;
        view.hidden = true;
        // カメラはHTTPS（https://）で開いたページでしか使えない。その時は英語のエラーではなく理由を出す
        const insecure = !window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia;
        const kind = insecure ? "https" : { NotAllowedError: "denied", NotFoundError: "nodevice" }[e && e.name] || "other";
        if (!cameraLogged) log("camera", { reason: kind });
        cameraLogged = true;
        const reason = insecure
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
    // 「続けて送る」：同じURLのままでも入力欄を空にして作り直す
    if (e.target.closest("[data-again]") && location.hash === "#/feedback") {
      e.preventDefault();
      currentHash = null;
      render();
    }
    const link = e.target.closest("[data-via]");
    if (link) via = link.dataset.via;
    // プレビュー（Claudeの画面の中）では電話の画面に移れず、プレビューが開けなくなるので発信しない
    const call = preview && e.target.closest(".call, .call-sm");
    if (call) {
      e.preventDefault();
      call.lastElementChild.textContent = call.classList.contains("call") ? "プレビューでは発信できません" : "プレビュー不可";
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
    if (path === "/phonebook") return phonebookPage();
    if (path === "/feedback") return feedbackPage(query);
    const m = path.match(/^\/containers\/([^/]+)$/);
    if (m) return containerPage(decodeURIComponent(m[1]));
    return { html: html`<div class="page">${toolbar()}<p class="state">ページが見つかりません。</p></div>` };
  }

  const main = document.getElementById("main");
  let current = {};
  let currentHash = null;

  // URLの#以降が変わった時だけ作り直す（検索語は replaceState で書き換えるので、入力のたびには呼ばれない）
  function render() {
    if (location.hash === currentHash) return;
    currentHash = location.hash;
    const [path, query = ""] = (location.hash.slice(1) || "/").split("?");

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

  // オープニングは消え終わったら取り除く。タップすればすぐ閉じる
  const opening = document.querySelector(".opening");
  if (opening) {
    opening.addEventListener("click", () => opening.remove());
    opening.addEventListener("animationend", (e) => e.animationName === "opening-out" && opening.remove());
  }

  window.addEventListener("hashchange", render);
  log("open");
  render();
})();
