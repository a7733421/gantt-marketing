import { useState } from "react";

export const PRESET_TAGS = ["回覆慢", "已讀不回", "資料／回覆常延遲", "常不提供照片", "愛改文案", "需先審稿", "偏好 LINE 聯絡", "偏好電話聯絡", "重視價格", "淡旺季明顯", "不喜歡促銷", "圖片自備", "決策者不在窗口", "曾遭停權", "付款準時", "易續約"];

const lbl = { fontSize: 13, color: "#b08040", letterSpacing: 1, display: "block", marginBottom: 5, fontWeight: 700 };
const inp = { width: "100%", background: "#faf7f4", border: "1.5px solid #e8d8c4", borderRadius: 8, padding: "9px 12px", color: "#1a1208", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const EMPTY = { tags: [], contact: "", traits: "", comm: "", pref: "", materials: "", log: [] };

export default function ProfileModal({ client, onClose, onSave }) {
  const [p, setP] = useState({ ...EMPTY, ...(client.profile || {}) });
  const [custom, setCustom] = useState("");
  const [logDate, setLogDate] = useState(todayIso());
  const [logText, setLogText] = useState("");
  const set = (k, v) => setP(x => ({ ...x, [k]: v }));
  const toggle = (t) => set("tags", p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t]);
  const addCustom = () => { const t = custom.trim(); if (t && !p.tags.includes(t)) set("tags", [...p.tags, t]); setCustom(""); };
  const addLog = () => {
    if (!logText.trim()) return;
    set("log", [{ id: "l" + Date.now(), date: logDate, text: logText.trim() }, ...p.log]);
    setLogText("");
  };
  const allTags = [...PRESET_TAGS, ...p.tags.filter(t => !PRESET_TAGS.includes(t))];
  const log = [...p.log].sort((a, b) => b.date.localeCompare(a.date));

  const field = (key, label, ph, rows = 2) => (
    <>
      <label style={lbl}>{label}</label>
      <textarea value={p[key] || ""} onChange={e => set(key, e.target.value)} placeholder={ph} rows={rows} style={{ ...inp, resize: "vertical", marginBottom: 14 }} />
    </>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,18,8,.65)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 26, width: 560, maxWidth: "94vw", border: "1px solid #e8d8c4", boxShadow: "0 24px 60px rgba(26,18,8,.25)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>🗂 客戶檔案：{client.name}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "#6b5540", marginBottom: 16 }}>記下這個客戶的脾氣、習慣與注意事項，換人接手或規劃貼文時能直接參考。</div>

        <label style={lbl}>特性標籤（可複選）</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {allTags.map(t => {
            const sel = p.tags.includes(t);
            return <button key={t} onClick={() => toggle(t)} style={{ background: sel ? "#1a1208" : "#f0e8dc", color: sel ? "#f59e0b" : "#4a3728", border: sel ? "1.5px solid #f59e0b" : "1.5px solid #e8d8c4", borderRadius: 20, padding: "4px 12px", cursor: "pointer", fontSize: 12, fontWeight: sel ? 800 : 400 }}>{sel ? "✓ " : ""}{t}</button>;
          })}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <input value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustom()} placeholder="自訂標籤，按 Enter 加入" style={{ ...inp, flex: 1, padding: "6px 12px", fontSize: 13 }} />
          <button onClick={addCustom} style={{ background: "#1a1208", color: "#f59e0b", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer", fontWeight: 800 }}>＋</button>
        </div>

        <label style={lbl}>聯絡窗口／決策者</label>
        <input value={p.contact || ""} onChange={e => set("contact", e.target.value)} placeholder="例：老闆娘（LINE）、行政小姐負責對接" style={{ ...inp, marginBottom: 14 }} />
        {field("traits", "經營特性／目標客群", "例：親子家庭為主、平日客源少、旺季集中暑假與連假")}
        {field("comm", "溝通習慣", "例：回覆通常隔天、晚上才看訊息、文案要先給老闆確認")}
        {field("pref", "內容偏好與禁忌", "例：不要用太多 emoji、不提價格、偏好實拍圖")}
        {field("materials", "資料／素材提供習慣", "例：常忘記給照片，需提前一週催；照片放 Google Drive")}

        <label style={lbl}>互動紀錄</label>
        <div style={{ background: "#faf7f4", border: "1.5px solid #e8d8c4", borderRadius: 10, padding: 12, marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} style={{ ...inp, width: 150, padding: "6px 8px", fontSize: 13 }} />
            <input value={logText} onChange={e => setLogText(e.target.value)} onKeyDown={e => e.key === "Enter" && addLog()} placeholder="例：改文案三次才通過" style={{ ...inp, flex: 1, padding: "6px 12px", fontSize: 13 }} />
            <button onClick={addLog} style={{ background: "#1a1208", color: "#f59e0b", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer", fontWeight: 800 }}>＋</button>
          </div>
          {log.length === 0 && <div style={{ fontSize: 13, color: "#c8b898" }}>尚無紀錄</div>}
          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            {log.map(l => (
              <div key={l.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 0", borderBottom: "1px solid #f0e8dc", fontSize: 13 }}>
                <span style={{ color: "#b08040", fontWeight: 700, whiteSpace: "nowrap" }}>{l.date.slice(5).replace("-", "/")}</span>
                <span style={{ flex: 1 }}>{l.text}{l.src && <span style={{ color: "#94a3b8", fontSize: 11 }}> （{l.src}）</span>}</span>
                <button onClick={() => set("log", p.log.filter(x => x.id !== l.id))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#b08040", marginBottom: 12 }}>⚠️ 請勿在此輸入帳號、密碼或付款資訊。</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onSave(p)} style={{ flex: 2, background: "#1a1208", color: "#f59e0b", border: "none", borderRadius: 8, padding: 11, fontWeight: 900, cursor: "pointer", fontSize: 15 }}>儲存</button>
          <button onClick={onClose} style={{ flex: 1, background: "#f0e8dc", color: "#4a3728", border: "none", borderRadius: 8, padding: 11, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>取消</button>
        </div>
      </div>
    </div>
  );
}
