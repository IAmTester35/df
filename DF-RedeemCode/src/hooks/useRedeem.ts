import { useEffect, useState, useCallback, useRef } from "react";
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

const showSummaryAlert = (
  results: { cdkey: string; status: 'success' | 'failure' | 'skipped'; msg: string }[],
  options: {
    title: string;
  }
) => {
  let html = '<div style="text-align: left; max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 0.85em; padding: 12px; background: rgba(0,0,0,0.03); border-radius: 8px; border: 1px solid rgba(0,0,0,0.05);">';
  
  results.forEach(r => {
    if (r.status === 'success') {
      html += `<div style="color: #10b981; margin-bottom: 4px;">✅ ${r.cdkey}</div>`;
    } else if (r.status === 'failure') {
      html += `<div style="color: #ef4444; margin-bottom: 4px;">❌ ${r.cdkey}: ${r.msg}</div>`;
    } else if (r.status === 'skipped') {
      html += `<div style="color: #64748b; margin-bottom: 4px;">- ${r.cdkey}: Đã nạp code này</div>`;
    }
  });
  html += '</div>';

  const hasFailures = results.some(r => r.status === 'failure');

  Swal.fire({
    icon: hasFailures ? 'warning' : 'success',
    title: options.title,
    html: html,
    confirmButtonText: 'Đã hiểu',
    customClass: {
      htmlContainer: 'text-left'
    }
  });
};

export const useRedeem = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userMeta, setUserMeta] = useState<UserMeta>({ lastSync: 0 });
  const [inputValue, setInputValue] = useState("");
  const [history, setHistory] = useState<RedeemHistory[]>([]);
  const [hasNewCodes, setHasNewCodes] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [masterUrl, setMasterUrl] = useState(DEFAULT_MASTER_URL);
  const [showSettings, setShowSettings] = useState(false);

  // Use refs to avoid effect dependencies
  const historyRef = useRef(history);
  const userMetaRef = useRef(userMeta);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    userMetaRef.current = userMeta;
  }, [userMeta]);

  // Initial load
  useEffect(() => {
    migrateStorage();
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setHistory(parsed);
        historyRef.current = parsed;
      }

      const storedSync = localStorage.getItem(LOCAL_SYNC_TIME_KEY);
      if (storedSync) {
        const syncTime = Number(storedSync);
        setUserMeta(prev => ({ ...prev, lastSync: syncTime }));
        userMetaRef.current = { ...userMetaRef.current, lastSync: syncTime };
      }

      const storedUrl = localStorage.getItem(LOCAL_MASTER_URL_KEY);
      if (storedUrl) setMasterUrl(storedUrl);
    } catch (e) {
      console.error("Local load error", e);
    }
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userRef = ref(db, `u/${currentUser.uid}`);
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            const data = snapshot.val();
            const lastSync = typeof data.lastSync === 'number' ? data.lastSync : (typeof data.s === 'number' ? data.s : 0);
            const meta: UserMeta = { ...data, lastSync };
            setUserMeta(meta);
            if (data.masterUrl) {
              setMasterUrl(data.masterUrl);
              localStorage.setItem(LOCAL_MASTER_URL_KEY, data.masterUrl);
            }
          } else {
            const initialMeta: UserMeta = { lastSync: 0, masterUrl };
            await update(userRef, initialMeta as unknown as Record<string, unknown>);
            setUserMeta(initialMeta);
          }
        } catch (e) {
          console.error("User meta load error", e);
        }
      } else {
        signInAnonymously(auth);
      }
    });
    return unsubscribeAuth;
  }, [masterUrl]);

  // DB listener
  useEffect(() => {
    const latestQuery = query(ref(db, 'c'), orderByValue(), limitToLast(1));
    const unsubscribeDb = onValue(latestQuery, (snapshot) => {
      snapshot.forEach((child) => {
        const safeKey = child.key;
        const val = child.val() as number;
        const ts = Math.floor(val / 10);

        const currentMeta = userMetaRef.current;
        const currentHistory = historyRef.current;

        if (ts > currentMeta.lastSync) {
          setHasNewCodes(true);
        } else if (ts === currentMeta.lastSync && safeKey) {
          const cdkey = unescapeFirebaseKey(safeKey);
          if (!currentHistory.some(h => h.cdkey.toUpperCase() === cdkey.toUpperCase())) {
            setHasNewCodes(true);
          }
        }
      });
    });
    return unsubscribeDb;
  }, []);

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

  const handleLogout = useCallback(async () => {
    await signOut(auth);
    setHistory([]);
    setUserMeta({ lastSync: 0 });
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(LOCAL_SYNC_TIME_KEY);
  }, []);

  const handleClearAll = useCallback(() => {
    Swal.fire({
      title: 'Xác nhận xoá?',
      text: "Toàn bộ lịch sử nạp mã cục bộ sẽ bị xoá vĩnh viễn!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#334155',
      confirmButtonText: 'Vẫn xoá',
      cancelButtonText: 'Huỷ'
    }).then((result) => {
      if (result.isConfirmed) {
        setHistory([]);
        setUserMeta(prev => ({ ...prev, lastSync: 0 }));
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.removeItem(LOCAL_SYNC_TIME_KEY);
        Swal.fire('Đã xoá!', 'Lịch sử đã được dọn sạch.', 'success');
      }
    });
  }, []);

  const callRedeemApi = useCallback(async (cdkey: string, config: Record<string, unknown>, signal: AbortSignal) => {
    try {
      const workerUrl = import.meta.env.VITE_WORKER_URL;
      const targetUrl = workerUrl || masterUrl.replace(/cdkey=[^&]*/, `cdkey=${cdkey}`);
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json", "Referer": "https://redeem.df.garena.sg/" },
        signal,
        body: JSON.stringify({
          masterUrl,
          cdkey,
          lang_type: config.lang_type,
          role_info: { game_id: config.game_id }
        })
      });

      const result = await response.json().catch(() => ({
        code: response.status === 200 ? 0 : -1,
        msg: `Proxy/HTTP ${response.status} (Internal Error)`
      }));

      if (Number(result.code) === 300001) {
        return { expired: true, status: 'failure' as const, message: 'Expired' };
      }

      const statusDigit = result.code === 0 ? 0 : (Number(result.code) === 400067 ? 1 : 2);
      const displayMsg = result.msg || result.message || (statusDigit === 0 ? 'Thành công' : `Lỗi ${result.code}`);

      return { expired: false, status: (statusDigit === 0 ? 'success' : 'failure') as 'success' | 'failure', message: displayMsg };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      return { expired: false, status: 'failure' as const, message: err instanceof Error ? err.message : "Network Error" };
    }
  }, [masterUrl]);

  const saveToLocal = useCallback((newHistory: RedeemHistory[]) => {
    const maxTs = Math.max(0, ...newHistory.map(h => Math.floor(h.timestamp / 1000)));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newHistory));
    localStorage.setItem(LOCAL_SYNC_TIME_KEY, maxTs.toString());
    setHistory(newHistory.sort((a, b) => b.timestamp - a.timestamp));
    setUserMeta(prev => ({ ...prev, lastSync: maxTs }));
    setHasNewCodes(false);

    if (user && !user.isAnonymous) {
      update(ref(db, `u/${user.uid}`), { lastSync: maxTs, s: null });
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

    // Create new controller for this sync session
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const currentHistory = [...history];
      const localKeys = new Set(currentHistory.map(h => h.cdkey.toUpperCase()));
      let addedCount = 0;

      let syncQuery;
      if (userMeta.lastSync === 0) {
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
      let maxTsInBatch = userMeta.lastSync;

      const syncSummary: { cdkey: string; status: 'success' | 'failure'; msg: string }[] = [];

      for (const [safeKey, val] of entries) {
        if (controller.signal.aborted) break;

        const value = val as number;
        const ts = Math.floor(value / 10);
        const statusDigit = value % 10;
        const cdkey = unescapeFirebaseKey(safeKey);

        if (ts > maxTsInBatch) maxTsInBatch = ts;
        const upperCdKey = cdkey.toUpperCase();

        if (!localKeys.has(upperCdKey)) {
          if (statusDigit === 0 || statusDigit === 1) {
            let actualMsg = statusDigit === 0 ? 'Thành công (Đồng bộ)' : 'Có thể sử dụng (Đồng bộ)';
            let actualStatus: 'success' | 'failure' = 'success';

            if (config.openid) {
              const res = await callRedeemApi(cdkey, config, controller.signal);
              if (res.expired) {
                controller.abort();
                Swal.fire({ icon: 'error', title: 'Master URL hết hạn', text: 'Master URL đã hết hạn, vui lòng cập nhật URL mới!' });
                setIsSyncing(false);
                saveToLocal(newHistoryEntries);
                return;
              }
              actualStatus = res.status;
              actualMsg = res.message;
              await new Promise(r => setTimeout(r, 300));
            }

            if (controller.signal.aborted) break;

            syncSummary.push({ cdkey, status: actualStatus, msg: actualMsg });
            newHistoryEntries.push({
              id: `v-${safeKey}`,
              cdkey,
              status: actualStatus,
              message: actualMsg,
              timestamp: ts * 1000
            });
            localKeys.add(upperCdKey);
            addedCount++;
          }
        }
      }

      // Update lastSync to the latest timestamp processed in the batch
      if (maxTsInBatch > userMeta.lastSync) {
        localStorage.setItem(LOCAL_SYNC_TIME_KEY, maxTsInBatch.toString());
        setUserMeta(prev => ({ ...prev, lastSync: maxTsInBatch }));
        if (user && !user.isAnonymous) {
          update(ref(db, `u/${user.uid}`), { lastSync: maxTsInBatch, s: null });
        }
      }

      saveToLocal(newHistoryEntries);
      if (addedCount > 0) {
        showSummaryAlert(syncSummary, { title: 'Kết quả đồng bộ' });
      } else {
        Swal.fire({ icon: 'info', title: 'Cập nhật', text: 'Không có mã mới nào từ server!', timer: 2000, showConfirmButton: false });
      }
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
  }, [history, isSyncing, masterUrl, userMeta.lastSync, saveToLocal, user, callRedeemApi]);

  const handleRedeem = useCallback(async () => {
    if (!inputValue.trim()) return;

    const uniqueCodes = parseInputCodes(inputValue);
    const codesToRun = uniqueCodes.filter(c => !history.some(h => h.cdkey.toUpperCase() === c.toUpperCase()));
    const skippedCodes = uniqueCodes.filter(c => history.some(h => h.cdkey.toUpperCase() === c.toUpperCase()));

    if (codesToRun.length === 0 && skippedCodes.length === 0) return;

    const config = getParams(masterUrl);
    if (!config.openid) {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi cấu hình',
        text: 'MASTER_URL không hợp lệ!',
      });
      return;
    }

    // Create new controller for this batch
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setIsSyncing(true);
      const newEntries: RedeemHistory[] = [];
      const summary: { cdkey: string, msg: string, status: 'success' | 'failure' | 'skipped' }[] = [];

      for (let i = 0; i < codesToRun.length; i++) {
        if (controller.signal.aborted) break;

        const cdkey = codesToRun[i];
        const safeKey = escapeFirebaseKey(cdkey);
        const nowTs = Math.floor(Date.now() / 1000);

        const res = await callRedeemApi(cdkey, config, controller.signal);
        if (res.expired) {
          controller.abort();
          Swal.fire({ icon: 'error', title: 'Master URL hết hạn', text: 'Master URL đã hết hạn, vui lòng cập nhật URL mới!' });
          saveToLocal([...newEntries, ...history]);
          setIsSyncing(false);
          return;
        }

        const newItem: RedeemHistory = { id: `local-${safeKey}-${nowTs}`, cdkey, status: res.status, message: res.message, timestamp: nowTs * 1000 };
        newEntries.unshift(newItem);
        summary.push({ cdkey, msg: res.message, status: res.status });

        if (i < codesToRun.length - 1 && !controller.signal.aborted) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      // Add skipped codes to summary
      skippedCodes.forEach(c => {
        summary.push({ cdkey: c, msg: 'Đã nạp code này', status: 'skipped' });
      });

      saveToLocal([...newEntries, ...history]);
      showSummaryAlert(summary, { title: 'Kết quả nạp mã' });
    } catch (e) {
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
  }, [history, inputValue, masterUrl, saveToLocal, callRedeemApi]);

  const handleDeleteHistory = useCallback((id: string) => {
    const newHistory = history.filter(h => h.id !== id);
    saveToLocal(newHistory);
  }, [history, saveToLocal]);

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
    handleRedeem,
    handleDeleteHistory,
    handleClearAll
  };
};
