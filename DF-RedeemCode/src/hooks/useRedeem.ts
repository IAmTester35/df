import { useEffect, useState, useCallback } from "react";
import Swal from "sweetalert2";
import { auth, db } from "../lib/firebase";
import { signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
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
import { 
  DEFAULT_MASTER_URL, 
  LOCAL_MASTER_URL_KEY, 
  LOCAL_STORAGE_KEY, 
  LOCAL_SYNC_TIME_KEY 
} from "../lib/constants";
import { 
  getParams, 
  unescapeFirebaseKey, 
  escapeFirebaseKey,
  parseInputCodes
} from "../lib/utils";
import { migrateStorage } from "../lib/storage";

// Remove top-level call to migrateStorage, move it into the hook

export interface UserMeta {
  lastSync: number;
  masterUrl?: string;
}

export interface RedeemHistory {
  id: string;
  cdkey: string;
  status: 'success' | 'failure';
  message: string;
  timestamp: number;
}

export const useRedeem = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userMeta, setUserMeta] = useState<UserMeta>({ lastSync: 0 });
  const [inputValue, setInputValue] = useState("");
  const [history, setHistory] = useState<RedeemHistory[]>([]);
  const [hasNewCodes, setHasNewCodes] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [masterUrl, setMasterUrl] = useState(DEFAULT_MASTER_URL);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // Migrate on mount
    migrateStorage();

    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) setHistory(JSON.parse(stored));

      const storedSync = localStorage.getItem(LOCAL_SYNC_TIME_KEY);
      if (storedSync) setUserMeta(prev => ({ ...prev, lastSync: Number(storedSync) }));

      const storedUrl = localStorage.getItem(LOCAL_MASTER_URL_KEY);
      if (storedUrl) setMasterUrl(storedUrl);
    } catch (e) {
      console.error("Local load error", e);
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userRef = ref(db, `u/${currentUser.uid}`);
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            const data = snapshot.val() as UserMeta;
            setUserMeta(data);
            if (data.masterUrl) {
              setMasterUrl(data.masterUrl);
              localStorage.setItem(LOCAL_MASTER_URL_KEY, data.masterUrl);
            }
          } else {
            const initialMeta: UserMeta = { lastSync: 0, masterUrl };
            await update(userRef, initialMeta as any);
            setUserMeta(initialMeta);
          }
        } catch (e) {
          console.error("User meta load error", e);
        }
      } else {
        signInAnonymously(auth);
      }
    });

    const latestQuery = query(ref(db, 'c'), orderByValue(), limitToLast(1));
    const unsubscribeDb = onValue(latestQuery, (snapshot) => {
      snapshot.forEach((child) => {
        const safeKey = child.key;
        const val = child.val() as number;
        const ts = Math.floor(val / 10);
        
        if (ts > userMeta.lastSync) {
          setHasNewCodes(true);
        } else if (ts === userMeta.lastSync && safeKey) {
          const cdkey = unescapeFirebaseKey(safeKey);
          if (!history.some(h => h.cdkey === cdkey)) {
            setHasNewCodes(true);
          }
        }
      });
    });

    return () => {
      unsubscribeAuth();
      unsubscribeDb();
    };
  }, [userMeta.lastSync, history]);

  const handleLogin = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
      Swal.fire({
        icon: 'error',
        title: 'Lỗi đăng nhập',
        text: error instanceof Error ? error.message : "Đăng nhập thất bại, vui lòng thử lại!",
      });
    }
  }, []);

  const handleLogout = useCallback(() => signOut(auth), []);

  const saveToLocal = useCallback((newHistory: RedeemHistory[]) => {
    const maxTs = Math.max(0, ...newHistory.map(h => Math.floor(h.timestamp / 1000)));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newHistory));
    localStorage.setItem(LOCAL_SYNC_TIME_KEY, maxTs.toString());
    setHistory(newHistory.sort((a, b) => b.timestamp - a.timestamp));
    setUserMeta(prev => ({ ...prev, lastSync: maxTs }));
    setHasNewCodes(false);

    if (user && !user.isAnonymous) {
      update(ref(db, `u/${user.uid}`), { s: maxTs });
    }
  }, [user]);

  const saveMasterUrl = useCallback((url: string) => {
    setMasterUrl(url);
    localStorage.setItem(LOCAL_MASTER_URL_KEY, url);
    if (user && !user.isAnonymous) {
      update(ref(db, `u/${user.uid}`), { masterUrl: url });
    }
  }, [user]);

  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const currentHistory = [...history];
      const localKeys = new Set(currentHistory.map(h => h.cdkey));
      let addedCount = 0;

      let syncQuery;
      if (currentHistory.length === 0) {
        syncQuery = query(ref(db, 'c'), orderByValue());
      } else {
        syncQuery = query(ref(db, 'c'), orderByValue(), startAfter(userMeta.lastSync * 10 + 1));
      }

      const snapshot = await get(syncQuery);
      const data = snapshot.val();

      if (!data) {
        setIsSyncing(false);
        setHasNewCodes(false);
        Swal.fire({
          icon: 'info',
          title: 'Cập nhật',
          text: 'Dữ liệu đã được cập nhật mới nhất!',
          timer: 2000,
          showConfirmButton: false
        });
        return;
      }

      const entries = Object.entries(data);
      const newHistoryEntries: RedeemHistory[] = [...currentHistory];
      const config = getParams(masterUrl);

      for (const [safeKey, val] of entries) {
        const value = val as number;
        const ts = Math.floor(value / 10);
        const statusDigit = value % 10;
        const cdkey = unescapeFirebaseKey(safeKey);

        if (statusDigit === 0 && !localKeys.has(cdkey)) {
          if (config.openid) {
            try {
              const workerUrl = import.meta.env.VITE_WORKER_URL;
              const targetUrl = workerUrl || masterUrl.replace(/cdkey=[^&]*/, `cdkey=${cdkey}`);
              await fetch(targetUrl, {
                method: "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json", "Referer": "https://redeem.df.garena.sg/" },
                body: JSON.stringify({ 
                  masterUrl, 
                  cdkey, 
                  lang_type: config.lang_type, 
                  role_info: { game_id: config.game_id } 
                })
              });
            } catch (err) {
              console.warn(`Auto-redeem failed for ${cdkey}`, err);
            }
            await new Promise(r => setTimeout(r, 300));
          }

          newHistoryEntries.push({
            id: `v-${safeKey}`,
            cdkey,
            status: 'success',
            message: 'Thành công (Đồng bộ)',
            timestamp: ts * 1000
          });
          localKeys.add(cdkey);
          addedCount++;
        }
      }
      
      saveToLocal(newHistoryEntries);
      Swal.fire({
        icon: 'success',
        title: 'Thành công',
        text: `Đã đồng bộ xong! Hệ thống đã tự động nạp ${addedCount} mã mới.`,
      });
    } catch (e) {
      console.error("Sync error", e);
      Swal.fire({
        icon: 'error',
        title: 'Lỗi đồng bộ',
        text: e instanceof Error ? e.message : "Hãy kiểm tra Index trong Firebase Rules!",
        footer: 'Kiểm tra console để biết thêm chi tiết'
      });
    } finally {
      setIsSyncing(false);
    }
  }, [history, isSyncing, masterUrl, userMeta.lastSync, saveToLocal]);

  const handleRedeem = useCallback(async () => {
    if (!inputValue.trim()) return;

    const uniqueCodes = parseInputCodes(inputValue);
    const codesToRun = uniqueCodes.filter(c => !history.some(h => h.cdkey === c));

    if (codesToRun.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Thông báo',
        text: 'Tất cả mã đã được nhập hoặc đã có trong lịch sử!',
      });
      setInputValue("");
      return;
    }

    const config = getParams(masterUrl);
    if (!config.openid) {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi cấu hình',
        text: 'MASTER_URL không hợp lệ!',
      });
      return;
    }

    try {
      setIsSyncing(true);
      let currentHistory = [...history];
      const summary: { cdkey: string, msg: string, status: string }[] = [];

      for (let i = 0; i < codesToRun.length; i++) {
        const cdkey = codesToRun[i];
        const safeKey = escapeFirebaseKey(cdkey);
        const nowTs = Math.floor(Date.now() / 1000);

        try {
          const workerUrl = import.meta.env.VITE_WORKER_URL;
          const targetUrl = workerUrl || masterUrl.replace(/cdkey=[^&]*/, `cdkey=${cdkey}`);
          const response = await fetch(targetUrl, {
            method: "POST",
            headers: { "Accept": "application/json", "Content-Type": "application/json", "Referer": "https://redeem.df.garena.sg/" },
            body: JSON.stringify({ 
              masterUrl, 
              cdkey, 
              lang_type: config.lang_type, 
              role_info: { game_id: config.game_id } 
            })
          });

          // Allow reading JSON even if response is not ok (for 4xx mappings from proxy)
          const result = await response.json().catch(() => ({ 
            code: response.status === 200 ? 0 : -1, 
            msg: `Proxy/HTTP ${response.status} (Internal Error)` 
          }));

          const statusDigit = result.code === 0 ? 0 : (Number(result.code) === 400067 ? 1 : 2);
          const displayMsg = result.msg || result.message || (statusDigit === 0 ? 'Thành công' : `Lỗi ${result.code}`);

          const newItem: RedeemHistory = {
            id: `local-${safeKey}-${nowTs}`,
            cdkey,
            status: statusDigit === 0 ? 'success' : 'failure',
            message: displayMsg,
            timestamp: nowTs * 1000
          };

          currentHistory = [newItem, ...currentHistory];
          setHistory([...currentHistory].sort((a, b) => b.timestamp - a.timestamp));
          
          summary.push({ cdkey, msg: displayMsg, status: newItem.status });

        } catch (err: any) {
          console.error(`Error with code ${cdkey}:`, err);
          summary.push({ cdkey, msg: err.message || "Network Error", status: 'failure' });
        }

        if (i < codesToRun.length - 1) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      saveToLocal(currentHistory);
      setInputValue("");

      const failures = summary.filter(s => s.status === 'failure');
      if (failures.length > 0) {
        let errorHtml = '<ul style="text-align: left; max-height: 200px; overflow-y: auto; font-size: 0.8em; margin: 0; padding-left: 20px;">';
        failures.forEach(f => {
          errorHtml += `<li><strong>${f.cdkey}</strong>: <span style="color: #ef4444">${f.msg}</span></li>`;
        });
        errorHtml += '</ul>';

        Swal.fire({
          icon: 'warning',
          title: 'Kết quả nạp mã',
          html: `<div style="margin-bottom: 10px;">Đã xử lý xong ${summary.length} mã, phát hiện <strong>${failures.length} lỗi</strong>:</div>${errorHtml}`,
          confirmButtonText: 'Đã hiểu'
        });
      } else {
        Swal.fire({
          icon: 'success',
          title: 'Thành công',
          text: `Đã nạp thành công ${summary.length} mã!`,
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (e: any) {
      console.error("Batch redeem failed", e);
      Swal.fire({
        icon: 'error',
        title: 'Lỗi nạp mã',
        text: e instanceof Error ? e.message : "Xử lý nạp mã hàng loạt thất bại!",
        footer: 'Kiểm tra console để biết thêm chi tiết'
      });
    } finally {
      setIsSyncing(false);
    }
  }, [history, inputValue, masterUrl, saveToLocal]);

  return {
    user,
    userMeta,
    inputValue,
    setInputValue,
    history,
    hasNewCodes,
    isSyncing,
    masterUrl,
    showSettings,
    setShowSettings,
    handleLogin,
    handleLogout,
    saveMasterUrl,
    handleSync,
    handleRedeem
  };
};
