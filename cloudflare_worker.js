/**
 * Cloudflare Worker: Delta Force Auto-Redeem Proxy Gateway
 * Architecture: V6.0 - Zero-Config Centralized Proxy
 * 
 * Logic:
 * 1. Receive Redeem POST from Client (contains cdkey and masterUrl)
 * 2. Reconstruct the actual Garena target URL from masterUrl
 * 3. Forward to Garena Official API
 * 4. If Response is Success (0) or Limit (400067), forward to Google Apps Script (GAS)
 * 5. Return original Garena response to Client
 */

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept, Referer",
    };

    // 1. Handle Preflight Options (CORS)
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      const input = await request.json();
      const { masterUrl, cdkey, ...restBody } = input;

      if (!masterUrl || !cdkey) {
        throw new Error("Missing masterUrl or cdkey in request body");
      }

      // 2. Prepare Target Request (Zero-Config: Lấy target từ chính masterUrl client gửi lên)
      // Thay thế cdkey trong masterUrl để ra URL đích thực tế
      const targetUrl = masterUrl.replace(/cdkey=[^&]*/, `cdkey=${cdkey}`);
      
      const garenaResponse = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Referer": "https://redeem.df.garena.sg/",
          "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0",
        },
        body: JSON.stringify({ ...restBody, cdkey }), // Forward body clean
      });

      // 3. Clone or Buffer for double-reading (one for client, one for GAS logic)
      const responseBody = await garenaResponse.arrayBuffer();
      const bodyText = new TextDecoder().decode(responseBody);

      // 4. Background Sync to Google Apps Script (GAS)
      try {
        const result = JSON.parse(bodyText);
        let statusDigit = -1;
        if (result.code === 0) {
          statusDigit = 0;
        } else if (String(result.code) === "400067") {
          statusDigit = 1;
        }

        const GAS_URL = env.GAS_WEBHOOK_URL || "https://script.google.com/macros/s/AKfycbzKx5iFDII-yjbhTsCxFrWRUFff20aJJjBilVQn-B7n6c8RuIUWDo54_yY3VklYQQCV/exec";
        
        if (statusDigit !== -1) {
          const params = new URLSearchParams({
            cdkey: cdkey,
            status: String(statusDigit),
            timestamp: String(Math.floor(Date.now() / 1000))
          });
          const finalGasUrl = `${GAS_URL}${GAS_URL.includes("?") ? "&" : "?"}${params.toString()}`;

          ctx.waitUntil(
            fetch(finalGasUrl)
              .catch(e => console.error("GAS Webhook Error:", e))
          );
        }
      } catch (e) {
        // Just log the error, don't break the proxy flow
        console.warn("GAS logic fallback or non-JSON response:", e.message);
      }

      // 5. Determine HTTP Status based on Garena Code
      let finalStatus = garenaResponse.status;
      try {
        const result = JSON.parse(bodyText);
        // If Garena returned 200 but code is not 0, force a 400 to show as error in network tab
        if (result.code !== 0 && finalStatus === 200) {
          finalStatus = 400;
        }
      } catch (e) {}

      // 6. Return response to Frontend
      return new Response(responseBody, {
        status: finalStatus,
        headers: {
          ...corsHeaders,
          "Content-Type": garenaResponse.headers.get("Content-Type") || "application/json",
        },
      });

    } catch (err) {
      return new Response(JSON.stringify({ 
        code: -1, 
        message: "Proxy Error: " + err.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
