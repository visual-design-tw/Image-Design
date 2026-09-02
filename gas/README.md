# GAS Backend

這一份是給目前 [index.html](</Users/james/Documents/Image Design/index.html>) 對接用的 Google Apps Script 後端。

## 會建立的工作表

- `Config_Stages`
- `Users`
- `Teams`
- `Purchase_Items`
- `Assignments`
- `Assignment_Resources`
- `Assignment_Submissions`
- `Files`
- `Notifications`
- `Discussion_Comments`
- `Design_Service_Settings`
- `Design_Service_Orders`
- `Calendar_Events`
- `Work_Items`
- `Password_Reset_Tokens`
- `Auth_Sessions`
- `Shape_Print_Invites`
- `Activity_Logs`
- `Meta`

欄位命名已經直接對齊前端 `state` 結構，所以前端不用再做一層欄位轉換。

## 後端做了什麼

- `doGet(e)`
- `action=health`：檢查設定是否正常
- `action=bootstrap`：驗證 session 後，依角色回傳可查看的 `state`
- `action=heatmap`：驗證 session 後，回傳目前角色可查看的系統活動熱圖
  - `action=largeUploadPage`：開啟大檔穩定上傳頁
- `doPost(e)`
  - `action=setup`：建立工作表，可選 `seedDemo: true`
  - `action=login` / `registerLeader` / `registerMember` / `activatePending`
  - `action=createShapePrintInvite` / `listShapePrintInvites` / `revokeShapePrintInvite`：由形印組長或形印指導教師管理形印組員的一人一組註冊連結
  - `action=getShapePrintInvite` / `registerShapePrintMember`：驗證受邀連結並立即建立形印組員帳號
  - `action=joinStudentTeam` / `createStudentTeam`：讓既有形印組員保留原身分，同時加入或建立畢製小組
  - `action=saveState`：以 `stateRevision` 防止舊畫面覆蓋其他人的新資料
- `action=uploadFile`：接收瀏覽器直傳檔案，建立/續版繳交紀錄，並自動存到 `會審 / 小組` 資料夾
- `action=uploadAssignmentAsset`：接收公告作業直傳檔案，並自動存到 `會審 / 小組 / 公告作業 / 作業標題` 資料夾
- `action=reviewFile`：更新審核狀態並產生通知
  - `action=createCalendarEvent` / `updateCalendarEvent` / `deleteCalendarEvent`：管理形印組專用工作行事曆事件
  - `action=createWorkItem` / `updateWorkItem` / `deleteWorkItem`：由形印組長或形印指導教師建立、分配與刪除工作事項
  - `action=claimWorkItem`：由形印組員認養開放中的工作事項
  - `action=updateWorkItemProgress`：由負責組員更新開始／完成進度，管理者可重新開啟
  - `action=markNotificationsRead`
  - `action=clearNotifications`
  - `action=requestPasswordReset`：寄出密碼重設信
  - `action=previewPasswordReset`：驗證重設 token 是否有效
- `action=resetPassword`：更新使用者密碼
- `action=getActivityLogs`：讀取操作紀錄，僅限形印組長與形印組員

## 登入與同步安全

- 登入成功後，GAS 會簽發 12 小時有效的隨機 session token；試算表只保存 token 雜湊值，不保存原始 token。
- 登入驗證只讀取帳號與 session 資料；完整工作台資料與活動熱圖會在前端進入工作台後背景載入，避免大型工作表拖慢登入。
- 每個帳號最多保留 5 個有效 session；超出時最早的 session 會自動撤銷。
- 密碼重設後，該帳號所有既有 session 都會立即失效。
- 連續輸入錯誤密碼 5 次時，登入會暫時限制 10 分鐘。
- 新註冊與重設密碼至少需 8 碼；既有帳號可登入後再透過重設流程更新為新密碼。
- 所有資料讀取、寫入、上傳、審核與通知操作都會由後端 session 判斷登入身分，不採信前端傳來的 `userId`。
- 形印組長與組員可看完整工作資料；小組帳號只能取得自身小組、被指派的繳交項目與自己的通知。
- 工作行事曆事件只會回傳給形印組長與組員；一般小組帳號不會取得事件資料，也不能透過 API 建立、編輯或刪除事件。
- 工作事項只會回傳給形印組長、形印指導教師與形印組員；建立與分配限管理者，認養與進度更新限形印組員本人。
- 形印組員可透過一人一組、可設定期限且可撤銷的邀請連結註冊；帳號註冊後立即啟用，不需要等待審核。
- 形印組員日後若要參與畢製，可用同一帳號加入既有小組或建立小組成為組長；系統以 `Student_Role` 保存畢製身分，不會覆蓋形印組權限。
- 每一次 `saveState` 都必須帶回最後一次讀取到的 `stateRevision`。版本不一致時會回傳 `STATE_CONFLICT`，前端會重新載入雲端資料，而不會覆蓋他人的更新。

## 操作紀錄

- 系統會記錄重要的會審期數、預算／印刷品、繳交項目、檔案繳交、檔案審核、工作事項與帳號異動。
- 每筆紀錄包含操作時間、操作人、角色、動作、摘要與對象類型；不會寫入密碼或檔案內容。
- 操作紀錄不會放進一般 `bootstrap` 的前端 state。只有形印組長與形印組員帶著有效登入 session 才能讀取。
- 紀錄預設最多保留最近 `1,000` 筆，超過時會自動移除最舊資料。

## 背景自動催交

這版已加入 GAS 背景排程提醒：

- 不需要有人開著網站
- 由 GAS installable trigger 每小時自動掃描一次
- 針對「尚未繳交」的小組發送：
  - 站內通知
  - Email 催交提醒
- 預設提醒節點：
  - 截止前 `72` 小時
  - 截止前 `24` 小時
  - 截止前 `6` 小時
  - 截止後第一次掃描時補一封逾期提醒

提醒紀錄會寫進 `Meta.AssignmentReminderLog`，避免同一個節點重複寄送。

## 形印組工作行事曆

- `Calendar_Events` 只儲存形印組自行建立的會議、製作、審核、印刷與提醒排程。
- 繳交項目的截止時間會在前端自動顯示為紅色截止日，不會額外複製成可刪除的行事曆事件。
- 工作事項若有設定到期時間，會自動顯示在同一個形印組工作行事曆，點擊後可回到工作清單定位該事項。
- 行事曆事件的新增、編輯與刪除都走專用 API，並帶有 `stateRevision`，不會被其他頁面舊資料的 `saveState` 覆蓋。
- 刪除會審期數時，該會期下的形印組排程會一併移除。

## 形印組工作事項

- 形印組長與形印指導教師可以建立工作事項，選擇開放認養或直接指定目前啟用中的形印組員。
- 形印組員可以認養「待認養」事項；認養後會自動進入「進行中」，也可以更新為完成。
- 管理者可以編輯內容、重新分配、標記完成或重新開啟；刪除後會進入形印組專用回收桶。
- 認養、指派、完成與重新開啟會產生站內通知，並保留在形印組操作紀錄中。

## 部署步驟

1. 在 Apps Script 專案中放入 [Code.gs](</Users/james/Documents/Image Design/gas/Code.gs>)、[LargeUpload.html](</Users/james/Documents/Image Design/gas/LargeUpload.html>) 和 [appsscript.json](</Users/james/Documents/Image Design/gas/appsscript.json>)。
2. 建立一份 Google 試算表，記下 Spreadsheet ID。
3. 在 Google Drive 建立一個總資料夾，作為所有會審檔案的根目錄，記下 Folder ID。
4. 在 Apps Script 執行：

```javascript
saveScriptConfig('你的 Spreadsheet ID', '你的 Drive Root Folder ID', {
  frontendBaseUrl: '你的前端網址',
  mailSenderName: '畢展形印組管理系統',
  mailReplyTo: '你的回覆信箱@example.com',
  mailFromAlias: '',
  passwordResetExpiryMinutes: 30
});
setupSheets();
authorizeMailScope();
enableAssignmentReminderAutomation();
```

`frontendBaseUrl` 請填你實際開啟這個前端頁面的網址，例如：

- `https://你的網域/index.html`
- `http://127.0.0.1:5500/index.html`

目前這份部署預設使用 `MailApp` 寄信，所以支援 `mailSenderName`、`mailReplyTo`，但不啟用 `mailFromAlias`。如果 `MAIL_FROM_ALIAS` 有填值，重設密碼寄信會直接報錯。

5. 如果你要先用現在前端的假資料測試，再執行：

```javascript
seedDemoData();
```

6. 部署成 Web App。
   - Execute as: `Me`
   - Who has access: `Anyone`

   `Anyone` 只代表瀏覽器能呼叫 Web App；實際資料仍需通過本系統的帳密、session 與角色權限驗證。

7. 第一次完成授權後，請確認背景 trigger 已建立。
   你可以在 Apps Script 執行：

```javascript
listAssignmentReminderTriggers();
```

若要重裝 trigger，可執行：

```javascript
installAssignmentReminderTrigger();
```

若要暫停背景催交：

```javascript
disableAssignmentReminderAutomation();
```

## 請求範例

### 登入後讀取可用狀態

```text
GET https://script.google.com/macros/s/你的部署ID/exec?action=bootstrap&sessionToken=登入後取得的sessionToken
```

### 初始化工作表

```json
{
  "action": "setup",
  "seedDemo": true
}
```

### 上傳檔案紀錄並自動分類資料夾

```json
{
  "action": "uploadFile",
  "sessionToken": "登入後取得的sessionToken",
  "fileName": "主視覺海報_定案V2.pdf",
  "mimeType": "application/pdf",
  "fileSize": 1048576,
  "fileContentBase64": "JVBERi0xLjQKJ..."
}
```

### 建立工作事項

```json
{
  "action": "createWorkItem",
  "sessionToken": "登入後取得的sessionToken",
  "stateRevision": 12,
  "title": "整理第二次會審送印檔案",
  "description": "確認檔名、格式與出血設定。",
  "dueAt": "2026-09-01 18:00",
  "priority": "高",
  "stageId": "S01",
  "assignedToUserId": "U03"
}
```

### 認養工作事項

```json
{
  "action": "claimWorkItem",
  "sessionToken": "登入後取得的sessionToken",
  "stateRevision": 13,
  "workItemId": "WI01"
}
```

### 審核檔案

```json
{
  "action": "reviewFile",
  "sessionToken": "登入後取得的sessionToken",
  "fileId": "F02",
  "status": "退件",
  "comment": "請改為 CMYK 並確認出血線。"
}
```

### 申請重設密碼

```json
{
  "action": "requestPasswordReset",
  "email": "member@test.com"
}
```

### 驗證重設連結

```json
{
  "action": "previewPasswordReset",
  "token": "從信件連結帶進來的 token"
}
```

### 更新密碼

```json
{
  "action": "resetPassword",
  "token": "從信件連結帶進來的 token",
  "password": "new-password"
}
```

### 讀取操作紀錄（形印組限定）

```json
{
  "action": "getActivityLogs",
  "sessionToken": "登入後取得的sessionToken",
  "limit": 100
}
```

## 前端對接建議

前端如果要最少改動，先走這兩條就夠了：

- 登入成功後：保存回傳的 `sessionToken`
- 首次載入：帶著 `sessionToken` 呼叫 `GET action=bootstrap`
- 每次本地 state 有變更：呼叫 `POST action=saveState`，並帶上最近回傳的 `stateRevision`

如果要把一般檔案收件和公告作業都接到雲端，目前直接用：

- `POST action=uploadFile`
- `POST action=uploadAssignmentAsset`
- `GET action=largeUploadPage`：給 18 MB 以上的大檔改走穩定上傳頁

## 注意

- `uploadFile` / `uploadAssignmentAsset` 現在吃的是瀏覽器直傳的 base64 二進位內容，不再需要先貼 Google Drive 連結。
- 主頁目前維持單檔 `18 MB` 內直傳；超過 `18 MB` 時，前端會改開 `largeUploadPage`，由 GAS HTML Service 走分段上傳流程，支援到約 `2 GB`，實際仍受 Google Drive 與 Apps Script 配額限制。
- 公告作業的背景催交信目前會沿用作業上的 `Notify_By_Email` 設定；若該公告建立時有勾選寄送 Email，後續背景提醒也會一起寄出。
- 如果前端頁面目前是直接用 `file://` 開啟，之後真接 Web App API 時，建議改成放在靜態站或同樣由 GAS/網頁伺服器提供，避免瀏覽器跨來源限制。
- 密碼重設信的連結會依據 `FRONTEND_BASE_URL` 組成；若沒設定，`requestPasswordReset` 會直接報錯。
- 本次部署會自動建立 `Discussion_Comments` 與 `Auth_Sessions` 工作表；現有使用者的舊前端登入快取會失效，需重新登入一次。
