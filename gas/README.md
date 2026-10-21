# GAS Backend

## 2026.10.21-preview.1 圖片預覽修正

- 新增唯讀 POST `getFilePreview`，只接受紀錄種類與紀錄 ID；依登入身分及原有小組／項目權限，從伺服器紀錄解析 Drive ID，不採信客戶端傳來的檔案 ID 或 URL。
- 確認檔案仍在系統根資料夾且未在垃圾桶後，讀取 6 MiB 以內的點陣原圖；較大圖片、SVG 等改用 Drive 預覽圖，預覽圖上限 2 MiB。缺少預覽圖或格式不支援會回傳可理解的說明，不自動公開檔案。
- 前端以經過身分、紀錄、檔案 ID、MIME 與大小核對的內容建立暫存圖片，不再使用 Drive `uc?export=view` 直連；載入失敗可明確重試，舊雲端服務會提示尚未更新。
- 關閉、切換版本、切換身分、登出與登入逾期會清除圖片及暫存 URL；關閉後的延遲回應不得重新顯示圖片。內容不加入一般 state、localStorage 或 sessionStorage，也不透過 URL 傳遞 session token。
- PDF 與其他文件仍使用 Google Drive 檢視器，另提供權限／格式限制說明及安全的新分頁入口，不宣稱所有格式均可在站內直接預覽。
- 需一起發布 `index.html` 與 `gas/Code.gs` 才會生效，不增加 scopes、工作表欄位或分享權限。這一節不代表新版已部署，正式狀態以發布紀錄為準。

## 2026.10.21-upload-comments.1 大檔完成與多人留言

- 分段上傳最後一段與有效工作階段的完成重試統一回傳 `complete: true`；處理結果仍須包含 Drive 檔案資料與作業附件憑證，不以位元組進度代替歸檔確認。
- 同一有效工作階段重新開始時先核對帳號、檔案與目標內容，重用現有傳輸或完成結果，不直接另建上傳。最後歸檔與完成快取放在同一鎖內，避免逾時重試重複新增版本。快取有既有有效期限，並非永久的上傳收據保存。
- 獨立 HTML 與 GAS 備援上傳頁均接受經完整資料檢查的舊成功回應及新完成回應；統一超過 18 MB 分段、最高 2 GB 的說明。僅有進度、缺少附件憑證或工作階段不符都不通知主頁成功。
- 新增 POST `postDiscussionComment`。在既有 Script Lock 內直接讀取最新 Sheets、逐則追加留言與站內通知、寫入後再直接讀回確認；不接受客戶端整頁狀態作為留言來源，不要求其他作者的舊 `stateRevision` 與目前完全相同。
- 留言識別碼綁定登入使用者與前端 request ID，相同內容重試只回傳前次結果，不重建留言或站內通知。角色、作者、團隊與系統留言類型由伺服器決定；一般學生只能對自己的檔案群組或適用項目留言。
- 留言介面送出時鎖定按鈕並顯示單一等待動畫，確認成功才清空文字。失敗、重新繪製或重新整理時保留這個帳號與工作位置的草稿；不把未確認留言混入一般整頁儲存。
- 需一起發布 `index.html`、`large-upload.html`、`gas/Code.gs` 與 `gas/LargeUpload.html`。不增加工作表欄位、OAuth scopes、帳號、通知排程或資料遷移。新版前端遇到尚未更新的雲端留言 API 會保留文字並提示管理者更新，不會退回整頁覆寫。
- 本節描述程式修正；部署狀態以發布紀錄及正式版本讀回為準。發布後仍需用合成檔案重新驗收大檔及兩帳號實際留言，不能以隔離測試代替正式操作驗收。

## 2026.10.17-stage-delete.1 會審刪除確認

- 會審刪除前先以 POST `bootstrap` 加上 `fresh: true`、`includeHeatmap: false` 取得最新快照；舊快照未成功套用時，不宣稱已重新載入，也不刪除。
- `fresh: true` 在 script lock 內，以 Sheets API `values:batchGet` 一次讀取全部狀態資料表，避開 Script Cache 與 SpreadsheetApp 讀取快取。一般首頁載入仍維持既有快取策略。
- `deleteStage` 在既有鎖內直接檢查最新資料及 `stateRevision`，提交後直接讀回；保留角色、活躍會審及至少一個會審的保護。禁止用舊快取或本機狀態作為失敗備援。
- 前端比較這一期與其關聯資料的內容，不因其他會審更新而反覆要求確認；真正的內容變更及提交期間的版本衝突，仍須使用者重新確認，不會自動重送刪除。
- 列出項目附件、行事曆、工作事項、代做案件與會審通知／留言，並說明移至回收桶後可在 30 天內復原。手機視窗可捲動，底部操作列固定，提示不覆蓋確認按鈕。
- 未儲存修改、其他進行中的操作、斷線與過期登入都會先停止刪除；逾時重試先查雲端，已刪除的會審不再次送出刪除。

## 2026.10.17-reset.1 儲存服務與重設密碼修復

- `appsscript.json` 明確啟用 Sheets v4 進階服務，OAuth scopes 與 Web App 的存取設定不變。預設 Google Cloud 專案會在加入進階服務時自動啟用對應 API；若改用標準 Cloud 專案，仍須另外啟用 Sheets API。不要只同步 `Code.gs` 而漏掉 manifest。
- 以 `health&checkServices=1` 可唯讀檢查 Sheets API 是否可讀與寄信額度是否可用；不讀取帳號內容、不寫入試算表、不寄信，也不回傳權杖。一般 `health` 不增加此項檢查。
- `diagnoseCloudServices_()` 亦可由編輯器執行相同檢查。診斷記錄只包含 HTTP 狀態、錯誤類別與布林結果，不記錄儲存內容或密碼重設連結。
- 保存失敗仍整批拒絕，不使用逐表寫入作為備援。服務未啟用、授權與配額問題各有可辨識的提示。
- 密碼重設紀錄必須先確認保存，才寄出重設信；前端會阻擋寄送中的重複操作，保留失敗時的信箱，並區分「未寄出」與「連線逾時、結果未確認」。
- `requestPasswordReset` 與 `previewPasswordReset` 明確視為公開驗證流程，不受過期的舊登入或未儲存工作台草稿阻擋；其他需要登入的操作仍維持原本限制。
- 官方依據：[啟用進階服務與預設 Cloud 專案的 API](https://developers.google.com/apps-script/guides/services/advanced)。服務健康檢查成功不代表實際郵件已送達，真實寄送與收件仍須另行確認。

## 2026.09.12-order.1 上線前必做

目前程式已修改並在本機隔離測試；不代表正式 Web App 已部署。

1. 先備份正式試算表與 Script Properties，並在另一份試算表、Drive 資料夾及測試 Web App 驗收。不要對正式環境執行 seedDemoData_。
2. 新版使用 Google Sheets REST API 的 batchUpdate，必須確認 Apps Script 所屬 Google Cloud 專案已啟用 **Google Sheets API**。既有 appsscript.json 已有 spreadsheets 與 script.external_request scopes；由部署帳號完成所需授權。不要退回「先清空再寫入」作為失敗備援。
3. 將新版 Code.gs 與 HTML 同步至測試環境，在 Apps Script 編輯器執行私有函式 migrateHealthRelease_。它先唯讀驗證 Sheets API，再補齊 Asset_Receipt 欄位、建立附件簽章密鑰、清除狀態快取並遷移既有提醒／清理觸發器。原本沒有提醒觸發器不會擅自啟用；需要時另外使用 enableAssignmentReminderAutomation_。
4. 維護函式名稱現在結尾均為底線。舊 runScheduledAssignmentReminders、runDeferredDriveTrashQueue 觸發器不能直接沿用；遷移後分別使用 runScheduledAssignmentReminders_、runDeferredDriveTrashQueue_。不要保留無授權的舊公開轉接函式。
5. 確認小檔與分段上傳都回傳 assetReceipt，繳交提交 Asset_Receipt。憑證綁定帳號、小組、項目、Drive 檔案與檔名，有效 48 小時；重送已確認的 requestId 不重複建立紀錄。ASSET_RECEIPT_SECRET 不可刪除或任意更換，否則舊附件會失去自動清理驗證。
6. 以至少兩個帳號測試儲存衝突、斷線重試、退件提醒、部分附件復原。確認前後端版本皆為 2026.09.12-order.1，再協調正式前後端一起更新，請使用者重新整理。舊分頁的未繳交附件可能需重新選檔，文字草稿應保留。
7. `Assignments` 會自動補上 `Display_Order` 欄位；部署後由 `setupSheets_()` 建立或補齊欄位。排序功能只接受形印組長與形印組員送出的完整項目清單，並以 `stateRevision` 防止舊頁面覆蓋新順序。

安全相容處理：

- 沒有憑證的舊繳交附件仍可查看，刪除項目時保留原檔，不自動送入 Drive 垃圾桶；不是把舊附件一律當作合法附件。新附件刪除／復原亦檢查回收桶紀錄與系統根資料夾。
- 部分復原會標記 restore_pending，已恢復的資料列不重複加入，只重試未成功的附件。此待處理紀錄不會因一般回收桶 30 天清理被移除。若檔案已永久刪除或移出系統資料夾，管理者須另行確認。
- 新提醒與公告逐收件人保存嘗試結果，單一提醒週期最多 3 次，不重寄已確認成功者。退件或更改截止時間會開啟新提醒週期。
- 舊提醒若全部成功，不因新版鍵值重寄；全部失敗可重試。舊紀錄若只有部分成功總數、沒有個別結果，保留 needsReview／unknown_legacy，由管理者核對，不盲目重寄。
- MailApp 和 Sheets 無跨服務交易。寄信實際完成但執行中斷、或確認紀錄寫入失敗時，仍可能再次寄送；本版本不宣稱 Email exactly-once。
- API 批次提交前失敗不清空原資料；傳輸中斷無法確定提交結果時先失效快取，要求重新確認。直接人工編輯試算表不受應用程式鎖保護，不可與正式站同時改寫同一批資料。

批次提交的原子性與範圍清理規則依據 Google 官方文件：
[batchUpdate](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate)、
[UpdateCellsRequest](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/request#UpdateCellsRequest)。

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
  - `action=reorderAssignments`：由形印組管理者以長按拖動後儲存繳交項目順序
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
saveScriptConfig_('你的 Spreadsheet ID', '你的 Drive Root Folder ID', {
  frontendBaseUrl: '你的前端網址',
  mailSenderName: '畢展形印組管理系統',
  mailReplyTo: '你的回覆信箱@example.com',
  mailFromAlias: '',
  passwordResetExpiryMinutes: 30
});
initializeDataSheets_();
authorizeMailScope_();
enableAssignmentReminderAutomation_();
```

`frontendBaseUrl` 請填你實際開啟這個前端頁面的網址，例如：

- `https://你的網域/index.html`
- `http://127.0.0.1:5500/index.html`

目前這份部署預設使用 `MailApp` 寄信，所以支援 `mailSenderName`、`mailReplyTo`，但不啟用 `mailFromAlias`。如果 `MAIL_FROM_ALIAS` 有填值，重設密碼寄信會直接報錯。

5. 如果你要先用現在前端的假資料測試，再執行：

```javascript
seedDemoData_();
```

6. 部署成 Web App。
   - Execute as: `Me`
   - Who has access: `Anyone`

   `Anyone` 只代表瀏覽器能呼叫 Web App；實際資料仍需通過本系統的帳密、session 與角色權限驗證。

7. 第一次完成授權後，請確認背景 trigger 已建立。
   你可以在 Apps Script 執行：

```javascript
listAssignmentReminderTriggers_();
```

若要重裝 trigger，可執行：

```javascript
installAssignmentReminderTrigger_();
```

若要暫停背景催交：

```javascript
disableAssignmentReminderAutomation_();
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

## 規範簡報預覽（2026.10.17-slides.1）

- 新增繳交項目時可填「規範簡報連結」，接受 Google Slides 的分享、發布或嵌入網址，不接受 HTML 程式碼。
- `Assignments` 工作表會在原欄位後新增 `Guide_URL`，舊資料保持空白，不會更動現有欄位順序。
- 已發布項目的連結由 `POST action=updateAssignmentGuide` 更新，參數為 `assignmentId`、`guideUrl`、`stateRevision` 與登入 token；空白 `guideUrl` 表示只移除連結。
- 沿用繳交項目管理權限（SuperAdmin、Admin）。一般學生只能閱讀自己適用項目的簡報；舊客戶端的 `saveState` 不會覆蓋既有簡報連結。
- 學生於繳交第一步按「查看規範」才載入 Google 預覽。Google 權限仍由提供者設定；系統不會自動公開簡報，也不能讓已發布的網址變成私人網址。
- 上線時先更新並部署 GAS，再發布同版號的 `index.html`。只更新其中一端不足以啟用完整的儲存與預覽功能。

## 註冊入口控制（2026.10.17-registration.1）

- 後台「小組與成員」新增「註冊入口顯示設定」，僅形印組長與指導老師（SuperAdmin）可調整。
- 可獨立控制「組長建組」「組員註冊」「信箱開通」「形印組加入」；初始均為開啟，既有帳號登入不受影響。
- 關閉後隱藏該入口、對應表單與頂端快捷按鈕；後端同步暫停該註冊方式，舊表單及直接請求也會被拒絕。既有形印邀請不會因此被使用或撤銷，重新開放後仍須符合原本的有效期限與邀請規則。
- `GET/POST action=getRegistrationOptions` 無須登入，只讀 Meta 設定並回傳四個布林值、設定版次與系統版號，不回傳帳號或小組資料。
- `POST action=updateRegistrationOptions` 需要登入 token，並傳入完整的 `registrationOptions`（`leader`、`member`、`activation`、`shapePrint`）及 `registrationOptionsRevision`。
- 設定存放於 `Meta.Registration_Options` 與 `Meta.Registration_Options_Revision`，沿用既有 Meta 工作表。一般整批 `saveState` 不會覆蓋這些伺服器設定。
- 設定使用獨立版次處理衝突；其他頁面的正常儲存不會造成註冊設定的假衝突。兩位管理者同時修改時，後儲存的一方會保留選擇並收到重新載入提示。
- 登入頁在背景讀取設定，重新聚焦、切回頁面及前景停留時定期更新。讀取失敗提供重試；已填的姓名、信箱等內容會保留。
- 上線需先部署此版 GAS，再發布同版 `index.html`；可連同本次尚未部署的規範簡報功能一起更新。

## 注意

- `uploadFile` / `uploadAssignmentAsset` 現在吃的是瀏覽器直傳的 base64 二進位內容，不再需要先貼 Google Drive 連結。
- 主頁目前維持單檔 `18 MB` 內直傳；超過 `18 MB` 時，前端會改開 `largeUploadPage`，由 GAS HTML Service 走分段上傳流程，支援到約 `2 GB`，實際仍受 Google Drive 與 Apps Script 配額限制。
- 公告作業的背景催交信目前會沿用作業上的 `Notify_By_Email` 設定；若該公告建立時有勾選寄送 Email，後續背景提醒也會一起寄出。
- 如果前端頁面目前是直接用 `file://` 開啟，之後真接 Web App API 時，建議改成放在靜態站或同樣由 GAS/網頁伺服器提供，避免瀏覽器跨來源限制。
- 密碼重設信的連結會依據 `FRONTEND_BASE_URL` 組成；若沒設定，`requestPasswordReset` 會直接報錯。
- 本次部署會自動建立 `Discussion_Comments` 與 `Auth_Sessions` 工作表；現有使用者的舊前端登入快取會失效，需重新登入一次。
