(() => {
    'use strict';

    const endpoint = 'https://script.google.com/macros/s/AKfycbyfTfGZtJMc8tPEFDW2lqi_11bDQ7B8Pj_4jVBDArX13jYu9ZxomYoCU0SgMbDuqus/exec';
    const linkToken = location.hash.slice(1);
    const validToken = /^PCT_[a-f0-9]{32}\.[a-f0-9]{32}\.[A-Za-z0-9_-]{43}$/.test(linkToken);
    const field = id => document.getElementById(id);
    const screens = ['loading', 'unavailable', 'verify', 'overview', 'edit', 'confirm', 'received'];
    const dateFormatter = new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    const statusLabels = { pending: '等待形印組審核', returned: '需要補件', approved: '審核已通過' };
    let model = null;
    let guestGrant = '';
    let requestId = '';
    let expectedVersion = 0;
    let view = 'loading';
    let busy = false;

    function showScreen(name) {
        view = name;
        screens.forEach(screen => { field('screen-' + screen).hidden = name !== screen; });
        const inSteps = ['overview', 'edit', 'confirm'].includes(name) && model?.canSubmit;
        field('intake-steps').hidden = !inSteps;
        document.querySelectorAll('[data-step]').forEach(step => {
            if (step.dataset.step === name) step.setAttribute('aria-current', 'step');
            else step.removeAttribute('aria-current');
        });
        if (name !== 'loading') {
            const heading = field(name + '-title');
            heading?.focus({ preventScroll: true });
            if (heading?.getBoundingClientRect().top < 0) heading.scrollIntoView({ block: 'nearest' });
        }
    }

    function announce(message, isError = false) {
        const node = field('intake-feedback');
        node.textContent = message;
        node.dataset.error = String(isError);
        node.hidden = !message;
        if (isError && node.getBoundingClientRect().top < 0) node.scrollIntoView({ block: 'center' });
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

    function showInvalid(message, retry) {
        field('unavailable-note').textContent = message;
        field('retry-load').hidden = !retry;
        field('intake-title').textContent = '專刊收件';
        field('group-label').textContent = '116級 畢業製作 ・ 形印組';
        field('project-label').textContent = '小組專屬上傳頁，不需註冊帳號。';
        model = null;
        showScreen('unavailable');
    }

    function showIntake(data, keepEditing = false) {
        if (!data || typeof data.verified !== 'boolean' || typeof data.title !== 'string' || typeof data.groupNumber !== 'string') {
            throw new Error('無法確認這個收件連結，請保留此頁稍後重試。');
        }
        model = data;
        field('intake-title').textContent = data.title;
        field('group-label').textContent = '第 ' + data.groupNumber + ' 組 ・ 116級 畢業製作';
        field('project-label').textContent = data.members?.length
            ? '組員：' + data.members.join('、')
            : data.project || '小組專屬上傳頁，不需註冊帳號。';
        if (!data.verified) {
            showScreen('verify');
            return;
        }
        const latest = data.latest;
        const currentStatus = statusLabels[latest?.status];
        field('latest-summary').hidden = !latest && data.canSubmit;
        field('latest-status').textContent = latest?.status === 'returned' && !data.canSubmit ? '補件期限已過' : currentStatus || '收件已截止';
        field('latest-status').dataset.tone = latest?.status || '';
        field('latest-when').textContent = latest ? '第 ' + latest.version + ' 版 ・ ' + labelDate(latest.submittedAt) : '目前不再接受繳交';
        field('latest-note').textContent = latest?.note || '';
        field('latest-note').hidden = !latest?.note;
        field('overview-title').textContent = data.canSubmit ? latest?.status === 'returned' ? '依照意見補件' : '這次要交什麼？' : '收件規格';
        field('requirements').textContent = data.requirements || '';
        field('due-label').textContent = (latest?.status === 'returned' ? '補件期限：' : '初次繳交期限：') + labelDate(data.dueAt) + '（台灣時間）';
        field('start-intake').hidden = !data.canSubmit;
        field('start-intake').textContent = latest?.status === 'returned' ? '開始補件' : '開始填寫';
        field('text-fields').hidden = data.format === 'file';
        field('intake-text').required = data.format !== 'file';
        field('file-fields').hidden = data.format === 'text';
        field('edit-instructions').textContent = {
            both: '請填寫文字並選擇一個附件。', file: '請選擇一個要上傳的附件。', text: '這個項目只收文字，不需上傳檔案。'
        }[data.format] || '';
        if (keepEditing && data.canSubmit && requestId && expectedVersion === (latest?.version || 0)) {
            showConfirmation();
        } else showScreen('overview');
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
            showInvalid(error.message, error.code !== 'CATALOG_LINK_INVALID');
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
            announce(error.message, true);
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
            announce(error.message, true);
        } finally { lock(false); }
    }

    function getInputs() {
        const text = model.format === 'file' ? '' : field('intake-text').value.trim();
        const file = model.format === 'text' ? null : field('intake-file').files[0] || null;
        return { text, file };
    }

    function displaySize(bytes) {
        return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
    }

    function checkInputs(inputs) {
        const { file, text } = inputs;
        if (model.format !== 'file' && !text) throw new Error('請先填寫文字內容。');
        if (model.format !== 'text' && !file) throw new Error('請先選擇附件。');
        if (file && (!/\.(ai|pdf|psd|indd|jpe?g|png|tiff?|zip)$/i.test(file.name) ||
            file.name.length > 180 || file.size < 1 || file.size > model.maxFileBytes)) {
            throw new Error('附件格式或大小不符。請選擇支援的格式，最多 100 MB。');
        }
    }

    function showConfirmation() {
        const { text, file } = getInputs();
        field('confirm-file').textContent = file ? '附件：' + file.name + ' ・ ' + displaySize(file.size) : '';
        field('confirm-file').hidden = !file;
        field('confirm-text').textContent = text;
        field('confirm-text').hidden = !text;
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
        field('upload-progress').hidden = false;
        if (!total) {
            progress.removeAttribute('value');
            field('progress-label').textContent = '正在等待送出確認…';
        } else {
            const percent = Math.min(99, Math.floor(current * 100 / total));
            progress.value = percent;
            field('progress-label').textContent = percent + '% ・ 已確認 ' + (current ? displaySize(current) : '0 KB') + ' / ' + displaySize(total);
        }
    }

    async function sendIntake() {
        if (busy || !model?.verified || !model.canSubmit) return;
        const inputs = getInputs();
        const { text, file } = inputs;
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
            let result = await query('catalogGuestBegin', { requestId, expectedVersion, text,
                fileName: file?.name || '', fileSize: file?.size || 0 });
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
            requestId = '';
            field('progress-value').value = 100;
            field('intake-text').value = '';
            field('intake-file').value = '';
            field('file-selection').textContent = '尚未選擇檔案';
            field('receipt-label').textContent = '已確認收到第 ' + result.receipt.version + ' 版 ・ ' + labelDate(result.receipt.submittedAt);
            showScreen('received');
        } catch (error) {
            if (error.code === 'CATALOG_VERIFY_REQUIRED') {
                guestGrant = '';
                field('project-label').textContent = '小組專屬上傳頁，不需註冊帳號。';
                showScreen('verify');
                announce('信箱驗證已過期，請再驗證一次。已保留文字與檔案。', true);
            } else if (error.code === 'CATALOG_LINK_INVALID') {
                showInvalid(error.message, false);
            } else {
                field('check-latest').hidden = false;
                field('send-intake').textContent = '重試送出';
                field('progress-label').textContent = '尚未確認收件，請保留此頁。';
                announce(error.message, true);
            }
        } finally { lock(false); }
    }

    field('retry-load').addEventListener('click', loadIntake);
    field('request-code').addEventListener('click', requestCode);
    field('verify-form').addEventListener('submit', verifyCode);
    field('refresh-intake').addEventListener('click', loadIntake);
    field('check-latest').addEventListener('click', loadIntake);
    field('view-current').addEventListener('click', loadIntake);
    field('start-intake').addEventListener('click', () => {
        if (busy || !model?.canSubmit) return;
        if (requestId && expectedVersion !== (model.latest?.version || 0)) requestId = '';
        announce('');
        showScreen('edit');
    });
    field('intake-text').addEventListener('input', () => { requestId = ''; });
    field('intake-file').addEventListener('change', () => {
        requestId = '';
        const file = field('intake-file').files[0];
        field('file-selection').textContent = file ? file.name + ' ・ ' + displaySize(file.size) : '尚未選擇檔案';
    });
    field('details-form').addEventListener('submit', event => {
        event.preventDefault();
        if (busy || !model?.canSubmit) return;
        try {
            checkInputs(getInputs());
            announce('');
            showConfirmation();
        } catch (error) { announce(error.message, true); }
    });
    field('back-to-overview').addEventListener('click', () => { announce(''); showScreen('overview'); });
    field('back-to-edit').addEventListener('click', () => { announce(''); showScreen('edit'); });
    field('send-intake').addEventListener('click', sendIntake);

    loadIntake();
})();
