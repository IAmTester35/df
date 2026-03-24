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
  Cloud
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ref, onValue, set } from "firebase/database";

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

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [history, setHistory] = useState<RedeemHistory[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        signInAnonymously(auth);
      }
    });

    // Lắng nghe dữ liệu từ Firebase RTDB (Cấu trúc V4.0)
    const codesRef = ref(db, 'codes');
    const unsubscribeDb = onValue(codesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setHistory([]);
        return;
      }

      const combinedHistory: RedeemHistory[] = [];

      // Parse nhánh 's' (Success)
      if (data.s) {
        Object.entries(data.s).forEach(([safeKey, timestamp]) => {
          combinedHistory.push({
            id: `s-${safeKey}`,
            cdkey: unescapeFirebaseKey(safeKey),
            status: 'success',
            message: 'Thành công',
            timestamp: (timestamp as number) * 1000 // Chuyển từ Unix s sang ms
          });
        });
      }

      // Parse nhánh 'f' (Failure)
      if (data.f) {
        Object.entries(data.f).forEach(([safeKey, value]) => {
          const [code, timestamp] = (value as string).split('|');
          combinedHistory.push({
            id: `f-${safeKey}`,
            cdkey: unescapeFirebaseKey(safeKey),
            status: 'failure',
            message: `Lỗi ${code}`,
            timestamp: parseInt(timestamp) * 1000
          });
        });
      }

      // Sắp xếp theo thời gian mới nhất lên đầu
      combinedHistory.sort((a, b) => b.timestamp - a.timestamp);
      setHistory(combinedHistory);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeDb();
    };
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleRedeem = async () => {
    if (!inputValue.trim()) return;
    const cdkey = inputValue.trim().toUpperCase();
    const safeKey = escapeFirebaseKey(cdkey);
    const nowTs = Math.floor(Date.now() / 1000);

    // Ghi tạm vào nhánh success (giả lập)
    try {
      await set(ref(db, `codes/s/${safeKey}`), nowTs);
      setInputValue("");
    } catch (error) {
      console.error("Redeem failed", error);
    }
  };


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

            <div className="flex flex-col sm:flex-row gap-3 p-2 bg-white/5 rounded-2xl border border-white/10 focus-within:border-blue-400/30 transition-colors">
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Nhập CDKey tại đây..."
                className="flex-1 bg-transparent px-4 py-3 outline-none font-mono text-lg text-white placeholder:text-slate-500 placeholder:font-sans"
              />
              <button 
                onClick={handleRedeem}
                className="btn-nordic-primary"
              >
                <Zap size={18} className="fill-white" />
                <span>Xác nhận</span>
              </button>
            </div>
          </motion.div>
        </section>

        {/* Tầng 3: Data & Utility Zone */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-4">
            <h3 className="font-bold text-lg flex items-center gap-2 text-white">
              <Database size={18} className="text-blue-400" />
              Lịch sử nhập mã
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
                             <p className="text-sm">Chưa có dữ liệu lịch sử</p>
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
        <p className="text-[10px] text-slate-400">© 2026 Nordic Arctic Edition</p>
      </footer>
    </div>
  );
};

export default App;