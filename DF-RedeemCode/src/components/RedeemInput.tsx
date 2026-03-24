import React from "react";
import { Zap, RefreshCw } from "lucide-react";
import { motion } from "motion/react";

interface RedeemInputProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  isSyncing: boolean;
  hasNewCodes: boolean;
  handleSync: () => void;
  handleRedeem: () => void;
}

const RedeemInput: React.FC<RedeemInputProps> = ({ 
  inputValue, 
  setInputValue, 
  isSyncing, 
  hasNewCodes, 
  handleSync, 
  handleRedeem 
}) => {
  return (
    <section className="flex justify-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="nordic-card w-full max-w-2xl text-center space-y-6 bg-slate-900/40! border-blue-500/10!"
      >
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-white">Nhập hàng loạt mã</h2>
          <p className="text-slate-400 text-sm">Mỗi dòng 1 mã CDKey. Hệ thống tự động lọc trùng và delay 300ms.</p>
        </div>
        <div className={`flex flex-col gap-3 p-4 bg-white/5 rounded-2xl border transition-colors ${
          hasNewCodes ? 'border-orange-500/50 shadow-lg shadow-orange-500/10' : 'border-white/10 focus-within:border-blue-400/30'
        }`}>
          <textarea 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
            placeholder="Dán danh sách mã vào đây (Mỗi mã 1 dòng)..." 
            className="w-full bg-transparent px-2 py-2 outline-none font-mono text-sm text-white min-h-[120px] resize-y" 
          />
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-white/5">
            <div className="flex-1 flex items-center px-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                {inputValue.trim() ? `${inputValue.trim().split('\n').filter(l => l.trim()).length} mã mới` : "Bảng nhập liệu"}
              </span>
            </div>
            <button 
              onClick={handleSync} 
              disabled={isSyncing} 
              className={`btn-nordic-glass py-2! px-4! transition-all ${
                hasNewCodes ? 'bg-orange-500/30 text-orange-400 border-orange-500/50 shadow-lg shadow-orange-500/10' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
              <span className="text-xs">{isSyncing ? "Đang đồng bộ..." : "Đồng bộ Server"}</span>
              {hasNewCodes && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full animate-pulse shadow-sm border border-slate-900" />}
            </button>
            <button 
              onClick={handleRedeem} 
              disabled={isSyncing || !inputValue.trim()} 
              className={`btn-nordic-primary py-2! px-6! ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Zap size={18} className="fill-white" />
              <span>{isSyncing ? "Đang chờ..." : "Bắt đầu nhập"}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default RedeemInput;
