import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCCh5iJrxM3wRX3hp9iRLLq2RrFuAV_Zh4",
  authDomain: "gantt-marketing.firebaseapp.com",
  projectId: "gantt-marketing",
  storageBucket: "gantt-marketing.firebasestorage.app",
  messagingSenderId: "966398251503",
  appId: "1:966398251503:web:d6a2173863f9ca1cfd261a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PRIORITY = {
  高: { label: "🔴 高", color: "#ef4444", bg: "rgba(239,68,68,0.13)" },
  中: { label: "🟡 中", color: "#f59e0b", bg: "rgba(245,158,11,0.13)" },
  低: { label: "🟢 低", color: "#22c55e", bg: "rgba(34,197,94,0.13)" },
};
const MAIN_CATS = ["行政", "設計", "程式功能"];
const SUB_CATS = ["文宣製作", "業務推廣", "主機下線關心", "行銷方案制定", "EDM電郵", "程式功能", "其他"];
const SUB_COLORS = {
  "文宣製作": "#ec4899", "業務推廣": "#f97316", "主機下線關心": "#ef4444",
  "行銷方案制定": "#a855f7", "EDM電郵": "#06b6d4", "程式功能": "#4f8ef7", "其他": "#94a3b8",
};
const MEMBERS = ["丁郁澐","許綾讌","李靜憶","黃如杏","劉舜薇","楊蜜恬","何玉如","吳彥琳","林宜慧","經理"];
const CAT_COLOR = { "程式功能": "#4f8ef7", "設計": "#ec4899", "行政": "#f59e0b" };

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getToday() { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }; }
function toAbsDay(y, m, d) { return y * 10000 + m * 100 + d; }
function taskEndAbs(t) {
  const d = new Date(t.startYear, t.startMonth, t.startDay + t.duration - 1);
  return toAbsDay(d.getFullYear(), d.getMonth(), d.getDate());
}
function isOverdue(t, today) { return taskEndAbs(t) < toAbsDay(today.year, today.month, today.day) && t.progress < 100; }
function isDueSoon(t, today) {
  const ta = toAbsDay(today.year, today.month, today.day), ea = taskEndAbs(t);
  return ea >= ta && ea <= ta + 3 && t.progress < 100;
}
function drivePreviewUrl(url) {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400` : null;
}
function isImageUrl(url) { return /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(url) || url.includes("drive.google.com"); }

const today0 = getToday();
const defaultTasks = [
  { id:1, name:"六月主視覺設計", mainCats:["設計"], subCats:["文宣製作"], assignees:["丁郁澐","許綾讌"], startYear:today0.year, startMonth:today0.month, startDay:1, duration:8, progress:90, priority:"高", note:"需配合印刷規格", attachments:[] },
  { id:2, name:"Q3行銷方案簡報", mainCats:["行政"], subCats:["行銷方案制定"], assignees:["劉舜薇"], startYear:today0.year, startMonth:today0.month, startDay:3, duration:12, progress:40, priority:"高", note:"", attachments:[] },
  { id:3, name:"EDM六月電郵排程", mainCats:["行政"], subCats:["EDM電郵"], assignees:["李靜憶","黃如杏"], startYear:today0.year, startMonth:today0.month, startDay:5, duration:5, progress:100, priority:"中", note:"已完成待發送", attachments:[] },
  { id:4, name:"主機下線用戶關心", mainCats:["行政"], subCats:["主機下線關心"], assignees:["楊蜜恬","何玉如"], startYear:today0.year, startMonth:today0.month, startDay:2, duration:6, progress:20, priority:"高", note:"⚠️ 進度落後", attachments:[] },
  { id:5, name:"業務推廣型錄更新", mainCats:["設計"], subCats:["業務推廣"], assignees:["吳彥琳"], startYear:today0.year, startMonth:today0.month, startDay:10, duration:25, progress:15, priority:"中", note:"等業務部提供資料", attachments:[] },
  { id:6, name:"跨月網站改版", mainCats:["設計","程式功能"], subCats:["程式功能"], assignees:["林宜慧","經理"], startYear:today0.year, startMonth:today0.month, startDay:22, duration:18, progress:5, priority:"高", note:"跨部門跨月任務示範", attachments:[] },
  { id:7, name:"社群貼文規劃", mainCats:["行政"], subCats:["其他"], assignees:["丁郁澐"], startYear:today0.year, startMonth:today0.month, startDay:1, duration:4, progress:30, priority:"低", note:"", attachments:[] },
];

const EMPTY = { id:null, name:"", mainCats:["行政"], subCats:["文宣製作"], assignees:[], startYear:today0.year, startMonth:today0.month, startDay:1, duration:5, progress:0, priority:"中", note:"", attachments:[] };

const lbl = { fontSize:13, color:"#b08040", letterSpacing:1, display:"block", marginBottom:5, fontWeight:700 };
const inp = { width:"100%", background:"#faf7f4", border:"1.5px solid #e8d8c4", borderRadius:8, padding:"9px 12px", color:"#1a1208", fontSize:14, boxSizing:"border-box" };

export default function GanttMarketing() {
  const today = getToday();
  const [viewYear, setViewYear]   = useState(today.year);
  const [viewMonth, setViewMonth] = useState(today.month);
  const [tasks, setTasks]         = useState(defaultTasks);
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask]   = useState(null);
  const [filterMains, setFilterMains] = useState([]);
  const [filterSubs, setFilterSubs]   = useState([]);
  const [filterPri, setFilterPri]     = useState("全部");
  const [filterMember, setFilterMember] = useState("全部");
  const [showOverdue, setShowOverdue] = useState(false);
  const [previewImg, setPreviewImg]   = useState(null);
  const [newAttLabel, setNewAttLabel] = useState("");
  const [newAttUrl, setNewAttUrl]     = useState("");
  const [saveMsg, setSaveMsg]         = useState("");
  const [loaded, setLoaded]           = useState(false);
  const gridRef = useRef(null);
  const scrollRef = useRef(null);
  const [cellW, setCellW] = useState(36);
  const CELL_OPTIONS = [28, 36, 48, 64];

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString("zh-TW", { year:"numeric", month:"long" });

  // Load data from Firestore
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "gantt", "data"));
        if (snap.exists()) {
          const d = snap.data();
          if (d.tasks) setTasks(JSON.parse(d.tasks));
          if (d.view) { const {y,m}=JSON.parse(d.view); setViewYear(y); setViewMonth(m); }
        }
      } catch(e) { console.error(e); }
      setLoaded(true);
    })();
  }, []);

  const save = async (t, y, m) => {
    try {
      await setDoc(doc(db, "gantt", "data"), {
        tasks: JSON.stringify(t),
        view: JSON.stringify({y,m}),
        updatedAt: new Date().toISOString()
      });
      setSaveMsg("✓ 已儲存"); setTimeout(()=>setSaveMsg(""), 2000);
    } catch(e) { setSaveMsg("儲存失敗"); console.error(e); }
  };
  const updateTasks = (nt) => { setTasks(nt); save(nt, viewYear, viewMonth); };

  const prevMonth = () => { let nm=viewMonth-1,ny=viewYear; if(nm<0){nm=11;ny--;} setViewMonth(nm); setViewYear(ny); save(tasks,ny,nm); };
  const nextMonth = () => { let nm=viewMonth+1,ny=viewYear; if(nm>11){nm=0;ny++;} setViewMonth(nm); setViewYear(ny); save(tasks,ny,nm); };

  useEffect(() => {
    const handler = (e) => {
      if (showModal || previewImg) return;
      if (e.key === "ArrowLeft")  prevMonth();
      if (e.key === "ArrowRight") nextMonth();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showModal, previewImg, viewMonth, viewYear, tasks]);

  const toggleMainFilter = (c) => setFilterMains(prev => prev.includes(c) ? prev.filter(x=>x!==c) : [...prev, c]);

  const taskVisibleInView = (task) => {
    const tS = new Date(task.startYear, task.startMonth, task.startDay);
    const tE = new Date(task.startYear, task.startMonth, task.startDay + task.duration - 1);
    return tS <= new Date(viewYear, viewMonth+1, 0) && tE >= new Date(viewYear, viewMonth, 1);
  };

  const overdueList = tasks.filter(t => isOverdue(t, today));

  const filteredTasks = tasks.filter(t => {
    if (!taskVisibleInView(t)) return false;
    if (filterMains.length > 0 && !(t.mainCats||[]).some(c=>filterMains.includes(c))) return false;
    if (filterSubs.length>0 && !(t.subCats||[t.subCat]).some(s=>filterSubs.includes(s))) return false;
    if (filterPri !== "全部" && t.priority !== filterPri) return false;
    if (filterMember !== "全部" && !(t.assignees||[]).includes(filterMember)) return false;
    return true;
  }).sort((a,b) => taskEndAbs(a) - taskEndAbs(b));

  const openAdd  = () => { setEditTask({...EMPTY, startYear:viewYear, startMonth:viewMonth}); setShowModal(true); };
  const openEdit = (task) => { setEditTask({...task, assignees:[...(task.assignees||[])], subCats:[...(task.subCats||[])], attachments:[...(task.attachments||[])]}); setShowModal(true); };
  const openCopy = () => {
    if (!editTask) return;
    setEditTask({ ...editTask, id: null, name: editTask.name + "（副本）", subCats:[...(editTask.subCats||[])] });
  };
  const saveTask = () => {
    if (!editTask.name.trim()) return;
    if (!(editTask.mainCats||[]).length) { alert("請選擇大類！"); return; }
    if (!(editTask.subCats||[]).length) { alert("請選擇小類！"); return; };
    const nt = editTask.id
      ? tasks.map(t => t.id===editTask.id ? editTask : t)
      : [...tasks, {...editTask, id:Date.now()}];
    updateTasks(nt); setShowModal(false);
  };
  const deleteTask = (id) => { updateTasks(tasks.filter(t=>t.id!==id)); setShowModal(false); };
  const toggleAssignee = (m) => setEditTask(et => ({...et, assignees: et.assignees.includes(m) ? et.assignees.filter(x=>x!==m) : [...et.assignees, m]}));
  const addAttachment = () => {
    if (!newAttUrl.trim()) return;
    const label = newAttLabel.trim() || newAttUrl.split("/").pop().split("?")[0] || "附件";
    setEditTask(et => ({...et, attachments:[...(et.attachments||[]), {label, url:newAttUrl.trim()}]}));
    setNewAttLabel(""); setNewAttUrl("");
  };
  const removeAttachment = (idx) => setEditTask(et => ({...et, attachments:(et.attachments||[]).filter((_,i)=>i!==idx)}));

  const handleBarMouseDown = (e, task) => {
    e.preventDefault();
    const startX=e.clientX, origDay=task.startDay, origYear=task.startYear, origMonth=task.startMonth;
    const cw = gridRef.current ? gridRef.current.offsetWidth/daysInMonth : 36;
    const onMove = (me) => {
      const dm = Math.round((me.clientX-startX)/cw);
      const nd = new Date(origYear, origMonth, origDay+dm);
      setTasks(prev => prev.map(t => t.id===task.id ? {...t, startYear:nd.getFullYear(), startMonth:nd.getMonth(), startDay:nd.getDate()} : t));
    };
    const onUp = () => { document.removeEventListener("mousemove",onMove); document.removeEventListener("mouseup",onUp); setTasks(prev=>{save(prev,viewYear,viewMonth);return prev;}); };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  };

  const pColor = (p) => p>=100?"#22c55e":p>=60?"#4f8ef7":p>=30?"#f59e0b":"#ef4444";

  if (!loaded) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#faf7f4",fontSize:18,fontFamily:"sans-serif"}}>載入中⋯</div>;

  return (
    <div style={{minHeight:"100vh",background:"#faf7f4",fontFamily:"'Noto Sans TC',sans-serif",color:"#1a1208"}}>
      <div style={{background:"#1a1208",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <a href="/home.html" style={{color:"#f59e0b",fontSize:12,textDecoration:"none",opacity:.7}}>← 返回總覽</a>
          <span style={{color:"#3a2a18"}}>|</span>
          <span style={{color:"#f59e0b",fontWeight:900,letterSpacing:3,fontSize:14,textTransform:"uppercase"}}>Team Gantt</span>
          <span style={{color:"#3a2a18"}}>|</span>
          <span style={{color:"#e8dcc8",fontSize:15}}>工作進度追蹤</span>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {saveMsg && <span style={{fontSize:13,color:"#22c55e",fontWeight:700}}>{saveMsg}</span>}
          <button onClick={openAdd} style={{background:"#f59e0b",color:"#1a1208",border:"none",borderRadius:6,padding:"8px 18px",cursor:"pointer",fontWeight:800,fontSize:14}}>＋ 新增任務</button>
        </div>
      </div>

      <div style={{padding:"20px 24px"}}>
        <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
          {[
            {label:"⚠️ 超時案件", value:tasks.filter(t=>isOverdue(t,today)).length, accent:"#ef4444", click:()=>setShowOverdue(true)},
            {label:"⏰ 即將到期", value:tasks.filter(t=>isDueSoon(t,today)).length, accent:"#f59e0b"},
            {label:"✅ 已完成",   value:tasks.filter(t=>t.progress>=100).length, accent:"#22c55e"},
            {label:"全部任務",    value:tasks.length, accent:"#1a1208"},
            {label:"平均進度",    value:(tasks.length?Math.round(tasks.reduce((a,t)=>a+t.progress,0)/tasks.length):0)+"%", accent:"#4f8ef7"},
          ].map(s=>(
            <div key={s.label} onClick={s.click||null}
              style={{background:"#fff",border:"1px solid #e8d8c4",borderRadius:10,padding:"12px 18px",flex:1,minWidth:90,borderTop:`3px solid ${s.accent}`,cursor:s.click?"pointer":"default"}}
              onMouseEnter={e=>{if(s.click)e.currentTarget.style.boxShadow="0 2px 12px rgba(239,68,68,.2)"}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="none"}}>
              <div style={{fontSize:11,color:"#b08040",marginBottom:3}}>{s.label}</div>
              <div style={{fontSize:24,fontWeight:900,color:s.accent}}>{s.value}</div>
              {s.click&&<div style={{fontSize:11,color:"#b08040",marginTop:2}}>點擊查看 →</div>}
            </div>
          ))}
        </div>

        {showOverdue && overdueList.length>0 && (
          <div style={{background:"#fff5f5",border:"1.5px solid #ef4444",borderRadius:12,padding:"14px 18px",marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontWeight:800,color:"#ef4444",fontSize:15}}>🚨 超時案件</span>
              <button onClick={()=>setShowOverdue(false)} style={{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:18}}>✕</button>
            </div>
            {overdueList.map(t=>{
              const endDate=new Date(t.startYear,t.startMonth,t.startDay+t.duration-1);
              const daysLate=Math.floor((new Date()-endDate)/86400000);
              return (
                <div key={t.id} onClick={()=>{openEdit(t);setShowOverdue(false);}}
                  style={{display:"flex",alignItems:"center",gap:12,padding:"9px 10px",borderRadius:8,cursor:"pointer",marginBottom:4,background:"rgba(239,68,68,0.06)"}}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(239,68,68,0.13)"}
                  onMouseLeave={e=>e.currentTarget.style.background="rgba(239,68,68,0.06)"}>
                  <span style={{fontSize:11,background:"#ef4444",color:"#fff",borderRadius:20,padding:"2px 9px",fontWeight:800,whiteSpace:"nowrap"}}>逾期{daysLate}天</span>
                  <span style={{fontWeight:700,fontSize:14}}>{t.name}</span>
                  <span style={{fontSize:13,color:"#94a3b8"}}>{t.assignees?.join("、")}</span>
                  <span style={{fontSize:13,color:"#f59e0b",marginLeft:"auto"}}>進度 {t.progress}%</span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{background:"#fff",border:"1px solid #e8d8c4",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <button onClick={prevMonth} style={{background:"#1a1208",color:"#f59e0b",border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:18,fontWeight:900}}>‹</button>
              <span style={{fontWeight:900,fontSize:17,minWidth:120,textAlign:"center",color:"#1a1208"}}>{monthName}</span>
              <button onClick={nextMonth} style={{background:"#1a1208",color:"#f59e0b",border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:18,fontWeight:900}}>›</button>
              <span style={{fontSize:11,color:"#b08040",marginLeft:4}}>← → 鍵也可切換</span>
            </div>
            <div style={{width:1,height:24,background:"#e8d8c4"}}/>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:"#b08040",fontWeight:700}}>👤 我的案子：</span>
              {["全部",...MEMBERS].map(m=>{
                const sel=filterMember===m;
                return (
                  <button key={m} onClick={()=>setFilterMember(m)}
                    style={{background:sel?"#1a1208":"#f0e8dc",color:sel?"#f59e0b":"#4a3728",border:sel?"1.5px solid #f59e0b":"1.5px solid #e8d8c4",borderRadius:20,padding:"4px 12px",cursor:"pointer",fontSize:13,fontWeight:sel?800:400}}>
                    {sel&&m!=="全部"?"✓ ":""}{m}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:12,color:"#b08040",fontWeight:700}}>大類：</span>
            {filterMains.length>0&&<button onClick={()=>setFilterMains([])} style={{background:"#f0e8dc",color:"#4a3728",border:"1px solid #e8d8c4",borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:12}}>✕ 清除</button>}
            {MAIN_CATS.map(c=>{
              const sel=filterMains.includes(c);
              return (<button key={c} onClick={()=>toggleMainFilter(c)} style={{background:sel?CAT_COLOR[c]:"#fff",color:sel?"#fff":"#4a3728",border:`1.5px solid ${sel?CAT_COLOR[c]:"#e8d8c4"}`,borderRadius:20,padding:"5px 14px",cursor:"pointer",fontSize:13,fontWeight:sel?800:500}}>{sel?"✓ ":""}{c}</button>);
            })}
            <div style={{width:1,height:22,background:"#e8d8c4",margin:"0 4px"}}/>
            <span style={{fontSize:12,color:"#b08040",fontWeight:700}}>小類：</span>
            {filterSubs.length>0&&<button onClick={()=>setFilterSubs([])} style={{background:"#f0e8dc",color:"#4a3728",border:"1px solid #e8d8c4",borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:12}}>✕ 清除</button>}
            {SUB_CATS.map(c=>{
              const sel=filterSubs.includes(c);
              return (<button key={c} onClick={()=>setFilterSubs(prev=>sel?prev.filter(x=>x!==c):[...prev,c])} style={{background:sel?SUB_COLORS[c]||"#1a1208":"#fff",color:sel?"#fff":"#4a3728",border:"1px solid "+(SUB_COLORS[c]||"#e8d8c4"),borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:12,fontWeight:sel?800:400}}>{sel?"✓ ":""}{c}</button>);
            })}
            <div style={{width:1,height:22,background:"#e8d8c4",margin:"0 4px"}}/>
            {["全部","高","中","低"].map(p=>(
              <button key={p} onClick={()=>setFilterPri(p)} style={{background:filterPri===p?(PRIORITY[p]?.color||"#1a1208"):"#fff",color:filterPri===p?"#fff":"#4a3728",border:`1px solid ${PRIORITY[p]?.color||"#e8d8c4"}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:12,fontWeight:700}}>
                {p==="全部"?"全部優先":PRIORITY[p].label}
              </button>
            ))}
          </div>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <span style={{fontSize:12,color:"#b08040",fontWeight:700}}>縮放日期：</span>
          {CELL_OPTIONS.map(w=>(<button key={w} onClick={()=>setCellW(w)} style={{background:cellW===w?"#1a1208":"#fff",color:cellW===w?"#f59e0b":"#4a3728",border:"1.5px solid "+(cellW===w?"#f59e0b":"#e8d8c4"),borderRadius:6,padding:"4px 14px",cursor:"pointer",fontSize:13,fontWeight:cellW===w?800:400}}>{w===28?"小":w===36?"中":w===48?"大":"最大"}</button>))}
        </div>

        <div style={{background:"#fff",borderRadius:14,border:"1px solid #e8d8c4",boxShadow:"0 2px 16px rgba(26,18,8,.06)",overflow:"hidden"}}>
          <div style={{display:"flex",background:"#1a1208",color:"#e8dcc8"}}>
            <div style={{display:"flex",flexShrink:0,zIndex:2,boxShadow:"2px 0 6px rgba(0,0,0,.15)"}}>
              <div style={{width:26,padding:"11px 0 11px 10px",fontSize:11}}>#</div>
              <div style={{width:200,padding:"11px 8px",fontSize:12,color:"#f59e0b",fontWeight:800}}>任務名稱</div>
              <div style={{width:66,padding:"11px 4px",fontSize:12,color:"#f59e0b",fontWeight:800}}>優先</div>
              <div style={{width:110,padding:"11px 4px",fontSize:12,color:"#f59e0b",fontWeight:800}}>負責人</div>
              <div style={{width:34,padding:"11px 2px",fontSize:12,color:"#f59e0b",fontWeight:800,textAlign:"center"}}>附</div>
              <div style={{width:68,padding:"11px 4px",fontSize:12,color:"#f59e0b",fontWeight:800}}>進度</div>
            </div>
            <div ref={scrollRef} style={{flex:1,overflowX:"scroll",scrollbarWidth:"thin",scrollbarColor:"#8a7050 #2a1f10",cursor:"grab"}}
              onScroll={e=>{const sl=e.target.scrollLeft;document.querySelectorAll(".gs-sync").forEach(el=>{el.scrollLeft=sl;})}}>
              <div ref={gridRef} style={{display:"flex",width:daysInMonth*cellW+"px",minWidth:"100%"}}>
                {Array.from({length:daysInMonth},(_,i)=>{
                  const d=i+1,isToday=viewYear===today.year&&viewMonth===today.month&&d===today.day;
                  const dow=new Date(viewYear,viewMonth,d).getDay(),isWk=dow===0||dow===6;
                  const dayName=["日","一","二","三","四","五","六"][dow];
                  return (<div key={d} style={{width:cellW,minWidth:cellW,boxSizing:"border-box",padding:cellW>=48?"9px 0 7px":"7px 0",textAlign:"center",fontSize:cellW>=48?16:cellW>=36?14:12,color:isToday?"#f59e0b":isWk?"#a07840":"#94a3b8",fontWeight:isToday?900:600,background:isToday?"rgba(245,158,11,.15)":isWk?"rgba(240,220,180,.18)":"transparent",borderLeft:"1px solid rgba(255,255,255,.08)"}}>
                    {d}{cellW>=48&&<div style={{fontSize:11,color:isWk?"#c8a060":"#64748b",marginTop:3}}>{dayName}</div>}
                  </div>);
                })}
              </div>
            </div>
          </div>

          {filteredTasks.length===0&&<div style={{padding:40,textAlign:"center",color:"#b08040",fontSize:15}}>本月沒有符合條件的任務</div>}

          {filteredTasks.map((task,idx)=>{
            const subColor=SUB_COLORS[(task.subCats||[task.subCat])[0]]||"#94a3b8";
            const pri=PRIORITY[task.priority],overdue=isOverdue(task,today),dueSoon=isDueSoon(task,today);
            const isFiltered=filterMember!=="全部"&&(task.assignees||[]).includes(filterMember);
            const pc=pColor(task.progress);
            const vS=new Date(viewYear,viewMonth,1),vE=new Date(viewYear,viewMonth+1,0);
            const tS=new Date(task.startYear,task.startMonth,task.startDay),tE=new Date(task.startYear,task.startMonth,task.startDay+task.duration-1);
            const visS=tS<vS?vS:tS,visE=tE>vE?vE:tE;
            const barLeft=(visS.getDate()-1)*cellW,barWidth=(visE.getDate()-visS.getDate()+1)*cellW;
            const crossStart=tS<vS,crossEnd=tE>vE;
            return (
              <div key={task.id} style={{display:"flex",alignItems:"stretch",background:overdue?"rgba(239,68,68,0.05)":isFiltered?"rgba(245,158,11,0.06)":idx%2===1?"#fdf9f5":"#fff",borderBottom:"1px solid #f0e8dc",outline:overdue?"1.5px solid rgba(239,68,68,.2)":isFiltered?"1.5px solid rgba(245,158,11,.3)":"none"}}>
                <div style={{display:"flex",alignItems:"center",flexShrink:0,boxShadow:"2px 0 6px rgba(0,0,0,.06)"}}>
                  <div style={{width:26,minWidth:26,padding:"0 0 0 10px",fontSize:11,color:"#c8b898"}}>{idx+1}</div>
                  <div style={{width:200,minWidth:200,padding:"10px 8px",display:"flex",alignItems:"flex-start",gap:5}}>
                    <div style={{marginTop:2,width:3,height:34,borderRadius:2,background:subColor,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#1a1208",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {overdue&&<span style={{color:"#ef4444",marginRight:3}}>⚠</span>}
                        {dueSoon&&!overdue&&<span style={{color:"#f59e0b",marginRight:3}}>⏰</span>}
                        {task.name}
                      </div>
                      <div style={{fontSize:11,fontWeight:700,display:"flex",flexWrap:"wrap",gap:2,marginTop:2}}>{(task.subCats||[task.subCat]).map(s=>(<span key={s} style={{color:SUB_COLORS[s]||"#94a3b8",background:(SUB_COLORS[s]||"#94a3b8")+"18",borderRadius:3,padding:"0 4px",fontSize:10}}>{s}</span>))}</div>
                      {task.note&&<div style={{fontSize:10,color:"#94a3b8",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={task.note}>{task.note}</div>}
                    </div>
                    <button onClick={()=>openEdit(task)} style={{background:"none",border:"none",color:"#b08040",cursor:"pointer",fontSize:18,padding:"0 4px",flexShrink:0,opacity:.8}}>✎</button>
                  </div>
                  <div style={{width:66,padding:"10px 4px"}}><span style={{background:pri.bg,color:pri.color,borderRadius:20,padding:"3px 7px",fontSize:11,fontWeight:800}}>{pri.label}</span></div>
                  <div style={{width:110,padding:"10px 4px",fontSize:12,color:"#4a3728",lineHeight:1.5}}>
                    {(task.assignees||[]).map(a=>(<span key={a} style={{display:"inline-block",background:a===filterMember&&filterMember!=="全部"?"#f59e0b":"#f0e8dc",color:a===filterMember&&filterMember!=="全部"?"#fff":"#4a3728",borderRadius:20,padding:"1px 7px",fontSize:11,marginRight:2,marginBottom:2,fontWeight:a===filterMember&&filterMember!=="全部"?800:400}}>{a}</span>))}
                  </div>
                  <div style={{width:34,padding:"10px 2px",textAlign:"center"}}>{(task.attachments||[]).length>0&&<span style={{fontSize:12,color:"#4f8ef7",fontWeight:800,cursor:"pointer"}} onClick={()=>openEdit(task)}>{task.attachments.length}</span>}</div>
                  <div style={{width:68,padding:"10px 4px"}}>
                    <div style={{fontSize:13,fontWeight:800,color:pc}}>{task.progress}%</div>
                    <div style={{height:5,background:"#f0e8dc",borderRadius:99,marginTop:3}}><div style={{height:"100%",width:`${task.progress}%`,background:pc,borderRadius:99}}/></div>
                  </div>
                </div>
                <div className="gs-sync" style={{flex:1,overflowX:"scroll",position:"relative",height:54,scrollbarWidth:"none",msOverflowStyle:"none"}} ref={el=>{if(el&&scrollRef.current)el.scrollLeft=scrollRef.current.scrollLeft;}}>
                  <div style={{position:"relative",width:daysInMonth*cellW+"px",height:"100%"}}>
                    {Array.from({length:daysInMonth},(_,i)=>{const dow=new Date(viewYear,viewMonth,i+1).getDay();return(dow===0||dow===6)?<div key={i} style={{position:"absolute",left:i*cellW,width:cellW,top:0,bottom:0,background:"rgba(240,220,180,.2)"}}/>:null;})}
                    {Array.from({length:daysInMonth},(_,i)=>(<div key={"g"+i} style={{position:"absolute",left:i*cellW,top:0,bottom:0,width:1,background:"rgba(0,0,0,0.04)"}}/>))}
                    {viewYear===today.year&&viewMonth===today.month&&<div style={{position:"absolute",left:(today.day-0.5)*cellW,top:4,bottom:4,width:2,background:"#f59e0b",opacity:.6,zIndex:3,borderRadius:1}}/>}
                    <div onMouseDown={e=>handleBarMouseDown(e,task)} style={{position:"absolute",left:barLeft,width:barWidth,top:"50%",transform:"translateY(-50%)",height:26,borderRadius:crossStart?"0 6px 6px 0":crossEnd?"6px 0 0 6px":"6px",background:overdue?"#ef4444":subColor,cursor:"grab",overflow:"hidden",zIndex:2,boxShadow:"0 2px 8px "+(overdue?"#ef4444":subColor)+"55"}}>
                      <div style={{position:"absolute",left:0,top:0,bottom:0,width:`${task.progress}%`,background:"rgba(255,255,255,.3)",borderRadius:"inherit"}}/>
                      {crossStart&&<span style={{position:"absolute",left:3,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"rgba(255,255,255,.8)"}}>◄</span>}
                      {crossEnd&&<span style={{position:"absolute",right:3,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"rgba(255,255,255,.8)"}}>►</span>}
                      <span style={{position:"absolute",left:crossStart?30:6,top:"50%",transform:"translateY(-50%)",fontSize:11,fontWeight:800,color:"#fff",whiteSpace:"nowrap"}}>{task.duration}天</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {previewImg&&(
        <div onClick={()=>setPreviewImg(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out"}}>
          <div style={{position:"relative",maxWidth:"90vw",maxHeight:"90vh"}}>
            <img src={previewImg.url} alt={previewImg.label} style={{maxWidth:"90vw",maxHeight:"85vh",borderRadius:10,boxShadow:"0 8px 40px rgba(0,0,0,.5)"}}/>
            <div style={{position:"absolute",bottom:-30,left:0,right:0,textAlign:"center",color:"#e8dcc8",fontSize:14}}>{previewImg.label}</div>
            <button onClick={()=>setPreviewImg(null)} style={{position:"absolute",top:-14,right:-14,background:"#ef4444",border:"none",color:"#fff",borderRadius:"50%",width:30,height:30,cursor:"pointer",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
        </div>
      )}

      {showModal&&editTask&&(
        <div style={{position:"fixed",inset:0,background:"rgba(26,18,8,.65)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:16,padding:26,width:480,border:"1px solid #e8d8c4",boxShadow:"0 24px 60px rgba(26,18,8,.25)",maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
              <h2 style={{margin:0,fontSize:18,fontWeight:900,color:"#1a1208"}}>{editTask.id?"✏️ 編輯任務":"＋ 新增任務"}</h2>
              <button onClick={()=>setShowModal(false)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#94a3b8"}}>✕</button>
            </div>
            <label style={lbl}>任務名稱 *</label>
            <input value={editTask.name} onChange={e=>setEditTask(et=>({...et,name:e.target.value}))} placeholder="例：六月主視覺設計" style={{...inp,marginBottom:14}}/>
            <label style={lbl}>大類（可複選）</label>
            <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
              {MAIN_CATS.map(c=>{const sel=(editTask.mainCats||[]).includes(c);return(<button key={c} onClick={()=>setEditTask(et=>({...et,mainCats:sel?(et.mainCats||[]).filter(x=>x!==c):[...(et.mainCats||[]),c]}))} style={{flex:1,background:sel?CAT_COLOR[c]:"#f0e8dc",color:sel?"#fff":"#4a3728",border:sel?`1.5px solid ${CAT_COLOR[c]}`:"1.5px solid #e8d8c4",borderRadius:8,padding:"9px 0",cursor:"pointer",fontWeight:700,fontSize:14}}>{sel?"✓ ":""}{c}</button>);})}
            </div>
            <label style={lbl}>小類（可複選）</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {SUB_CATS.map(c=>{const sel=(editTask.subCats||[]).includes(c);return(<button key={c} onClick={()=>setEditTask(et=>({...et,subCats:sel?(et.subCats||[]).filter(x=>x!==c):[...(et.subCats||[]),c]}))} style={{background:sel?SUB_COLORS[c]||"#94a3b8":"#f0e8dc",color:sel?"#fff":"#4a3728",border:sel?"1.5px solid "+(SUB_COLORS[c]||"#94a3b8"):"1.5px solid #e8d8c4",borderRadius:20,padding:"6px 13px",cursor:"pointer",fontSize:13,fontWeight:sel?800:500}}>{sel?"✓ ":""}{c}</button>);})}
            </div>
            <label style={lbl}>優先級</label>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {Object.entries(PRIORITY).map(([k,v])=>(<button key={k} onClick={()=>setEditTask(et=>({...et,priority:k}))} style={{flex:1,background:editTask.priority===k?v.color:v.bg,color:editTask.priority===k?"#fff":v.color,border:`1.5px solid ${v.color}`,borderRadius:8,padding:"8px 0",cursor:"pointer",fontWeight:800,fontSize:14}}>{v.label}</button>))}
            </div>
            <label style={lbl}>負責人（可複選）</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {MEMBERS.map(m=>{const sel=(editTask.assignees||[]).includes(m);return(<button key={m} onClick={()=>toggleAssignee(m)} style={{background:sel?"#1a1208":"#f0e8dc",color:sel?"#f59e0b":"#4a3728",border:sel?"1.5px solid #f59e0b":"1.5px solid #e8d8c4",borderRadius:20,padding:"6px 13px",cursor:"pointer",fontSize:13,fontWeight:sel?800:400}}>{sel?"✓ ":""}{m}</button>);})}
            </div>
            <label style={lbl}>開始日期</label>
            <div style={{display:"flex",gap:10,marginBottom:14}}>
              {[{label:"年",key:"startYear",min:2020,max:2099,disp:v=>v},{label:"月",key:"startMonth",min:1,max:12,disp:v=>v+1,parse:v=>v-1},{label:"日",key:"startDay",min:1,max:31},{label:"持續天數",key:"duration",min:1,max:365}].map(f=>(<div key={f.key} style={{flex:1}}><div style={{fontSize:12,color:"#b08040",marginBottom:4,fontWeight:700}}>{f.label}</div><input type="number" min={f.min} max={f.max} value={f.disp?f.disp(editTask[f.key]):editTask[f.key]} onChange={e=>setEditTask(et=>({...et,[f.key]:f.parse?f.parse(+e.target.value):Math.max(f.min,Math.min(f.max,+e.target.value))}))} style={{...inp,textAlign:"center",fontSize:15,fontWeight:700}}/></div>))}
            </div>
            <label style={lbl}>完成進度：<span style={{color:pColor(editTask.progress),fontWeight:900}}>{editTask.progress}%</span></label>
            <input type="range" min={0} max={100} step={5} value={editTask.progress} onChange={e=>setEditTask(et=>({...et,progress:+e.target.value}))} style={{width:"100%",accentColor:pColor(editTask.progress),marginBottom:14}}/>
            <label style={lbl}>備註</label>
            <textarea value={editTask.note} onChange={e=>setEditTask(et=>({...et,note:e.target.value}))} placeholder="等待資料、特殊說明⋯" rows={2} style={{...inp,resize:"vertical",marginBottom:14,fontFamily:"inherit"}}/>
            <label style={lbl}>📎 附件連結</label>
            <div style={{background:"#faf7f4",border:"1.5px solid #e8d8c4",borderRadius:10,padding:12,marginBottom:18}}>
              {(editTask.attachments||[]).length===0&&<div style={{fontSize:13,color:"#c8b898",marginBottom:8}}>尚無附件</div>}
              {(editTask.attachments||[]).map((att,idx)=>{const prev=drivePreviewUrl(att.url);return(<div key={idx} style={{display:"flex",alignItems:"center",gap:8,background:"#fff",borderRadius:8,padding:"7px 9px",marginBottom:6,border:"1px solid #e8d8c4"}}>{isImageUrl(att.url)&&prev&&<img src={prev} alt={att.label} style={{width:38,height:38,objectFit:"cover",borderRadius:5,cursor:"pointer",flexShrink:0,border:"1px solid #e8d8c4"}} onClick={()=>setPreviewImg({url:prev,label:att.label})} onError={e=>{e.target.style.display="none"}}/>}<a href={att.url} target="_blank" rel="noreferrer" style={{flex:1,fontSize:13,color:"#4f8ef7",textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:600}}>{att.label}</a><button onClick={()=>removeAttachment(idx)} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:16,padding:"0 4px",flexShrink:0}}>✕</button></div>);})}
              <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:4}}>
                <input value={newAttLabel} onChange={e=>setNewAttLabel(e.target.value)} placeholder="附件名稱（可省略）" style={{...inp,fontSize:13}}/>
                <div style={{display:"flex",gap:6}}>
                  <input value={newAttUrl} onChange={e=>setNewAttUrl(e.target.value)} placeholder="貼上 Google Drive 或圖片連結" style={{...inp,fontSize:13,flex:1}}/>
                  <button onClick={addAttachment} style={{background:"#1a1208",color:"#f59e0b",border:"none",borderRadius:8,padding:"0 14px",cursor:"pointer",fontWeight:800,fontSize:14,whiteSpace:"nowrap"}}>＋</button>
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={saveTask} style={{flex:2,background:"#1a1208",color:"#f59e0b",border:"none",borderRadius:8,padding:"11px",fontWeight:900,cursor:"pointer",fontSize:15}}>儲存</button>
              {editTask.id&&<button onClick={openCopy} style={{flex:1,background:"#4f8ef7",color:"#fff",border:"none",borderRadius:8,padding:"11px",fontWeight:800,cursor:"pointer",fontSize:14}}>📋 複製</button>}
              {editTask.id&&<button onClick={()=>deleteTask(editTask.id)} style={{background:"#ef4444",color:"#fff",border:"none",borderRadius:8,padding:"11px 14px",cursor:"pointer",fontWeight:800,fontSize:14}}>刪除</button>}
              <button onClick={()=>setShowModal(false)} style={{flex:1,background:"#f0e8dc",color:"#4a3728",border:"none",borderRadius:8,padding:"11px",fontWeight:700,cursor:"pointer",fontSize:14}}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
