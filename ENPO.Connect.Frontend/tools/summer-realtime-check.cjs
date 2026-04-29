const signalR = require('@microsoft/signalr');
const crypto = require('node:crypto');

const API_BASE = 'https://test.egyptpost.gov.eg/Applications/Connect_API';
const HUB_URL = 'https://test.egyptpost.gov.eg/Applications/GlobalHubSync/ChatHub';
const JWT_SECRET = 'superSecretKey@345superSecretKey@345superSecretKey@345superSecretKey@345';
const JWT_ISS = 'https://localhost:44398';
const JWT_AUD = 'http://localhost:4200';

const ownerUserId = '970001';
const adminUserId = '970002';

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createToken(userId, userEmail) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    UserId: userId,
    UserEmail: userEmail,
    unique_name: userId,
    nameid: userId,
    nbf: now - 60,
    exp: now + 3600,
    iat: now,
    iss: JWT_ISS,
    aud: JWT_AUD
  };

  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const body = `${h}.${p}`;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${body}.${sig}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeText(notification) {
  return String(notification?.notification ?? notification?.Notification ?? '').trim();
}

async function apiGet(path, token) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: response.status, body: json };
}

async function apiPostForm(path, token, form) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: response.status, body: json };
}

async function createSignalRClient(label, token, groups = []) {
  const notifications = [];
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, {
      accessTokenFactory: () => token
    })
    .configureLogging(signalR.LogLevel.Warning)
    .withAutomaticReconnect()
    .build();

  connection.on('ReciveNotification', payload => {
    notifications.push(payload);
    const txt = normalizeText(payload);
    console.log(`[${label}] notification: ${txt}`);
  });

  await connection.start();
  for (const group of groups) {
    await connection.invoke('AddUserTogroup', group);
  }

  return {
    notifications,
    async addGroup(group) {
      await connection.invoke('AddUserTogroup', group);
    },
    clear() {
      notifications.length = 0;
    },
    stop() {
      return connection.stop();
    }
  };
}

function buildCreateRequestForm(userId, suffix) {
  const form = new FormData();
  form.append('MessageId', '0');
  form.append('RequestRef', `AUTOTEST-SUMMER-${suffix}`);
  form.append('Subject', 'Autotest Summer Request');
  form.append('Description', `Autotest create request ${suffix}`);
  form.append('CreatedBy', userId);
  form.append('AssignedSectorId', '');
  form.append('UnitId', '0');
  form.append('CurrentResponsibleSectorId', '');
  form.append('Type', '0');
  form.append('CategoryCd', '147');

  const fields = [
    ['Emp_Id', userId],
    ['SummerCamp', `TST_W_${suffix}`],
    ['FamilyCount', '5'],
    ['Over_Count', '0'],
    ['SummerSeasonYear', '2026'],
    ['Emp_Name', `Test Owner ${userId}`],
    ['NationalId', `2990101${String(suffix).padStart(7, '0')}`.slice(0, 14)],
    ['PhoneNumber', `010${String(suffix).padStart(8, '0')}`.slice(0, 11)]
  ];

  fields.forEach((pair, index) => {
    form.append(`Fields[${index}].fildSql`, '0');
    form.append(`Fields[${index}].fildRelted`, '0');
    form.append(`Fields[${index}].fildKind`, pair[0]);
    form.append(`Fields[${index}].fildTxt`, pair[1]);
    form.append(`Fields[${index}].instanceGroupId`, '1');
  });

  return form;
}

function hasRequestEvent(notifications, messageId, action) {
  const needle = `SUMMER_REQUEST_UPDATED|${messageId}|${action}`;
  return notifications.some(item => normalizeText(item).includes(needle));
}

async function main() {
  const ownerToken = createToken(ownerUserId, `${ownerUserId}@test.local`);
  const adminToken = createToken(adminUserId, `${adminUserId}@test.local`);

  const ownerClient = await createSignalRClient('OWNER', ownerToken, ['CONNECT', 'CONNECT - TEST']);
  const adminClient = await createSignalRClient('ADMIN', adminToken, ['CONNECT', 'CONNECT - TEST']);

  try {
    const discoveryForm = buildCreateRequestForm(ownerUserId, Date.now() % 100000);
    const discoveryCreate = await apiPostForm('/api/DynamicForm/CreateRequest', ownerToken, discoveryForm);
    if (!discoveryCreate.body?.isSuccess) {
      throw new Error(`Discovery create failed: ${JSON.stringify(discoveryCreate.body)}`);
    }

    const assignedSector = String(discoveryCreate.body?.data?.assignedSectorId ?? '').trim();
    if (!assignedSector) {
      throw new Error('AssignedSectorId is empty; cannot validate admin-group targeting.');
    }

    await adminClient.addGroup(assignedSector);

    ownerClient.clear();
    adminClient.clear();

    const testSuffix = (Date.now() % 100000) + 1;
    const createForm = buildCreateRequestForm(ownerUserId, testSuffix);
    const createRes = await apiPostForm('/api/DynamicForm/CreateRequest', ownerToken, createForm);
    if (!createRes.body?.isSuccess) {
      throw new Error(`Test create failed: ${JSON.stringify(createRes.body)}`);
    }

    const messageId = Number(createRes.body?.data?.messageId ?? 0);
    await sleep(2500);

    const createToAdmin = hasRequestEvent(adminClient.notifications, messageId, 'CREATE');
    const createToOwner = hasRequestEvent(ownerClient.notifications, messageId, 'CREATE');

    ownerClient.clear();
    adminClient.clear();

    const actionForm = new FormData();
    actionForm.append('MessageId', String(messageId));
    actionForm.append('ActionCode', 'COMMENT');
    actionForm.append('Comment', 'AUTOTEST ADMIN COMMENT');
    actionForm.append('Force', 'false');

    const adminActionRes = await apiPostForm('/api/SummerWorkflow/ExecuteAdminAction', adminToken, actionForm);
    if (!adminActionRes.body?.isSuccess) {
      throw new Error(`Admin action failed: ${JSON.stringify(adminActionRes.body)}`);
    }

    await sleep(2500);

    const commentToOwner = hasRequestEvent(ownerClient.notifications, messageId, 'COMMENT');
    const commentToAdmin = hasRequestEvent(adminClient.notifications, messageId, 'COMMENT');

    const ownerRow = await apiGet(`/api/SummerWorkflow/GetMyRequests?seasonYear=2026&messageId=${messageId}`, ownerToken);
    const ownerSummary = (ownerRow.body?.data ?? [])[0] ?? null;

    console.log('RESULT_JSON_START');
    console.log(JSON.stringify({
      messageId,
      assignedSector,
      createNotification: {
        toAdmin: createToAdmin,
        toOwner: createToOwner,
        adminNotifications: adminClient.notifications.map(normalizeText),
        ownerNotifications: ownerClient.notifications.map(normalizeText)
      },
      adminCommentNotification: {
        toOwner: commentToOwner,
        toAdmin: commentToAdmin,
        adminNotifications: adminClient.notifications.map(normalizeText),
        ownerNotifications: ownerClient.notifications.map(normalizeText)
      },
      ownerSummaryAfterAdminComment: ownerSummary
    }, null, 2));
    console.log('RESULT_JSON_END');
  } finally {
    await Promise.allSettled([ownerClient.stop(), adminClient.stop()]);
  }
}

main().catch(err => {
  console.error('SCRIPT_ERROR', err?.stack || err?.message || err);
  process.exitCode = 1;
});
