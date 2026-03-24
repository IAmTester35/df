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
  RefreshCw
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


interface RedeemHistory {
  id: string;
  cdkey: string;
  status: 'success' | 'failure';
  message: string;
  timestamp: number;
}

// Helper: Giải mã các ký tự đặc biệt từ Firebase Key
const unescapeFirebaseKey = (key: string) => {
  return key
    .replace(/%2E/g, '.')
    .replace(/%23/g, '#')
    .replace(/%24/g, '$')
    .replace(/%2F/g, '/')
    .replace(/%5B/g, '[')
    .replace(/%5D/g, ']');
};

// Helper: Mã hóa CDKey để làm Firebase Key
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

  useEffect(() => {
    // 1. Load from Local
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
      const storedSync = localStorage.getItem(LOCAL_SYNC_TIME_KEY);
      if (storedSync) {
        setLastSyncTime(Number(storedSync));
      }
    } catch (e) {
      console.error("Local load error", e);
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        signInAnonymously(auth);
      }
    });

    // 2. Listen for ANY new code (delta notification)
    const latestQuery = query(ref(db, 'c'), orderByValue(), limitToLast(1));
    const unsubscribeDb = onValue(latestQuery, (snapshot) => {
      snapshot.forEach((child) => {
        const val = child.val() as number;
        const ts = Math.floor(val / 10);
        // Nếu có mã mới hơn mốc local sync -> Báo hiệu có code mới
        if (ts > lastSyncTime) {
          setHasNewCodes(true);
        }
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

  // Helper: Save to Local & Update Sync Time

  const saveToLocal = (newHistory: RedeemHistory[]) => {
    // Tìm mốc timestamp lớn nhất để làm mốc sync tiếp theo
    const maxTs = Math.max(0, ...newHistory.map(h => Math.floor(h.timestamp / 1000)));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newHistory));
    localStorage.setItem(LOCAL_SYNC_TIME_KEY, maxTs.toString());
    setHistory(newHistory.sort((a, b) => b.timestamp - a.timestamp));
    setLastSyncTime(maxTs);
    setHasNewCodes(false);
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      // Delta Sync: Chỉ lấy những mã có value > (lastSyncTime * 10 + 9)
      const syncQuery = query(
        ref(db, 'c'), 
        orderByValue(), 
        startAfter(lastSyncTime * 10 + 9)
      );
      
      const snapshot = await get(syncQuery);
      const data = snapshot.val();
      
      if (!data) {
        setIsSyncing(false);
        setHasNewCodes(false);
        return;
      }

      const localMap = new Map(history.map(item => [item.cdkey.toUpperCase(), item]));

      Object.entries(data).forEach(([safeKey, val]) => {
        const value = val as number;
        const ts = Math.floor(value / 10);
        const statusDigit = value % 10;
        const cdkey = unescapeFirebaseKey(safeKey).toUpperCase();

        // Ưu tiên Success (0) hơn Limit (1) nếu trùng
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
    const cdkey = inputValue.trim().toUpperCase();
    const safeKey = escapeFirebaseKey(cdkey);
    const nowTs = Math.floor(Date.now() / 1000);

    if (history.some(h => h.cdkey === cdkey)) {
      alert("Mã này đã có trong lịch sử!");
      setInputValue("");
      return;
    }

    // Giả lập API: 0: Success, 1: Limit (400067), 2: Rác (Skip)
    const rand = Math.random();
    const mockStatus = rand > 0.8 ? 0 : (rand > 0.5 ? 1 : 2);
    
    if (mockStatus === 2) {
      alert("Mã không hợp lệ hoặc đã hết hạn (Rác - Không lưu Server)");
      setInputValue("");
      return;
    }

    const newItem: RedeemHistory = {
      id: `local-${safeKey}-${nowTs}`,
      cdkey,
      status: mockStatus === 0 ? 'success' : 'failure',
      message: mockStatus === 0 ? 'Thành công' : 'Đầy giới hạn (400067)',
      timestamp: nowTs * 1000
    };

    const newHistory = [newItem, ...history];

    try {
      // Đẩy DUY NHẤT 1 NODE bằng update (O(1) Bandwidth)
      const updates: any = {};
      updates[`c/${safeKey}`] = nowTs * 10 + mockStatus;
      await update(ref(db), updates);
      
      saveToLocal(newHistory);
      setInputValue("");
    } catch (e) {
      console.error("Push failed", e);
      saveToLocal(newHistory); // Save local anyway
      setInputValue("");
    }
  };

  const needsSync = hasNewCodes;

  return (
    <div className="min-h-screen flex flex-col items-center p-6 md:p-12 overflow-x-hidden">
      
      {/* Tầng 1: Navigation Bar */}
      <nav className="nav-floating glass-effect flex items-center justify-between rounded-full border-white/10!">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Zap size={20} className="text-white fill-white" />
          </div>
          <span className="font-bold text-xl tracking-tight hidden sm:block">Delta Force <span className="text-blue-400">Redeem</span></span>
        </div>

        <div className="flex items-center gap-4">
          {user && !user.isAnonymous ? (
            <div className="flex items-center gap-3 bg-white/10 pl-1 pr-3 py-1 rounded-full border border-white/10">
              <img src={user.photoURL || ""} alt="avatar" className="w-8 h-8 rounded-full border border-white/20" />
              <div className="flex flex-col">
                <span className="text-sm font-bold leading-none">{user.displayName}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="ml-2 p-1 hover:bg-red-500/20 rounded-full text-slate-400 hover:text-red-400 transition-colors"
                title="Đăng xuất"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="btn-nordic-glass py-2! px-5!"
            >
              <CircleUser size={18} />
              <span>Đăng nhập</span>
            </button>
          )}
        </div>
      </nav>

      <main className="w-full max-w-[1200px] mt-24 md:mt-32 space-y-12">
        
        {/* Tầng 2: Hero Action Zone */}
        <section className="flex justify-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="nordic-card w-full max-w-2xl text-center space-y-6 bg-slate-900/40!"
          >
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-white">Nhập mã ưu đãi</h2>
              <p className="text-slate-400 text-sm">Nhận ngay phần quà từ Delta Force Garena</p>
            </div>

            <div className={`flex flex-col sm:flex-row gap-3 p-2 bg-white/5 rounded-2xl border transition-colors ${needsSync ? 'border-orange-500/50 shadow-lg shadow-orange-500/10' : 'border-white/10 focus-within:border-blue-400/30'}`}>
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Nhập CDKey tại đây..."
                className="flex-1 bg-transparent px-4 py-3 outline-none font-mono text-lg text-white placeholder:text-slate-500 placeholder:font-sans"
              />
              
              <AnimatePresence>
                {needsSync && (
                  <motion.button
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="btn-nordic-glass bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/30 text-orange-400 font-bold"
                  >
                    <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                    <span>{isSyncing ? "Đang kéo" : "Đồng bộ Server"}</span>
                  </motion.button>
                )}
              </AnimatePresence>

              <button 
                onClick={handleRedeem}
                className="btn-nordic-primary"
              >
                <Zap size={18} className="fill-white" />
                <span>Xác nhận</span>
              </button>
            </div>
            
            {needsSync && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-orange-400 text-xs text-left px-2"
              >
                ✨ Cộng đồng vừa cập nhật mã mới! Ấn nút Đồng bộ để xem ngay.
              </motion.p>
            )}
          </motion.div>
        </section>

        {/* Tầng 3: Data & Utility Zone */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-4">
            <h3 className="font-bold text-lg flex items-center gap-2 text-white">
              <Database size={18} className="text-blue-400" />
              Lịch sử nhập mã (Cục bộ)
            </h3>
          </div>

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
                      <motion.tr 
                        key={item.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="table-row-hover transition-colors"
                      >
                        <td className="px-6 py-4 font-mono font-medium text-blue-100">{item.cdkey}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                            item.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {item.status === 'success' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {item.message}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 italic">
                          {new Date(item.timestamp).toLocaleString()}
                        </td>
                      </motion.tr>
                    )) : (
                      <tr>
                        <td colSpan={3} className="px-6 py-16 text-center">
                          <div className="flex flex-col items-center gap-4 text-slate-500">
                             <Cloud size={48} strokeWidth={1} className="opacity-30" />
                             <p className="text-sm">Chưa có dữ liệu lịch sử cục bộ</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Branding */}
      <footer className="mt-auto py-12 text-center space-y-2 opacity-30">
        <p className="text-xs font-bold tracking-widest uppercase text-white">Delta Force Auto-Redeem</p>
        <p className="text-[10px] text-slate-400">© 2026 Nordic Arctic Edition | Hybrid v4.0</p>
      </footer>
    </div>
  );
};

export default App;