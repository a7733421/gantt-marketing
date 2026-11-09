import { useState } from "react";
import { imgInfo, IMG_ASOF } from "./images";

const lbl = { fontSize: 13, color: "#b08040", letterSpacing: 1, display: "block", marginBottom: 5, fontWeight: 700 };
const inp = { width: "100%", background: "#faf7f4", border: "1.5px solid #e8d8c4", borderRadius: 8, padding: "9px 12px", color: "#1a1208", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const md = s => `${+s.slice(5, 7)}/${+s.slice(8, 10)}`;

export default function ImageModal({ client, onClose, onSave }) {
  const [base, setBase] = useState(client.imgBase == null ? "" : String(client.imgBase));
  const [asOf, setAsOf] = useState(client.imgAsOf || IMG_ASOF);
  const [ledger, setLedger] = useState(client.imgLedger || []);
  const [d, setD] = useState(todayIso());
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");

  // 以編輯中的數值即時試算
  const info = imgInfo({ ...client, imgBase: base === "" ? null : +base, imgAsOf: asOf, imgLedger: ledger });
  const rem = info ? info.remaining : null;
  const col = rem == null ? "#94a3b8" : rem <= 0 ? "#ef4444" : rem <= 2 ? "#f59e0b" : "#22c55e";
  const addLedger = () => {
    const n = parseInt(delta, 10);
    if (!n) return;
    setLedger([{ id: "g" + Date.now(), date: d, delta: n, note: note.trim() }, ...ledger]);
    setDelta(""); setNote("");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(26,18,8,.65)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 26, width: 500, maxWidth: "94vw", border: "1px solid #e8d8c4", boxShadow: "0 24px 60px rgba(26,18,8,.25)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>🖼 圖數：{client.name}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "#6b5540", marginBottom: 14 }}>幫客戶做圖會扣圖數：貼文勾選「需要製圖」就自動扣 1 張（含計畫中的貼文）。</div>

        <div style={{ background: "#faf7f4", border: `2px solid ${col}`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "#6b5540" }}>目前剩餘圖數</div>
          <div style={{ fontSize: 34, fontWeight: 900, color: col }}>{rem == null ? "未設定" : rem + " 張"}</div>
          {info && <div style={{ fontSize: 12, color: "#6b5540" }}>基準 {info.base} ＋ 加購／調整 {info.added >= 0 ? info.added : "−" + -info.added} − 已排／已用 {info.used.length}</div>}
          {rem != null && rem < 0 && <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 800, marginTop: 4 }}>⚠️ 已超出圖數，請先向客戶加購</div>}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>基準圖數（張）</label>
            <input type="number" min={0} value={base} onChange={e => setBase(e.target.value)} placeholder="例：10" style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>基準日</label>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} style={inp} />
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#b08040", marginBottom: 14 }}>基準＝Excel「圖」欄在基準日當天的剩餘張數；基準日（含）以前的貼文已包含在內，不會重複扣。</div>

        <label style={lbl}>加購／調整紀錄</label>
        <div style={{ background: "#faf7f4", border: "1.5px solid #e8d8c4", borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input type="date" value={d} onChange={e => setD(e.target.value)} style={{ ...inp, width: 140, padding: "6px 8px", fontSize: 13 }} />
            <input type="number" value={delta} onChange={e => setDelta(e.target.value)} placeholder="±張數" style={{ ...inp, width: 80, padding: "6px 8px", fontSize: 13 }} />
            <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && addLedger()} placeholder="例：加購 10 張" style={{ ...inp, flex: 1, padding: "6px 10px", fontSize: 13 }} />
            <button onClick={addLedger} style={{ background: "#1a1208", color: "#f59e0b", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer", fontWeight: 800 }}>＋</button>
          </div>
          {ledger.length === 0 && <div style={{ fontSize: 13, color: "#c8b898" }}>尚無紀錄（加購填正數，扣除或更正填負數）</div>}
          {[...ledger].sort((a, b) => b.date.localeCompare(a.date)).map(l => (
            <div key={l.id} style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px solid #f0e8dc", fontSize: 13, alignItems: "center" }}>
              <span style={{ color: "#b08040", fontWeight: 700, whiteSpace: "nowrap" }}>{md(l.date)}</span>
              <span style={{ fontWeight: 800, color: l.delta > 0 ? "#22c55e" : "#ef4444", minWidth: 36 }}>{l.delta > 0 ? "+" : ""}{l.delta}</span>
              <span style={{ flex: 1 }}>{l.note}{l.date < asOf && <span style={{ color: "#94a3b8", fontSize: 11 }}> （基準日前，不計入）</span>}</span>
              <button onClick={() => setLedger(ledger.filter(x => x.id !== l.id))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
          ))}
        </div>

        <label style={lbl}>基準日之後的扣圖明細（{info ? info.used.length : 0} 張）</label>
        <div style={{ background: "#faf7f4", border: "1.5px solid #e8d8c4", borderRadius: 10, padding: 12, marginBottom: 18, maxHeight: 160, overflowY: "auto" }}>
          {(!info || info.used.length === 0) && <div style={{ fontSize: 13, color: "#c8b898" }}>尚無扣圖貼文</div>}
          {info && info.used.map(e => (
            <div key={e.id} style={{ fontSize: 13, padding: "3px 0", display: "flex", gap: 8 }}>
              <span style={{ color: "#b08040", fontWeight: 700 }}>{md(e.date)}</span>
              <span style={{ flex: 1 }}>{e.title || "（無標題）"}</span>
              <span style={{ fontSize: 11, color: e.planned ? "#94a3b8" : "#ec4899", fontWeight: 700 }}>{e.planned ? "計畫中" : "已發布"}　−1</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onSave({ imgBase: base === "" ? null : +base, imgAsOf: asOf, imgLedger: ledger })} style={{ flex: 2, background: "#1a1208", color: "#f59e0b", border: "none", borderRadius: 8, padding: 11, fontWeight: 900, cursor: "pointer", fontSize: 15 }}>儲存</button>
          <button onClick={onClose} style={{ flex: 1, background: "#f0e8dc", color: "#4a3728", border: "none", borderRadius: 8, padding: 11, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>取消</button>
        </div>
      </div>
    </div>
  );
}
