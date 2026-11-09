import { useState, useMemo } from "react";
import { genPlan, guessIndustry, INDUSTRIES, planEnd } from "./planner";
import { imgInfo, IMG_ASOF } from "./images";

const lbl = { fontSize: 13, color: "#b08040", letterSpacing: 1, display: "block", marginBottom: 5, fontWeight: 700 };
const inp = { width: "100%", background: "#faf7f4", border: "1.5px solid #e8d8c4", borderRadius: 8, padding: "9px 12px", color: "#1a1208", fontSize: 14, boxSizing: "border-box" };
const chip = (sel) => ({
  flex: 1, background: sel ? "#1a1208" : "#f0e8dc", color: sel ? "#f59e0b" : "#4a3728",
  border: sel ? "1.5px solid #f59e0b" : "1.5px solid #e8d8c4", borderRadius: 8, padding: "7px 6px", cursor: "pointer", fontSize: 13, fontWeight: sel ? 800 : 500,
});
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const md = s => `${+s.slice(5, 7)}/${+s.slice(8, 10)}`;

export default function PlanModal({ client, onClose, onApply }) {
  const [o, setO] = useState({
    start: todayIso(), months: 12, perWeek: 1, weekday: 4,
    industry: guessIndustry(client.name), adMode: client.adManaged ? "monthly" : "none",
    adPlatform: "FB", adDays: 14, clear: true, imgMax: null,
  });
  const set = (k, v) => setO(x => ({ ...x, [k]: v }));
  const info = imgInfo(client);
  const asOf = client.imgAsOf || IMG_ASOF;
  const rangeEnd = o.start ? planEnd(o.start, o.months) : "";
  // 若選擇清除舊的計畫，那些計畫中的製圖會退回圖數
  const refund = o.clear && o.start ? (client.events || []).filter(e => e.planned && e.img && e.date > asOf && e.date >= o.start && e.date <= rangeEnd).length : 0;
  const available = info ? Math.max(0, info.remaining + refund) : 0;
  const festCount = useMemo(() => (o.start ? genPlan({ ...o, imgMax: 0 }).festCount : 0), [o]);
  const imgCount = o.imgMax == null ? Math.min(festCount, available) : Math.min(o.imgMax, festCount, available);
  const plan = useMemo(() => (o.start ? genPlan({ ...o, imgMax: imgCount }) : { events: [], ads: [], from: "", to: "" }), [o, imgCount]);
  const existing = (client.events || []).filter(e => e.planned && e.date >= plan.from && e.date <= plan.to).length
    + (client.ads || []).filter(a => a.planned && a.start >= plan.from && a.start <= plan.to).length;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,18,8,.65)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 26, width: 500, maxWidth: "94vw", border: "1px solid #e8d8c4", boxShadow: "0 24px 60px rgba(26,18,8,.25)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>📅 產生一年排程：{client.name}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "#6b5540", marginBottom: 16 }}>依節慶與行業主題自動排好，全部標為「計畫中」，之後可逐筆修改、刪除或標為已發布。</div>

        {client.profile && ((client.profile.tags || []).length > 0 || client.profile.pref || client.profile.materials || client.profile.comm) && (
          <div style={{ background: "rgba(168,85,247,.07)", border: "1.5px solid rgba(168,85,247,.25)", borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: 12, color: "#4a3728", lineHeight: 1.7 }}>
            <div style={{ fontWeight: 800, color: "#7e3fbf", marginBottom: 2 }}>🗂 此客戶的特性（規劃時請留意）</div>
            {(client.profile.tags || []).length > 0 && <div>{client.profile.tags.map(t => "#" + t).join("　")}</div>}
            {client.profile.pref && <div>內容偏好／禁忌：{client.profile.pref}</div>}
            {client.profile.materials && <div>素材習慣：{client.profile.materials}</div>}
            {client.profile.comm && <div>溝通習慣：{client.profile.comm}</div>}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>開始日</label>
            <input type="date" value={o.start} onChange={e => set("start", e.target.value)} style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>期間</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[6, 12, 24].map(m => <button key={m} onClick={() => set("months", m)} style={chip(o.months === m)}>{m} 個月</button>)}
            </div>
          </div>
        </div>
        {o.start && <div style={{ fontSize: 12, color: "#b08040", marginTop: -8, marginBottom: 14 }}>期間：{o.start.replace(/-/g, "/")} ～ {planEnd(o.start, o.months).replace(/-/g, "/")}</div>}

        <label style={lbl}>行業（決定貼文主題）</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {Object.entries(INDUSTRIES).map(([k, v]) => <button key={k} onClick={() => set("industry", k)} style={chip(o.industry === k)}>{v.label}</button>)}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>每週貼文數</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2].map(n => <button key={n} onClick={() => set("perWeek", n)} style={chip(o.perWeek === n)}>{n} 篇</button>)}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>固定發文日</label>
            <select value={o.weekday} onChange={e => set("weekday", +e.target.value)} style={inp}>
              {"日一二三四五六".split("").map((d, i) => <option key={i} value={i}>週{d}</option>)}
            </select>
          </div>
        </div>

        <label style={lbl}>廣告檔期</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {[["none", "不排廣告"], ["monthly", "每月一檔"], ["continuous", "連續不間斷"], ["holiday", "節慶檔期"]].map(([k, l]) => <button key={k} onClick={() => set("adMode", k)} style={chip(o.adMode === k)}>{l}</button>)}
        </div>
        {o.adMode !== "none" && (
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>平台</label>
              <div style={{ display: "flex", gap: 6 }}>
                {["FB", "Google"].map(p => <button key={p} onClick={() => set("adPlatform", p)} style={chip(o.adPlatform === p)}>{p}</button>)}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>每檔天數</label>
              <input type="number" min={3} max={60} value={o.adDays} onChange={e => set("adDays", Math.max(3, Math.min(60, +e.target.value || 14)))} style={inp} />
            </div>
          </div>
        )}

        <label style={lbl}>🖼 製圖（會扣圖數）</label>
        <div style={{ background: "#faf7f4", border: "1.5px solid #e8d8c4", borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: 13 }}>
          {info == null ? (
            <div style={{ color: "#6b5540" }}>此客戶尚未設定圖數，貼文不會標示製圖。（可先到客戶列的「🖼」設定後再產生）</div>
          ) : (
            <>
              <div style={{ marginBottom: 6 }}>目前剩 <b>{info.remaining}</b> 張{refund > 0 ? `（清除舊計畫後退回 ${refund} 張，共 ${available} 張可用）` : ""}；期間內有 <b>{festCount}</b> 篇節慶／優惠貼文通常需要製圖。</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>排入需製圖貼文</span>
                <input type="number" min={0} max={Math.min(festCount, available)} value={imgCount} onChange={e => set("imgMax", Math.max(0, +e.target.value || 0))} style={{ ...inp, width: 80, padding: "5px 8px" }} />
                <span>張 → 排入後剩 <b style={{ color: available - imgCount <= 0 ? "#ef4444" : "#1a1208" }}>{info.remaining + refund - imgCount}</b> 張</span>
              </div>
              {festCount > available && <div style={{ color: "#f59e0b", marginTop: 6, fontWeight: 700 }}>圖數不夠排滿所有節慶貼文，其餘改用不需製圖的版本；需要時可先向客戶加購。</div>}
            </>
          )}
        </div>

        <label style={{ fontSize: 13, color: "#4a3728", display: "flex", alignItems: "center", gap: 6, marginBottom: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={o.clear} onChange={e => set("clear", e.target.checked)} />
          先清除此期間內「計畫中」的舊排程{existing > 0 ? `（目前有 ${existing} 筆）` : ""}；已發布的項目不會動
        </label>

        <div style={{ background: "#faf7f4", border: "1.5px solid #e8d8c4", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>預覽：{plan.events.length} 篇貼文、{plan.ads.length} 檔廣告</div>
          <div style={{ color: "#6b5540", lineHeight: 1.7 }}>
            {plan.events.slice(0, 8).map(e => <div key={e.id}>◆ {md(e.date)}　{e.title}</div>)}
            {plan.events.length > 8 && <div style={{ color: "#b08040" }}>⋯ 還有 {plan.events.length - 8} 篇</div>}
            {plan.ads.slice(0, 3).map(a => <div key={a.id} style={{ color: "#4f8ef7" }}>▬ {md(a.start)} → {md(a.end)}　{a.platform} 廣告</div>)}
            {plan.ads.length > 3 && <div style={{ color: "#b08040" }}>⋯ 還有 {plan.ads.length - 3} 檔</div>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => o.start && onApply({ ...plan, clear: o.clear }, o.start)} style={{ flex: 2, background: "#1a1208", color: "#f59e0b", border: "none", borderRadius: 8, padding: 11, fontWeight: 900, cursor: "pointer", fontSize: 15 }}>產生排程</button>
          <button onClick={onClose} style={{ flex: 1, background: "#f0e8dc", color: "#4a3728", border: "none", borderRadius: 8, padding: 11, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>取消</button>
        </div>
      </div>
    </div>
  );
}
