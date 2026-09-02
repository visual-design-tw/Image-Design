var APP_DEFAULTS = {
  timeZone: 'Asia/Taipei',
  spreadsheetId: 'PUT_SPREADSHEET_ID_HERE',
  driveRootFolderId: 'PUT_DRIVE_ROOT_FOLDER_ID_HERE',
  frontendBaseUrl: 'https://visual-design-tw.github.io/Image-Design/',
  mailSenderName: '畢展形印組管理系統',
  mailReplyTo: '',
  mailFromAlias: '',
  passwordResetExpiryMinutes: 30
};

var SUPPORTED_UPLOAD_EXTENSIONS = ['.ai', '.pdf', '.psd', '.indd', '.jpg', '.jpeg', '.png', '.tif', '.tiff', '.zip'];
var ASSIGNMENT_RESOURCE_EXTENSIONS = SUPPORTED_UPLOAD_EXTENSIONS.concat([
  '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.csv', '.txt'
]);
var MAX_BROWSER_UPLOAD_SIZE_BYTES = 18 * 1024 * 1024;
var MAX_STABLE_WEBAPP_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
var MAX_RESUMABLE_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
var RESUMABLE_UPLOAD_CHUNK_SIZE_BYTES = 2 * 1024 * 1024;
var RESUMABLE_UPLOAD_SESSION_TTL_SECONDS = 6 * 60 * 60;
var RESUMABLE_UPLOAD_CACHE_PREFIX = 'ShapePrintResumableUpload:';
var STATE_CACHE_PREFIX = 'ShapePrintState:v1:';
var STATE_CACHE_TTL_SECONDS = 60;
var STATE_CACHE_MAX_BYTES = 90 * 1024;
var ASSIGNMENT_REMINDER_TRIGGER_HANDLER = 'runScheduledAssignmentReminders';
var ASSIGNMENT_REMINDER_LOG_META_KEY = 'AssignmentReminderLog';
var ASSIGNMENT_REMINDER_SETTINGS_META_KEY = 'AssignmentReminderSettings';
var ASSIGNMENT_REMINDER_DEFAULT_OFFSETS_HOURS = [72, 24, 6];
var RECYCLE_BIN_RETENTION_DAYS = 30;
var RECYCLE_BIN_MAX_SNAPSHOT_CHARACTERS = 45000;
var DEFERRED_DRIVE_TRASH_QUEUE_PROPERTY = 'DEFERRED_DRIVE_TRASH_QUEUE_V1';
var DEFERRED_DRIVE_TRASH_TRIGGER_HANDLER = 'runDeferredDriveTrashQueue';
var DEFERRED_DRIVE_TRASH_MAX_ITEMS_PER_RUN = 20;
var DEFERRED_DRIVE_TRASH_MAX_ATTEMPTS = 6;
var DEFERRED_DRIVE_TRASH_RETRY_DELAY_MILLIS = 5 * 60 * 1000;
var ACTIVITY_LOG_MAX_RECORDS = 1000;
var AUTH_SESSION_TTL_HOURS = 12;
var AUTH_SESSION_MAX_PER_USER = 5;
var AUTH_LOGIN_MAX_ATTEMPTS = 5;
var AUTH_LOGIN_LOCKOUT_SECONDS = 10 * 60;
var MIN_PASSWORD_LENGTH = 8;

var TABLE_SCHEMAS = {
  Config_Stages: {
    headers: ['Stage_ID', 'Stage_Name', 'Budget_Allocated', 'Is_Active'],
    types: {
      Budget_Allocated: 'number',
      Is_Active: 'boolean'
    }
  },
  Users: {
    headers: ['User_ID', 'Email', 'Password', 'Name', 'Team_ID', 'Role', 'Status'],
    types: {}
  },
  Teams: {
    headers: ['Team_ID', 'Team_Name', 'Invite_Code'],
    types: {}
  },
  Purchase_Items: {
    headers: ['Item_ID', 'Stage_ID', 'Item_Name', 'Vendor_Price', 'Quantity', 'Subtotal', 'Created_At'],
    types: {
      Vendor_Price: 'number',
      Quantity: 'number',
      Subtotal: 'number'
    }
  },
  Assignments: {
    headers: [
      'Assignment_ID',
      'Stage_ID',
      'Title',
      'Body',
      'Submission_Mode',
      'Requirement_Text',
      'Target_Mode',
      'Target_Team_IDs',
      'Due_At',
      'Created_At',
      'Created_By_User_ID',
      'Status',
      'Allow_ReSubmit',
      'Notify_By_Email',
      'Email_Notification_Sent',
      'Email_Notification_Status',
      'Email_Notification_Recipient_Count',
      'Email_Notification_Sent_At',
      'Email_Notification_Last_Error'
    ],
    types: {
      Target_Team_IDs: 'json',
      Allow_ReSubmit: 'boolean',
      Notify_By_Email: 'boolean',
      Email_Notification_Sent: 'boolean',
      Email_Notification_Recipient_Count: 'number'
    }
  },
  Assignment_Resources: {
    headers: [
      'Resource_ID',
      'Assignment_ID',
      'File_Name',
      'Google_Drive_URL',
      'Drive_File_ID',
      'Drive_Folder_ID',
      'Mime_Type',
      'File_Size',
      'Created_At',
      'Created_By_User_ID'
    ],
    types: {
      File_Size: 'number'
    }
  },
    Assignment_Submissions: {
      headers: [
        'Submission_ID',
        'Assignment_ID',
        'User_ID',
      'Team_ID',
      'Submission_No',
      'Submission_Mode',
      'File_Name',
      'Google_Drive_URL',
      'Text_Content',
      'Submitted_At',
      'Updated_At',
        'Status',
        'Notes',
        'Drive_File_ID',
        'Drive_Folder_ID',
        'Reviewed_By_User_ID',
        'Reviewed_At',
        'Review_Note'
      ],
      types: {
        Submission_No: 'number'
      }
  },
  Files: {
    headers: [
      'File_ID',
      'Stage_ID',
      'Team_ID',
      'File_Name',
      'Google_Drive_URL',
      'Upload_Time',
      'Check_Status',
      'Comment',
      'Base_File_Name',
      'File_Extension',
      'Version_No',
      'File_Group_Key',
      'Revision_Notes',
      'Drive_File_ID',
      'Drive_Folder_ID'
    ],
    types: {
      Version_No: 'number'
    }
  },
  Notifications: {
    headers: [
      'Notification_ID',
      'User_ID',
      'Type',
      'Title',
      'Message',
      'Created_At',
      'Read',
      'Tab',
      'Ref_Type',
      'Ref_ID',
      'Priority'
    ],
    types: {
      Read: 'boolean'
    }
  },
  Discussion_Comments: {
    headers: [
      'Comment_ID',
      'Ref_Type',
      'Ref_ID',
      'User_ID',
      'Team_ID',
      'Author_Name',
      'Author_Role',
      'Kind',
      'Message',
      'Created_At'
    ],
    types: {}
  },
  Design_Service_Settings: {
    headers: ['Settings_ID', 'Enabled', 'Eligible_User_IDs', 'Updated_At', 'Updated_By_User_ID'],
    types: {
      Enabled: 'boolean',
      Eligible_User_IDs: 'json'
    }
  },
  Design_Service_Orders: {
    headers: [
      'Service_Order_ID',
      'Assignment_ID',
      'Stage_ID',
      'Team_ID',
      'Requested_By_User_ID',
      'Requested_At',
      'Responsible_User_ID',
      'Responsible_Name',
      'Claimed_At',
      'Status',
      'File_Name',
      'Google_Drive_URL',
      'Drive_File_ID',
      'Drive_Folder_ID',
      'Submitted_At',
      'Reviewed_By_User_ID',
      'Reviewed_At',
      'Review_Note',
      'Updated_At'
    ],
    types: {}
  },
  Calendar_Events: {
    headers: [
      'Event_ID',
      'Stage_ID',
      'Title',
      'Description',
      'Starts_At',
      'Ends_At',
      'All_Day',
      'Event_Type',
      'Created_At',
      'Updated_At',
      'Created_By_User_ID',
      'Updated_By_User_ID'
    ],
    types: {
      All_Day: 'boolean'
    }
  },
  Work_Items: {
    headers: [
      'Work_Item_ID',
      'Stage_ID',
      'Title',
      'Description',
      'Due_At',
      'Priority',
      'Status',
      'Created_At',
      'Created_By_User_ID',
      'Created_By_Name',
      'Assigned_To_User_ID',
      'Assigned_To_Name',
      'Assigned_At',
      'Claimed_At',
      'Started_At',
      'Completed_At',
      'Completed_By_User_ID',
      'Updated_At',
      'Updated_By_User_ID'
    ],
    types: {}
  },
  Recycle_Bin: {
    headers: [
      'Recycle_ID',
      'Entity_Type',
      'Entity_ID',
      'Title',
      'Snapshot_JSON',
      'Drive_File_IDs',
      'Deleted_At',
      'Deleted_By_User_ID',
      'Deleted_By_Name',
      'Expires_At',
      'Status',
      'Restored_At',
      'Restored_By_User_ID'
    ],
    types: {
      Snapshot_JSON: 'json',
      Drive_File_IDs: 'json'
    }
  },
  Password_Reset_Tokens: {
    headers: [
      'Reset_ID',
      'User_ID',
      'Email',
      'Token_Hash',
      'Requested_At',
      'Expires_At',
      'Consumed_At',
      'Status',
      'Requested_At_Millis',
      'Expires_At_Millis',
      'Consumed_At_Millis'
    ],
    types: {
      Requested_At_Millis: 'number',
      Expires_At_Millis: 'number',
      Consumed_At_Millis: 'number'
    }
  },
  Auth_Sessions: {
    headers: [
      'Session_ID',
      'User_ID',
      'Token_Hash',
      'Created_At',
      'Expires_At',
      'Last_Seen_At',
      'Revoked_At',
      'Expires_At_Millis'
    ],
    types: {
      Expires_At_Millis: 'number'
    }
  },
  Activity_Logs: {
    headers: [
      'Log_ID',
      'Created_At',
      'Actor_User_ID',
      'Actor_Name',
      'Actor_Role',
      'Action',
      'Summary',
      'Target_Type',
      'Target_ID',
      'Severity',
      'Metadata'
    ],
    types: {
      Metadata: 'json'
    }
  },
  Meta: {
    headers: ['Key', 'Value'],
    types: {
      Value: 'json'
    }
  }
};

function doGet(e) {
  try {
    var action = getAction_(e, {});

    if (action === 'health') {
      return jsonResponse_(true, buildHealthPayload_());
    }

    if (action === 'bootstrap' || action === 'state' || action === 'init') {
      return jsonResponse_(true, handleBootstrap_(e && e.parameter ? e.parameter : {}));
    }

    if (action === 'heatmap') {
      return jsonResponse_(true, handleHeatmap_(e && e.parameter ? e.parameter : {}));
    }

    if (action === 'largeUploadPage') {
      try {
        return renderLargeUploadPage_(e);
      } catch (pageError) {
        return renderLargeUploadErrorPage_(pageError);
      }
    }

    if (action === 'largeUploadModel') {
      return jsonResponse_(true, buildLargeUploadPageModel_(e && e.parameter ? e.parameter : {}));
    }

    throw new Error('Unsupported GET action: ' + action);
  } catch (error) {
    return jsonResponse_(false, null, error);
  }
}

function doPost(e) {
  try {
    var payload = parsePayload_(e);
    var action = getAction_(e, payload);
    var result;

    if (action === 'bootstrap' || action === 'state') {
      result = handleBootstrap_(payload);
      return jsonResponse_(true, result);
    }

    if (action === 'heatmap') {
      result = handleHeatmap_(payload);
      return jsonResponse_(true, result);
    }

    if (action === 'login') {
      result = withLock_(function() {
        return handleLogin_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'registerLeader') {
      result = withLock_(function() {
        return handleRegisterLeader_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'registerMember') {
      result = withLock_(function() {
        return handleRegisterMember_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'activatePending') {
      result = withLock_(function() {
        return handleActivatePending_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'requestPasswordReset') {
      result = withLock_(function() {
        return handleRequestPasswordReset_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'previewPasswordReset') {
      result = withLock_(function() {
        return handlePreviewPasswordReset_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'resetPassword') {
      result = withLock_(function() {
        return handleResetPassword_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'setup') {
      result = withLock_(function() {
        var setupState = loadState_();
        var setupUser = requireSessionUser_(setupState, payload, ['SuperAdmin']);
        setupSheets_();
        if (payload.seedDemo === true) {
          persistState_(buildDemoState_());
        }
        return buildClientStateResultForUser_(loadState_(), setupUser);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'saveState') {
      result = withLock_(function() {
        return handleSaveState_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'activateStage') {
      result = withLock_(function() {
        return handleActivateStage_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'deletePurchaseItem') {
      result = withLock_(function() {
        return handleDeletePurchaseItem_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'deleteAssignment') {
      result = withLock_(function() {
        return handleDeleteAssignment_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'deleteStage') {
      result = withLock_(function() {
        return handleDeleteStage_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'restoreRecycleBinItem') {
      result = withLock_(function() {
        return handleRestoreRecycleBinItem_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'createCalendarEvent') {
      result = withLock_(function() {
        return handleCreateCalendarEvent_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'updateCalendarEvent') {
      result = withLock_(function() {
        return handleUpdateCalendarEvent_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'deleteCalendarEvent') {
      result = withLock_(function() {
        return handleDeleteCalendarEvent_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'createWorkItem') {
      result = withLock_(function() {
        return handleCreateWorkItem_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'updateWorkItem') {
      result = withLock_(function() {
        return handleUpdateWorkItem_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'claimWorkItem') {
      result = withLock_(function() {
        return handleClaimWorkItem_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'updateWorkItemProgress') {
      result = withLock_(function() {
        return handleUpdateWorkItemProgress_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'deleteWorkItem') {
      result = withLock_(function() {
        return handleDeleteWorkItem_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'getActivityLogs') {
      result = handleGetActivityLogs_(payload);
      return jsonResponse_(true, result);
    }

    if (action === 'logout') {
      result = withLock_(function() {
        return handleLogoutSession_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'startResumableLargeUpload') {
      result = startResumableLargeUpload(payload);
      return jsonResponse_(true, result);
    }

    if (action === 'uploadResumableLargeUploadChunk') {
      result = uploadResumableLargeUploadChunk(payload);
      return jsonResponse_(true, result);
    }

    if (action === 'processLargeUpload') {
      result = withLock_(function() {
        return processLargeUploadForm_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'uploadFile') {
      result = withLock_(function() {
        return handleUploadFile_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'uploadAssignmentAsset') {
      result = withLock_(function() {
        return handleUploadAssignmentAsset_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'uploadAssignmentResource') {
      result = withLock_(function() {
        return handleUploadAssignmentResource_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'deleteAssignmentResource') {
      result = withLock_(function() {
        return handleDeleteAssignmentResource_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'configureDesignService') {
      result = withLock_(function() {
        return handleConfigureDesignService_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'requestDesignService') {
      result = withLock_(function() {
        return handleRequestDesignService_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'claimDesignServiceOrder') {
      result = withLock_(function() {
        return handleClaimDesignServiceOrder_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'uploadDesignServiceDeliverable') {
      result = withLock_(function() {
        return handleUploadDesignServiceDeliverable_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'reviewDesignServiceOrder') {
      result = withLock_(function() {
        return handleReviewDesignServiceOrder_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'reviewFile') {
      result = withLock_(function() {
        return handleReviewFile_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'reviewAssignmentSubmission') {
      result = withLock_(function() {
        return handleReviewAssignmentSubmission_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'markNotificationsRead') {
      result = withLock_(function() {
        return handleMarkNotificationsRead_(payload);
      });
      return jsonResponse_(true, result);
    }

    if (action === 'clearNotifications') {
      result = withLock_(function() {
        return handleClearNotifications_(payload);
      });
      return jsonResponse_(true, result);
    }

    throw new Error('Unsupported POST action: ' + action);
  } catch (error) {
    return jsonResponse_(false, null, error);
  }
}

function renderLargeUploadPage_(e) {
  var template = HtmlService.createTemplateFromFile('LargeUpload');
  template.pageModel = buildLargeUploadPageModel_(e && e.parameter ? e.parameter : {});
  return template.evaluate()
    .setTitle('形印組穩定上傳')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function renderLargeUploadErrorPage_(error) {
  var message = error && error.message ? error.message : '無法開啟大檔上傳頁。';
  var safeMessage = String(message).replace(/[<>&"']/g, function(char) {
    return {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#39;'
    }[char];
  });

  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>穩定上傳頁</title>' +
    '<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang TC","Noto Sans TC",sans-serif;background:#f5f5f7;color:#1d1d1f;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.card{max-width:460px;width:100%;background:#fff;border:1px solid #e5e5ea;border-radius:28px;padding:28px;box-shadow:0 16px 48px rgba(15,23,42,.08)}h1{font-size:24px;margin:0 0 10px}p{margin:0;color:#6e6e73;line-height:1.7}</style>' +
    '</head><body><div class="card"><h1>無法開啟大檔上傳頁</h1><p>' + safeMessage + '</p></div></body></html>'
  );
}

function buildLargeUploadPageModel_(params) {
  var mode = String(params.mode || '').trim();
  if (['file', 'assignment-asset', 'assignment-resource', 'design-service'].indexOf(mode) === -1) {
    throw new Error('穩定上傳頁缺少正確的 mode 參數。');
  }

  var state = loadState_();
  var userId = String(params.userId || '').trim();
  var teamId = String(params.teamId || '').trim();
  var stageId = String(params.stageId || '').trim();
  var assignmentId = String(params.assignmentId || '').trim();
  var sourceFileName = String(params.sourceFileName || '').trim();
  var parsedSource = parseFileMeta_(sourceFileName || 'upload.bin');
  var baseName = String(params.baseName || parsedSource.baseName || '').trim();
  var extension = String(params.extension || parsedSource.extension || '').trim();
  var sessionKey = String(params.sessionKey || '').trim();
  var groupKey = String(params.groupKey || '').trim();
  var serviceOrderId = String(params.serviceOrderId || '').trim();

  var currentUser = (mode === 'design-service' || mode === 'assignment-resource')
    ? requireSessionUser_(state, params, ['SuperAdmin', 'Admin'])
    : requireStudentUploadActor_(state, params);
  if (userId && userId !== String(currentUser.User_ID || '')) {
    throw new Error('FORBIDDEN: 穩定上傳頁的使用者資訊不符。');
  }
  if (mode !== 'design-service' && mode !== 'assignment-resource' && teamId && teamId !== String(currentUser.Team_ID || '')) {
    throw new Error('FORBIDDEN: 穩定上傳頁的小組資訊不符。');
  }
  userId = String(currentUser.User_ID || '');
  if (mode !== 'design-service' && mode !== 'assignment-resource') {
    teamId = String(currentUser.Team_ID || '');
  }

  var serviceOrder = null;
  if (mode === 'design-service') {
    serviceOrder = getDesignServiceOrderById_(state, serviceOrderId);
    if (!serviceOrder) {
      throw new Error('找不到指定的形印代做案件。');
    }
    if (String(currentUser.Role || '') !== 'SuperAdmin'
      && String(serviceOrder.Responsible_User_ID || '') !== String(currentUser.User_ID || '')) {
      throw new Error('FORBIDDEN: 只有案件負責人可以使用穩定上傳。');
    }
    if (['製作中', '退回修正'].indexOf(String(serviceOrder.Status || '')) === -1) {
      throw new Error('目前案件狀態不開放上傳成果。');
    }
    assignmentId = String(serviceOrder.Assignment_ID || '');
    stageId = String(serviceOrder.Stage_ID || '');
    teamId = String(serviceOrder.Team_ID || '');
  }

  var team = ensureArray_(state.Teams).find(function(item) {
    return String(item.Team_ID || '') === teamId;
  }) || null;
  var assignment = ensureArray_(state.Assignments).find(function(item) {
    return String(item.Assignment_ID || '') === assignmentId;
  }) || null;
  var stage = ensureArray_(state.Config_Stages).find(function(item) {
    return String(item.Stage_ID || '') === stageId;
  }) || null;

  if (mode === 'file') {
    if (!team || team.Team_ID === 'T00') {
      throw new Error('只有正式小組可以使用一般檔案收件上傳。');
    }
    if (!stage) {
      stage = ensureArray_(state.Config_Stages).find(function(item) {
        return item.Is_Active === true;
      }) || null;
    }
    if (!stage) {
      throw new Error('找不到目前作用中的會審期數。');
    }
  }

  if (mode === 'assignment-asset') {
    if (!team || team.Team_ID === 'T00') {
      throw new Error('只有正式小組可以使用繳交項目上傳。');
    }
    if (!assignment) {
      throw new Error('找不到指定的繳交項目。');
    }
    if (!isAssignmentVisibleToTeam_(state, assignment, teamId)) {
      throw new Error('FORBIDDEN: 這份作業不在你的繳交範圍內。');
    }
    if (!stage) {
      stage = ensureArray_(state.Config_Stages).find(function(item) {
        return String(item.Stage_ID || '') === String(assignment.Stage_ID || '');
      }) || null;
    }
  }

  if (mode === 'assignment-resource') {
    if (!assignment) {
      throw new Error('找不到指定的繳交項目。');
    }
    if (!stage) {
      stage = ensureArray_(state.Config_Stages).find(function(item) {
        return String(item.Stage_ID || '') === String(assignment.Stage_ID || '');
      }) || null;
    }
    if (!stage) {
      throw new Error('找不到繳交項目所屬的會審期數。');
    }
  }

  if (mode === 'design-service') {
    if (!team || team.Team_ID === 'T00') {
      throw new Error('找不到形印代做案件的申請小組。');
    }
    if (!assignment) {
      throw new Error('找不到形印代做案件的作業。');
    }
    if (!stage) {
      stage = ensureArray_(state.Config_Stages).find(function(item) {
        return String(item.Stage_ID || '') === String(assignment.Stage_ID || '');
      }) || null;
    }
    if (!stage) {
      throw new Error('找不到形印代做案件所屬的會審期數。');
    }
  }

  var pathSegments = mode === 'assignment-asset'
    ? [stage ? stage.Stage_Name : '', team ? team.Team_Name : '', '公告作業', assignment ? assignment.Title : '']
    : mode === 'assignment-resource'
      ? [stage ? stage.Stage_Name : '', '繳交項目附件', assignment ? assignment.Title : '']
    : mode === 'design-service'
      ? [stage ? stage.Stage_Name : '', team ? team.Team_Name : '', '形印代做', assignment ? assignment.Title : '', serviceOrderId]
      : [stage ? stage.Stage_Name : '', team ? team.Team_Name : ''];
  var pathLabel = pathSegments.filter(function(segment) {
    return String(segment || '').trim();
  }).join(' / ');

  return {
    mode: mode,
    sessionToken: String(params.sessionToken || '').trim(),
    sessionKey: sessionKey,
    userId: userId,
    teamId: teamId,
    stageId: stage ? String(stage.Stage_ID || '') : stageId,
    assignmentId: assignmentId,
    serviceOrderId: serviceOrderId,
    groupKey: groupKey,
    baseName: baseName,
    extension: extension,
    sourceFileName: sourceFileName,
    stageName: stage ? String(stage.Stage_Name || '') : '',
    teamName: team ? String(team.Team_Name || '') : '',
    assignmentTitle: assignment ? String(assignment.Title || '') : '',
    pathLabel: pathLabel,
    maxDirectMb: Math.round(MAX_BROWSER_UPLOAD_SIZE_BYTES / 1024 / 1024),
    maxStableMb: Math.round(MAX_STABLE_WEBAPP_UPLOAD_SIZE_BYTES / 1024 / 1024),
    maxResumableMb: Math.round(MAX_RESUMABLE_UPLOAD_SIZE_BYTES / 1024 / 1024),
    maxResumableGb: Math.round(MAX_RESUMABLE_UPLOAD_SIZE_BYTES / 1024 / 1024 / 1024),
    resumableChunkMb: Math.round(RESUMABLE_UPLOAD_CHUNK_SIZE_BYTES / 1024 / 1024),
    title: mode === 'assignment-asset'
      ? '繳交項目穩定上傳'
      : mode === 'assignment-resource'
        ? '項目附件穩定上傳'
      : mode === 'design-service'
        ? '形印代做成果上傳'
        : '大檔穩定上傳',
    subtitle: mode === 'assignment-asset'
      ? '大於 18 MB 的作業附件會先直接送到雲端，再回主頁完成繳交；為了穩定性，會以小段依序傳送。'
      : mode === 'assignment-resource'
        ? '規範圖片、公版與參考檔會直接放入這份繳交項目的附件資料夾；大檔會以小段依序傳送。'
      : mode === 'design-service'
        ? '成果會直接寫入案件專屬資料夾，完成後回主頁等待形印組長審核；大檔會以小段依序傳送。'
        : '大於 18 MB 的收件檔案會透過穩定上傳頁直接寫入 Google 雲端硬碟，並以小段依序傳送。',
    helperText: sourceFileName
      ? '請在下方重新選擇同一份檔案：' + sourceFileName
      : '請重新選擇要上傳的檔案。'
  };
}

function processLargeUploadForm(formObject) {
  return withLock_(function() {
    return processLargeUploadForm_(formObject);
  });
}

function processLargeUploadForm_(formObject) {
  var payload = formObject && typeof formObject === 'object' ? formObject : {};
  var mode = String(payload.uploadMode || payload.mode || '').trim();

  if (mode === 'file') {
    return handleLargeFileFormUpload_(payload);
  }

  if (mode === 'assignment-asset') {
    return handleLargeAssignmentAssetFormUpload_(payload);
  }

  if (mode === 'assignment-resource') {
    return handleLargeAssignmentResourceFormUpload_(payload);
  }

  if (mode === 'design-service') {
    return handleLargeDesignServiceFormUpload_(payload);
  }

  throw new Error('未知的穩定上傳模式。');
}

// Files larger than the HTML-service form limit use a Drive resumable upload.
// Each request carries one small base64 chunk, so a failed request can be
// retried without sending the whole file again.
function startResumableLargeUpload(payload) {
  var preparation = buildResumableUploadPreparation_(payload);
  var folderContext = getOrCreateNestedFolders_(
    DriveApp.getFolderById(getConfig_().driveRootFolderId),
    preparation.folderSegments
  );
  var uploadSessionUrl = createDriveResumableSession_(
    preparation.targetFileName,
    preparation.mimeType,
    preparation.fileSize,
    folderContext.folder.getId()
  );
  var sessionKey = String(preparation.sessionKey || '').trim();
  var session = {
    status: 'active',
    sessionKey: sessionKey,
    mode: preparation.mode,
    sessionTokenHash: hashSessionToken_(String(payload && payload.sessionToken || '')),
    userId: preparation.currentUser.User_ID,
    teamId: preparation.teamId,
    stageId: preparation.stageId,
    assignmentId: preparation.assignmentId,
    serviceOrderId: preparation.serviceOrderId,
    groupKey: preparation.groupKey,
    baseName: preparation.baseName,
    extension: preparation.extension,
    sourceFileName: preparation.sourceFileName,
    targetFileName: preparation.targetFileName,
    mimeType: preparation.mimeType,
    fileSize: preparation.fileSize,
    folderId: folderContext.folder.getId(),
    folderPath: folderContext.path,
    uploadSessionUrl: uploadSessionUrl,
    createdAtMillis: Date.now(),
    expiresAtMillis: Date.now() + RESUMABLE_UPLOAD_SESSION_TTL_SECONDS * 1000
  };
  saveResumableUploadSession_(session, RESUMABLE_UPLOAD_SESSION_TTL_SECONDS);

  return {
    status: 'started',
    mode: preparation.mode,
    sessionKey: sessionKey,
    chunkSize: RESUMABLE_UPLOAD_CHUNK_SIZE_BYTES,
    totalChunks: Math.ceil(preparation.fileSize / RESUMABLE_UPLOAD_CHUNK_SIZE_BYTES),
    fileSize: preparation.fileSize,
    maxResumableMb: Math.round(MAX_RESUMABLE_UPLOAD_SIZE_BYTES / 1024 / 1024),
    folderPath: folderContext.path
  };
}

function uploadResumableLargeUploadChunk(payload) {
  payload = payload && typeof payload === 'object' ? payload : {};
  var sessionKey = String(payload.sessionKey || '').trim();
  var session = loadResumableUploadSession_(sessionKey);
  if (!session) {
    throw new Error('大檔上傳工作階段已過期，請重新開始上傳。');
  }
  if (session.status === 'completed' && session.completedResult) {
    return session.completedResult;
  }
  verifyResumableUploadSession_(session, payload);

  var totalSize = Number(payload.totalSize || 0);
  var chunkStart = Number(payload.chunkStart);
  var chunkEnd = Number(payload.chunkEnd);
  var totalChunks = Number(payload.totalChunks || 0);
  var chunkBase64 = String(payload.chunkBase64 || '').trim();
  if (!Number.isFinite(totalSize) || totalSize !== Number(session.fileSize)) {
    throw new Error('大檔上傳大小驗證失敗。');
  }
  if (!Number.isFinite(chunkStart) || !Number.isFinite(chunkEnd)
    || chunkStart < 0 || chunkEnd < chunkStart || chunkEnd >= totalSize) {
    throw new Error('大檔上傳分段範圍無效。');
  }
  if (!Number.isFinite(totalChunks) || totalChunks < 1) {
    throw new Error('大檔上傳分段數量無效。');
  }
  if (!chunkBase64) {
    throw new Error('大檔上傳缺少分段內容。');
  }

  var chunkBytes;
  try {
    chunkBytes = Utilities.base64Decode(chunkBase64);
  } catch (decodeError) {
    throw new Error('大檔上傳分段內容無法解析。');
  }
  var expectedChunkSize = chunkEnd - chunkStart + 1;
  if (!chunkBytes || chunkBytes.length !== expectedChunkSize) {
    throw new Error('大檔上傳分段大小驗證失敗。');
  }
  if (chunkBytes.length > RESUMABLE_UPLOAD_CHUNK_SIZE_BYTES) {
    throw new Error('大檔上傳單段不可超過 ' + Math.round(RESUMABLE_UPLOAD_CHUNK_SIZE_BYTES / 1024 / 1024) + ' MB。');
  }

  var driveResponse = uploadDriveResumableChunk_(
    session.uploadSessionUrl,
    session.mimeType,
    chunkStart,
    chunkEnd,
    totalSize,
    chunkBytes
  );
  var responseCode = driveResponse.responseCode;
  if (responseCode === 308) {
    var nextByte = getResumableNextByte_(driveResponse.headers, chunkEnd + 1);
    return {
      status: 'progress',
      mode: session.mode,
      sessionKey: sessionKey,
      complete: false,
      nextByte: nextByte,
      uploadedBytes: Math.min(totalSize, nextByte),
      totalSize: totalSize
    };
  }
  if (responseCode !== 200 && responseCode !== 201) {
    throw new Error('Google Drive 分段上傳失敗（HTTP ' + responseCode + '）。');
  }

  var driveResult = buildResumableDriveResult_(driveResponse.body, session);
  var finalizePayload = {
    uploadMode: session.mode,
    mode: session.mode,
    sessionToken: payload.sessionToken,
    sessionKey: sessionKey,
    userId: session.userId,
    teamId: session.teamId,
    stageId: session.stageId,
    assignmentId: session.assignmentId,
    serviceOrderId: session.serviceOrderId,
    groupKey: session.groupKey,
    baseName: session.baseName,
    extension: session.extension,
    sourceFileName: session.sourceFileName,
    fileName: session.sourceFileName,
    mimeType: session.mimeType,
    fileSize: session.fileSize
  };

  var result;
  try {
    result = withLock_(function() {
      if (session.mode === 'file') {
        return handleLargeFileFormUpload_(finalizePayload, driveResult);
      }
      if (session.mode === 'assignment-asset') {
        return handleLargeAssignmentAssetFormUpload_(finalizePayload, driveResult);
      }
      if (session.mode === 'assignment-resource') {
        return handleLargeAssignmentResourceFormUpload_(finalizePayload, driveResult);
      }
      return handleLargeDesignServiceFormUpload_(finalizePayload, driveResult);
    });
  } catch (finalizeError) {
    trashDriveFiles_([driveResult.fileId]);
    throw finalizeError;
  }

  session.status = 'completed';
  session.completedResult = result;
  saveResumableUploadSession_(session, 10 * 60);
  return result;
}

function buildResumableUploadPreparation_(payload) {
  payload = payload && typeof payload === 'object' ? payload : {};
  var mode = String(payload.uploadMode || payload.mode || '').trim();
  if (['file', 'assignment-asset', 'assignment-resource', 'design-service'].indexOf(mode) === -1) {
    throw new Error('未知的大檔上傳模式。');
  }

  var sessionKey = String(payload.sessionKey || '').trim();
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(sessionKey)) {
    throw new Error('大檔上傳工作階段識別碼無效。');
  }

  var state = loadState_();
  var currentUser = (mode === 'design-service' || mode === 'assignment-resource')
    ? requireSessionUser_(state, payload, ['SuperAdmin', 'Admin'])
    : requireStudentUploadActor_(state, payload);
  var fileSize = Number(payload.fileSize || 0);
  if (!Number.isFinite(fileSize) || fileSize <= MAX_BROWSER_UPLOAD_SIZE_BYTES) {
    throw new Error('只有超過 18 MB 的檔案需要使用分段上傳。');
  }
  if (fileSize > MAX_RESUMABLE_UPLOAD_SIZE_BYTES) {
    throw new Error('檔案超過目前分段上傳上限 ' + Math.round(MAX_RESUMABLE_UPLOAD_SIZE_BYTES / 1024 / 1024 / 1024) + ' GB。');
  }

  var sourceFileName = sanitizeDriveEntryName_(
    payload.sourceFileName || payload.fileName || 'upload.bin',
    'upload.bin'
  );
  var parsedFile = parseFileMeta_(sourceFileName);
  var extension = String(payload.extension || parsedFile.extension || '').trim().toLowerCase();
  if (!extension || (mode === 'assignment-resource'
    ? !isSupportedAssignmentResourceExtension_(extension)
    : !isSupportedUploadExtension_(extension))) {
    throw new Error(mode === 'assignment-resource'
      ? '項目附件支援 ai、pdf、psd、indd、圖片、zip、Office 與文字檔。'
      : '目前只支援 ai、pdf、psd、indd、圖像格式與 zip。');
  }
  var mimeType = String(payload.mimeType || 'application/octet-stream').trim() || 'application/octet-stream';
  var context = {
    mode: mode,
    sessionKey: sessionKey,
    currentUser: currentUser,
    fileSize: fileSize,
    sourceFileName: sourceFileName,
    extension: extension,
    mimeType: mimeType,
    teamId: String(currentUser.Team_ID || ''),
    stageId: String(payload.stageId || '').trim(),
    assignmentId: String(payload.assignmentId || '').trim(),
    serviceOrderId: String(payload.serviceOrderId || '').trim(),
    groupKey: String(payload.groupKey || '').trim(),
    baseName: String(payload.baseName || parsedFile.baseName || '').trim(),
    folderSegments: [],
    targetFileName: sourceFileName
  };

  if (mode === 'file') {
    var fileStage = context.stageId
      ? ensureArray_(state.Config_Stages).find(function(stage) { return String(stage.Stage_ID || '') === context.stageId; })
      : ensureArray_(state.Config_Stages).find(function(stage) { return stage.Is_Active === true; });
    var fileTeam = ensureArray_(state.Teams).find(function(team) { return String(team.Team_ID || '') === context.teamId; });
    if (!fileStage || !fileTeam || fileTeam.Team_ID === 'T00') {
      throw new Error('找不到一般檔案收件的會審或小組資料。');
    }
    if (!context.baseName) {
      throw new Error('檔案主名稱不可為空白。');
    }
    context.stageId = String(fileStage.Stage_ID || '');
    context.groupKey = context.groupKey || makeFileGroupKey_(context.stageId, context.teamId, context.baseName);
    var latestFile = getLatestFileForGroup_(state.Files, context.groupKey);
    if (latestFile && latestFile.Check_Status !== '退件') {
      throw new Error('只有被退件的檔案才能重新繳交。');
    }
    var relatedFiles = ensureArray_(state.Files).filter(function(file) {
      return String(file.File_Group_Key || '') === context.groupKey;
    });
    var highestVersion = relatedFiles.reduce(function(max, file) {
      return Math.max(max, Number(file.Version_No || 1));
    }, 0);
    context.targetFileName = buildVersionedFileName_(context.baseName, highestVersion + 1, extension);
    context.folderSegments = [fileStage.Stage_Name, fileTeam.Team_Name];
    return context;
  }

  var assignment = ensureArray_(state.Assignments).find(function(item) {
    return String(item.Assignment_ID || '') === context.assignmentId;
  });
  if (!assignment) {
    throw new Error('找不到指定的繳交項目。');
  }

  if (mode === 'assignment-asset') {
    if (!isAssignmentVisibleToTeam_(state, assignment, context.teamId)) {
      throw new Error('FORBIDDEN: 這份作業不在你的繳交範圍內。');
    }
    var assignmentStage = ensureArray_(state.Config_Stages).find(function(stage) {
      return String(stage.Stage_ID || '') === String(assignment.Stage_ID || '');
    }) || ensureArray_(state.Config_Stages).find(function(stage) { return stage.Is_Active === true; });
    var assignmentTeam = ensureArray_(state.Teams).find(function(team) { return String(team.Team_ID || '') === context.teamId; });
    if (!assignmentStage || !assignmentTeam || assignmentTeam.Team_ID === 'T00') {
      throw new Error('找不到繳交項目的會審或小組資料。');
    }
    context.stageId = String(assignmentStage.Stage_ID || '');
    var assignmentSubmissions = ensureArray_(state.Assignment_Submissions).filter(function(submission) {
      return String(submission.Assignment_ID || '') === context.assignmentId
        && String(submission.Team_ID || '') === context.teamId;
    });
    var latestSubmission = assignmentSubmissions.slice().sort(function(a, b) {
      return Number(b.Submission_No || 1) - Number(a.Submission_No || 1);
    })[0] || null;
    if (latestSubmission && (assignment.Allow_ReSubmit !== true || !isAssignmentSubmissionRejected_(latestSubmission))) {
      throw new Error('只有被退回修正後，才能重新繳交。');
    }
    context.targetFileName = buildAssignmentSubmissionFileName_(sourceFileName, latestSubmission ? Number(latestSubmission.Submission_No || 1) + 1 : 1);
    context.folderSegments = [assignmentStage.Stage_Name, assignmentTeam.Team_Name, '公告作業', assignment.Title];
    return context;
  }

  if (mode === 'assignment-resource') {
    var resourceStage = ensureArray_(state.Config_Stages).find(function(stage) {
      return String(stage.Stage_ID || '') === String(assignment.Stage_ID || '');
    }) || ensureArray_(state.Config_Stages).find(function(stage) { return stage.Is_Active === true; });
    if (!resourceStage) {
      throw new Error('找不到繳交項目所屬的會審期數。');
    }
    context.stageId = String(resourceStage.Stage_ID || '');
    context.folderSegments = [resourceStage.Stage_Name, '繳交項目附件', assignment.Title];
    context.targetFileName = sourceFileName;
    return context;
  }

  var serviceOrder = getDesignServiceOrderById_(state, context.serviceOrderId);
  if (!serviceOrder) {
    throw new Error('找不到指定的形印代做案件。');
  }
  if (String(currentUser.Role || '') !== 'SuperAdmin'
    && String(serviceOrder.Responsible_User_ID || '') !== String(currentUser.User_ID || '')) {
    throw new Error('FORBIDDEN: 只有案件負責人可以使用分段上傳。');
  }
  if (['製作中', '退回修正'].indexOf(String(serviceOrder.Status || '')) === -1) {
    throw new Error('目前案件狀態不開放上傳成果。');
  }
  var serviceStage = ensureArray_(state.Config_Stages).find(function(stage) {
    return String(stage.Stage_ID || '') === String(serviceOrder.Stage_ID || assignment.Stage_ID || '');
  });
  var serviceTeam = ensureArray_(state.Teams).find(function(team) {
    return String(team.Team_ID || '') === String(serviceOrder.Team_ID || '');
  });
  if (!serviceStage || !serviceTeam) {
    throw new Error('找不到形印代做案件的會審或小組資料。');
  }
  context.teamId = String(serviceTeam.Team_ID || '');
  context.stageId = String(serviceStage.Stage_ID || '');
  context.assignmentId = String(serviceOrder.Assignment_ID || context.assignmentId || '');
  context.folderSegments = [serviceStage.Stage_Name, serviceTeam.Team_Name, '形印代做', assignment.Title, context.serviceOrderId];
  return context;
}

function createDriveResumableSession_(fileName, mimeType, fileSize, folderId) {
  var uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,parents';
  var response = UrlFetchApp.fetch(uploadUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(fileSize)
    },
    payload: JSON.stringify({
      name: fileName,
      mimeType: mimeType,
      parents: [folderId]
    }),
    muteHttpExceptions: true
  });
  var responseCode = response.getResponseCode();
  if (responseCode < 200 || responseCode >= 300) {
    throw new Error('Google Drive 無法建立大檔上傳工作階段（HTTP ' + responseCode + '）。');
  }
  var location = getHttpHeaderValue_(response.getAllHeaders(), 'Location');
  if (!location) {
    throw new Error('Google Drive 沒有回傳大檔上傳工作階段網址。');
  }
  return location;
}

function uploadDriveResumableChunk_(sessionUrl, mimeType, chunkStart, chunkEnd, totalSize, chunkBytes) {
  var response = UrlFetchApp.fetch(sessionUrl, {
    method: 'put',
    // UrlFetchApp calculates Content-Length from the byte payload; setting it
    // manually is rejected as an invalid request header by Apps Script.
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      'Content-Range': 'bytes ' + chunkStart + '-' + chunkEnd + '/' + totalSize,
      'Content-Type': mimeType
    },
    payload: chunkBytes,
    muteHttpExceptions: true
  });
  var headers = response.getAllHeaders();
  return {
    responseCode: response.getResponseCode(),
    headers: headers,
    body: response.getContentText()
  };
}

function buildResumableDriveResult_(body, session) {
  var parsed = {};
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch (parseError) {
    parsed = {};
  }
  var fileId = String(parsed.id || '').trim();
  if (!fileId) {
    throw new Error('Google Drive 已完成傳輸，但沒有回傳檔案 ID。');
  }
  var file = DriveApp.getFileById(fileId);
  return {
    fileId: fileId,
    fileUrl: file.getUrl(),
    fileName: file.getName(),
    folderId: session.folderId,
    folderPath: session.folderPath
  };
}

function getHttpHeaderValue_(headers, name) {
  headers = headers || {};
  var target = String(name || '').toLowerCase();
  var key = Object.keys(headers).find(function(headerName) {
    return String(headerName || '').toLowerCase() === target;
  });
  if (!key) return '';
  var value = headers[key];
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function getResumableNextByte_(headers, fallback) {
  var range = getHttpHeaderValue_(headers, 'Range');
  var match = range.match(/-(\d+)$/);
  return match ? Number(match[1]) + 1 : Number(fallback || 0);
}

function getResumableUploadCacheKey_(sessionKey) {
  return RESUMABLE_UPLOAD_CACHE_PREFIX + String(sessionKey || '').trim();
}

function saveResumableUploadSession_(session, ttlSeconds) {
  var sessionKey = String(session && session.sessionKey || '').trim();
  if (!sessionKey) throw new Error('大檔上傳工作階段缺少識別碼。');
  CacheService.getScriptCache().put(
    getResumableUploadCacheKey_(sessionKey),
    JSON.stringify(session),
    Math.max(60, Number(ttlSeconds || RESUMABLE_UPLOAD_SESSION_TTL_SECONDS))
  );
}

function loadResumableUploadSession_(sessionKey) {
  if (!sessionKey) return null;
  var raw = CacheService.getScriptCache().get(getResumableUploadCacheKey_(sessionKey));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function verifyResumableUploadSession_(session, payload) {
  var sessionToken = String(payload && payload.sessionToken || '').trim();
  if (!sessionToken || !session.sessionTokenHash || hashSessionToken_(sessionToken) !== session.sessionTokenHash) {
    throw new Error('AUTH_EXPIRED: 大檔上傳登入狀態已過期，請重新登入。');
  }
  if (Number(session.expiresAtMillis || 0) < Date.now()) {
    throw new Error('大檔上傳工作階段已過期，請重新開始上傳。');
  }
}

function pickOptionalConfigValue_(options, key, fallback) {
  if (options && Object.prototype.hasOwnProperty.call(options, key)) {
    return String(options[key] || '').trim();
  }
  return String(fallback || '').trim();
}

function saveScriptConfig(spreadsheetId, driveRootFolderId, options) {
  if (!spreadsheetId || !driveRootFolderId) {
    throw new Error('Both spreadsheetId and driveRootFolderId are required.');
  }

  options = options && typeof options === 'object' ? options : {};
  var props = PropertiesService.getScriptProperties();
  var existingProps = props.getProperties();
  var nextProps = {
    SPREADSHEET_ID: String(spreadsheetId).trim(),
    DRIVE_ROOT_FOLDER_ID: String(driveRootFolderId).trim(),
    APP_TIME_ZONE: pickOptionalConfigValue_(options, 'timeZone', existingProps.APP_TIME_ZONE || APP_DEFAULTS.timeZone),
    FRONTEND_BASE_URL: pickOptionalConfigValue_(options, 'frontendBaseUrl', existingProps.FRONTEND_BASE_URL || APP_DEFAULTS.frontendBaseUrl),
    MAIL_SENDER_NAME: pickOptionalConfigValue_(options, 'mailSenderName', existingProps.MAIL_SENDER_NAME || APP_DEFAULTS.mailSenderName),
    MAIL_REPLY_TO: pickOptionalConfigValue_(options, 'mailReplyTo', existingProps.MAIL_REPLY_TO || APP_DEFAULTS.mailReplyTo),
    MAIL_FROM_ALIAS: pickOptionalConfigValue_(options, 'mailFromAlias', existingProps.MAIL_FROM_ALIAS || APP_DEFAULTS.mailFromAlias),
    PASSWORD_RESET_EXPIRY_MINUTES: pickOptionalConfigValue_(
      options,
      'passwordResetExpiryMinutes',
      existingProps.PASSWORD_RESET_EXPIRY_MINUTES || APP_DEFAULTS.passwordResetExpiryMinutes
    )
  };

  props.setProperties(nextProps, true);

  return buildHealthPayload_();
}

function configureImageDesignDefaults() {
  return saveScriptConfig('1OSkWSzpcgJqGaGIjC-CzeApZoeyBHMpfen29whTvGKY', '1UV356WstvdKJKzURrqYcbiJcsW4Wdx8Q', {
    frontendBaseUrl: 'https://visual-design-tw.github.io/Image-Design/',
    mailSenderName: '畢展形印組管理系統',
    passwordResetExpiryMinutes: 30,
    timeZone: 'Asia/Taipei'
  });
}

function primeImageDesignProperties() {
  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    SPREADSHEET_ID: '1OSkWSzpcgJqGaGIjC-CzeApZoeyBHMpfen29whTvGKY',
    DRIVE_ROOT_FOLDER_ID: '1UV356WstvdKJKzURrqYcbiJcsW4Wdx8Q',
    APP_TIME_ZONE: 'Asia/Taipei',
    FRONTEND_BASE_URL: 'https://visual-design-tw.github.io/Image-Design/',
    MAIL_SENDER_NAME: '畢展形印組管理系統',
    MAIL_REPLY_TO: '',
    MAIL_FROM_ALIAS: '',
    PASSWORD_RESET_EXPIRY_MINUTES: '30'
  }, true);

  return {
    ok: true,
    spreadsheetId: '1OSkWSzpcgJqGaGIjC-CzeApZoeyBHMpfen29whTvGKY',
    driveRootFolderId: '1UV356WstvdKJKzURrqYcbiJcsW4Wdx8Q'
  };
}

function authorizeMailScope() {
  return {
    remainingDailyQuota: MailApp.getRemainingDailyQuota()
  };
}

// Run once from the Apps Script editor after adding resumable Drive uploads.
// The request intentionally verifies the external-request scope before the
// web app tries to create a Drive upload session for an anonymous visitor.
function authorizeLargeUploadScope() {
  var response = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/about?fields=user',
    {
      method: 'get',
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    }
  );
  var responseCode = response.getResponseCode();
  if (responseCode < 200 || responseCode >= 300) {
    throw new Error('外部連線授權檢查失敗（HTTP ' + responseCode + '）。');
  }
  return {
    ok: true,
    responseCode: responseCode,
    message: '大檔上傳所需的外部連線授權已完成。'
  };
}

function configureAssignmentReminderSettings(options) {
  return withLock_(function() {
    var state = loadState_();
    var nextSettings = normalizeAssignmentReminderSettings_(options);
    state.Meta[ASSIGNMENT_REMINDER_SETTINGS_META_KEY] = nextSettings;
    persistState_(state);
    return {
      ok: true,
      settings: nextSettings
    };
  });
}

function enableAssignmentReminderAutomation(options) {
  var result = configureAssignmentReminderSettings(Object.assign({
    enabled: true,
    offsetsHours: ASSIGNMENT_REMINDER_DEFAULT_OFFSETS_HOURS,
    sendEmail: true,
    sendSiteNotifications: true
  }, options || {}));
  var triggerInfo = installAssignmentReminderTrigger();
  return {
    ok: true,
    settings: result.settings,
    trigger: triggerInfo
  };
}

function disableAssignmentReminderAutomation() {
  var result = configureAssignmentReminderSettings({
    enabled: false
  });
  var triggerInfo = removeAssignmentReminderTriggers();
  return {
    ok: true,
    settings: result.settings,
    trigger: triggerInfo
  };
}

function installAssignmentReminderTrigger() {
  removeAssignmentReminderTriggers();
  var trigger = ScriptApp.newTrigger(ASSIGNMENT_REMINDER_TRIGGER_HANDLER)
    .timeBased()
    .everyHours(1)
    .create();

  return {
    ok: true,
    createdTriggerId: trigger.getUniqueId(),
    triggers: listAssignmentReminderTriggers()
  };
}

function removeAssignmentReminderTriggers() {
  var deleted = [];
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (String(trigger.getHandlerFunction() || '') !== ASSIGNMENT_REMINDER_TRIGGER_HANDLER) {
      return;
    }
    deleted.push(trigger.getUniqueId());
    ScriptApp.deleteTrigger(trigger);
  });

  return {
    ok: true,
    deletedTriggerIds: deleted,
    triggers: listAssignmentReminderTriggers()
  };
}

function listAssignmentReminderTriggers() {
  return ScriptApp.getProjectTriggers().filter(function(trigger) {
    return String(trigger.getHandlerFunction() || '') === ASSIGNMENT_REMINDER_TRIGGER_HANDLER;
  }).map(function(trigger) {
    return {
      id: trigger.getUniqueId(),
      handler: trigger.getHandlerFunction(),
      eventType: String(trigger.getEventType()),
      source: String(trigger.getTriggerSource())
    };
  });
}

function runScheduledAssignmentReminders() {
  return withLock_(function() {
    // Drive cleanup is deliberately processed before reminder work, but never
    // inside a user-facing delete request. A slow Drive API call must not make
    // the browser wait with its delete modal stuck on "刪除中…".
    var driveCleanup = processDeferredDriveTrashQueue_();
    var state = loadState_();
    var result = runScheduledAssignmentRemindersInternal_(state);
    var recycleCleanup = purgeExpiredRecycleBinEntries_(state);
    if (recycleCleanup.changed) {
      result.changed = true;
    }
    if (result.changed) {
      persistState_(state, { preserveRecycleBinState: false });
    } else {
      setupSheets_();
      var config = getConfig_();
      var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
      writeMetaSheet_(spreadsheet, state.Meta || {});
    }
    result.driveCleanup = driveCleanup;
    result.recycleCleanup = recycleCleanup;
    return result;
  });
}

function setupSheets() {
  return setupSheets_();
}

function seedDemoData() {
  return withLock_(function() {
    persistState_(buildDemoState_());
    return loadState_();
  });
}

function parsePayload_(e) {
  var payload = {};
  var raw = e && e.postData && e.postData.contents ? e.postData.contents : '';

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      payload = {
        rawBody: raw
      };
    }
  }

  if (payload && typeof payload.payload === 'string') {
    try {
      payload.payload = JSON.parse(payload.payload);
    } catch (ignoreError) {
    }
  }

  if (payload.payload && typeof payload.payload === 'object') {
    payload = Object.assign({}, payload, payload.payload);
    delete payload.payload;
  }

  return payload;
}

function getAction_(e, payload) {
  return String(
    (payload && payload.action) ||
    (e && e.parameter && e.parameter.action) ||
    'bootstrap'
  ).trim();
}

function buildHealthPayload_() {
  var config = getConfig_();
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  return {
    ok: true,
    spreadsheetId: config.spreadsheetId,
    spreadsheetName: spreadsheet.getName(),
    driveRootFolderId: config.driveRootFolderId,
    timeZone: config.timeZone,
    frontendBaseUrlConfigured: Boolean(config.frontendBaseUrl),
    mailSenderName: config.mailSenderName,
    mailReplyTo: config.mailReplyTo,
    mailFromAliasConfigured: Boolean(config.mailFromAlias),
    passwordResetExpiryMinutes: config.passwordResetExpiryMinutes,
    assignmentReminderTriggerCount: listAssignmentReminderTriggers().length,
    serverTime: nowString_()
  };
}

function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = props.getProperty('SPREADSHEET_ID') || APP_DEFAULTS.spreadsheetId;
  var driveRootFolderId = props.getProperty('DRIVE_ROOT_FOLDER_ID') || APP_DEFAULTS.driveRootFolderId;
  var timeZone = props.getProperty('APP_TIME_ZONE') || APP_DEFAULTS.timeZone;
  var frontendBaseUrl = String(props.getProperty('FRONTEND_BASE_URL') || APP_DEFAULTS.frontendBaseUrl || '').trim();
  var mailSenderName = String(props.getProperty('MAIL_SENDER_NAME') || APP_DEFAULTS.mailSenderName || '').trim();
  var mailReplyTo = String(props.getProperty('MAIL_REPLY_TO') || APP_DEFAULTS.mailReplyTo || '').trim();
  var mailFromAlias = String(props.getProperty('MAIL_FROM_ALIAS') || APP_DEFAULTS.mailFromAlias || '').trim();
  var passwordResetExpiryMinutes = Number(
    props.getProperty('PASSWORD_RESET_EXPIRY_MINUTES') || APP_DEFAULTS.passwordResetExpiryMinutes
  );

  if (!spreadsheetId || spreadsheetId === APP_DEFAULTS.spreadsheetId) {
    throw new Error('Missing SPREADSHEET_ID. Run saveScriptConfig(...) or set Script Properties first.');
  }

  if (!driveRootFolderId || driveRootFolderId === APP_DEFAULTS.driveRootFolderId) {
    throw new Error('Missing DRIVE_ROOT_FOLDER_ID. Run saveScriptConfig(...) or set Script Properties first.');
  }

  if (isNaN(passwordResetExpiryMinutes) || passwordResetExpiryMinutes <= 0) {
    passwordResetExpiryMinutes = APP_DEFAULTS.passwordResetExpiryMinutes;
  }

  return {
    spreadsheetId: spreadsheetId,
    driveRootFolderId: driveRootFolderId,
    timeZone: timeZone,
    frontendBaseUrl: frontendBaseUrl,
    mailSenderName: mailSenderName || APP_DEFAULTS.mailSenderName,
    mailReplyTo: mailReplyTo,
    mailFromAlias: mailFromAlias,
    passwordResetExpiryMinutes: passwordResetExpiryMinutes
  };
}

function setupSheets_() {
  var config = getConfig_();
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  var sheetNames = Object.keys(TABLE_SCHEMAS);

  sheetNames.forEach(function(sheetName) {
    ensureSheet_(spreadsheet, sheetName, TABLE_SCHEMAS[sheetName].headers);
  });

  return spreadsheet.getId();
}

function getStateCacheKey_() {
  return STATE_CACHE_PREFIX + String(getConfig_().spreadsheetId || '').trim();
}

function getCachedState_() {
  var cache = CacheService.getScriptCache();
  var cacheKey = getStateCacheKey_();
  var raw = cache.get(cacheKey);
  if (!raw) return null;

  try {
    return normalizeState_(JSON.parse(raw));
  } catch (error) {
    cache.remove(cacheKey);
    return null;
  }
}

function cacheState_(state) {
  try {
    var serialized = JSON.stringify(state || {});
    var byteSize = Utilities.newBlob(serialized).getBytes().length;
    var cache = CacheService.getScriptCache();
    var cacheKey = getStateCacheKey_();
    if (byteSize > STATE_CACHE_MAX_BYTES) {
      cache.remove(cacheKey);
      return false;
    }
    cache.put(cacheKey, serialized, STATE_CACHE_TTL_SECONDS);
    return true;
  } catch (error) {
    return false;
  }
}

function loadState_() {
  var cachedState = getCachedState_();
  if (cachedState) {
    return cachedState;
  }

  setupSheets_();

  var config = getConfig_();
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  var state = {
    Config_Stages: readTable_(spreadsheet, 'Config_Stages'),
    Users: readTable_(spreadsheet, 'Users'),
    Teams: readTable_(spreadsheet, 'Teams'),
    Purchase_Items: readTable_(spreadsheet, 'Purchase_Items'),
    Assignments: readTable_(spreadsheet, 'Assignments'),
    Assignment_Resources: readTable_(spreadsheet, 'Assignment_Resources'),
    Assignment_Submissions: readTable_(spreadsheet, 'Assignment_Submissions'),
    Files: readTable_(spreadsheet, 'Files'),
    Notifications: readTable_(spreadsheet, 'Notifications'),
    Discussion_Comments: readTable_(spreadsheet, 'Discussion_Comments'),
    Design_Service_Settings: readTable_(spreadsheet, 'Design_Service_Settings'),
    Design_Service_Orders: readTable_(spreadsheet, 'Design_Service_Orders'),
    Calendar_Events: readTable_(spreadsheet, 'Calendar_Events'),
    Work_Items: readTable_(spreadsheet, 'Work_Items'),
    Recycle_Bin: readTable_(spreadsheet, 'Recycle_Bin'),
    Meta: readMetaSheet_(spreadsheet)
  };

  var rawNotificationFingerprints = ensureArray_(state.Notifications).map(function(notification) {
    return buildNotificationNormalizationFingerprint_(notification);
  });
  state = normalizeState_(state);
  var didNormalizeNotifications = rawNotificationFingerprints.length !== ensureArray_(state.Notifications).length
    || ensureArray_(state.Notifications).some(function(notification, index) {
      return rawNotificationFingerprints[index] !== buildNotificationNormalizationFingerprint_(notification);
    });
  var didBackfillPurchaseDates = backfillPurchaseItemDates_(state);
  if (didNormalizeNotifications || didBackfillPurchaseDates) {
    writeStateTables_(spreadsheet, state);
  }

  cacheState_(state);
  return state;
}

function getStateRevision_(state) {
  var value = Number(state && state.Meta ? state.Meta.State_Revision : 0);
  return isNaN(value) || value < 0 ? 0 : Math.floor(value);
}

function persistState_(inputState, options) {
  options = options || {};
  setupSheets_();

  var state = normalizeState_(cloneObject_(inputState));
  var existingState = options.existingState || loadState_();
  state = mergeSensitiveState_(state, existingState, options);
  state.Meta = state.Meta && typeof state.Meta === 'object' ? state.Meta : {};
  state.Meta.State_Revision = typeof options.nextRevision === 'number'
    ? options.nextRevision
    : getStateRevision_(existingState) + 1;
  var assignmentEmailNotifications = sendPendingAssignmentAnnouncementEmails_(state);
  var config = getConfig_();
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);

  writeStateTables_(spreadsheet, state);

  return {
    assignmentEmailNotifications: assignmentEmailNotifications
  };
}

function loadActivityLogs_() {
  setupSheets_();
  var config = getConfig_();
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  return readTable_(spreadsheet, 'Activity_Logs').sort(function(a, b) {
    return String(b.Created_At || '').localeCompare(String(a.Created_At || ''));
  });
}

function appendActivityLogEntries_(entries) {
  var pendingEntries = ensureArray_(entries).filter(function(entry) {
    return entry && entry.Action && entry.Summary;
  });
  if (pendingEntries.length === 0) return;

  setupSheets_();
  var config = getConfig_();
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  var records = readTable_(spreadsheet, 'Activity_Logs');

  pendingEntries.forEach(function(entry) {
    var nextEntry = cloneObject_(entry);
    nextEntry.Log_ID = String(nextEntry.Log_ID || generateSequentialId_('AL', records, 'Log_ID'));
    nextEntry.Created_At = String(nextEntry.Created_At || nowString_());
    nextEntry.Actor_User_ID = String(nextEntry.Actor_User_ID || '');
    nextEntry.Actor_Name = String(nextEntry.Actor_Name || '系統');
    nextEntry.Actor_Role = String(nextEntry.Actor_Role || 'System');
    nextEntry.Action = String(nextEntry.Action || '系統異動');
    nextEntry.Summary = String(nextEntry.Summary || '系統資料已更新。');
    nextEntry.Target_Type = String(nextEntry.Target_Type || 'system');
    nextEntry.Target_ID = String(nextEntry.Target_ID || '');
    nextEntry.Severity = String(nextEntry.Severity || 'normal');
    nextEntry.Metadata = nextEntry.Metadata && typeof nextEntry.Metadata === 'object'
      ? nextEntry.Metadata
      : {};
    records.unshift(nextEntry);
  });

  records.sort(function(a, b) {
    return String(b.Created_At || '').localeCompare(String(a.Created_At || ''));
  });
  writeTable_(spreadsheet, 'Activity_Logs', records.slice(0, ACTIVITY_LOG_MAX_RECORDS));
}

function createActivityLogEntry_(actor, action, summary, targetType, targetId, severity, metadata) {
  return {
    Created_At: nowString_(),
    Actor_User_ID: actor ? String(actor.User_ID || '') : '',
    Actor_Name: actor ? String(actor.Name || '未具名使用者') : '系統',
    Actor_Role: actor ? String(actor.Role || '') : 'System',
    Action: String(action || '系統異動'),
    Summary: String(summary || '系統資料已更新。'),
    Target_Type: String(targetType || 'system'),
    Target_ID: String(targetId || ''),
    Severity: String(severity || 'normal'),
    Metadata: metadata && typeof metadata === 'object' ? metadata : {}
  };
}

function resolveAuditActor_(state, userId) {
  var targetId = String(userId || '').trim();
  if (!targetId) return null;
  return ensureArray_(state && state.Users).find(function(user) {
    return String(user.User_ID || '') === targetId;
  }) || null;
}

function isShapePrintUser_(user) {
  return Boolean(user) && ['SuperAdmin', 'Admin'].indexOf(String(user.Role || '')) >= 0;
}

function buildAuditComparableRecord_(record, excludedFields) {
  var copy = cloneObject_(record || {});
  ensureArray_(excludedFields).forEach(function(field) {
    delete copy[field];
  });
  return copy;
}

function buildAuditCollectionDelta_(beforeItems, afterItems, idField, excludedFields) {
  var beforeById = {};
  var afterById = {};
  ensureArray_(beforeItems).forEach(function(item) {
    var id = String(item && item[idField] || '');
    if (id) beforeById[id] = item;
  });
  ensureArray_(afterItems).forEach(function(item) {
    var id = String(item && item[idField] || '');
    if (id) afterById[id] = item;
  });

  var created = Object.keys(afterById).filter(function(id) {
    return !beforeById[id];
  });
  var deleted = Object.keys(beforeById).filter(function(id) {
    return !afterById[id];
  });
  var updated = Object.keys(afterById).filter(function(id) {
    return beforeById[id]
      && JSON.stringify(buildAuditComparableRecord_(beforeById[id], excludedFields))
        !== JSON.stringify(buildAuditComparableRecord_(afterById[id], excludedFields));
  });

  return {
    created: created,
    deleted: deleted,
    updated: updated,
    afterById: afterById,
    beforeById: beforeById
  };
}

function describeAuditTargets_(ids, recordsById, labelField) {
  return ensureArray_(ids).slice(0, 2).map(function(id) {
    var record = recordsById[id] || {};
    return String(record[labelField] || id);
  }).join('、');
}

function buildStateAuditEntries_(beforeState, afterState, actor) {
  if (!actor) return [];

  var collections = [
    { key: 'Config_Stages', idField: 'Stage_ID', label: '會審期數', labelField: 'Stage_Name', targetType: 'stage' },
    { key: 'Purchase_Items', idField: 'Item_ID', label: '印刷品項', labelField: 'Item_Name', targetType: 'purchase' },
    { key: 'Assignments', idField: 'Assignment_ID', label: '繳交項目', labelField: 'Title', targetType: 'assignment' },
    { key: 'Assignment_Submissions', idField: 'Submission_ID', label: '繳交紀錄', labelField: 'File_Name', targetType: 'submission' },
    { key: 'Files', idField: 'File_ID', label: '檔案紀錄', labelField: 'File_Name', targetType: 'file' },
    { key: 'Work_Items', idField: 'Work_Item_ID', label: '工作事項', labelField: 'Title', targetType: 'work-item' },
    { key: 'Users', idField: 'User_ID', label: '帳號與角色', labelField: 'Name', targetType: 'user', excludedFields: ['Password'] },
    { key: 'Teams', idField: 'Team_ID', label: '小組資料', labelField: 'Team_Name', targetType: 'team' }
  ];

  var entries = [];
  collections.forEach(function(config) {
    var delta = buildAuditCollectionDelta_(
      beforeState && beforeState[config.key],
      afterState && afterState[config.key],
      config.idField,
      config.excludedFields
    );
    var total = delta.created.length + delta.deleted.length + delta.updated.length;
    if (total === 0) return;

    var action = '更新' + config.label;
    var sourceIds = delta.updated;
    var sourceRecords = delta.afterById;
    if (delta.created.length > 0 && delta.deleted.length === 0 && delta.updated.length === 0) {
      action = '新增' + config.label;
      sourceIds = delta.created;
    } else if (delta.deleted.length > 0 && delta.created.length === 0 && delta.updated.length === 0) {
      action = '刪除' + config.label;
      sourceIds = delta.deleted;
      sourceRecords = delta.beforeById;
    }

    var parts = [];
    if (delta.created.length) parts.push('新增 ' + delta.created.length + ' 筆');
    if (delta.updated.length) parts.push('更新 ' + delta.updated.length + ' 筆');
    if (delta.deleted.length) parts.push('刪除 ' + delta.deleted.length + ' 筆');
    var targetText = describeAuditTargets_(sourceIds, sourceRecords, config.labelField);
    var summary = config.label + '已異動：' + parts.join('、') + (targetText ? '（' + targetText + '）' : '');

    entries.push(createActivityLogEntry_(
      actor,
      action,
      summary,
      config.targetType,
      sourceIds[0] || '',
      delta.deleted.length > 0 ? 'warning' : 'normal',
      {
        source: 'saveState',
        createdIds: delta.created,
        updatedIds: delta.updated,
        deletedIds: delta.deleted
      }
    ));
  });

  return entries;
}

function handleBootstrap_(payload) {
  var state = loadState_();
  var sessionContext = requireSessionContext_(state, payload);
  return buildClientStateResultForUser_(state, sessionContext.user, {
    sessionExpiresAt: sessionContext.session.Expires_At
  }, {
    // The dashboard can render before the activity matrix arrives. This keeps
    // normal workspace loading responsive when the workbook has many records.
    includeHeatmap: !(payload && (payload.includeHeatmap === false || String(payload.includeHeatmap) === 'false'))
  });
}

function handleHeatmap_(payload) {
  var state = loadState_();
  var sessionContext = requireSessionContext_(state, payload);
  return {
    heatmap: buildHeatmapStats_(buildHeatmapSourceStateForUser_(state, sessionContext.user)),
    stateRevision: getStateRevision_(state)
  };
}

function assertExpectedStateRevision_(payload, state) {
  var expected = Number(payload && payload.stateRevision);
  var current = getStateRevision_(state);
  if (isNaN(expected) || expected !== current) {
    throw new Error('STATE_CONFLICT: 雲端資料已被其他使用者更新，系統已停止本次覆蓋，請重新載入後再操作。');
  }
}

function buildComparableCollection_(items, idField, excludedFields) {
  return ensureArray_(items).map(function(item) {
    return buildAuditComparableRecord_(item, excludedFields);
  }).sort(function(a, b) {
    return String(a[idField] || '').localeCompare(String(b[idField] || ''));
  });
}

function assertCollectionUnchanged_(existing, incoming, key, idField, excludedFields) {
  var before = JSON.stringify(buildComparableCollection_(existing[key], idField, excludedFields));
  var after = JSON.stringify(buildComparableCollection_(incoming[key], idField, excludedFields));
  if (before !== after) {
    throw new Error('FORBIDDEN: 你沒有修改「' + key + '」的權限。');
  }
}

function cloneServerMeta_(state) {
  return cloneObject_(state && state.Meta && typeof state.Meta === 'object' ? state.Meta : {});
}

function preserveDesignServiceState_(nextState, existingState) {
  nextState.Design_Service_Settings = cloneObject_(ensureArray_(existingState && existingState.Design_Service_Settings));
  nextState.Design_Service_Orders = cloneObject_(ensureArray_(existingState && existingState.Design_Service_Orders));
  return nextState;
}

function mergeOwnNotificationReadState_(nextState, incomingState, user) {
  var incomingById = {};
  ensureArray_(incomingState.Notifications).forEach(function(notification) {
    if (String(notification.User_ID || '') === String(user.User_ID || '')) {
      incomingById[String(notification.Notification_ID || '')] = notification;
    }
  });
  nextState.Notifications.forEach(function(notification) {
    var incoming = incomingById[String(notification.Notification_ID || '')];
    if (incoming && String(notification.User_ID || '') === String(user.User_ID || '') && incoming.Read === true) {
      notification.Read = true;
    }
  });
}

function getStudentDiscussionContext_(state, comment, teamId) {
  var refType = String(comment && comment.Ref_Type || '');
  var refId = String(comment && comment.Ref_ID || '');
  if (refType === 'assignment') {
    var assignment = ensureArray_(state.Assignments).find(function(item) {
      return String(item.Assignment_ID || '') === refId;
    });
    return assignment && isAssignmentVisibleToTeam_(state, assignment, teamId) ? assignment : null;
  }
  if (refType === 'file-group') {
    var file = ensureArray_(state.Files).find(function(item) {
      return String(item.File_Group_Key || '') === refId && String(item.Team_ID || '') === teamId;
    });
    return file || null;
  }
  return null;
}

function mergeStudentDiscussionComments_(nextState, incomingState, actor) {
  var existingIds = {};
  ensureArray_(nextState.Discussion_Comments).forEach(function(comment) {
    existingIds[String(comment.Comment_ID || '')] = true;
  });

  ensureArray_(incomingState.Discussion_Comments).forEach(function(comment) {
    var requestedId = String(comment && comment.Comment_ID || '');
    if (requestedId && existingIds[requestedId]) return;
    if (String(comment && comment.Kind || 'comment') === 'system') return;
    var message = String(comment && comment.Message || '').trim();
    var context = getStudentDiscussionContext_(nextState, comment, actor.Team_ID);
    if (!message || !context) return;

    var canonical = hydrateDiscussionCommentRecord_({
      Comment_ID: generateSequentialId_('CMT', nextState.Discussion_Comments, 'Comment_ID'),
      Ref_Type: comment.Ref_Type,
      Ref_ID: comment.Ref_ID,
      User_ID: actor.User_ID,
      Team_ID: actor.Team_ID,
      Author_Name: actor.Name,
      Author_Role: actor.Role,
      Kind: 'comment',
      Message: message.slice(0, 5000),
      Created_At: nowString_()
    });
    nextState.Discussion_Comments.push(canonical);
    createNotifications_(nextState, {
      type: 'discussion-comment',
      title: '小組留言回覆',
      message: '「' + (context.Title || context.File_Name || '繳交項目') + '」有新的小組留言。',
      tab: 'files',
      refType: canonical.Ref_Type,
      refId: canonical.Ref_ID,
      audience: { roles: ['SuperAdmin', 'Admin'], excludeUserIds: [actor.User_ID] },
      createdAt: canonical.Created_At,
      priority: 'normal'
    });
  });
}

function mergeStudentSubmissions_(nextState, incomingState, actor) {
  var existingIds = {};
  ensureArray_(nextState.Assignment_Submissions).forEach(function(submission) {
    existingIds[String(submission.Submission_ID || '')] = true;
  });

  ensureArray_(incomingState.Assignment_Submissions).forEach(function(candidate) {
    var requestedId = String(candidate && candidate.Submission_ID || '');
    if (requestedId && existingIds[requestedId]) return;
    if (String(candidate && candidate.Team_ID || '') !== String(actor.Team_ID || '')) return;
    var assignment = ensureArray_(nextState.Assignments).find(function(item) {
      return String(item.Assignment_ID || '') === String(candidate.Assignment_ID || '');
    });
    if (!assignment || !isAssignmentVisibleToTeam_(nextState, assignment, actor.Team_ID)) return;

    var existingForAssignment = ensureArray_(nextState.Assignment_Submissions).filter(function(item) {
      return String(item.Assignment_ID || '') === String(assignment.Assignment_ID || '')
        && String(item.Team_ID || '') === String(actor.Team_ID || '');
    });
    var latestExistingSubmission = existingForAssignment.slice().sort(function(a, b) {
      var numberDiff = Number(b.Submission_No || 1) - Number(a.Submission_No || 1);
      if (numberDiff !== 0) return numberDiff;
      return String(b.Submitted_At || '').localeCompare(String(a.Submitted_At || ''));
    })[0] || null;
    if (latestExistingSubmission && (assignment.Allow_ReSubmit !== true || !isAssignmentSubmissionRejected_(latestExistingSubmission))) {
      throw new Error('FORBIDDEN: 只有被退回修正後，才能重新繳交。');
    }

    var requiresFile = assignment.Submission_Mode === 'file' || assignment.Submission_Mode === 'file-text';
    var requiresText = assignment.Submission_Mode === 'text' || assignment.Submission_Mode === 'file-text';
    var fileName = String(candidate.File_Name || '').trim();
    var textContent = String(candidate.Text_Content || '').trim();
    if ((requiresFile && !fileName) || (requiresText && !textContent)) {
      throw new Error('請完成繳交項目要求的檔案或文字內容。');
    }

    var submissionNo = existingForAssignment.reduce(function(max, item) {
      return Math.max(max, Number(item.Submission_No || 0));
    }, 0) + 1;
    var createdAt = nowString_();
    var submission = hydrateAssignmentSubmissionRecord_({
      Submission_ID: generateSequentialId_('SUB', nextState.Assignment_Submissions, 'Submission_ID'),
      Assignment_ID: assignment.Assignment_ID,
      User_ID: actor.User_ID,
      Team_ID: actor.Team_ID,
      Submission_No: submissionNo,
      Submission_Mode: assignment.Submission_Mode,
      File_Name: requiresFile ? fileName : '',
      Google_Drive_URL: requiresFile ? String(candidate.Google_Drive_URL || '') : '',
      Text_Content: requiresText ? textContent.slice(0, 10000) : '',
      Submitted_At: createdAt,
      Updated_At: createdAt,
      Status: '已繳交',
      Notes: '',
      Drive_File_ID: requiresFile ? String(candidate.Drive_File_ID || '') : '',
      Drive_Folder_ID: requiresFile ? String(candidate.Drive_Folder_ID || '') : ''
    });
    nextState.Assignment_Submissions.unshift(submission);
    createNotifications_(nextState, {
      type: 'assignment-submit',
      title: '小組已繳交作業',
      message: '「' + assignment.Title + '」已有新的繳交紀錄。',
      tab: 'files',
      refType: 'assignment',
      refId: assignment.Assignment_ID,
      audience: { roles: ['SuperAdmin', 'Admin'] },
      createdAt: createdAt,
      priority: 'normal'
    });
    nextState.Discussion_Comments.push(hydrateDiscussionCommentRecord_({
      Comment_ID: generateSequentialId_('CMT', nextState.Discussion_Comments, 'Comment_ID'),
      Ref_Type: 'assignment',
      Ref_ID: assignment.Assignment_ID,
      User_ID: '',
      Team_ID: actor.Team_ID,
      Author_Name: '形印系統',
      Author_Role: 'System',
      Kind: 'system',
      Message: actor.Name + ' 已完成第 ' + submissionNo + ' 次繳交。',
      Created_At: createdAt
    }));
  });
}

function mergeLeaderInvites_(nextState, incomingState, actor) {
  if (String(actor.Role || '') !== 'Leader') return;
  var emails = {};
  nextState.Users.forEach(function(user) {
    emails[normalizeEmail_(user.Email)] = true;
  });
  ensureArray_(incomingState.Users).forEach(function(candidate) {
    var requestedId = String(candidate && candidate.User_ID || '');
    var alreadyExists = nextState.Users.some(function(user) {
      return String(user.User_ID || '') === requestedId;
    });
    if (alreadyExists) return;
    var email = normalizeEmail_(candidate && candidate.Email);
    if (!email || emails[email]) return;
    if (String(candidate && candidate.Team_ID || '') !== String(actor.Team_ID || '')) return;
    var user = {
      User_ID: generateSequentialId_('U', nextState.Users, 'User_ID'),
      Email: email,
      Password: '',
      Name: String(candidate && candidate.Name || '待開通成員').slice(0, 120),
      Team_ID: actor.Team_ID,
      Role: 'Member',
      Status: 'Pending'
    };
    nextState.Users.push(user);
    emails[email] = true;
  });
}

function mergeClientStateForActor_(existingState, incomingState, actor) {
  var existing = normalizeState_(cloneObject_(existingState));
  var incoming = normalizeState_(cloneObject_(incomingState));
  var nextState;

  if (String(actor.Role || '') === 'SuperAdmin') {
    nextState = incoming;
    preserveDesignServiceState_(nextState, existing);
    nextState.Meta = cloneServerMeta_(existing);
    return nextState;
  }

  if (String(actor.Role || '') === 'Admin') {
    ['Config_Stages', 'Users', 'Teams', 'Files', 'Assignment_Submissions'].forEach(function(key) {
      var idField = key === 'Config_Stages' ? 'Stage_ID'
        : key === 'Users' ? 'User_ID'
        : key === 'Teams' ? 'Team_ID'
        : key === 'Files' ? 'File_ID'
        : 'Submission_ID';
      assertCollectionUnchanged_(existing, incoming, key, idField, key === 'Users' ? ['Password'] : []);
    });
    nextState = existing;
    nextState.Purchase_Items = incoming.Purchase_Items;
    nextState.Assignments = incoming.Assignments;
    nextState.Discussion_Comments = incoming.Discussion_Comments;
    mergeOwnNotificationReadState_(nextState, incoming, actor);
    preserveDesignServiceState_(nextState, existing);
    nextState.Meta = cloneServerMeta_(existing);
    return nextState;
  }

  nextState = existing;
  mergeStudentSubmissions_(nextState, incoming, actor);
  mergeStudentDiscussionComments_(nextState, incoming, actor);
  mergeLeaderInvites_(nextState, incoming, actor);
  mergeOwnNotificationReadState_(nextState, incoming, actor);
  preserveDesignServiceState_(nextState, existing);
  nextState.Meta = cloneServerMeta_(existing);
  return nextState;
}

function handleSaveState_(payload) {
  if (!payload.state || typeof payload.state !== 'object') {
    throw new Error('Missing `state` payload for saveState.');
  }
  var previousState = loadState_();
  var actor = requireSessionUser_(previousState, payload);
  assertExpectedStateRevision_(payload, previousState);
  var mergedState = mergeClientStateForActor_(previousState, payload.state, actor);
  var persistResult = persistState_(mergedState, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1
  });
  var nextState = loadState_();
  appendActivityLogEntries_(buildStateAuditEntries_(previousState, nextState, actor));
  return buildClientStateResultForUser_(nextState, actor, {
    assignmentEmailNotifications: persistResult && persistResult.assignmentEmailNotifications
      ? persistResult.assignmentEmailNotifications
      : []
  });
}

// Switch the active review stage in one server-side transaction. This avoids
// relying on the browser's generic state save, which can be stale or rejected
// for a role that is not allowed to replace the entire configuration table.
function handleActivateStage_(payload) {
  var previousState = loadState_();
  var actor = requireSessionUser_(previousState, payload, ['SuperAdmin', 'Admin']);
  assertExpectedStateRevision_(payload, previousState);

  var stageId = String(payload && payload.stageId || '').trim();
  if (!stageId) {
    throw new Error('activateStage requires `stageId`.');
  }

  var targetStage = ensureArray_(previousState.Config_Stages).find(function(stage) {
    return String(stage && stage.Stage_ID || '') === stageId;
  });
  if (!targetStage) {
    throw new Error('NOT_FOUND: 找不到要設為活躍的會審期數，資料可能已被其他使用者更新。');
  }

  var previousActiveStage = ensureArray_(previousState.Config_Stages).find(function(stage) {
    return stage && stage.Is_Active === true;
  }) || null;
  if (targetStage.Is_Active === true && previousActiveStage && String(previousActiveStage.Stage_ID || '') === stageId) {
    return buildClientStateResultForUser_(previousState, actor, { activeStage: targetStage });
  }

  var nextState = cloneObject_(previousState);
  nextState.Config_Stages = ensureArray_(nextState.Config_Stages).map(function(stage) {
    var nextStage = cloneObject_(stage);
    nextStage.Is_Active = String(nextStage.Stage_ID || '') === stageId;
    return nextStage;
  });

  persistState_(nextState, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1
  });

  var savedState = loadState_();
  var savedActiveStage = ensureArray_(savedState.Config_Stages).find(function(stage) {
    return String(stage && stage.Stage_ID || '') === stageId;
  }) || targetStage;
  appendActivityLogEntries_([
    createActivityLogEntry_(
      actor,
      '切換活躍會審',
      '已將目前作用中的會審切換為「' + String(savedActiveStage.Stage_Name || stageId) + '」。',
      'stage',
      stageId,
      'normal',
      {
        source: 'activateStage',
        previousStageId: previousActiveStage ? String(previousActiveStage.Stage_ID || '') : '',
        previousStageName: previousActiveStage ? String(previousActiveStage.Stage_Name || '') : ''
      }
    )
  ]);
  return buildClientStateResultForUser_(savedState, actor, { activeStage: savedActiveStage });
}

// Delete one purchase record from the latest server state so a stale browser
// snapshot can never restore it after the action has completed.
function handleDeletePurchaseItem_(payload) {
  var previousState = loadState_();
  var actor = requireSessionUser_(previousState, payload, ['SuperAdmin', 'Admin']);
  var itemId = String(payload && payload.itemId || '').trim();

  if (!itemId) {
    throw new Error('deletePurchaseItem requires `itemId`.');
  }

  var targetItem = ensureArray_(previousState.Purchase_Items).find(function(item) {
    return String(item && item.Item_ID || '') === itemId;
  });

  if (!targetItem) {
    throw new Error('NOT_FOUND: 找不到要刪除的發包品項，資料可能已被其他使用者更新。');
  }

  var nextState = cloneObject_(previousState);
  nextState.Purchase_Items = ensureArray_(nextState.Purchase_Items).filter(function(item) {
    return String(item && item.Item_ID || '') !== itemId;
  });
  var recycleEntry = buildRecycleBinEntry_(
    nextState,
    actor,
    'purchase-item',
    itemId,
    String(targetItem.Item_Name || itemId),
    buildRecycleSnapshot_({ Purchase_Items: [targetItem] }),
    []
  );

  persistState_(nextState, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveRecycleBinState: false
  });

  var savedState = loadState_();
  appendActivityLogEntries_(buildStateAuditEntries_(previousState, savedState, actor));

  return buildClientStateResultForUser_(savedState, actor, {
    deletedItem: targetItem,
    recycleBinItem: recycleEntry
  });
}

// Delete one assignment in a locked server transaction. Related submissions,
// notifications, discussion comments, service orders, reminder entries, and
// uploaded Drive files are removed together so the browser cannot restore a
// half-deleted assignment with a later saveState request.
function handleDeleteAssignment_(payload) {
  var previousState = loadState_();
  var actor = requireSessionUser_(previousState, payload, ['SuperAdmin', 'Admin']);
  assertExpectedStateRevision_(payload, previousState);

  var assignmentId = String(payload && payload.assignmentId || '').trim();
  if (!assignmentId) {
    throw new Error('deleteAssignment requires `assignmentId`.');
  }

  var targetAssignment = ensureArray_(previousState.Assignments).find(function(assignment) {
    return String(assignment && assignment.Assignment_ID || '') === assignmentId;
  });
  if (!targetAssignment) {
    throw new Error('NOT_FOUND: 找不到要刪除的繳交項目，資料可能已被其他使用者更新。');
  }

  var submissions = ensureArray_(previousState.Assignment_Submissions).filter(function(submission) {
    return String(submission && submission.Assignment_ID || '') === assignmentId;
  });
  var resources = ensureArray_(previousState.Assignment_Resources).filter(function(resource) {
    return String(resource && resource.Assignment_ID || '') === assignmentId;
  });
  var notifications = ensureArray_(previousState.Notifications).filter(function(notification) {
    return String(notification && notification.Ref_Type || '') === 'assignment'
      && String(notification && notification.Ref_ID || '') === assignmentId;
  });
  var discussionComments = ensureArray_(previousState.Discussion_Comments).filter(function(comment) {
    return String(comment && comment.Ref_Type || '') === 'assignment'
      && String(comment && comment.Ref_ID || '') === assignmentId;
  });
  var serviceOrders = ensureArray_(previousState.Design_Service_Orders).filter(function(order) {
    return String(order && order.Assignment_ID || '') === assignmentId;
  });
  var driveFileIds = {};

  submissions.concat(serviceOrders, resources).forEach(function(record) {
    var fileId = String(record && record.Drive_File_ID || '').trim();
    if (!fileId) {
      fileId = extractDriveFileId_(record && record.Google_Drive_URL);
    }
    if (fileId) {
      driveFileIds[fileId] = true;
    }
  });

  var nextState = cloneObject_(previousState);
  nextState.Assignments = ensureArray_(nextState.Assignments).filter(function(assignment) {
    return String(assignment && assignment.Assignment_ID || '') !== assignmentId;
  });
  nextState.Assignment_Resources = ensureArray_(nextState.Assignment_Resources).filter(function(resource) {
    return String(resource && resource.Assignment_ID || '') !== assignmentId;
  });
  nextState.Assignment_Submissions = ensureArray_(nextState.Assignment_Submissions).filter(function(submission) {
    return String(submission && submission.Assignment_ID || '') !== assignmentId;
  });
  nextState.Notifications = ensureArray_(nextState.Notifications).filter(function(notification) {
    return !(String(notification && notification.Ref_Type || '') === 'assignment'
      && String(notification && notification.Ref_ID || '') === assignmentId);
  });
  nextState.Discussion_Comments = ensureArray_(nextState.Discussion_Comments).filter(function(comment) {
    return !(String(comment && comment.Ref_Type || '') === 'assignment'
      && String(comment && comment.Ref_ID || '') === assignmentId);
  });
  nextState.Design_Service_Orders = ensureArray_(nextState.Design_Service_Orders).filter(function(order) {
    return String(order && order.Assignment_ID || '') !== assignmentId;
  });

  nextState.Meta = nextState.Meta && typeof nextState.Meta === 'object' ? nextState.Meta : {};
  var reminderLog = getAssignmentReminderLog_(nextState);
  var removedReminderCount = 0;
  var removedReminderLog = {};
  Object.keys(reminderLog).forEach(function(key) {
    var reminderAssignmentId = String(
      reminderLog[key] && reminderLog[key].assignmentId || key.split('|')[0] || ''
    );
    if (reminderAssignmentId === assignmentId) {
      removedReminderLog[key] = cloneObject_(reminderLog[key]);
      delete reminderLog[key];
      removedReminderCount += 1;
    }
  });
  nextState.Meta[ASSIGNMENT_REMINDER_LOG_META_KEY] = reminderLog;
  var recycleEntry = buildRecycleBinEntry_(
    nextState,
    actor,
    'assignment',
    assignmentId,
    String(targetAssignment.Title || assignmentId),
    buildRecycleSnapshot_({
      Assignments: [targetAssignment],
      Assignment_Resources: resources,
      Assignment_Submissions: submissions,
      Notifications: notifications,
      Discussion_Comments: discussionComments,
      Design_Service_Orders: serviceOrders
    }, {
      assignmentReminderLog: removedReminderLog
    }),
    Object.keys(driveFileIds)
  );

  persistState_(nextState, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveDesignServiceState: false,
    preserveAssignmentResourceState: false,
    preserveRecycleBinState: false
  });

  var persistedState = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(
      actor,
      '刪除繳交項目',
      '已刪除「' + String(targetAssignment.Title || assignmentId) + '」及其相關資料。',
      'assignment',
      assignmentId,
      'warning',
      {
        source: 'deleteAssignment',
        assignmentId: assignmentId,
        resourceCount: resources.length,
        submissionCount: submissions.length,
        notificationCount: notifications.length,
        discussionCommentCount: discussionComments.length,
        serviceOrderCount: serviceOrders.length,
        reminderCount: removedReminderCount,
        driveFileCount: Object.keys(driveFileIds).length
      }
    )
  ]);

  var driveTrashSummary = enqueueDeferredDriveTrash_(Object.keys(driveFileIds));

  return buildClientStateResultForUser_(persistedState, actor, {
    deletedAssignment: targetAssignment,
    deletedAssignmentSummary: {
      assignmentCount: 1,
      resourceCount: resources.length,
      submissionCount: submissions.length,
      notificationCount: notifications.length,
      discussionCommentCount: discussionComments.length,
      serviceOrderCount: serviceOrders.length,
      reminderCount: removedReminderCount,
      driveFileCount: Object.keys(driveFileIds).length
    },
    recycleBinItem: recycleEntry,
    driveTrashSummary: driveTrashSummary
  });
}

// Calendar events are deliberately handled through dedicated actions. This
// keeps a stale browser-wide saveState request from restoring deleted events.
function assertShapePrintCalendarAccess_(actor) {
  if (!isShapePrintUser_(actor)) {
    throw new Error('FORBIDDEN: 只有形印組可以管理工作行事曆。');
  }
}

function normalizeCalendarEventDateTime_(value, label, required) {
  var raw = String(value || '').trim().replace('T', ' ');
  if (!raw) {
    if (required) {
      throw new Error((label || '時間') + '不可留空。');
    }
    return '';
  }

  var match = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!match) {
    throw new Error((label || '時間') + '格式不正確，請使用日期與時間。');
  }

  var year = Number(match[1]);
  var month = Number(match[2]);
  var day = Number(match[3]);
  var hour = typeof match[4] === 'undefined' ? 0 : Number(match[4]);
  var minute = typeof match[5] === 'undefined' ? 0 : Number(match[5]);
  var parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day
      || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error((label || '時間') + '不是有效日期。');
  }

  return [
    padNumber_(year, 4), '-', padNumber_(month, 2), '-', padNumber_(day, 2), ' ',
    padNumber_(hour, 2), ':', padNumber_(minute, 2)
  ].join('');
}

function calendarEventTimestamp_(value) {
  var normalized = normalizeCalendarEventDateTime_(value, '時間', true);
  var parts = normalized.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  return new Date(
    Number(parts[1]),
    Number(parts[2]) - 1,
    Number(parts[3]),
    Number(parts[4]),
    Number(parts[5]),
    0,
    0
  ).getTime();
}

function hydrateCalendarEventRecord_(event) {
  if (!event || typeof event !== 'object') {
    event = {};
  }

  event.Event_ID = String(event.Event_ID || '');
  event.Stage_ID = String(event.Stage_ID || '');
  event.Title = String(event.Title || '').trim();
  event.Description = String(event.Description || '').trim();
  event.Starts_At = String(event.Starts_At || '').trim().replace('T', ' ');
  event.Ends_At = String(event.Ends_At || '').trim().replace('T', ' ');
  event.All_Day = event.All_Day === true || String(event.All_Day || '').toLowerCase() === 'true';
  event.Event_Type = String(event.Event_Type || 'meeting');
  event.Created_At = String(event.Created_At || '');
  event.Updated_At = String(event.Updated_At || event.Created_At || '');
  event.Created_By_User_ID = String(event.Created_By_User_ID || '');
  event.Updated_By_User_ID = String(event.Updated_By_User_ID || event.Created_By_User_ID || '');

  return event;
}

function hydrateWorkItemRecord_(item) {
  if (!item || typeof item !== 'object') {
    item = {};
  }

  item.Work_Item_ID = String(item.Work_Item_ID || '');
  item.Stage_ID = String(item.Stage_ID || '');
  item.Title = String(item.Title || '').trim();
  item.Description = String(item.Description || '').trim();
  item.Due_At = String(item.Due_At || '').trim().replace('T', ' ');
  item.Priority = ['高', '一般', '低'].indexOf(String(item.Priority || '')) >= 0
    ? String(item.Priority)
    : '一般';
  item.Status = ['待認養', '待處理', '進行中', '已完成'].indexOf(String(item.Status || '')) >= 0
    ? String(item.Status)
    : (String(item.Assigned_To_User_ID || '').trim() ? '待處理' : '待認養');
  item.Created_At = String(item.Created_At || '');
  item.Created_By_User_ID = String(item.Created_By_User_ID || '');
  item.Created_By_Name = String(item.Created_By_Name || '');
  item.Assigned_To_User_ID = String(item.Assigned_To_User_ID || '');
  item.Assigned_To_Name = String(item.Assigned_To_Name || '');
  item.Assigned_At = String(item.Assigned_At || '');
  item.Claimed_At = String(item.Claimed_At || '');
  item.Started_At = String(item.Started_At || '');
  item.Completed_At = String(item.Completed_At || '');
  item.Completed_By_User_ID = String(item.Completed_By_User_ID || '');
  item.Updated_At = String(item.Updated_At || item.Created_At || '');
  item.Updated_By_User_ID = String(item.Updated_By_User_ID || item.Created_By_User_ID || '');

  return item;
}

function hydrateRecycleBinRecord_(entry) {
  if (!entry || typeof entry !== 'object') {
    entry = {};
  }

  entry.Recycle_ID = String(entry.Recycle_ID || '');
  entry.Entity_Type = String(entry.Entity_Type || '');
  entry.Entity_ID = String(entry.Entity_ID || '');
  entry.Title = String(entry.Title || '未命名項目');
  entry.Snapshot_JSON = entry.Snapshot_JSON && typeof entry.Snapshot_JSON === 'object'
    ? entry.Snapshot_JSON
    : {};
  entry.Drive_File_IDs = ensureArray_(entry.Drive_File_IDs).map(function(fileId) {
    return String(fileId || '').trim();
  }).filter(function(fileId, index, list) {
    return fileId && list.indexOf(fileId) === index;
  });
  entry.Deleted_At = String(entry.Deleted_At || '');
  entry.Deleted_By_User_ID = String(entry.Deleted_By_User_ID || '');
  entry.Deleted_By_Name = String(entry.Deleted_By_Name || '');
  entry.Expires_At = String(entry.Expires_At || '');
  entry.Status = String(entry.Status || 'deleted');
  entry.Restored_At = String(entry.Restored_At || '');
  entry.Restored_By_User_ID = String(entry.Restored_By_User_ID || '');

  return entry;
}

function buildCalendarEventFromPayload_(payload, actor, existingEvent) {
  var title = String(payload && payload.title || '').trim();
  if (!title) {
    throw new Error('請輸入事件名稱。');
  }
  if (title.length > 120) {
    throw new Error('事件名稱請控制在 120 個字以內。');
  }

  var description = String(payload && payload.description || '').trim();
  if (description.length > 1000) {
    throw new Error('事件說明請控制在 1,000 個字以內。');
  }

  var startsAt = normalizeCalendarEventDateTime_(payload && payload.startsAt, '開始時間', true);
  var endsAt = normalizeCalendarEventDateTime_(payload && payload.endsAt, '結束時間', true);
  if (calendarEventTimestamp_(endsAt) < calendarEventTimestamp_(startsAt)) {
    throw new Error('結束時間不能早於開始時間。');
  }

  var allowedTypes = ['meeting', 'production', 'review', 'print', 'reminder'];
  var eventType = String(payload && payload.eventType || 'meeting');
  if (allowedTypes.indexOf(eventType) < 0) {
    eventType = 'meeting';
  }

  var stageId = String(payload && payload.stageId || '').trim();
  var now = nowString_();
  return hydrateCalendarEventRecord_({
    Event_ID: existingEvent ? existingEvent.Event_ID : '',
    Stage_ID: stageId,
    Title: title,
    Description: description,
    Starts_At: startsAt,
    Ends_At: endsAt,
    All_Day: payload && payload.allDay === true,
    Event_Type: eventType,
    Created_At: existingEvent ? existingEvent.Created_At : now,
    Updated_At: now,
    Created_By_User_ID: existingEvent ? existingEvent.Created_By_User_ID : actor.User_ID,
    Updated_By_User_ID: actor.User_ID
  });
}

function handleCreateCalendarEvent_(payload) {
  var previousState = loadState_();
  var actor = requireSessionUser_(previousState, payload, ['SuperAdmin', 'Admin']);
  assertShapePrintCalendarAccess_(actor);
  assertExpectedStateRevision_(payload, previousState);

  var nextState = cloneObject_(previousState);
  var event = buildCalendarEventFromPayload_(payload, actor, null);
  event.Event_ID = generateSequentialId_('CE', nextState.Calendar_Events, 'Event_ID');
  nextState.Calendar_Events.unshift(event);

  persistState_(nextState, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveCalendarEventState: false
  });

  var savedState = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(
      actor,
      '新增工作行事曆事件',
      '已新增「' + event.Title + '」。',
      'calendar-event',
      event.Event_ID,
      'normal',
      { source: 'createCalendarEvent', stageId: event.Stage_ID, eventType: event.Event_Type }
    )
  ]);
  return buildClientStateResultForUser_(savedState, actor, { calendarEvent: event });
}

function handleUpdateCalendarEvent_(payload) {
  var previousState = loadState_();
  var actor = requireSessionUser_(previousState, payload, ['SuperAdmin', 'Admin']);
  assertShapePrintCalendarAccess_(actor);
  assertExpectedStateRevision_(payload, previousState);

  var eventId = String(payload && payload.eventId || '').trim();
  var existingEvent = ensureArray_(previousState.Calendar_Events).find(function(event) {
    return String(event && event.Event_ID || '') === eventId;
  });
  if (!existingEvent) {
    throw new Error('NOT_FOUND: 找不到要編輯的行事曆事件，請重新整理後再試。');
  }

  var nextEvent = buildCalendarEventFromPayload_(payload, actor, existingEvent);
  var nextState = cloneObject_(previousState);
  nextState.Calendar_Events = ensureArray_(nextState.Calendar_Events).map(function(event) {
    return String(event && event.Event_ID || '') === eventId ? nextEvent : event;
  });

  persistState_(nextState, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveCalendarEventState: false
  });

  var savedState = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(
      actor,
      '更新工作行事曆事件',
      '已更新「' + nextEvent.Title + '」。',
      'calendar-event',
      eventId,
      'normal',
      { source: 'updateCalendarEvent', stageId: nextEvent.Stage_ID, eventType: nextEvent.Event_Type }
    )
  ]);
  return buildClientStateResultForUser_(savedState, actor, { calendarEvent: nextEvent });
}

function handleDeleteCalendarEvent_(payload) {
  var previousState = loadState_();
  var actor = requireSessionUser_(previousState, payload, ['SuperAdmin', 'Admin']);
  assertShapePrintCalendarAccess_(actor);
  assertExpectedStateRevision_(payload, previousState);

  var eventId = String(payload && payload.eventId || '').trim();
  var existingEvent = ensureArray_(previousState.Calendar_Events).find(function(event) {
    return String(event && event.Event_ID || '') === eventId;
  });
  if (!existingEvent) {
    throw new Error('NOT_FOUND: 找不到要刪除的行事曆事件，請重新整理後再試。');
  }

  var nextState = cloneObject_(previousState);
  nextState.Calendar_Events = ensureArray_(nextState.Calendar_Events).filter(function(event) {
    return String(event && event.Event_ID || '') !== eventId;
  });
  var recycleEntry = buildRecycleBinEntry_(
    nextState,
    actor,
    'calendar-event',
    eventId,
    String(existingEvent.Title || eventId),
    buildRecycleSnapshot_({ Calendar_Events: [existingEvent] }),
    []
  );
  persistState_(nextState, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveCalendarEventState: false,
    preserveRecycleBinState: false
  });

  var savedState = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(actor, '刪除工作行事曆事件', '已刪除「' + existingEvent.Title + '」。', 'calendar-event', eventId, 'warning', {
      source: 'deleteCalendarEvent',
      stageId: existingEvent.Stage_ID,
      eventType: existingEvent.Event_Type
    })
  ]);
  return buildClientStateResultForUser_(savedState, actor, {
    deletedCalendarEvent: existingEvent,
    recycleBinItem: recycleEntry
  });
}

function isWorkItemManager_(actor) {
  return Boolean(actor) && String(actor.Role || '') === 'SuperAdmin';
}

function assertWorkItemManager_(actor) {
  if (!isWorkItemManager_(actor)) {
    throw new Error('FORBIDDEN: 只有形印組長或形印指導教師可以建立與分配工作事項。');
  }
}

function getWorkItemById_(state, workItemId) {
  var targetId = String(workItemId || '').trim();
  if (!targetId) return null;
  return ensureArray_(state && state.Work_Items).find(function(item) {
    return String(item && item.Work_Item_ID || '') === targetId;
  }) || null;
}

function getWorkItemAssignee_(state, userId) {
  var targetId = String(userId || '').trim();
  if (!targetId) return null;
  return ensureArray_(state && state.Users).find(function(user) {
    return String(user && user.User_ID || '') === targetId
      && String(user && user.Role || '') === 'Admin'
      && String(user && user.Status || '') === 'Active';
  }) || null;
}

function buildWorkItemFromPayload_(state, payload, actor, existingItem) {
  var title = String(payload && payload.title || '').trim();
  if (!title) {
    throw new Error('請輸入工作事項名稱。');
  }
  if (title.length > 120) {
    throw new Error('工作事項名稱請控制在 120 個字以內。');
  }

  var description = String(payload && payload.description || '').trim();
  if (description.length > 5000) {
    throw new Error('工作說明請控制在 5,000 個字以內。');
  }

  var dueAt = normalizeCalendarEventDateTime_(payload && payload.dueAt, '到期時間', false);
  var stageId = String(payload && payload.stageId || '').trim();
  if (stageId && !ensureArray_(state.Config_Stages).some(function(stage) {
    return String(stage && stage.Stage_ID || '') === stageId;
  })) {
    throw new Error('找不到所選的會審期數，請重新整理後再試。');
  }

  var priority = String(payload && payload.priority || '一般').trim();
  if (['高', '一般', '低'].indexOf(priority) < 0) {
    priority = '一般';
  }

  var assignedToUserId = String(payload && payload.assignedToUserId || '').trim();
  var assignee = assignedToUserId ? getWorkItemAssignee_(state, assignedToUserId) : null;
  if (assignedToUserId && !assignee) {
    throw new Error('只能指派給目前啟用中的形印組員。');
  }

  var now = nowString_();
  var previousAssigneeId = String(existingItem && existingItem.Assigned_To_User_ID || '');
  var assignmentChanged = !existingItem || previousAssigneeId !== assignedToUserId;
  var item = hydrateWorkItemRecord_({
    Work_Item_ID: existingItem ? existingItem.Work_Item_ID : '',
    Stage_ID: stageId,
    Title: title,
    Description: description,
    Due_At: dueAt,
    Priority: priority,
    Status: existingItem ? existingItem.Status : (assignee ? '待處理' : '待認養'),
    Created_At: existingItem ? existingItem.Created_At : now,
    Created_By_User_ID: existingItem ? existingItem.Created_By_User_ID : actor.User_ID,
    Created_By_Name: existingItem ? existingItem.Created_By_Name : actor.Name,
    Assigned_To_User_ID: assignee ? assignee.User_ID : '',
    Assigned_To_Name: assignee ? assignee.Name : '',
    Assigned_At: existingItem ? existingItem.Assigned_At : (assignee ? now : ''),
    Claimed_At: existingItem ? existingItem.Claimed_At : '',
    Started_At: existingItem ? existingItem.Started_At : '',
    Completed_At: existingItem ? existingItem.Completed_At : '',
    Completed_By_User_ID: existingItem ? existingItem.Completed_By_User_ID : '',
    Updated_At: now,
    Updated_By_User_ID: actor.User_ID
  });

  if (existingItem && assignmentChanged) {
    item.Status = assignee ? '待處理' : '待認養';
    item.Assigned_At = assignee ? now : '';
    item.Claimed_At = '';
    item.Started_At = '';
    item.Completed_At = '';
    item.Completed_By_User_ID = '';
  }

  return {
    item: item,
    assignmentChanged: assignmentChanged,
    previousAssigneeId: previousAssigneeId
  };
}

function handleCreateWorkItem_(payload) {
  var previousState = loadState_();
  var actor = requireSessionUser_(previousState, payload, ['SuperAdmin']);
  assertWorkItemManager_(actor);
  assertExpectedStateRevision_(payload, previousState);

  var prepared = buildWorkItemFromPayload_(previousState, payload, actor, null);
  var item = prepared.item;
  var nextState = cloneObject_(previousState);
  item.Work_Item_ID = generateSequentialId_('WI', nextState.Work_Items, 'Work_Item_ID');
  nextState.Work_Items.unshift(item);

  if (item.Assigned_To_User_ID) {
    createNotifications_(nextState, {
      type: 'work-item-assigned',
      title: '新的工作已指派給你',
      message: '「' + item.Title + '」已由 ' + actor.Name + ' 指派給你處理。',
      tab: 'work-items',
      refType: 'work-item',
      refId: item.Work_Item_ID,
      audience: { userIds: [item.Assigned_To_User_ID] },
      createdAt: item.Created_At,
      priority: item.Priority === '高' ? 'high' : 'normal'
    });
  } else {
    createNotifications_(nextState, {
      type: 'work-item-open',
      title: '有新的可認養工作',
      message: '「' + item.Title + '」正在開放形印組員認養。',
      tab: 'work-items',
      refType: 'work-item',
      refId: item.Work_Item_ID,
      audience: { roles: ['Admin'] },
      createdAt: item.Created_At,
      priority: item.Priority === '高' ? 'high' : 'normal'
    });
  }

  persistState_(nextState, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveWorkItemState: false
  });
  var savedState = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(
      actor,
      '新增工作事項',
      '已新增工作「' + item.Title + '」' + (item.Assigned_To_Name ? '，並指派給 ' + item.Assigned_To_Name + '。' : '，開放形印組員認養。'),
      'work-item',
      item.Work_Item_ID,
      item.Priority === '高' ? 'warning' : 'normal',
      { source: 'createWorkItem', stageId: item.Stage_ID, assignedToUserId: item.Assigned_To_User_ID }
    )
  ]);
  return buildClientStateResultForUser_(savedState, actor, {
    workItem: getWorkItemById_(savedState, item.Work_Item_ID)
  });
}

function handleUpdateWorkItem_(payload) {
  var previousState = loadState_();
  var actor = requireSessionUser_(previousState, payload, ['SuperAdmin']);
  assertWorkItemManager_(actor);
  assertExpectedStateRevision_(payload, previousState);

  var workItemId = String(payload && payload.workItemId || '').trim();
  var existingItem = getWorkItemById_(previousState, workItemId);
  if (!existingItem) {
    throw new Error('NOT_FOUND: 找不到要修改的工作事項，請重新整理後再試。');
  }

  var prepared = buildWorkItemFromPayload_(previousState, payload, actor, existingItem);
  var item = prepared.item;
  var nextState = cloneObject_(previousState);
  nextState.Work_Items = ensureArray_(nextState.Work_Items).map(function(record) {
    return String(record && record.Work_Item_ID || '') === workItemId ? item : record;
  });

  if (prepared.assignmentChanged) {
    if (item.Assigned_To_User_ID) {
      createNotifications_(nextState, {
        type: 'work-item-assigned',
        title: '工作事項已指派給你',
        message: '「' + item.Title + '」已由 ' + actor.Name + ' 指派給你處理。',
        tab: 'work-items',
        refType: 'work-item',
        refId: item.Work_Item_ID,
        audience: { userIds: [item.Assigned_To_User_ID] },
        createdAt: item.Updated_At,
        priority: item.Priority === '高' ? 'high' : 'normal'
      });
    }
    if (prepared.previousAssigneeId) {
      createNotifications_(nextState, {
        type: 'work-item-reassigned',
        title: '工作事項已調整分配',
        message: item.Assigned_To_Name
          ? '「' + item.Title + '」已改由 ' + item.Assigned_To_Name + ' 負責。'
          : '「' + item.Title + '」已改為開放認養。',
        tab: 'work-items',
        refType: 'work-item',
        refId: item.Work_Item_ID,
        audience: { userIds: [prepared.previousAssigneeId], excludeUserIds: [item.Assigned_To_User_ID] },
        createdAt: item.Updated_At,
        priority: 'normal'
      });
    }
  }

  persistState_(nextState, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveWorkItemState: false
  });
  var savedState = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(
      actor,
      '更新工作事項',
      '已更新工作「' + item.Title + '」。',
      'work-item',
      item.Work_Item_ID,
      'normal',
      { source: 'updateWorkItem', assignmentChanged: prepared.assignmentChanged, assignedToUserId: item.Assigned_To_User_ID }
    )
  ]);
  return buildClientStateResultForUser_(savedState, actor, {
    workItem: getWorkItemById_(savedState, item.Work_Item_ID)
  });
}

function handleClaimWorkItem_(payload) {
  var previousState = loadState_();
  var actor = requireSessionUser_(previousState, payload, ['Admin']);
  assertExpectedStateRevision_(payload, previousState);

  var workItemId = String(payload && payload.workItemId || '').trim();
  var existingItem = getWorkItemById_(previousState, workItemId);
  if (!existingItem) {
    throw new Error('NOT_FOUND: 找不到這筆工作事項，請重新整理後再試。');
  }
  if (String(existingItem.Status || '') !== '待認養' || String(existingItem.Assigned_To_User_ID || '')) {
    throw new Error('這項工作已被其他人認養或改為直接分配，請重新整理後再查看。');
  }

  var now = nowString_();
  var item = hydrateWorkItemRecord_(cloneObject_(existingItem));
  item.Assigned_To_User_ID = String(actor.User_ID || '');
  item.Assigned_To_Name = String(actor.Name || '');
  item.Assigned_At = now;
  item.Claimed_At = now;
  item.Started_At = now;
  item.Status = '進行中';
  item.Updated_At = now;
  item.Updated_By_User_ID = String(actor.User_ID || '');

  var nextState = cloneObject_(previousState);
  nextState.Work_Items = ensureArray_(nextState.Work_Items).map(function(record) {
    return String(record && record.Work_Item_ID || '') === workItemId ? item : record;
  });
  createNotifications_(nextState, {
    type: 'work-item-claimed',
    title: '工作事項已被認養',
    message: actor.Name + ' 已認養並開始處理「' + item.Title + '」。',
    tab: 'work-items',
    refType: 'work-item',
    refId: item.Work_Item_ID,
    audience: { roles: ['SuperAdmin'], excludeUserIds: [actor.User_ID] },
    createdAt: now,
    priority: item.Priority === '高' ? 'high' : 'normal'
  });

  persistState_(nextState, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveWorkItemState: false
  });
  var savedState = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(
      actor,
      '認養工作事項',
      '已認養工作「' + item.Title + '」。',
      'work-item',
      item.Work_Item_ID,
      'normal',
      { source: 'claimWorkItem' }
    )
  ]);
  return buildClientStateResultForUser_(savedState, actor, {
    workItem: getWorkItemById_(savedState, item.Work_Item_ID)
  });
}

function handleUpdateWorkItemProgress_(payload) {
  var previousState = loadState_();
  var actor = requireSessionUser_(previousState, payload, ['SuperAdmin', 'Admin']);
  assertExpectedStateRevision_(payload, previousState);

  var workItemId = String(payload && payload.workItemId || '').trim();
  var action = String(payload && payload.progressAction || '').trim();
  var existingItem = getWorkItemById_(previousState, workItemId);
  if (!existingItem) {
    throw new Error('NOT_FOUND: 找不到這筆工作事項，請重新整理後再試。');
  }
  if (['start', 'complete', 'reopen'].indexOf(action) < 0) {
    throw new Error('不支援的工作進度操作。');
  }

  var isManager = isWorkItemManager_(actor);
  if (!isManager && String(existingItem.Assigned_To_User_ID || '') !== String(actor.User_ID || '')) {
    throw new Error('FORBIDDEN: 只有目前負責這項工作的形印組員可以更新進度。');
  }
  if (action === 'reopen' && !isManager) {
    throw new Error('FORBIDDEN: 只有形印組長或形印指導教師可以重新開啟工作事項。');
  }
  if (action !== 'reopen' && !String(existingItem.Assigned_To_User_ID || '')) {
    throw new Error('請先指派或認養這項工作，再更新進度。');
  }
  if (action !== 'reopen' && String(existingItem.Status || '') === '已完成') {
    throw new Error('這項工作已完成；如需再次處理，請由組長或指導教師重新開啟。');
  }

  var now = nowString_();
  var item = hydrateWorkItemRecord_(cloneObject_(existingItem));
  if (action === 'start') {
    item.Status = '進行中';
    item.Started_At = item.Started_At || now;
  } else if (action === 'complete') {
    item.Status = '已完成';
    item.Completed_At = now;
    item.Completed_By_User_ID = String(actor.User_ID || '');
  } else {
    item.Status = item.Assigned_To_User_ID ? '待處理' : '待認養';
    item.Claimed_At = '';
    item.Started_At = '';
    item.Completed_At = '';
    item.Completed_By_User_ID = '';
  }
  item.Updated_At = now;
  item.Updated_By_User_ID = String(actor.User_ID || '');

  var nextState = cloneObject_(previousState);
  nextState.Work_Items = ensureArray_(nextState.Work_Items).map(function(record) {
    return String(record && record.Work_Item_ID || '') === workItemId ? item : record;
  });

  if (action === 'complete') {
    createNotifications_(nextState, {
      type: 'work-item-completed',
      title: '工作事項已完成',
      message: actor.Name + ' 已完成「' + item.Title + '」。',
      tab: 'work-items',
      refType: 'work-item',
      refId: item.Work_Item_ID,
      audience: {
        roles: ['SuperAdmin'],
        userIds: item.Assigned_To_User_ID ? [item.Assigned_To_User_ID] : [],
        excludeUserIds: [actor.User_ID]
      },
      createdAt: now,
      priority: 'normal'
    });
  } else if (action === 'reopen' && item.Assigned_To_User_ID) {
    createNotifications_(nextState, {
      type: 'work-item-reopened',
      title: '工作事項已重新開啟',
      message: '「' + item.Title + '」已重新開啟，請繼續處理。',
      tab: 'work-items',
      refType: 'work-item',
      refId: item.Work_Item_ID,
      audience: { userIds: [item.Assigned_To_User_ID], excludeUserIds: [actor.User_ID] },
      createdAt: now,
      priority: item.Priority === '高' ? 'high' : 'normal'
    });
  }

  persistState_(nextState, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveWorkItemState: false
  });
  var savedState = loadState_();
  var actionLabel = action === 'start' ? '開始處理工作事項' : action === 'complete' ? '完成工作事項' : '重新開啟工作事項';
  appendActivityLogEntries_([
    createActivityLogEntry_(actor, actionLabel, '已更新「' + item.Title + '」為「' + item.Status + '」。', 'work-item', item.Work_Item_ID, 'normal', {
      source: 'updateWorkItemProgress', progressAction: action
    })
  ]);
  return buildClientStateResultForUser_(savedState, actor, {
    workItem: getWorkItemById_(savedState, item.Work_Item_ID)
  });
}

function handleDeleteWorkItem_(payload) {
  var previousState = loadState_();
  var actor = requireSessionUser_(previousState, payload, ['SuperAdmin']);
  assertWorkItemManager_(actor);
  assertExpectedStateRevision_(payload, previousState);

  var workItemId = String(payload && payload.workItemId || '').trim();
  var item = getWorkItemById_(previousState, workItemId);
  if (!item) {
    throw new Error('NOT_FOUND: 找不到要刪除的工作事項，請重新整理後再試。');
  }

  var nextState = cloneObject_(previousState);
  nextState.Work_Items = ensureArray_(nextState.Work_Items).filter(function(record) {
    return String(record && record.Work_Item_ID || '') !== workItemId;
  });
  var recycleEntry = buildRecycleBinEntry_(
    nextState,
    actor,
    'work-item',
    workItemId,
    String(item.Title || workItemId),
    buildRecycleSnapshot_({ Work_Items: [item] }),
    []
  );

  persistState_(nextState, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveWorkItemState: false,
    preserveRecycleBinState: false
  });
  var savedState = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(actor, '刪除工作事項', '已刪除工作「' + item.Title + '」，可在 30 天內從回收桶復原。', 'work-item', workItemId, 'warning', {
      source: 'deleteWorkItem'
    })
  ]);
  return buildClientStateResultForUser_(savedState, actor, {
    deletedWorkItem: item,
    recycleBinItem: recycleEntry
  });
}

// Delete a review stage and all records that are scoped to it in one locked
// server transaction. This avoids a stale browser snapshot restoring data
// after the interface has already removed it optimistically.
function handleDeleteStage_(payload) {
  var previousState = loadState_();
  var actor = requireSessionUser_(previousState, payload, ['SuperAdmin', 'Admin']);
  assertExpectedStateRevision_(payload, previousState);

  var stageId = String(payload && payload.stageId || '').trim();
  if (!stageId) {
    throw new Error('deleteStage requires `stageId`.');
  }

  var targetStage = ensureArray_(previousState.Config_Stages).find(function(stage) {
    return String(stage && stage.Stage_ID || '') === stageId;
  });
  if (!targetStage) {
    throw new Error('NOT_FOUND: 找不到要刪除的會審期數，資料可能已被其他使用者更新。');
  }
  if (ensureArray_(previousState.Config_Stages).length <= 1) {
    throw new Error('FORBIDDEN: 系統至少要保留一個會審期數。');
  }
  if (targetStage.Is_Active === true) {
    throw new Error('FORBIDDEN: 請先設定其他會審為目前活躍期數，再刪除這一期。');
  }

  var assignmentIds = {};
  var fileIds = {};
  var fileGroupKeys = {};
  var workItemIds = {};
  var driveFileIds = {};
  ensureArray_(previousState.Assignments).forEach(function(assignment) {
    if (String(assignment && assignment.Stage_ID || '') === stageId) {
      assignmentIds[String(assignment.Assignment_ID || '')] = true;
    }
  });
  var stageAssignments = ensureArray_(previousState.Assignments).filter(function(assignment) {
    return String(assignment && assignment.Stage_ID || '') === stageId;
  });
  var stageFiles = ensureArray_(previousState.Files).filter(function(file) {
    return String(file && file.Stage_ID || '') === stageId;
  });
  var stageResources = ensureArray_(previousState.Assignment_Resources).filter(function(resource) {
    return assignmentIds[String(resource && resource.Assignment_ID || '')];
  });
  var stageSubmissions = ensureArray_(previousState.Assignment_Submissions).filter(function(submission) {
    return assignmentIds[String(submission && submission.Assignment_ID || '')];
  });
  var stagePurchases = ensureArray_(previousState.Purchase_Items).filter(function(item) {
    return String(item && item.Stage_ID || '') === stageId;
  });
  var stageCalendarEvents = ensureArray_(previousState.Calendar_Events).filter(function(event) {
    return String(event && event.Stage_ID || '') === stageId;
  });
  var stageWorkItems = ensureArray_(previousState.Work_Items).filter(function(item) {
    return String(item && item.Stage_ID || '') === stageId;
  });
  stageWorkItems.forEach(function(item) {
    workItemIds[String(item.Work_Item_ID || '')] = true;
  });
  var stageServiceOrders = ensureArray_(previousState.Design_Service_Orders).filter(function(order) {
    return String(order && order.Stage_ID || '') === stageId
      || assignmentIds[String(order && order.Assignment_ID || '')];
  });
  ensureArray_(previousState.Files).forEach(function(file) {
    if (String(file && file.Stage_ID || '') === stageId) {
      fileIds[String(file.File_ID || '')] = true;
      if (String(file.Drive_File_ID || '').trim()) {
        driveFileIds[String(file.Drive_File_ID).trim()] = true;
      }
      if (file.File_Group_Key) {
        fileGroupKeys[String(file.File_Group_Key)] = true;
      }
    }
  });
  ensureArray_(previousState.Assignment_Submissions).forEach(function(submission) {
    if (assignmentIds[String(submission && submission.Assignment_ID || '')]
        && String(submission.Drive_File_ID || '').trim()) {
      driveFileIds[String(submission.Drive_File_ID).trim()] = true;
    }
  });
  ensureArray_(previousState.Assignment_Resources).forEach(function(resource) {
    if (!assignmentIds[String(resource && resource.Assignment_ID || '')]) return;
    var resourceFileId = String(resource && resource.Drive_File_ID || '').trim()
      || extractDriveFileId_(resource && resource.Google_Drive_URL);
    if (resourceFileId) {
      driveFileIds[resourceFileId] = true;
    }
  });
  collectDriveFileIdsFromRecords_(stageServiceOrders).forEach(function(fileId) {
    driveFileIds[fileId] = true;
  });
  collectDriveFileIdsFromRecords_(stageFiles.concat(stageSubmissions, stageResources)).forEach(function(fileId) {
    driveFileIds[fileId] = true;
  });

  var nextState = cloneObject_(previousState);
  nextState.Config_Stages = ensureArray_(nextState.Config_Stages).filter(function(stage) {
    return String(stage && stage.Stage_ID || '') !== stageId;
  });
  nextState.Assignments = ensureArray_(nextState.Assignments).filter(function(assignment) {
    return String(assignment && assignment.Stage_ID || '') !== stageId;
  });
  nextState.Assignment_Resources = ensureArray_(nextState.Assignment_Resources).filter(function(resource) {
    return !assignmentIds[String(resource && resource.Assignment_ID || '')];
  });
  nextState.Assignment_Submissions = ensureArray_(nextState.Assignment_Submissions).filter(function(submission) {
    return !assignmentIds[String(submission && submission.Assignment_ID || '')];
  });
  nextState.Files = ensureArray_(nextState.Files).filter(function(file) {
    return String(file && file.Stage_ID || '') !== stageId;
  });
  nextState.Purchase_Items = ensureArray_(nextState.Purchase_Items).filter(function(item) {
    return String(item && item.Stage_ID || '') !== stageId;
  });
  nextState.Calendar_Events = ensureArray_(nextState.Calendar_Events).filter(function(event) {
    return String(event && event.Stage_ID || '') !== stageId;
  });
  nextState.Work_Items = ensureArray_(nextState.Work_Items).filter(function(item) {
    return String(item && item.Stage_ID || '') !== stageId;
  });
  nextState.Design_Service_Orders = ensureArray_(nextState.Design_Service_Orders).filter(function(order) {
    return !(String(order && order.Stage_ID || '') === stageId
      || assignmentIds[String(order && order.Assignment_ID || '')]);
  });
  var stageNotifications = ensureArray_(previousState.Notifications).filter(function(notification) {
    var refType = String(notification && notification.Ref_Type || '');
    var refId = String(notification && notification.Ref_ID || '');
    return (refType === 'stage' && refId === stageId)
      || (refType === 'assignment' && assignmentIds[refId])
      || (refType === 'file' && fileIds[refId])
      || (refType === 'file-group' && fileGroupKeys[refId])
      || (refType === 'work-item' && workItemIds[refId]);
  });
  nextState.Notifications = ensureArray_(nextState.Notifications).filter(function(notification) {
    var refType = String(notification && notification.Ref_Type || '');
    var refId = String(notification && notification.Ref_ID || '');
    return !(refType === 'stage' && refId === stageId)
      && !(refType === 'assignment' && assignmentIds[refId])
      && !(refType === 'file' && fileIds[refId])
      && !(refType === 'file-group' && fileGroupKeys[refId])
      && !(refType === 'work-item' && workItemIds[refId]);
  });
  var stageDiscussionComments = ensureArray_(previousState.Discussion_Comments).filter(function(comment) {
    var refType = String(comment && comment.Ref_Type || '');
    var refId = String(comment && comment.Ref_ID || '');
    return (refType === 'stage' && refId === stageId)
      || (refType === 'assignment' && assignmentIds[refId])
      || (refType === 'file' && fileIds[refId])
      || (refType === 'file-group' && fileGroupKeys[refId]);
  });
  nextState.Discussion_Comments = ensureArray_(nextState.Discussion_Comments).filter(function(comment) {
    var refType = String(comment && comment.Ref_Type || '');
    var refId = String(comment && comment.Ref_ID || '');
    return !(refType === 'stage' && refId === stageId)
      && !(refType === 'assignment' && assignmentIds[refId])
      && !(refType === 'file' && fileIds[refId])
      && !(refType === 'file-group' && fileGroupKeys[refId]);
  });

  // Remove reminder-log entries now, rather than leaving stale references
  // until the next background reminder pass cleans them up.
  nextState.Meta = nextState.Meta && typeof nextState.Meta === 'object' ? nextState.Meta : {};
  var reminderLog = getAssignmentReminderLog_(nextState);
  var removedReminderLog = {};
  Object.keys(reminderLog).forEach(function(key) {
    var assignmentId = String(reminderLog[key] && reminderLog[key].assignmentId || key.split('|')[0] || '');
    if (assignmentIds[assignmentId]) {
      removedReminderLog[key] = cloneObject_(reminderLog[key]);
      delete reminderLog[key];
    }
  });
  nextState.Meta[ASSIGNMENT_REMINDER_LOG_META_KEY] = reminderLog;
  var recycleEntry = buildRecycleBinEntry_(
    nextState,
    actor,
    'stage',
    stageId,
    String(targetStage.Stage_Name || stageId),
    buildRecycleSnapshot_({
      Config_Stages: [targetStage],
      Assignments: stageAssignments,
      Assignment_Resources: stageResources,
      Assignment_Submissions: stageSubmissions,
      Files: stageFiles,
      Purchase_Items: stagePurchases,
      Work_Items: stageWorkItems,
      Notifications: stageNotifications,
      Discussion_Comments: stageDiscussionComments,
      Design_Service_Orders: stageServiceOrders,
      Calendar_Events: stageCalendarEvents
    }, {
      assignmentReminderLog: removedReminderLog
    }),
    Object.keys(driveFileIds)
  );

  persistState_(nextState, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveDesignServiceState: false,
    preserveAssignmentResourceState: false,
    preserveCalendarEventState: false,
    preserveWorkItemState: false,
    preserveRecycleBinState: false
  });
  var persistedState = loadState_();
  appendActivityLogEntries_(buildStateAuditEntries_(previousState, persistedState, actor));
  var driveTrashSummary = enqueueDeferredDriveTrash_(Object.keys(driveFileIds));
  return buildClientStateResultForUser_(persistedState, actor, {
    deletedStage: targetStage,
    recycleBinItem: recycleEntry,
    driveTrashSummary: driveTrashSummary
  });
}

function collectDriveFileIdsFromRecords_(records) {
  var seen = {};
  ensureArray_(records).forEach(function(record) {
    if (!record || typeof record !== 'object') return;
    var fileId = String(record.Drive_File_ID || '').trim()
      || extractDriveFileId_(record.Google_Drive_URL);
    if (fileId) {
      seen[fileId] = true;
    }
  });
  return Object.keys(seen);
}

function buildRecycleBinEntry_(state, actor, entityType, entityId, title, snapshot, driveFileIds) {
  var safeSnapshot = cloneObject_(snapshot || {});
  var serializedSnapshot = JSON.stringify(safeSnapshot);
  if (serializedSnapshot.length > RECYCLE_BIN_MAX_SNAPSHOT_CHARACTERS) {
    throw new Error('這筆資料的關聯內容過多，無法安全放入回收桶。請先分批刪除，或聯絡形印組管理員協助處理。');
  }

  var deletedAt = nowString_();
  var expiresAtDate = new Date();
  expiresAtDate.setDate(expiresAtDate.getDate() + RECYCLE_BIN_RETENTION_DAYS);
  var entry = hydrateRecycleBinRecord_({
    Recycle_ID: generateSequentialId_('RB', state.Recycle_Bin, 'Recycle_ID'),
    Entity_Type: String(entityType || ''),
    Entity_ID: String(entityId || ''),
    Title: String(title || '未命名項目'),
    Snapshot_JSON: safeSnapshot,
    Drive_File_IDs: ensureArray_(driveFileIds),
    Deleted_At: deletedAt,
    Deleted_By_User_ID: String(actor && actor.User_ID || ''),
    Deleted_By_Name: String(actor && actor.Name || ''),
    Expires_At: formatDateTime_(expiresAtDate),
    Status: 'deleted',
    Restored_At: '',
    Restored_By_User_ID: ''
  });

  state.Recycle_Bin = ensureArray_(state.Recycle_Bin);
  state.Recycle_Bin.unshift(entry);
  return entry;
}

function buildRecycleSnapshot_(collections, meta) {
  return {
    collections: collections && typeof collections === 'object' ? collections : {},
    meta: meta && typeof meta === 'object' ? meta : {}
  };
}

function prependRestoredRecords_(state, collectionName, records, idField) {
  var existing = ensureArray_(state[collectionName]);
  var existingIds = {};
  existing.forEach(function(record) {
    var id = String(record && record[idField] || '').trim();
    if (id) existingIds[id] = true;
  });

  var restored = ensureArray_(records).filter(function(record) {
    var id = String(record && record[idField] || '').trim();
    return id && !existingIds[id];
  });
  state[collectionName] = restored.concat(existing);
  return restored.length;
}

function restoreRecycleBinSnapshot_(state, entry) {
  var snapshot = entry && entry.Snapshot_JSON && typeof entry.Snapshot_JSON === 'object'
    ? entry.Snapshot_JSON
    : {};
  var collections = snapshot.collections && typeof snapshot.collections === 'object'
    ? snapshot.collections
    : {};
  var idFields = {
    Config_Stages: 'Stage_ID',
    Purchase_Items: 'Item_ID',
    Assignments: 'Assignment_ID',
    Assignment_Resources: 'Resource_ID',
    Assignment_Submissions: 'Submission_ID',
    Files: 'File_ID',
    Notifications: 'Notification_ID',
    Discussion_Comments: 'Comment_ID',
    Design_Service_Orders: 'Service_Order_ID',
    Calendar_Events: 'Event_ID',
    Work_Items: 'Work_Item_ID'
  };
  var summary = {
    restoredRecords: 0,
    collections: {}
  };

  Object.keys(idFields).forEach(function(collectionName) {
    var count = prependRestoredRecords_(state, collectionName, collections[collectionName], idFields[collectionName]);
    if (count > 0) {
      summary.collections[collectionName] = count;
      summary.restoredRecords += count;
    }
  });

  var snapshotMeta = snapshot.meta && typeof snapshot.meta === 'object' ? snapshot.meta : {};
  if (snapshotMeta.assignmentReminderLog && typeof snapshotMeta.assignmentReminderLog === 'object') {
    state.Meta = state.Meta && typeof state.Meta === 'object' ? state.Meta : {};
    var reminderLog = getAssignmentReminderLog_(state);
    Object.keys(snapshotMeta.assignmentReminderLog).forEach(function(key) {
      if (!reminderLog[key]) {
        reminderLog[key] = snapshotMeta.assignmentReminderLog[key];
      }
    });
    state.Meta[ASSIGNMENT_REMINDER_LOG_META_KEY] = reminderLog;
  }

  return summary;
}

function removeDeferredDriveTrashItems_(driveFileIds) {
  var ids = ensureArray_(driveFileIds).map(function(fileId) {
    return String(fileId || '').trim();
  }).filter(function(fileId, index, list) {
    return fileId && list.indexOf(fileId) === index;
  });
  if (ids.length === 0) {
    return { removed: 0, pending: loadDeferredDriveTrashQueue_().length };
  }

  var idSet = {};
  ids.forEach(function(fileId) { idSet[fileId] = true; });
  var queue = loadDeferredDriveTrashQueue_();
  var remaining = queue.filter(function(item) {
    return !idSet[String(item && item.fileId || '').trim()];
  });
  saveDeferredDriveTrashQueue_(remaining);
  if (remaining.length === 0) {
    removeDeferredDriveTrashTriggers_();
  }
  return {
    removed: queue.length - remaining.length,
    pending: remaining.length
  };
}

function restoreDriveFiles_(driveFileIds) {
  var ids = ensureArray_(driveFileIds).map(function(fileId) {
    return String(fileId || '').trim();
  }).filter(function(fileId, index, list) {
    return fileId && list.indexOf(fileId) === index;
  });
  var summary = { requested: ids.length, restored: 0, failed: 0 };
  ids.forEach(function(fileId) {
    try {
      DriveApp.getFileById(fileId).setTrashed(false);
      summary.restored += 1;
    } catch (error) {
      summary.failed += 1;
      console.warn('Unable to restore Drive file from trash: ' + fileId + ' / ' + String(error && error.message || error));
    }
  });
  return summary;
}

function purgeExpiredRecycleBinEntries_(state) {
  var now = new Date().getTime();
  var removed = 0;
  state.Recycle_Bin = ensureArray_(state.Recycle_Bin).filter(function(entry) {
    var expiresAt = parseConfiguredDateTime_(entry && entry.Expires_At);
    var isExpired = expiresAt && expiresAt.getTime() < now;
    if (isExpired) removed += 1;
    return !isExpired;
  });
  return { removed: removed, changed: removed > 0 };
}

function handleRestoreRecycleBinItem_(payload) {
  var previousState = loadState_();
  var actor = requireSessionUser_(previousState, payload, ['SuperAdmin', 'Admin']);
  assertExpectedStateRevision_(payload, previousState);
  var recycleId = String(payload && payload.recycleId || '').trim();
  if (!recycleId) {
    throw new Error('restoreRecycleBinItem requires `recycleId`.');
  }

  var recycleEntry = ensureArray_(previousState.Recycle_Bin).find(function(entry) {
    return String(entry && entry.Recycle_ID || '') === recycleId;
  });
  if (!recycleEntry) {
    throw new Error('NOT_FOUND: 找不到這筆回收桶資料。');
  }
  if (String(recycleEntry.Status || '') !== 'deleted') {
    throw new Error('這筆資料已經復原，或不再可復原。');
  }

  var expiryDate = parseConfiguredDateTime_(recycleEntry.Expires_At);
  if (expiryDate && expiryDate.getTime() < new Date().getTime()) {
    throw new Error('這筆回收桶資料已超過 30 天保留期限，無法復原。');
  }

  var nextState = cloneObject_(previousState);
  var nextEntry = ensureArray_(nextState.Recycle_Bin).find(function(entry) {
    return String(entry && entry.Recycle_ID || '') === recycleId;
  });
  var restoreSummary = restoreRecycleBinSnapshot_(nextState, nextEntry);
  nextEntry.Status = 'restored';
  nextEntry.Restored_At = nowString_();
  nextEntry.Restored_By_User_ID = String(actor.User_ID || '');

  persistState_(nextState, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveDesignServiceState: false,
    preserveAssignmentResourceState: false,
    preserveCalendarEventState: false,
    preserveWorkItemState: false,
    preserveRecycleBinState: false
  });

  var queueSummary = removeDeferredDriveTrashItems_(nextEntry.Drive_File_IDs);
  var driveRestoreSummary = restoreDriveFiles_(nextEntry.Drive_File_IDs);
  var savedState = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(actor, '從回收桶復原資料', '已復原「' + String(nextEntry.Title || recycleId) + '」。', 'recycle-bin', recycleId, 'normal', {
      source: 'restoreRecycleBinItem',
      entityType: nextEntry.Entity_Type,
      entityId: nextEntry.Entity_ID,
      restoredRecords: restoreSummary.restoredRecords,
      driveFileCount: ensureArray_(nextEntry.Drive_File_IDs).length,
      driveFilesRestored: driveRestoreSummary.restored,
      driveFilesFailed: driveRestoreSummary.failed,
      deferredTrashCancelled: queueSummary.removed
    })
  ]);

  return buildClientStateResultForUser_(savedState, actor, {
    restoredRecycleBinItem: nextEntry,
    restoreSummary: restoreSummary,
    driveRestoreSummary: driveRestoreSummary
  });
}

// Move only the original files recorded for the deleted stage into Drive trash.
// A missing file or insufficient Drive permission must not undo the spreadsheet
// deletion, so failures are reported in the response instead of being thrown.
function trashDriveFiles_(driveFileIds) {
  var ids = ensureArray_(driveFileIds).map(function(fileId) {
    return String(fileId || '').trim();
  }).filter(function(fileId, index, list) {
    return fileId && list.indexOf(fileId) === index;
  });
  var summary = {
    requested: ids.length,
    trashed: 0,
    failed: 0
  };

  ids.forEach(function(fileId) {
    try {
      DriveApp.getFileById(fileId).setTrashed(true);
      summary.trashed += 1;
    } catch (error) {
      summary.failed += 1;
      console.warn('Unable to move Drive file to trash: ' + fileId + ' / ' + String(error && error.message || error));
    }
  });

  return summary;
}

// Queue Drive cleanup outside the user-facing spreadsheet transaction. The
// Apps Script Drive service can occasionally take much longer than the sheet
// write, especially for large uploaded files or files with inherited sharing.
function enqueueDeferredDriveTrash_(driveFileIds) {
  var ids = ensureArray_(driveFileIds).map(function(fileId) {
    return String(fileId || '').trim();
  }).filter(function(fileId, index, list) {
    return fileId && list.indexOf(fileId) === index;
  });

  if (ids.length === 0) {
    return {
      requested: 0,
      trashed: 0,
      failed: 0,
      pending: 0,
      queued: 0,
      status: 'completed'
    };
  }

  var queue = loadDeferredDriveTrashQueue_();
  var queuedIds = {};
  queue.forEach(function(item) {
    queuedIds[String(item.fileId || '').trim()] = true;
  });

  var addedCount = 0;
  ids.forEach(function(fileId) {
    if (queuedIds[fileId]) return;
    queue.push({
      fileId: fileId,
      attempts: 0,
      nextAttemptAtMillis: 0,
      queuedAt: Date.now()
    });
    queuedIds[fileId] = true;
    addedCount += 1;
  });

  try {
    saveDeferredDriveTrashQueue_(queue);
  } catch (error) {
    console.warn('Unable to persist deferred Drive trash queue: ' + String(error && error.message || error));
    return {
      requested: ids.length,
      trashed: 0,
      failed: ids.length,
      pending: 0,
      queued: 0,
      status: 'failed',
      triggerScheduled: false,
      triggerError: String(error && error.message || error)
    };
  }
  var triggerInfo = ensureDeferredDriveTrashTrigger_();
  return {
    requested: ids.length,
    trashed: 0,
    failed: 0,
    pending: ids.length,
    queued: addedCount,
    status: 'queued',
    triggerScheduled: triggerInfo.scheduled === true,
    triggerError: triggerInfo.error || ''
  };
}

function loadDeferredDriveTrashQueue_() {
  var raw = PropertiesService.getScriptProperties().getProperty(DEFERRED_DRIVE_TRASH_QUEUE_PROPERTY);
  if (!raw) return [];

  try {
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(function(item) {
      return {
        fileId: String(item && item.fileId || '').trim(),
        attempts: Math.max(0, Number(item && item.attempts || 0)),
        nextAttemptAtMillis: Math.max(0, Number(item && item.nextAttemptAtMillis || 0)),
        queuedAt: Math.max(0, Number(item && item.queuedAt || 0)),
        lastError: String(item && item.lastError || '').slice(0, 500)
      };
    }).filter(function(item, index, list) {
      return item.fileId && list.findIndex(function(candidate) {
        return candidate.fileId === item.fileId;
      }) === index;
    });
  } catch (error) {
    console.warn('Unable to parse deferred Drive trash queue: ' + String(error && error.message || error));
    return [];
  }
}

function saveDeferredDriveTrashQueue_(queue) {
  var props = PropertiesService.getScriptProperties();
  var normalizedQueue = ensureArray_(queue).filter(function(item) {
    return item && String(item.fileId || '').trim();
  });

  if (normalizedQueue.length === 0) {
    props.deleteProperty(DEFERRED_DRIVE_TRASH_QUEUE_PROPERTY);
    return;
  }

  props.setProperty(DEFERRED_DRIVE_TRASH_QUEUE_PROPERTY, JSON.stringify(normalizedQueue));
}

function ensureDeferredDriveTrashTrigger_() {
  var existing = listDeferredDriveTrashTriggers_();
  if (existing.length > 0) {
    return {
      scheduled: true,
      created: false,
      triggers: existing
    };
  }

  try {
    var trigger = ScriptApp.newTrigger(DEFERRED_DRIVE_TRASH_TRIGGER_HANDLER)
      .timeBased()
      .after(1000)
      .create();
    return {
      scheduled: true,
      created: true,
      triggerId: trigger.getUniqueId(),
      triggers: listDeferredDriveTrashTriggers_()
    };
  } catch (error) {
    console.warn('Unable to schedule deferred Drive trash cleanup: ' + String(error && error.message || error));
    return {
      scheduled: false,
      created: false,
      triggers: [],
      error: String(error && error.message || error)
    };
  }
}

function listDeferredDriveTrashTriggers_() {
  return ScriptApp.getProjectTriggers().filter(function(trigger) {
    return String(trigger.getHandlerFunction() || '') === DEFERRED_DRIVE_TRASH_TRIGGER_HANDLER;
  });
}

function removeDeferredDriveTrashTriggers_() {
  listDeferredDriveTrashTriggers_().forEach(function(trigger) {
    try {
      ScriptApp.deleteTrigger(trigger);
    } catch (error) {
      console.warn('Unable to remove deferred Drive trash trigger: ' + String(error && error.message || error));
    }
  });
}

function scheduleDeferredDriveTrashRetry_() {
  try {
    var trigger = ScriptApp.newTrigger(DEFERRED_DRIVE_TRASH_TRIGGER_HANDLER)
      .timeBased()
      .after(DEFERRED_DRIVE_TRASH_RETRY_DELAY_MILLIS)
      .create();
    return {
      scheduled: true,
      triggerId: trigger.getUniqueId()
    };
  } catch (error) {
    console.warn('Unable to schedule deferred Drive trash retry: ' + String(error && error.message || error));
    return {
      scheduled: false,
      error: String(error && error.message || error)
    };
  }
}

function runDeferredDriveTrashQueue() {
  return withLock_(function() {
    return processDeferredDriveTrashQueue_();
  });
}

function processDeferredDriveTrashQueue_() {
  var queue = loadDeferredDriveTrashQueue_();
  var summary = {
    ok: true,
    attempted: 0,
    trashed: 0,
    failed: 0,
    retrying: 0,
    pending: queue.length
  };

  if (queue.length === 0) {
    removeDeferredDriveTrashTriggers_();
    return summary;
  }

  var now = Date.now();
  var processed = 0;
  var remaining = [];
  queue.forEach(function(item) {
    if (processed >= DEFERRED_DRIVE_TRASH_MAX_ITEMS_PER_RUN
        || Number(item.nextAttemptAtMillis || 0) > now) {
      remaining.push(item);
      return;
    }

    processed += 1;
    summary.attempted += 1;
    var result = trashDriveFiles_([item.fileId]);
    if (result.trashed > 0) {
      summary.trashed += result.trashed;
      return;
    }

    item.attempts = Number(item.attempts || 0) + 1;
    item.lastError = 'Drive 檔案移入垃圾桶失敗。';
    if (item.attempts >= DEFERRED_DRIVE_TRASH_MAX_ATTEMPTS) {
      summary.failed += 1;
      return;
    }

    item.nextAttemptAtMillis = now + DEFERRED_DRIVE_TRASH_RETRY_DELAY_MILLIS;
    summary.retrying += 1;
    remaining.push(item);
  });

  saveDeferredDriveTrashQueue_(remaining);
  summary.pending = remaining.length;
  if (remaining.length === 0) {
    removeDeferredDriveTrashTriggers_();
  } else if (listAssignmentReminderTriggers().length === 0
      && listDeferredDriveTrashTriggers_().length <= 1) {
    // The one-shot trigger that invoked this run will disappear after it
    // completes, so create a delayed retry when no hourly reminder trigger is
    // available to pick up the queue.
    scheduleDeferredDriveTrashRetry_();
  }
  return summary;
}

function handleGetActivityLogs_(payload) {
  var state = loadState_();
  var viewer = requireSessionUser_(state, payload, ['SuperAdmin', 'Admin']);
  if (!isShapePrintUser_(viewer)) {
    throw new Error('FORBIDDEN: 操作紀錄僅限形印組查看。');
  }
  var requestedLimit = Number(payload && payload.limit || 100);
  var limit = Math.max(1, Math.min(200, isNaN(requestedLimit) ? 100 : requestedLimit));
  return { logs: loadActivityLogs_().slice(0, limit) };
}

function loadPasswordResetTokens_() {
  setupSheets_();

  var config = getConfig_();
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  return readTable_(spreadsheet, 'Password_Reset_Tokens').map(function(record) {
    return normalizePasswordResetTokenRecord_(record);
  });
}

function persistPasswordResetTokens_(records) {
  setupSheets_();

  var config = getConfig_();
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  var normalizedRecords = ensureArray_(records).map(function(record) {
    return normalizePasswordResetTokenRecord_(record);
  }).sort(function(a, b) {
    return Number(b.Requested_At_Millis || 0) - Number(a.Requested_At_Millis || 0);
  });

  writeTable_(spreadsheet, 'Password_Reset_Tokens', normalizedRecords);
}

function writeStateTables_(spreadsheet, state) {
  writeTable_(spreadsheet, 'Config_Stages', state.Config_Stages);
  writeTable_(spreadsheet, 'Users', state.Users);
  writeTable_(spreadsheet, 'Teams', state.Teams);
  writeTable_(spreadsheet, 'Purchase_Items', state.Purchase_Items);
  writeTable_(spreadsheet, 'Assignments', state.Assignments);
  writeTable_(spreadsheet, 'Assignment_Resources', state.Assignment_Resources);
  writeTable_(spreadsheet, 'Assignment_Submissions', state.Assignment_Submissions);
  writeTable_(spreadsheet, 'Files', state.Files);
  writeTable_(spreadsheet, 'Notifications', state.Notifications);
  writeTable_(spreadsheet, 'Discussion_Comments', state.Discussion_Comments);
  writeTable_(spreadsheet, 'Design_Service_Settings', state.Design_Service_Settings);
  writeTable_(spreadsheet, 'Design_Service_Orders', state.Design_Service_Orders);
  writeTable_(spreadsheet, 'Calendar_Events', state.Calendar_Events);
  writeTable_(spreadsheet, 'Work_Items', state.Work_Items);
  writeTable_(spreadsheet, 'Recycle_Bin', state.Recycle_Bin);
  writeMetaSheet_(spreadsheet, state.Meta || {});
  cacheState_(state);
}

function buildClientStateResult_(state, extraData) {
  var result = cloneObject_(extraData || {});
  var safeState = sanitizeStateForClient_(state);
  result.state = safeState;
  result.heatmap = buildHeatmapStats_(safeState);
  return result;
}

function sanitizeStateForClient_(state) {
  var safeState = cloneObject_(state);
  safeState = normalizeState_(safeState);
  safeState.Users = safeState.Users.map(function(user) {
    return sanitizeUserRecord_(user);
  });
  return safeState;
}

function sanitizeUserRecord_(user) {
  var safeUser = cloneObject_(user);
  safeUser.Password = '';
  return safeUser;
}

function loadAuthSessions_() {
  var config = getConfig_();
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  return readTable_(spreadsheet, 'Auth_Sessions').map(function(record) {
    return normalizeAuthSessionRecord_(record);
  });
}

function persistAuthSessions_(records) {
  var config = getConfig_();
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  var normalized = ensureArray_(records).map(function(record) {
    return normalizeAuthSessionRecord_(record);
  }).filter(function(record) {
    return record.Session_ID && record.Token_Hash;
  });
  writeTable_(spreadsheet, 'Auth_Sessions', normalized);
}

function loadLoginUser_(email) {
  var config = getConfig_();
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  return findUserByEmail_(readTable_(spreadsheet, 'Users'), email);
}

function upgradeLegacyLoginPassword_(user, password) {
  var config = getConfig_();
  var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  var users = readTable_(spreadsheet, 'Users');
  var storedUser = findUserByEmail_(users, user && user.Email);

  if (!storedUser) {
    throw new Error('無效的帳號或密碼。');
  }

  if (!isPasswordHash_(storedUser.Password)) {
    storedUser.Password = hashPassword_(password);
    writeTable_(spreadsheet, 'Users', users);
    CacheService.getScriptCache().remove(getStateCacheKey_());
  }

  return storedUser;
}

function normalizeAuthSessionRecord_(record) {
  if (!record || typeof record !== 'object') {
    record = {};
  }
  record.Session_ID = String(record.Session_ID || '');
  record.User_ID = String(record.User_ID || '');
  record.Token_Hash = String(record.Token_Hash || '');
  record.Created_At = String(record.Created_At || '');
  record.Expires_At = String(record.Expires_At || '');
  record.Last_Seen_At = String(record.Last_Seen_At || '');
  record.Revoked_At = String(record.Revoked_At || '');
  record.Expires_At_Millis = Number(record.Expires_At_Millis || 0);
  return record;
}

function hashSessionToken_(token) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(token || ''),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(digest);
}

function cleanupAuthSessions_(records) {
  var cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
  return ensureArray_(records).filter(function(record) {
    var expiresAt = Number(record.Expires_At_Millis || 0);
    return expiresAt === 0 || expiresAt >= cutoff;
  });
}

function issueSession_(user) {
  var sessions = cleanupAuthSessions_(loadAuthSessions_());
  var now = new Date();
  var expiresAt = new Date(now.getTime() + (AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000));
  var rawToken = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var activeSessions = sessions.filter(function(session) {
    return session.User_ID === String(user.User_ID || '')
      && !session.Revoked_At
      && Number(session.Expires_At_Millis || 0) > now.getTime();
  }).sort(function(a, b) {
    return Number(a.Expires_At_Millis || 0) - Number(b.Expires_At_Millis || 0);
  });

  while (activeSessions.length >= AUTH_SESSION_MAX_PER_USER) {
    var oldest = activeSessions.shift();
    oldest.Revoked_At = formatDateTime_(now);
  }

  sessions.unshift(normalizeAuthSessionRecord_({
    Session_ID: generateSequentialId_('SES', sessions, 'Session_ID'),
    User_ID: String(user.User_ID || ''),
    Token_Hash: hashSessionToken_(rawToken),
    Created_At: formatDateTime_(now),
    Expires_At: formatDateTime_(expiresAt),
    Last_Seen_At: formatDateTime_(now),
    Revoked_At: '',
    Expires_At_Millis: expiresAt.getTime()
  }));
  persistAuthSessions_(sessions);

  return {
    token: rawToken,
    expiresAt: formatDateTime_(expiresAt)
  };
}

function requireSessionContext_(state, payload, allowedRoles) {
  var rawToken = String(payload && payload.sessionToken || '').trim();
  if (!rawToken) {
    throw new Error('AUTH_REQUIRED: 請重新登入後再繼續。');
  }

  var tokenHash = hashSessionToken_(rawToken);
  var now = Date.now();
  var sessions = cleanupAuthSessions_(loadAuthSessions_());
  var session = sessions.find(function(item) {
    return item.Token_Hash === tokenHash
      && !item.Revoked_At
      && Number(item.Expires_At_Millis || 0) > now;
  }) || null;
  if (!session) {
    throw new Error('AUTH_EXPIRED: 登入狀態已過期，請重新登入。');
  }

  var user = ensureArray_(state && state.Users).find(function(item) {
    return String(item.User_ID || '') === session.User_ID;
  }) || null;
  if (!user || String(user.Status || '') !== 'Active') {
    throw new Error('AUTH_EXPIRED: 帳號目前無法使用，請重新登入。');
  }
  if (ensureArray_(allowedRoles).length > 0 && ensureArray_(allowedRoles).indexOf(String(user.Role || '')) === -1) {
    throw new Error('FORBIDDEN: 你沒有執行這項操作的權限。');
  }

  return { user: user, session: session };
}

function requireSessionUser_(state, payload, allowedRoles) {
  return requireSessionContext_(state, payload, allowedRoles).user;
}

function handleLogoutSession_(payload) {
  var rawToken = String(payload && payload.sessionToken || '').trim();
  if (!rawToken) return { revoked: false };
  var tokenHash = hashSessionToken_(rawToken);
  var sessions = loadAuthSessions_();
  var changed = false;
  sessions.forEach(function(session) {
    if (session.Token_Hash === tokenHash && !session.Revoked_At) {
      session.Revoked_At = nowString_();
      changed = true;
    }
  });
  if (changed) persistAuthSessions_(sessions);
  return { revoked: changed };
}

function revokeAllSessionsForUser_(userId) {
  var targetUserId = String(userId || '').trim();
  if (!targetUserId) return;
  var sessions = loadAuthSessions_();
  var changed = false;
  sessions.forEach(function(session) {
    if (session.User_ID === targetUserId && !session.Revoked_At) {
      session.Revoked_At = nowString_();
      changed = true;
    }
  });
  if (changed) persistAuthSessions_(sessions);
}

function requireStudentUploadActor_(state, payload) {
  var actor = requireSessionUser_(state, payload, ['Leader', 'Member']);
  if (!actor.Team_ID || actor.Team_ID === 'T00') {
    throw new Error('FORBIDDEN: 只有已加入正式小組的帳號可以上傳檔案。');
  }
  var requestedTeamId = String(payload && payload.teamId || '').trim();
  if (requestedTeamId && requestedTeamId !== String(actor.Team_ID || '')) {
    throw new Error('FORBIDDEN: 不可替其他小組上傳檔案。');
  }
  return actor;
}

function isAssignmentVisibleToTeam_(state, assignment, teamId) {
  return getAssignmentTargetTeamIds_(state, assignment).indexOf(String(teamId || '')) >= 0;
}

function filterStateForUser_(state, user) {
  var safeState = sanitizeStateForClient_(state);
  if (isShapePrintUser_(user)) {
    safeState.Meta = { State_Revision: getStateRevision_(state) };
    return safeState;
  }

  var teamId = String(user.Team_ID || '');
  var visibleAssignments = safeState.Assignments.filter(function(assignment) {
    return isAssignmentVisibleToTeam_(state, assignment, teamId);
  });
  var visibleAssignmentIds = {};
  visibleAssignments.forEach(function(assignment) {
    visibleAssignmentIds[String(assignment.Assignment_ID || '')] = true;
    if (String(assignment.Target_Mode || '') === 'selected') {
      assignment.Target_Team_IDs = [teamId];
    }
  });

  safeState.Users = safeState.Users.filter(function(item) {
    return String(item.Team_ID || '') === teamId;
  });
  safeState.Teams = safeState.Teams.filter(function(item) {
    return String(item.Team_ID || '') === teamId;
  });
  safeState.Config_Stages = safeState.Config_Stages.map(function(stage) {
    stage.Budget_Allocated = 0;
    return stage;
  });
  safeState.Purchase_Items = safeState.Purchase_Items.map(function(item) {
    item.Vendor_Price = 0;
    item.Subtotal = 0;
    return item;
  });
  safeState.Assignments = visibleAssignments;
  safeState.Assignment_Resources = safeState.Assignment_Resources.filter(function(resource) {
    return visibleAssignmentIds[String(resource.Assignment_ID || '')];
  });
  safeState.Assignment_Submissions = safeState.Assignment_Submissions.filter(function(item) {
    return String(item.Team_ID || '') === teamId;
  });
  safeState.Files = safeState.Files.filter(function(item) {
    return String(item.Team_ID || '') === teamId;
  });
  safeState.Notifications = safeState.Notifications.filter(function(item) {
    return String(item.User_ID || '') === String(user.User_ID || '');
  });
  safeState.Discussion_Comments = safeState.Discussion_Comments.filter(function(comment) {
    return String(comment.Team_ID || '') === teamId
      || (String(comment.Ref_Type || '') === 'assignment' && visibleAssignmentIds[String(comment.Ref_ID || '')]);
  });
  safeState.Design_Service_Settings = safeState.Design_Service_Settings.map(function(settings) {
    return {
      Settings_ID: settings.Settings_ID,
      Enabled: settings.Enabled === true,
      Updated_At: settings.Updated_At
    };
  });
  safeState.Design_Service_Orders = safeState.Design_Service_Orders.filter(function(order) {
    return String(order.Team_ID || '') === teamId;
  });
  // 工作事項是形印組內部協作資料，不提供給畢製小組帳號。
  safeState.Work_Items = [];
  // 工作行事曆是形印組內部排程，小組帳號不取得任何事件資料。
  safeState.Calendar_Events = [];
  // 回收桶內含其他小組與管理端的刪除快照，僅限形印組查看與復原。
  safeState.Recycle_Bin = [];
  safeState.Meta = { State_Revision: getStateRevision_(state) };
  return safeState;
}

function buildHeatmapSourceStateForUser_(state, user) {
  var sourceState = {
    Files: ensureArray_(state && state.Files),
    Purchase_Items: ensureArray_(state && state.Purchase_Items),
    Assignment_Submissions: ensureArray_(state && state.Assignment_Submissions)
  };

  if (isShapePrintUser_(user)) {
    return sourceState;
  }

  var teamId = String(user && user.Team_ID || '');
  sourceState.Files = sourceState.Files.filter(function(file) {
    return String(file && file.Team_ID || '') === teamId;
  });
  sourceState.Assignment_Submissions = sourceState.Assignment_Submissions.filter(function(submission) {
    return String(submission && submission.Team_ID || '') === teamId;
  });
  return sourceState;
}

function buildClientStateResultForUser_(state, user, extraData, options) {
  options = options || {};
  var result = cloneObject_(extraData || {});
  var safeState = filterStateForUser_(state, user);
  result.state = safeState;
  result.currentUser = sanitizeUserRecord_(user);
  result.stateRevision = getStateRevision_(state);
  if (options.includeHeatmap !== false) {
    result.heatmap = buildHeatmapStats_(buildHeatmapSourceStateForUser_(state, user));
  }
  return result;
}

function mergeSensitiveState_(nextState, existingState, options) {
  options = options || {};
  var usersById = {};
  var usersByEmail = {};
  var assignmentsById = {};

  ensureArray_(existingState && existingState.Users).forEach(function(user) {
    var normalizedEmail = normalizeEmail_(user.Email);
    if (user.User_ID) {
      usersById[String(user.User_ID)] = cloneObject_(user);
    }
    if (normalizedEmail) {
      usersByEmail[normalizedEmail] = cloneObject_(user);
    }
  });

  ensureArray_(existingState && existingState.Assignments).forEach(function(assignment) {
    if (!assignment || !assignment.Assignment_ID) return;
    assignmentsById[String(assignment.Assignment_ID)] = cloneObject_(assignment);
  });

  nextState.Users = ensureArray_(nextState.Users).map(function(user) {
    var nextUser = cloneObject_(user);
    var existingUser = usersById[String(nextUser.User_ID || '')] || usersByEmail[normalizeEmail_(nextUser.Email)] || null;
    var rawPassword = String(nextUser.Password || '');

    if (rawPassword) {
      nextUser.Password = isPasswordHash_(rawPassword) ? rawPassword : hashPassword_(rawPassword);
    } else if (existingUser && existingUser.Password) {
      nextUser.Password = String(existingUser.Password);
    } else {
      nextUser.Password = '';
    }

    return nextUser;
  });

  nextState.Assignments = ensureArray_(nextState.Assignments).map(function(assignment) {
    var nextAssignment = cloneObject_(assignment);
    var existingAssignment = assignmentsById[String(nextAssignment.Assignment_ID || '')] || null;

    nextAssignment.Notify_By_Email = nextAssignment.Notify_By_Email === true;
    nextAssignment.Email_Notification_Sent = nextAssignment.Email_Notification_Sent === true
      || Boolean(existingAssignment && existingAssignment.Email_Notification_Sent === true);
    nextAssignment.Email_Notification_Status = String(
      nextAssignment.Email_Notification_Status
        || (existingAssignment && existingAssignment.Email_Notification_Status)
        || (nextAssignment.Email_Notification_Sent ? '已寄送' : nextAssignment.Notify_By_Email ? '待寄送' : '未啟用')
    );
    nextAssignment.Email_Notification_Recipient_Count = Number(
      nextAssignment.Email_Notification_Recipient_Count
        || (existingAssignment && existingAssignment.Email_Notification_Recipient_Count)
        || 0
    );
    nextAssignment.Email_Notification_Sent_At = String(
      nextAssignment.Email_Notification_Sent_At
        || (existingAssignment && existingAssignment.Email_Notification_Sent_At)
        || ''
    );
    nextAssignment.Email_Notification_Last_Error = String(
      nextAssignment.Email_Notification_Last_Error
        || (existingAssignment && existingAssignment.Email_Notification_Last_Error)
        || ''
    );

    return nextAssignment;
  });

  // 代做案件只能透過專用 action 修改，避免舊版前端 saveState 把最新派案覆蓋掉。
  if (options.preserveDesignServiceState !== false) {
    nextState.Design_Service_Settings = cloneObject_(ensureArray_(existingState && existingState.Design_Service_Settings));
    nextState.Design_Service_Orders = cloneObject_(ensureArray_(existingState && existingState.Design_Service_Orders));
  } else {
    nextState.Design_Service_Settings = ensureArray_(nextState.Design_Service_Settings).map(function(settings) {
      return hydrateDesignServiceSettingsRecord_(settings);
    });
    nextState.Design_Service_Orders = ensureArray_(nextState.Design_Service_Orders).map(function(order) {
      return hydrateDesignServiceOrderRecord_(order);
    });
  }

  // 項目附件必須透過專用上傳／刪除 action 異動，避免其他頁面的舊快照
  // 在一般 saveState 時意外覆蓋掉已歸檔到 Google Drive 的資源紀錄。
  if (options.preserveAssignmentResourceState !== false) {
    nextState.Assignment_Resources = cloneObject_(ensureArray_(existingState && existingState.Assignment_Resources));
  } else {
    nextState.Assignment_Resources = ensureArray_(nextState.Assignment_Resources).map(function(resource) {
      return hydrateAssignmentResourceRecord_(resource);
    });
  }

  // 工作行事曆僅由專用 action 異動，避免一般 saveState 的舊快照覆蓋排程。
  if (options.preserveCalendarEventState !== false) {
    nextState.Calendar_Events = cloneObject_(ensureArray_(existingState && existingState.Calendar_Events));
  } else {
    nextState.Calendar_Events = ensureArray_(nextState.Calendar_Events).map(function(event) {
      return hydrateCalendarEventRecord_(event);
    });
  }

  // 工作事項只能由專用 action 異動，避免舊畫面快照覆蓋認養或指派結果。
  if (options.preserveWorkItemState !== false) {
    nextState.Work_Items = cloneObject_(ensureArray_(existingState && existingState.Work_Items));
  } else {
    nextState.Work_Items = ensureArray_(nextState.Work_Items).map(function(item) {
      return hydrateWorkItemRecord_(item);
    });
  }

  // 回收桶只能由專用刪除／復原 action 異動，避免舊版網頁快照覆蓋掉待復原資料。
  if (options.preserveRecycleBinState !== false) {
    nextState.Recycle_Bin = cloneObject_(ensureArray_(existingState && existingState.Recycle_Bin));
  } else {
    nextState.Recycle_Bin = ensureArray_(nextState.Recycle_Bin).map(function(entry) {
      return hydrateRecycleBinRecord_(entry);
    });
  }

  return nextState;
}

function ensureSheet_(spreadsheet, sheetName, headers) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  var currentLastColumn = Math.max(sheet.getLastColumn(), headers.length);
  var currentHeaders = currentLastColumn > 0
    ? sheet.getRange(1, 1, 1, currentLastColumn).getValues()[0]
    : [];
  var shouldRewriteHeader = headers.some(function(header, index) {
    return String(currentHeaders[index] || '') !== header;
  });

  if (shouldRewriteHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function readTable_(spreadsheet, sheetName) {
  var schema = TABLE_SCHEMAS[sheetName];
  var sheet = ensureSheet_(spreadsheet, sheetName, schema.headers);
  var lastRow = sheet.getLastRow();
  var lastColumn = Math.max(sheet.getLastColumn(), schema.headers.length);

  if (lastRow <= 1) {
    return [];
  }

  var values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  var headerRow = values[0].map(function(value) {
    return String(value || '').trim();
  });
  var rows = values.slice(1);

  return rows.filter(function(row) {
    return row.some(function(cell) {
      return String(cell || '').trim() !== '';
    });
  }).map(function(row) {
    var record = {};
    schema.headers.forEach(function(header) {
      var index = headerRow.indexOf(header);
      var rawValue = index >= 0 ? row[index] : '';
      record[header] = coerceValue_(rawValue, schema.types[header] || 'string');
    });
    return record;
  });
}

function writeTable_(spreadsheet, sheetName, records) {
  var schema = TABLE_SCHEMAS[sheetName];
  var sheet = ensureSheet_(spreadsheet, sheetName, schema.headers);
  var rows = ensureArray_(records).map(function(record) {
    return schema.headers.map(function(header) {
      return serializeValue_(record[header], schema.types[header] || 'string');
    });
  });

  sheet.clearContents();
  sheet.getRange(1, 1, 1, schema.headers.length).setValues([schema.headers]);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, schema.headers.length).setValues(rows);
  }
}

function readMetaSheet_(spreadsheet) {
  var rows = readTable_(spreadsheet, 'Meta');
  var meta = {};

  rows.forEach(function(row) {
    if (!row.Key) return;
    meta[row.Key] = row.Value;
  });

  return meta;
}

function writeMetaSheet_(spreadsheet, metaObject) {
  var rows = Object.keys(metaObject || {}).sort().map(function(key) {
    return {
      Key: key,
      Value: metaObject[key]
    };
  });

  writeTable_(spreadsheet, 'Meta', rows);
}

function coerceValue_(value, type) {
  if (type === 'number') {
    var numberValue = Number(value);
    return isNaN(numberValue) ? 0 : numberValue;
  }

  if (type === 'boolean') {
    if (value === true || value === false) return value;
    return String(value).toLowerCase() === 'true';
  }

  if (type === 'json') {
    if (value === '' || value === null || typeof value === 'undefined') {
      return null;
    }
    if (typeof value === 'object') {
      return value;
    }
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  return value === null || typeof value === 'undefined' ? '' : String(value);
}

function serializeValue_(value, type) {
  if (type === 'number') {
    var numberValue = Number(value);
    return isNaN(numberValue) ? 0 : numberValue;
  }

  if (type === 'boolean') {
    return value === true;
  }

  if (type === 'json') {
    return JSON.stringify(value === undefined ? null : value);
  }

  return value === null || typeof value === 'undefined' ? '' : String(value);
}

function normalizeState_(state) {
  if (!state || typeof state !== 'object') {
    state = {};
  }

  state.Config_Stages = ensureArray_(state.Config_Stages);
  state.Users = ensureArray_(state.Users);
  state.Teams = ensureArray_(state.Teams);
  state.Purchase_Items = ensureArray_(state.Purchase_Items).map(function(item) {
    return hydratePurchaseItemRecord_(item);
  });
  state.Assignments = ensureArray_(state.Assignments).map(function(assignment) {
    return hydrateAssignmentRecord_(assignment);
  });
  state.Assignment_Resources = ensureArray_(state.Assignment_Resources).map(function(resource) {
    return hydrateAssignmentResourceRecord_(resource);
  });
  state.Assignment_Submissions = ensureArray_(state.Assignment_Submissions).map(function(submission) {
    return hydrateAssignmentSubmissionRecord_(submission);
  });
  state.Files = ensureArray_(state.Files);
  state.Notifications = ensureArray_(state.Notifications);
  state.Discussion_Comments = ensureArray_(state.Discussion_Comments);
  state.Design_Service_Settings = ensureArray_(state.Design_Service_Settings).map(function(settings) {
    return hydrateDesignServiceSettingsRecord_(settings);
  });
  state.Design_Service_Orders = ensureArray_(state.Design_Service_Orders).map(function(order) {
    return hydrateDesignServiceOrderRecord_(order);
  });
  state.Calendar_Events = ensureArray_(state.Calendar_Events).map(function(event) {
    return hydrateCalendarEventRecord_(event);
  });
  state.Work_Items = ensureArray_(state.Work_Items).map(function(item) {
    return hydrateWorkItemRecord_(item);
  });
  state.Recycle_Bin = ensureArray_(state.Recycle_Bin).map(function(entry) {
    return hydrateRecycleBinRecord_(entry);
  });
  state.Meta = state.Meta && typeof state.Meta === 'object' ? state.Meta : {};

  state.Files = state.Files.map(function(file) {
    return hydrateFileRecord_(file);
  });
  refreshFileVersionMetadata_(state.Files);

  state.Notifications = state.Notifications.map(function(notification) {
    return hydrateNotificationRecord_(notification);
  });
  state.Discussion_Comments = state.Discussion_Comments.map(function(comment) {
    return hydrateDiscussionCommentRecord_(comment);
  });

  if (state.Notifications.length > 0 && typeof state.Meta.NotificationSeeded === 'undefined') {
    state.Meta.NotificationSeeded = true;
  }

  return state;
}

function hydrateDesignServiceSettingsRecord_(settings) {
  if (!settings || typeof settings !== 'object') {
    settings = {};
  }

  settings.Settings_ID = String(settings.Settings_ID || 'SERVICE_DEFAULT');
  settings.Enabled = settings.Enabled === true;
  settings.Eligible_User_IDs = ensureArray_(settings.Eligible_User_IDs).map(function(userId) {
    return String(userId || '').trim();
  }).filter(function(userId, index, list) {
    return userId && list.indexOf(userId) === index;
  });
  settings.Updated_At = String(settings.Updated_At || '');
  settings.Updated_By_User_ID = String(settings.Updated_By_User_ID || '');

  return settings;
}

function hydrateDesignServiceOrderRecord_(order) {
  if (!order || typeof order !== 'object') {
    order = {};
  }

  order.Service_Order_ID = String(order.Service_Order_ID || '');
  order.Assignment_ID = String(order.Assignment_ID || '');
  order.Stage_ID = String(order.Stage_ID || '');
  order.Team_ID = String(order.Team_ID || '');
  order.Requested_By_User_ID = String(order.Requested_By_User_ID || '');
  order.Requested_At = String(order.Requested_At || '');
  order.Responsible_User_ID = String(order.Responsible_User_ID || '');
  order.Responsible_Name = String(order.Responsible_Name || '');
  order.Claimed_At = String(order.Claimed_At || '');
  order.Status = String(order.Status || '待接案');
  order.File_Name = String(order.File_Name || '');
  order.Google_Drive_URL = String(order.Google_Drive_URL || '');
  order.Drive_File_ID = String(order.Drive_File_ID || '');
  order.Drive_Folder_ID = String(order.Drive_Folder_ID || '');
  order.Submitted_At = String(order.Submitted_At || '');
  order.Reviewed_By_User_ID = String(order.Reviewed_By_User_ID || '');
  order.Reviewed_At = String(order.Reviewed_At || '');
  order.Review_Note = String(order.Review_Note || '');
  order.Updated_At = String(order.Updated_At || order.Requested_At || '');

  return order;
}

function hydratePurchaseItemRecord_(item) {
  if (!item || typeof item !== 'object') {
    item = {};
  }

  item.Item_ID = String(item.Item_ID || '');
  item.Stage_ID = String(item.Stage_ID || '');
  item.Item_Name = String(item.Item_Name || '');
  item.Vendor_Price = Number(item.Vendor_Price || 0);
  item.Quantity = Number(item.Quantity || 0);
  item.Created_At = String(item.Created_At || '');
  item.Subtotal = Number(item.Subtotal || item.Vendor_Price * item.Quantity || 0);

  return item;
}

function hydrateAssignmentRecord_(assignment) {
  if (!assignment || typeof assignment !== 'object') {
    assignment = {};
  }

  assignment.Assignment_ID = String(assignment.Assignment_ID || '');
  assignment.Stage_ID = String(assignment.Stage_ID || '');
  assignment.Title = String(assignment.Title || '');
  assignment.Body = String(assignment.Body || '');
  assignment.Submission_Mode = String(assignment.Submission_Mode || 'file-text');
  assignment.Requirement_Text = String(assignment.Requirement_Text || '');
  assignment.Target_Mode = String(assignment.Target_Mode || (ensureArray_(assignment.Target_Team_IDs).length > 0 ? 'selected' : 'all'));
  assignment.Target_Team_IDs = ensureArray_(assignment.Target_Team_IDs).map(function(teamId) {
    return String(teamId || '').trim();
  }).filter(function(teamId) {
    return !!teamId;
  });
  assignment.Due_At = String(assignment.Due_At || '');
  assignment.Created_At = String(assignment.Created_At || nowString_());
  assignment.Created_By_User_ID = String(assignment.Created_By_User_ID || '');
  assignment.Status = String(assignment.Status || '進行中');
  assignment.Allow_ReSubmit = assignment.Allow_ReSubmit !== false;
  assignment.Notify_By_Email = assignment.Notify_By_Email === true;
  assignment.Email_Notification_Sent = assignment.Email_Notification_Sent === true;
  assignment.Email_Notification_Status = String(
    assignment.Email_Notification_Status
      || (assignment.Email_Notification_Sent ? '已寄送' : assignment.Notify_By_Email ? '待寄送' : '未啟用')
  );
  assignment.Email_Notification_Recipient_Count = Number(assignment.Email_Notification_Recipient_Count || 0);
  assignment.Email_Notification_Sent_At = String(assignment.Email_Notification_Sent_At || '');
  assignment.Email_Notification_Last_Error = String(assignment.Email_Notification_Last_Error || '');

  return assignment;
}

function hydrateAssignmentResourceRecord_(resource) {
  if (!resource || typeof resource !== 'object') {
    resource = {};
  }

  resource.Resource_ID = String(resource.Resource_ID || '');
  resource.Assignment_ID = String(resource.Assignment_ID || '');
  resource.File_Name = String(resource.File_Name || '');
  resource.Google_Drive_URL = String(resource.Google_Drive_URL || '');
  resource.Drive_File_ID = String(resource.Drive_File_ID || '');
  resource.Drive_Folder_ID = String(resource.Drive_Folder_ID || '');
  resource.Mime_Type = String(resource.Mime_Type || 'application/octet-stream');
  resource.File_Size = Number(resource.File_Size || 0);
  resource.Created_At = String(resource.Created_At || nowString_());
  resource.Created_By_User_ID = String(resource.Created_By_User_ID || '');

  return resource;
}

function getAssignmentSubmissionModeLabel_(mode) {
  var resolved = String(mode || 'file-text').trim();
  if (resolved === 'file') return '檔案';
  if (resolved === 'text') return '文字';
  return '檔案 + 文字';
}

function getAssignmentTargetTeamIds_(state, assignment) {
  var targetMode = String(assignment && assignment.Target_Mode || 'all');
  if (targetMode !== 'selected') {
    return ensureArray_(state && state.Teams).filter(function(team) {
      return String(team.Team_ID || '') !== 'T00';
    }).map(function(team) {
      return String(team.Team_ID || '').trim();
    }).filter(function(teamId) {
      return !!teamId;
    });
  }

  return ensureArray_(assignment && assignment.Target_Team_IDs).map(function(teamId) {
    return String(teamId || '').trim();
  }).filter(function(teamId) {
    return !!teamId;
  });
}

function getAssignmentTargetTeamLabels_(state, assignment) {
  var targetIds = getAssignmentTargetTeamIds_(state, assignment);
  if (targetIds.length === 0) {
    return '全體小組';
  }

  return targetIds.map(function(teamId) {
    var team = ensureArray_(state && state.Teams).find(function(item) {
      return String(item.Team_ID || '') === teamId;
    });
    return team ? String(team.Team_Name || teamId) : teamId;
  }).join('、');
}

function getAssignmentAnnouncementRecipients_(state, assignment) {
  var targetIds = getAssignmentTargetTeamIds_(state, assignment);
  var recipientsByEmail = {};

  ensureArray_(state && state.Users).forEach(function(user) {
    var email = normalizeEmail_(user.Email);
    if (!email) return;
    if (String(user.Status || '') !== 'Active') return;
    if (['Leader', 'Member'].indexOf(String(user.Role || '')) === -1) return;
    if (targetIds.indexOf(String(user.Team_ID || '').trim()) === -1) return;
    recipientsByEmail[email] = user;
  });

  return Object.keys(recipientsByEmail).map(function(email) {
    return recipientsByEmail[email];
  });
}

function buildAssignmentAnnouncementEmailText_(user, assignment, stageName, targetLabel, frontendUrl) {
  var displayName = String(user && user.Name ? user.Name : '同學').trim() || '同學';
  var dueLabel = formatCompactDateTimeLabel_(assignment.Due_At || '') || '未設定';
  return [
    displayName + ' 您好，',
    '',
    '您所屬小組有一則新的繳交項目通知。',
    '',
    '項目標題：' + String(assignment.Title || ''),
    '會期：' + String(stageName || '未設定'),
    '適用對象：' + String(targetLabel || '全體小組'),
    '截止時間：' + dueLabel,
    '繳交形式：' + getAssignmentSubmissionModeLabel_(assignment.Submission_Mode),
    '允許重新繳交：' + (assignment.Allow_ReSubmit ? '是' : '否'),
    '',
    '項目說明：',
    String(assignment.Body || '（無）'),
    '',
    '繳交需求補充：',
    String(assignment.Requirement_Text || '（無）'),
    '',
    frontendUrl ? '請登入系統查看完整內容：' + frontendUrl : '請登入系統查看完整內容。',
    '',
    '畢展形印組管理系統'
  ].join('\n');
}

function buildAssignmentAnnouncementEmailHtml_(user, assignment, stageName, targetLabel, frontendUrl) {
  var displayName = String(user && user.Name ? user.Name : '同學').trim() || '同學';
  var dueLabel = formatCompactDateTimeLabel_(assignment.Due_At || '') || '未設定';
  var ctaHtml = frontendUrl
    ? '<p><a href="' + escapeHtml_(frontendUrl) + '" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#0066CC;color:#FFFFFF;text-decoration:none;font-weight:700;">前往系統查看</a></p>'
    : '';

  return [
    '<div style="font-family:Arial,\'PingFang TC\',\'Microsoft JhengHei\',sans-serif;line-height:1.7;color:#1D1D1F;">',
    '<p>' + escapeHtml_(displayName) + ' 您好，</p>',
    '<p>您所屬小組有一則新的繳交項目通知。</p>',
    '<div style="background:#F5F5F7;border:1px solid #E5E5EA;border-radius:16px;padding:16px;">',
    '<p style="margin:0 0 6px;"><strong>項目標題</strong>：' + escapeHtml_(assignment.Title || '') + '</p>',
    '<p style="margin:0 0 6px;"><strong>會期</strong>：' + escapeHtml_(stageName || '未設定') + '</p>',
    '<p style="margin:0 0 6px;"><strong>適用對象</strong>：' + escapeHtml_(targetLabel || '全體小組') + '</p>',
    '<p style="margin:0 0 6px;"><strong>截止時間</strong>：' + escapeHtml_(dueLabel) + '</p>',
    '<p style="margin:0 0 6px;"><strong>繳交形式</strong>：' + escapeHtml_(getAssignmentSubmissionModeLabel_(assignment.Submission_Mode)) + '</p>',
    '<p style="margin:0;"><strong>允許重新繳交</strong>：' + (assignment.Allow_ReSubmit ? '是' : '否') + '</p>',
    '</div>',
    '<div style="margin-top:16px;">',
    '<p style="margin:0 0 6px;font-weight:700;">項目說明</p>',
    '<p style="margin:0;color:#3A3A3C;white-space:pre-line;">' + escapeHtml_(assignment.Body || '（無）') + '</p>',
    '</div>',
    '<div style="margin-top:16px;">',
    '<p style="margin:0 0 6px;font-weight:700;">繳交需求補充</p>',
    '<p style="margin:0;color:#3A3A3C;white-space:pre-line;">' + escapeHtml_(assignment.Requirement_Text || '（無）') + '</p>',
    '</div>',
    '<div style="margin-top:20px;">' + ctaHtml + '</div>',
    '<p style="font-size:12px;color:#6E6E73;">若您無法使用按鈕，也可以直接前往系統查看完整內容。</p>',
    '<p style="margin-top:24px;">畢展形印組管理系統</p>',
    '</div>'
  ].join('');
}

function sendAssignmentAnnouncementEmail_(state, assignment) {
  if (!assignment || assignment.Notify_By_Email !== true || assignment.Email_Notification_Sent === true) {
    return false;
  }

  var recipients = getAssignmentAnnouncementRecipients_(state, assignment);
  assignment.Email_Notification_Status = '寄送中';
  assignment.Email_Notification_Recipient_Count = recipients.length;
  assignment.Email_Notification_Sent_At = '';
  assignment.Email_Notification_Last_Error = '';

  if (recipients.length === 0) {
    assignment.Email_Notification_Sent = false;
    assignment.Email_Notification_Status = '無收件人';
    assignment.Email_Notification_Last_Error = '找不到符合條件且已啟用的組長或組員信箱。';
    Logger.log('No active recipients for assignment announcement ' + String(assignment.Assignment_ID || ''));
    return {
      assignmentId: String(assignment.Assignment_ID || ''),
      status: assignment.Email_Notification_Status,
      recipientCount: 0,
      sentCount: 0
    };
  }

  var stage = ensureArray_(state && state.Config_Stages).find(function(item) {
    return String(item.Stage_ID || '') === String(assignment.Stage_ID || '');
  }) || null;
  var stageName = stage ? String(stage.Stage_Name || '') : '';
  var targetLabel = getAssignmentTargetTeamLabels_(state, assignment);
  var frontendUrl = String(getConfig_().frontendBaseUrl || APP_DEFAULTS.frontendBaseUrl || '').trim();
  var subject = '【畢展形印組管理系統】新繳交項目：' + String(assignment.Title || '未命名項目');
  var sentCount = 0;
  var failures = [];

  recipients.forEach(function(user) {
    var email = normalizeEmail_(user.Email);
    if (!email) return;

    var plainText = buildAssignmentAnnouncementEmailText_(user, assignment, stageName, targetLabel, frontendUrl);
    var htmlBody = buildAssignmentAnnouncementEmailHtml_(user, assignment, stageName, targetLabel, frontendUrl);

    try {
      sendSystemEmail_(email, subject, plainText, htmlBody);
      sentCount += 1;
    } catch (error) {
      failures.push(email + ': ' + String(error && error.message || error));
      Logger.log('Failed to send assignment announcement email to ' + email + ': ' + error);
    }
  });

  assignment.Email_Notification_Sent = sentCount === recipients.length;
  assignment.Email_Notification_Status = assignment.Email_Notification_Sent ? '已寄送' : '寄送失敗';
  assignment.Email_Notification_Sent_At = assignment.Email_Notification_Sent ? nowString_() : '';
  assignment.Email_Notification_Last_Error = failures.slice(0, 3).join('；');

  return {
    assignmentId: String(assignment.Assignment_ID || ''),
    status: assignment.Email_Notification_Status,
    recipientCount: recipients.length,
    sentCount: sentCount,
    error: assignment.Email_Notification_Last_Error
  };
}

function sendPendingAssignmentAnnouncementEmails_(state) {
  var results = [];
  ensureArray_(state && state.Assignments).forEach(function(assignment) {
    if (!assignment || assignment.Notify_By_Email !== true || assignment.Email_Notification_Sent === true) {
      return;
    }

    var result = sendAssignmentAnnouncementEmail_(state, assignment);
    if (result && typeof result === 'object') {
      results.push(result);
    }
  });
  return results;
}

function normalizeAssignmentReminderSettings_(rawSettings) {
  var settings = rawSettings && typeof rawSettings === 'object' ? cloneObject_(rawSettings) : {};
  var offsets = ensureArray_(settings.offsetsHours).map(function(value) {
    return Number(value);
  }).filter(function(value) {
    return !isNaN(value) && value > 0;
  }).sort(function(a, b) {
    return a - b;
  });

  if (offsets.length === 0) {
    offsets = ASSIGNMENT_REMINDER_DEFAULT_OFFSETS_HOURS.slice().sort(function(a, b) {
      return a - b;
    });
  }

  var leaderEscalationHours = Number(settings.leaderEscalationHours);
  if (isNaN(leaderEscalationHours) || leaderEscalationHours <= 0) {
    leaderEscalationHours = 24;
  }
  var shapePrintEscalationHours = Number(settings.shapePrintEscalationHours);
  if (isNaN(shapePrintEscalationHours) || shapePrintEscalationHours < 0) {
    shapePrintEscalationHours = 6;
  }

  return {
    enabled: settings.enabled !== false,
    offsetsHours: offsets,
    sendEmail: settings.sendEmail !== false,
    sendSiteNotifications: settings.sendSiteNotifications !== false,
    escalationEnabled: settings.escalationEnabled !== false,
    leaderEscalationHours: leaderEscalationHours,
    shapePrintEscalationHours: shapePrintEscalationHours
  };
}

function getAssignmentReminderSettings_(state) {
  var metaSettings = state && state.Meta ? state.Meta[ASSIGNMENT_REMINDER_SETTINGS_META_KEY] : null;
  return normalizeAssignmentReminderSettings_(metaSettings);
}

function getAssignmentReminderLog_(state) {
  var rawLog = state && state.Meta ? state.Meta[ASSIGNMENT_REMINDER_LOG_META_KEY] : null;
  if (!rawLog || typeof rawLog !== 'object' || Array.isArray(rawLog)) {
    rawLog = {};
  }
  return rawLog;
}

function buildAssignmentReminderKey_(assignmentId, teamId, reminderCode) {
  return [
    String(assignmentId || '').trim(),
    String(teamId || '').trim(),
    String(reminderCode || '').trim()
  ].join('|');
}

function hasAssignmentSubmissionForTeam_(state, assignmentId, teamId) {
  return ensureArray_(state && state.Assignment_Submissions).some(function(submission) {
    return String(submission.Assignment_ID || '') === String(assignmentId || '')
      && String(submission.Team_ID || '') === String(teamId || '');
  });
}

function getActiveStudentRecipientsForTeam_(state, teamId) {
  return ensureArray_(state && state.Users).filter(function(user) {
    return String(user.Team_ID || '') === String(teamId || '')
      && String(user.Status || '') === 'Active'
      && ['Leader', 'Member'].indexOf(String(user.Role || '')) >= 0
      && normalizeEmail_(user.Email);
  });
}

function getActiveLeaderRecipientsForTeam_(state, teamId) {
  return ensureArray_(state && state.Users).filter(function(user) {
    return String(user.Team_ID || '') === String(teamId || '')
      && String(user.Status || '') === 'Active'
      && String(user.Role || '') === 'Leader'
      && normalizeEmail_(user.Email);
  });
}

function getActiveShapePrintRecipients_(state) {
  return ensureArray_(state && state.Users).filter(function(user) {
    return String(user.Status || '') === 'Active'
      && ['SuperAdmin', 'Admin'].indexOf(String(user.Role || '')) >= 0
      && normalizeEmail_(user.Email);
  });
}

function getAssignmentReminderBucket_(hoursUntilDue, offsetsHours) {
  if (isNaN(hoursUntilDue)) {
    return null;
  }

  if (hoursUntilDue <= 0) {
    return {
      code: 'overdue',
      label: '已逾期',
      priority: 'high'
    };
  }

  var matchedOffset = ensureArray_(offsetsHours).find(function(offset) {
    return hoursUntilDue <= Number(offset);
  });

  if (!matchedOffset) {
    return null;
  }

  return {
    code: 'before_' + String(matchedOffset).replace(/\./g, '_') + 'h',
    label: formatReminderOffsetLabel_(matchedOffset),
    priority: Number(matchedOffset) <= 6 ? 'high' : 'normal',
    offsetHours: Number(matchedOffset)
  };
}

function getAssignmentEscalationBucket_(hoursUntilDue, settings) {
  if (isNaN(hoursUntilDue) || !settings || settings.escalationEnabled === false) {
    return null;
  }

  var leaderHours = Number(settings.leaderEscalationHours || 24);
  var shapePrintHours = Number(settings.shapePrintEscalationHours || 6);
  if (hoursUntilDue > 0 && hoursUntilDue <= leaderHours) {
    return {
      code: 'leader_before_' + String(leaderHours).replace(/\./g, '_') + 'h',
      label: '截止前 ' + formatReminderOffsetLabel_(leaderHours) + '通知組長',
      audience: 'leader',
      priority: 'high'
    };
  }
  if (hoursUntilDue <= -shapePrintHours) {
    return {
      code: 'shapeprint_overdue_' + String(shapePrintHours).replace(/\./g, '_') + 'h',
      label: '逾期 ' + (shapePrintHours > 0 ? String(shapePrintHours) + ' 小時' : '後') + '通知形印組',
      audience: 'shapeprint',
      priority: 'high'
    };
  }
  return null;
}

function formatReminderOffsetLabel_(hours) {
  var numericHours = Number(hours || 0);
  if (numericHours >= 24 && numericHours % 24 === 0) {
    return String(numericHours / 24) + ' 天內';
  }
  return String(numericHours) + ' 小時內';
}

function buildAssignmentReminderNotificationMessage_(assignment, dueAtText, bucket) {
  var dueLabel = formatCompactDateTimeLabel_(dueAtText || assignment.Due_At || '') || '指定時間';

  if (bucket && bucket.code === 'overdue') {
    return '「' + String(assignment.Title || '未命名作業') + '」已於 ' + dueLabel + ' 截止，目前系統仍未收到你的小組繳交。';
  }

  return '「' + String(assignment.Title || '未命名作業') + '」將於 ' + dueLabel + ' 截止，目前系統仍未收到你的小組繳交。';
}

function buildAssignmentReminderEmailText_(user, assignment, stageName, teamName, dueAtText, bucket, frontendUrl) {
  var displayName = String(user && user.Name ? user.Name : '同學').trim() || '同學';
  var dueLabel = formatCompactDateTimeLabel_(dueAtText || assignment.Due_At || '') || '未設定';
  var intro = bucket && bucket.code === 'overdue'
    ? '系統偵測到你的小組目前仍未完成以下作業繳交，且已超過截止時間。'
    : '系統提醒你的小組目前仍未完成以下作業繳交。';

  return [
    displayName + ' 您好，',
    '',
    intro,
    '',
    '項目標題：' + String(assignment.Title || ''),
    '會期：' + String(stageName || '未設定'),
    '所屬小組：' + String(teamName || '未設定'),
    '提醒節點：' + String(bucket && bucket.label ? bucket.label : '截止提醒'),
    '截止時間：' + dueLabel,
    '繳交形式：' + getAssignmentSubmissionModeLabel_(assignment.Submission_Mode),
    '',
    '項目說明：',
    String(assignment.Body || '（無）'),
    '',
    '繳交需求補充：',
    String(assignment.Requirement_Text || '（無）'),
    '',
    frontendUrl ? '請盡快登入系統完成繳交：' + frontendUrl : '請盡快登入系統完成繳交。',
    '',
    '畢展形印組管理系統'
  ].join('\n');
}

function buildAssignmentReminderEmailHtml_(user, assignment, stageName, teamName, dueAtText, bucket, frontendUrl) {
  var displayName = String(user && user.Name ? user.Name : '同學').trim() || '同學';
  var dueLabel = formatCompactDateTimeLabel_(dueAtText || assignment.Due_At || '') || '未設定';
  var intro = bucket && bucket.code === 'overdue'
    ? '系統偵測到你的小組目前仍未完成以下作業繳交，且已超過截止時間。'
    : '系統提醒你的小組目前仍未完成以下作業繳交。';
  var ctaHtml = frontendUrl
    ? '<p><a href="' + escapeHtml_(frontendUrl) + '" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#0066CC;color:#FFFFFF;text-decoration:none;font-weight:700;">前往系統完成繳交</a></p>'
    : '';

  return [
    '<div style="font-family:Arial,\'PingFang TC\',\'Microsoft JhengHei\',sans-serif;line-height:1.7;color:#1D1D1F;">',
    '<p>' + escapeHtml_(displayName) + ' 您好，</p>',
    '<p>' + escapeHtml_(intro) + '</p>',
    '<div style="background:#F5F5F7;border:1px solid #E5E5EA;border-radius:16px;padding:16px;">',
    '<p style="margin:0 0 6px;"><strong>項目標題</strong>：' + escapeHtml_(assignment.Title || '') + '</p>',
    '<p style="margin:0 0 6px;"><strong>會期</strong>：' + escapeHtml_(stageName || '未設定') + '</p>',
    '<p style="margin:0 0 6px;"><strong>所屬小組</strong>：' + escapeHtml_(teamName || '未設定') + '</p>',
    '<p style="margin:0 0 6px;"><strong>提醒節點</strong>：' + escapeHtml_(bucket && bucket.label ? bucket.label : '截止提醒') + '</p>',
    '<p style="margin:0 0 6px;"><strong>截止時間</strong>：' + escapeHtml_(dueLabel) + '</p>',
    '<p style="margin:0;"><strong>繳交形式</strong>：' + escapeHtml_(getAssignmentSubmissionModeLabel_(assignment.Submission_Mode)) + '</p>',
    '</div>',
    '<div style="margin-top:16px;">',
    '<p style="margin:0 0 6px;font-weight:700;">項目說明</p>',
    '<p style="margin:0;color:#3A3A3C;white-space:pre-line;">' + escapeHtml_(assignment.Body || '（無）') + '</p>',
    '</div>',
    '<div style="margin-top:16px;">',
    '<p style="margin:0 0 6px;font-weight:700;">繳交需求補充</p>',
    '<p style="margin:0;color:#3A3A3C;white-space:pre-line;">' + escapeHtml_(assignment.Requirement_Text || '（無）') + '</p>',
    '</div>',
    '<div style="margin-top:20px;">' + ctaHtml + '</div>',
    '<p style="font-size:12px;color:#6E6E73;">此信件由 GAS 背景排程自動發送，即使沒有人開啟網站，系統也會依時提醒。</p>',
    '<p style="margin-top:24px;">畢展形印組管理系統</p>',
    '</div>'
  ].join('');
}

function sendAssignmentReminderEmails_(state, recipients, assignment, team, bucket) {
  if (!assignment || assignment.Notify_By_Email !== true) {
    return 0;
  }

  var stage = ensureArray_(state && state.Config_Stages).find(function(item) {
    return String(item.Stage_ID || '') === String(assignment.Stage_ID || '');
  }) || null;
  var stageName = stage ? String(stage.Stage_Name || '') : '';
  var teamName = team ? String(team.Team_Name || '') : '';
  var frontendUrl = String(getConfig_().frontendBaseUrl || APP_DEFAULTS.frontendBaseUrl || '').trim();
  var dueAtText = String(assignment.Due_At || '未設定');
  var subject = bucket && bucket.code === 'overdue'
    ? '【畢展形印組管理系統】逾期提醒：' + String(assignment.Title || '未命名作業')
    : '【畢展形印組管理系統】繳交提醒：' + String(assignment.Title || '未命名作業');
  var sentCount = 0;

  ensureArray_(recipients).forEach(function(user) {
    var email = normalizeEmail_(user.Email);
    if (!email) return;

    try {
      sendSystemEmail_(
        email,
        subject,
        buildAssignmentReminderEmailText_(user, assignment, stageName, teamName, dueAtText, bucket, frontendUrl),
        buildAssignmentReminderEmailHtml_(user, assignment, stageName, teamName, dueAtText, bucket, frontendUrl)
      );
      sentCount += 1;
    } catch (error) {
      Logger.log('Failed to send assignment reminder email to ' + email + ': ' + error);
    }
  });

  return sentCount;
}

function buildAssignmentEscalationMessage_(assignment, team, bucket) {
  var dueLabel = formatCompactDateTimeLabel_(assignment && assignment.Due_At || '') || '指定時間';
  var teamName = String(team && team.Team_Name || '指定小組');
  if (bucket && bucket.audience === 'shapeprint') {
    return '「' + teamName + '」尚未繳交「' + String(assignment.Title || '未命名作業') + '」，已超過截止時間 ' + dueLabel + '，請協助追蹤。';
  }
  return '你的小組尚未繳交「' + String(assignment.Title || '未命名作業') + '」，截止時間為 ' + dueLabel + '。請優先確認並完成繳交。';
}

function sendAssignmentEscalationEmails_(state, recipients, assignment, team, bucket) {
  if (!assignment || assignment.Notify_By_Email !== true) {
    return 0;
  }

  var stage = ensureArray_(state && state.Config_Stages).find(function(item) {
    return String(item.Stage_ID || '') === String(assignment.Stage_ID || '');
  }) || null;
  var stageName = String(stage && stage.Stage_Name || '未設定');
  var teamName = String(team && team.Team_Name || '指定小組');
  var frontendUrl = String(getConfig_().frontendBaseUrl || APP_DEFAULTS.frontendBaseUrl || '').trim();
  var dueLabel = formatCompactDateTimeLabel_(assignment.Due_At || '') || '未設定';
  var isShapePrint = bucket && bucket.audience === 'shapeprint';
  var subject = isShapePrint
    ? '【畢展形印組管理系統】逾期追蹤：' + teamName + ' · ' + String(assignment.Title || '未命名作業')
    : '【畢展形印組管理系統】請優先處理：' + String(assignment.Title || '未命名作業');
  var sentCount = 0;

  ensureArray_(recipients).forEach(function(user) {
    var email = normalizeEmail_(user.Email);
    if (!email) return;
    var displayName = String(user.Name || '使用者');
    var intro = isShapePrint
      ? '系統偵測到以下小組的繳交項目已逾期，請協助追蹤。'
      : '系統偵測到你負責的小組仍未完成以下繳交，請優先提醒組員。';
    var text = [
      displayName + ' 您好，',
      '',
      intro,
      '',
      '小組：' + teamName,
      '會期：' + stageName,
      '項目：' + String(assignment.Title || ''),
      '截止時間：' + dueLabel,
      '提醒層級：' + String(bucket && bucket.label || '升級提醒'),
      '',
      frontendUrl ? '請登入系統查看與處理：' + frontendUrl : '請登入系統查看與處理。',
      '',
      '畢展形印組管理系統'
    ].join('\n');
    var html = [
      '<div style="font-family:Arial,\'PingFang TC\',\'Microsoft JhengHei\',sans-serif;line-height:1.7;color:#1D1D1F;">',
      '<p>' + escapeHtml_(displayName) + ' 您好，</p>',
      '<p>' + escapeHtml_(intro) + '</p>',
      '<div style="background:#F5F5F7;border:1px solid #E5E5EA;border-radius:16px;padding:16px;">',
      '<p style="margin:0 0 6px;"><strong>小組</strong>：' + escapeHtml_(teamName) + '</p>',
      '<p style="margin:0 0 6px;"><strong>會期</strong>：' + escapeHtml_(stageName) + '</p>',
      '<p style="margin:0 0 6px;"><strong>項目</strong>：' + escapeHtml_(assignment.Title || '') + '</p>',
      '<p style="margin:0 0 6px;"><strong>截止時間</strong>：' + escapeHtml_(dueLabel) + '</p>',
      '<p style="margin:0;"><strong>提醒層級</strong>：' + escapeHtml_(bucket && bucket.label || '升級提醒') + '</p>',
      '</div>',
      frontendUrl ? '<p style="margin-top:20px;"><a href="' + escapeHtml_(frontendUrl) + '" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#1D1D1F;color:#FFFFFF;text-decoration:none;font-weight:700;">前往系統處理</a></p>' : '',
      '<p style="font-size:12px;color:#6E6E73;">此信件由 GAS 背景排程自動發送。</p>',
      '</div>'
    ].join('');
    try {
      sendSystemEmail_(email, subject, text, html);
      sentCount += 1;
    } catch (error) {
      Logger.log('Failed to send assignment escalation email to ' + email + ': ' + error);
    }
  });

  return sentCount;
}

function pruneAssignmentReminderLog_(state) {
  var reminderLog = getAssignmentReminderLog_(state);
  var activeAssignmentIds = {};
  var changed = false;

  ensureArray_(state && state.Assignments).forEach(function(assignment) {
    activeAssignmentIds[String(assignment.Assignment_ID || '')] = true;
  });

  Object.keys(reminderLog).forEach(function(key) {
    var entry = reminderLog[key];
    var assignmentId = String(entry && entry.assignmentId || key.split('|')[0] || '').trim();
    if (!activeAssignmentIds[assignmentId]) {
      delete reminderLog[key];
      changed = true;
      return;
    }

    var dueDate = parseConfiguredDateTime_(entry && entry.dueAt);
    if (dueDate && ((new Date().getTime() - dueDate.getTime()) > (45 * 24 * 60 * 60 * 1000))) {
      delete reminderLog[key];
      changed = true;
    }
  });

  state.Meta[ASSIGNMENT_REMINDER_LOG_META_KEY] = reminderLog;
  return changed;
}

function runScheduledAssignmentRemindersInternal_(state) {
  state = normalizeState_(state);
  state.Meta = state.Meta && typeof state.Meta === 'object' ? state.Meta : {};

  var now = new Date();
  var settings = getAssignmentReminderSettings_(state);
  var reminderLog = getAssignmentReminderLog_(state);
  var sweepAt = formatDateTime_(now);
  var summary = {
    ok: true,
    changed: false,
    enabled: settings.enabled,
    checkedAssignments: 0,
    remindedTeams: 0,
    notificationsCreated: 0,
    emailsSent: 0,
    leaderEscalations: 0,
    shapePrintEscalations: 0,
    sweepAt: sweepAt
  };

  if (!settings.enabled) {
    state.Meta.LastReminderSweepAt = sweepAt;
    state.Meta.LastReminderSweepSummary = summary;
    summary.changed = true;
    return summary;
  }

  ensureArray_(state.Assignments).forEach(function(assignment) {
    if (!assignment || String(assignment.Status || '') !== '進行中') {
      return;
    }

    var dueDate = parseConfiguredDateTime_(assignment.Due_At);
    if (!dueDate) {
      return;
    }

    var hoursUntilDue = (dueDate.getTime() - now.getTime()) / 3600000;
    var bucket = getAssignmentReminderBucket_(hoursUntilDue, settings.offsetsHours);
    var escalationBucket = getAssignmentEscalationBucket_(hoursUntilDue, settings);
    if (!bucket && !escalationBucket) {
      return;
    }

    var targetTeamIds = getAssignmentTargetTeamIds_(state, assignment);
    if (targetTeamIds.length === 0) {
      return;
    }

    summary.checkedAssignments += 1;

    targetTeamIds.forEach(function(teamId) {
      if (hasAssignmentSubmissionForTeam_(state, assignment.Assignment_ID, teamId)) {
        return;
      }

      var team = ensureArray_(state.Teams).find(function(item) {
        return String(item.Team_ID || '') === String(teamId || '');
      }) || null;
      var reminderKey = bucket ? buildAssignmentReminderKey_(assignment.Assignment_ID, teamId, bucket.code) : '';
      if (bucket && !reminderLog[reminderKey]) {
        var recipients = getActiveStudentRecipientsForTeam_(state, teamId);
        var createdNotifications = [];
        var sentEmailCount = 0;

        if (settings.sendSiteNotifications && recipients.length > 0) {
          createdNotifications = createNotifications_(state, {
            type: 'assignment-reminder',
            title: bucket.code === 'overdue'
              ? '作業逾期提醒：' + String(assignment.Title || '未命名作業')
              : '作業繳交提醒：' + String(assignment.Title || '未命名作業'),
            message: buildAssignmentReminderNotificationMessage_(assignment, assignment.Due_At, bucket),
            tab: 'files',
            refType: 'assignment',
            refId: assignment.Assignment_ID,
            audience: {
              userIds: recipients.map(function(user) {
                return String(user.User_ID || '');
              })
            },
            createdAt: sweepAt,
            priority: bucket.priority || 'normal'
          });
        }

        if (settings.sendEmail && recipients.length > 0) {
          sentEmailCount = sendAssignmentReminderEmails_(state, recipients, assignment, team, bucket);
        }

        reminderLog[reminderKey] = {
          assignmentId: String(assignment.Assignment_ID || ''),
          teamId: String(teamId || ''),
          reminderCode: bucket.code,
          dueAt: String(assignment.Due_At || ''),
          sentAt: sweepAt,
          notificationCount: createdNotifications.length,
          emailCount: sentEmailCount
        };

        summary.remindedTeams += 1;
        summary.notificationsCreated += createdNotifications.length;
        summary.emailsSent += sentEmailCount;
        summary.changed = true;
      }

      if (!escalationBucket) {
        return;
      }
      var escalationKey = buildAssignmentReminderKey_(assignment.Assignment_ID, teamId, escalationBucket.code);
      if (reminderLog[escalationKey]) {
        return;
      }
      var escalationRecipients = escalationBucket.audience === 'shapeprint'
        ? getActiveShapePrintRecipients_(state)
        : getActiveLeaderRecipientsForTeam_(state, teamId);
      var escalationNotifications = [];
      var escalationEmails = 0;
      if (settings.sendSiteNotifications && escalationRecipients.length > 0) {
        escalationNotifications = createNotifications_(state, {
          type: 'assignment-escalation',
          title: escalationBucket.audience === 'shapeprint'
            ? '逾期追蹤：' + String(team && team.Team_Name || '指定小組')
            : '組長提醒：' + String(assignment.Title || '未命名作業'),
          message: buildAssignmentEscalationMessage_(assignment, team, escalationBucket),
          tab: 'files',
          refType: 'assignment',
          refId: assignment.Assignment_ID,
          audience: {
            userIds: escalationRecipients.map(function(user) {
              return String(user.User_ID || '');
            })
          },
          createdAt: sweepAt,
          priority: escalationBucket.priority || 'high'
        });
      }
      if (settings.sendEmail && escalationRecipients.length > 0) {
        escalationEmails = sendAssignmentEscalationEmails_(state, escalationRecipients, assignment, team, escalationBucket);
      }
      reminderLog[escalationKey] = {
        assignmentId: String(assignment.Assignment_ID || ''),
        teamId: String(teamId || ''),
        reminderCode: escalationBucket.code,
        dueAt: String(assignment.Due_At || ''),
        sentAt: sweepAt,
        notificationCount: escalationNotifications.length,
        emailCount: escalationEmails,
        audience: escalationBucket.audience
      };
      summary.notificationsCreated += escalationNotifications.length;
      summary.emailsSent += escalationEmails;
      if (escalationBucket.audience === 'shapeprint') {
        summary.shapePrintEscalations += 1;
      } else {
        summary.leaderEscalations += 1;
      }
      summary.changed = true;
    });
  });

  state.Meta[ASSIGNMENT_REMINDER_LOG_META_KEY] = reminderLog;
  if (pruneAssignmentReminderLog_(state)) {
    summary.changed = true;
  }
  state.Meta.LastReminderSweepAt = sweepAt;
  state.Meta.LastReminderSweepSummary = summary;
  return summary;
}

function hydrateAssignmentSubmissionRecord_(submission) {
  if (!submission || typeof submission !== 'object') {
    submission = {};
  }

  submission.Submission_ID = String(submission.Submission_ID || '');
  submission.Assignment_ID = String(submission.Assignment_ID || '');
  submission.User_ID = String(submission.User_ID || '');
  submission.Team_ID = String(submission.Team_ID || '');
  submission.Submission_No = Number(submission.Submission_No || 1);
  submission.Submission_Mode = String(submission.Submission_Mode || 'file-text');
  submission.File_Name = String(submission.File_Name || '');
  submission.Google_Drive_URL = String(submission.Google_Drive_URL || '');
  submission.Text_Content = String(submission.Text_Content || '');
  submission.Submitted_At = String(submission.Submitted_At || nowString_());
  submission.Updated_At = String(submission.Updated_At || submission.Submitted_At);
  submission.Status = String(submission.Status || '已繳交');
  submission.Notes = String(submission.Notes || '');
  submission.Drive_File_ID = String(submission.Drive_File_ID || '');
  submission.Drive_Folder_ID = String(submission.Drive_Folder_ID || '');
  submission.Reviewed_By_User_ID = String(submission.Reviewed_By_User_ID || '');
  submission.Reviewed_At = String(submission.Reviewed_At || '');
  submission.Review_Note = String(submission.Review_Note || '');

  return submission;
}

function isAssignmentSubmissionRejected_(submission) {
  return /退件|退回|修正/.test(String(submission && submission.Status || ''));
}

function backfillPurchaseItemDates_(state) {
  var changed = false;
  var config = getConfig_();
  var purchaseGroups = {};
  var fileDatesByStage = {};

  ensureArray_(state && state.Files).forEach(function(file) {
    var stageId = String(file.Stage_ID || '').trim();
    var dateKey = extractHeatmapDateKey_(file && file.Upload_Time);
    if (!stageId || !dateKey) return;
    if (!fileDatesByStage[stageId]) {
      fileDatesByStage[stageId] = [];
    }
    fileDatesByStage[stageId].push(dateKey);
  });

  ensureArray_(state && state.Purchase_Items).forEach(function(item, index) {
    var stageId = String(item.Stage_ID || '').trim();
    if (!stageId) {
      stageId = '_ungrouped';
    }

    if (!purchaseGroups[stageId]) {
      purchaseGroups[stageId] = {
        stageId: stageId,
        items: [],
        anchorKeys: []
      };
    }

    purchaseGroups[stageId].items.push({
      item: item,
      index: index
    });

    var itemDateKey = extractHeatmapDateKey_(item && item.Created_At);
    if (itemDateKey) {
      purchaseGroups[stageId].anchorKeys.push(itemDateKey);
    }
  });

  Object.keys(fileDatesByStage).forEach(function(stageId) {
    if (!purchaseGroups[stageId]) {
      purchaseGroups[stageId] = {
        stageId: stageId,
        items: [],
        anchorKeys: []
      };
    }
    purchaseGroups[stageId].anchorKeys = purchaseGroups[stageId].anchorKeys.concat(fileDatesByStage[stageId]);
  });

  Object.keys(purchaseGroups).forEach(function(stageId) {
    var group = purchaseGroups[stageId];
    var missingItems = group.items.filter(function(entry) {
      return !extractHeatmapDateKey_(entry.item && entry.item.Created_At);
    }).sort(function(a, b) {
      var aId = extractSequentialNumber_(a.item && a.item.Item_ID, 'P');
      var bId = extractSequentialNumber_(b.item && b.item.Item_ID, 'P');
      if (aId !== bId) return aId - bId;
      return a.index - b.index;
    });

    if (missingItems.length === 0) {
      return;
    }

    var anchorDateKey = group.anchorKeys.length > 0
      ? group.anchorKeys.slice().sort().pop()
      : Utilities.formatDate(new Date(), config.timeZone, 'yyyy-MM-dd');
    var anchorDate = buildDateFromDateKey_(anchorDateKey);
    var spanDays = missingItems.length > 1
      ? Math.max(7, Math.min(42, (missingItems.length - 1) * 7))
      : 0;
    var gapDays = missingItems.length > 1
      ? Math.max(1, Math.floor(spanDays / (missingItems.length - 1)))
      : 0;

    missingItems.forEach(function(entry, index) {
      var daysBefore = gapDays * (missingItems.length - 1 - index);
      var assignedDate = new Date(anchorDate.getTime());
      assignedDate.setDate(assignedDate.getDate() - daysBefore);
      entry.item.Created_At = formatDateTime_(assignedDate);
      changed = true;
    });
  });

  return changed;
}

function hydrateFileRecord_(file) {
  if (!file || typeof file !== 'object') {
    file = {};
  }

  var parsed = parseFileMeta_(file.File_Name || '');
  file.File_ID = String(file.File_ID || '');
  file.Stage_ID = String(file.Stage_ID || '');
  file.Team_ID = String(file.Team_ID || '');
  file.File_Name = String(file.File_Name || '');
  file.Google_Drive_URL = String(file.Google_Drive_URL || '');
  file.Upload_Time = String(file.Upload_Time || nowString_());
  file.Check_Status = String(file.Check_Status || '未審');
  file.Comment = String(file.Comment || '');
  file.Base_File_Name = String(file.Base_File_Name || parsed.baseName);
  file.File_Extension = String(file.File_Extension || parsed.extension);
  file.Version_No = Number(file.Version_No || parsed.parsedVersion || 1);
  file.File_Group_Key = String(file.File_Group_Key || makeFileGroupKey_(file.Stage_ID, file.Team_ID, file.Base_File_Name));
  file.Revision_Notes = String(file.Revision_Notes || '');
  file.Drive_File_ID = String(file.Drive_File_ID || '');
  file.Drive_Folder_ID = String(file.Drive_Folder_ID || '');
  file.Version_Label = formatVersionLabel_(file.Version_No);
  file.Version_Sequence = Number(file.Version_Sequence || file.Version_No || 1);
  file.Is_Latest = file.Is_Latest === true;

  return file;
}

function hydrateNotificationRecord_(notification) {
  if (!notification || typeof notification !== 'object') {
    notification = {};
  }

  notification.Notification_ID = String(notification.Notification_ID || '');
  notification.User_ID = String(notification.User_ID || '');
  notification.Type = String(notification.Type || 'system');
  if (notification.Type === 'assignment-overdue') {
    notification.Type = 'assignment-reminder';
  }
  notification.Title = normalizeEmbeddedDateTimes_(String(notification.Title || '系統通知'));
  notification.Message = normalizeEmbeddedDateTimes_(String(notification.Message || ''));
  notification.Created_At = normalizeDateTimeStorageValue_(notification.Created_At || nowString_());
  notification.Read = notification.Read === true;
  notification.Tab = String(notification.Tab || 'overview');
  notification.Ref_Type = String(notification.Ref_Type || '');
  notification.Ref_ID = String(notification.Ref_ID || '');
  notification.Priority = String(notification.Priority || 'normal');

  return notification;
}

function hydrateDiscussionCommentRecord_(comment) {
  if (!comment || typeof comment !== 'object') {
    comment = {};
  }

  comment.Comment_ID = String(comment.Comment_ID || '');
  comment.Ref_Type = String(comment.Ref_Type || '');
  comment.Ref_ID = String(comment.Ref_ID || '');
  comment.User_ID = String(comment.User_ID || '');
  comment.Team_ID = String(comment.Team_ID || '');
  comment.Author_Name = String(comment.Author_Name || '未具名');
  comment.Author_Role = String(comment.Author_Role || '');
  comment.Kind = String(comment.Kind || 'comment');
  comment.Message = String(comment.Message || '');
  comment.Created_At = normalizeDateTimeStorageValue_(comment.Created_At || nowString_());

  return comment;
}

function normalizePasswordResetTokenRecord_(record) {
  if (!record || typeof record !== 'object') {
    record = {};
  }

  record.Reset_ID = String(record.Reset_ID || '');
  record.User_ID = String(record.User_ID || '');
  record.Email = normalizeEmail_(record.Email);
  record.Token_Hash = String(record.Token_Hash || '');
  record.Requested_At = String(record.Requested_At || '');
  record.Expires_At = String(record.Expires_At || '');
  record.Consumed_At = String(record.Consumed_At || '');
  record.Status = String(record.Status || 'active').trim().toLowerCase();
  record.Requested_At_Millis = Number(record.Requested_At_Millis || 0);
  record.Expires_At_Millis = Number(record.Expires_At_Millis || 0);
  record.Consumed_At_Millis = Number(record.Consumed_At_Millis || 0);

  if (!record.Requested_At && record.Requested_At_Millis > 0) {
    record.Requested_At = formatDateTime_(new Date(record.Requested_At_Millis));
  }

  if (!record.Expires_At && record.Expires_At_Millis > 0) {
    record.Expires_At = formatDateTime_(new Date(record.Expires_At_Millis));
  }

  if (!record.Consumed_At && record.Consumed_At_Millis > 0) {
    record.Consumed_At = formatDateTime_(new Date(record.Consumed_At_Millis));
  }

  return record;
}

function refreshFileVersionMetadata_(files) {
  var grouped = {};

  ensureArray_(files).forEach(function(file) {
    hydrateFileRecord_(file);
    if (!grouped[file.File_Group_Key]) {
      grouped[file.File_Group_Key] = [];
    }
    grouped[file.File_Group_Key].push(file);
  });

  Object.keys(grouped).forEach(function(groupKey) {
    var groupFiles = grouped[groupKey].slice().sort(function(a, b) {
      var versionDiff = Number(a.Version_No || 1) - Number(b.Version_No || 1);
      if (versionDiff !== 0) return versionDiff;
      return new Date(a.Upload_Time).getTime() - new Date(b.Upload_Time).getTime();
    });

    groupFiles.forEach(function(file, index) {
      file.Version_Sequence = index + 1;
      file.Is_Latest = false;
      file.Version_Label = formatVersionLabel_(file.Version_No);
    });

    var latestFile = groupFiles[groupFiles.length - 1];
    if (latestFile) {
      latestFile.Is_Latest = true;
    }
  });
}

function getAcademicYearRange_() {
  var config = getConfig_();
  var now = new Date();
  var currentYear = Number(Utilities.formatDate(now, config.timeZone, 'yyyy'));
  var currentMonth = Number(Utilities.formatDate(now, config.timeZone, 'M'));
  var startYear = currentMonth >= 8 ? currentYear : currentYear - 1;
  var startDate = new Date(startYear, 7, 1);
  var endDate = new Date(startYear + 1, 6, 31);

  return {
    startDate: startDate,
    endDate: endDate,
    startKey: Utilities.formatDate(startDate, config.timeZone, 'yyyy-MM-dd'),
    endKey: Utilities.formatDate(endDate, config.timeZone, 'yyyy-MM-dd'),
    academicYearLabel: String(startYear) + '-' + String(startYear + 1)
  };
}

function extractHeatmapDateKey_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, getConfig_().timeZone, 'yyyy-MM-dd');
  }

  var raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  var match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function buildDateFromDateKey_(dateKey) {
  var match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return new Date();
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0));
}

function extractSequentialNumber_(value, prefix) {
  var raw = String(value || '');
  var match = raw.match(new RegExp('^' + String(prefix || '') + '(\\d+)$'));
  return match ? parseInt(match[1], 10) : 0;
}

function ensureHeatmapBucket_(bucketMap, dateKey) {
  if (!bucketMap[dateKey]) {
    bucketMap[dateKey] = {
      date: dateKey,
      files: 0,
      purchases: 0,
      assignments: 0,
      total: 0
    };
  }

  return bucketMap[dateKey];
}

function ensureHourlyHeatmapBucket_(bucketMap, dateKey, hour) {
  var normalizedHour = Math.max(0, Math.min(23, Number(hour) || 0));
  var hourKey = dateKey + ' ' + ('0' + normalizedHour).slice(-2);

  if (!bucketMap[hourKey]) {
    bucketMap[hourKey] = {
      date: dateKey,
      hour: normalizedHour,
      files: 0,
      purchases: 0,
      assignments: 0,
      total: 0
    };
  }

  return bucketMap[hourKey];
}

function extractHeatmapDateTimeParts_(value) {
  var config = getConfig_();
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return {
      dateKey: Utilities.formatDate(value, config.timeZone, 'yyyy-MM-dd'),
      hour: parseInt(Utilities.formatDate(value, config.timeZone, 'H'), 10)
    };
  }

  var raw = String(value || '').trim();
  var match = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s]+(\d{1,2})(?::\d{2})?)?/);
  if (!match) {
    return { dateKey: '', hour: 12 };
  }

  return {
    dateKey: match[1],
    // Historical records without a timestamp retain the neutral noon bucket.
    hour: typeof match[2] === 'string' ? Math.max(0, Math.min(23, Number(match[2]))) : 12
  };
}

function buildHeatmapStats_(state) {
  var config = getConfig_();
  var range = getAcademicYearRange_();
  var buckets = {};
  var hourlyBuckets = {};
  var summary = {
    files: 0,
    purchases: 0,
    assignments: 0,
    total: 0,
    activeDays: 0,
    peakDate: '',
    peakValue: 0
  };

  function registerHeatmapActivity(value, bucketField) {
    var parts = extractHeatmapDateTimeParts_(value);
    if (!parts.dateKey || parts.dateKey < range.startKey || parts.dateKey > range.endKey) {
      return false;
    }

    ensureHeatmapBucket_(buckets, parts.dateKey)[bucketField] += 1;
    ensureHourlyHeatmapBucket_(hourlyBuckets, parts.dateKey, parts.hour)[bucketField] += 1;
    return true;
  }

  ensureArray_(state && state.Files).forEach(function(file) {
    if (registerHeatmapActivity(file && file.Upload_Time, 'files')) {
      summary.files += 1;
    }
  });

  ensureArray_(state && state.Purchase_Items).forEach(function(item) {
    if (registerHeatmapActivity(item && item.Created_At, 'purchases')) {
      summary.purchases += 1;
    }
  });

  ensureArray_(state && state.Assignment_Submissions).forEach(function(submission) {
    if (registerHeatmapActivity(submission && (submission.Submitted_At || submission.Updated_At), 'assignments')) {
      summary.assignments += 1;
    }
  });

  var timeline = [];
  var cursor = new Date(range.startDate.getTime());

  while (cursor <= range.endDate) {
    var dateKey = Utilities.formatDate(cursor, config.timeZone, 'yyyy-MM-dd');
    var bucket = ensureHeatmapBucket_(buckets, dateKey);
    bucket.total = Number(bucket.files || 0) + Number(bucket.purchases || 0) + Number(bucket.assignments || 0);
    timeline.push(cloneObject_(bucket));
    if (bucket.total > 0) {
      summary.activeDays += 1;
    }
    if (bucket.total > summary.peakValue) {
      summary.peakValue = bucket.total;
      summary.peakDate = dateKey;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  Object.keys(hourlyBuckets).forEach(function(hourKey) {
    var hourlyBucket = hourlyBuckets[hourKey];
    hourlyBucket.total = Number(hourlyBucket.files || 0) + Number(hourlyBucket.purchases || 0) + Number(hourlyBucket.assignments || 0);
  });

  summary.total = summary.files + summary.purchases + summary.assignments;

  return {
    range: {
      startDate: range.startKey,
      endDate: range.endKey,
      academicYearLabel: range.academicYearLabel
    },
    timeline: timeline,
    hourlyBuckets: hourlyBuckets,
    summary: summary
  };
}

function parseFileMeta_(fileName) {
  var rawName = String(fileName || '').trim();
  var dotIndex = rawName.lastIndexOf('.');
  var extension = dotIndex >= 0 ? rawName.slice(dotIndex) : '';
  var nameOnly = dotIndex >= 0 ? rawName.slice(0, dotIndex) : rawName;
  var versionMatch = nameOnly.match(/^(.*?)(?:[ _-]*[Vv](\d+))$/);
  var baseName = versionMatch ? String(versionMatch[1] || '').trim() : nameOnly;
  var parsedVersion = versionMatch ? parseInt(versionMatch[2], 10) : 1;

  return {
    baseName: baseName || nameOnly,
    extension: extension,
    parsedVersion: isNaN(parsedVersion) ? 1 : parsedVersion
  };
}

function makeFileGroupKey_(stageId, teamId, baseName) {
  return [
    String(stageId || '').trim(),
    String(teamId || '').trim(),
    normalizeSearchText_(baseName).replace(/[\s_-]+/g, '')
  ].join('|');
}

function formatVersionLabel_(versionNo) {
  return 'V' + String(versionNo || 1);
}

function buildVersionedFileName_(baseName, versionNo, extension) {
  var cleanBase = String(baseName || '').trim();
  var cleanExtension = String(extension || '');

  if (!cleanBase) {
    return cleanExtension;
  }

  if (!versionNo || Number(versionNo) <= 1) {
    return cleanBase + cleanExtension;
  }

  return cleanBase + 'V' + String(versionNo) + cleanExtension;
}

function buildAssignmentSubmissionFileName_(originalFileName, submissionNo) {
  var rawFileName = String(originalFileName || '').trim();
  var resolvedSubmissionNo = Number(submissionNo || 1);
  var parsed = parseFileMeta_(rawFileName);
  var cleanBase = String(parsed.baseName || '').trim() || rawFileName;
  var cleanExtension = String(parsed.extension || '');

  if (!rawFileName) {
    return cleanExtension || 'submission';
  }

  if (!resolvedSubmissionNo || resolvedSubmissionNo <= 1) {
    return rawFileName;
  }

  return cleanBase + '_第' + String(resolvedSubmissionNo) + '次繳交' + cleanExtension;
}

function isSupportedUploadExtension_(extension) {
  return SUPPORTED_UPLOAD_EXTENSIONS.indexOf(String(extension || '').toLowerCase()) !== -1;
}

function isSupportedAssignmentResourceExtension_(extension) {
  return ASSIGNMENT_RESOURCE_EXTENSIONS.indexOf(String(extension || '').toLowerCase()) !== -1;
}

function sanitizeDriveEntryName_(value, fallbackValue) {
  var cleaned = String(value || '')
    .replace(/[\\\/]+/g, '・')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned) {
    return cleaned;
  }

  return String(fallbackValue || '').trim();
}

function getLatestFileForGroup_(files, groupKey) {
  var history = ensureArray_(files).filter(function(file) {
    return String(file.File_Group_Key || '') === String(groupKey || '');
  }).sort(function(a, b) {
    var versionDiff = Number(b.Version_No || 1) - Number(a.Version_No || 1);
    if (versionDiff !== 0) return versionDiff;
    return new Date(b.Upload_Time).getTime() - new Date(a.Upload_Time).getTime();
  });

  return history.length > 0 ? history[0] : null;
}

function generateSequentialId_(prefix, collection, field) {
  var maxNumber = ensureArray_(collection).reduce(function(max, item) {
    var raw = String(item && item[field] ? item[field] : '');
    var match = raw.match(new RegExp('^' + prefix + '(\\d+)$'));
    if (!match) return max;
    return Math.max(max, parseInt(match[1], 10));
  }, 0);

  return prefix + padNumber_(maxNumber + 1, 2);
}

function handleLogin_(payload) {
  var email = normalizeEmail_(payload.email);
  var password = String(payload.password || '');

  if (!email || !password) {
    throw new Error('登入需要電子郵件與密碼。');
  }

  assertLoginAttemptAllowed_(email);

  // Login only needs the account and session tables. Loading every workspace
  // table here made a valid sign-in wait for unrelated files and submissions.
  var user = loadLoginUser_(email);
  if (!user) {
    throwLoginFailure_(email);
  }

  if (String(user.Status || '') === 'Pending') {
    recordFailedLoginAttempt_(email);
    throw new Error('此帳號尚未啟用，請改用信箱開通流程。');
  }

  if (!verifyPassword_(password, user.Password)) {
    throwLoginFailure_(email);
  }

  clearFailedLoginAttempts_(email);

  if (!isPasswordHash_(user.Password)) {
    user = upgradeLegacyLoginPassword_(user, password);
  }

  // Workspace data is fetched immediately after authentication, but outside
  // the login critical path so the user can enter the dashboard right away.
  return buildAuthenticatedIdentityResult_(user);
}

function getLoginAttemptCacheKey_(email) {
  return 'login-attempt:' + hashSessionToken_(normalizeEmail_(email));
}

function getLoginAttemptState_(email) {
  var raw = CacheService.getScriptCache().get(getLoginAttemptCacheKey_(email));
  if (!raw) return { count: 0, lockedUntil: 0 };
  try {
    var parsed = JSON.parse(raw);
    return {
      count: Number(parsed.count || 0),
      lockedUntil: Number(parsed.lockedUntil || 0)
    };
  } catch (error) {
    return { count: 0, lockedUntil: 0 };
  }
}

function assertLoginAttemptAllowed_(email) {
  var attempt = getLoginAttemptState_(email);
  if (attempt.lockedUntil > Date.now()) {
    throw new Error('登入嘗試過多，請 10 分鐘後再試。');
  }
}

function recordFailedLoginAttempt_(email) {
  var cache = CacheService.getScriptCache();
  var attempt = getLoginAttemptState_(email);
  var count = Number(attempt.count || 0) + 1;
  var lockedUntil = count >= AUTH_LOGIN_MAX_ATTEMPTS
    ? Date.now() + (AUTH_LOGIN_LOCKOUT_SECONDS * 1000)
    : 0;
  cache.put(
    getLoginAttemptCacheKey_(email),
    JSON.stringify({ count: count, lockedUntil: lockedUntil }),
    AUTH_LOGIN_LOCKOUT_SECONDS
  );
}

function clearFailedLoginAttempts_(email) {
  CacheService.getScriptCache().remove(getLoginAttemptCacheKey_(email));
}

function throwLoginFailure_(email) {
  recordFailedLoginAttempt_(email);
  throw new Error('無效的帳號或密碼。');
}

function buildAuthenticatedIdentityResult_(user) {
  var session = issueSession_(user);
  return {
    sessionToken: session.token,
    sessionExpiresAt: session.expiresAt,
    currentUser: sanitizeUserRecord_(user)
  };
}

function buildAuthenticatedClientResult_(state, user, extraData, options) {
  var session = issueSession_(user);
  var data = cloneObject_(extraData || {});
  data.sessionToken = session.token;
  data.sessionExpiresAt = session.expiresAt;
  return buildClientStateResultForUser_(state, user, data, options);
}

function handleRegisterLeader_(payload) {
  var state = loadState_();
  var teamName = String(payload.teamName || '').trim();
  var name = String(payload.name || '').trim();
  var email = normalizeEmail_(payload.email);
  var password = String(payload.password || payload.pwd || '');

  validateRegistrationPayload_(teamName, name, email, password);

  if (findUserByEmail_(state.Users, email)) {
    throw new Error('該信箱已被註冊。');
  }

  var teamId = generateSequentialId_('T', state.Teams, 'Team_ID');
  var inviteCode = generateInviteCode_(state.Teams);
  var userId = generateSequentialId_('U', state.Users, 'User_ID');
  var newTeam = {
    Team_ID: teamId,
    Team_Name: teamName,
    Invite_Code: inviteCode
  };
  var newUser = {
    User_ID: userId,
    Email: email,
    Password: hashPassword_(password),
    Name: name,
    Team_ID: teamId,
    Role: 'Leader',
    Status: 'Active'
  };

  state.Teams.push(newTeam);
  state.Users.push(newUser);
  persistState_(state);
  state = loadState_();

  appendActivityLogEntries_([
    createActivityLogEntry_(newUser, '建立小組帳號', '已建立小組「' + newTeam.Team_Name + '」與組長帳號。', 'team', newTeam.Team_ID, 'normal', {
      source: 'registerLeader'
    })
  ]);

  return buildAuthenticatedClientResult_(state, findUserByEmail_(state.Users, email), {
    team: newTeam
  });
}

function handleRegisterMember_(payload) {
  var state = loadState_();
  var inviteCode = String(payload.inviteCode || '').trim();
  var name = String(payload.name || '').trim();
  var email = normalizeEmail_(payload.email);
  var password = String(payload.password || payload.pwd || '');
  var targetTeam = state.Teams.find(function(team) {
    return String(team.Invite_Code || '').trim() === inviteCode;
  });

  validateRegistrationPayload_('member', name, email, password);

  if (!inviteCode || !targetTeam) {
    throw new Error('查無此邀請代碼。');
  }

  if (findUserByEmail_(state.Users, email)) {
    throw new Error('該信箱已被註冊。');
  }

  var userId = generateSequentialId_('U', state.Users, 'User_ID');
  var newUser = {
    User_ID: userId,
    Email: email,
    Password: hashPassword_(password),
    Name: name,
    Team_ID: targetTeam.Team_ID,
    Role: 'Member',
    Status: 'Active'
  };

  state.Users.push(newUser);
  persistState_(state);
  state = loadState_();

  appendActivityLogEntries_([
    createActivityLogEntry_(newUser, '加入小組', '已使用邀請碼加入「' + targetTeam.Team_Name + '」。', 'team', targetTeam.Team_ID, 'normal', {
      source: 'registerMember'
    })
  ]);

  return buildAuthenticatedClientResult_(state, findUserByEmail_(state.Users, email), {
    team: targetTeam
  });
}

function handleActivatePending_(payload) {
  var state = loadState_();
  var email = normalizeEmail_(payload.email);
  var name = String(payload.name || '').trim();
  var password = String(payload.password || payload.pwd || '');

  validateRegistrationPayload_('pending', name, email, password);

  var targetUser = findUserByEmail_(state.Users, email);
  if (!targetUser || String(targetUser.Status || '') !== 'Pending') {
    throw new Error('無待開通帳號或此帳號已啟用。');
  }

  targetUser.Name = name;
  targetUser.Password = hashPassword_(password);
  targetUser.Status = 'Active';
  persistState_(state);
  state = loadState_();

  appendActivityLogEntries_([
    createActivityLogEntry_(targetUser, '開通帳號', '已完成帳號開通。', 'user', targetUser.User_ID, 'normal', {
      source: 'activatePending'
    })
  ]);

  return buildAuthenticatedClientResult_(state, findUserByEmail_(state.Users, email));
}

function handleRequestPasswordReset_(payload) {
  var config = getConfig_();
  var email = normalizeEmail_(payload.email);
  var genericMessage = '若此信箱存在，我們已寄出重設連結，請前往信箱收信。';

  if (!email) {
    throw new Error('請輸入有效的電子郵件。');
  }

  if (!config.frontendBaseUrl) {
    throw new Error('尚未設定 FRONTEND_BASE_URL，暫時無法寄送重設連結。');
  }

  var state = loadState_();
  var user = findUserByEmail_(state.Users, email);
  if (!user || String(user.Status || '') !== 'Active') {
    return {
      message: genericMessage
    };
  }

  var tokens = loadPasswordResetTokens_();
  cleanupPasswordResetTokens_(tokens);
  invalidatePasswordResetTokensForUser_(tokens, user.User_ID, 'replaced');

  var requestedAt = new Date();
  var expiresAt = new Date(requestedAt.getTime() + config.passwordResetExpiryMinutes * 60 * 1000);
  var rawToken = generateResetToken_();
  var resetUrl = buildPasswordResetUrl_(rawToken, config.frontendBaseUrl);

  tokens.unshift(normalizePasswordResetTokenRecord_({
    Reset_ID: generateSequentialId_('PR', tokens, 'Reset_ID'),
    User_ID: user.User_ID,
    Email: email,
    Token_Hash: hashResetToken_(rawToken),
    Requested_At: formatDateTime_(requestedAt),
    Expires_At: formatDateTime_(expiresAt),
    Consumed_At: '',
    Status: 'active',
    Requested_At_Millis: requestedAt.getTime(),
    Expires_At_Millis: expiresAt.getTime(),
    Consumed_At_Millis: 0
  }));

  persistPasswordResetTokens_(tokens);

  try {
    sendPasswordResetEmail_(user, resetUrl, formatDateTime_(expiresAt));
  } catch (error) {
    Logger.log('Failed to send password reset email: ' + error);
    throw new Error('重設密碼信寄送失敗，請稍後再試。');
  }

  return {
    message: genericMessage
  };
}

function handlePreviewPasswordReset_(payload) {
  var rawToken = String(payload.token || '').trim();
  if (!rawToken) {
    throw new Error('缺少重設密碼驗證碼。');
  }

  var state = loadState_();
  var tokens = loadPasswordResetTokens_();
  var cleanupChanged = cleanupPasswordResetTokens_(tokens);
  var record = findActivePasswordResetRecord_(tokens, rawToken);

  if (cleanupChanged) {
    persistPasswordResetTokens_(tokens);
  }

  if (!record) {
    throw new Error('此重設連結已失效或已過期。');
  }

  var user = state.Users.find(function(item) {
    return String(item.User_ID || '') === record.User_ID;
  });
  if (!user || String(user.Status || '') !== 'Active') {
    throw new Error('此重設連結已失效或已過期。');
  }

  return {
    email: normalizeEmail_(user.Email || record.Email),
    maskedEmail: maskEmail_(user.Email || record.Email),
    expiresAt: record.Expires_At
  };
}

function handleResetPassword_(payload) {
  var rawToken = String(payload.token || '').trim();
  var password = String(payload.password || '');

  if (!rawToken) {
    throw new Error('缺少重設密碼驗證碼。');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error('密碼至少需要 ' + MIN_PASSWORD_LENGTH + ' 碼。');
  }

  var state = loadState_();
  var tokens = loadPasswordResetTokens_();
  var cleanupChanged = cleanupPasswordResetTokens_(tokens);
  var record = findActivePasswordResetRecord_(tokens, rawToken);

  if (!record) {
    if (cleanupChanged) {
      persistPasswordResetTokens_(tokens);
    }
    throw new Error('此重設連結已失效或已過期。');
  }

  var user = state.Users.find(function(item) {
    return String(item.User_ID || '') === record.User_ID;
  });
  if (!user || String(user.Status || '') !== 'Active') {
    throw new Error('此重設連結已失效或已過期。');
  }

  user.Password = hashPassword_(password);
  revokeAllSessionsForUser_(user.User_ID);
  markPasswordResetRecord_(record, 'used');
  invalidatePasswordResetTokensForUser_(tokens, user.User_ID, 'replaced', {
    excludeResetId: record.Reset_ID
  });

  persistState_(state);
  persistPasswordResetTokens_(tokens);

  appendActivityLogEntries_([
    createActivityLogEntry_(user, '更新密碼', '已透過重設流程更新登入密碼。', 'user', user.User_ID, 'warning', {
      source: 'resetPassword'
    })
  ]);

  return {
    message: '密碼已更新，請重新登入。',
    email: normalizeEmail_(user.Email)
  };
}

function handleUploadFile_(payload) {
  var state = loadState_();
  var currentUser = requireStudentUploadActor_(state, payload);
  var fileName = String(payload.fileName || payload.sourceFileName || '').trim();
  var fileContentBase64 = String(payload.fileContentBase64 || payload.base64 || '').trim();
  var mimeType = String(payload.mimeType || 'application/octet-stream').trim();
  var stageId = String(payload.stageId || '').trim();
  var teamId = String(payload.teamId || '').trim();
  var fileSize = Number(payload.fileSize || 0);

  if (!fileName) {
    throw new Error('uploadFile requires `fileName`.');
  }

  if (!fileContentBase64) {
    throw new Error('請直接選擇要上傳的檔案。');
  }

  if (fileSize > MAX_BROWSER_UPLOAD_SIZE_BYTES) {
    throw new Error('檔案超過目前直傳上限 18 MB。');
  }

  var effectiveTeamId = currentUser.Team_ID;

  var activeStage = stageId
    ? state.Config_Stages.find(function(stage) { return stage.Stage_ID === stageId; })
    : state.Config_Stages.find(function(stage) { return stage.Is_Active === true; });
  if (!activeStage) {
    throw new Error('No active stage found for upload.');
  }

  var team = state.Teams.find(function(item) {
    return item.Team_ID === effectiveTeamId;
  });
  if (!team) {
    throw new Error('Team not found: ' + effectiveTeamId);
  }

  var parsedFile = parseFileMeta_(fileName);
  var baseName = String(payload.baseName || parsedFile.baseName || '').trim();
  var extension = String(payload.extension || parsedFile.extension || '').trim();

  if (!extension) {
    throw new Error('檔案名稱需包含副檔名。');
  }

  if (!isSupportedUploadExtension_(extension)) {
    throw new Error('目前只支援 ai、pdf、psd、indd、圖像格式與 zip。');
  }

  var groupKey = String(payload.groupKey || makeFileGroupKey_(activeStage.Stage_ID, effectiveTeamId, baseName)).trim();
  var latestFile = getLatestFileForGroup_(state.Files, groupKey);

  if (latestFile && latestFile.Check_Status !== '退件') {
    throw new Error('Only rejected attachments can be resubmitted.');
  }

  var relatedFiles = state.Files.filter(function(file) {
    return file.File_Group_Key === groupKey;
  });
  var highestVersion = relatedFiles.reduce(function(max, file) {
    return Math.max(max, Number(file.Version_No || 1));
  }, 0);
  var nextVersion = Math.max(highestVersion + 1, Number(payload.nextVersion || parsedFile.parsedVersion || 1));
  var storedFileName = buildVersionedFileName_(baseName, nextVersion, extension);
  var uploadNote = latestFile ? '退件後重新繳交' : '首次繳交';
  var driveResult = createDriveFileFromBase64_(
    fileContentBase64,
    mimeType,
    fileName,
    [activeStage.Stage_Name, team.Team_Name],
    storedFileName
  );
  var uploadTime = nowString_();
  var nextFileId = generateSequentialId_('F', state.Files, 'File_ID');

  var createdFile = hydrateFileRecord_({
    File_ID: nextFileId,
    Stage_ID: activeStage.Stage_ID,
    Team_ID: effectiveTeamId,
    File_Name: storedFileName,
    Google_Drive_URL: driveResult.fileUrl,
    Upload_Time: uploadTime,
    Check_Status: '未審',
    Comment: '',
    Base_File_Name: baseName,
    File_Extension: extension,
    Version_No: nextVersion,
    File_Group_Key: groupKey,
    Revision_Notes: uploadNote,
    Drive_File_ID: driveResult.fileId,
    Drive_Folder_ID: driveResult.folderId
  });

  state.Files.unshift(createdFile);
  refreshFileVersionMetadata_(state.Files);

  createNotifications_(state, {
    type: nextVersion > 1 ? 'file-version' : 'file-upload',
    title: team.Team_Name + ' 已送出附件',
    message: '「' + storedFileName + '」已進入 ' + activeStage.Stage_Name + ' 繳交流程。',
    tab: 'files',
    refType: 'file',
    refId: nextFileId,
    audience: {
      roles: ['SuperAdmin', 'Admin'],
      teamIds: [effectiveTeamId]
    },
    createdAt: uploadTime,
    priority: nextVersion > 1 ? 'high' : 'normal'
  });

  persistState_(state);
  state = loadState_();

  appendActivityLogEntries_([
    createActivityLogEntry_(
      currentUser,
      nextVersion > 1 ? '重新繳交檔案' : '上傳檔案',
      '已將「' + storedFileName + '」送入「' + activeStage.Stage_Name + '」的 ' + team.Team_Name + ' 收件資料夾。',
      'file',
      nextFileId,
      nextVersion > 1 ? 'warning' : 'normal',
      { source: 'uploadFile', teamId: effectiveTeamId, stageId: activeStage.Stage_ID, version: nextVersion }
    )
  ]);

  return buildClientStateResultForUser_(state, currentUser, {
    file: state.Files.find(function(file) {
      return file.File_ID === createdFile.File_ID;
    }) || createdFile,
    drive: driveResult
  });
}

function handleUploadAssignmentAsset_(payload) {
  var state = loadState_();
  var currentUser = requireStudentUploadActor_(state, payload);
  var assignmentId = String(payload.assignmentId || '').trim();
  var fileName = String(payload.fileName || payload.sourceFileName || '').trim();
  var fileContentBase64 = String(payload.fileContentBase64 || payload.base64 || '').trim();
  var mimeType = String(payload.mimeType || 'application/octet-stream').trim();
  var teamId = String(payload.teamId || '').trim();
  var fileSize = Number(payload.fileSize || 0);

  if (!assignmentId) {
    throw new Error('uploadAssignmentAsset requires `assignmentId`.');
  }

  if (!fileName) {
    throw new Error('uploadAssignmentAsset requires `fileName`.');
  }

  if (!fileContentBase64) {
    throw new Error('uploadAssignmentAsset requires `fileContentBase64`.');
  }

  if (fileSize > MAX_BROWSER_UPLOAD_SIZE_BYTES) {
    throw new Error('檔案超過目前直傳上限 18 MB。');
  }

  var assignment = ensureArray_(state.Assignments).find(function(item) {
    return String(item.Assignment_ID || '') === assignmentId;
  });
  if (!assignment) {
    throw new Error('Assignment not found: ' + assignmentId);
  }

  var effectiveTeamId = currentUser.Team_ID;

  if (getAssignmentTargetTeamIds_(state, assignment).indexOf(effectiveTeamId) === -1) {
    throw new Error('這份作業不在此小組的目標範圍內。');
  }

  var stage = ensureArray_(state.Config_Stages).find(function(item) {
    return String(item.Stage_ID || '') === String(assignment.Stage_ID || '');
  }) || ensureArray_(state.Config_Stages).find(function(item) {
    return item.Is_Active === true;
  });
  if (!stage) {
    throw new Error('找不到對應的會審期數。');
  }

  var team = ensureArray_(state.Teams).find(function(item) {
    return String(item.Team_ID || '') === effectiveTeamId;
  });
  if (!team) {
    throw new Error('Team not found: ' + effectiveTeamId);
  }

  var parsedFile = parseFileMeta_(fileName);
  var extension = String(parsedFile.extension || '').trim();
  if (!extension) {
    throw new Error('檔案名稱需包含副檔名。');
  }

  if (!isSupportedUploadExtension_(extension)) {
    throw new Error('目前只支援 ai、pdf、psd、indd、圖像格式與 zip。');
  }

  var existingSubmissions = ensureArray_(state.Assignment_Submissions).filter(function(submission) {
    return String(submission.Assignment_ID || '') === assignment.Assignment_ID
      && String(submission.Team_ID || '') === effectiveTeamId;
  });
  var latestSubmission = existingSubmissions.slice().sort(function(a, b) {
    var numberDiff = Number(b.Submission_No || 1) - Number(a.Submission_No || 1);
    if (numberDiff !== 0) return numberDiff;
    return new Date(b.Submitted_At).getTime() - new Date(a.Submitted_At).getTime();
  })[0] || null;

  if (latestSubmission && (assignment.Allow_ReSubmit !== true || !isAssignmentSubmissionRejected_(latestSubmission))) {
    throw new Error('只有被退回修正後，才能重新繳交。');
  }

  var nextSubmissionNo = latestSubmission ? Number(latestSubmission.Submission_No || 1) + 1 : 1;
  var storedFileName = buildAssignmentSubmissionFileName_(fileName, nextSubmissionNo);
  var driveResult = createDriveFileFromBase64_(
    fileContentBase64,
    mimeType,
    fileName,
    [stage.Stage_Name, team.Team_Name, '公告作業', assignment.Title],
    storedFileName
  );

  return {
    assignmentId: assignment.Assignment_ID,
    fileName: driveResult.fileName,
    fileUrl: driveResult.fileUrl,
    driveFileId: driveResult.fileId,
    driveFolderId: driveResult.folderId,
    drive: driveResult
  };
}

function getAssignmentResourceFolderSegments_(state, assignment) {
  var stage = ensureArray_(state && state.Config_Stages).find(function(item) {
    return String(item.Stage_ID || '') === String(assignment && assignment.Stage_ID || '');
  }) || ensureArray_(state && state.Config_Stages).find(function(item) {
    return item.Is_Active === true;
  });

  if (!stage) {
    throw new Error('找不到繳交項目對應的會審期數。');
  }

  return [
    String(stage.Stage_Name || '未分類會期'),
    '繳交項目附件',
    String(assignment && assignment.Title || '未命名項目')
  ];
}

function addAssignmentResourceRecord_(state, assignment, actor, driveResult, sourceFileName, mimeType, fileSize) {
  var resource = hydrateAssignmentResourceRecord_({
    Resource_ID: generateSequentialId_('AR', state.Assignment_Resources, 'Resource_ID'),
    Assignment_ID: String(assignment.Assignment_ID || ''),
    File_Name: String(driveResult && driveResult.fileName || sourceFileName || ''),
    Google_Drive_URL: String(driveResult && driveResult.fileUrl || ''),
    Drive_File_ID: String(driveResult && driveResult.fileId || ''),
    Drive_Folder_ID: String(driveResult && driveResult.folderId || ''),
    Mime_Type: String(mimeType || 'application/octet-stream'),
    File_Size: Number(fileSize || 0),
    Created_At: nowString_(),
    Created_By_User_ID: String(actor && actor.User_ID || '')
  });

  state.Assignment_Resources.unshift(resource);
  return resource;
}

function handleUploadAssignmentResource_(payload) {
  var previousState = loadState_();
  var actor = requireSessionUser_(previousState, payload, ['SuperAdmin', 'Admin']);
  var assignmentId = String(payload && payload.assignmentId || '').trim();
  var sourceFileName = String(payload && (payload.fileName || payload.sourceFileName) || '').trim();
  var fileContentBase64 = String(payload && (payload.fileContentBase64 || payload.base64) || '').trim();
  var mimeType = String(payload && payload.mimeType || 'application/octet-stream').trim() || 'application/octet-stream';
  var fileSize = Number(payload && payload.fileSize || 0);

  if (!assignmentId) {
    throw new Error('uploadAssignmentResource requires `assignmentId`.');
  }
  if (!sourceFileName || !fileContentBase64) {
    throw new Error('請先選擇要提供給小組的附件。');
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error('附件大小無效，請重新選擇檔案。');
  }
  if (fileSize > MAX_BROWSER_UPLOAD_SIZE_BYTES) {
    throw new Error('附件超過 18 MB，請改用穩定上傳方式。');
  }

  var assignment = ensureArray_(previousState.Assignments).find(function(item) {
    return String(item.Assignment_ID || '') === assignmentId;
  });
  if (!assignment) {
    throw new Error('NOT_FOUND: 找不到指定的繳交項目。');
  }

  var parsedFile = parseFileMeta_(sourceFileName);
  var extension = String(parsedFile.extension || '').trim();
  if (!extension || !isSupportedAssignmentResourceExtension_(extension)) {
    throw new Error('項目附件支援 ai、pdf、psd、indd、圖片、zip、Office 與文字檔。');
  }

  var driveResult = createDriveFileFromBase64_(
    fileContentBase64,
    mimeType,
    sourceFileName,
    getAssignmentResourceFolderSegments_(previousState, assignment),
    sourceFileName
  );
  var nextState = cloneObject_(previousState);
  var resource = addAssignmentResourceRecord_(
    nextState,
    assignment,
    actor,
    driveResult,
    sourceFileName,
    mimeType,
    fileSize
  );

  try {
    persistState_(nextState, {
      existingState: previousState,
      nextRevision: getStateRevision_(previousState) + 1,
      preserveAssignmentResourceState: false
    });
  } catch (error) {
    trashDriveFiles_([driveResult.fileId]);
    throw error;
  }

  var persistedState = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(
      actor,
      '新增繳交項目附件',
      '已將「' + String(resource.File_Name || sourceFileName) + '」附加至「' + String(assignment.Title || assignmentId) + '」。',
      'assignment',
      assignmentId,
      'normal',
      { source: 'uploadAssignmentResource', resourceId: resource.Resource_ID, fileSize: resource.File_Size }
    )
  ]);

  return buildClientStateResultForUser_(persistedState, actor, {
    assignmentResource: resource,
    drive: driveResult
  });
}

function handleDeleteAssignmentResource_(payload) {
  var previousState = loadState_();
  var actor = requireSessionUser_(previousState, payload, ['SuperAdmin', 'Admin']);
  assertExpectedStateRevision_(payload, previousState);
  var resourceId = String(payload && payload.resourceId || '').trim();

  if (!resourceId) {
    throw new Error('deleteAssignmentResource requires `resourceId`.');
  }

  var resource = ensureArray_(previousState.Assignment_Resources).find(function(item) {
    return String(item && item.Resource_ID || '') === resourceId;
  });
  if (!resource) {
    throw new Error('NOT_FOUND: 找不到要刪除的項目附件。');
  }

  var nextState = cloneObject_(previousState);
  nextState.Assignment_Resources = ensureArray_(nextState.Assignment_Resources).filter(function(item) {
    return String(item && item.Resource_ID || '') !== resourceId;
  });
  var driveFileId = String(resource.Drive_File_ID || '').trim()
    || extractDriveFileId_(resource.Google_Drive_URL);
  var recycleEntry = buildRecycleBinEntry_(
    nextState,
    actor,
    'assignment-resource',
    resourceId,
    String(resource.File_Name || resourceId),
    buildRecycleSnapshot_({ Assignment_Resources: [resource] }),
    driveFileId ? [driveFileId] : []
  );
  persistState_(nextState, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveAssignmentResourceState: false,
    preserveRecycleBinState: false
  });

  var persistedState = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(
      actor,
      '刪除繳交項目附件',
      '已從繳交項目移除附件「' + String(resource.File_Name || resourceId) + '」。',
      'assignment',
      String(resource.Assignment_ID || ''),
      'warning',
      { source: 'deleteAssignmentResource', resourceId: resourceId }
    )
  ]);

  var driveTrashSummary = enqueueDeferredDriveTrash_(driveFileId ? [driveFileId] : []);
  return buildClientStateResultForUser_(persistedState, actor, {
    deletedAssignmentResource: resource,
    recycleBinItem: recycleEntry,
    driveTrashSummary: driveTrashSummary
  });
}

function getDesignServiceSettings_(state) {
  var settings = ensureArray_(state && state.Design_Service_Settings)[0] || {};
  return hydrateDesignServiceSettingsRecord_(settings);
}

function getDesignServiceOrderById_(state, serviceOrderId) {
  var targetId = String(serviceOrderId || '').trim();
  return ensureArray_(state && state.Design_Service_Orders).find(function(order) {
    return String(order.Service_Order_ID || '') === targetId;
  }) || null;
}

function getDesignServiceEligibleUserIds_(state, settings) {
  var requestedIds = ensureArray_(settings && settings.Eligible_User_IDs).map(function(userId) {
    return String(userId || '').trim();
  });
  return ensureArray_(state && state.Users).filter(function(user) {
    return requestedIds.indexOf(String(user.User_ID || '')) >= 0
      && String(user.Role || '') === 'Admin'
      && String(user.Status || '') === 'Active';
  }).map(function(user) {
    return String(user.User_ID || '');
  });
}

function getDesignServiceAssignmentContext_(state, assignmentId, teamId) {
  var targetAssignmentId = String(assignmentId || '').trim();
  var targetTeamId = String(teamId || '').trim();
  var assignment = ensureArray_(state && state.Assignments).find(function(item) {
    return String(item.Assignment_ID || '') === targetAssignmentId;
  }) || null;
  if (!assignment) {
    throw new Error('找不到指定的繳交項目。');
  }
  if (!targetTeamId || targetTeamId === 'T00' || !isAssignmentVisibleToTeam_(state, assignment, targetTeamId)) {
    throw new Error('FORBIDDEN: 這份繳交項目不在你的作業範圍內。');
  }

  var team = ensureArray_(state && state.Teams).find(function(item) {
    return String(item.Team_ID || '') === targetTeamId;
  }) || null;
  if (!team) {
    throw new Error('找不到申請小組。');
  }

  var stage = ensureArray_(state && state.Config_Stages).find(function(item) {
    return String(item.Stage_ID || '') === String(assignment.Stage_ID || '');
  }) || null;
  if (!stage) {
    throw new Error('找不到這份作業所屬的會審期數。');
  }

  return {
    assignment: assignment,
    team: team,
    stage: stage
  };
}

function getDesignServiceRequestStatusLabel_(status) {
  var labels = {
    '待接案': '待形印組接案',
    '製作中': '製作中',
    '待審核': '待形印組長審核',
    '退回修正': '退回修正',
    '已完成': '已完成'
  };
  return labels[String(status || '')] || String(status || '處理中');
}

function updateDesignServiceSettings_(state, settings) {
  state.Design_Service_Settings = [hydrateDesignServiceSettingsRecord_(settings)];
}

function handleConfigureDesignService_(payload) {
  var state = loadState_();
  var actor = requireSessionUser_(state, payload, ['SuperAdmin']);
  var requestedIds = payload && payload.eligibleUserIds;
  if (typeof requestedIds === 'string') {
    try {
      requestedIds = JSON.parse(requestedIds);
    } catch (ignoreError) {
      requestedIds = requestedIds.split(',');
    }
  }

  var eligibleIds = ensureArray_(requestedIds).map(function(userId) {
    return String(userId || '').trim();
  }).filter(function(userId, index, list) {
    return userId && list.indexOf(userId) === index;
  });
  var invalidIds = eligibleIds.filter(function(userId) {
    return !ensureArray_(state.Users).some(function(user) {
      return String(user.User_ID || '') === userId
        && String(user.Role || '') === 'Admin'
        && String(user.Status || '') === 'Active';
    });
  });
  if (invalidIds.length > 0) {
    throw new Error('只能指定目前為啟用中的形印組員接案。');
  }

  var previousState = cloneObject_(state);
  var settings = getDesignServiceSettings_(state);
  settings.Enabled = payload.enabled === true || String(payload.enabled || '').toLowerCase() === 'true';
  settings.Eligible_User_IDs = eligibleIds;
  settings.Updated_At = nowString_();
  settings.Updated_By_User_ID = String(actor.User_ID || '');
  updateDesignServiceSettings_(state, settings);

  persistState_(state, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveDesignServiceState: false
  });
  state = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(
      actor,
      '設定形印代做',
      '已' + (settings.Enabled ? '開啟' : '關閉') + '形印代做，指定 ' + eligibleIds.length + ' 位形印組員可接案。',
      'design-service',
      settings.Settings_ID,
      'normal',
      { source: 'configureDesignService', enabled: settings.Enabled, eligibleUserIds: eligibleIds }
    )
  ]);

  return buildClientStateResultForUser_(state, actor, {
    designServiceSettings: getDesignServiceSettings_(state)
  });
}

function handleRequestDesignService_(payload) {
  var state = loadState_();
  var previousState = cloneObject_(state);
  var actor = requireSessionUser_(state, payload, ['Leader', 'Member', 'Admin']);
  if (String(actor.Team_ID || '') === 'T00') {
    throw new Error('只有正式小組可以申請形印代做。');
  }
  var settings = getDesignServiceSettings_(state);
  if (settings.Enabled !== true) {
    throw new Error('目前尚未開放形印代做申請。');
  }

  var context = getDesignServiceAssignmentContext_(state, payload.assignmentId, actor.Team_ID);
  var existingOrder = ensureArray_(state.Design_Service_Orders).find(function(order) {
    return String(order.Assignment_ID || '') === String(context.assignment.Assignment_ID || '')
      && String(order.Team_ID || '') === String(actor.Team_ID || '')
      && String(order.Status || '') !== '取消';
  }) || null;
  if (existingOrder) {
    throw new Error('這份作業已經有形印代做案件，請直接查看目前案件狀態。');
  }

  var requestedAt = nowString_();
  var order = hydrateDesignServiceOrderRecord_({
    Service_Order_ID: generateSequentialId_('DS', state.Design_Service_Orders, 'Service_Order_ID'),
    Assignment_ID: context.assignment.Assignment_ID,
    Stage_ID: context.stage.Stage_ID,
    Team_ID: actor.Team_ID,
    Requested_By_User_ID: actor.User_ID,
    Requested_At: requestedAt,
    Status: '待接案',
    Updated_At: requestedAt
  });
  state.Design_Service_Orders.unshift(order);

  var adminIds = getDesignServiceEligibleUserIds_(state, settings);
  var leaderIds = ensureArray_(state.Users).filter(function(user) {
    return String(user.Role || '') === 'SuperAdmin' && String(user.Status || '') === 'Active';
  }).map(function(user) {
    return String(user.User_ID || '');
  });
  createNotifications_(state, {
    type: 'design-service-request',
    title: '收到形印代做申請',
    message: context.team.Team_Name + ' 申請「' + context.assignment.Title + '」由形印組協助製作，等待接案。',
    tab: 'design-service',
    refType: 'design-service-order',
    refId: order.Service_Order_ID,
    audience: { userIds: adminIds.concat(leaderIds) },
    createdAt: requestedAt,
    priority: 'high'
  });

  persistState_(state, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveDesignServiceState: false
  });
  state = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(
      actor,
      '申請形印代做',
      context.team.Team_Name + ' 已申請「' + context.assignment.Title + '」由形印組協助製作。',
      'design-service',
      order.Service_Order_ID,
      'normal',
      { source: 'requestDesignService', assignmentId: context.assignment.Assignment_ID, teamId: actor.Team_ID }
    )
  ]);

  return buildClientStateResultForUser_(state, actor, {
    designServiceOrder: getDesignServiceOrderById_(state, order.Service_Order_ID)
  });
}

function handleClaimDesignServiceOrder_(payload) {
  var state = loadState_();
  var previousState = cloneObject_(state);
  var actor = requireSessionUser_(state, payload, ['Admin']);
  var settings = getDesignServiceSettings_(state);
  if (settings.Enabled !== true) {
    throw new Error('目前未開放新的形印代做接案。');
  }
  if (getDesignServiceEligibleUserIds_(state, settings).indexOf(String(actor.User_ID || '')) === -1) {
    throw new Error('目前尚未被組長指定為可接案的形印組員。');
  }

  var order = getDesignServiceOrderById_(state, payload.serviceOrderId);
  if (!order) {
    throw new Error('找不到指定的形印代做案件。');
  }
  if (order.Status !== '待接案') {
    throw new Error('這個案件已被其他人接案或已進入下一個流程。');
  }

  var claimedAt = nowString_();
  order.Responsible_User_ID = String(actor.User_ID || '');
  order.Responsible_Name = String(actor.Name || '');
  order.Claimed_At = claimedAt;
  order.Status = '製作中';
  order.Updated_At = claimedAt;

  createNotifications_(state, {
    type: 'design-service-claimed',
    title: '形印代做已接案',
    message: '「' + order.Service_Order_ID + '」已由 ' + actor.Name + ' 接案製作。',
    tab: 'design-service',
    refType: 'design-service-order',
    refId: order.Service_Order_ID,
    audience: { teamIds: [order.Team_ID] },
    createdAt: claimedAt,
    priority: 'normal'
  });

  persistState_(state, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveDesignServiceState: false
  });
  state = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(
      actor,
      '接案形印代做',
      '已接下形印代做案件「' + order.Service_Order_ID + '」。',
      'design-service',
      order.Service_Order_ID,
      'normal',
      { source: 'claimDesignServiceOrder', teamId: order.Team_ID }
    )
  ]);

  return buildClientStateResultForUser_(state, actor, {
    designServiceOrder: getDesignServiceOrderById_(state, order.Service_Order_ID)
  });
}

function updateDesignServiceOrderWithDrive_(state, actor, order, driveResult) {
  var submittedAt = nowString_();
  order.File_Name = String(driveResult.fileName || '');
  order.Google_Drive_URL = String(driveResult.fileUrl || '');
  order.Drive_File_ID = String(driveResult.fileId || '');
  order.Drive_Folder_ID = String(driveResult.folderId || '');
  order.Submitted_At = submittedAt;
  order.Reviewed_By_User_ID = '';
  order.Reviewed_At = '';
  order.Review_Note = '';
  order.Status = '待審核';
  order.Updated_At = submittedAt;

  createNotifications_(state, {
    type: 'design-service-deliverable',
    title: '形印代做成果已送審',
    message: '「' + order.Service_Order_ID + '」已由 ' + String(actor.Name || '形印組員') + ' 上傳成果，等待組長審核。',
    tab: 'design-service',
    refType: 'design-service-order',
    refId: order.Service_Order_ID,
    audience: {
      roles: ['SuperAdmin'],
      teamIds: [order.Team_ID]
    },
    createdAt: submittedAt,
    priority: 'high'
  });

  return submittedAt;
}

function handleUploadDesignServiceDeliverable_(payload) {
  var state = loadState_();
  var previousState = cloneObject_(state);
  var actor = requireSessionUser_(state, payload, ['SuperAdmin', 'Admin']);
  var order = getDesignServiceOrderById_(state, payload.serviceOrderId);
  if (!order) {
    throw new Error('找不到指定的形印代做案件。');
  }
  if (String(actor.Role || '') !== 'SuperAdmin' && String(order.Responsible_User_ID || '') !== String(actor.User_ID || '')) {
    throw new Error('FORBIDDEN: 只有案件負責人可以上傳形印代做成果。');
  }
  if (['製作中', '退回修正'].indexOf(String(order.Status || '')) === -1) {
    throw new Error('目前案件狀態不開放上傳成果。');
  }

  var fileName = String(payload.fileName || payload.sourceFileName || '').trim();
  var fileContentBase64 = String(payload.fileContentBase64 || payload.base64 || '').trim();
  var mimeType = String(payload.mimeType || 'application/octet-stream').trim();
  var fileSize = Number(payload.fileSize || 0);
  if (!fileName || !fileContentBase64) {
    throw new Error('請直接選擇要上傳的成果檔案。');
  }
  if (fileSize > MAX_BROWSER_UPLOAD_SIZE_BYTES) {
    throw new Error('成果檔案超過目前直傳上限 18 MB，請改用穩定上傳頁。');
  }

  var parsedFile = parseFileMeta_(fileName);
  if (!parsedFile.extension || !isSupportedUploadExtension_(parsedFile.extension)) {
    throw new Error('目前只支援 ai、pdf、psd、indd、圖像格式與 zip。');
  }
  var assignment = ensureArray_(state.Assignments).find(function(item) {
    return String(item.Assignment_ID || '') === String(order.Assignment_ID || '');
  }) || null;
  var stage = ensureArray_(state.Config_Stages).find(function(item) {
    return String(item.Stage_ID || '') === String(order.Stage_ID || '');
  }) || null;
  var team = ensureArray_(state.Teams).find(function(item) {
    return String(item.Team_ID || '') === String(order.Team_ID || '');
  }) || null;
  if (!assignment || !stage || !team) {
    throw new Error('找不到形印代做案件的作業、會審或小組資料。');
  }

  var driveResult = createDriveFileFromBase64_(
    fileContentBase64,
    mimeType,
    fileName,
    [stage.Stage_Name, team.Team_Name, '形印代做', assignment.Title, order.Service_Order_ID],
    fileName
  );
  updateDesignServiceOrderWithDrive_(state, actor, order, driveResult);

  persistState_(state, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveDesignServiceState: false
  });
  state = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(
      actor,
      '上傳形印代做成果',
      '已將「' + driveResult.fileName + '」送入形印代做案件「' + order.Service_Order_ID + '」等待審核。',
      'design-service',
      order.Service_Order_ID,
      'normal',
      { source: 'uploadDesignServiceDeliverable', driveFileId: driveResult.fileId }
    )
  ]);

  return buildClientStateResultForUser_(state, actor, {
    designServiceOrder: getDesignServiceOrderById_(state, order.Service_Order_ID),
    drive: driveResult
  });
}

function handleReviewDesignServiceOrder_(payload) {
  var state = loadState_();
  var previousState = cloneObject_(state);
  var reviewer = requireSessionUser_(state, payload, ['SuperAdmin']);
  var order = getDesignServiceOrderById_(state, payload.serviceOrderId);
  var decision = String(payload.status || '').trim();
  var reviewNote = String(payload.reviewNote || payload.comment || '').trim();
  if (!order) {
    throw new Error('找不到指定的形印代做案件。');
  }
  if (['通過', '退件'].indexOf(decision) === -1) {
    throw new Error('請選擇通過或退回修正。');
  }
  if (order.Status !== '待審核') {
    throw new Error('只有待審核的形印代做成果可以進行審核。');
  }

  var reviewedAt = nowString_();
  order.Status = decision === '通過' ? '已完成' : '退回修正';
  order.Reviewed_By_User_ID = String(reviewer.User_ID || '');
  order.Reviewed_At = reviewedAt;
  order.Review_Note = decision === '退件' ? (reviewNote || '請依形印組長意見修正後重新上傳。') : reviewNote;
  order.Updated_At = reviewedAt;

  createNotifications_(state, {
    type: decision === '通過' ? 'design-service-approved' : 'design-service-rejected',
    title: decision === '通過' ? '形印代做成果已完成' : '形印代做成果需要修正',
    message: decision === '通過'
      ? '案件「' + order.Service_Order_ID + '」已通過形印組長審核。'
      : '案件「' + order.Service_Order_ID + '」已退回修正。' + (order.Review_Note ? ' 審核意見：' + order.Review_Note : ''),
    tab: 'design-service',
    refType: 'design-service-order',
    refId: order.Service_Order_ID,
    audience: {
      teamIds: [order.Team_ID],
      userIds: order.Responsible_User_ID ? [order.Responsible_User_ID] : []
    },
    createdAt: reviewedAt,
    priority: decision === '通過' ? 'normal' : 'high'
  });

  persistState_(state, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveDesignServiceState: false
  });
  state = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(
      reviewer,
      decision === '通過' ? '通過形印代做審核' : '退回形印代做成果',
      '已將形印代做案件「' + order.Service_Order_ID + '」標記為「' + order.Status + '」。',
      'design-service',
      order.Service_Order_ID,
      decision === '通過' ? 'normal' : 'warning',
      { source: 'reviewDesignServiceOrder', decision: decision, reviewNote: order.Review_Note }
    )
  ]);

  return buildClientStateResultForUser_(state, reviewer, {
    designServiceOrder: getDesignServiceOrderById_(state, order.Service_Order_ID)
  });
}

function handleLargeFileFormUpload_(payload, resumableDriveResult) {
  var state = loadState_();
  var currentUser = requireStudentUploadActor_(state, payload);
  var isResumable = Boolean(resumableDriveResult && resumableDriveResult.fileId);
  var userId = String(payload.userId || '').trim();
  var stageId = String(payload.stageId || '').trim();
  var teamId = String(payload.teamId || '').trim();
  var groupKey = String(payload.groupKey || '').trim();
  var baseName = String(payload.baseName || '').trim();
  var sourceFileName = String(payload.sourceFileName || '').trim();
  var extension = String(payload.extension || '').trim();
  var sessionKey = String(payload.sessionKey || '').trim();
  var blob = isResumable ? null : resolveUploadBlob_(payload.uploadFile);
  var fileSize = isResumable ? Number(payload.fileSize || 0) : getBlobSizeBytes_(blob);
  var actualFileName = sanitizeDriveEntryName_(
    isResumable ? sourceFileName : (blob.getName && blob.getName()),
    sourceFileName || 'upload.bin'
  );
  var parsedActualFile = parseFileMeta_(actualFileName);

  if (userId && userId !== String(currentUser.User_ID || '')) {
    throw new Error('FORBIDDEN: 穩定上傳的使用者資訊不符。');
  }

  if (fileSize > (isResumable ? MAX_RESUMABLE_UPLOAD_SIZE_BYTES : MAX_STABLE_WEBAPP_UPLOAD_SIZE_BYTES)) {
    throw new Error(isResumable
      ? '檔案超過目前分段上傳上限。'
      : '檔案超過穩定上傳頁 50 MB 上限。');
  }

  var effectiveTeamId = currentUser.Team_ID;

  var activeStage = stageId
    ? state.Config_Stages.find(function(stage) { return stage.Stage_ID === stageId; })
    : state.Config_Stages.find(function(stage) { return stage.Is_Active === true; });
  if (!activeStage) {
    throw new Error('No active stage found for upload.');
  }

  var team = state.Teams.find(function(item) {
    return item.Team_ID === effectiveTeamId;
  });
  if (!team) {
    throw new Error('Team not found: ' + effectiveTeamId);
  }

  var resolvedBaseName = String(baseName || parsedActualFile.baseName || '').trim();
  var resolvedExtension = String(extension || parsedActualFile.extension || '').trim();
  if (!resolvedBaseName) {
    throw new Error('檔案主名稱不可為空白。');
  }
  if (!resolvedExtension) {
    throw new Error('檔案名稱需包含副檔名。');
  }
  if (!isSupportedUploadExtension_(resolvedExtension)) {
    throw new Error('目前只支援 ai、pdf、psd、indd、圖像格式與 zip。');
  }

  var resolvedGroupKey = String(groupKey || makeFileGroupKey_(activeStage.Stage_ID, effectiveTeamId, resolvedBaseName)).trim();
  var latestFile = getLatestFileForGroup_(state.Files, resolvedGroupKey);
  if (latestFile && latestFile.Check_Status !== '退件') {
    throw new Error('Only rejected attachments can be resubmitted.');
  }

  var relatedFiles = state.Files.filter(function(file) {
    return file.File_Group_Key === resolvedGroupKey;
  });
  var highestVersion = relatedFiles.reduce(function(max, file) {
    return Math.max(max, Number(file.Version_No || 1));
  }, 0);
  var nextVersion = highestVersion + 1;
  var storedFileName = buildVersionedFileName_(resolvedBaseName, nextVersion, resolvedExtension);
  var uploadNote = latestFile ? '退件後重新繳交' : '首次繳交';
  var driveResult = resumableDriveResult || createDriveFileFromBlob_(blob, [activeStage.Stage_Name, team.Team_Name], storedFileName);
  if (isResumable) {
    renameDriveResultIfNeeded_(driveResult, storedFileName);
  }
  var uploadTime = nowString_();
  var nextFileId = generateSequentialId_('F', state.Files, 'File_ID');

  var createdFile = hydrateFileRecord_({
    File_ID: nextFileId,
    Stage_ID: activeStage.Stage_ID,
    Team_ID: effectiveTeamId,
    File_Name: storedFileName,
    Google_Drive_URL: driveResult.fileUrl,
    Upload_Time: uploadTime,
    Check_Status: '未審',
    Comment: '',
    Base_File_Name: resolvedBaseName,
    File_Extension: resolvedExtension,
    Version_No: nextVersion,
    File_Group_Key: resolvedGroupKey,
    Revision_Notes: uploadNote,
    Drive_File_ID: driveResult.fileId,
    Drive_Folder_ID: driveResult.folderId
  });

  state.Files.unshift(createdFile);
  refreshFileVersionMetadata_(state.Files);

  createNotifications_(state, {
    type: nextVersion > 1 ? 'file-version' : 'file-upload',
    title: team.Team_Name + ' 已送出附件',
    message: '「' + storedFileName + '」已進入 ' + activeStage.Stage_Name + ' 繳交流程。',
    tab: 'files',
    refType: 'file',
    refId: nextFileId,
    audience: {
      roles: ['SuperAdmin', 'Admin'],
      teamIds: [effectiveTeamId]
    },
    createdAt: uploadTime,
    priority: nextVersion > 1 ? 'high' : 'normal'
  });

  persistState_(state);

  appendActivityLogEntries_([
    createActivityLogEntry_(
      currentUser,
      nextVersion > 1 ? '重新繳交檔案' : '上傳檔案',
      '已透過大檔上傳流程將「' + storedFileName + '」送入「' + activeStage.Stage_Name + '」的 ' + team.Team_Name + ' 收件資料夾。',
      'file',
      nextFileId,
      nextVersion > 1 ? 'warning' : 'normal',
      { source: 'largeFileUpload', teamId: effectiveTeamId, stageId: activeStage.Stage_ID, version: nextVersion }
    )
  ]);

  return {
    status: 'success',
    mode: 'file',
    sessionKey: sessionKey,
    fileId: createdFile.File_ID,
    fileName: createdFile.File_Name,
    fileUrl: createdFile.Google_Drive_URL,
    driveFileId: driveResult.fileId,
    driveFolderId: driveResult.folderId,
    folderPath: driveResult.folderPath,
    uploadedAt: uploadTime
  };
}

function handleLargeAssignmentAssetFormUpload_(payload, resumableDriveResult) {
  var state = loadState_();
  var currentUser = requireStudentUploadActor_(state, payload);
  var isResumable = Boolean(resumableDriveResult && resumableDriveResult.fileId);
  var userId = String(payload.userId || '').trim();
  var assignmentId = String(payload.assignmentId || '').trim();
  var teamId = String(payload.teamId || '').trim();
  var sessionKey = String(payload.sessionKey || '').trim();
  var sourceFileName = String(payload.sourceFileName || '').trim();
  var blob = isResumable ? null : resolveUploadBlob_(payload.uploadFile);
  var fileSize = isResumable ? Number(payload.fileSize || 0) : getBlobSizeBytes_(blob);
  var actualFileName = sanitizeDriveEntryName_(
    isResumable ? sourceFileName : (blob.getName && blob.getName()),
    sourceFileName || 'upload.bin'
  );
  var parsedFile = parseFileMeta_(actualFileName);
  var extension = String(parsedFile.extension || '').trim();

  if (userId && userId !== String(currentUser.User_ID || '')) {
    throw new Error('FORBIDDEN: 穩定上傳的使用者資訊不符。');
  }
  if (!assignmentId) {
    throw new Error('穩定上傳缺少 assignmentId。');
  }
  if (fileSize > (isResumable ? MAX_RESUMABLE_UPLOAD_SIZE_BYTES : MAX_STABLE_WEBAPP_UPLOAD_SIZE_BYTES)) {
    throw new Error(isResumable
      ? '檔案超過目前分段上傳上限。'
      : '檔案超過穩定上傳頁 50 MB 上限。');
  }
  if (!extension) {
    throw new Error('檔案名稱需包含副檔名。');
  }
  if (!isSupportedUploadExtension_(extension)) {
    throw new Error('目前只支援 ai、pdf、psd、indd、圖像格式與 zip。');
  }

  var assignment = ensureArray_(state.Assignments).find(function(item) {
    return String(item.Assignment_ID || '') === assignmentId;
  });
  if (!assignment) {
    throw new Error('Assignment not found: ' + assignmentId);
  }

  var effectiveTeamId = currentUser.Team_ID;
  if (getAssignmentTargetTeamIds_(state, assignment).indexOf(effectiveTeamId) === -1) {
    throw new Error('這份作業不在此小組的目標範圍內。');
  }

  var stage = ensureArray_(state.Config_Stages).find(function(item) {
    return String(item.Stage_ID || '') === String(assignment.Stage_ID || '');
  }) || ensureArray_(state.Config_Stages).find(function(item) {
    return item.Is_Active === true;
  });
  if (!stage) {
    throw new Error('找不到對應的會審期數。');
  }

  var team = ensureArray_(state.Teams).find(function(item) {
    return String(item.Team_ID || '') === effectiveTeamId;
  });
  if (!team) {
    throw new Error('Team not found: ' + effectiveTeamId);
  }

  var existingSubmissions = ensureArray_(state.Assignment_Submissions).filter(function(submission) {
    return String(submission.Assignment_ID || '') === assignment.Assignment_ID
      && String(submission.Team_ID || '') === effectiveTeamId;
  });
  var latestSubmission = existingSubmissions.slice().sort(function(a, b) {
    var numberDiff = Number(b.Submission_No || 1) - Number(a.Submission_No || 1);
    if (numberDiff !== 0) return numberDiff;
    return new Date(b.Submitted_At).getTime() - new Date(a.Submitted_At).getTime();
  })[0] || null;

  if (latestSubmission && (assignment.Allow_ReSubmit !== true || !isAssignmentSubmissionRejected_(latestSubmission))) {
    throw new Error('只有被退回修正後，才能重新繳交。');
  }

  var nextSubmissionNo = latestSubmission ? Number(latestSubmission.Submission_No || 1) + 1 : 1;
  var storedFileName = buildAssignmentSubmissionFileName_(actualFileName, nextSubmissionNo);
  var driveResult = resumableDriveResult || createDriveFileFromBlob_(
      blob,
      [stage.Stage_Name, team.Team_Name, '公告作業', assignment.Title],
      storedFileName
    );
  if (isResumable) {
    renameDriveResultIfNeeded_(driveResult, storedFileName);
  }

  return {
    status: 'success',
    mode: 'assignment-asset',
    sessionKey: sessionKey,
    assignmentId: assignment.Assignment_ID,
    fileName: driveResult.fileName,
    sourceFileName: actualFileName,
    fileUrl: driveResult.fileUrl,
    driveFileId: driveResult.fileId,
    driveFolderId: driveResult.folderId,
    folderPath: driveResult.folderPath,
    uploadedAt: nowString_()
  };
}

function handleLargeAssignmentResourceFormUpload_(payload, resumableDriveResult) {
  var previousState = loadState_();
  var actor = requireSessionUser_(previousState, payload, ['SuperAdmin', 'Admin']);
  var isResumable = Boolean(resumableDriveResult && resumableDriveResult.fileId);
  var userId = String(payload && payload.userId || '').trim();
  var assignmentId = String(payload && payload.assignmentId || '').trim();
  var sessionKey = String(payload && payload.sessionKey || '').trim();
  var sourceFileName = String(payload && payload.sourceFileName || '').trim();
  var blob = isResumable ? null : resolveUploadBlob_(payload && payload.uploadFile);
  var fileSize = isResumable ? Number(payload && payload.fileSize || 0) : getBlobSizeBytes_(blob);
  var actualFileName = sanitizeDriveEntryName_(
    isResumable ? sourceFileName : (blob.getName && blob.getName()),
    sourceFileName || 'attachment.bin'
  );
  var parsedFile = parseFileMeta_(actualFileName);
  var extension = String(parsedFile.extension || '').trim();
  var mimeType = isResumable
    ? String(payload && payload.mimeType || 'application/octet-stream').trim() || 'application/octet-stream'
    : String(blob.getContentType && blob.getContentType() || 'application/octet-stream').trim() || 'application/octet-stream';

  if (userId && userId !== String(actor.User_ID || '')) {
    throw new Error('FORBIDDEN: 穩定上傳的使用者資訊不符。');
  }
  if (!assignmentId) {
    throw new Error('穩定上傳缺少 assignmentId。');
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error('附件大小無效，請重新選擇檔案。');
  }
  if (fileSize > (isResumable ? MAX_RESUMABLE_UPLOAD_SIZE_BYTES : MAX_STABLE_WEBAPP_UPLOAD_SIZE_BYTES)) {
    throw new Error(isResumable
      ? '附件超過目前分段上傳上限。'
      : '附件超過穩定上傳頁 50 MB 上限。');
  }
  if (!extension || !isSupportedAssignmentResourceExtension_(extension)) {
    throw new Error('項目附件支援 ai、pdf、psd、indd、圖片、zip、Office 與文字檔。');
  }

  var assignment = ensureArray_(previousState.Assignments).find(function(item) {
    return String(item.Assignment_ID || '') === assignmentId;
  });
  if (!assignment) {
    throw new Error('NOT_FOUND: 找不到指定的繳交項目。');
  }

  var driveResult = resumableDriveResult || createDriveFileFromBlob_(
    blob,
    getAssignmentResourceFolderSegments_(previousState, assignment),
    actualFileName
  );
  if (isResumable) {
    renameDriveResultIfNeeded_(driveResult, actualFileName);
  }

  var nextState = cloneObject_(previousState);
  var resource = addAssignmentResourceRecord_(
    nextState,
    assignment,
    actor,
    driveResult,
    actualFileName,
    mimeType,
    fileSize
  );

  try {
    persistState_(nextState, {
      existingState: previousState,
      nextRevision: getStateRevision_(previousState) + 1,
      preserveAssignmentResourceState: false
    });
  } catch (error) {
    trashDriveFiles_([driveResult.fileId]);
    throw error;
  }

  appendActivityLogEntries_([
    createActivityLogEntry_(
      actor,
      '新增繳交項目附件',
      '已透過穩定上傳將「' + String(resource.File_Name || actualFileName) + '」附加至「' + String(assignment.Title || assignmentId) + '」。',
      'assignment',
      assignmentId,
      'normal',
      { source: 'largeAssignmentResourceUpload', resourceId: resource.Resource_ID, fileSize: resource.File_Size }
    )
  ]);

  return {
    status: 'success',
    mode: 'assignment-resource',
    sessionKey: sessionKey,
    assignmentId: assignment.Assignment_ID,
    resourceId: resource.Resource_ID,
    fileName: resource.File_Name,
    fileUrl: resource.Google_Drive_URL,
    driveFileId: resource.Drive_File_ID,
    driveFolderId: resource.Drive_Folder_ID,
    folderPath: driveResult.folderPath,
    uploadedAt: resource.Created_At
  };
}

function handleLargeDesignServiceFormUpload_(payload, resumableDriveResult) {
  var state = loadState_();
  var previousState = cloneObject_(state);
  var currentUser = requireSessionUser_(state, payload, ['SuperAdmin', 'Admin']);
  var isResumable = Boolean(resumableDriveResult && resumableDriveResult.fileId);
  var serviceOrderId = String(payload.serviceOrderId || '').trim();
  var order = getDesignServiceOrderById_(state, serviceOrderId);
  if (!order) {
    throw new Error('找不到指定的形印代做案件。');
  }
  if (String(currentUser.Role || '') !== 'SuperAdmin'
    && String(order.Responsible_User_ID || '') !== String(currentUser.User_ID || '')) {
    throw new Error('FORBIDDEN: 只有案件負責人可以上傳形印代做成果。');
  }
  if (['製作中', '退回修正'].indexOf(String(order.Status || '')) === -1) {
    throw new Error('目前案件狀態不開放上傳成果。');
  }

  var blob = isResumable ? null : resolveUploadBlob_(payload.uploadFile);
  var fileSize = isResumable ? Number(payload.fileSize || 0) : getBlobSizeBytes_(blob);
  if (fileSize > (isResumable ? MAX_RESUMABLE_UPLOAD_SIZE_BYTES : MAX_STABLE_WEBAPP_UPLOAD_SIZE_BYTES)) {
    throw new Error(isResumable
      ? '檔案超過目前分段上傳上限。'
      : '檔案超過穩定上傳頁 50 MB 上限。');
  }

  var sourceFileName = String(payload.sourceFileName || '').trim();
  var actualFileName = sanitizeDriveEntryName_(
    isResumable ? sourceFileName : (blob.getName && blob.getName()),
    sourceFileName || 'design-service-deliverable.bin'
  );
  var parsedFile = parseFileMeta_(actualFileName);
  if (!parsedFile.extension || !isSupportedUploadExtension_(parsedFile.extension)) {
    throw new Error('目前只支援 ai、pdf、psd、indd、圖像格式與 zip。');
  }

  var assignment = ensureArray_(state.Assignments).find(function(item) {
    return String(item.Assignment_ID || '') === String(order.Assignment_ID || '');
  }) || null;
  var stage = ensureArray_(state.Config_Stages).find(function(item) {
    return String(item.Stage_ID || '') === String(order.Stage_ID || '');
  }) || null;
  var team = ensureArray_(state.Teams).find(function(item) {
    return String(item.Team_ID || '') === String(order.Team_ID || '');
  }) || null;
  if (!assignment || !stage || !team) {
    throw new Error('找不到形印代做案件的作業、會審或小組資料。');
  }

  var driveResult = resumableDriveResult || createDriveFileFromBlob_(
      blob,
      [stage.Stage_Name, team.Team_Name, '形印代做', assignment.Title, order.Service_Order_ID],
      actualFileName
    );
  if (isResumable) {
    renameDriveResultIfNeeded_(driveResult, actualFileName);
  }
  updateDesignServiceOrderWithDrive_(state, currentUser, order, driveResult);

  persistState_(state, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1,
    preserveDesignServiceState: false
  });
  state = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(
      currentUser,
      '上傳形印代做成果',
      '已透過穩定上傳將「' + driveResult.fileName + '」送入案件「' + order.Service_Order_ID + '」等待審核。',
      'design-service',
      order.Service_Order_ID,
      'normal',
      { source: 'largeDesignServiceUpload', driveFileId: driveResult.fileId }
    )
  ]);

  return {
    status: 'success',
    mode: 'design-service',
    sessionKey: String(payload.sessionKey || '').trim(),
    serviceOrderId: order.Service_Order_ID,
    fileName: driveResult.fileName,
    fileUrl: driveResult.fileUrl,
    driveFileId: driveResult.fileId,
    driveFolderId: driveResult.folderId,
    folderPath: driveResult.folderPath,
    uploadedAt: order.Submitted_At
  };
}

function handleReviewFile_(payload) {
  var state = loadState_();
  var reviewer = requireSessionUser_(state, payload, ['SuperAdmin', 'Admin']);
  var fileId = String(payload.fileId || '').trim();
  var status = String(payload.status || '').trim();
  var comment = String(payload.comment || '').trim();

  if (!fileId) {
    throw new Error('reviewFile requires `fileId`.');
  }

  if (!status) {
    throw new Error('reviewFile requires `status`.');
  }

  if (['未審', '通過', '退件'].indexOf(status) === -1) {
    throw new Error('Unsupported review status: ' + status);
  }

  var targetFile = state.Files.find(function(file) {
    return file.File_ID === fileId;
  });
  if (!targetFile) {
    throw new Error('File not found: ' + fileId);
  }

  if (reviewer.Role === 'Admin' && reviewer.Team_ID === targetFile.Team_ID) {
    throw new Error('Conflict of interest: reviewer cannot review their own team file.');
  }

  targetFile.Check_Status = status;
  targetFile.Comment = status === '退件'
    ? (comment || '退件（未填寫詳細理由）')
    : '';

  createNotifications_(state, {
    type: status === '退件' ? 'file-rejected' : 'file-approved',
    title: status === '退件' ? '檔案退件通知' : '檔案審核通過',
    message: status === '退件'
      ? '「' + targetFile.File_Name + '」已退件。' + (targetFile.Comment ? ' 審核意見：' + targetFile.Comment : '')
      : '「' + targetFile.File_Name + '」已通過審核。',
    tab: 'files',
    refType: 'file',
    refId: targetFile.File_ID,
    audience: {
      roles: ['SuperAdmin', 'Admin'],
      teamIds: [targetFile.Team_ID]
    },
    createdAt: nowString_(),
    priority: status === '退件' ? 'high' : 'normal'
  });

  persistState_(state);
  state = loadState_();

  appendActivityLogEntries_([
    createActivityLogEntry_(
      reviewer,
      status === '退件' ? '退件檔案' : status === '通過' ? '通過檔案審核' : '更新檔案審核',
      '已將「' + targetFile.File_Name + '」標記為「' + status + '」' + (status === '退件' && targetFile.Comment ? '，並附上退件意見。' : '。'),
      'file',
      targetFile.File_ID,
      status === '退件' ? 'warning' : 'normal',
      { source: 'reviewFile', teamId: targetFile.Team_ID, status: status }
    )
  ]);

  return buildClientStateResultForUser_(state, reviewer, {
    file: state.Files.find(function(file) {
      return file.File_ID === targetFile.File_ID;
    }) || hydrateFileRecord_(targetFile)
  });
}

function handleReviewAssignmentSubmission_(payload) {
  var previousState = loadState_();
  var reviewer = requireSessionUser_(previousState, payload, ['SuperAdmin', 'Admin']);
  assertExpectedStateRevision_(payload, previousState);

  var submissionId = String(payload && payload.submissionId || '').trim();
  var decision = String(payload && (payload.status || payload.decision) || '').trim();
  var reviewNote = String(payload && (payload.reviewNote || payload.comment) || '').trim();

  if (!submissionId) {
    throw new Error('reviewAssignmentSubmission requires `submissionId`.');
  }

  if (['通過', '退回修正'].indexOf(decision) === -1) {
    throw new Error('Unsupported assignment review decision: ' + decision);
  }

  if (decision === '退回修正' && !reviewNote) {
    throw new Error('退回修正前請先填寫審核意見。');
  }

  var targetSubmission = ensureArray_(previousState.Assignment_Submissions).find(function(submission) {
    return String(submission.Submission_ID || '') === submissionId;
  }) || null;
  if (!targetSubmission) {
    throw new Error('NOT_FOUND: 找不到指定的繳交紀錄，資料可能已被其他使用者更新。');
  }

  var assignment = ensureArray_(previousState.Assignments).find(function(item) {
    return String(item.Assignment_ID || '') === String(targetSubmission.Assignment_ID || '');
  }) || null;
  if (!assignment) {
    throw new Error('NOT_FOUND: 找不到這筆繳交紀錄所屬的繳交項目。');
  }

  var targetTeamId = String(targetSubmission.Team_ID || '').trim();
  if (!targetTeamId || getAssignmentTargetTeamIds_(previousState, assignment).indexOf(targetTeamId) === -1) {
    throw new Error('FORBIDDEN: 這筆繳交紀錄不在該項目的目標組別範圍內。');
  }

  if (reviewer.Role === 'Admin' && String(reviewer.Team_ID || '') === targetTeamId) {
    throw new Error('Conflict of interest: reviewer cannot review their own team submission.');
  }

  var latestSubmission = ensureArray_(previousState.Assignment_Submissions).filter(function(submission) {
    return String(submission.Assignment_ID || '') === String(assignment.Assignment_ID || '')
      && String(submission.Team_ID || '') === targetTeamId;
  }).sort(function(a, b) {
    var numberDiff = Number(b.Submission_No || 1) - Number(a.Submission_No || 1);
    if (numberDiff !== 0) return numberDiff;
    return String(b.Submitted_At || '').localeCompare(String(a.Submitted_At || ''));
  })[0] || null;

  if (!latestSubmission || String(latestSubmission.Submission_ID || '') !== submissionId) {
    throw new Error('STALE_SUBMISSION: 請重新載入後審核該小組最新的繳交紀錄。');
  }

  var now = nowString_();
  var nextState = cloneObject_(previousState);
  var nextSubmission = ensureArray_(nextState.Assignment_Submissions).find(function(submission) {
    return String(submission.Submission_ID || '') === submissionId;
  });
  nextSubmission.Status = decision;
  nextSubmission.Reviewed_By_User_ID = String(reviewer.User_ID || '');
  nextSubmission.Reviewed_At = now;
  nextSubmission.Review_Note = decision === '退回修正'
    ? reviewNote
    : reviewNote;
  nextSubmission.Updated_At = now;

  var team = ensureArray_(nextState.Teams).find(function(item) {
    return String(item.Team_ID || '') === targetTeamId;
  }) || null;
  var teamName = team ? String(team.Team_Name || targetTeamId) : targetTeamId;
  var decisionLabel = decision === '退回修正' ? '退回修正' : '審核通過';
  var notificationMessage = '「' + String(assignment.Title || '繳交項目') + '」的第 '
    + String(nextSubmission.Submission_No || 1) + ' 次繳交已' + decisionLabel + '。'
    + (reviewNote ? ' 審核意見：' + reviewNote : '');

  createNotifications_(nextState, {
    type: 'assignment-review',
    title: decision === '退回修正' ? '繳交項目退回修正' : '繳交項目審核通過',
    message: notificationMessage,
    tab: 'files',
    refType: 'assignment',
    refId: assignment.Assignment_ID,
    audience: {
      teamIds: [targetTeamId],
      excludeUserIds: [reviewer.User_ID]
    },
    createdAt: now,
    priority: decision === '退回修正' ? 'high' : 'normal'
  });

  nextState.Discussion_Comments.push(hydrateDiscussionCommentRecord_({
    Comment_ID: generateSequentialId_('CMT', nextState.Discussion_Comments, 'Comment_ID'),
    Ref_Type: 'assignment',
    Ref_ID: assignment.Assignment_ID,
    User_ID: reviewer.User_ID,
    Team_ID: targetTeamId,
    Author_Name: reviewer.Name,
    Author_Role: reviewer.Role,
    Kind: 'system',
    Message: teamName + ' 第 ' + String(nextSubmission.Submission_No || 1) + ' 次繳交已' + decisionLabel + '。'
      + (reviewNote ? ' 審核意見：' + reviewNote : ''),
    Created_At: now
  }));

  persistState_(nextState, {
    existingState: previousState,
    nextRevision: getStateRevision_(previousState) + 1
  });

  var savedState = loadState_();
  appendActivityLogEntries_([
    createActivityLogEntry_(
      reviewer,
      decision === '退回修正' ? '退回繳交項目' : '通過繳交項目審核',
      '已將「' + String(assignment.Title || '繳交項目') + '」的 ' + teamName + ' 第 '
        + String(nextSubmission.Submission_No || 1) + ' 次繳交標記為「' + decision + '」。',
      'submission',
      submissionId,
      decision === '退回修正' ? 'warning' : 'normal',
      {
        source: 'reviewAssignmentSubmission',
        assignmentId: assignment.Assignment_ID,
        teamId: targetTeamId,
        status: decision,
        reviewNote: reviewNote
      }
    )
  ]);

  return buildClientStateResultForUser_(savedState, reviewer, {
    submission: savedState.Assignment_Submissions.find(function(submission) {
      return String(submission.Submission_ID || '') === submissionId;
    }) || null
  });
}

function handleMarkNotificationsRead_(payload) {
  var state = loadState_();
  var currentUser = requireSessionUser_(state, payload);
  var userId = String(currentUser.User_ID || '');
  var notificationIds = ensureArray_(payload.notificationIds).map(function(notificationId) {
    return String(notificationId);
  });
  var markAll = payload.all === true || notificationIds.length === 0;

  state.Notifications.forEach(function(notification) {
    if (notification.User_ID !== userId) return;
    if (markAll || notificationIds.indexOf(notification.Notification_ID) >= 0) {
      notification.Read = true;
    }
  });

  persistState_(state);
  state = loadState_();

  return buildClientStateResultForUser_(state, currentUser, {
    notifications: state.Notifications.filter(function(notification) {
      return notification.User_ID === userId;
    })
  });
}

function handleClearNotifications_(payload) {
  var state = loadState_();
  var currentUser = requireSessionUser_(state, payload);
  var userId = String(currentUser.User_ID || '');
  var scope = String(payload.scope || 'selected').trim();
  var notificationIds = ensureArray_(payload.notificationIds).map(function(notificationId) {
    return String(notificationId);
  });

  state.Notifications = state.Notifications.filter(function(notification) {
    if (notification.User_ID !== userId) {
      return true;
    }

    if (scope === 'all') {
      return false;
    }

    if (scope === 'read') {
      return notification.Read !== true;
    }

    if (scope === 'selected') {
      return notificationIds.indexOf(notification.Notification_ID) === -1;
    }

    return true;
  });

  persistState_(state);
  state = loadState_();

  return buildClientStateResultForUser_(state, currentUser, {
    notifications: state.Notifications.filter(function(notification) {
      return notification.User_ID === userId;
    })
  });
}

function routeDriveFile_(driveUrl, stageName, teamName, targetFileName) {
  var config = getConfig_();
  var fileId = extractDriveFileId_(driveUrl);
  if (!fileId) {
    throw new Error('Unable to parse Google Drive file id from URL.');
  }

  var rootFolder = DriveApp.getFolderById(config.driveRootFolderId);
  var folderContext = getOrCreateNestedFolders_(rootFolder, [stageName, teamName]);
  var teamFolder = folderContext.folder;
  var file = DriveApp.getFileById(fileId);

  try {
    file.setName(sanitizeDriveEntryName_(targetFileName, file.getName()));
    file.moveTo(teamFolder);
  } catch (error) {
    throw new Error('Drive file move failed. Please confirm the script has edit access to the file. Original error: ' + error.message);
  }

  return {
    fileId: file.getId(),
    fileUrl: file.getUrl(),
    folderId: teamFolder.getId(),
    folderName: teamFolder.getName(),
    folderPath: folderContext.path,
    fileName: file.getName()
  };
}

function resolveUploadBlob_(blob) {
  if (!blob || typeof blob.getBytes !== 'function') {
    throw new Error('找不到上傳檔案內容，請重新選擇檔案後再試。');
  }
  return blob;
}

function getBlobSizeBytes_(blob) {
  return resolveUploadBlob_(blob).getBytes().length;
}

function createDriveFileFromBase64_(fileContentBase64, mimeType, sourceFileName, folderSegments, targetFileName) {
  var base64 = String(fileContentBase64 || '').trim();
  if (!base64) {
    throw new Error('Missing `fileContentBase64`.');
  }

  var resolvedSourceFileName = sanitizeDriveEntryName_(sourceFileName, 'upload.bin');
  var resolvedTargetFileName = sanitizeDriveEntryName_(targetFileName, resolvedSourceFileName);
  var resolvedMimeType = String(mimeType || 'application/octet-stream').trim() || 'application/octet-stream';
  var config = getConfig_();
  var rootFolder = DriveApp.getFolderById(config.driveRootFolderId);
  var folderContext = getOrCreateNestedFolders_(rootFolder, folderSegments);
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), resolvedMimeType, resolvedTargetFileName);
  var file = folderContext.folder.createFile(blob);

  return {
    fileId: file.getId(),
    fileUrl: file.getUrl(),
    fileName: file.getName(),
    folderId: folderContext.folder.getId(),
    folderName: folderContext.folder.getName(),
    folderPath: folderContext.path
  };
}

function createDriveFileFromBlob_(blob, folderSegments, targetFileName) {
  var resolvedBlob = resolveUploadBlob_(blob);
  var resolvedTargetFileName = sanitizeDriveEntryName_(targetFileName, resolvedBlob.getName && resolvedBlob.getName());
  var contentType = String(resolvedBlob.getContentType && resolvedBlob.getContentType() || 'application/octet-stream').trim() || 'application/octet-stream';
  var config = getConfig_();
  var rootFolder = DriveApp.getFolderById(config.driveRootFolderId);
  var folderContext = getOrCreateNestedFolders_(rootFolder, folderSegments);
  var driveBlob = Utilities.newBlob(resolvedBlob.getBytes(), contentType, resolvedTargetFileName);
  var file = folderContext.folder.createFile(driveBlob);

  return {
    fileId: file.getId(),
    fileUrl: file.getUrl(),
    fileName: file.getName(),
    folderId: folderContext.folder.getId(),
    folderName: folderContext.folder.getName(),
    folderPath: folderContext.path
  };
}

function renameDriveResultIfNeeded_(driveResult, targetFileName) {
  if (!driveResult || !driveResult.fileId || !targetFileName) return driveResult;
  var file = DriveApp.getFileById(String(driveResult.fileId));
  var resolvedName = sanitizeDriveEntryName_(targetFileName, file.getName());
  if (file.getName() !== resolvedName) {
    file.setName(resolvedName);
  }
  driveResult.fileName = file.getName();
  driveResult.fileUrl = file.getUrl();
  return driveResult;
}

function extractDriveFileId_(driveUrl) {
  var url = String(driveUrl || '').trim();
  if (!url) return '';

  var patterns = [
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{20,})$/
  ];

  for (var i = 0; i < patterns.length; i += 1) {
    var match = url.match(patterns[i]);
    if (match && match[1]) {
      return match[1];
    }
  }

  return '';
}

function getOrCreateFolder_(parentFolder, folderName) {
  var targetName = sanitizeDriveEntryName_(folderName);
  if (!targetName) {
    throw new Error('Folder name is required.');
  }

  var matches = parentFolder.getFoldersByName(targetName);
  if (matches.hasNext()) {
    return matches.next();
  }

  return parentFolder.createFolder(targetName);
}

function getOrCreateNestedFolders_(rootFolder, folderSegments) {
  var currentFolder = rootFolder;
  var pathNames = [rootFolder.getName()];

  ensureArray_(folderSegments).forEach(function(segment) {
    var folderName = sanitizeDriveEntryName_(segment);
    if (!folderName) {
      return;
    }
    currentFolder = getOrCreateFolder_(currentFolder, folderName);
    pathNames.push(currentFolder.getName());
  });

  return {
    folder: currentFolder,
    path: pathNames.join(' / ')
  };
}

function createNotifications_(state, payload) {
  var recipients = resolveNotificationRecipients_(state, payload.audience || {});
  if (recipients.length === 0) {
    return [];
  }

  var currentMax = state.Notifications.reduce(function(max, notification) {
    var raw = String(notification && notification.Notification_ID ? notification.Notification_ID : '');
    var match = raw.match(/^N(\d+)$/);
    if (!match) return max;
    return Math.max(max, parseInt(match[1], 10));
  }, 0);

  var createdAt = String(payload.createdAt || nowString_());
  var createdNotifications = recipients.map(function(userId, index) {
    return hydrateNotificationRecord_({
      Notification_ID: 'N' + padNumber_(currentMax + index + 1, 2),
      User_ID: userId,
      Type: payload.type || 'system',
      Title: payload.title || '系統通知',
      Message: payload.message || '',
      Created_At: createdAt,
      Read: false,
      Tab: payload.tab || 'overview',
      Ref_Type: payload.refType || '',
      Ref_ID: payload.refId || '',
      Priority: payload.priority || 'normal'
    });
  });

  state.Notifications = createdNotifications.concat(state.Notifications);

  if (typeof state.Meta.NotificationSeeded === 'undefined') {
    state.Meta.NotificationSeeded = true;
  }

  return createdNotifications;
}

function resolveNotificationRecipients_(state, audience) {
  var recipientIds = {};
  var userIds = ensureArray_(audience.userIds);
  var roles = ensureArray_(audience.roles);
  var teamIds = ensureArray_(audience.teamIds);
  var excludeUserIds = ensureArray_(audience.excludeUserIds);

  if (audience.allUsers === true) {
    state.Users.forEach(function(user) {
      recipientIds[user.User_ID] = true;
    });
  }

  userIds.forEach(function(userId) {
    recipientIds[String(userId)] = true;
  });

  if (roles.length > 0) {
    state.Users.forEach(function(user) {
      if (roles.indexOf(user.Role) >= 0) {
        recipientIds[user.User_ID] = true;
      }
    });
  }

  if (teamIds.length > 0) {
    state.Users.forEach(function(user) {
      if (teamIds.indexOf(user.Team_ID) >= 0) {
        recipientIds[user.User_ID] = true;
      }
    });
  }

  excludeUserIds.forEach(function(userId) {
    delete recipientIds[String(userId)];
  });

  return Object.keys(recipientIds);
}

function formatDateTime_(dateValue) {
  var config = getConfig_();
  return Utilities.formatDate(new Date(dateValue), config.timeZone, 'yyyy-MM-dd HH:mm');
}

function formatCompactDateTimeLabel_(value) {
  var raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  var simpleMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (simpleMatch) {
    var year = simpleMatch[1];
    var month = simpleMatch[2];
    var day = simpleMatch[3];
    var hour = simpleMatch[4];
    var minute = simpleMatch[5];
    if (hour && minute) {
      return year + '/' + month + '/' + day + ' ' + hour + ':' + minute;
    }
    return year + '/' + month + '/' + day;
  }

  var parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    var config = getConfig_();
    return Utilities.formatDate(parsed, config.timeZone, 'yyyy/MM/dd HH:mm');
  }

  return raw;
}

function normalizeDateTimeStorageValue_(value) {
  var raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  var simpleMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (simpleMatch) {
    var year = simpleMatch[1];
    var month = simpleMatch[2];
    var day = simpleMatch[3];
    var hour = simpleMatch[4] || '00';
    var minute = simpleMatch[5] || '00';
    return year + '-' + month + '-' + day + ' ' + hour + ':' + minute;
  }

  var parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return formatDateTime_(parsed);
  }

  return raw;
}

function normalizeEmbeddedDateTimes_(text) {
  var raw = String(text || '');
  if (!raw) {
    return '';
  }

  return raw.replace(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT[+-]\d{4}(?:\s+\([^)]+\))?|(?:\d{4})-(?:\d{2})-(?:\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2})?)/g, function(match) {
    return formatCompactDateTimeLabel_(match);
  });
}

function buildNotificationNormalizationFingerprint_(notification) {
  return JSON.stringify({
    Notification_ID: String(notification && notification.Notification_ID || ''),
    User_ID: String(notification && notification.User_ID || ''),
    Type: String(notification && notification.Type || ''),
    Title: String(notification && notification.Title || ''),
    Message: String(notification && notification.Message || ''),
    Created_At: String(notification && notification.Created_At || ''),
    Read: Boolean(notification && notification.Read),
    Tab: String(notification && notification.Tab || ''),
    Ref_Type: String(notification && notification.Ref_Type || ''),
    Ref_ID: String(notification && notification.Ref_ID || ''),
    Priority: String(notification && notification.Priority || '')
  });
}

function getTimeZoneOffsetString_(timeZone) {
  var offsetRaw = Utilities.formatDate(new Date(), timeZone, 'Z');
  if (!offsetRaw || offsetRaw.length !== 5) {
    return '+00:00';
  }
  return offsetRaw.slice(0, 3) + ':' + offsetRaw.slice(3);
}

function parseConfiguredDateTime_(dateTimeText) {
  var raw = String(dateTimeText || '').trim();
  var match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!match) {
    return null;
  }

  var config = getConfig_();
  var isoText = [
    match[1],
    '-',
    match[2],
    '-',
    match[3],
    'T',
    match[4] || '00',
    ':',
    match[5] || '00',
    ':00',
    getTimeZoneOffsetString_(config.timeZone)
  ].join('');

  var parsed = new Date(isoText);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function nowString_() {
  return formatDateTime_(new Date());
}

function findUserByEmail_(users, email) {
  var normalizedEmail = normalizeEmail_(email);
  return ensureArray_(users).find(function(user) {
    return normalizeEmail_(user.Email) === normalizedEmail;
  }) || null;
}

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function validateRegistrationPayload_(teamOrMode, name, email, password) {
  if (typeof teamOrMode === 'string' && teamOrMode !== 'member' && teamOrMode !== 'pending' && !String(teamOrMode).trim()) {
    throw new Error('請輸入小組名稱。');
  }

  if (!String(name || '').trim()) {
    throw new Error('請輸入姓名。');
  }

  if (!normalizeEmail_(email)) {
    throw new Error('請輸入有效的電子郵件。');
  }

  if (String(password || '').length < MIN_PASSWORD_LENGTH) {
    throw new Error('密碼至少需要 ' + MIN_PASSWORD_LENGTH + ' 碼。');
  }
}

function generateResetToken_() {
  var raw = [
    Utilities.getUuid(),
    Utilities.getUuid(),
    String(new Date().getTime())
  ].join('|');
  return Utilities.base64EncodeWebSafe(raw).replace(/=+$/g, '');
}

function hashResetToken_(token) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(token || ''),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(digest);
}

function cleanupPasswordResetTokens_(tokens) {
  var nowMillis = new Date().getTime();
  var changed = false;

  ensureArray_(tokens).forEach(function(record) {
    normalizePasswordResetTokenRecord_(record);
    if (record.Status === 'active' && record.Expires_At_Millis > 0 && record.Expires_At_Millis <= nowMillis) {
      record.Status = 'expired';
      changed = true;
    }
  });

  return changed;
}

function findActivePasswordResetRecord_(tokens, rawToken) {
  var tokenHash = hashResetToken_(rawToken);
  return ensureArray_(tokens).find(function(record) {
    normalizePasswordResetTokenRecord_(record);
    return record.Token_Hash === tokenHash && record.Status === 'active';
  }) || null;
}

function markPasswordResetRecord_(record, status) {
  if (!record) return;

  var consumedAt = new Date();
  record.Status = String(status || 'used').trim().toLowerCase();
  record.Consumed_At_Millis = consumedAt.getTime();
  record.Consumed_At = formatDateTime_(consumedAt);
}

function invalidatePasswordResetTokensForUser_(tokens, userId, status, options) {
  var targetUserId = String(userId || '').trim();
  var resolvedStatus = String(status || 'replaced').trim().toLowerCase();
  var excludeResetId = options && options.excludeResetId ? String(options.excludeResetId) : '';
  var changed = false;

  ensureArray_(tokens).forEach(function(record) {
    normalizePasswordResetTokenRecord_(record);
    if (record.User_ID !== targetUserId) return;
    if (record.Status !== 'active') return;
    if (excludeResetId && record.Reset_ID === excludeResetId) return;
    markPasswordResetRecord_(record, resolvedStatus);
    changed = true;
  });

  return changed;
}

function maskEmail_(email) {
  var normalizedEmail = normalizeEmail_(email);
  var atIndex = normalizedEmail.indexOf('@');
  if (atIndex <= 0) {
    return normalizedEmail;
  }

  var localPart = normalizedEmail.slice(0, atIndex);
  var domainPart = normalizedEmail.slice(atIndex + 1);
  var maskedLocal = localPart.length <= 2
    ? localPart.charAt(0) + '*'
    : localPart.charAt(0) + '*'.repeat(localPart.length - 2) + localPart.charAt(localPart.length - 1);

  return maskedLocal + '@' + domainPart;
}

function buildPasswordResetUrl_(rawToken, baseUrl) {
  var resolvedBaseUrl = String(baseUrl || getConfig_().frontendBaseUrl || '').trim();
  if (!resolvedBaseUrl) {
    throw new Error('Missing FRONTEND_BASE_URL.');
  }

  var hashIndex = resolvedBaseUrl.indexOf('#');
  var hashPart = '';
  if (hashIndex >= 0) {
    hashPart = resolvedBaseUrl.slice(hashIndex);
    resolvedBaseUrl = resolvedBaseUrl.slice(0, hashIndex);
  }

  var separator = resolvedBaseUrl.indexOf('?') >= 0 ? '&' : '?';
  return resolvedBaseUrl + separator + 'mode=reset&token=' + encodeURIComponent(rawToken) + hashPart;
}

function sendPasswordResetEmail_(user, resetUrl, expiresAtText) {
  var subject = '【畢展形印組管理系統】密碼重設連結';
  var recipientName = String(user && user.Name ? user.Name : '同學').trim() || '同學';
  var plainText = [
    recipientName + ' 您好，',
    '',
    '我們收到了重設密碼的請求。請點擊以下連結設定新密碼：',
    resetUrl,
    '',
    '此連結有效至 ' + expiresAtText + '。',
    '若這不是您本人操作，請直接忽略此信。',
    '',
    '畢展形印組管理系統'
  ].join('\n');
  var htmlBody = [
    '<div style="font-family:Arial,\'PingFang TC\',\'Microsoft JhengHei\',sans-serif;line-height:1.7;color:#1D1D1F;">',
    '<p>' + escapeHtml_(recipientName) + ' 您好，</p>',
    '<p>我們收到了重設密碼的請求。請點擊下方按鈕設定新密碼：</p>',
    '<p><a href="' + escapeHtml_(resetUrl) + '" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#0066CC;color:#FFFFFF;text-decoration:none;font-weight:700;">前往重設密碼</a></p>',
    '<p style="font-size:12px;color:#6E6E73;">若按鈕無法點擊，也可以複製這段連結到瀏覽器開啟：</p>',
    '<p style="font-size:12px;word-break:break-all;color:#0066CC;">' + escapeHtml_(resetUrl) + '</p>',
    '<p style="font-size:12px;color:#6E6E73;">此連結有效至 ' + escapeHtml_(expiresAtText) + '。若這不是您本人操作，請直接忽略此信。</p>',
    '<p style="margin-top:24px;">畢展形印組管理系統</p>',
    '</div>'
  ].join('');

  sendSystemEmail_(String(user.Email || '').trim(), subject, plainText, htmlBody);
}

function sendSystemEmail_(to, subject, textBody, htmlBody) {
  var config = getConfig_();
  var mailOptions = {
    name: config.mailSenderName || APP_DEFAULTS.mailSenderName,
    htmlBody: String(htmlBody || '')
  };

  if (config.mailReplyTo) {
    mailOptions.replyTo = config.mailReplyTo;
  }

  if (config.mailFromAlias) {
    throw new Error('目前部署版本未啟用 MAIL_FROM_ALIAS。請先清空 MAIL_FROM_ALIAS，或改用 MAIL_REPLY_TO。');
  }

  MailApp.sendEmail(String(to || '').trim(), String(subject || '').trim(), String(textBody || ''), mailOptions);
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function generateInviteCode_(teams) {
  var existingCodes = {};
  ensureArray_(teams).forEach(function(team) {
    existingCodes[String(team.Invite_Code || '').trim()] = true;
  });

  for (var i = 0; i < 50; i += 1) {
    var code = 'SHW-' + padNumber_(Math.floor(Math.random() * 10000), 4);
    if (!existingCodes[code]) {
      return code;
    }
  }

  throw new Error('無法建立唯一邀請碼，請稍後再試。');
}

function isPasswordHash_(value) {
  return String(value || '').indexOf('sha256$') === 0;
}

function hashPassword_(password, salt) {
  var resolvedSalt = String(salt || Utilities.getUuid().replace(/-/g, ''));
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    resolvedSalt + '|' + String(password || ''),
    Utilities.Charset.UTF_8
  );

  return ['sha256', resolvedSalt, Utilities.base64EncodeWebSafe(digest)].join('$');
}

function verifyPassword_(inputPassword, storedPassword) {
  var rawStored = String(storedPassword || '');
  if (!rawStored) {
    return false;
  }

  if (!isPasswordHash_(rawStored)) {
    return rawStored === String(inputPassword || '');
  }

  var parts = rawStored.split('$');
  if (parts.length !== 3) {
    return false;
  }

  return hashPassword_(inputPassword, parts[1]) === rawStored;
}

function normalizeSearchText_(value) {
  return String(value || '').trim().toLowerCase();
}

function ensureArray_(value) {
  return Array.isArray(value) ? value : [];
}

function padNumber_(value, length) {
  var raw = String(value || 0);
  while (raw.length < length) {
    raw = '0' + raw;
  }
  return raw;
}

function cloneObject_(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function withLock_(callback) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse_(ok, data, error) {
  var payload = {
    ok: ok === true,
    data: ok === true ? data : null,
    error: ok === true ? null : {
      message: error && error.message ? error.message : String(error || 'Unknown error')
    },
    serverTime: Utilities.formatDate(new Date(), APP_DEFAULTS.timeZone, 'yyyy-MM-dd HH:mm:ss')
  };

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildDemoState_() {
  return normalizeState_({
    Config_Stages: [
      { Stage_ID: 'S01', Stage_Name: '第一次會審', Budget_Allocated: 150000, Is_Active: false },
      { Stage_ID: 'S02', Stage_Name: '第二次會審', Budget_Allocated: 200000, Is_Active: true },
      { Stage_ID: 'S03', Stage_Name: '第三次總會審', Budget_Allocated: 350000, Is_Active: false }
    ],
    Users: [
      { User_ID: 'U01', Email: 'boss@test.com', Password: '123', Name: '許安迪', Team_ID: 'T00', Role: 'SuperAdmin', Status: 'Active' },
      { User_ID: 'U02', Email: 'staff@test.com', Password: '123', Name: '林心美', Team_ID: 'T02', Role: 'Admin', Status: 'Active' },
      { User_ID: 'U03', Email: 'leader_a@test.com', Password: '123', Name: '王大明', Team_ID: 'T01', Role: 'Leader', Status: 'Active' },
      { User_ID: 'U04', Email: 'member_a@test.com', Password: '123', Name: '李小華', Team_ID: 'T01', Role: 'Member', Status: 'Active' },
      { User_ID: 'U05', Email: 'leader_b@test.com', Password: '123', Name: '張小芬', Team_ID: 'T02', Role: 'Leader', Status: 'Active' },
      { User_ID: 'U06', Email: 'invite_pending@test.com', Password: '', Name: '林待認證', Team_ID: 'T01', Role: 'Member', Status: 'Pending' }
    ],
    Teams: [
      { Team_ID: 'T00', Team_Name: '形印籌備組', Invite_Code: 'ADMINONLY' },
      { Team_ID: 'T01', Team_Name: 'A組_視覺傳達', Invite_Code: 'A-VIS-8241' },
      { Team_ID: 'T02', Team_Name: 'B組_數位多媒體', Invite_Code: 'B-DIG-3175' }
    ],
    Purchase_Items: [
      { Item_ID: 'P01', Stage_ID: 'S02', Item_Name: '大圖背板輸出', Vendor_Price: 8500, Quantity: 2, Created_At: '2026-06-18 09:20', Subtotal: 17000 },
      { Item_ID: 'P02', Stage_ID: 'S02', Item_Name: '精裝專刊印刷', Vendor_Price: 450, Quantity: 120, Created_At: '2026-06-24 14:05', Subtotal: 54000 },
      { Item_ID: 'P03', Stage_ID: 'S02', Item_Name: '導覽酷卡摺頁', Vendor_Price: 15, Quantity: 1000, Created_At: '2026-07-03 11:40', Subtotal: 15000 }
    ],
    Assignments: [
      {
        Assignment_ID: 'A01',
        Stage_ID: 'S02',
        Title: '第二次會審繳交項目｜主視覺定稿與文字說明',
        Body: '請各小組依照第二次會審要求，直接上傳主視覺定稿檔案，並附上 100 字內的說明文字。',
        Submission_Mode: 'file-text',
        Requirement_Text: '需直接上傳作業附件，並附上簡短說明文字。',
        Target_Mode: 'all',
        Target_Team_IDs: ['T01', 'T02'],
        Due_At: '2026-07-10 23:59',
        Created_At: '2026-07-02 18:00',
        Created_By_User_ID: 'U01',
        Status: '進行中',
        Allow_ReSubmit: true
      },
      {
        Assignment_ID: 'A02',
        Stage_ID: 'S02',
        Title: '繳交項目｜印刷前自我檢查表',
        Body: '請各組完成 Pre-flight Checklist，確認字體、色彩模式、出血與解析度都已處理完成後再繳交。',
        Submission_Mode: 'text',
        Requirement_Text: '請直接回覆檢查結果與自評說明文字即可。',
        Target_Mode: 'selected',
        Target_Team_IDs: ['T01'],
        Due_At: '2026-07-08 18:00',
        Created_At: '2026-07-03 09:00',
        Created_By_User_ID: 'U02',
        Status: '進行中',
        Allow_ReSubmit: true
      }
    ],
    Assignment_Submissions: [
      {
        Submission_ID: 'SUB01',
        Assignment_ID: 'A01',
        User_ID: 'U03',
        Team_ID: 'T01',
        Submission_No: 1,
        Submission_Mode: 'file-text',
        File_Name: '主視覺海報_定案V2.pdf',
        Google_Drive_URL: 'https://drive.google.com/open?id=mock_submission_001',
        Text_Content: '已完成 CMYK 與出血線修正，等待印刷前檢查。',
        Submitted_At: '2026-07-03 13:20',
        Updated_At: '2026-07-03 13:20',
        Status: '已繳交',
        Notes: ''
      }
    ],
    Files: [
      {
        File_ID: 'F01',
        Stage_ID: 'S02',
        Team_ID: 'T02',
        File_Name: '宣傳酷卡背面V3.ai',
        Google_Drive_URL: 'https://drive.google.com/open?id=mock_file_001',
        Upload_Time: '2026-07-02 10:15',
        Check_Status: '未審',
        Comment: '',
        Base_File_Name: '宣傳酷卡背面',
        File_Extension: '.ai',
        Version_No: 3,
        File_Group_Key: 'S02|T02|宣傳酷卡背面',
        Revision_Notes: '第二次修訂',
        Drive_File_ID: '',
        Drive_Folder_ID: ''
      },
      {
        File_ID: 'F02',
        Stage_ID: 'S02',
        Team_ID: 'T01',
        File_Name: '主視覺海報_定案.pdf',
        Google_Drive_URL: 'https://drive.google.com/open?id=mock_file_002',
        Upload_Time: '2026-07-01 14:30',
        Check_Status: '退件',
        Comment: '色彩模式格式為 RGB，請修改為 CMYK 後重新繳交。',
        Base_File_Name: '主視覺海報_定案',
        File_Extension: '.pdf',
        Version_No: 1,
        File_Group_Key: 'S02|T01|主視覺海報_定案',
        Revision_Notes: '第一次繳交',
        Drive_File_ID: '',
        Drive_Folder_ID: ''
      }
    ],
    Calendar_Events: [],
    Work_Items: [],
    Recycle_Bin: [],
    Notifications: [
      {
        Notification_ID: 'N01',
        User_ID: 'U01',
        Type: 'file-upload',
        Title: 'B組上傳新檔案',
        Message: '「宣傳酷卡背面V3.ai」已送交第二次會審，請前往繳交專區查看。',
        Created_At: '2026-07-02 10:15',
        Read: false,
        Tab: 'files',
        Ref_Type: 'file',
        Ref_ID: 'F01',
        Priority: 'normal'
      },
      {
        Notification_ID: 'N02',
        User_ID: 'U02',
        Type: 'file-upload',
        Title: 'B組上傳新檔案',
        Message: '「宣傳酷卡背面V3.ai」已送交第二次會審，請前往繳交專區查看。',
        Created_At: '2026-07-02 10:15',
        Read: false,
        Tab: 'files',
        Ref_Type: 'file',
        Ref_ID: 'F01',
        Priority: 'normal'
      },
      {
        Notification_ID: 'N03',
        User_ID: 'U03',
        Type: 'file-rejected',
        Title: 'A組檔案退件',
        Message: '「主視覺海報_定案.pdf」已退件，請依審核意見修正為 CMYK 後重新繳交。',
        Created_At: '2026-07-01 14:35',
        Read: false,
        Tab: 'files',
        Ref_Type: 'file',
        Ref_ID: 'F02',
        Priority: 'high'
      },
      {
        Notification_ID: 'N04',
        User_ID: 'U04',
        Type: 'file-rejected',
        Title: 'A組檔案退件',
        Message: '「主視覺海報_定案.pdf」已退件，請依審核意見修正為 CMYK 後重新繳交。',
        Created_At: '2026-07-01 14:35',
        Read: false,
        Tab: 'files',
        Ref_Type: 'file',
        Ref_ID: 'F02',
        Priority: 'high'
      },
      {
        Notification_ID: 'N05',
        User_ID: 'U03',
        Type: 'assignment-post',
        Title: '新繳交項目：主視覺定稿與文字說明',
        Message: '「第二次會審繳交項目｜主視覺定稿與文字說明」已發布，請前往繳交專區查看與繳交。',
        Created_At: '2026-07-02 18:00',
        Read: false,
        Tab: 'files',
        Ref_Type: 'assignment',
        Ref_ID: 'A01',
        Priority: 'normal'
      },
      {
        Notification_ID: 'N06',
        User_ID: 'U04',
        Type: 'assignment-post',
        Title: '新繳交項目：主視覺定稿與文字說明',
        Message: '「第二次會審繳交項目｜主視覺定稿與文字說明」已發布，請前往繳交專區查看與繳交。',
        Created_At: '2026-07-02 18:00',
        Read: false,
        Tab: 'files',
        Ref_Type: 'assignment',
        Ref_ID: 'A01',
        Priority: 'normal'
      }
    ],
    Meta: {
      NotificationSeeded: true,
      AssignmentReminderSettings: {
        enabled: true,
        offsetsHours: [72, 24, 6],
        sendEmail: true,
        sendSiteNotifications: true,
        escalationEnabled: true,
        leaderEscalationHours: 24,
        shapePrintEscalationHours: 6
      },
      AssignmentReminderLog: {}
    }
  });
}
