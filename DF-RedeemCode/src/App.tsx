import { useEffect, useState } from "react";
import { auth, db } from "./lib/firebase";
import { signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { 
  LogOut, 
  CircleUser, 
  Zap, 
  CheckCircle2, 
  XCircle, 
  Database,
  Cloud,
  RefreshCw,
  Settings,
  Link
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ref, 
  onValue, 
  get, 
  update,
  query,
  orderByValue,
  limitToLast,
  startAfter
} from "firebase/database";

const getParams = (urlStr: string) => {
  try {
    const url = new URL(urlStr);
    return Object.fromEntries(url.searchParams.entries());
  } catch(e) {
    return {};
  }
};

const DEFAULT_MASTER_URL = "https://sg-act.playerinfinite.com/api/proxy/present/CdkV2/RedeemCDKey?cdkey=123&channel=10&game_id=30150&gameid=30150&openid=6762653709957283006&token=18d2111e4b3606bbca8bca0069344c385623c101&account_type=1&lang_type=vi&u=d677163a-2bdb-4b34-9dd8-ba991a44c8c0&a=10005&ts=1773217659&s=862b490ac76eef04aeaf438758a571a0";
const LOCAL_MASTER_URL_KEY = 'df_master_url_v6';

interface RedeemHistory {
  id: string;
  cdkey: string;
  status: 'success' | 'failure';
  message: string;
  timestamp: number;
}

const unescapeFirebaseKey = (key: string) => {
  return key
    .replace(/%2E/g, '.')
    .replace(/%23/g, '#')
    .replace(/%24/g, '$')
    .replace(/%2F/g, '/')
    .replace(/%5B/g, '[')
    .replace(/%5D/g, ']');
};

const escapeFirebaseKey = (key: string) => {
  return key
    .replace(/\./g, '%2E')
    .replace(/#/g, '%23')
    .replace(/\$/g, '%24')
    .replace(/\//g, '%2F')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D');
};

const LOCAL_STORAGE_KEY = 'df_history_v5';
const LOCAL_SYNC_TIME_KEY = 'df_last_sync_v5';

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [history, setHistory] = useState<RedeemHistory[]>([]);
  
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const [hasNewCodes, setHasNewCodes] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [masterUrl, setMasterUrl] = useState(DEFAULT_MASTER_URL);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) setHistory(JSON.parse(stored));
      
      const storedSync = localStorage.getItem(LOCAL_SYNC_TIME_KEY);
      if (storedSync) setLastSyncTime(Number(storedSync));
      
      const storedUrl = localStorage.getItem(LOCAL_MASTER_URL_KEY);
      if (storedUrl) setMasterUrl(storedUrl);
    } catch (e) {
      console.error("Local load error", e);
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) setUser(currentUser);
      else signInAnonymously(auth);
    });

    const latestQuery = query(ref(db, 'c'), orderByValue(), limitToLast(1));
    const unsubscribeDb = onValue(latestQuery, (snapshot) => {
      snapshot.forEach((child) => {
        const val = child.val() as number;
        const ts = Math.floor(val / 10);
        if (ts > lastSyncTime) setHasNewCodes(true);
      });
    });

    return () => {
      unsubscribeAuth();
      unsubscribeDb();
    };
  }, [lastSyncTime]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const saveToLocal = (newHistory: RedeemHistory[]) => {
    const maxTs = Math.max(0, ...newHistory.map(h => Math.floor(h.timestamp / 1000)));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newHistory));
    localStorage.setItem(LOCAL_SYNC_TIME_KEY, maxTs.toString());
    setHistory(newHistory.sort((a, b) => b.timestamp - a.timestamp));
    setLastSyncTime(maxTs);
    setHasNewCodes(false);
  };

  const saveMasterUrl = (url: string) => {
    setMasterUrl(url);
    localStorage.setItem(LOCAL_MASTER_URL_KEY, url);
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const syncQuery = query(ref(db, 'c'), orderByValue(), startAfter(lastSyncTime * 10 + 9));
      const snapshot = await get(syncQuery);
      const data = snapshot.val();
      
      if (!data) {
        setIsSyncing(false);
        setHasNewCodes(false);
        return;
      }

      const localMap = new Map(history.map(item => [item.cdkey, item]));
      Object.entries(data).forEach(([safeKey, val]) => {
        const value = val as number;
        const ts = Math.floor(value / 10);
        const statusDigit = value % 10;
        const cdkey = unescapeFirebaseKey(safeKey);

        if (!localMap.has(cdkey) || (statusDigit === 0 && localMap.get(cdkey)?.status !== 'success')) {
          localMap.set(cdkey, {
            id: `v-${safeKey}`,
            cdkey,
            status: statusDigit === 0 ? 'success' : 'failure',
            message: statusDigit === 0 ? 'Thành công' : 'Đầy giới hạn (400067)',
            timestamp: ts * 1000
          });
        }
      });
      saveToLocal(Array.from(localMap.values()));
    } catch (e) {
      console.error("Sync error", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRedeem = async () => {
    if (!inputValue.trim()) return;
    
    const rawCodes = inputValue.split(/\r?\n/)
      .map(line => line.replace(/["\u200b\u200c\u200d\uFEFF]/g, '').trim())
      .filter(code => code && code.length > 0);

    const uniqueCodes = Array.from(new Set(rawCodes));
    const codesToRun = uniqueCodes.filter(c => !history.some(h => h.cdkey === c));

    if (codesToRun.length === 0) {
      alert("Tất cả mã đã được nhập hoặc đã có trong lịch sử!");
      setInputValue("");
      return;
    }

    const config = getParams(masterUrl);
    if (!config.openid) {
      alert("MASTER_URL không hợp lệ!");
      return;
    }

    try {
      setIsSyncing(true);
      let currentHistory = [...history];

      for (let i = 0; i < codesToRun.length; i++) {
        const cdkey = codesToRun[i];
        const safeKey = escapeFirebaseKey(cdkey);
        const nowTs = Math.floor(Date.now() / 1000);

        try {
          const proxyUrl = masterUrl.replace(/cdkey=[^&]*/, `cdkey=${cdkey}`);
          const response = await fetch(proxyUrl, {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json", "Referer": "https://redeem.df.garena.sg/" },
            body: JSON.stringify({ lang_type: config.lang_type, role_info: { game_id: config.game_id }, cdkey: cdkey })
          });

          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const result = await response.json();
          const statusDigit = result.code === 0 ? 0 : (Number(result.code) === 400067 ? 1 : 2);
          
          if (statusDigit !== 2) {
             const newItem: RedeemHistory = {
              id: `local-${safeKey}-${nowTs}`,
              cdkey,
              status: statusDigit === 0 ? 'success' : 'failure',
              message: statusDigit === 0 ? 'Thành công' : `Đầy giới hạn (${result.code})`,
              timestamp: nowTs * 1000
            };

            const updates: any = {};
            updates[`c/${safeKey}`] = nowTs * 10 + statusDigit;
            await update(ref(db), updates);
            
            currentHistory = [newItem, ...currentHistory];
            setHistory([...currentHistory].sort((a, b) => b.timestamp - a.timestamp));
          }
        } catch (err) {
          console.error(`Error with code ${cdkey}:`, err);
        }

        if (i < codesToRun.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      saveToLocal(currentHistory);
      setInputValue("");
      alert(`Đã xử lý xong ${codesToRun.length} mã!`);
    } catch (e: any) {
      console.error("Batch redeem failed", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const needsSync = hasNewCodes;

  return (
    <div className="min-h-screen flex flex-col items-center p-6 md:p-12 overflow-x-hidden">
      <nav className="nav-floating glass-effect flex items-center justify-between rounded-full border-white/10!">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Zap size={20} className="text-white fill-white" />
          </div>
          <span className="font-bold text-xl tracking-tight hidden sm:block">Delta Force <span className="text-blue-400">Redeem</span></span>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-full transition-all ${showSettings ? 'bg-blue-500/20 text-blue-400 rotate-90!' : 'hover:bg-white/10 text-slate-400'}`}
          >
            <Settings size={20} />
          </button>

          {user && !user.isAnonymous ? (
            <div className="flex items-center gap-3 bg-white/10 pl-1 pr-3 py-1 rounded-full border border-white/10">
              <img src={user.photoURL || ""} alt="avatar" className="w-8 h-8 rounded-full border border-white/20" />
              <span className="text-sm font-bold leading-none hidden sm:block">{user.displayName}</span>
              <button onClick={handleLogout} className="ml-2 p-1 hover:bg-red-500/20 rounded-full text-slate-400 hover:text-red-400"><LogOut size={16} /></button>
            </div>
          ) : (
            <button onClick={handleLogin} className="btn-nordic-glass py-2! px-5!"><CircleUser size={18} /><span>Đăng nhập</span></button>
          )}
        </div>
      </nav>

      <main className="w-full max-w-[1200px] mt-24 md:mt-32 space-y-12">
        <AnimatePresence>
          {showSettings && (
            <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex justify-center overflow-hidden">
              <div className="nordic-card w-full max-w-2xl border-blue-500/20! bg-slate-900/60! space-y-4">
                <div className="flex items-center gap-2 text-blue-400"><Link size={18} /><h3 className="font-bold text-white">Cấu hình Master URL</h3></div>
                <div className="space-y-2">
                  <textarea value={masterUrl} onChange={(e) => saveMasterUrl(e.target.value)} className="w-full bg-slate-950/50 border border-white/10 rounded-xl p-3 text-xs font-mono text-blue-100/70 outline-none h-24" placeholder="Dán URL RedeemCDKey tại đây..."/>
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span>Trạng thái: {getParams(masterUrl).openid ? "✅ Hợp lệ" : "❌ URL thiếu OpenID/Token"}</span>
                    <button onClick={() => saveMasterUrl(DEFAULT_MASTER_URL)} className="hover:text-white">Khôi phục mặc định</button>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <section className="flex justify-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="nordic-card w-full max-w-2xl text-center space-y-6 bg-slate-900/40! border-blue-500/10!">
            <div className="space-y-2"><h2 className="text-3xl font-bold text-white">Nhập hàng loạt mã</h2><p className="text-slate-400 text-sm">Mỗi dòng 1 mã CDKey. Hệ thống tự động lọc trùng và delay 1s.</p></div>
            <div className={`flex flex-col gap-3 p-4 bg-white/5 rounded-2xl border transition-colors ${needsSync ? 'border-orange-500/50 shadow-lg shadow-orange-500/10' : 'border-white/10 focus-within:border-blue-400/30'}`}>
              <textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Dán danh sách mã vào đây (Mỗi mã 1 dòng)..." className="w-full bg-transparent px-2 py-2 outline-none font-mono text-sm text-white min-h-[120px] resize-y" />
              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-white/5">
                <div className="flex-1 flex items-center px-2"><span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{inputValue.trim() ? `${inputValue.trim().split('\n').filter(l => l.trim()).length} mã được tìm thấy` : "Sẵn sàng"}</span></div>
                <AnimatePresence>
                  {needsSync && (
                    <motion.button initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} onClick={handleSync} disabled={isSyncing} className="btn-nordic-glass py-2! px-4! bg-orange-500/20 text-orange-400 border-orange-500/30"><RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} /><span className="text-xs">Đồng bộ Server</span></motion.button>
                  )}
                </AnimatePresence>
                <button onClick={handleRedeem} disabled={isSyncing || !inputValue.trim()} className={`btn-nordic-primary py-2! px-6! ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}><Zap size={18} className="fill-white" /><span>{isSyncing ? "Đang xử lý..." : "Bắt đầu nhập"}</span></button>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between px-4"><h3 className="font-bold text-lg flex items-center gap-2 text-white"><Database size={18} className="text-blue-400" />Lịch sử nhập mã (Cục bộ)</h3></div>
          <div className="nordic-card p-0! overflow-hidden bg-slate-900/30!">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/5">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Mã CDKey</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Trạng thái</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence>
                    {history.length > 0 ? history.map((item) => (
                      <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="table-row-hover transition-colors">
                        <td className="px-6 py-4 font-mono font-medium text-blue-100">{item.cdkey}</td>
                        <td className="px-6 py-4"><span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${item.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{item.status === 'success' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}{item.message}</span></td>
                        <td className="px-6 py-4 text-xs text-slate-500 italic">{new Date(item.timestamp).toLocaleString()}</td>
                      </motion.tr>
                    )) : (
                      <tr><td colSpan={3} className="px-6 py-16 text-center"><div className="flex flex-col items-center gap-4 text-slate-500"><Cloud size={48} strokeWidth={1} className="opacity-30" /><p className="text-sm">Chưa có dữ liệu lịch sử cục bộ</p></div></td></tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
      <footer className="mt-auto py-12 text-center space-y-2 opacity-30">
        <p className="text-xs font-bold tracking-widest uppercase text-white">Delta Force Auto-Redeem</p>
        <p className="text-[10px] text-slate-400">© 2026 Nordic Arctic Edition | Centralized GAS Hybrid</p>
      </footer>
    </div>
  );
};

export default App;