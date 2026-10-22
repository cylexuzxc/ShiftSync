const fs = require('fs');
const { chromium } = require('playwright');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const fmt = d => d.toISOString().slice(0, 10);
const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const validatePng = filePath => {
  const buffer = fs.readFileSync(filePath);
  assert(buffer.length > 20000, `${filePath} is too small to be a valid screenshot.`);
  assert(buffer.subarray(0, 8).equals(pngHeader), `${filePath} is not a valid PNG file.`);
  return buffer.length;
};

const waitForToastToClear = async (page, timeout = 7000) => {
  await page.waitForFunction(() => {
    const toast = document.querySelector('#toast');
    return !toast || (!toast.textContent.trim() && !toast.classList.contains('show'));
  }, { timeout });
};

const waitForToastText = async (page, expectedText, timeout = 7000) => {
  await page.waitForFunction(({ text }) => {
    const toast = document.querySelector('#toast');
    return !!toast && toast.textContent.trim().includes(text);
  }, { text: expectedText }, { timeout });
  const toast = await page.locator('#toast').textContent();
  return toast.trim();
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 820 }, deviceScaleFactor: 1 });
  const errors = [];

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') errors.push(`console:${msg.type()}:${msg.text()}`);
  });
  page.on('pageerror', err => errors.push(`pageerror:${err.message}`));

  await page.goto('http://127.0.0.1:8000', { waitUntil: 'domcontentloaded' });
  await waitForToastToClear(page, 2000);
  await page.screenshot({ path: 'presentation/current-interface.png', fullPage: false });

  await page.click('[data-act="demo"][data-e="ana@shiftsync.demo"]');
  await page.waitForSelector('#view');
  await page.waitForFunction(() => document.querySelector('#who')?.textContent?.includes('Ana Reyes'));
  await waitForToastToClear(page, 2000);
  await page.screenshot({ path: 'presentation/employee-dashboard.png', fullPage: false });

  const employeeHeader = (await page.locator('#view h1').textContent()).trim();
  assert(employeeHeader.includes('Welcome'), `Employee dashboard did not load: ${employeeHeader}`);

  await page.click('[data-act="go"][data-v="leave"]');
  const start = new Date(Date.now() + 14 * 86400000);
  const end = new Date(Date.now() + 16 * 86400000);
  await page.locator('#lt').selectOption({ label: 'Vacation' });
  await page.fill('#ls', fmt(start));
  await page.fill('#le', fmt(end));
  await page.fill('#lr', 'Family trip across the long weekend.');
  await page.locator('form[data-form="leave"] button.btn').click();
  const leaveToast = await waitForToastText(page, 'Leave request submitted', 8000);
  assert(leaveToast.includes('pending'), `Leave submission toast did not show pending status: ${leaveToast}`);

  await page.click('[data-act="logout"]');
  await page.click('[data-act="demo"][data-e="admin@shiftsync.demo"]');
  await page.waitForSelector('#view');
  await waitForToastToClear(page, 2000);
  await page.screenshot({ path: 'presentation/admin-dashboard.png', fullPage: false });

  await page.click('[data-act="go"][data-v="asched"]');
  const beforeRange = (await page.locator('.wk-range').textContent()).trim();
  assert(beforeRange.length > 0, 'Schedule range missing in admin schedule view.');

  await page.click('[data-act="wk"][data-n="-1"]');
  const prevRange = (await page.locator('.wk-range').textContent()).trim();
  assert(prevRange !== beforeRange, 'Previous-week navigation did not update the schedule range.');

  await page.click('[data-act="wk"][data-n="1"]');
  const nextRange = (await page.locator('.wk-range').textContent()).trim();
  assert(nextRange !== prevRange, 'Next-week navigation did not update the schedule range.');

  const scheduleSummary = await page.evaluate(() => {
    const scroll = document.querySelector('.schedule-scroll');
    const cells = Array.from(document.querySelectorAll('.grid thead th')).slice(1, 8);
    const rights = cells.map(el => el.getBoundingClientRect().right);
    const width = scroll ? scroll.getBoundingClientRect().width : 0;
    return {
      width: Math.round(width),
      sevenDays: cells.length,
      maxRight: Math.round(Math.max(...rights)),
      fits: Math.max(...rights) <= (scroll ? scroll.getBoundingClientRect().right : 0) + 1,
      range: document.querySelector('.wk-range')?.textContent?.trim() || ''
    };
  });
  assert(scheduleSummary.sevenDays === 7, `Schedule did not render 7 days: ${JSON.stringify(scheduleSummary)}`);
  assert(scheduleSummary.fits, `Seven-day schedule does not fit within the schedule container: ${JSON.stringify(scheduleSummary)}`);
  await waitForToastToClear(page, 2000);
  await page.screenshot({ path: 'presentation/schedule-management.png', fullPage: false });

  await page.click('[data-act="go"][data-v="aleave"]');
  const pendingText = (await page.locator('section.card h2').first().textContent()).trim();
  assert(pendingText.includes('Pending requests'), `Leave queue was not available: ${pendingText}`);
  const pendingApproveButtons = page.locator('button[data-act="review"][data-s="approved"]');
  const pendingRejectButtons = page.locator('button[data-act="review"][data-s="rejected"]');
  assert(await pendingApproveButtons.count() > 0, 'Approval buttons were not found in pending leave requests.');
  assert(await pendingRejectButtons.count() > 0, 'Rejection buttons were not found in pending leave requests.');

  const firstRemark = page.locator('input[aria-label*="Review remark"]').first();
  await pendingRejectButtons.first().click();
  await waitForToastText(page, 'Please add a remark when rejecting.', 8000);
  await firstRemark.fill('Rejected during QA.');
  await pendingRejectButtons.first().click();
  await waitForToastText(page, 'Request rejected', 8000);

  const secondRemark = page.locator('input[aria-label*="Review remark"]').first();
  await secondRemark.fill('Approved during QA.');
  await pendingApproveButtons.first().click();
  await waitForToastText(page, 'Request approved', 8000);

  await waitForToastToClear(page, 2000);
  await page.screenshot({ path: 'presentation/leave-management.png', fullPage: false });

  const pngFiles = [
    'presentation/current-interface.png',
    'presentation/employee-dashboard.png',
    'presentation/admin-dashboard.png',
    'presentation/schedule-management.png',
    'presentation/leave-management.png'
  ];
  for (const file of pngFiles) {
    const size = validatePng(file);
    console.log(`${file}: ${size} bytes`);
  }

  console.log('schedule_summary=' + JSON.stringify(scheduleSummary));
  console.log('browser_errors=' + JSON.stringify(errors));
  console.log('qa_status=passed');
  await browser.close();
})();
