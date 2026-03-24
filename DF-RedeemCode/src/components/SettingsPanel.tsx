import React from "react";
import { Link } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getParams } from "../lib/utils";
import { DEFAULT_MASTER_URL } from "../lib/constants";

interface SettingsPanelProps {
  showSettings: boolean;
  masterUrl: string;
  saveMasterUrl: (url: string) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  showSettings, 
  masterUrl, 
  saveMasterUrl 
}) => {
  return (
    <AnimatePresence>
      {showSettings && (
        <motion.section 
          initial={{ opacity: 0, height: 0 }} 
          animate={{ opacity: 1, height: 'auto' }} 
          exit={{ opacity: 0, height: 0 }} 
          className="flex justify-center overflow-hidden"
        >
          <div className="nordic-card w-full max-w-2xl space-y-4">
            <div className="flex items-center gap-2 text-blue-400">
              <Link size={18} />
              <h3 className="font-bold text-white">Cấu hình Master URL</h3>
            </div>
            <div className="space-y-2">
              <textarea 
                value={masterUrl} 
                onChange={(e) => saveMasterUrl(e.target.value)} 
                className="w-full bg-slate-950/50 border border-white/10 rounded-xl p-3 text-xs font-mono text-blue-100/70 outline-none h-24" 
                placeholder="Dán URL RedeemCDKey tại đây..." 
              />
              <div className="flex justify-between items-center text-[10px] text-slate-500">
                <span>Trạng thái: {getParams(masterUrl).openid ? "✅ Hợp lệ" : "❌ URL thiếu OpenID/Token"}</span>
                <button 
                  onClick={() => saveMasterUrl(DEFAULT_MASTER_URL)} 
                  className="hover:text-white"
                >
                  Khôi phục mặc định
                </button>
              </div>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
};

export default SettingsPanel;
