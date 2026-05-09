import React, { useEffect, useRef, useMemo } from "react";
import { Link, X, Check, AlertCircle, Fingerprint, Key, Globe, Activity } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getParams } from "../lib/utils";
import { DEFAULT_MASTER_URL } from "../lib/constants";

interface SettingsPanelProps {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  masterUrl: string;
  saveMasterUrl: (url: string) => void;
  handleClearAll: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  showSettings,
  setShowSettings,
  masterUrl,
  saveMasterUrl,
  handleClearAll
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSettings) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSettings, setShowSettings]);

  const params = useMemo(() => getParams(masterUrl), [masterUrl]);
  
  const importantParams = [
    { key: 'openid', label: 'User ID', icon: <Fingerprint size={12} />, color: 'blue' },
    { key: 'token', label: 'Access Token', icon: <Key size={12} />, color: 'purple' },
    { key: 'route', label: 'Redeem Route', icon: <Activity size={12} />, color: 'amber' },
    { key: 's_channel', label: 'Channel', icon: <Globe size={12} />, color: 'emerald' },
  ];

  return (
    <AnimatePresence>
      {showSettings && (
        <motion.section
          layout
          initial={{ opacity: 0, y: -20, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto', marginBottom: 32 }}
          exit={{ opacity: 0, y: -20, height: 0, marginBottom: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="flex justify-center overflow-hidden"
        >
          <div ref={panelRef} className="nordic-card w-full max-w-3xl space-y-4 relative">
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 text-blue-400">
              <Link size={18} />
              <h3 className="font-bold text-white">Cấu hình Master URL</h3>
            </div>
            <div className="space-y-2">
              <textarea
                value={masterUrl}
                onChange={(e) => saveMasterUrl(e.target.value)}
                className={`w-full bg-slate-950/50 backdrop-blur-[6px] border rounded-xl p-4 text-[11px] font-mono leading-relaxed transition-all h-32 outline-none focus:ring-2 ${
                  params.openid ? 'border-blue-500/30 text-blue-100/70 focus:ring-blue-500/20' : 'border-white/10 text-slate-500 focus:ring-white/10'
                }`}
                placeholder="Dán URL RedeemCDKey tại đây..."
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {importantParams.map((p) => {
                  const value = params[p.key];
                  const hasValue = !!value;
                  return (
                    <div 
                      key={p.key}
                      className={`flex flex-col gap-1 p-2 rounded-lg border transition-all ${
                        hasValue 
                        ? 'bg-white/5 border-white/10' 
                        : 'bg-transparent border-white/5 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {p.icon}
                        <span>{p.label}</span>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-[10px] font-mono truncate ${hasValue ? 'text-white' : 'text-slate-600'}`}>
                          {value || 'Thiếu'}
                        </span>
                        {hasValue ? (
                          <Check size={12} className="text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle size={12} className="text-red-400 shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center text-[10px]">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full font-bold ${params.openid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {params.openid ? 'URL HỢP LỆ' : 'URL THIẾU THÔNG TIN'}
                  </span>
                </div>
                <button
                  onClick={() => saveMasterUrl(DEFAULT_MASTER_URL)}
                  className="text-slate-500 hover:text-white transition-colors underline underline-offset-2"
                >
                  Khôi phục cấu hình mặc định
                </button>
              </div>
              <div className="pt-4 border-t border-white/5 flex justify-end">
                <button
                  onClick={handleClearAll}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg transition-colors border border-red-500/20"
                >
                  Xoá toàn bộ dữ liệu cục bộ
                </button>
              </div>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
};

export default React.memo(SettingsPanel);
