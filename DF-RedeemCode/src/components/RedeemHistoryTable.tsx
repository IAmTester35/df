import React from "react";
import { Database, CheckCircle2, XCircle } from "lucide-react";
import BaseRedeemTable from "./BaseRedeemTable";
import type { RedeemHistory } from "../lib/redeemHelpers";

interface RedeemHistoryTableProps {
  history: RedeemHistory[];
  onDelete: (id: string) => void;
}

const RedeemHistoryTable: React.FC<RedeemHistoryTableProps> = ({ history, onDelete }) => {
  return (
    <BaseRedeemTable
      title="Lịch sử nạp mã (Cục bộ)"
      icon={<Database size={18} />}
      items={history}
      onDelete={onDelete}
      variant="blue"
      defaultCollapsed={true}
      emptyMessage="Chưa có dữ liệu lịch sử cục bộ"
      renderStatus={(item) => (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${item.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}>
          {item.status === 'success' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
          {item.message}
        </span>
      )}
    />
  );
};

export default React.memo(RedeemHistoryTable);
