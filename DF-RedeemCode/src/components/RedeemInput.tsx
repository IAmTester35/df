import React from "react";
import { Zap, RefreshCw, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import Swal from "sweetalert2";
import type { RedeemHistory } from "../hooks/useRedeem";

interface RedeemInputProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  isSyncing: boolean;
  hasNewCodes: boolean;
  handleSync: () => void;
  handleRedeem: () => void;
  history: RedeemHistory[];
}

const RedeemInput: React.FC<RedeemInputProps> = ({ 
  inputValue, 
  setInputValue, 
  isSyncing, 
  hasNewCodes, 
  handleSync, 
  handleRedeem,
  history
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const showWarning = (cdkey: string) => {
    Swal.fire({
      icon: 'warning',
      title: 'Mã đã tồn tại',
      text: `Mã "${cdkey}" đã có trong lịch sử nạp của bạn.`,
      confirmButtonText: 'Đã hiểu',
      confirmButtonColor: '#3b82f6'
    });
  };

  const lines = inputValue.split('\n');
  const historyCodes = new Set(history.map(h => h.cdkey.toUpperCase()));
  return (
    <section className="flex justify-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="nordic-card w-full max-w-2xl text-center space-y-6"
      >
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-white">Nhập hàng loạt mã</h2>
          <p className="text-slate-400 text-sm">Mỗi dòng 1 mã CDKey. Hệ thống tự động lọc trùng và delay 300ms.</p>
        </div>
        <div className={`flex flex-col gap-3 p-4 bg-white/5 backdrop-blur-[6px] rounded-2xl border transition-colors ${
          hasNewCodes ? 'border-orange-500/50 shadow-lg shadow-orange-500/10' : 'border-white/10 focus-within:border-blue-400/30'
        }`}>
          <div className="relative w-full min-h-[120px] font-mono text-sm group">
            {/* Hidden Textarea for Input - Always on bottom but receives focus */}
            <textarea 
              ref={textareaRef}
              value={inputValue} 
              onScroll={handleScroll}
              onChange={(e) => setInputValue(e.target.value)} 
              placeholder="Dán danh sách mã vào đây (Mỗi mã 1 dòng)..." 
              className="w-full bg-transparent pl-9 pr-2 py-2 outline-none font-mono text-sm text-transparent caret-white min-h-[120px] resize-y block focus:ring-0 relative z-0 break-all text-left" 
            />

            {/* Rich Text Overlay - Always on top but passes through most events */}
            <div 
              ref={overlayRef}
              className="absolute inset-0 pl-9 pr-2 py-2 pointer-events-none overflow-hidden whitespace-pre-wrap break-all z-10 text-left"
              aria-hidden="true"
            >
              {lines.map((line, i) => {
                const trimmed = line.trim();
                const isDuplicate = trimmed !== "" && historyCodes.has(trimmed.toUpperCase());
                
                return (
                  <div key={i} className="min-h-5 relative leading-5">
                    {isDuplicate && (
                      <button
                        onClick={() => showWarning(trimmed)}
                        className="pointer-events-auto text-red-500 hover:text-red-400 transition-colors absolute -left-7 top-1/2 -translate-y-1/2"
                        title="Mã này đã có trong lịch sử"
                      >
                        <AlertCircle size={14} />
                      </button>
                    )}
                    <span className={isDuplicate 
                      ? "underline decoration-red-500/80 decoration-wavy underline-offset-4 text-red-400/90" 
                      : "text-white/90"
                    }>
                      {line || " "}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
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

export default React.memo(RedeemInput);
