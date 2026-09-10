const fs = require("fs");
if (fs.existsSync("success.json")) {
  try {
    const content = fs.readFileSync("success.json", "utf8");
    if (content.trim()) {
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        data.forEach((item) => {
          // Chuẩn hóa mã (trim và uppercase) để so sánh chính xác
          const code = (item.cdkey || item.code || "")
            .toString()
            .replace(/["\u200b\u200c\u200d\uFEFF]/g, "")
            .trim()
            .toUpperCase();

          console.log(code);
        });
      }
    }
  } catch (e) {}
}
