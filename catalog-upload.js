(() => {
    'use strict';

    const endpoint = 'https://script.google.com/macros/s/AKfycbyfTfGZtJMc8tPEFDW2lqi_11bDQ7B8Pj_4jVBDArX13jYu9ZxomYoCU0SgMbDuqus/exec';
    const linkToken = location.hash.slice(1);
    const validToken = /^PCT_[a-f0-9]{32}\.[a-f0-9]{32}\.[A-Za-z0-9_-]{43}$/.test(linkToken);
    const field = id => document.getElementById(id);
    const screens = ['loading', 'unavailable', 'verify', 'overview', 'edit', 'confirm', 'received'];
    const workflowSteps = ['overview', 'edit', 'confirm'];
    const defaultCaption = '小組專屬的繳交頁面，不需登入。';
    const dateFormatter = new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    const formats = {
        both: { label: '檔案與文字', hint: '請填寫文字並選擇一個附件。' },
        file: { label: '僅檔案', hint: '請選擇一個要上傳的附件。' },
        text: { label: '僅文字', hint: '這次只需填寫文字，不用上傳附件。' }
    };
    const legacyTextField = { id: 'legacy-text', label: '文字內容', minChars: 1, maxChars: 5000, legacy: true };
    const overviewStates = {
        open: { title: '這次要交什麼？', hint: '看完規格後，再填寫並確認要交的資料。' },
        pending: { title: '等待形印組審核', kicker: '已繳交', hint: '小組的資料已收到，可回到這裡查看審核結果。', icon: 'clock' },
        returned: { title: '需要補件', kicker: '補件通知', hint: '請依照審核意見修正，再送出完整資料。', icon: 'note', tone: 'warning' },
        overdue: { title: '補件期限已過', kicker: '補件已截止', hint: '現在無法補件，如有疑問請聯絡形印組負責人。', icon: 'clock', tone: 'warning' },
        approved: { title: '審核已通過', kicker: '審核結果', hint: '這份資料已完成審核，不需要再繳交。', icon: 'check', tone: 'success' },
        closed: { title: '收件已截止', kicker: '收件狀態', hint: '目前不再接受繳交，如有疑問請聯絡形印組負責人。', icon: 'clock', tone: 'warning' }
    };
    let model = null;
    let guestGrant = '';
    let serviceRequest = null;
    let requestId = '';
    let expectedVersion = 0;
    let view = 'loading';
    let busy = false;
    let textEntries = [];

    function showScreen(name) {
        view = name;
        screens.forEach(screen => { field('screen-' + screen).hidden = name !== screen; });
        const activeStep = workflowSteps.indexOf(name);
        const inSteps = activeStep >= 0 && model?.canSubmit;
        const steps = field('intake-steps');
        steps.hidden = !inSteps;
        steps.dataset.activeStep = name;
        steps.querySelectorAll('[data-step]').forEach((step, index) => {
            if (inSteps && index === activeStep) step.setAttribute('aria-current', 'step');
            else step.removeAttribute('aria-current');
            step.toggleAttribute('data-complete', inSteps && index < activeStep);
        });
        if (name !== 'loading') {
            const heading = field(name + '-title');
            heading?.focus({ preventScroll: true });
            revealIfOffscreen(heading);
        }
    }

    function revealIfOffscreen(node) {
        const rect = node?.getBoundingClientRect();
        if (rect && (rect.top < 0 || rect.bottom > window.innerHeight)) node.scrollIntoView({ block: 'nearest' });
    }

    function announce(message, isError = false) {
        const node = field('intake-feedback');
        node.textContent = message;
        node.dataset.error = String(isError);
        if (message && isError) revealIfOffscreen(node);
    }

    function lock(value) {
        busy = value;
        document.querySelectorAll('[data-lock]').forEach(control => { control.disabled = value; });
        field('screen-' + view).setAttribute('aria-busy', String(value));
        if (!value) screens.forEach(screen => field('screen-' + screen).setAttribute('aria-busy', 'false'));
    }

    async function query(action, payload = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), action === 'catalogGuestChunk' ? 120000 : 50000);
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action, ...payload, linkToken, guestGrant }),
                credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'follow', cache: 'no-store',
                signal: controller.signal
            });
            if (!response.ok) throw new Error('NETWORK');
            const body = await response.json();
            if (!body.ok) {
                const details = /^((?:CATALOG_)[A-Z_]+):\s*(.+)$/.exec(String(body.error?.message || ''));
                const error = new Error(details?.[2] || '尚未收到系統確認，請保留本頁稍後再試。');
                error.code = details?.[1] || 'UNCONFIRMED';
                throw error;
            }
            return body.data;
        } catch (error) {
            if (error.code && typeof error.code === 'string') throw error;
            throw new Error('雲端連線中斷或等候較久。請保留本頁並重試。');
        } finally {
            clearTimeout(timeout);
        }
    }

    function labelDate(value) {
        const date = new Date(value);
        return value && Number.isFinite(date.getTime()) ? dateFormatter.format(date) : '';
    }

    function showBrief(data) {
        field('intake-title').textContent = data?.title || '專刊收件';
        field('brief-context').hidden = !data;
        field('group-label').textContent = data ? '第 ' + data.groupNumber + ' 組' : '';
        const members = data?.verified && Array.isArray(data.members) ? data.members.filter(Boolean) : [];
        field('project-label').textContent = members.length ? '組員：' + members.join('、')
            : (data?.verified && data.project) || defaultCaption;
        field('brief-facts').hidden = !data?.verified;
        const state = data?.latest?.status;
        const due = data?.verified && state !== 'pending' && state !== 'approved' ? labelDate(data.dueAt) : '';
        field('deadline-fact').hidden = !due;
        field('due-kind').textContent = state === 'returned' ? '補件期限' : '繳交期限';
        field('due-label').textContent = due;
        field('due-label').dateTime = due ? data.dueAt : '';
        field('format-label').textContent = formats[data?.format]?.label || '';
    }

    function showInvalid(message, retry) {
        announce('');
        field('unavailable-note').textContent = message;
        field('retry-load').hidden = !retry;
        model = null;
        showBrief();
        showScreen('unavailable');
    }

    function showIntake(data, keepEditing = false) {
        if (!data || typeof data.verified !== 'boolean' || typeof data.title !== 'string' || typeof data.groupNumber !== 'string') {
            throw new Error('無法確認這個收件連結，請保留此頁稍後重試。');
        }
        model = data;
        showBrief(data);
        if (!data.verified) {
            showScreen('verify');
            return;
        }
        const latest = data.latest;
        const state = latest?.status === 'returned' && !data.canSubmit ? 'overdue' : latest?.status;
        const overview = data.serviceSelectionRequired
            ? { title: '先選擇排版人員', kicker: '繳交前', hint: '確認人選後，就可以開始填寫或上傳素材。' }
            : overviewStates[state] || overviewStates[data.canSubmit ? 'open' : 'closed'];
        field('overview-heading').dataset.tone = overview.tone || '';
        field('overview-icon').hidden = !overview.icon;
        field('overview-icon').querySelector('use').setAttribute('href', '#icon-' + (overview.icon || 'note'));
        field('overview-kicker').textContent = overview.kicker || '';
        field('overview-kicker').hidden = !overview.kicker;
        field('overview-title').textContent = overview.title;
        field('overview-hint').textContent = overview.hint;
        field('latest-summary').hidden = !latest;
        field('latest-summary').dataset.tone = overview.tone || '';
        field('latest-when').textContent = latest ? '已繳交第 ' + latest.version + ' 版｜' + labelDate(latest.submittedAt) : '';
        field('latest-note').textContent = latest?.note || '';
        field('review-note').hidden = !latest?.note;
        renderServiceRequest(data);
        field('requirements').textContent = data.requirements || '';
        field('requirements-block').hidden = !data.requirements || data.serviceSelectionRequired === true;
        field('requirements-block').open = data.canSubmit;
        field('start-intake').hidden = !data.canSubmit || data.serviceSelectionRequired === true;
        field('start-intake').textContent = latest?.status === 'returned' ? '開始補件' : '開始填寫';
        renderTextFields(data);
        field('file-fields').hidden = data.format === 'text';
        field('edit-instructions').textContent = formats[data.format]?.hint || '';
        if (keepEditing && data.canSubmit && !data.serviceSelectionRequired && requestId && expectedVersion === (latest?.version || 0)) {
            showConfirmation();
        } else showScreen('overview');
    }

    function renderServiceRequest(data) {
        const candidates = Array.isArray(data.serviceCandidates) ? data.serviceCandidates : [];
        const info = data.service;
        const states = { requested: '已登記人選，待組長確認', open: '等待形印組接案', making: '排版製作中',
            review: '成果審核中', returned: '排版修正中', completed: '排版已完成', cancelled: '排版案件已取消' };
        const status = states[info?.status] || '';
        const select = field('service-member');
        const selected = select.value;
        select.replaceChildren(new Option('請選擇一位組員', ''), ...candidates.map(person => new Option(person.name, person.id)));
        select.value = candidates.some(person => person.id === selected) ? selected : '';
        field('service-panel').hidden = !status && !candidates.length && !data.serviceSelectionUnavailable;
        field('service-status').hidden = !status;
        field('service-status').textContent = status + (info?.name && info.status !== 'cancelled' ? '｜' + info.name : '');
        field('service-request-form').hidden = !candidates.length;
        field('service-unavailable').hidden = !data.serviceSelectionUnavailable;
        field('service-request-hint').textContent = data.serviceSelectionRequired
            ? '人選會先登記，不用等組長回覆就能繳交。' : '選好人選後，由形印組長確認分工。';
        field('service-confirm').textContent = data.serviceSelectionRequired ? '確認人選' : '送出排版申請';
    }

    async function sendServiceRequest(event) {
        event.preventDefault();
        if (busy || !model?.verified) return;
        const memberId = field('service-member').value;
        if (!model.serviceCandidates?.some(person => person.id === memberId)) return;
        if (serviceRequest?.memberId !== memberId) serviceRequest = { memberId, requestId: newRequestId() };
        lock(true);
        announce('');
        try {
            const result = await query('catalogGuestRequestService', serviceRequest);
            if (!result?.intake?.verified || !result.intake.service?.status) throw new Error('尚未確認排版申請，請更新狀態或重試。');
            showIntake(result.intake);
            serviceRequest = null;
            announce(result.intake.canSubmit ? '已登記排版人選，可以開始繳交素材。' : '已登記排版人選，可回到這個連結查看進度。');
        } catch (error) {
            if (error.code === 'CATALOG_LINK_INVALID') showInvalid(error.message, false);
            else if (error.code === 'CATALOG_VERIFY_REQUIRED') {
                guestGrant = '';
                showBrief({ title: model.title, groupNumber: model.groupNumber });
                showScreen('verify');
                announce('信箱驗證已過期，請再驗證一次。', true);
            } else announce(error.message, true);
        } finally { lock(false); }
    }

    async function loadIntake() {
        if (busy) return;
        if (!validToken) {
            showInvalid('這個頁面需要完整的專屬連結。請向負責的形印組員索取。', false);
            return;
        }
        lock(true);
        announce('');
        try {
            showIntake(await query('catalogGuestDescribe'));
        } catch (error) {
            if (model?.verified && error.code !== 'CATALOG_LINK_INVALID') announce(error.message, true);
            else showInvalid(error.message, error.code !== 'CATALOG_LINK_INVALID');
        } finally { lock(false); }
    }

    async function requestCode() {
        if (busy) return;
        lock(true);
        announce('正在寄送驗證碼…');
        try {
            if (!(await query('catalogGuestSendCode'))?.sent) throw new Error('尚未確認寄送，請重新載入。');
            announce('驗證碼已寄出，10 分鐘內有效。也可以查看垃圾郵件。');
            field('verify-code').value = '';
        } catch (error) {
            if (error.code === 'CATALOG_LINK_INVALID') showInvalid(error.message, false);
            else announce(error.message, true);
        } finally {
            lock(false);
            if (view === 'verify') field('verify-code').focus();
        }
    }

    async function verifyCode(event) {
        event.preventDefault();
        if (busy) return;
        const code = field('verify-code').value;
        lock(true);
        announce('正在核對驗證碼…');
        try {
            const result = await query('catalogGuestVerify', { code });
            if (!/^[a-f0-9]{64}$/.test(result?.guestGrant || '') || result?.intake?.verified !== true) {
                throw new Error('尚未確認驗證，請重試。');
            }
            guestGrant = result.guestGrant;
            field('verify-code').value = '';
            announce('');
            showIntake(result.intake, true);
        } catch (error) {
            if (error.code === 'CATALOG_LINK_INVALID') showInvalid(error.message, false);
            else announce(error.message, true);
        } finally { lock(false); }
    }

    function contentNode(tag, className, text = '') {
        const node = document.createElement(tag);
        node.className = className;
        node.textContent = text;
        return node;
    }

    function renderTextFields(data) {
        const container = field('text-fields');
        const previous = new Map(textEntries.map(entry => [entry.spec.id, entry.input.value]));
        const specs = data.format === 'file' ? []
            : Array.isArray(data.textFields) && data.textFields.length ? data.textFields : [legacyTextField];
        const fragment = document.createDocumentFragment();
        textEntries = specs.map((spec, index) => {
            const wrapper = contentNode('div', 'field-stack');
            wrapper.dataset.textField = spec.id;
            const heading = contentNode('div', 'field-title');
            const label = contentNode('label', '', spec.label);
            const count = contentNode('span', 'meta text-count');
            const rule = contentNode('p', 'quiet field-rule', spec.minChars + ' 至 ' + spec.maxChars + ' 字（不含前後空白）');
            const input = contentNode('textarea', '');
            const error = contentNode('p', 'field-error');
            input.id = spec.legacy ? 'intake-text' : 'intake-field-' + index;
            count.id = spec.legacy ? 'text-count' : input.id + '-count';
            rule.id = input.id + '-rule';
            error.id = input.id + '-error';
            label.htmlFor = input.id;
            input.required = true;
            input.disabled = busy;
            input.dataset.lock = '';
            input.rows = spec.legacy || spec.maxChars > 160 ? 4 : 3;
            input.placeholder = spec.legacy ? '依照繳交規格填寫' : '請填寫' + spec.label;
            if (spec.legacy) input.maxLength = spec.maxChars;
            input.value = previous.get(spec.id) || '';
            rule.hidden = !!spec.legacy;
            input.setAttribute('aria-describedby', (spec.legacy ? '' : rule.id + ' ') + count.id + ' ' + error.id);
            heading.append(label, count);
            wrapper.append(heading, rule, input, error);
            fragment.append(wrapper);
            const entry = { spec, input, count, error, checked: false };
            updateTextCount(entry);
            input.addEventListener('input', () => {
                requestId = '';
                updateTextCount(entry);
            });
            return entry;
        });
        container.replaceChildren(fragment);
        container.hidden = !textEntries.length;
    }

    function textValue(entry) {
        return entry.input.value.replace(/\r\n?/g, '\n').trim();
    }

    function getInputs() {
        const values = textEntries.map(entry => ({ ...entry.spec, value: textValue(entry) }));
        const file = model.format === 'text' ? null : field('intake-file').files[0] || null;
        return { values, file };
    }

    function displaySize(bytes) {
        return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
    }

    function updateTextCount(entry) {
        const { spec, input, count, error } = entry;
        const value = textValue(entry);
        const length = spec.legacy ? value.length : Array.from(value).length;
        count.textContent = length.toLocaleString('zh-TW') + ' / ' + spec.maxChars.toLocaleString('zh-TW');
        const message = length > spec.maxChars ? '請縮短至 ' + spec.maxChars + ' 字以內。'
            : entry.checked && length < spec.minChars ? '請輸入至少 ' + spec.minChars + ' 字。' : '';
        error.textContent = message;
        error.hidden = !message;
        count.toggleAttribute('data-invalid', Boolean(message));
        if (message) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
        return message;
    }

    function updateFileSelection() {
        const file = field('intake-file').files[0];
        field('file-picker').toggleAttribute('data-selected', Boolean(file));
        field('file-selection').textContent = file ? file.name + '｜' + displaySize(file.size) : '尚未選擇檔案';
        field('file-button-label').textContent = file ? '更換檔案' : '選擇檔案';
    }

    function checkInputs(inputs) {
        const { file } = inputs;
        let firstError;
        textEntries.forEach(entry => {
            entry.checked = true;
            const message = updateTextCount(entry);
            if (message && !firstError) firstError = Object.assign(new Error('「' + entry.spec.label + '」' + message), { input: entry.input });
        });
        if (firstError) throw firstError;
        if (model.format !== 'text' && !file) throw new Error('請先選擇附件。');
        if (file && (!/\.(ai|pdf|psd|indd|jpe?g|png|tiff?|zip)$/i.test(file.name) ||
            file.name.length > 180 || file.size < 1 || file.size > model.maxFileBytes)) {
            throw new Error('附件格式或大小不符。請選擇支援的格式，最多 100 MB。');
        }
    }

    function showConfirmation() {
        const { values, file } = getInputs();
        field('confirm-file').textContent = file ? file.name + '｜' + displaySize(file.size) : '';
        field('confirm-file-row').hidden = !file;
        const summary = field('confirm-summary');
        summary.querySelectorAll('[data-confirm-answer]').forEach(row => row.remove());
        values.forEach(answer => {
            const row = contentNode('div', '');
            row.dataset.confirmAnswer = answer.id;
            const value = contentNode('dd', 'multiline', answer.value);
            if (answer.legacy) value.id = 'confirm-text';
            row.append(contentNode('dt', '', answer.label), value);
            summary.append(row);
        });
        field('upload-progress').hidden = true;
        field('check-latest').hidden = true;
        field('send-intake').textContent = requestId ? '重試送出' : '送出給形印組';
        showScreen('confirm');
    }

    function newRequestId() {
        return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    }

    function fileAsBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1]);
            reader.onerror = () => reject(new Error('無法讀取所選檔案，請重新選擇同一檔案再試。'));
            reader.readAsDataURL(blob);
        });
    }

    function updateProgress(current, total) {
        const progress = field('progress-value');
        const panel = field('upload-progress');
        panel.hidden = false;
        delete panel.dataset.tone;
        progress.hidden = false;
        field('progress-percent').hidden = !total;
        field('progress-title').textContent = total ? '正在上傳附件' : '正在送出資料';
        if (!total) {
            progress.removeAttribute('value');
            field('progress-label').textContent = '請保留本頁，直到出現收件回執。';
        } else {
            const percent = Math.min(99, Math.floor(current * 100 / total));
            progress.value = percent;
            field('progress-percent').textContent = percent + '%';
            field('progress-label').textContent = '已確認 ' + (current ? displaySize(current) : '0 KB') + ' / ' + displaySize(total) + '。請勿關閉本頁。';
        }
    }

    async function sendIntake() {
        if (busy || !model?.verified || !model.canSubmit) return;
        const inputs = getInputs();
        const { values, file } = inputs;
        if (!requestId) {
            requestId = newRequestId();
            expectedVersion = model.latest?.version || 0;
        }
        lock(true);
        announce('');
        field('check-latest').hidden = true;
        field('send-intake').textContent = '正在送出…';
        updateProgress(0, 0);
        try {
            checkInputs(inputs);
            const first = values[0];
            const textAnswers = first && !first.legacy ? values.map(({ id, value }) => ({ id, value })) : undefined;
            let result = await query('catalogGuestBegin', { requestId, expectedVersion, textAnswers,
                text: first?.legacy ? first.value : '', fileName: file?.name || '', fileSize: file?.size || 0 });
            if (file && result?.status === 'uploading') {
                const chunkSize = result.chunkSize;
                let next = result.nextByte;
                if (!Number.isSafeInteger(chunkSize) || chunkSize < 262144 || chunkSize > 8388608 ||
                    chunkSize % 262144 !== 0 || !Number.isSafeInteger(next) || next < 0 || next >= file.size ||
                    next % 262144 !== 0) throw new Error('尚未確認可接續的上傳進度，請重試。');
                updateProgress(next, file.size);
                while (result?.status === 'uploading') {
                    const end = Math.min(next + chunkSize, file.size);
                    const base64 = await fileAsBase64(file.slice(next, end));
                    result = await query('catalogGuestChunk', { requestId, start: next, end: end - 1, base64 });
                    if (result?.status === 'uploading') {
                        if (!Number.isSafeInteger(result.nextByte) || result.nextByte <= next || result.nextByte > end ||
                            result.nextByte >= file.size || result.nextByte % 262144 !== 0) {
                            throw new Error('此段沒有收到完整確認。請重試以接續已確認的進度。');
                        }
                        next = result.nextByte;
                        updateProgress(next, file.size);
                    }
                }
            }
            if (result?.status !== 'received' || result?.receipt?.version !== expectedVersion + 1 ||
                !labelDate(result.receipt.submittedAt) || result.intake?.verified !== true) {
                throw new Error('尚未收到收件確認，請勿關閉本頁，可按「重試送出」核對。');
            }
            model = result.intake;
            showBrief(model);
            requestId = '';
            field('progress-value').value = 100;
            textEntries.forEach(entry => {
                entry.input.value = '';
                entry.checked = false;
                updateTextCount(entry);
            });
            field('intake-file').value = '';
            updateFileSelection();
            field('receipt-label').textContent = '已確認收到第 ' + result.receipt.version + ' 版';
            field('receipt-time').dateTime = result.receipt.submittedAt;
            field('receipt-time').textContent = labelDate(result.receipt.submittedAt) + '（台灣時間）';
            showScreen('received');
        } catch (error) {
            if (error.code === 'CATALOG_VERIFY_REQUIRED') {
                guestGrant = '';
                showBrief({ title: model.title, groupNumber: model.groupNumber });
                model = null;
                showScreen('verify');
                announce('信箱驗證已過期，請再驗證一次。已保留文字與檔案。', true);
            } else if (error.code === 'CATALOG_LINK_INVALID') {
                showInvalid(error.message, false);
            } else {
                field('check-latest').hidden = false;
                field('send-intake').textContent = '重試送出';
                field('upload-progress').dataset.tone = 'warning';
                field('progress-title').textContent = '尚未確認收件';
                field('progress-value').hidden = !field('progress-value').hasAttribute('value');
                field('progress-label').textContent = '已保留填寫內容與附件，可重試送出。';
                announce(error.message, true);
            }
        } finally { lock(false); }
    }

    field('retry-load').addEventListener('click', loadIntake);
    field('request-code').addEventListener('click', requestCode);
    field('verify-form').addEventListener('submit', verifyCode);
    field('service-request-form').addEventListener('submit', sendServiceRequest);
    field('refresh-intake').addEventListener('click', loadIntake);
    field('check-latest').addEventListener('click', loadIntake);
    field('view-current').addEventListener('click', loadIntake);
    field('start-intake').addEventListener('click', () => {
        if (busy || !model?.canSubmit || model.serviceSelectionRequired) return;
        if (requestId && expectedVersion !== (model.latest?.version || 0)) requestId = '';
        announce('');
        showScreen('edit');
    });
    field('intake-file').addEventListener('change', () => {
        requestId = '';
        updateFileSelection();
    });
    field('details-form').addEventListener('submit', event => {
        event.preventDefault();
        if (busy || !model?.canSubmit) return;
        try {
            checkInputs(getInputs());
            announce('');
            showConfirmation();
        } catch (error) {
            announce(error.message, true);
            error.input?.focus();
        }
    });
    field('back-to-overview').addEventListener('click', () => { announce(''); showScreen('overview'); });
    field('back-to-edit').addEventListener('click', () => { announce(''); showScreen('edit'); });
    field('send-intake').addEventListener('click', sendIntake);

    loadIntake();
})();
