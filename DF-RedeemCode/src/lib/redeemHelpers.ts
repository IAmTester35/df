import Swal from "sweetalert2";

export interface UserMeta {
  lastSync: number;
  masterUrl?: string;
}

export interface RedeemHistory {
  id: string;
  cdkey: string;
  status: 'success' | 'failure';
  message: string;
  timestamp: number;
}

export interface RedeemBatchResult {
  cdkey: string;
  expired: boolean;
  isServerError: boolean;
  status: 'success' | 'failure';
  message: string;
}

export const showSummaryAlert = (
  results: { cdkey: string; status: 'success' | 'failure' | 'skipped'; msg: string }[],
  options: { title: string }
) => {
  let html = '<div style="text-align: left; max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 0.85em; padding: 12px; background: rgba(0,0,0,0.03); border-radius: 8px; border: 1px solid rgba(0,0,0,0.05);">';

  results.forEach(r => {
    if (r.status === 'success') {
      html += `<div style="color: #10b981; margin-bottom: 4px;">✅ ${r.cdkey}</div>`;
    } else if (r.status === 'failure') {
      html += `<div style="color: #ef4444; margin-bottom: 4px;">❌ ${r.cdkey}: ${r.msg}</div>`;
    } else if (r.status === 'skipped') {
      html += `<div style="color: #64748b; margin-bottom: 4px;">- ${r.cdkey}: Đã nạp code này</div>`;
    }
  });
  html += '</div>';

  const hasFailures = results.some(r => r.status === 'failure');

  Swal.fire({
    icon: hasFailures ? 'warning' : 'success',
    title: options.title,
    html: html,
    confirmButtonText: 'Đã hiểu',
    customClass: { htmlContainer: 'text-left' }
  });
};

const showInstructions = () => {
  const isMac = /Mac|iPhone|iPod|iPad/.test(navigator.userAgent);
  const shortcut = isMac ? "Cmd + Opt + I" : "F12 hoặc Ctrl + Shift + I";

  Swal.fire({
    title: 'Hướng dẫn lấy Master URL',
    html: `
      <div style="text-align: left; font-size: 0.9em; line-height: 1.5;">
        <ol style="padding-left: 20px;">
          <li style="margin-bottom: 8px;">1. Truy cập <a href="https://redeem.df.garena.sg/vi/cdkgarena.html" target="_blank" style="color: #3b82f6; text-decoration: underline;">trang nạp code Garena</a></li>
          <li style="margin-bottom: 8px;">2. Đăng nhập tài khoản Garena của bạn</li>
          <li style="margin-bottom: 8px;">3. Nhấn <b>${shortcut}</b> để mở DevTools, chọn tab <b>Network</b></li>
          <li style="margin-bottom: 8px;">4. Nhập đại 1 mã (VD: <code>123</code>) rồi nhấn nút <b>"Đổi"</b></li>
          <li style="margin-bottom: 8px;">5. Trong tab Network, tìm request có chứa <code>cdkey=123</code></li>
          <li style="margin-bottom: 8px;">6. Chuột phải vào request đó chọn <b>Copy</b> &gt; <b>Copy link address</b></li>
          <li style="margin-bottom: 8px;">7. Quay lại đây, nhấn vào <b>Setting</b> (biểu tượng bánh răng)</li>
          <li style="margin-bottom: 8px;">8. Dán URL vừa copy vào ô <b>Master URL</b></li>
        </ol>
      </div>
    `,
    confirmButtonText: 'Đã hiểu',
    width: '1000px'
  });
};

export const showExpiredAlert = () => {
  Swal.fire({
    icon: 'error',
    title: 'Master URL hết hạn',
    text: 'Master URL đã hết hạn, vui lòng cập nhật URL mới!',
    showCancelButton: true,
    confirmButtonText: 'Làm mới',
    cancelButtonText: 'Đóng',
    confirmButtonColor: '#3b82f6',
  }).then((result) => {
    if (result.isConfirmed) {
      showInstructions();
    }
  });
};

export const callRedeemBatch = async (
  cdkeys: string[],
  config: Record<string, unknown>,
  masterUrl: string,
  signal: AbortSignal,
  onProgress: (progress: { current: number; total: number; currentCdkey: string; remaining: string[] }) => void
): Promise<RedeemBatchResult[]> => {
  const results: RedeemBatchResult[] = [];
  const total = cdkeys.length;

  for (let i = 0; i < total; i++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const cdkey = cdkeys[i];
    onProgress({
      current: i + 1,
      total,
      currentCdkey: cdkey,
      remaining: cdkeys.slice(i + 1)
    });

    try {
      const workerUrl = import.meta.env.VITE_WORKER_URL;
      if (!workerUrl) throw new Error("VITE_WORKER_URL is not configured");

      const response = await fetch(workerUrl, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json", "Referer": "https://redeem.df.garena.sg/" },
        signal,
        body: JSON.stringify({
          masterUrl,
          cdkeys: [cdkey],
          lang_type: config.lang_type,
          role_info: { game_id: config.game_id }
        })
      });

      if (response.status === 429 || response.status >= 500) {
        throw new Error(`Worker returned HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.codes && data.codes.length > 0) {
        const item = data.codes[0];
        const result = item.original;
        const expired = Number(result.code) === 300001;
        const statusDigit = result.code === 0 ? 0 : (Number(result.code) === 400067 ? 1 : 2);

        let displayMsg = result.msg || result.message || '';
        const codeNum = Number(result.code);

        switch (codeNum) {
          case 400054:
            displayMsg = 'Code không hợp lệ hoặc sai';
            break;
          case 400067:
            displayMsg = 'Bạn đã nhập tối đa số Code cho phép của sự kiện này';
            break;
          case 400068:
            displayMsg = 'Code này đã hết lượt nhập trên toàn Server';
            break;
          case 400070:
            displayMsg = 'Code đã hết hạn sử dụng';
            break;
          case 400073:
            displayMsg = 'Code bị lỗi không thể xử lý';
            break;
          case 51:
            displayMsg = 'Hệ thống Garena đang quá tải, thử lại sau';
            break;
          case -2:
            displayMsg = `Lỗi Server Garena: ${displayMsg}`;
            break;
          case 0:
            displayMsg = 'Thành công';
            break;
          default:
            if (!displayMsg) {
              displayMsg = statusDigit === 0 ? 'Thành công' : `Lỗi chưa xác định (${result.code})`;
            }
            break;
        }

        results.push({
          cdkey: item.cdkey,
          expired,
          isServerError: result.code === -2,
          status: (statusDigit === 0 ? 'success' : 'failure') as 'success' | 'failure',
          message: displayMsg
        });

        if (expired) break;
      } else {
        throw new Error(data.message || "Invalid response from worker");
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      results.push({
        cdkey,
        expired: false,
        isServerError: true,
        status: 'failure',
        message: err instanceof Error ? err.message : "Connection failed"
      });
    }

    if (i < total - 1) {
      await new Promise(r => setTimeout(r, 250));
    }
  }

  return results;
};
