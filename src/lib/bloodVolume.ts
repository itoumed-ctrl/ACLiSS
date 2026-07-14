// 最低採血量計算ツールのデータとロジック。
//
// 元データは検査室から共有された「検体必要量一覧」（Excel）。
// 項目を選ぶと、容器（採血管）ごとに必要な検体量を計算する。
//
// 【基本的な考え方】
// - 検査は容器（血清・全血・血漿など）ごとに別々に採血する。
// - 同じ容器に入る項目は、その容器の中で「グループ」ごとに必要量を出し、足し算する。
// - グループには、項目数で量が決まるもの（①）、組み合わせで固定量になるもの（②〜⑦）、
//   単独量をそのまま足すもの（個別）、アレルギー特有の計算などがある。
//
// あくまで目安であり、実際の量は検体の状態や組み合わせで変わる旨は画面に注記する。

export type ContainerId =
  | "serum_by"
  | "whole_purple"
  | "plasma_purple"
  | "whole_special"
  | "plasma_special"
  | "coag_lb";

export const CONTAINERS: Record<ContainerId, { label: string }> = {
  serum_by: { label: "血清（茶・黄ミニコレクト）" },
  whole_purple: { label: "全血（紫・紫ミニコレクト）" },
  plasma_purple: { label: "血漿（紫・紫ミニコレクト）" },
  whole_special: { label: "全血（専用容器）" },
  plasma_special: { label: "血漿（専用容器）" },
  coag_lb: { label: "水色ミニコレクト" },
};

// 計算グループの種別
// - chem1  : ①組み合わせ。①メンバーの項目数で 0.2/0.3/0.4。加算項目（addOn）は別途 +0.1。
// - combo  : ②〜⑦。グループ内の選択数が 1 なら単独量、2 以上なら組み合わせ固定量。
// - allergy: アレルギー。0.2 +（追加項目数 × 0.04）。
// - single : 個別。単独量をそのまま足す。
export type GroupKind = "chem1" | "combo" | "allergy" | "single";

export interface TestItem {
  id: string;
  name: string;
  field: string; // 画面上の分野（ボタンのまとまり）
  container: ContainerId;
  group: string; // 計算グループのID
  groupKind: GroupKind;
  single: number; // 単独で測る場合の量(mL)
  comboAmount?: number; // combo グループの組み合わせ時の固定量(mL)
  chem1Member?: boolean; // ①の項目数にカウントする
  addOnToChem1?: boolean; // ①のベース量に +0.1 する加算項目
  note?: string;
}

// combo グループの組み合わせ量（2項目以上のとき）
const COMBO_AMOUNT: Record<string, number> = {
  thyroid: 0.2, // ②甲状腺
  hema: 0.2, // ③造血マーカー
  tumor: 0.2, // ④腫瘍マーカー
  infection: 0.4, // ⑤感染症
  cardiac: 0.5, // ⑥心マーカー
  drug: 0.3, // ⑦薬物（ジゴキシン除く）
};

// ---- 項目定義（Excelの並び順に沿って分野ごとに）----

const chem1 = (id: string, name: string): TestItem => ({
  id,
  name,
  field: "生化学",
  container: "serum_by",
  group: "chem1",
  groupKind: "chem1",
  single: 0.2,
  chem1Member: true,
});

const plasmaProtein = (id: string, name: string): TestItem => ({
  id,
  name,
  field: "血漿蛋白",
  container: "serum_by",
  group: "chem1",
  groupKind: "chem1",
  single: 0.2,
  chem1Member: true,
});

const combo = (
  id: string,
  name: string,
  field: string,
  group: string,
  single: number,
): TestItem => ({
  id,
  name,
  field,
  container: "serum_by",
  group,
  groupKind: "combo",
  single,
  comboAmount: COMBO_AMOUNT[group],
});

const single = (
  id: string,
  name: string,
  field: string,
  amount: number,
  container: ContainerId = "serum_by",
): TestItem => ({
  id,
  name,
  field,
  container,
  group: `single_${id}`,
  groupKind: "single",
  single: amount,
});

export const TEST_ITEMS: TestItem[] = [
  // 生化学（①）
  chem1("ast", "AST"),
  chem1("alt", "ALT"),
  chem1("ld", "LD"),
  chem1("alp", "ALP"),
  chem1("ggt", "γ-GT"),
  chem1("che", "ChE"),
  chem1("ck", "CK"),
  chem1("tp", "TP"),
  chem1("alb", "ALB"),
  chem1("un", "UN"),
  chem1("cre", "CRE"),
  chem1("ua", "UA"),
  chem1("tcho", "T-Cho"),
  chem1("tg", "TG"),
  chem1("amy", "AMY"),
  chem1("pamy", "P-AMY"),
  chem1("ca", "Ca"),
  chem1("ip", "IP"),
  chem1("mg", "Mg"),
  chem1("glu", "GLU"),
  chem1("tbil", "T-Bil"),
  chem1("dbil", "D-Bil"),
  chem1("fe", "Fe"),
  chem1("zn", "Zn"),
  chem1("lip", "LIP"),
  // ①への加算項目
  {
    id: "uibc",
    name: "UIBC",
    field: "生化学",
    container: "serum_by",
    group: "chem1",
    groupKind: "chem1",
    single: 0.3,
    chem1Member: true,
    addOnToChem1: true,
  },
  {
    id: "tibc",
    name: "TIBC",
    field: "生化学",
    container: "serum_by",
    group: "chem1",
    groupKind: "chem1",
    single: 0,
    note: "TIBCはFeとUIBCから計算します。Fe・UIBCの採取が必要です。",
  },
  {
    id: "denkaishitsu",
    name: "電解質（Na・K・Cl）",
    field: "生化学",
    container: "serum_by",
    group: "chem1",
    groupKind: "chem1",
    single: 0.3,
    chem1Member: true,
    addOnToChem1: true,
  },

  // 血漿蛋白（①）
  plasmaProtein("crp", "CRP"),
  plasmaProtein("igg", "IgG"),
  plasmaProtein("iga", "IgA"),
  plasmaProtein("igm", "IgM"),
  plasmaProtein("c3", "C3"),
  plasmaProtein("c4", "C4"),
  plasmaProtein("aslo", "ASLO"),
  plasmaProtein("rf", "RF"),
  plasmaProtein("hapto", "ハプトグロビン"),
  plasmaProtein("ch50", "CH50"),
  {
    id: "b2mg",
    name: "β2-MG",
    field: "血漿蛋白",
    container: "serum_by",
    group: "chem1",
    groupKind: "chem1",
    single: 0.3,
    chem1Member: true,
    addOnToChem1: true,
    note: "電解質も併せて測る場合は、さらに +0.1 mL 必要です。",
  },
  // NH3 は血漿蛋白の並びだが容器が異なる（全血・紫）
  single("nh3", "NH3（アンモニア）", "血漿蛋白", 0.1, "whole_purple"),

  // 血液検査
  single("cbc", "CBC・血液像", "血液検査", 0.3, "whole_purple"),

  // 凝固（5項目まとめて1本）
  {
    id: "coag",
    name: "凝固（PT・APTT・FIB・FDP・Dダイマー）",
    field: "凝固",
    container: "coag_lb",
    group: "single_coag",
    groupKind: "single",
    single: 1.0,
    note: "二重線のラインまでを遵守してください。ラインより多くても少なくても参考値になります。",
  },

  // 薬物
  single("digoxin", "ジゴキシン", "薬物", 0.3),
  combo("theophylline", "テオフィリン", "薬物", "drug", 0.3),
  combo("phenobarbital", "フェノバルビタール", "薬物", "drug", 0.3),
  combo("phenytoin", "フェニトイン", "薬物", "drug", 0.3),
  combo("carbamazepine", "カルバマゼピン", "薬物", "drug", 0.3),
  combo("valproic", "バルプロ酸", "薬物", "drug", 0.3),
  combo("vancomycin", "バンコマイシン", "薬物", "drug", 0.3),
  single("cyclosporine", "シクロスポリン", "薬物", 0.5, "whole_special"),

  // ホルモン
  combo("tsh", "TSH", "ホルモン", "thyroid", 0.15),
  combo("ft3", "FT3", "ホルモン", "thyroid", 0.15),
  combo("ft4", "FT4", "ホルモン", "thyroid", 0.15),
  single("lh", "LH", "ホルモン", 0.1),
  single("fsh", "FSH", "ホルモン", 0.1),
  single("prl", "プロラクチン", "ホルモン", 0.1),
  single("p4", "プロゲステロン", "ホルモン", 0.2),
  single("e2", "エストラジオール", "ホルモン", 0.2),
  single("testosterone", "テストステロン", "ホルモン", 0.2),
  single("hcg", "hCG", "ホルモン", 0.1),
  single("pct", "プロカルシトニン", "ホルモン", 0.2),
  combo("folate", "葉酸", "ホルモン", "hema", 0.15),
  combo("vb12", "VB12（ビタミンB12）", "ホルモン", "hema", 0.15),

  // 腫瘍マーカー
  combo("afp", "AFP", "腫瘍マーカー", "tumor", 0.1),
  combo("cea", "CEA", "腫瘍マーカー", "tumor", 0.1),
  combo("ca199", "CA19-9", "腫瘍マーカー", "tumor", 0.1),
  {
    id: "kl6",
    name: "KL-6",
    field: "腫瘍マーカー",
    container: "serum_by",
    group: "chem1",
    groupKind: "chem1",
    single: 0.2,
    chem1Member: true,
  },
  {
    id: "il2r",
    name: "IL-2R",
    field: "腫瘍マーカー",
    container: "serum_by",
    group: "chem1",
    groupKind: "chem1",
    single: 0.3,
    addOnToChem1: true,
    note: "生化学・血漿蛋白と組み合わせる場合は +0.1 mL、単独では 0.3 mL です。",
  },
  single("ferritin", "フェリチン", "腫瘍マーカー", 0.1),

  // 感染症
  {
    id: "tpab",
    name: "TPAb",
    field: "感染症",
    container: "serum_by",
    group: "chem1",
    groupKind: "chem1",
    single: 0.2,
    addOnToChem1: true,
    note: "生化学・血漿蛋白と組み合わせる場合は +0.1 mL、単独では 0.2 mL です。",
  },
  combo("hbsag", "HBsAg", "感染症", "infection", 0.2),
  combo("hcvab", "HCVAb", "感染症", "infection", 0.1),
  combo("hiv", "HIV Ag/Ab", "感染症", "infection", 0.2),
  combo("mycoplasma", "マイコプラズマ抗体", "感染症", "infection", 0.1),
  combo("htlv1", "HTLV-1", "感染症", "infection", 0.1),
  combo("cha", "CHA（寒冷凝集素）", "感染症", "infection", 0.3),
  single("bdglucan", "β-Dグルカン", "感染症", 0.2, "plasma_special"),

  // 心マーカー
  combo("troponin", "トロポニンI", "心マーカー", "cardiac", 0.3),
  combo("myoglobin", "ミオグロビン", "心マーカー", "cardiac", 0.2),
  combo("ckmb", "CK-MB", "心マーカー", "cardiac", 0.2),
  single("bnp", "BNP", "心マーカー", 0.2, "plasma_purple"),

  // アレルギー
  {
    id: "ige_total",
    name: "総IgE",
    field: "アレルギー",
    container: "serum_by",
    group: "allergy",
    groupKind: "allergy",
    single: 0.2,
  },
  {
    id: "ige_specific",
    name: "特異的IgE",
    field: "アレルギー",
    container: "serum_by",
    group: "allergy",
    groupKind: "allergy",
    single: 0.2,
  },
];

// 分野の表示順（Excelの並びに準拠）
export const FIELD_ORDER = [
  "生化学",
  "血漿蛋白",
  "血液検査",
  "凝固",
  "薬物",
  "ホルモン",
  "腫瘍マーカー",
  "感染症",
  "心マーカー",
  "アレルギー",
];

export const ITEMS_BY_ID: Record<string, TestItem> = Object.fromEntries(
  TEST_ITEMS.map((it) => [it.id, it]),
);

export interface GroupBreakdown {
  label: string; // グループ名（例: 「①組み合わせ（3項目）」）
  amount: number;
  items: string[]; // 対象項目名
}

export interface ContainerResult {
  container: ContainerId;
  label: string;
  amount: number;
  groups: GroupBreakdown[];
}

export interface CalcResult {
  containers: ContainerResult[];
  total: number; // 全容器の合計
  warnings: string[];
}

function roundTo(n: number): number {
  // 浮動小数の誤差を丸める（0.1刻み想定）
  return Math.round(n * 1000) / 1000;
}

// ① のベース量（メンバー項目数で決まる）
function chem1Base(count: number): number {
  if (count >= 16) return 0.4;
  if (count >= 4) return 0.3;
  if (count >= 1) return 0.2;
  return 0;
}

export function calculate(selectedIds: string[]): CalcResult {
  const selected = selectedIds
    .map((id) => ITEMS_BY_ID[id])
    .filter((it): it is TestItem => Boolean(it));

  const warnings: string[] = [];

  // 容器ごとに項目をまとめる
  const byContainer = new Map<ContainerId, TestItem[]>();
  for (const it of selected) {
    const arr = byContainer.get(it.container) ?? [];
    arr.push(it);
    byContainer.set(it.container, arr);
  }

  const results: ContainerResult[] = [];

  for (const containerId of Object.keys(CONTAINERS) as ContainerId[]) {
    const items = byContainer.get(containerId);
    if (!items || items.length === 0) continue;

    const groups: GroupBreakdown[] = [];
    let containerAmount = 0;

    // --- ① 関連（chem1） ---
    const chem1Items = items.filter((it) => it.group === "chem1");
    if (chem1Items.length > 0) {
      // ①のカウント対象（chem1Member）。IL-2R/TPAbは条件次第で後述。
      const baseMembers = chem1Items.filter((it) => it.chem1Member);
      // 生化学・血漿蛋白のメンバーがあるか（IL-2R/TPAbの加算条件）
      const hasCoreMember = baseMembers.some(
        (it) => it.field === "生化学" || it.field === "血漿蛋白",
      );

      const conditionalAddOns = chem1Items.filter(
        (it) => it.addOnToChem1 && (it.id === "il2r" || it.id === "tpab"),
      );

      let count = baseMembers.length;
      const memberNames = baseMembers.map((it) => it.name);

      // IL-2R/TPAb は、①のコア項目があれば①に参加（+0.1）、なければ個別量
      const joinedConditional: TestItem[] = [];
      const standaloneConditional: TestItem[] = [];
      for (const it of conditionalAddOns) {
        if (hasCoreMember) {
          joinedConditional.push(it);
          count += 1;
          memberNames.push(it.name);
        } else {
          standaloneConditional.push(it);
        }
      }

      let chem1Amount = 0;
      if (count > 0) {
        chem1Amount = chem1Base(count);

        // 加算項目 +0.1 ずつ（UIBC・電解質・β2-MG、および①に参加したIL-2R/TPAb）
        const addOns = baseMembers.filter((it) => it.addOnToChem1);
        chem1Amount += (addOns.length + joinedConditional.length) * 0.1;
        // β2-MG は電解質併用でさらに +0.1
        const hasB2mg = baseMembers.some((it) => it.id === "b2mg");
        const hasDenkai = baseMembers.some((it) => it.id === "denkaishitsu");
        if (hasB2mg && hasDenkai) {
          chem1Amount += 0.1;
        }

        chem1Amount = roundTo(chem1Amount);
        groups.push({
          label: `①組み合わせ（${count}項目）`,
          amount: chem1Amount,
          items: memberNames,
        });
        containerAmount += chem1Amount;
      }

      // ①に参加しなかった IL-2R/TPAb は個別量
      for (const it of standaloneConditional) {
        groups.push({ label: it.name, amount: it.single, items: [it.name] });
        containerAmount += it.single;
      }

      // TIBC の注意
      if (chem1Items.some((it) => it.id === "tibc")) {
        const hasFe = chem1Items.some((it) => it.id === "fe");
        const hasUibc = chem1Items.some((it) => it.id === "uibc");
        if (!hasFe || !hasUibc) {
          warnings.push("TIBCはFeとUIBCから計算します。Fe・UIBCも選択してください。");
        }
      }
    }

    // --- combo（②〜⑦） ---
    const comboGroups = new Map<string, TestItem[]>();
    for (const it of items) {
      if (it.groupKind !== "combo") continue;
      const arr = comboGroups.get(it.group) ?? [];
      arr.push(it);
      comboGroups.set(it.group, arr);
    }
    const comboLabel: Record<string, string> = {
      thyroid: "②甲状腺",
      hema: "③造血マーカー",
      tumor: "④腫瘍マーカー",
      infection: "⑤感染症",
      cardiac: "⑥心マーカー",
      drug: "⑦薬物",
    };
    for (const [groupId, groupItems] of comboGroups) {
      let amount: number;
      if (groupItems.length >= 2) {
        amount = COMBO_AMOUNT[groupId];
      } else {
        amount = groupItems[0].single;
      }
      amount = roundTo(amount);
      groups.push({
        label:
          groupItems.length >= 2
            ? `${comboLabel[groupId]}（組み合わせ）`
            : groupItems[0].name,
        amount,
        items: groupItems.map((it) => it.name),
      });
      containerAmount += amount;
    }

    // --- アレルギー ---
    const allergyItems = items.filter((it) => it.groupKind === "allergy");
    if (allergyItems.length > 0) {
      const amount = roundTo(0.2 + (allergyItems.length - 1) * 0.04);
      groups.push({
        label: `アレルギー（${allergyItems.length}項目）`,
        amount,
        items: allergyItems.map((it) => it.name),
      });
      containerAmount += amount;
    }

    // --- 個別 ---
    const singleItems = items.filter((it) => it.groupKind === "single");
    for (const it of singleItems) {
      groups.push({ label: it.name, amount: it.single, items: [it.name] });
      containerAmount += it.single;
    }

    results.push({
      container: containerId,
      label: CONTAINERS[containerId].label,
      amount: roundTo(containerAmount),
      groups,
    });
  }

  const total = roundTo(results.reduce((sum, r) => sum + r.amount, 0));

  return { containers: results, total, warnings: [...new Set(warnings)] };
}
