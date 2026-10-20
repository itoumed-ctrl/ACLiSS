// ACLiSS 院内サーバー版。index.html と同じ場所にある master/ のCSVと images/ のPNGだけで動く。
// 画面の切り替えは「#/containers/121」のようにURLの#以降で行うため、
// index.html を置いたフォルダがどこであっても（例: /acliss/）サーバー側の設定なしで動く。
(function () {
  "use strict";

  const CONTAINERS_CSV = "master/containers.csv";
  const TEST_ITEMS_CSV = "master/test_items.csv";
  const ZXING_JS = "vendor/zxing-browser.min.js?v=__BUILD_ID__";
  const CACHE_KEY = "acliss-intranet-master-v2";

  // 開発中の確認用プレビュー（npm run build:intranet -- --preview）だけが使う。
  // サーバーに置かず1ファイルで動かすため、CSVと写真をページ内に埋め込んで渡す。
  const preview = window.__ACLISS_PREVIEW__;

  // ---------------------------------------------------------------- 画面部品の作り方

  // h("p", { class: "alert" }, "文字", 子要素…) で要素を作る。文字は必ず文字として入るので、
  // CSVにどんな内容が書かれていても画面が壊れない。
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value == null || value === false) continue;
      if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? "" : value);
    }
    el.append(...clean(children));
    return el;
  }

  function clean(children) {
    return children.flat().filter((c) => c != null && c !== false && c !== "");
  }

  function fill(el, ...children) {
    el.replaceChildren(...clean(children));
  }

  // ---------------------------------------------------------------- マスタの読み込み

  // Excelで「CSV（コンマ区切り）」保存するとShift_JISになり、「CSV UTF-8」だとUTF-8になる。
  // どちらで保存されても読めるよう、UTF-8として読めなければShift_JISとして読み直す。
  function decodeCsv(buffer) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      return new TextDecoder("shift_jis").decode(buffer);
    }
  }

  // CSVを「1行目の列名 → 値」の行の並びにする。"" で囲んだ値の中のカンマ・改行にも対応する。
  function parseCsv(text) {
    const rows = [];
    let row = [];
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
        row.push(value);
        value = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(value);
        rows.push(row);
        row = [];
        value = "";
      } else {
        value += c;
      }
    }
    if (value !== "" || row.length > 0) rows.push([...row, value]);

    const nonEmpty = rows.filter((r) => r.length > 1 || r[0] !== "");
    const columns = (nonEmpty[0] || []).map((name) => name.replace(/^﻿/, "").trim());
    const records = nonEmpty
      .slice(1)
      .map((r) => Object.fromEntries(columns.map((name, i) => [name, r[i]])));
    return { columns, records };
  }

  async function readCsvFile(path) {
    if (preview) {
      const text = preview.files[path];
      if (text === undefined) throw new Error(`${path} がプレビューに含まれていません。`);
      return { text, lastModified: null };
    }
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) {
      throw new Error(
        `${path} を読み込めませんでした（${res.status}）。院内サーバーの master フォルダにファイルがあるか確認してください。`,
      );
    }
    return { text: decodeCsv(await res.arrayBuffer()), lastModified: res.headers.get("last-modified") };
  }

  async function fetchCsv(path, requiredColumns) {
    const { text, lastModified } = await readCsvFile(path);
    const { columns, records } = parseCsv(text);
    const missing = requiredColumns.filter((c) => !columns.includes(c));
    if (missing.length > 0) {
      throw new Error(
        `${path} の1行目（列名）に ${missing.join("、")} がありません。ひな型（ACLiSSマスタ.xlsx）と同じ列名にしてください。`,
      );
    }
    return { records, lastModified };
  }

  // マスタの列名は、ひな型（ACLiSSマスタ.xlsx）の「材料」「オーダ可能項目」シートの1行目と同じ。
  // 各シートをCSVで保存したものを containers.csv・test_items.csv として置く。

  // 空欄・空白だけ・Excelの参照エラー（#N/A）は null にする
  function text(value) {
    const v = (value || "").trim();
    return v && v !== "#N/A" ? v : null;
  }

  // 材料コードは3桁。ExcelでCSVを開き直すと先頭の0が消える（073 → 73）ため補う。
  function code(value) {
    const v = text(value);
    return v && /^\d{1,2}$/.test(v) ? v.padStart(3, "0") : v;
  }

  // 内線番号の「-」は番号なし
  function phone(value) {
    const v = text(value);
    return v === "-" ? null : v;
  }

  function toContainer(row) {
    const containerCode = code(row["材料コード"]);
    if (!containerCode) return null;
    const amount = text(row["規定採取量"]);
    return {
      container_code: containerCode,
      vessel: text(row["VESSEL"]),
      material: text(row["MATERIAL"]),
      dispense_location: text(row["容器払い出し"]),
      dispense_phs: phone(row["内線番号①"]),
      inquiry_dept: text(row["問い合わせ先"]),
      inquiry_phs: phone(row["内線番号②"]),
      collection_amount: amount === "----" ? "規定なし" : amount,
      // 指示は、指示①〜③のどれかに文が入っていれば表示する
      instructions: [row["指示①"], row["指示②"], row["指示③"]].map(text).filter(Boolean),
      notes: text(row["注意事項"]),
      image_url: imagePath(code(row["画像コード"])),
    };
  }

  function toTestItem(row) {
    const itemCode = text(row["項目コード"]);
    if (!itemCode) return null;
    return {
      test_item_code: itemCode,
      test_item_name: text(row["名称"]) || "",
      container_code: code(row["材料コード"]),
    };
  }

  // 容器写真は images/<画像の容器コード>.png
  function imagePath(imageCode) {
    if (!imageCode) return null;
    if (preview) return preview.images[imageCode] || null;
    return `images/${encodeURIComponent(imageCode)}.png`;
  }

  async function loadMaster() {
    const [containersCsv, testItemsCsv] = await Promise.all([
      fetchCsv(CONTAINERS_CSV, ["材料コード"]),
      fetchCsv(TEST_ITEMS_CSV, ["項目コード", "名称", "材料コード"]),
    ]);

    // 画面の「最終更新」には、読み込んだ時刻ではなくCSVファイル自体の更新日時を出す。
    const modifiedTimes = [containersCsv.lastModified, testItemsCsv.lastModified]
      .map((v) => (v ? Date.parse(v) : NaN))
      .filter((t) => !Number.isNaN(t));
    const updatedAt = new Date(modifiedTimes.length > 0 ? Math.max(...modifiedTimes) : Date.now()).toISOString();

    const containers = containersCsv.records
      .map(toContainer)
      .filter(Boolean)
      .sort((a, b) => a.container_code.localeCompare(b.container_code, "ja", { numeric: true }));
    const testItems = testItemsCsv.records.map(toTestItem).filter(Boolean);
    return { containers, testItems, updatedAt };
  }

  // 電波が弱い場所でも使えるよう、読み込んだマスタの控えを端末に残す（個人情報は含まない）。
  function readCache() {
    try {
      const data = JSON.parse(localStorage.getItem(CACHE_KEY));
      return data && data.containers && data.testItems ? data : null;
    } catch {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // 保存できない端末設定でも表示自体は続ける
    }
  }

  const master = { data: readCache(), loaded: false, loading: false, error: null, isOffline: false };

  // ページを開いている間は1回だけ読む。読めなかった時は、次に画面を移動した時に読み直す。
  function loadMasterOnce() {
    if (master.loading || master.loaded) return;
    master.loading = true;
    master.error = null;
    loadMaster()
      .then((fresh) => {
        master.data = fresh;
        master.loaded = true;
        master.isOffline = false;
        writeCache(fresh);
      })
      .catch((e) => {
        master.isOffline = true;
        master.error = e instanceof Error ? e.message : "マスタを読み込めませんでした";
      })
      .finally(() => {
        master.loading = false;
        if (current.update) current.update();
      });
  }

  const containers = () => (master.data ? master.data.containers : []);
  const testItems = () => (master.data ? master.data.testItems : []);

  // ---------------------------------------------------------------- 文字の扱い

  // 検索用に、全角・半角、ひらがな・カタカナ、大文字・小文字の違いをそろえる。
  function normalizeForSearch(value) {
    return value
      .normalize("NFKC")
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .replace(/　/g, " ")
      .toLowerCase();
  }

  // 一覧・検索画面で表示する容器名（VESSEL・MATERIAL併記）
  function containerLabel(c) {
    return [c.vessel, c.material].filter(Boolean).join(" － ");
  }

  // 検査バーコード（12桁）の下4桁のうち、末尾のチェックデジットを除いた3桁が容器コード。
  // 例: "000000001210" → "121"。チェックデジット自体の検証はしない。
  function codeFromBarcode(barcode) {
    const digits = barcode.trim();
    return /^\d{12}$/.test(digits) ? digits.slice(8, 11) : null;
  }

  // ラベルに印字された11桁の数字（バーコードからチェックデジットを除いたもの）の末尾3桁が容器コード。
  function codeFromLabelDigits(labelDigits) {
    const digits = labelDigits.trim();
    return /^\d{11}$/.test(digits) ? digits.slice(-3) : null;
  }

  // ---------------------------------------------------------------- 画面に共通の部品

  function backNav() {
    return h(
      "div",
      { class: "back-nav" },
      h("button", { type: "button", onclick: () => history.back() }, "← 戻る"),
      h("a", { href: "#/" }, "ホーム"),
    );
  }

  function updatedAtNotice() {
    if (!master.data) return null;
    const formatted = new Date(master.data.updatedAt).toLocaleString("ja-JP", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return h(
      "p",
      { class: "notice" },
      master.isOffline ? `オフラインのため前回のデータを表示中（最終更新: ${formatted}）` : `最終更新: ${formatted}`,
    );
  }

  // 一覧がまだ空の間だけ「読み込み中」「エラー」を出す
  function loadingState(items) {
    if (items.length > 0) return null;
    if (master.loading) return h("p", {}, "読み込み中...");
    if (master.error) return h("p", { class: "error-text" }, `エラー: ${master.error}`);
    return null;
  }

  // ---------------------------------------------------------------- トップ

  function homePage() {
    const scanner = barcodeScanner();
    return {
      el: h(
        "div",
        { class: "page home" },
        scanner.el,
        homeButton("#/containers", "容器一覧から選ぶ", "容器コードや種類から探します"),
        homeButton("#/search", "検査項目から探す", "検査項目名で検索します"),
      ),
      destroy: scanner.destroy,
    };
  }

  function homeButton(href, title, description) {
    return h(
      "a",
      { href, class: "home-button" },
      h("span", { class: "home-button-title" }, title),
      h("span", { class: "home-button-desc" }, description),
    );
  }

  function scanPage() {
    const scanner = barcodeScanner();
    return {
      el: h("div", { class: "page" }, backNav(), h("h1", { class: "title mb-4" }, "バーコードをスキャン"), scanner.el),
      destroy: scanner.destroy,
    };
  }

  // ---------------------------------------------------------------- 容器一覧

  function containersPage() {
    const input = h("input", { type: "text", class: "field", placeholder: "ラベル右下の3桁番号を入力" });
    const notice = h("div");
    const status = h("div");
    const list = h("ul", { class: "list" });
    const empty = h("div");

    function update() {
      const all = containers();
      const q = normalizeForSearch(input.value.trim());
      const found = q
        ? all.filter((c) =>
            [c.container_code, c.vessel, c.material, c.dispense_location]
              .filter(Boolean)
              .some((field) => normalizeForSearch(field).includes(q)),
          )
        : all;

      fill(notice, updatedAtNotice());
      fill(status, loadingState(all));
      fill(
        list,
        found.map((c) =>
          h(
            "li",
            {},
            h(
              "a",
              { href: `#/containers/${c.container_code}`, class: "container-link" },
              h("span", { class: "code-badge" }, c.container_code),
              h("span", { class: "container-name" }, containerLabel(c)),
            ),
          ),
        ),
      );
      fill(empty, !master.loading && all.length > 0 && found.length === 0 && h("p", { class: "empty" }, "該当する容器が見つかりません"));
    }

    input.addEventListener("input", update);
    return {
      el: h(
        "div",
        { class: "page" },
        h("div", { class: "sticky-head" }, backNav(), h("h1", { class: "title mb-4" }, "容器一覧から選ぶ"), input, notice),
        status,
        list,
        empty,
      ),
      update,
    };
  }

  // ---------------------------------------------------------------- 検査項目検索

  function searchPage(query) {
    // 検索語をURLにも残し、容器の画面から戻ってきたときに検索語が消えないようにする。
    const input = h("input", {
      type: "text",
      class: "field",
      placeholder: "検査項目名を入力（例: グルコース）",
      autofocus: true,
    });
    input.value = new URLSearchParams(query).get("q") || "";
    const notice = h("div");
    const status = h("div");
    const list = h("ul", { class: "list" });
    const empty = h("div");

    function update() {
      const q = normalizeForSearch(input.value.trim());
      const byCode = new Map(containers().map((c) => [c.container_code, c]));
      const found = q ? testItems().filter((t) => normalizeForSearch(t.test_item_name).includes(q)).slice(0, 50) : [];

      fill(notice, updatedAtNotice());
      fill(status, loadingState(testItems()), !q && h("p", { class: "muted" }, "検査項目名の一部を入力してください"));
      fill(list, found.map((t) => h("li", {}, testItemRow(t, byCode.get(t.container_code)))));
      fill(empty, q && !master.loading && found.length === 0 && h("p", { class: "empty" }, "該当する検査項目が見つかりません"));
    }

    input.addEventListener("input", () => {
      const value = input.value;
      history.replaceState(history.state, "", value ? `#/search?${new URLSearchParams({ q: value })}` : "#/search");
      update();
    });
    return {
      el: h(
        "div",
        { class: "page" },
        h("div", { class: "sticky-head" }, backNav(), h("h1", { class: "title mb-4" }, "検査項目から探す"), input, notice),
        status,
        list,
        empty,
      ),
      update,
    };
  }

  function testItemRow(item, container) {
    if (!item.container_code) {
      return h(
        "div",
        { class: "item unset" },
        h("span", { class: "item-name" }, item.test_item_name),
        h("span", { class: "item-sub" }, "対応する容器コードが未設定です"),
      );
    }
    return h(
      "a",
      { href: `#/containers/${item.container_code}`, class: "item" },
      h("span", { class: "item-name" }, item.test_item_name),
      h("span", { class: "item-sub" }, `容器コード: ${item.container_code}`, container && `（${containerLabel(container)}）`),
    );
  }

  // ---------------------------------------------------------------- 容器詳細

  function containerPage(code) {
    const body = h("div");

    function update() {
      const c = containers().find((x) => x.container_code === code);
      if (c) fill(body, containerDetail(c));
      else if (master.loading) fill(body, h("p", {}, "読み込み中..."));
      else if (master.error) fill(body, h("p", { class: "alert" }, `エラー: ${master.error}`));
      else fill(body, h("p", { class: "alert" }, `容器コード「${code}」は見つかりませんでした。`));
    }

    return { el: h("div", { class: "page" }, backNav(), body), update };
  }

  function containerDetail(c) {
    const extension = (phs) => (phs ? `（内線: ${phs}）` : "");
    return h(
      "div",
      { class: "detail" },
      h(
        "div",
        {},
        h("h1", { class: "detail-code" }, c.container_code),
        (c.vessel || c.material) && h("p", { class: "detail-name" }, containerLabel(c)),
      ),
      // 写真ファイルが見つからない・読み込めない場合は、壊れた画像を出さずに枠ごと消す。
      c.image_url &&
        h("img", {
          src: c.image_url,
          alt: `容器コード${c.container_code}の写真`,
          class: "photo",
          onerror: (e) => e.target.remove(),
        }),
      detailRow("採取量", c.collection_amount || "規定なし", true),
      detailRow(
        "払い出し場所",
        c.dispense_location ? c.dispense_location + extension(c.dispense_phs) : "未設定",
        true,
      ),
      c.instructions.length > 0 &&
        h(
          "div",
          { class: "box instructions" },
          h("p", { class: "box-title" }, "指示ラベル"),
          h("ul", { class: "box-body" }, c.instructions.map((text) => h("li", {}, text))),
        ),
      c.notes &&
        h(
          "div",
          { class: "box notes" },
          h("p", { class: "box-title" }, "注意事項"),
          h("p", { class: "box-body" }, c.notes),
        ),
      (c.inquiry_dept || c.inquiry_phs) &&
        detailRow("検査問い合わせ先", (c.inquiry_dept || "") + extension(c.inquiry_phs)),
    );
  }

  function detailRow(label, value, big) {
    return h(
      "div",
      {},
      h("p", { class: "row-label" }, label),
      h("p", { class: big ? "row-value big" : "row-value" }, value),
    );
  }

  // ---------------------------------------------------------------- バーコードスキャン

  // 検査バーコードは1次元バーコード。よく使われる形式に絞ると精度・速度が上がる。
  const NATIVE_FORMATS = ["code_128", "itf", "code_39", "codabar", "ean_13"];
  const ZXING_FORMATS = ["CODE_128", "ITF", "CODE_39", "CODABAR", "EAN_13"];

  // カメラの解像度が低いと1次元バーコードが読み取りにくいため、
  // 高めの解像度と連続オートフォーカスを希望する（対応していない端末は無視される）。
  const VIDEO_CONSTRAINTS = {
    facingMode: "environment",
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    advanced: [{ focusMode: "continuous" }],
  };

  // ブラウザ内蔵の読み取り（BarcodeDetector）がない端末（iPhoneなど）だけ、
  // 院内サーバーに同梱した読み取り部品（ZXing）を読み込んで使う。
  function loadZxing() {
    if (window.ZXingBrowser) return Promise.resolve(window.ZXingBrowser);
    return new Promise((resolve, reject) => {
      const script = h("script", { src: ZXING_JS });
      script.onload = () => resolve(window.ZXingBrowser);
      script.onerror = () => reject(new Error("バーコードの読み取り部品（vendor フォルダ）を読み込めませんでした。"));
      document.head.append(script);
    });
  }

  function barcodeScanner() {
    let stopped = false;
    let found = false;
    let track = null; // ブラウザ内蔵の読み取りで使っているカメラ
    let zxing = null; // ZXingで読み取っている場合の操作口
    let torchOn = false;
    const cleanups = [];

    const video = h("video", { muted: true, playsinline: true, onclick: onVideoTap });
    video.muted = true;
    const status = h("span", { class: "camera-status" }, "カメラを起動中...");
    const torch = h("button", { type: "button", class: "torch", hidden: true, onclick: toggleTorch }, "💡 ライトをつける");
    const camera = h("div", { class: "camera" }, video, h("div", { class: "camera-guide" }), status, torch);
    const cameraError = h("p", { class: "alert mb-4", hidden: true });
    const scanned = h("p", { class: "scanned", hidden: true });
    const input = h("input", { type: "text", inputmode: "numeric", class: "field", placeholder: "例: 00000000121" });
    const formError = h("p", { class: "form-error", hidden: true });

    function stop() {
      stopped = true;
      cleanups.splice(0).forEach((fn) => fn());
    }

    function onDetected(raw) {
      if (stopped || found) return;
      const code = codeFromBarcode(raw);
      if (!code) {
        fill(scanned, "読み取った内容: ", h("span", {}, raw), h("br"), "12桁の数字として認識できなかったため、容器コードへ変換できませんでした。");
        scanned.hidden = false;
        return;
      }
      found = true;
      cleanups.splice(0).forEach((fn) => fn());
      camera.classList.add("success");
      status.textContent = "✓ 読み取り完了";
      setTimeout(() => (location.hash = `/containers/${code}`), 400);
    }

    function showTorchIfSupported(capabilities) {
      if (capabilities && capabilities.torch) torch.hidden = false;
    }

    async function startNative() {
      if (!("BarcodeDetector" in window)) return false;
      const supported = await BarcodeDetector.getSupportedFormats().catch(() => []);
      const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
      if (formats.length === 0) return false;

      const detector = new BarcodeDetector({ formats });
      const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
      cleanups.push(() => stream.getTracks().forEach((t) => t.stop()));
      if (stopped) {
        stop();
        return true;
      }
      video.srcObject = stream;
      await video.play();
      track = stream.getVideoTracks()[0];
      try {
        showTorchIfSupported(track.getCapabilities && track.getCapabilities());
      } catch {
        // 対応確認に失敗しても致命的ではないので無視する
      }
      status.textContent = "スキャン中...";

      let rafId = 0;
      let busy = false;
      const tick = () => {
        if (!busy && video.readyState >= 2) {
          busy = true;
          detector
            .detect(video)
            .then((barcodes) => barcodes.length > 0 && onDetected(barcodes[0].rawValue))
            .catch(() => {}) // 1フレームの検出失敗は無視して次に進む
            .finally(() => (busy = false));
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
      cleanups.push(() => cancelAnimationFrame(rafId));
      return true;
    }

    async function startZxing() {
      const ZX = await loadZxing();
      // 2 = 読み取る形式の指定、3 = 時間をかけてでも正確に読む（ZXingの設定番号）
      const hints = new Map([
        [2, ZXING_FORMATS.map((f) => ZX.BarcodeFormat[f])],
        [3, true],
      ]);
      const reader = new ZX.BrowserMultiFormatReader(hints);
      const controls = await reader.decodeFromConstraints({ video: VIDEO_CONSTRAINTS }, video, (result) => {
        if (result) onDetected(result.getText());
      });
      cleanups.push(() => controls.stop());
      if (stopped) {
        stop();
        return;
      }
      zxing = controls;
      status.textContent = "スキャン中...";
      try {
        showTorchIfSupported(controls.streamVideoCapabilitiesGet && controls.streamVideoCapabilitiesGet((t) => [t]));
      } catch {
        // 対応確認に失敗しても致命的ではないので無視する
      }
    }

    async function applyConstraint(constraint) {
      try {
        if (track) await track.applyConstraints({ advanced: [constraint] });
        else if (zxing && zxing.streamVideoConstraintsApply) await zxing.streamVideoConstraintsApply({ advanced: [constraint] });
      } catch {
        // 対応していない端末では何も起きないため無視してよい
      }
    }

    async function toggleTorch() {
      const next = !torchOn;
      try {
        if (track) await track.applyConstraints({ advanced: [{ torch: next }] });
        else if (zxing && zxing.switchTorch) await zxing.switchTorch(next);
        torchOn = next;
        torch.classList.toggle("on", next);
        torch.textContent = next ? "💡 ライトを消す" : "💡 ライトをつける";
      } catch {
        // 端末が対応していない場合は何もしない
      }
    }

    // タップした位置にフォーカスを送る。対応端末（主にAndroid）では実際にその位置へ
    // フォーカスが移る。iPhoneのSafariなどでは効果はないが、エラーにはならない。
    function onVideoTap(e) {
      const rect = video.getBoundingClientRect();
      const tapX = e.clientX - rect.left;
      const tapY = e.clientY - rect.top;

      // タップが反応したことが分かるよう、タップした場所にフォーカスリングを一瞬出す
      const ring = h("div", { class: "focus-ring", style: `left:${tapX}px;top:${tapY}px` });
      camera.append(ring);
      setTimeout(() => ring.remove(), 700);

      // 映像は枠いっぱいに拡大（object-fit: cover）しているため、実際のカメラ映像上の位置に直す
      const width = video.videoWidth || rect.width;
      const height = video.videoHeight || rect.height;
      const scale = Math.max(rect.width / width, rect.height / height);
      const clamp = (n) => Math.min(1, Math.max(0, n));
      const x = clamp((tapX - (rect.width - width * scale) / 2) / (width * scale));
      const y = clamp((tapY - (rect.height - height * scale) / 2) / (height * scale));

      applyConstraint({ pointsOfInterest: [{ x, y }], focusMode: "single-shot" }).then(() => {
        // 単発フォーカスのあとは、通常の連続オートフォーカスに戻す
        setTimeout(() => applyConstraint({ focusMode: "continuous" }), 1200);
      });
    }

    function onManualSubmit(e) {
      e.preventDefault();
      const code = codeFromLabelDigits(input.value);
      if (!code) {
        formError.textContent = "11桁の数字で入力してください（ラベルに印字されている数字をそのまま）";
        formError.hidden = false;
        return;
      }
      formError.hidden = true;
      location.hash = `/containers/${code}`;
    }

    startNative()
      .then((started) => started || stopped || startZxing())
      .catch((e) => {
        if (stopped) return;
        camera.hidden = true;
        // ブラウザはHTTPSで開いたページにしかカメラを使わせない（院内サーバーをhttp://で
        // 開いた場合など）。その場合は分かりにくい英語のエラーではなく理由を伝える。
        const reason =
          !window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia
            ? "この接続ではカメラを使えません。カメラはHTTPS（https://）で開いたときだけ使えます。"
            : e instanceof Error
              ? e.message
              : "カメラを起動できませんでした。カメラの利用を許可してください。";
        fill(cameraError, `カメラを利用できません: ${reason}`, h("br"), "下の欄にラベルの11桁の数字を直接入力してください。");
        cameraError.hidden = false;
      });

    return {
      el: h(
        "div",
        {},
        camera,
        cameraError,
        scanned,
        h("p", { class: "hint" }, "カメラがうまく読み取れない場合は、ラベルの11桁の数字を直接入力できます。"),
        h("form", { class: "manual", onsubmit: onManualSubmit }, input, h("button", { type: "submit" }, "検索")),
        formError,
      ),
      destroy: stop,
    };
  }

  // ---------------------------------------------------------------- 画面の切り替え

  function pageFor(path, query) {
    if (path === "/") return homePage();
    if (path === "/scan") return scanPage();
    if (path === "/containers") return containersPage();
    if (path === "/search") return searchPage(query);
    const detail = path.match(/^\/containers\/([^/]+)$/);
    if (detail) return containerPage(decodeURIComponent(detail[1]));
    return { el: h("div", { class: "page" }, backNav(), h("p", {}, "ページが見つかりません。")) };
  }

  const main = document.getElementById("main");
  let current = {};
  let currentPath = null;

  function render() {
    const hash = location.hash.slice(1) || "/";
    const [path, query = ""] = hash.split("?");
    if (path === currentPath) return;
    currentPath = path;

    // 画面ごとに作り直す（トップを離れたらカメラも止まる）
    if (current.destroy) current.destroy();
    current = pageFor(path || "/", query);
    main.replaceChildren(current.el);
    loadMasterOnce();
    if (current.update) current.update();
    const autofocus = main.querySelector("[autofocus]");
    if (autofocus) autofocus.focus();
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", render);
  render();
})();
