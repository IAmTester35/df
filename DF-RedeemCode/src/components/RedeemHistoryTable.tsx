import React from "react";
import { Database, CheckCircle2, XCircle, Cloud } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { RedeemHistory } from "../hooks/useRedeem";

interface RedeemHistoryTableProps {
  history: RedeemHistory[];
}

const RedeemHistoryTable: React.FC<RedeemHistoryTableProps> = ({ history }) => {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-4">
        <h3 className="font-bold text-lg flex items-center gap-2 text-white">
          <Database size={18} className="text-blue-400" />
          Lịch sử nạp mã (Cục bộ)
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
                {history.length > 0 ? (
                  history.map((item) => (
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-4 text-slate-500">
                        <Cloud size={48} strokeWidth={1} className="opacity-30" />
                        <p className="text-sm">Chưa có dữ liệu lịch sử cục bộ</p>
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
  );
};

export default RedeemHistoryTable;
