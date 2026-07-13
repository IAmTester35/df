import React from "react";
import { AlertCircle, RefreshCw, Clock } from "lucide-react";
import BaseRedeemTable from "./BaseRedeemTable";
import type { RedeemHistory } from "../lib/redeemHelpers";

interface PendingRedeemTableProps {
  pending: RedeemHistory[];
  onDelete: (id: string) => void;
  onRetry: () => void;
  isSyncing: boolean;
}

const PendingRedeemTable: React.FC<PendingRedeemTableProps> = ({
  pending,
  onDelete,
  onRetry,
  isSyncing
}) => {
  return (
    <BaseRedeemTable
      title="Mã đang chờ xử lý (Lỗi Server Garena)"
      icon={<AlertCircle size={18} />}
      items={pending}
      onDelete={onDelete}
      variant="amber"
      hideIfEmpty={true}
      headerRightContent={
        <button
          onClick={onRetry}
          disabled={isSyncing}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <RefreshCw size={16} className={`${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
          Thử lại tất cả ({pending.length})
        </button>
      }
      renderStatus={(item) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-amber-400/80">
          <Clock size={12} />
          {item.message}
        </span>
      )}
    />
  );
};

export default React.memo(PendingRedeemTable);
