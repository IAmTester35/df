/* 
 * Google Apps Script (GAS) Webhook for Delta Force Auto-Redeem
 * Deployment: Deploy as a Web App (Accessible to: Anyone)
 * 
 * Logic:
 * 1. Receive success/limit data from Cloudflare Worker
 * 2. Update Firebase Realtime Database via REST API
 */

const FIREBASE_DB_URL = "https://delta-force-reedeem-code-default-rtdb.asia-southeast1.firebasedatabase.app";
// Lấy bí mật từ Script Properties (Project Settings > Script Properties)
const props = PropertiesService.getScriptProperties();
const FIREBASE_SECRET = props.getProperty('FIREBASE_SECRET'); 

function doGet(e) {
  try {
    const { cdkey, status, timestamp } = e.parameter;
    
    if (!cdkey || status === undefined) return response("Missing Data", 400);

    return processData(cdkey, parseInt(status), parseInt(timestamp));
  } catch (error) {
    return response(error.toString(), 500);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { cdkey, status, timestamp } = data;

    if (!cdkey || status === undefined) return response("Missing Data", 400);

    return processData(cdkey, status, timestamp);
  } catch (error) {
    return response(error.toString(), 500);
  }
}

function processData(cdkey, status, timestamp) {
  try {
    const safeKey = escapeFirebaseKey(cdkey);
    const value = timestamp * 10 + status;
    const url = `${FIREBASE_DB_URL}/c/${safeKey}.json?auth=${FIREBASE_SECRET}`;
    
    UrlFetchApp.fetch(url, {
      method: "PUT",
      contentType: "application/json",
      payload: JSON.stringify(value)
    });

    return response("Success", 200);
  } catch (error) {
    return response(error.toString(), 400);
  }
}

/**
 * Escapes CDKey để tương thích với Firebase Key Rule
 */
function escapeFirebaseKey(key) {
  if (!key) return "";
  return key
    .toString()
    .replace(/\./g, '%2E')
    .replace(/#/g, '%23')
    .replace(/\$/g, '%24')
    .replace(/\//g, '%2F')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D');
}

/**
 * Tạo phản hồi JSON
 */
function response(msg, code) {
  const result = { message: msg, status: code, timestamp: new Date().getTime() };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// Function Test
function testWrite() {
  const payload = {
    cdkey: "TEST-CODE-GAS-01",
    status: 0,
    timestamp: Math.floor(Date.now() / 1000)
  };
  const mockEvent = { postData: { contents: JSON.stringify(payload) } };
  console.log(doPost(mockEvent).getContent());
}
