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
  LOCAL_SYNC_TIME_KEY,
  LOCAL_PENDING_KEY
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

const showInstructions = () => {
  const isMac = /Mac|iPhone|iPod|iPad/.test(navigator.userAgent);
  const shortcut = isMac ? "Cmd + Opt + I" : "F12 hoặc Ctrl + Shift + I";

  Swal.fire({
    title: 'Hướng dẫn lấy Master URL',
    html: `
      <div style="text-align: left; font-size: 0.9em; line-height: 1.5;">
        <ol style="padding-left: 20px;">
          <li style="margin-bottom: 8px;">1. Truy cập <a href="https://redeem.df.garena.sg/vi/cdkgarena.html" target="_blank" style="color: #3b82f6; text-decoration: underline;">trang nạp code Garena</a></li>
          <li style="margin-bottom: 8px;">2. Đăng nhập tài khoản Garena của bạn</li>
          <li style="margin-bottom: 8px;">3. Nhấn <b>${shortcut}</b> để mở DevTools, chọn tab <b>Network</b></li>
          <li style="margin-bottom: 8px;">4. Nhập đại 1 mã (VD: <code>123</code>) rồi nhấn nút <b>"Đổi"</b></li>
          <li style="margin-bottom: 8px;">5. Trong tab Network, tìm request có chứa <code>cdkey=123</code></li>
          <li style="margin-bottom: 8px;">6. Chuột phải vào request đó chọn <b>Copy</b> &gt; <b>Copy link address</b></li>
          <li style="margin-bottom: 8px;">7. Quay lại đây, nhấn vào <b>Setting</b> (biểu tượng bánh răng)</li>
          <li style="margin-bottom: 8px;">8. Dán URL vừa copy vào ô <b>Master URL</b></li>
        </ol>
      </div>
    `,
    confirmButtonText: 'Đã hiểu',
    width: '1000px'
  });
};

const showExpiredAlert = () => {
  Swal.fire({
    icon: 'error',
    title: 'Master URL hết hạn',
    text: 'Master URL đã hết hạn, vui lòng cập nhật URL mới!',
    showCancelButton: true,
    confirmButtonText: 'Làm mới',
    cancelButtonText: 'Đóng',
    confirmButtonColor: '#3b82f6',
  }).then((result) => {
    if (result.isConfirmed) {
      showInstructions();
    }
  });
};

export const useRedeem = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userMeta, setUserMeta] = useState<UserMeta>({ lastSync: 0 });
  const [inputValue, setInputValue] = useState("");
  const [history, setHistory] = useState<RedeemHistory[]>([]);
  const [pending, setPending] = useState<RedeemHistory[]>([]);
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

      const storedPending = localStorage.getItem(LOCAL_PENDING_KEY);
      if (storedPending) setPending(JSON.parse(storedPending));
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

  const callRedeemBatch = useCallback(async (cdkeys: string[], config: Record<string, unknown>, signal: AbortSignal) => {
    try {
      const workerUrl = import.meta.env.VITE_WORKER_URL;
      if (!workerUrl) throw new Error("VITE_WORKER_URL is not configured");

      const response = await fetch(workerUrl, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json", "Referer": "https://redeem.df.garena.sg/" },
        signal,
        body: JSON.stringify({
          masterUrl,
          cdkeys,
          lang_type: config.lang_type,
          role_info: { game_id: config.game_id }
        })
      });

      const data = await response.json();
      if (!data.codes) {
        throw new Error(data.message || "Invalid batch response from proxy");
      }

      return data.codes.map((item: any) => {
        const result = item.original;
        const expired = Number(result.code) === 300001;
        const statusDigit = result.code === 0 ? 0 : (Number(result.code) === 400067 ? 1 : 2);

        let displayMsg = result.msg || result.message;
        if (result.code === -2) {
          displayMsg = `Garena Server Error: ${displayMsg}`;
        } else if (!displayMsg) {
          displayMsg = statusDigit === 0 ? 'Thành công' : `Lỗi ${result.code}`;
        }

        return {
          cdkey: item.cdkey,
          expired,
          isServerError: result.code === -2,
          status: (statusDigit === 0 ? 'success' : 'failure') as 'success' | 'failure',
          message: displayMsg
        };
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      throw err;
    }
  }, [masterUrl]);

  const saveToLocal = useCallback((newHistory: RedeemHistory[], newPending?: RedeemHistory[]) => {
    const maxTs = Math.max(0, ...newHistory.map(h => Math.floor(h.timestamp / 1000)));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newHistory));
    localStorage.setItem(LOCAL_SYNC_TIME_KEY, maxTs.toString());
    setHistory(newHistory.sort((a, b) => b.timestamp - a.timestamp));
    setUserMeta(prev => ({ ...prev, lastSync: maxTs }));
    setHasNewCodes(false);

    if (newPending) {
      setPending(newPending);
      localStorage.setItem(LOCAL_PENDING_KEY, JSON.stringify(newPending));
    }

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
      const codesToRedeem: string[] = [];
      const codeMetadata: Record<string, { ts: number, safeKey: string }> = {};

      for (const [safeKey, val] of entries) {
        const value = val as number;
        const ts = Math.floor(value / 10);
        const statusDigit = value % 10;
        const cdkey = unescapeFirebaseKey(safeKey);
        const upperCdKey = cdkey.toUpperCase();

        if (ts > maxTsInBatch) maxTsInBatch = ts;

        if (!localKeys.has(upperCdKey) && (statusDigit === 0 || statusDigit === 1)) {
          if (config.openid) {
            codesToRedeem.push(cdkey);
            codeMetadata[cdkey] = { ts, safeKey };
          } else {
            // No config, just add to history
            newHistoryEntries.push({
              id: `v-${safeKey}`,
              cdkey,
              status: 'success',
              message: statusDigit === 0 ? 'Thành công (Đồng bộ)' : 'Có thể sử dụng (Đồng bộ)',
              timestamp: ts * 1000
            });
            localKeys.add(upperCdKey);
            addedCount++;
          }
        }
      }

      let batchResults: any[] = [];
      if (codesToRedeem.length > 0) {
        batchResults = await callRedeemBatch(codesToRedeem, config, controller.signal);
        for (const res of batchResults) {
          if (res.expired) {
            showExpiredAlert();
            saveToLocal(newHistoryEntries);
            setIsSyncing(false);
            return;
          }

          const meta = codeMetadata[res.cdkey];
          if (res.isServerError) {
            syncSummary.push({ cdkey: res.cdkey, status: 'failure', msg: res.message });
            continue; // Don't save to history if it's a server error
          }
          
          syncSummary.push({ cdkey: res.cdkey, status: res.status, msg: res.message });
          newHistoryEntries.push({
            id: `v-${meta.safeKey}`,
            cdkey: res.cdkey,
            status: res.status,
            message: res.message,
            timestamp: meta.ts * 1000
          });
          addedCount++;
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

      // Collect pending from sync results
      const newPending = [...pending];
      batchResults.forEach((res: any) => {
        if (res.isServerError && !newPending.some(p => p.cdkey === res.cdkey)) {
          newPending.push({
            id: `p-${res.cdkey}-${Date.now()}`,
            cdkey: res.cdkey,
            status: 'failure',
            message: res.message,
            timestamp: Date.now()
          });
        }
      });

      saveToLocal(newHistoryEntries, newPending);
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
  }, [history, isSyncing, masterUrl, userMeta.lastSync, saveToLocal, user, callRedeemBatch]);

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

      let batchResults: any[] = [];
      if (codesToRun.length > 0) {
        batchResults = await callRedeemBatch(codesToRun, config, controller.signal);
        const nowTs = Math.floor(Date.now() / 1000);
        const serverErrorCodes: string[] = [];

        for (const res of batchResults) {
          if (res.expired) {
            showExpiredAlert();
            saveToLocal([...newEntries, ...history]);
            setIsSyncing(false);
            return;
          }

          if (res.isServerError) {
            serverErrorCodes.push(res.cdkey);
            summary.push({ cdkey: res.cdkey, msg: res.message, status: 'failure' });
            continue; // Skip saving to history
          }

          const newItem: RedeemHistory = {
            id: `local-${escapeFirebaseKey(res.cdkey)}-${nowTs}`,
            cdkey: res.cdkey,
            status: res.status,
            message: res.message,
            timestamp: nowTs * 1000
          };
          newEntries.unshift(newItem);
          summary.push({ cdkey: res.cdkey, msg: res.message, status: res.status });
        }

        // Keep server errors in input for retry
        if (serverErrorCodes.length > 0) {
          setInputValue(serverErrorCodes.join("\n"));
        } else {
          setInputValue("");
        }
      }

      // Add skipped codes to summary
      skippedCodes.forEach(c => {
        summary.push({ cdkey: c, msg: 'Đã nạp code này', status: 'skipped' });
      });

      // Collect pending from redeem results
      const newPending = [...pending];
      if (codesToRun.length > 0) {
        for (const res of batchResults) {
          if (res.isServerError && !newPending.some(p => p.cdkey === res.cdkey)) {
            newPending.push({
              id: `p-${res.cdkey}-${Date.now()}`,
              cdkey: res.cdkey,
              status: 'failure',
              message: res.message,
              timestamp: Date.now()
            });
          }
        }
      }

      saveToLocal([...newEntries, ...history], newPending);
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
  }, [history, inputValue, masterUrl, saveToLocal, callRedeemBatch]);

  const handleDeleteHistory = useCallback((id: string) => {
    const newHistory = history.filter(h => h.id !== id);
    saveToLocal(newHistory);
  }, [history, saveToLocal]);

  const handleDeletePending = useCallback((id: string) => {
    const newPending = pending.filter(h => h.id !== id);
    setPending(newPending);
    localStorage.setItem(LOCAL_PENDING_KEY, JSON.stringify(newPending));
  }, [pending]);

  const handleRetryPending = useCallback(async () => {
    if (pending.length === 0 || isSyncing) return;
    const codes = pending.map(p => p.cdkey);
    
    // Clear pending first to avoid duplicates, handleRedeem will add them back if they fail again
    const oldPending = [...pending];
    setPending([]);
    localStorage.removeItem(LOCAL_PENDING_KEY);

    setInputValue(codes.join("\n"));
    // We delay slightly to let state update if needed, though handleRedeem uses current history
    setTimeout(() => {
      handleRedeem();
    }, 100);
  }, [pending, isSyncing, handleRedeem]);

  return {
    user,
    userMeta,
    inputValue,
    setInputValue,
    history,
    pending,
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
    handleRetryPending,
    handleDeletePending,
    handleDeleteHistory,
    handleClearAll
  };
};
