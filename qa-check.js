const fs = require('node:fs/promises');
const { chromium } = require('playwright');
const httpServer = require('http-server');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const dateAfter = days => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const errors = [];
const browserErrors = [];
let expectedCsrfConsoleErrors = 0;
let browser;
let server;

(async () => {
  server = httpServer.createServer({ root: process.cwd(), cache: -1, showDir: false });
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', resolve);
    server.server.on('error', reject);
  });
  const { port } = server.server.address();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (message.text().includes('status of 401 (Unauthorized)')) return;
    if (message.text().includes('status of 403 (Forbidden)') && expectedCsrfConsoleErrors > 0) {
      expectedCsrfConsoleErrors -= 1;
      return;
    }
    browserErrors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));

  let sessionUser = null;
  let csrfToken = 'qa-csrf-initial';
  let sessionVersion = 0;
  let forceCsrfRefresh = true;
  await page.route('**/api/*.php', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers = request.headers();
    const json = body => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: body })
    });

    if (path === '/api/session.php' && request.method() === 'GET') {
      await json({ user: sessionUser, csrfToken });
      return;
    }
    if (headers['x-csrf-token'] !== csrfToken) {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'csrf_validation_failed' })
      });
      return;
    }
    if (path === '/api/login.php' && request.method() === 'POST') {
      const credentials = request.postDataJSON();
      if (credentials.email === 'employee@shiftsync.ph' && forceCsrfRefresh) {
        forceCsrfRefresh = false;
        csrfToken = 'qa-csrf-refreshed';
        expectedCsrfConsoleErrors += 1;
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'csrf_validation_failed' })
        });
        return;
      }
      const fixtures = {
        'employee@shiftsync.ph': {
          id: 2,
          name: 'Juan Dela Cruz',
          email: 'employee@shiftsync.ph',
          role: 'employee',
          title: 'Senior Software Engineer',
          department: 'Engineering',
          photo: ''
        },
        'admin@shiftsync.ph': {
          id: 1,
          name: 'Maria Santos',
          email: 'admin@shiftsync.ph',
          role: 'admin',
          title: 'HR & Operations Director',
          department: 'Management',
          photo: ''
        }
      };
      const user = fixtures[credentials.email];
      if (!user || credentials.email === 'inactive@shiftsync.ph' || credentials.password !== 'demo123') {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'invalid_credentials' })
        });
        return;
      }
      sessionUser = user;
      sessionVersion += 1;
      csrfToken = `qa-csrf-${sessionVersion}`;
      await json({ user, csrfToken });
      return;
    }
    if (path === '/api/logout.php' && request.method() === 'POST') {
      sessionUser = null;
      sessionVersion += 1;
      csrfToken = `qa-csrf-${sessionVersion}`;
      await json({ loggedOut: true });
      return;
    }
    await route.fulfill({ status: 404, body: 'Not found' });
  });

  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#auth-form'));
  const authForm = page.locator('#auth-form');
  assert(await authForm.isVisible(), 'The candidate-designed login screen should be the default.');
  assert(await page.getByRole('heading', { name: 'ShiftSync Enterprise' }).count() === 1, 'Login branding should remain unchanged.');
  assert(await page.getByRole('button', { name: 'Sign In' }).count() === 1, 'The existing Sign In button should remain unchanged.');
  assert(await page.locator('#auth-form').evaluate(form => form.parentElement.classList.contains('max-w-lg') && form.parentElement.classList.contains('rounded-3xl') && form.parentElement.classList.contains('p-8')), 'The centered login card layout should remain unchanged.');
  assert(await page.locator('#app .bg-brand-600 .fa-calendar-check').count() === 1, 'The existing green calendar branding icon should remain unchanged.');
  assert((await page.locator('#auth-error').getAttribute('role')) === 'alert', 'Login errors should remain accessible.');
  assert((await page.locator('body').innerText()).includes('Frontend demo only'), 'The existing demo warning wording should remain unchanged.');
  assert((await page.locator('body').innerText()).includes('Demo password: demo123'), 'The displayed demo password should remain unchanged.');
  assert((await page.locator('body').innerText()).includes('Administrator: admin@shiftsync.ph'), 'The administrator demo email should remain visible.');
  assert(await page.locator('#quick-admin, #quick-emp, #toggle-mode, #reg-role').count() === 0, 'Login bypass and public registration controls must not exist.');
  assert(await page.locator('[id^="role-switch"]').count() === 0, 'Public role-switch controls must not exist.');

  await page.locator('#auth-email').fill('unknown@example.com');
  await page.locator('#auth-password').fill('demo123');
  await authForm.locator('button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('#auth-error')?.textContent.includes('Invalid demo credentials'));
  assert((await page.locator('#auth-error').textContent()).includes('Invalid demo credentials'), 'Unknown emails must be rejected.');
  await page.locator('#auth-email').fill('inactive@shiftsync.ph');
  await page.locator('#auth-password').fill('demo123');
  await authForm.locator('button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('#auth-error')?.textContent.includes('Invalid demo credentials'));
  assert((await page.locator('#auth-error').textContent()).includes('Invalid demo credentials'), 'Inactive accounts must be rejected.');
  await page.locator('#auth-email').fill('admin@shiftsync.ph');
  await page.locator('#auth-password').fill('wrong-password');
  await authForm.locator('button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('#auth-error')?.textContent.includes('Invalid demo credentials'));
  assert((await page.locator('#auth-error').textContent()).includes('Invalid demo credentials'), 'Incorrect passwords must be rejected.');

  await page.locator('#auth-email').fill('employee@shiftsync.ph');
  await page.locator('#auth-password').fill('demo123');
  await authForm.locator('button[type="submit"]').click();
  await page.waitForFunction(() =>
    document.querySelector('aside') ||
    (
      document.querySelector('#auth-error') &&
      !document.querySelector('#auth-error').textContent.includes('Signing in')
    )
  );
  assert(
    await page.locator('aside').isVisible(),
    `Employee app shell should load after valid demo credentials: ${await page.locator('#auth-error').textContent().catch(() => 'no login error element')}`
  );
  assert(await page.getByRole('button', { name: 'Labor & Payroll' }).count() === 0, 'Employee session should not expose the administrator analytics navigation.');
  await page.reload();
  await page.waitForFunction(() =>
    document.querySelector('aside') ||
    document.querySelector('#auth-error:not(.hidden)')
  );
  assert(
    await page.locator('aside').isVisible(),
    `A valid session should be restored after browser reload: ${await page.locator('#auth-error').textContent().catch(() => 'no login error element')}`
  );
  assert(sessionUser?.role === 'employee', 'A valid session should be restored after browser reload.');
  assert(await page.getByText('Live Time Tracker').count() > 0, 'Candidate dashboard must include its live time tracker.');
  assert(await page.getByText('Upcoming Shifts Roster').count() > 0, 'Candidate dashboard must include its upcoming-shifts card.');
  assert(await page.locator('.bg-gradient-to-r.from-brand-700').count() === 1, 'Candidate green enterprise welcome banner should be rendered.');
  assert(await page.locator('[id^="role-switch"]').count() === 0, 'Role switching must remain unavailable after login.');

  await page.getByRole('button', { name: 'Calendar View' }).click();
  await page.locator('#week-grid > div').nth(6).waitFor();
  const waitForCalendarHandlers = () => page.waitForFunction(() =>
    typeof document.querySelector('#cal-next')?.onclick === 'function' &&
    typeof document.querySelector('#week-next')?.onclick === 'function'
  );
  await waitForCalendarHandlers();
  assert(await page.locator('#week-grid > div').count() === 7, 'Weekly calendar should render all seven days.');
  const monthHeadings = await page.locator('#calendar-grid').locator('xpath=preceding-sibling::div[1]').innerText();
  assert(monthHeadings.replace(/\s+/g, ' ').trim().startsWith('MON TUE WED THU FRI SAT SUN'), 'Monthly calendar should start Monday and end Sunday.');
  await page.locator('#cal-next').click();
  await page.waitForFunction(() => document.querySelector('#printable-area h2')?.textContent.includes('November 2026'));
  await waitForCalendarHandlers();
  assert((await page.locator('#printable-area h2').first().textContent()).includes('November 2026'), 'Month navigation should advance the month.');
  await page.locator('#cal-next').click();
  await waitForCalendarHandlers();
  await page.locator('#cal-next').click();
  await page.waitForFunction(() => document.querySelector('#printable-area h2')?.textContent.includes('January 2027'));
  await waitForCalendarHandlers();
  assert((await page.locator('#printable-area h2').first().textContent()).includes('January 2027'), 'Month navigation should advance the year at December.');
  await page.locator('#cal-prev').click();
  await waitForCalendarHandlers();
  await page.locator('#cal-prev').click();
  await waitForCalendarHandlers();
  await page.locator('#cal-prev').click();
  await waitForCalendarHandlers();
  const weekBefore = await page.locator('#week-range').textContent();
  await page.locator('#week-next').click();
  await page.waitForFunction(previousRange => document.querySelector('#week-range')?.textContent !== previousRange, weekBefore);
  await waitForCalendarHandlers();
  assert((await page.locator('#week-range').textContent()) !== weekBefore, 'Weekly schedule navigation should update the date range.');
  await page.locator('#week-prev').click();
  await waitForCalendarHandlers();

  const leaveStart = dateAfter(45);
  await page.getByRole('button', { name: 'Leave Requests' }).click();
  await page.getByRole('button', { name: 'Apply Leave' }).last().click();
  const today = dateAfter(0);
  assert(await page.locator('#modal-leave-start').getAttribute('min') === today, 'Leave start date should lock past dates.');
  assert(await page.locator('#modal-leave-end').getAttribute('min') === today, 'Leave end date should lock past dates.');
  await page.locator('#modal-leave-start').fill(dateAfter(-1));
  await page.locator('#modal-leave-end').fill(today);
  await page.locator('#modal-leave-reason').fill('QA past leave date.');
  assert(await page.locator('#modal-leave-start').evaluate(input => input.validity.rangeUnderflow), 'Browser date picker should mark past leave dates invalid.');
  await page.locator('#leave-modal-form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  assert((await page.locator('#toast-container').innerText()).includes('Choose a valid leave date range.'), 'Past leave dates should be rejected.');
  await page.locator('#modal-leave-start').fill(leaveStart);
  assert(await page.locator('#modal-leave-end').getAttribute('min') === leaveStart, 'Leave end date should not precede the selected start date.');
  await page.locator('#modal-leave-end').fill(leaveStart);
  await page.locator('#modal-leave-reason').fill('QA leave submission.');
  await page.locator('#leave-modal-form button[type="submit"]').click();
  assert((await page.locator('#app').innerText()).includes('QA leave submission.'), 'Employee leave request should be visible after submission.');

  await page.getByRole('button', { name: 'Shift Swaps' }).click();
  await page.getByRole('button', { name: 'Trade Shift' }).last().click();
  await page.locator('#modal-swap-my-shift').selectOption('s5');
  await page.locator('#modal-swap-target-user').selectOption('Angelica Reyes');
  await page.locator('#modal-swap-reason').fill('QA shift transfer request.');
  await page.locator('#swap-modal-form button[type="submit"]').click();
  assert((await page.locator('#app').innerText()).includes('QA shift transfer request.'), 'Employee shift-swap request should appear in the queue.');

  await page.getByRole('button', { name: 'Dashboard' }).click();
  await page.getByRole('button', { name: 'Punch In' }).click();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Punch Out' }).click();
  await page.getByRole('button', { name: 'Logs' }).click();
  assert((await page.locator('#logs-modal-tbody').innerText()).includes('Juan Dela Cruz'), 'Activity logs should include employee records.');
  const logDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Logs CSV' }).click();
  const logFile = await logDownload;
  assert(logFile.suggestedFilename().endsWith('.csv'), 'Time-log export should download a CSV file.');
  await page.locator('#logs-modal').getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Team Directory' }).click();
  assert(await page.getByText('Team Roster Directory').count() === 1, 'Team directory should render the candidate-style employee cards.');
  await page.locator('aside').locator('button').last().click();
  await page.locator('#prof-title').fill('QA Profile Title');
  await page.locator('#profile-form button[type="submit"]').click();
  assert(await page.locator('#prof-title').inputValue() === 'QA Profile Title', 'Profile edits should update the current demo account.');
  await page.locator('#notif-toggle').click();
  assert(await page.locator('#notif-dropdown').isVisible(), 'Notification dropdown should open.');
  await page.locator('#mark-notifs-read').click();
  await page.getByRole('button', { name: 'Toggle light and dark theme' }).click();
  assert((await page.locator('html').getAttribute('class')).includes('dark'), 'Theme control should enable the dark theme.');
  await page.getByRole('button', { name: 'Toggle light and dark theme' }).click();

  await page.locator('#logout-btn').click();
  await page.locator('#auth-form').waitFor();
  assert(sessionUser === null, 'Logout should invalidate the server session.');
  await page.locator('#auth-email').fill('admin@shiftsync.ph');
  await page.locator('#auth-password').fill('demo123');
  await page.locator('#auth-form button[type="submit"]').click();
  await page.getByRole('button', { name: 'Labor & Payroll' }).waitFor();
  assert(await page.getByRole('button', { name: 'Labor & Payroll' }).count() === 1, 'Administrator account should expose labor analytics.');

  await page.getByRole('button', { name: 'Shift Roster' }).click();
  await page.getByRole('button', { name: 'Assign Shift' }).last().click();
  assert(await page.locator('#modal-shift-date').getAttribute('min') === today, 'Shift date should lock past dates.');
  await page.locator('#modal-shift-user').selectOption({ label: 'Marcus Vance (employee)' });
  await page.locator('#modal-shift-date').fill(dateAfter(-1));
  await page.locator('#modal-shift-type').selectOption('Morning');
  await page.locator('#modal-shift-time').fill('09:00 - 17:00');
  await page.locator('#modal-shift-role').fill('QA past date role');
  assert(await page.locator('#modal-shift-date').evaluate(input => input.validity.rangeUnderflow), 'Browser date picker should mark past shift dates invalid.');
  await page.locator('#shift-modal-form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  assert((await page.locator('#toast-container').innerText()).includes('Choose today or a future date for the shift.'), 'Past shift dates should be rejected.');
  const assignedDate = dateAfter(50);
  await page.locator('#modal-shift-date').fill(assignedDate);
  await page.locator('#shift-modal-form button[type="submit"]').click();
  assert((await page.locator('#app').innerText()).includes(assignedDate), 'Administrator shift assignment should appear in the roster.');

  await page.getByRole('button', { name: 'Leave Requests' }).click();
  const leaveRow = page.locator('tbody tr').filter({ hasText: 'QA leave submission.' });
  assert(await leaveRow.count() === 1, 'Administrator should see the employee leave request.');
  await leaveRow.getByRole('button', { name: 'Approve' }).click();
  assert((await page.locator('#app').innerText()).includes('Approved'), 'Administrator should be able to approve a request.');
  const rejectRow = page.locator('tbody tr').filter({ hasText: 'Angelica Reyes' }).filter({ hasText: 'Medical appointment and recovery' });
  assert(await rejectRow.count() === 1, 'Administrator should be able to review another pending leave request.');
  await rejectRow.getByRole('button', { name: 'Reject' }).click();
  assert((await rejectRow.innerText()).includes('Rejected'), 'Administrator should be able to reject a leave request.');

  await page.getByRole('button', { name: 'Shift Swaps' }).click();
  const swapRow = page.locator('tbody tr').filter({ hasText: 'QA shift transfer request.' });
  assert(await swapRow.count() === 1, 'Administrator should see the employee shift-swap request.');
  await swapRow.getByRole('button', { name: 'Approve' }).click();
  assert((await swapRow.innerText()).includes('Approved'), 'Administrator should approve a valid shift transfer.');
  await page.getByRole('button', { name: 'Shift Roster' }).click();
  assert((await page.locator('#app').innerText()).includes('Angelica Reyes'), 'Approved shift transfer should update the assigned employee.');

  await page.getByRole('button', { name: 'Labor & Payroll' }).click();
  assert((await page.locator('#app').innerText()).includes('Estimated Roster Cost'), 'Labor analytics should show a calculated roster cost.');
  assert(!(await page.locator('#app').innerText()).includes('428,500'), 'Analytics must not show the candidate hard-coded payroll figure.');
  const payrollDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Payroll CSV' }).click();
  const payrollFile = await payrollDownload;
  assert(payrollFile.suggestedFilename().endsWith('.csv'), 'Payroll estimate export should download a CSV file.');
  const payrollPath = await payrollFile.path();
  const payrollCsv = await fs.readFile(payrollPath, 'utf8');
  assert(payrollCsv.includes('Scheduled Hours') && payrollCsv.includes('Estimated Roster Cost'), 'Payroll CSV should use calculated roster data.');

  const viewportResults = [];
  await page.getByRole('button', { name: 'Calendar View' }).click();
  await page.locator('#week-grid > div').nth(6).waitFor();
  for (const width of [1366, 1024, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.evaluate(() => {
      const grid = document.querySelector('#week-grid');
      const days = [...grid.children];
      const bounds = grid.parentElement.getBoundingClientRect();
      const rightEdge = Math.max(...days.map(day => day.getBoundingClientRect().right));
      return {
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        dayCount: days.length,
        daysFit: rightEdge <= bounds.right + 1,
        weekCanScroll: grid.parentElement.scrollWidth > grid.parentElement.clientWidth
      };
    });
    viewportResults.push(layout);
    assert(layout.documentWidth <= width + 1, `Page overflows horizontally at ${width}px: ${JSON.stringify(layout)}`);
    assert(layout.dayCount === 7, `Weekly schedule should contain seven days at ${width}px: ${JSON.stringify(layout)}`);
    if (width === 1366) assert(layout.daysFit, `All seven days must fit at 1366px: ${JSON.stringify(layout)}`);
    if (width <= 768) assert(layout.weekCanScroll, `The weekly calendar should scroll internally at ${width}px.`);
  }

  assert(errors.length === 0, `Page errors were observed: ${JSON.stringify(errors)}`);
  assert(browserErrors.length === 0, `Browser console errors were observed: ${JSON.stringify(browserErrors)}`);
  console.log(`viewport_results=${JSON.stringify(viewportResults)}`);
  console.log('browser_errors=[]');
  console.log('qa_status=passed');
  await browser.close();
  await new Promise(resolve => server.close(resolve));
})().catch(error => {
  console.error(error);
  browser?.close();
  server?.close();
  process.exitCode = 1;
});
