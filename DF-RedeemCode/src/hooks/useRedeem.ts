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

import type {
  UserMeta,
  RedeemHistory,
  RedeemBatchResult,
} from "../lib/redeemHelpers";
import {
  showSummaryAlert,
  showExpiredAlert,
  callRedeemBatch as callRedeemBatchHelper
} from "../lib/redeemHelpers";

export const useRedeem = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userMeta, setUserMeta] = useState<UserMeta>({ lastSync: 0 });
  const [isInitializing, setIsInitializing] = useState(true);
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
    currentCdkey: string;
    remaining: string[];
  } | null>(null);
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
  const pendingRef = useRef(pending);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    userMetaRef.current = userMeta;
  }, [userMeta]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

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
    } finally {
      setIsInitializing(false);
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

            // Check if local is outdated compared to remote
            const localLastSync = Number(localStorage.getItem(LOCAL_SYNC_TIME_KEY) || 0);
            if (localLastSync < lastSync) {
              setHasNewCodes(true);
            }
          } else {
            const initialMeta: UserMeta = { lastSync: 0, masterUrl };
            await update(userRef, initialMeta as unknown as Record<string, unknown>);
            setUserMeta(initialMeta);
          }
        } catch (e) {
          console.error("User meta load error", e);
        } finally {
          setIsInitializing(false);
        }
      } else {
        signInAnonymously(auth).finally(() => {
          setIsInitializing(false);
        });
      }
    });
    return unsubscribeAuth;
  }, [masterUrl]);

  // DB listener
  useEffect(() => {
    const latestQuery = query(ref(db, 'c'), orderByValue(), limitToLast(1));
    const unsubscribeDb = onValue(latestQuery, (snapshot) => {
      let foundNew = false;
      snapshot.forEach((child) => {
        const val = child.val() as number;
        const ts = Math.floor(val / 10);

        if (ts > userMeta.lastSync) {
          foundNew = true;
        }
      });
      setHasNewCodes(foundNew);
    });
    return unsubscribeDb;
  }, [userMeta.lastSync]);

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
        if (user && !user.isAnonymous) {
          update(ref(db, `u/${user.uid}`), { lastSync: 0, s: null });
        }
        Swal.fire('Đã xoá!', 'Lịch sử đã được dọn sạch.', 'success');
      }
    });
  }, [user]);

  const callRedeemBatch = useCallback(async (cdkeys: string[], config: Record<string, unknown>, signal: AbortSignal): Promise<RedeemBatchResult[]> => {
    const results = await callRedeemBatchHelper(cdkeys, config, masterUrl, signal, setSyncProgress as any);
    setSyncProgress(null);
    return results;
  }, [masterUrl]);

  const saveToLocal = useCallback((newHistory: RedeemHistory[], newPending?: RedeemHistory[]) => {
    const historyMaxTs = newHistory.length > 0
      ? Math.max(...newHistory.map(h => Math.floor(h.timestamp / 1000)))
      : 0;
    const maxTs = Math.max(userMetaRef.current.lastSync, historyMaxTs);

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
    if (isSyncing || isInitializing) return;
    setIsSyncing(true);

    // Create new controller for this sync session
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const currentHistory = [...history];
      const localKeys = new Set(currentHistory.map(h => h.cdkey.toUpperCase()));
      let addedCount = 0;

      // Use localLastSync instead of remote to ensure we get all codes missing locally
      const localLastSync = Number(localStorage.getItem(LOCAL_SYNC_TIME_KEY) || 0);
      const remoteLastSync = userMeta.lastSync;

      let syncQuery;
      if (localLastSync === 0) {
        syncQuery = query(ref(db, 'c'), orderByValue());
      } else {
        syncQuery = query(ref(db, 'c'), orderByValue(), startAfter(localLastSync * 10 + 1));
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
      let maxProcessedTs = Math.max(localLastSync, remoteLastSync);

      const syncSummary: { cdkey: string; status: 'success' | 'failure'; msg: string }[] = [];
      const codesToRedeem: string[] = [];
      const codeMetadata: Record<string, { ts: number, safeKey: string }> = {};

      for (const [safeKey, val] of entries) {
        const value = val as number;
        const ts = Math.floor(value / 10);
        const statusDigit = value % 10;
        const cdkey = unescapeFirebaseKey(safeKey);
        const upperCdKey = cdkey.toUpperCase();

        const isDuplicate = localKeys.has(upperCdKey);
        const isExpired = statusDigit === 2;

        if (isDuplicate || isExpired) {
          if (ts > maxProcessedTs) maxProcessedTs = ts;
          continue;
        }

        // If this code was already processed by the user (ts <= remoteLastSync),
        // we just add it to history directly without redeeming it again
        if (ts <= remoteLastSync) {
          newHistoryEntries.push({
            id: `v-${safeKey}`,
            cdkey,
            status: statusDigit === 0 ? 'success' : 'failure',
            message: statusDigit === 0 ? 'Thành công (Đồng bộ)' : 'Đầy giới hạn (Đồng bộ)',
            timestamp: ts * 1000
          });
          localKeys.add(upperCdKey);
          addedCount++;
          if (ts > maxProcessedTs) maxProcessedTs = ts;
        } else {
          // This is a brand new code (ts > remoteLastSync) that hasn't been processed yet
          if (config.openid) {
            codesToRedeem.push(cdkey);
            codeMetadata[cdkey] = { ts, safeKey };
          } else {
            // No config, just add to history and update maxProcessedTs
            newHistoryEntries.push({
              id: `v-${safeKey}`,
              cdkey,
              status: statusDigit === 0 ? 'success' : 'failure',
              message: statusDigit === 0 ? 'Thành công (Đồng bộ)' : 'Đầy giới hạn (Đồng bộ)',
              timestamp: ts * 1000
            });
            localKeys.add(upperCdKey);
            addedCount++;
            if (ts > maxProcessedTs) maxProcessedTs = ts;
          }
        }
      }

      let batchResults: RedeemBatchResult[] = [];
      if (codesToRedeem.length > 0) {
        batchResults = await callRedeemBatch(codesToRedeem, config, controller.signal);
        for (const res of batchResults) {
          const meta = codeMetadata[res.cdkey];

          if (res.expired) {
            // Update lastSync up to this point before returning early
            if (maxProcessedTs > userMeta.lastSync) {
              localStorage.setItem(LOCAL_SYNC_TIME_KEY, maxProcessedTs.toString());
              setUserMeta(prev => ({ ...prev, lastSync: maxProcessedTs }));
              if (user && !user.isAnonymous) {
                update(ref(db, `u/${user.uid}`), { lastSync: maxProcessedTs, s: null });
              }
            }
            showExpiredAlert();
            saveToLocal(newHistoryEntries);
            setIsSyncing(false);
            return;
          }

          if (meta && meta.ts > maxProcessedTs) {
            maxProcessedTs = meta.ts;
          }

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

      // Update lastSync to the latest timestamp successfully processed in the batch
      if (maxProcessedTs > userMeta.lastSync) {
        localStorage.setItem(LOCAL_SYNC_TIME_KEY, maxProcessedTs.toString());
        setUserMeta(prev => ({ ...prev, lastSync: maxProcessedTs }));
        if (user && !user.isAnonymous) {
          update(ref(db, `u/${user.uid}`), { lastSync: maxProcessedTs, s: null });
        }
      }

      // Collect pending from sync results
      const newPending = [...pendingRef.current];
      batchResults.forEach((res: RedeemBatchResult) => {
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
  }, [history, isSyncing, isInitializing, masterUrl, userMeta.lastSync, saveToLocal, user, callRedeemBatch]);

  const handleRedeem = useCallback(async (customCodes?: string[]) => {
    const uniqueCodes = Array.isArray(customCodes) ? customCodes : (inputValue.trim() ? parseInputCodes(inputValue) : []);
    if (uniqueCodes.length === 0) return;

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

      let batchResults: RedeemBatchResult[] = [];
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

        // Keep server errors in input for retry if not customCodes
        if (!Array.isArray(customCodes)) {
          if (serverErrorCodes.length > 0) {
            setInputValue(serverErrorCodes.join("\n"));
          } else {
            setInputValue("");
          }
        }
      }

      // Add skipped codes to summary
      skippedCodes.forEach(c => {
        summary.push({ cdkey: c, msg: 'Đã nạp code này', status: 'skipped' });
      });

      // Collect pending from redeem results
      const newPending = [...pendingRef.current];
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
    const newPending = pendingRef.current.filter(h => h.id !== id);
    setPending(newPending);
    localStorage.setItem(LOCAL_PENDING_KEY, JSON.stringify(newPending));
  }, []);

  const handleRetryPending = useCallback(async () => {
    const currentPending = pendingRef.current;
    if (currentPending.length === 0 || isSyncing) return;
    const codes = currentPending.map(p => p.cdkey);

    // Clear pending first to avoid duplicates, handleRedeem will add them back if they fail again
    setPending([]);
    localStorage.removeItem(LOCAL_PENDING_KEY);

    await handleRedeem(codes);
  }, [isSyncing, handleRedeem]);

  return {
    user,
    userMeta,
    isInitializing,
    inputValue,
    setInputValue,
    history,
    pending,
    hasNewCodes,
    isSyncing,
    syncProgress,
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
