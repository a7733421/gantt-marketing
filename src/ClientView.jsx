import { useState, useEffect, useMemo } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import seed from "./clientsSeed.json";
import PlanModal from "./PlanModal";
import ProfileModal from "./ProfileModal";
import ImageModal from "./ImageModal";
import { imgInfo, migrateClients, IMG_ASOF } from "./images";

// ===== 客戶排程視圖：每個客戶一個泳道（貼文 + 廣告）=====
const OWNER_OPTIONS = ["丁郁澐","許綾讌","李靜憶","黃如杏","劉舜薇","楊蜜恬","何玉如","吳彥琳","林宜慧","經理","副理"];
const PLATFORMS = ["FB", "IG", "Google"];
const AD_PLATFORMS = { FB: "#4f8ef7", Google: "#22c55e" };
const EV_TYPES = {
  post:    { label: "貼文",     color: "#ec4899" },
  note:    { label: "備註/待處理", color: "#94a3b8" },
  suspend: { label: "停權",     color: "#ef4444" },
  resume:  { label: "恢復",     color: "#22c55e" },
};
const CELL_OPTIONS = [28, 36, 48, 64];
const LEFT_W = 230, TAG_W = 36, LANE_H = 38;

const pad = n => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const dim = (y, m) => new Date(y, m + 1, 0).getDate();
const toDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const todayIso = () => { const d = new Date(); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
const md = s => s ? `${+s.slice(5, 7)}/${+s.slice(8, 10)}` : "";

const lbl = { fontSize: 13, color: "#b08040", letterSpacing: 1, display: "block", marginBottom: 5, fontWeight: 700 };
const inp = { width: "100%", background: "#faf7f4", border: "1.5px solid #e8d8c4", borderRadius: 8, padding: "9px 12px", color: "#1a1208", fontSize: 14, boxSizing: "border-box" };
const chip = (sel, color = "#1a1208", fg = "#f59e0b") => ({
  background: sel ? color : "#f0e8dc", color: sel ? fg : "#4a3728",
  border: sel ? `1.5px solid ${fg}` : "1.5px solid #e8d8c4",
  borderRadius: 20, padding: "5px 13px", cursor: "pointer", fontSize: 13, fontWeight: sel ? 800 : 400,
});

export default function ClientView({ db, user, onSwitch }) {
  const t0 = new Date();
  const today = todayIso();
  const [year, setYear] = useState(t0.getFullYear());
  const [month, setMonth] = useState(t0.getMonth());
  const [clients, setClients] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgErr, setMsgErr] = useState(false);
  const [owner, setOwner] = useState("全部");
  const [q, setQ] = useState("");
  const [showEnded, setShowEnded] = useState(false);
  const [cellW, setCellW] = useState(36);
  const [modal, setModal] = useState(null); // {kind:'event'|'ad'|'client', ...}

  const days = dim(year, month);
  const ym = `${year}-${pad(month + 1)}`;
  const mStart = iso(year, month + 1, 1), mEnd = iso(year, month + 1, days);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "gantt", "clients"));
        if (snap.exists() && snap.data().clients) {
          // 舊資料沒有圖數欄位時，自動帶入 Excel 的圖數並存檔一次
          const { list, changed } = migrateClients(JSON.parse(snap.data().clients));
          setClients(list);
          if (changed) persist(list);
        }
      } catch (e) { console.error(e); setMsgErr(true); setMsg("讀取失敗"); }
      setLoaded(true);
    })();
  }, [db]);

  const persist = async (list) => {
    setClients(list);
    try {
      await setDoc(doc(db, "gantt", "clients"), { clients: JSON.stringify(list), updatedAt: new Date().toISOString(), updatedBy: user.email });
      setMsgErr(false); setMsg("✓ 已儲存"); setTimeout(() => setMsg(""), 2000);
    } catch (e) { console.error(e); setMsgErr(true); setMsg("儲存失敗：" + (e.code || e.message)); }
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  useEffect(() => {
    const h = (e) => {
      if (modal || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === "ArrowLeft") prevMonth();
      if (e.key === "ArrowRight") nextMonth();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const owners = useMemo(() => {
    const s = new Set(); clients.forEach(c => (c.owners || []).forEach(o => s.add(o))); return [...s];
  }, [clients]);

  const isSuspended = (c) => {
    const e = (c.events || []).filter(x => (x.type === "suspend" || x.type === "resume") && x.date <= today)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.type === "suspend" ? -1 : 1));
    if (e.length === 0 || e[e.length - 1].type !== "suspend") return false;
    // 停權後若已有實際發布的貼文或上架的廣告，視為已恢復（避免忘記登記「恢復」）
    const d = e[e.length - 1].date;
    const recovered = (c.events || []).some(x => x.type === "post" && !x.planned && x.date > d && x.date <= today)
      || (c.ads || []).some(a => !a.planned && a.start > d && a.start <= today);
    return !recovered;
  };

  const visible = clients.filter(c => {
    if (!showEnded && c.ended) return false;
    if (owner !== "全部" && !(c.owners || []).includes(owner)) return false;
    if (q && !c.name.includes(q)) return false;
    return true;
  });

  // 統計
  const active = clients.filter(c => !c.ended);
  const soon = active.filter(c => c.expiry && diffDays(today, c.expiry) <= 30);
  const suspended = active.filter(isSuspended);
  const monthPosts = visible.reduce((a, c) => a + (c.events || []).filter(e => e.type === "post" && e.date.startsWith(ym)).length, 0);
  const adsRunning = active.filter(c => (c.ads || []).some(a => a.start <= today && (!a.end || a.end >= today))).length;

  // 編輯動作
  const updateClient = (id, fn) => persist(clients.map(c => c.id === id ? fn(c) : c));
  const saveEvent = (cid, ev) => updateClient(cid, c => ({ ...c, events: ev.id && c.events.some(x => x.id === ev.id) ? c.events.map(x => x.id === ev.id ? ev : x) : [...c.events, { ...ev, id: "e" + Date.now() }] }));
  const deleteEvent = (cid, id) => updateClient(cid, c => ({ ...c, events: c.events.filter(x => x.id !== id) }));
  const saveAd = (cid, ad) => updateClient(cid, c => ({ ...c, ads: ad.id && c.ads.some(x => x.id === ad.id) ? c.ads.map(x => x.id === ad.id ? ad : x) : [...c.ads, { ...ad, id: "a" + Date.now() }] }));
  const deleteAd = (cid, id) => updateClient(cid, c => ({ ...c, ads: c.ads.filter(x => x.id !== id) }));
  const saveClient = (c0) => {
    const { planAfter, ...c } = c0;
    const exists = clients.some(x => x.id === c.id);
    const id = exists ? c.id : "c" + Date.now();
    persist(exists ? clients.map(x => x.id === c.id ? c : x) : [...clients, { ...c, id, events: [], ads: [], imgBase: c.imgBase ?? 0, imgAsOf: todayIso(), imgLedger: [] }]);
    return id;
  };
  const applyPlan = (cid, plan, start) => updateClient(cid, c => ({
    ...c, start,
    events: [...(plan.clear ? c.events.filter(e => !(e.planned && e.date >= plan.from && e.date <= plan.to)) : c.events), ...plan.events],
    ads: [...(plan.clear ? c.ads.filter(a => !(a.planned && a.start >= plan.from && a.start <= plan.to)) : c.ads), ...plan.ads],
  }));
  const deleteClient = (id) => persist(clients.filter(c => c.id !== id));
  const importSeed = () => persist(migrateClients(seed).list);

  if (!loaded) return <div style={{ padding: 60, textAlign: "center", color: "#b08040" }}>載入中⋯</div>;

  const laneClick = (e, c, lane) => {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const day = Math.min(days, Math.max(1, Math.floor(x / cellW) + 1));
    const date = iso(year, month + 1, day);
    if (lane === "post") setModal({ kind: "event", cid: c.id, ev: { type: "post", date, title: "", img: 0 }, isNew: true });
    else setModal({ kind: "ad", cid: c.id, ad: { platform: "FB", start: date, end: null, reason: "off" }, isNew: true });
  };

  const lowImg = active.filter(c => { const i = imgInfo(c); return i && i.remaining <= 2; });
  const tiles = [
    { label: "🏢 進行中客戶", value: active.length, accent: "#1a1208" },
    { label: "⏰ 30 天內到期", value: soon.length, accent: "#f59e0b" },
    { label: "⛔ 目前停權中", value: suspended.length, accent: "#ef4444" },
    { label: "📣 廣告進行中", value: adsRunning, accent: "#4f8ef7" },
    { label: "🖼 圖數不足（剩 2 張內）", value: lowImg.length, accent: "#a855f7" },
    { label: `📝 ${month + 1} 月貼文（目前篩選）`, value: monthPosts, accent: "#ec4899" },
  ];

  const imgBadge = (c) => {
    const i = imgInfo(c);
    const open = () => setModal({ kind: "images", cid: c.id });
    if (!i) return <span onClick={open} title="設定圖數" style={{ ...badge("#94a3b8"), cursor: "pointer" }}>🖼 圖數未設定</span>;
    const r = i.remaining, col = r <= 0 ? "#ef4444" : r <= 2 ? "#f59e0b" : "#94a3b8";
    return <span onClick={open} title="圖數明細（點擊查看／加購）" style={{ ...badge(col, r <= 2), cursor: "pointer" }}>🖼 剩 {r} 張</span>;
  };
  const expiryBadge = (c) => {
    if (c.ended) return <span style={badge("#94a3b8")}>已結案 {md(c.ended)}</span>;
    if (!c.expiry) return null;
    const n = diffDays(today, c.expiry);
    if (n < 0) return <span style={badge("#ef4444", true)}>已過期 {-n} 天</span>;
    if (n <= 30) return <span style={badge("#f59e0b", true)}>{n} 天後到期</span>;
    return <span style={badge("#94a3b8")}>到期 {c.expiry.replace(/-/g, "/")}</span>;
  };

  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {tiles.map(s => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid #e8d8c4", borderRadius: 10, padding: "12px 18px", flex: 1, minWidth: 120, borderTop: `3px solid ${s.accent}` }}>
            <div style={{ fontSize: 11, color: "#b08040", marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.accent }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e8d8c4", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={prevMonth} style={navBtn}>‹</button>
            <span style={{ fontWeight: 900, fontSize: 17, minWidth: 120, textAlign: "center" }}>{year}年{month + 1}月</span>
            <button onClick={nextMonth} style={navBtn}>›</button>
            <button onClick={() => { setYear(t0.getFullYear()); setMonth(t0.getMonth()); }} style={{ ...navBtn, fontSize: 13, padding: "7px 12px" }}>今天</button>
          </div>
          <div style={{ width: 1, height: 24, background: "#e8d8c4" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 搜尋客戶" style={{ ...inp, width: 160, padding: "6px 12px" }} />
          <label style={{ fontSize: 13, color: "#4a3728", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <input type="checkbox" checked={showEnded} onChange={e => setShowEnded(e.target.checked)} /> 顯示已結案
          </label>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {msg && <span style={{ fontSize: 13, color: msgErr ? "#ef4444" : "#22c55e", fontWeight: 700 }}>{msg}</span>}
            <button onClick={() => setModal({ kind: "client", c: { name: "", county: "", town: "", owners: [], platforms: ["FB"], adManaged: false, expiry: null, ended: null }, isNew: true })}
              style={{ background: "#f59e0b", color: "#1a1208", border: "none", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontWeight: 800, fontSize: 14 }}>＋ 新增客戶</button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#b08040", fontWeight: 700 }}>👤 負責人：</span>
          {["全部", ...owners].map(m => (
            <button key={m} onClick={() => setOwner(m)} style={chip(owner === m)}>{owner === m && m !== "全部" ? "✓ " : ""}{m}</button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#b08040", fontWeight: 700 }}>縮放：</span>
            {CELL_OPTIONS.map(w => (
              <button key={w} onClick={() => setCellW(w)} style={{ background: cellW === w ? "#1a1208" : "#fff", color: cellW === w ? "#f59e0b" : "#4a3728", border: "1.5px solid " + (cellW === w ? "#f59e0b" : "#e8d8c4"), borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 13, fontWeight: cellW === w ? 800 : 400 }}>{w === 28 ? "小" : w === 36 ? "中" : w === 48 ? "大" : "最大"}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 12, color: "#6b5540" }}>
          <span><b style={{ color: "#ec4899" }}>◆</b> 貼文</span>
          <span><b style={{ color: "#94a3b8" }}>◇</b> 備註／待處理</span>
          <span><b style={{ color: "#ef4444" }}>✖</b> 停權</span>
          <span><b style={{ color: "#22c55e" }}>▲</b> 恢復</span>
          <span><b style={{ color: "#4f8ef7" }}>▬</b> FB 廣告</span>
          <span><b style={{ color: "#22c55e" }}>▬</b> Google 廣告</span>
          <span><b style={{ color: "#ec4899", opacity: .45 }}>◆</b> 淡色／斜紋＝計畫中（尚未發布）</span>
          <span style={{ color: "#b08040" }}>點空白處新增、點項目編輯、📅 產生一年排程</span>
        </div>
      </div>

      {clients.length === 0 && (
        <div style={{ background: "#fff", border: "1.5px dashed #e8d8c4", borderRadius: 14, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>還沒有客戶資料</div>
          <div style={{ fontSize: 13, color: "#6b5540", marginBottom: 16 }}>可以一鍵匯入「0.FB代操-管理.xlsx」2026 年的貼文與廣告排程（{seed.length} 家客戶；不含帳號、密碼、付款資訊）。</div>
          <button onClick={importSeed} style={{ background: "#1a1208", color: "#f59e0b", border: "none", borderRadius: 8, padding: "11px 24px", fontWeight: 900, cursor: "pointer", fontSize: 15 }}>匯入 Excel 2026 資料</button>
        </div>
      )}

      {clients.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e8d8c4", boxShadow: "0 2px 16px rgba(26,18,8,.06)", overflow: "auto", maxHeight: "calc(100vh - 330px)" }}>
          <div style={{ minWidth: LEFT_W + TAG_W + days * cellW }}>
            {/* 日期表頭 */}
            <div style={{ display: "flex", background: "#1a1208", color: "#e8dcc8", position: "sticky", top: 0, zIndex: 6 }}>
              <div style={{ width: LEFT_W + TAG_W, flexShrink: 0, position: "sticky", left: 0, zIndex: 7, background: "#1a1208", padding: "11px 12px", fontSize: 12, color: "#f59e0b", fontWeight: 800 }}>客戶 <span style={{ color: "#8a7050", fontWeight: 400 }}>（{visible.length} 家）</span></div>
              <div style={{ display: "flex", width: days * cellW }}>
                {Array.from({ length: days }, (_, i) => {
                  const d = i + 1, dow = new Date(year, month, d).getDay(), wk = dow === 0 || dow === 6;
                  const isT = iso(year, month + 1, d) === today;
                  return (
                    <div key={d} style={{ width: cellW, minWidth: cellW, boxSizing: "border-box", padding: cellW >= 48 ? "9px 0 7px" : "7px 0", textAlign: "center", fontSize: cellW >= 48 ? 16 : cellW >= 36 ? 14 : 12, color: isT ? "#f59e0b" : wk ? "#a07840" : "#94a3b8", fontWeight: isT ? 900 : 600, background: isT ? "rgba(245,158,11,.15)" : wk ? "rgba(240,220,180,.18)" : "transparent", borderLeft: "1px solid rgba(255,255,255,.08)" }}>
                      {d}{cellW >= 48 && <div style={{ fontSize: 11, color: wk ? "#c8a060" : "#64748b", marginTop: 3 }}>{"日一二三四五六"[dow]}</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {visible.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#b08040" }}>沒有符合條件的客戶</div>}

            {visible.map((c, idx) => {
              const bg = c.ended ? "#f5f2ee" : idx % 2 ? "#fdf9f5" : "#fff";
              const susp = !c.ended && isSuspended(c);
              const evs = (c.events || []).filter(e => e.date.startsWith(ym));
              const nPost = evs.filter(e => e.type === "post").length;
              const ads = (c.ads || []).filter(a => a.start <= mEnd && (a.end || "9999") >= mStart);
              const expInView = c.expiry && c.expiry >= mStart && c.expiry <= mEnd ? +c.expiry.slice(8) : null;
              return (
                <div key={c.id} style={{ display: "flex", borderBottom: "2px solid #f0e8dc", background: bg, opacity: c.ended ? 0.7 : 1 }}>
                  <div style={{ width: LEFT_W, flexShrink: 0, position: "sticky", left: 0, zIndex: 4, background: bg, padding: "9px 10px", boxSizing: "border-box" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={c.name}>{susp && <span style={{ color: "#ef4444", marginRight: 3 }}>⛔</span>}{c.name}</span>
                      <button title="客戶檔案（特性與習慣）" onClick={() => setModal({ kind: "profile", cid: c.id })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, padding: "0 2px" }}>🗂</button>
                      <button title="產生一年排程" onClick={() => setModal({ kind: "plan", cid: c.id })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, padding: "0 2px" }}>📅</button>
                      <button title="編輯客戶" onClick={() => setModal({ kind: "client", c: { ...c } })} style={{ background: "none", border: "none", color: "#b08040", cursor: "pointer", fontSize: 16, padding: "0 2px" }}>✎</button>
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{[c.county, c.town].filter(Boolean).join("・")}{(c.platforms || []).length > 0 && "　" + c.platforms.join("+")}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                      {(c.owners || []).map(o => <span key={o} style={{ background: owner === o ? "#f59e0b" : "#f0e8dc", color: owner === o ? "#fff" : "#4a3728", borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: owner === o ? 800 : 400 }}>{o}</span>)}
                      {c.adManaged && <span style={{ background: "rgba(79,142,247,.15)", color: "#4f8ef7", borderRadius: 20, padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>AD</span>}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4, alignItems: "center" }}>
                      {expiryBadge(c)}
                      {imgBadge(c)}
                      <span style={{ fontSize: 11, color: "#b08040" }}>本月 {nPost} 篇</span>
                    </div>
                    {(c.profile?.tags || []).length > 0 && (
                      <div onClick={() => setModal({ kind: "profile", cid: c.id })} title={[c.profile.traits, c.profile.comm, c.profile.pref, c.profile.materials].filter(Boolean).join("\n") || "點擊查看客戶檔案"} style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4, cursor: "pointer" }}>
                        {c.profile.tags.slice(0, 3).map(t => <span key={t} style={{ background: "rgba(168,85,247,.12)", color: "#7e3fbf", borderRadius: 4, padding: "0 5px", fontSize: 10, fontWeight: 700 }}>{t}</span>)}
                        {c.profile.tags.length > 3 && <span style={{ fontSize: 10, color: "#94a3b8" }}>+{c.profile.tags.length - 3}</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ width: TAG_W, flexShrink: 0, position: "sticky", left: LEFT_W, zIndex: 4, background: bg, display: "flex", flexDirection: "column", boxShadow: "2px 0 6px rgba(0,0,0,.08)" }}>
                    <div style={{ flex: 1, minHeight: LANE_H, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#ec4899", borderBottom: "1px dashed #eadfd0" }}>貼文</div>
                    <div style={{ flex: 1, minHeight: LANE_H, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#4f8ef7" }}>廣告</div>
                  </div>
                  <div style={{ width: days * cellW, flexShrink: 0, position: "relative", display: "flex", flexDirection: "column" }}>
                    {/* 背景：週末、格線、今天、到期 */}
                    {Array.from({ length: days }, (_, i) => {
                      const dow = new Date(year, month, i + 1).getDay();
                      return <div key={i} style={{ position: "absolute", left: i * cellW, width: cellW, top: 0, bottom: 0, background: dow === 0 || dow === 6 ? "rgba(240,220,180,.22)" : "transparent", borderLeft: "1px solid rgba(0,0,0,.04)", pointerEvents: "none" }} />;
                    })}
                    {today >= mStart && today <= mEnd && <div style={{ position: "absolute", left: (+today.slice(8) - 0.5) * cellW, top: 0, bottom: 0, width: 2, background: "#f59e0b", opacity: .55, zIndex: 3, pointerEvents: "none" }} />}
                    {expInView && <div title={"合約到期 " + c.expiry} style={{ position: "absolute", left: (expInView - 0.5) * cellW, top: 0, bottom: 0, width: 0, borderLeft: "2px dashed #ef4444", zIndex: 3, pointerEvents: "none" }}><span style={{ position: "absolute", top: 0, left: 4, fontSize: 10, color: "#ef4444", fontWeight: 800, whiteSpace: "nowrap" }}>到期</span></div>}

                    {/* 貼文泳道 */}
                    <div onClick={e => laneClick(e, c, "post")} style={{ position: "relative", flex: 1, minHeight: LANE_H, borderBottom: "1px dashed #eadfd0", cursor: "cell" }}>
                      {evs.map(e => {
                        const day = +e.date.slice(8), left = (day - 0.5) * cellW, t = EV_TYPES[e.type] || EV_TYPES.post;
                        const sym = e.type === "post" ? "◆" : e.type === "note" ? "◇" : e.type === "suspend" ? "✖" : "▲";
                        return (
                          <div key={e.id} title={`${md(e.date)} ${t.label}：${e.title}`}
                            onClick={ev => { ev.stopPropagation(); setModal({ kind: "event", cid: c.id, ev: { ...e } }); }}
                            style={{ position: "absolute", left: left - 9, top: 0, bottom: 0, display: "flex", alignItems: "center", zIndex: 4, cursor: "pointer", opacity: e.planned ? 0.45 : 1 }}>
                            <span style={{ fontSize: e.type === "post" ? 17 : 15, lineHeight: 1, color: t.color, textShadow: e.img ? "0 0 0 " + t.color : "none", fontWeight: 900 }}>{sym}</span>
                            {cellW >= 48 && <span style={{ fontSize: 11, color: t.color, marginLeft: 1, maxWidth: cellW * 2.2 - 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>{e.title}</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* 廣告泳道 */}
                    <div onClick={e => laneClick(e, c, "ad")} style={{ position: "relative", flex: 1, minHeight: LANE_H, cursor: "cell" }}>
                      {ads.map(a => {
                        const vs = a.start < mStart ? mStart : a.start;
                        const ve = !a.end ? mEnd : a.end > mEnd ? mEnd : a.end;
                        const left = (+vs.slice(8) - 1) * cellW, w = (+ve.slice(8) - +vs.slice(8) + 1) * cellW;
                        const col = a.reason === "suspend" ? "#ef4444" : (AD_PLATFORMS[a.platform] || "#4f8ef7");
                        const label = `${md(a.start)} 上架 → ${a.end ? md(a.end) + (a.reason === "suspend" ? " 停權" : " 下架") : "進行中"}`;
                        return (
                          <div key={a.id} title={`${a.platform} 廣告：${label}`}
                            onClick={ev => { ev.stopPropagation(); setModal({ kind: "ad", cid: c.id, ad: { ...a } }); }}
                            style={{ position: "absolute", left, width: w, top: "50%", transform: "translateY(-50%)", height: 22, background: a.planned ? `repeating-linear-gradient(135deg, ${col}, ${col} 6px, ${col}99 6px, ${col}99 12px)` : col, opacity: a.planned ? 0.6 : a.end ? 1 : 0.85, borderRadius: `${a.start < mStart ? 0 : 6}px ${a.end && a.end <= mEnd ? 6 : 0}px ${a.end && a.end <= mEnd ? 6 : 0}px ${a.start < mStart ? 0 : 6}px`, borderRight: !a.end ? "3px dashed rgba(255,255,255,.7)" : "none", cursor: "pointer", zIndex: 2, boxShadow: `0 2px 6px ${col}55`, display: "flex", alignItems: "center", overflow: "hidden" }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", padding: "0 6px" }}>{w > 70 ? label : ""}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modal && modal.kind === "event" && <EventModal modal={modal} client={clients.find(c => c.id === modal.cid)} onClose={() => setModal(null)} onSave={ev => { saveEvent(modal.cid, ev); setModal(null); }} onDelete={() => { deleteEvent(modal.cid, modal.ev.id); setModal(null); }} />}
      {modal && modal.kind === "ad" && <AdModal modal={modal} onClose={() => setModal(null)} onSave={ad => { saveAd(modal.cid, ad); setModal(null); }} onDelete={() => { deleteAd(modal.cid, modal.ad.id); setModal(null); }} />}
      {modal && modal.kind === "images" && clients.find(c => c.id === modal.cid) && <ImageModal client={clients.find(c => c.id === modal.cid)} onClose={() => setModal(null)} onSave={patch => { updateClient(modal.cid, c => ({ ...c, ...patch })); setModal(null); }} />}
      {modal && modal.kind === "profile" && clients.find(c => c.id === modal.cid) && <ProfileModal client={clients.find(c => c.id === modal.cid)} onClose={() => setModal(null)} onSave={p => { updateClient(modal.cid, c => ({ ...c, profile: p })); setModal(null); }} />}
      {modal && modal.kind === "plan" && clients.find(c => c.id === modal.cid) && <PlanModal client={clients.find(c => c.id === modal.cid)} onClose={() => setModal(null)} onApply={(plan, start) => { applyPlan(modal.cid, plan, start); setModal(null); }} />}
      {modal && modal.kind === "client" && <ClientModal modal={modal} onClose={() => setModal(null)} onSave={c => { const id = saveClient(c); setModal(c.planAfter ? { kind: "plan", cid: id } : null); }} onDelete={() => { if (window.confirm("確定刪除這個客戶與所有排程？")) { deleteClient(modal.c.id); setModal(null); } }} />}
    </div>
  );
}

const navBtn = { background: "#1a1208", color: "#f59e0b", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 18, fontWeight: 900 };
const badge = (color, strong) => ({ background: strong ? color : color + "22", color: strong ? "#fff" : "#6b5540", borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: strong ? 800 : 600 });

function Shell({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,18,8,.65)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 26, width: 440, maxWidth: "94vw", border: "1px solid #e8d8c4", boxShadow: "0 24px 60px rgba(26,18,8,.25)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Buttons({ onSave, onDelete, onClose, canDelete }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <button onClick={onSave} style={{ flex: 2, background: "#1a1208", color: "#f59e0b", border: "none", borderRadius: 8, padding: 11, fontWeight: 900, cursor: "pointer", fontSize: 15 }}>儲存</button>
      {canDelete && <button onClick={onDelete} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "11px 14px", cursor: "pointer", fontWeight: 800, fontSize: 14 }}>刪除</button>}
      <button onClick={onClose} style={{ flex: 1, background: "#f0e8dc", color: "#4a3728", border: "none", borderRadius: 8, padding: 11, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>取消</button>
    </div>
  );
}

function EventModal({ modal, client, onClose, onSave, onDelete }) {
  const [ev, setEv] = useState(modal.ev);
  const info = imgInfo(client);
  const asOf = (client && client.imgAsOf) || IMG_ASOF;
  const wasCounted = !!(modal.ev.img && !modal.isNew && modal.ev.date > asOf);
  const nowCounted = !!(ev.img && ev.date > asOf);
  const after = info ? info.remaining + (wasCounted ? 1 : 0) - (nowCounted ? 1 : 0) : null;
  return (
    <Shell title={modal.isNew ? "＋ 新增項目" : "✏️ 編輯項目"} onClose={onClose}>
      <label style={lbl}>類型</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {Object.entries(EV_TYPES).map(([k, v]) => (
          <button key={k} onClick={() => setEv({ ...ev, type: k })} style={{ ...chip(ev.type === k, v.color, "#fff"), borderColor: v.color }}>{v.label}</button>
        ))}
      </div>
      <label style={lbl}>日期</label>
      <input type="date" value={ev.date} onChange={e => setEv({ ...ev, date: e.target.value })} style={{ ...inp, marginBottom: 14 }} />
      <label style={lbl}>內容／主題</label>
      <input value={ev.title} onChange={e => setEv({ ...ev, title: e.target.value })} placeholder="例：父親節活動" style={{ ...inp, marginBottom: 14 }} />
      {ev.type === "post" && (
        <label style={{ fontSize: 13, color: "#4a3728", display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={!!ev.img} onChange={e => setEv({ ...ev, img: e.target.checked ? 1 : 0 })} /> 需要製圖（會扣 1 張圖數）
        </label>
      )}
      {ev.type === "post" && ev.img ? (
        <div style={{ fontSize: 12, marginTop: -8, marginBottom: 14, color: after != null && after < 0 ? "#ef4444" : "#6b5540", fontWeight: after != null && after < 0 ? 800 : 400 }}>
          {info == null ? "此客戶尚未設定圖數（點客戶列的「🖼」設定）" : ev.date <= asOf ? `此日期在圖數基準日（${asOf.slice(5).replace("-", "/")}）之前，已含在基準內，不會再扣` : after < 0 ? `⚠️ 扣圖後會變成 ${after} 張，圖數不足，請先向客戶加購` : `扣圖後剩 ${after} 張`}
        </div>
      ) : null}
      {(ev.type === "post" || ev.type === "note") && (
        <label style={{ fontSize: 13, color: "#4a3728", display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={!!ev.planned} onChange={e => setEv({ ...ev, planned: e.target.checked ? 1 : 0 })} /> 計畫中（尚未發布；發布後請取消勾選）
        </label>
      )}
      <Buttons onSave={() => ev.date && onSave(ev)} onDelete={onDelete} onClose={onClose} canDelete={!modal.isNew} />
    </Shell>
  );
}

function AdModal({ modal, onClose, onSave, onDelete }) {
  const [ad, setAd] = useState(modal.ad);
  return (
    <Shell title={modal.isNew ? "＋ 新增廣告檔期" : "✏️ 編輯廣告檔期"} onClose={onClose}>
      <label style={lbl}>平台</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {Object.keys(AD_PLATFORMS).map(p => <button key={p} onClick={() => setAd({ ...ad, platform: p })} style={{ ...chip(ad.platform === p, AD_PLATFORMS[p], "#fff"), borderColor: AD_PLATFORMS[p], flex: 1 }}>{p} 廣告</button>)}
      </div>
      <label style={lbl}>上架日</label>
      <input type="date" value={ad.start} onChange={e => setAd({ ...ad, start: e.target.value })} style={{ ...inp, marginBottom: 14 }} />
      <label style={lbl}>下架／停權日（留空＝進行中）</label>
      <input type="date" value={ad.end || ""} onChange={e => setAd({ ...ad, end: e.target.value || null })} style={{ ...inp, marginBottom: 14 }} />
      {ad.end && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setAd({ ...ad, reason: "off" })} style={{ ...chip(ad.reason !== "suspend"), flex: 1 }}>正常下架</button>
          <button onClick={() => setAd({ ...ad, reason: "suspend" })} style={{ ...chip(ad.reason === "suspend", "#ef4444", "#fff"), borderColor: "#ef4444", flex: 1 }}>被停權</button>
        </div>
      )}
      <label style={{ fontSize: 13, color: "#4a3728", display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={!!ad.planned} onChange={e => setAd({ ...ad, planned: e.target.checked ? 1 : 0 })} /> 計畫中（尚未上架；上架後請取消勾選）
      </label>
      <Buttons onSave={() => ad.start && onSave(ad)} onDelete={onDelete} onClose={onClose} canDelete={!modal.isNew} />
    </Shell>
  );
}

function ClientModal({ modal, onClose, onSave, onDelete }) {
  const [c, setC] = useState(modal.c);
  const tog = (key, v) => setC(x => ({ ...x, [key]: (x[key] || []).includes(v) ? x[key].filter(y => y !== v) : [...(x[key] || []), v] }));
  return (
    <Shell title={modal.isNew ? "＋ 新增客戶" : "✏️ 編輯客戶"} onClose={onClose}>
      <label style={lbl}>客戶名稱 *</label>
      <input value={c.name} onChange={e => setC({ ...c, name: e.target.value })} style={{ ...inp, marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><label style={lbl}>縣市</label><input value={c.county || ""} onChange={e => setC({ ...c, county: e.target.value })} style={inp} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>鄉鎮</label><input value={c.town || ""} onChange={e => setC({ ...c, town: e.target.value })} style={inp} /></div>
      </div>
      <label style={lbl}>負責人（可複選）</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {OWNER_OPTIONS.map(o => <button key={o} onClick={() => tog("owners", o)} style={chip((c.owners || []).includes(o))}>{(c.owners || []).includes(o) ? "✓ " : ""}{o}</button>)}
      </div>
      <label style={lbl}>代操平台</label>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {PLATFORMS.map(p => <button key={p} onClick={() => tog("platforms", p)} style={chip((c.platforms || []).includes(p))}>{(c.platforms || []).includes(p) ? "✓ " : ""}{p}</button>)}
      </div>
      <label style={{ fontSize: 13, color: "#4a3728", display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={!!c.adManaged} onChange={e => setC({ ...c, adManaged: e.target.checked })} /> 含廣告代操（AD）
      </label>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><label style={lbl}>合約到期日</label><input type="date" value={c.expiry || ""} onChange={e => setC({ ...c, expiry: e.target.value || null })} style={inp} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>結案／退出日</label><input type="date" value={c.ended || ""} onChange={e => setC({ ...c, ended: e.target.value || null })} style={inp} /></div>
      </div>
      {modal.isNew && (
        <>
          <label style={lbl}>圖數（張）— 客戶方案內含的製圖張數</label>
          <input type="number" min={0} value={c.imgBase ?? ""} onChange={e => setC({ ...c, imgBase: e.target.value === "" ? null : +e.target.value })} placeholder="例：10（之後可在 🖼 加購或調整）" style={{ ...inp, marginBottom: 14 }} />
        </>
      )}
      {modal.isNew && (
        <label style={{ fontSize: 13, color: "#4a3728", display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer", fontWeight: 700 }}>
          <input type="checkbox" checked={!!c.planAfter} onChange={e => setC({ ...c, planAfter: e.target.checked })} /> 儲存後立即規畫一整年的貼文與廣告
        </label>
      )}
      <div style={{ fontSize: 12, color: "#b08040", marginBottom: 12 }}>⚠️ 請勿在此輸入帳號、密碼或付款資訊。</div>
      <Buttons onSave={() => c.name.trim() && onSave(c)} onDelete={onDelete} onClose={onClose} canDelete={!modal.isNew} />
    </Shell>
  );
}
