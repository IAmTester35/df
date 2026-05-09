import React, { type ReactNode } from "react";
import { Trash2, Cloud } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { RedeemHistory } from "../hooks/useRedeem";

interface BaseRedeemTableProps {
  title: string;
  icon: ReactNode;
  items: RedeemHistory[];
  onDelete: (id: string) => void;
  headerRightContent?: ReactNode;
  emptyMessage?: string;
  variant?: 'blue' | 'amber';
  renderStatus: (item: RedeemHistory) => ReactNode;
  hideIfEmpty?: boolean;
}

const BaseRedeemTable: React.FC<BaseRedeemTableProps> = ({
  title,
  icon,
  items,
  onDelete,
  headerRightContent,
  emptyMessage = "Chưa có dữ liệu",
  variant = 'blue',
  renderStatus,
  hideIfEmpty = false
}) => {
  if (hideIfEmpty && items.length === 0) return null;

  const themes = {
    blue: {
      titleText: "text-white",
      iconColor: "text-blue-400",
      cardBorder: "border-white/5",
      cardBg: "bg-white/5",
      headerBg: "bg-white/5",
      headerText: "text-slate-400",
      rowHover: "hover:bg-white/5",
      cdkeyText: "text-blue-100",
      timeText: "text-slate-500"
    },
    amber: {
      titleText: "text-amber-400",
      iconColor: "text-amber-400",
      cardBorder: "border-amber-500/30",
      cardBg: "bg-amber-500/5",
      headerBg: "bg-amber-500/10",
      headerText: "text-amber-400/70",
      rowHover: "hover:bg-amber-500/5",
      cdkeyText: "text-amber-100",
      timeText: "text-amber-400/50"
    }
  };

  const theme = themes[variant];

  return (
    <section className={`space-y-4 ${variant === 'amber' ? 'animate-in fade-in slide-in-from-top-4 duration-500' : ''}`}>
      <div className="flex items-center justify-between px-4">
        <h3 className={`font-bold text-lg flex items-center gap-2 ${theme.titleText}`}>
          <span className={theme.iconColor}>{icon}</span>
          {title}
        </h3>
        {headerRightContent}
      </div>

      <div className={`nordic-card p-0! overflow-hidden ${theme.cardBorder} ${theme.cardBg}!`}>
        <div className="overflow-x-auto overflow-y-hidden custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`border-b ${theme.cardBorder} ${theme.headerBg}`}>
                <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${theme.headerText}`}>Mã CDKey</th>
                <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${theme.headerText}`}>Trạng thái</th>
                <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${theme.headerText}`}>Thời gian</th>
                <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${theme.headerText} text-right font-bold`}>Hành động</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${theme.cardBorder}`}>
              <AnimatePresence>
                {items.length > 0 ? (
                  items.map((item) => (
                    <motion.tr
                      layout
                      key={item.id}
                      initial={{ opacity: 0, x: variant === 'amber' ? -20 : 0 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className={`${theme.rowHover} transition-colors`}
                    >
                      <td className={`px-6 py-4 font-mono font-medium ${theme.cdkeyText}`}>{item.cdkey}</td>
                      <td className="px-6 py-4">
                        {renderStatus(item)}
                      </td>
                      <td className={`px-6 py-4 text-xs italic ${theme.timeText}`}>
                        {variant === 'amber'
                          ? new Date(item.timestamp).toLocaleTimeString()
                          : new Date(item.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => onDelete(item.id)}
                          className={`p-2 transition-colors ${variant === 'amber' ? 'text-amber-400/50 hover:text-red-400' : 'text-slate-500 hover:text-red-400'}`}
                          title="Xoá"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <motion.tr
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-4 text-slate-500">
                        <Cloud size={48} strokeWidth={1} className="opacity-30" />
                        <p className="text-sm">{emptyMessage}</p>
                      </div>
                    </td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default React.memo(BaseRedeemTable);
