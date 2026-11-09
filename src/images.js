// 圖數（製圖張數）管理
// 餘額 = 基準（Excel「圖」欄，截至基準日的剩餘張數）+ 基準日之後的加購／調整 − 基準日之後標示「需要製圖」的貼文張數
export const IMG_ASOF = "2026-11-09";

// 來自 0.FB代操-管理.xlsx「貼文規畫2026」E 欄（2026/11/09 當天的剩餘圖數）；空白＝未設定
export const IMG_BASE = {
  "七星海酒店": 0, "星空蛙鳴民宿": 1, "美鼻小精靈": 0, "夢露民宿": 0, "Ailsa彩妝造型": 5,
  "大自然庭園民宿": 2, "玩行旅（西門分館）": 2, "偌徠Raw Light": 3, "海燒肉餐廳": 2, "七星潭七星海": 4,
  "黃上科建築師事務所": 10, "賞櫻悅親子館": 16, "轉角沙發工廠": 0, "沖Ya咖啡": 0,
  "Le Celebrate 樂雀比": 0, "大興發建設有限公司": 0, "幸福時潮旅宿二館": 0,
};

// 舊資料（尚無圖數欄位）自動帶入 Excel 的圖數
export function migrateClients(list) {
  let changed = false;
  const out = list.map(c => {
    if (c.imgBase !== undefined) return c;
    changed = true;
    const n = IMG_BASE[c.name];
    return { ...c, imgBase: n === undefined ? null : n, imgAsOf: IMG_ASOF, imgLedger: c.imgLedger || [] };
  });
  return { list: out, changed };
}

export function imgInfo(c) {
  if (!c || c.imgBase == null) return null;
  const asOf = c.imgAsOf || IMG_ASOF;
  const used = (c.events || []).filter(e => e.img && e.date > asOf).sort((a, b) => a.date.localeCompare(b.date));
  const ledger = (c.imgLedger || []).filter(l => l.date >= asOf);
  const added = ledger.reduce((s, l) => s + (+l.delta || 0), 0);
  return { base: +c.imgBase, asOf, used, ledger, added, remaining: +c.imgBase + added - used.length };
}
