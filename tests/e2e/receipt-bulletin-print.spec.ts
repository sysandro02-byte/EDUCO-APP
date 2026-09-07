import { expect, test, type Page } from '@playwright/test';

const currentUser = {
  id: 9001,
  uid: 'e2e-promoter-uid',
  name: 'Promoteur E2E',
  email: 'promoteur.e2e@educo.test',
  role: 'Promoteur',
  schoolId: 777,
  status: 'active',
};

const cashierUser = {
  ...currentUser,
  id: 9002,
  uid: 'e2e-cashier-uid',
  name: 'Caissière E2E',
  email: 'caissiere.e2e@educo.test',
  role: 'Caissière',
};

const rafUser = {
  ...currentUser,
  id: 9003,
  uid: 'e2e-raf-uid',
  name: 'RAF E2E',
  email: 'raf.e2e@educo.test',
  role: 'Responsable des finances',
};

const schoolSettings = {
  id: 777,
  name: 'École E2E EDUCO',
  slogan: 'Former, suivre, réussir',
  address: 'Brazzaville, Congo',
  contact: '+242 06 000 0000',
  phone: '+242 06 000 0000',
  email: 'contact@educo.test',
  currency: 'FCFA',
  currentYear: '2026 - 2027',
};

const e2eStudent = {
  id: 9100,
  uid: 'e2e-student-uid',
  name: 'Élève Reçu Bulletin E2E',
  email: 'eleve.recu.bulletin@educo.test',
  role: 'Élève',
  schoolId: 777,
  status: 'Actif',
  studentId: 'MAT-E2E-001',
  class: 'CM2 A',
  dob: '2015-04-12',
  guardian: 'Parent E2E',
  contact: '+242 06 111 2222',
  address: 'Quartier E2E',
};

const offlineFixture = {
  users: [currentUser, cashierUser, rafUser, e2eStudent],
  payments: [
    {
      id: 9100,
      studentId: e2eStudent.studentId,
      name: e2eStudent.name,
      class: e2eStudent.class,
      totalFees: 120_000,
      amountPaid: 75_000,
      baseTuition: 120_000,
      isLargeFamily: false,
      siblings: '',
    },
  ],
  personnel: [],
  transactions: [
    {
      id: 'TXN-E2E-RECEIPT',
      description: `Frais de scolarité / mensuels - ${e2eStudent.name} (${e2eStudent.class})`,
      type: 'Revenu',
      amount: 75_000,
      date: new Date('2026-08-25T08:00:00.000Z').toISOString(),
      status: 'Approuvé',
      category: 'Scolarité',
      paymentMethod: 'Espèce',
    },
  ],
  budget: { total: 75_000, categories: [] },
  topClasses: [],
  notifications: [],
  messages: [],
  academicYear: { name: '2026 - 2027', startDate: '2026-09-01', endDate: '2027-07-31' },
  classes: [{ id: 501, name: 'CM2 A', level: 'Primaire', capacity: 35, schoolId: 777 }],
  fees: [{ id: 601, class: 'CM2 A', name: 'Scolarité CM2 A', amount: 120_000, type: 'Scolarité', schoolId: 777 }],
  subjects: [{ id: 701, name: 'Mathématiques', coefficient: 4, teacherIds: [9001], schoolId: 777 }],
  grades: [
    {
      id: 'GRADE-E2E-1',
      studentId: 9100,
      classId: 501,
      subject: 'Mathématiques',
      assignment: 'Interrogation E2E',
      score: 16,
      studentName: e2eStudent.name,
    },
  ],
  attendance: [],
  activityLog: [],
  schoolSettings,
  messageTemplates: [],
  cashierSettings: {
    permissions: {
      allowRegistration: true,
      allowStudentPayment: true,
      allowGeneralExpense: true,
      allowSalaryPayment: true,
    },
    limits: {
      maxDailyActions: 0,
      maxUnitRevenue: 0,
      maxUnitExpense: 0,
    },
  },
  rafSettings: { alerts: { debtThresholdEnabled: false, debtThresholdAmount: 0, approvalThresholdAmount: 50_000 } },
  communicationSettings: {},
  timetable: [],
  homeworkDiary: [],
  reportCardComments: [
    {
      id: 'RC-E2E-1',
      studentId: 9100,
      period: 'Trimestre 1',
      year: '2026 - 2027',
      generalAppreciation: 'Très bon trimestre, élève sérieux et régulier.',
      subjectComments: [{ subject: 'Mathématiques', comment: 'Très bonne maîtrise.' }],
    },
  ],
  financialEvents: [],
  updatedAt: new Date().toISOString(),
};

async function installE2EState(page: Page, user = currentUser) {
  await page.addInitScript(({ fixture, user }) => {
    sessionStorage.setItem('otpVerified', 'true');
    sessionStorage.setItem('EDUCO_SESSION_ACTIVE', 'true');
    localStorage.setItem('EDUCO_CURRENT_USER', JSON.stringify(user));
    localStorage.setItem('EDUCO_USER_TOKEN', user.uid);
    localStorage.setItem('educo_offline_app_data_v1', JSON.stringify(fixture));

    const printCalls: Array<{ title: string; html: string }> = [];
    let openedHtml = '';

    Object.defineProperty(window, '__educoPrintCalls', {
      value: printCalls,
      configurable: true,
    });

    window.open = (() => ({
      document: {
        write: (html: string) => {
          openedHtml += html;
        },
        close: () => undefined,
      },
      focus: () => undefined,
      print: () => {
        printCalls.push({ title: document.title, html: openedHtml });
      },
      close: () => {
        openedHtml = '';
      },
    })) as typeof window.open;
  }, { fixture: offlineFixture, user });

  await page.route('**/api/db/status**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ connected: true, message: 'Base de données Supabase connectée' }),
    });
  });

  await page.route('**/api/db/init-seed**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'Seed ignored for isolated E2E fixture.' }),
    });
  });

  await page.route('**/api/subscriptions/current**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        isActive: true,
        isPreSubscription: false,
        planType: 'standard',
        isAiEnabled: false,
        daysRemaining: 365,
        schoolIdentifier: 'EDUCO-SCH-E2E',
        schoolName: schoolSettings.name,
      }),
    });
  });

  await page.route('**/api/admin/export-data**', async route => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        scope: 'school',
        schools: [schoolSettings],
        users: offlineFixture.users,
        students: [e2eStudent],
        personnel: [],
        classes: offlineFixture.classes,
        payments: offlineFixture.payments,
        transactions: offlineFixture.transactions,
        attendance: [],
        fees: offlineFixture.fees,
        grades: offlineFixture.grades,
        notifications: [],
      }),
    });
  });

  await page.route('**/api/users**', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as any;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...body, id: Date.now(), schoolId: 777, status: 'Actif' }) });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(offlineFixture.users) });
  });

  await page.route('**/api/payments**', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as any;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: Date.now(), ...body, status: 'paid' }) });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(offlineFixture.payments) });
  });

  await page.route('**/api/transactions**', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as any;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: Date.now(), ...body }) });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(offlineFixture.transactions) });
  });

  await page.route('**/api/personnel**', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(offlineFixture.personnel) });
  });

  await page.route('**/api/classes**', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(offlineFixture.classes) });
  });

  await page.route('**/api/fees**', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(offlineFixture.fees) });
  });

  await page.route('**/api/grades**', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(offlineFixture.grades) });
  });

  await page.route('**/api/budget**', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(offlineFixture.budget) });
  });

  await page.route('**/api/cashier-reports**', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, reports: [] }) });
  });

  await page.route('**/api/activity-logs**', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });
}

async function openCashierPaymentForm(page: Page) {
  await page.locator('button').filter({ hasText: 'Paiement Écolage' }).click();
  await page.locator('button').filter({ hasText: /frais d'écolage|réinscription/i }).click();
  await expect(page.getByRole('heading', { name: /guichet de paiement/i })).toBeVisible();
}

async function selectExistingStudent(page: Page) {
  await page.locator('select').filter({ hasText: e2eStudent.name }).selectOption(String(e2eStudent.id));
}

async function fillVisibleAmount(page: Page, amount: string) {
  await page.locator('form input[type="number"]').filter({ visible: true }).first().fill(amount);
}

async function waitForSchoolOperationalData(page: Page) {
  await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/users') && response.request().method() === 'GET'),
    page.waitForResponse(response => response.url().includes('/api/payments') && response.request().method() === 'GET'),
    page.waitForResponse(response => response.url().includes('/api/classes') && response.request().method() === 'GET'),
    page.waitForResponse(response => response.url().includes('/api/fees') && response.request().method() === 'GET'),
  ]);
}

for (const account of [cashierUser, rafUser]) {
  test(`inscription, réinscription, paiement et impression ticket avec ${account.role}`, async ({ page }) => {
    await installE2EState(page, account);
    const operationalDataReady = waitForSchoolOperationalData(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await operationalDataReady;

    await expect(page.getByText(account.name).first()).toBeVisible();
    await expect(page.getByText('Paiement Écolage', { exact: true })).toBeVisible();

    await openCashierPaymentForm(page);
    await page.getByRole('button', { name: /frais mensuels/i }).click();
    await selectExistingStudent(page);
    await fillVisibleAmount(page, '10000');
    await page.getByPlaceholder('Mentions particulières sur le reçu...').fill(`Test paiement ${account.role}`);
    await page.getByRole('button', { name: /aperçu du reçu avant impression/i }).click();
    await page.getByRole('button', { name: /valider.*imprimer le reçu officiel/i }).click();
    await expect(page.getByText(/ticket n°/i).first()).toBeVisible();
    await page.getByRole('button', { name: /imprimer directement/i }).click();

    await expect
      .poll(async () => page.evaluate(() => (window as any).__educoPrintCalls?.length || 0))
      .toBeGreaterThan(0);
    const paymentPrintHtml = await page.evaluate(() => (window as any).__educoPrintCalls.at(-1)?.html || '');
    expect(paymentPrintHtml).toContain('Ticket N°');
    expect(paymentPrintHtml).toContain(e2eStudent.name);
    expect(paymentPrintHtml).toContain('10 000');

    await page.getByRole('button', { name: /^fermer$/i }).click();
    await openCashierPaymentForm(page);
    await page.getByRole('button', { name: /réinscription/i }).click();
    await selectExistingStudent(page);
    await fillVisibleAmount(page, '12000');
    await page.getByRole('button', { name: /aperçu du reçu avant impression/i }).click();
    await page.getByRole('button', { name: /valider.*imprimer le reçu officiel/i }).click();
    await expect(page.getByText(/ticket n°/i).first()).toBeVisible();
    await page.getByRole('button', { name: /imprimer directement/i }).click();

    await expect
      .poll(async () => page.evaluate(() => (window as any).__educoPrintCalls?.length || 0))
      .toBeGreaterThan(1);
    const renewalPrintHtml = await page.evaluate(() => (window as any).__educoPrintCalls.at(-1)?.html || '');
    expect(renewalPrintHtml).toContain('Ticket N°');
    expect(renewalPrintHtml).toContain('réinscription');

    await page.getByRole('button', { name: /^fermer$/i }).click();
    await openCashierPaymentForm(page);
    await page.getByRole('button', { name: /inscription \(nouveau\)/i }).click();
    await page.getByPlaceholder('Ex: Kouamé K. Emmanuel').fill(`Inscription ${account.role} E2E`);
    await page.locator('label:has-text("Classe d\'Affectation")').locator('..').locator('select').selectOption('CM2 A');
    await page.getByPlaceholder('+242 06 XXX XX XX').fill('+242 06 222 3333');
    await page.getByPlaceholder('Ex: M. & Mme Kouassi').fill('Parent Inscription E2E');
    await page.getByPlaceholder("Montant d'inscription...").fill('15000');
    await page.getByRole('button', { name: /aperçu du reçu avant impression/i }).click();
    await page.getByRole('button', { name: /valider.*imprimer le reçu officiel/i }).click();
    await expect(page.getByText(/ticket n°/i).first()).toBeVisible();
    await page.getByRole('button', { name: /imprimer directement/i }).click();

    await expect
      .poll(async () => page.evaluate(() => (window as any).__educoPrintCalls?.length || 0))
      .toBeGreaterThan(2);
    const registrationPrintHtml = await page.evaluate(() => (window as any).__educoPrintCalls.at(-1)?.html || '');
    expect(registrationPrintHtml).toContain('Ticket N°');
    expect(registrationPrintHtml).toContain(`Inscription ${account.role} E2E`);
    expect(registrationPrintHtml).toContain('Inscription');
  });
}

test('imprime un reçu et un bulletin depuis les vrais écrans EDUCO', async ({ page }) => {
  await installE2EState(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText(currentUser.name).first()).toBeVisible();

  await page.getByText('Abonnement & Licence', { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: /gestion de l'abonnement & licence/i })).toBeVisible();
  await expect(page.getByText('EDUCO-SCH-E2E')).toBeVisible();
  await expect(page.getByRole('button', { name: /demander un renouvellement/i })).toBeEnabled();
  await page.getByRole('button', { name: /^fermer$/i }).click();
  await expect(page.getByRole('heading', { name: 'Tableau de bord', exact: true })).toBeVisible();

  await page.getByText('Paiements', { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: /gestion des paiements/i })).toBeVisible();
  await expect(page.getByText(e2eStudent.name).first()).toBeVisible();

  await page.getByRole('button', { name: /enregistrer un paiement/i }).click();
  await page.getByRole('button', { name: /inscription/i }).click();
  await page.getByPlaceholder('Ex: Kouamé K. Emmanuel').fill('Nouvel Élève Ticket E2E');
  await page.locator('label:has-text("Classe d\'Affectation")').locator('..').locator('select').selectOption('CM2 A');
  await page.getByPlaceholder('+242 06 XXX XX XX').fill('+242 06 222 3333');
  await page.getByPlaceholder('Ex: M. & Mme Kouassi').fill('Parent Ticket E2E');
  await page.getByPlaceholder("Montant d'inscription...").fill('15000');
  await page.getByPlaceholder('Mentions particulières sur le reçu...').fill('Test inscription et impression ticket');
  await page.getByRole('button', { name: /aperçu du reçu avant impression/i }).click();
  await expect(page.getByText(/Nouvel Élève Ticket E2E/).first()).toBeVisible();
  await page.getByRole('button', { name: /valider.*imprimer le reçu officiel/i }).click();
  await expect(page.getByText(/ticket n°/i).first()).toBeVisible();
  await page.getByRole('button', { name: /imprimer directement/i }).click();

  await expect
    .poll(async () => page.evaluate(() => (window as any).__educoPrintCalls?.length || 0))
    .toBeGreaterThan(0);
  const inscriptionPrintHtml = await page.evaluate(() => (window as any).__educoPrintCalls.at(-1)?.html || '');
  expect(inscriptionPrintHtml).toContain('Ticket N°');
  expect(inscriptionPrintHtml).toContain('Nouvel Élève Ticket E2E');
  expect(inscriptionPrintHtml).toContain('Inscription');

  await page.getByRole('button', { name: /^fermer$/i }).click();
  await page.getByRole('button', { name: /aperçu.*reçu|reçu/i }).first().click();
  await expect(page.getByText(/ticket n°/i).first()).toBeVisible();
  await page.getByRole('button', { name: /imprimer directement/i }).click();

  await expect
    .poll(async () => page.evaluate(() => (window as any).__educoPrintCalls?.length || 0))
    .toBeGreaterThan(1);
  const receiptPrintHtml = await page.evaluate(() => (window as any).__educoPrintCalls.at(-1)?.html || '');
  expect(receiptPrintHtml).toContain('Ticket N°');
  expect(receiptPrintHtml).toContain('Élève Reçu Bulletin E2E');

  await page.getByRole('button', { name: /^fermer$/i }).click();
  await page.getByText('Notes', { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: /gestion des notes/i })).toBeVisible();
  await expect(page.getByText(e2eStudent.name).first()).toBeVisible();

  await page.getByRole('button', { name: /gérer les appréciations/i }).click();
  await page.getByRole('button', { name: /générer le bulletin/i }).click();
  await expect(page.getByText(/Bulletin de Notes/i).first()).toBeVisible();
  await expect(page.getByText(e2eStudent.name).first()).toBeVisible();

  await page.getByRole('button', { name: /imprimer le bulletin officiel/i }).click();
  await expect
    .poll(async () => page.evaluate(() => (window as any).__educoPrintCalls?.length || 0))
    .toBeGreaterThan(1);
  const bulletinPrintHtml = await page.evaluate(() => (window as any).__educoPrintCalls.at(-1)?.html || '');
  expect(bulletinPrintHtml).toContain('Bulletin de Notes');
  expect(bulletinPrintHtml).toContain('Élève Reçu Bulletin E2E');
  expect(bulletinPrintHtml).toContain('Mathématiques');
});
