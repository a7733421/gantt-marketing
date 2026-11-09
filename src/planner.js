// 一年排程產生器：依開始日、行業、頻率，自動排出貼文與廣告檔期（皆標為「計畫中」）
const pad = n => String(n).padStart(2, "0");
export const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const toDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fromDate = d => iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
export const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return fromDate(d); };
export const planEnd = (start, months) => { const d = toDate(start); d.setMonth(d.getMonth() + months); d.setDate(d.getDate() - 1); return fromDate(d); };

export const INDUSTRIES = {
  lodging: { label: "民宿／旅宿", topics: ["房型介紹", "設施特色", "在地周邊景點", "早餐／美食", "住客好評", "季節推薦", "平日優惠", "親子／包棟", "交通與入住指南", "幕後花絮"], festival: "{f}訂房提醒／住宿專案" },
  food:    { label: "餐飲／咖啡", topics: ["招牌菜", "新品上市", "食材故事", "店內環境", "套餐優惠", "顧客好評", "職人幕後", "外帶／外送", "主廚推薦", "活動預告"], festival: "{f}限定餐點／優惠" },
  retail:  { label: "商品／電商", topics: ["主打商品", "新品上架", "使用情境", "顧客見證", "限時優惠", "品牌故事", "商品比較", "使用小技巧", "開箱分享", "組合方案"], festival: "{f}活動／促銷" },
  service: { label: "服務／專業", topics: ["服務介紹", "作品案例", "客戶見證", "常見問題", "流程說明", "優惠方案", "團隊介紹", "專業小知識", "前後對比", "預約方式"], festival: "{f}主題貼文" },
  general: { label: "一般", topics: ["品牌介紹", "產品／服務介紹", "客戶見證", "優惠活動", "小知識", "幕後花絮", "常見問題", "最新消息"], festival: "{f}主題貼文" },
};

export function guessIndustry(name = "") {
  if (/民宿|旅|酒店|villa|Villa|館|親子館|包棟/.test(name)) return "lodging";
  if (/餐|燒肉|咖啡|茶|食|廚|烘焙/.test(name)) return "food";
  if (/工廠|沙發|褲|衣|商品|選物|美學|小精靈|Light/.test(name)) return "retail";
  if (/造型|設計|建築|建設|事務所|多媒體|顧問|工作室/.test(name)) return "service";
  return "general";
}

// 農曆節日（2026–2028）；其他年份只排國曆節日
const LUNAR = {
  2026: { 春節: "02-17", 元宵節: "03-03", 端午節: "06-19", 七夕: "08-19", 中元節: "08-27", 中秋節: "09-25" },
  2027: { 春節: "02-06", 元宵節: "02-20", 端午節: "06-09", 七夕: "08-08", 中元節: "08-17", 中秋節: "09-15" },
  2028: { 春節: "01-26", 元宵節: "02-09", 端午節: "05-28", 七夕: "08-26", 中元節: "09-03", 中秋節: "10-03" },
};
const FIXED = [["01-01", "元旦"], ["02-14", "情人節"], ["02-28", "228連假"], ["04-04", "清明連假"], ["07-01", "暑假開跑"], ["08-08", "父親節"], ["10-10", "國慶連假"], ["12-25", "聖誕節"], ["12-31", "跨年"]];

function festivals(from, to) {
  const out = [];
  for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) {
    FIXED.forEach(([md, name]) => out.push({ date: `${y}-${md}`, name }));
    const may1 = new Date(y, 4, 1), firstSun = 1 + ((7 - may1.getDay()) % 7);
    out.push({ date: iso(y, 5, firstSun + 7), name: "母親節" });
    Object.entries(LUNAR[y] || {}).forEach(([name, md]) => out.push({ date: `${y}-${md}`, name }));
  }
  return out.filter(f => f.date >= from && f.date <= to).sort((a, b) => a.date.localeCompare(b.date));
}

const AD_FESTIVALS = ["春節", "情人節", "母親節", "端午節", "暑假開跑", "父親節", "中秋節", "國慶連假", "聖誕節"];

export function genPlan(o) {
  const { start, months, perWeek, weekday, industry, adMode, adPlatform, adDays } = o;
  const end = planEnd(start, months);
  const ind = INDUSTRIES[industry] || INDUSTRIES.general;
  const fest = festivals(start, end);
  const stamp = Date.now();

  // 貼文時段
  const slots = [];
  const sd = toDate(start);
  const first = addDays(start, (weekday - sd.getDay() + 7) % 7);
  for (let d = first; d <= end; d = addDays(d, 7)) {
    slots.push({ date: d });
    if (perWeek >= 2 && addDays(d, 3) <= end) slots.push({ date: addDays(d, 3) });
  }
  slots.sort((a, b) => a.date.localeCompare(b.date));

  // 節慶主題優先放在節日前 1~9 天內最後一個時段
  fest.forEach(f => {
    const cand = slots.filter(s => !s.title && s.date < f.date && (toDate(f.date) - toDate(s.date)) / 86400000 <= 9);
    const s = cand[cand.length - 1];
    if (s) s.title = ind.festival.replace("{f}", f.name);
  });
  let k = 0;
  const events = slots.map((s, i) => ({
    id: `p${stamp}_${i}`, type: "post", date: s.date, planned: 1,
    title: s.title || ind.topics[k++ % ind.topics.length],
  }));

  // 廣告檔期
  const ads = [];
  const clip = e => (e > end ? end : e);
  const pushAd = (s, e) => { if (s >= start && s <= end) ads.push({ id: `pa${stamp}_${ads.length}`, platform: adPlatform, start: s, end: clip(e), reason: "off", planned: 1 }); };
  if (adMode === "monthly") {
    for (let i = 0; i < months; i++) { const d = toDate(start); d.setMonth(d.getMonth() + i); const s = i === 0 ? start : iso(d.getFullYear(), d.getMonth() + 1, 1); pushAd(s, addDays(s, adDays - 1)); }
  } else if (adMode === "continuous") {
    for (let s = start; s <= end; s = addDays(s, adDays)) pushAd(s, addDays(s, adDays - 1));
  } else if (adMode === "holiday") {
    fest.filter(f => AD_FESTIVALS.includes(f.name)).forEach(f => {
      if (f.name === "暑假開跑") pushAd(f.date, addDays(f.date, adDays - 1));
      else pushAd(addDays(f.date, -adDays) < start ? start : addDays(f.date, -adDays), f.date);
    });
  }
  return { events, ads, from: start, to: end };
}
