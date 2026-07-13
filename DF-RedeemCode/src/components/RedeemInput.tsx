import React from "react";
import { Zap, RefreshCw, AlertCircle } from "lucide-react";
import { m } from "motion/react";
import Swal from "sweetalert2";
import Tesseract from 'tesseract.js';
import type { RedeemHistory } from "../hooks/useRedeem";

interface RedeemInputProps {
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  isSyncing: boolean;
  hasNewCodes: boolean;
  handleSync: () => void;
  handleRedeem: () => void;
  history: RedeemHistory[];
  syncProgress: {
    current: number;
    total: number;
    currentCdkey: string;
    remaining: string[];
  } | null;
}

const showWarning = (cdkey: string) => {
  Swal.fire({
    icon: 'warning',
    title: 'Mã đã tồn tại',
    text: `Mã "${cdkey}" đã có trong lịch sử nạp của bạn.`,
    confirmButtonText: 'Đã hiểu',
    confirmButtonColor: '#3b82f6'
  });
};

const RedeemInput: React.FC<RedeemInputProps> = ({ 
  inputValue, 
  setInputValue, 
  isSyncing, 
  hasNewCodes, 
  handleSync, 
  handleRedeem,
  history,
  syncProgress
}) => {
  const [isExtracting, setIsExtracting] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    let imageBlob: Blob | null = null;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        imageBlob = items[i].getAsFile();
        break;
      }
    }

    if (!imageBlob) return;
    e.preventDefault();

    try {
      setIsExtracting(true);
      // Tesseract.js (v5+) requires worker for custom parameters
      const worker = await Tesseract.createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\n '
      });
      
      const { data: { text: tesseractText } } = await worker.recognize(imageBlob);
      await worker.terminate();

      const finalText = tesseractText?.trim();

      if (finalText) {
        const cleaned = finalText.split('\n').map((l: string) => l.trim()).filter(Boolean).join('\n');
        setInputValue(prev => prev ? `${prev}\n${cleaned}` : cleaned);
      }
    } catch (error: unknown) {
      console.error("OCR Error:", error);
      let errorMsg = 'Có lỗi xảy ra.';
      if (error instanceof Error) {
        errorMsg = error.message || errorMsg;
      }
      Swal.fire({
        icon: 'error',
        title: 'Lỗi trích xuất',
        text: errorMsg
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const lines = inputValue.split('\n');
  const historyCodes = new Set(history.map(h => h.cdkey.toUpperCase()));
  return (
    <section className="flex justify-center">
      <m.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="nordic-card w-full max-w-4xl text-center space-y-6"
      >
        <div className="space-y-2 relative">
          <h2 className="text-3xl font-bold text-white">Nhập hàng loạt mã</h2>
          <p className="text-slate-400 text-sm">Mỗi dòng 1 mã CDKey. Hỗ trợ <b>Paste ảnh</b> để tự động nhận diện chữ.</p>
          {isExtracting && (
            <div className="absolute right-0 top-0 flex items-center gap-2 text-blue-400 text-xs font-medium bg-blue-500/10 px-2 py-1 rounded-full border border-blue-500/20 animate-pulse">
              <RefreshCw size={12} className="animate-spin" />
              <span>Đang trích xuất ảnh...</span>
            </div>
          )}
        </div>
        <div className={`flex flex-col gap-3 p-4 bg-white/5 backdrop-blur-[6px] rounded-2xl border transition-colors ${
          hasNewCodes ? 'border-orange-500/50 shadow-lg shadow-orange-500/10' : 'border-white/10 focus-within:border-blue-400/30'
        }`}>
          <div className="relative w-full min-h-[240px] font-mono text-sm group">
            {/* Hidden Textarea for Input - Always on bottom but receives focus */}
            <textarea 
              ref={textareaRef}
              value={inputValue} 
              onScroll={handleScroll}
              onPaste={handlePaste}
              onChange={(e) => setInputValue(e.target.value)} 
              placeholder="Dán danh sách mã hoặc ảnh chứa mã vào đây..." 
              className="w-full bg-transparent pl-9 pr-2 py-2 outline-none font-mono text-sm text-transparent caret-white min-h-[240px] resize-y block focus:ring-0 relative z-0 break-all text-left" 
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

          {syncProgress && (
            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-left space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex justify-between items-center text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                <span>Đang xử lý: {syncProgress.currentCdkey}</span>
                <span>{syncProgress.current} / {syncProgress.total} ({Math.round((syncProgress.current / syncProgress.total) * 100)}%)</span>
              </div>
              
              <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                <m.div 
                  className="h-full bg-gradient-to-r from-blue-500 to-sky-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                  transition={{ duration: 0.15 }}
                />
              </div>
              
              {syncProgress.remaining.length > 0 && (
                <div className="text-[10px] text-slate-500 truncate font-mono">
                  Còn lại: {syncProgress.remaining.join(", ")}
                </div>
              )}
            </div>
          )}

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
      </m.div>
    </section>
  );
};

export default React.memo(RedeemInput);
