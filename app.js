let authCsrfToken = null;
let authReadyPromise = null;

async function readAuthResponse(response) {
    try {
        return await response.json();
    } catch {
        throw new Error('Invalid authentication response.');
    }
}

function mapAuthenticatedUser(account) {
    const sample = State.users.find(user => user.email.toLowerCase() === account.email.toLowerCase());
    return {
        ...(sample || {
            title: '',
            department: '',
            bio: '',
            phone: '',
            location: '',
            rate: 0,
            photo: ''
        }),
        id: account.id,
        name: account.name,
        email: account.email,
        role: account.role,
        title: account.title || sample?.title || '',
        department: account.department || sample?.department || '',
        bio: account.bio || sample?.bio || '',
        phone: account.phone || sample?.phone || '',
        location: account.location || sample?.location || '',
        photo: account.photo || sample?.photo || ''
    };
}

async function restoreAuthenticatedSession(showError = true) {
    try {
        const response = await fetch('/api/session.php', {
            method: 'GET',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        });
        const payload = await readAuthResponse(response);
        if (!response.ok || payload.success !== true || typeof payload.data?.csrfToken !== 'string') {
            throw new Error('Authentication service unavailable.');
        }
        authCsrfToken = payload.data.csrfToken;
        State.currentUser = payload.data.user ? mapAuthenticatedUser(payload.data.user) : null;
        if (State.currentUser) render();
        return true;
    } catch {
        authCsrfToken = null;
        State.currentUser = null;
        if (showError) {
            const error = document.getElementById('auth-error');
            if (error) {
                error.textContent = 'Authentication service unavailable. Please try again later.';
                error.classList.remove('hidden');
            }
        }
        return false;
    }
}

async function fetchWithCsrfRefresh(url, options) {
    let response = await fetch(url, options);
    if (response.status !== 403) return response;

    await restoreAuthenticatedSession(false);
    if (!authCsrfToken) throw new Error('Authentication token is unavailable.');
    response = await fetch(url, {
        ...options,
        headers: { ...options.headers, 'X-CSRF-Token': authCsrfToken }
    });
    return response;
}

function showToast(message, type = 'success') {
            const container = document.getElementById('toast-container');
            if (!container) return;
            const toast = document.createElement('div');
            const bg = type === 'success' ? 'bg-emerald-600 text-white' : type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white';
            toast.className = `pointer-events-auto px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 transform translate-y-2 opacity-0 transition-all duration-300 ${bg}`;
            toast.innerHTML = `
                <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info'}"></i>
                <span class="text-sm font-medium">${message}</span>
            `;
            container.appendChild(toast);
            setTimeout(() => { toast.classList.remove('translate-y-2', 'opacity-0'); }, 10);
            setTimeout(() => {
                toast.classList.add('translate-y-2', 'opacity-0');
                setTimeout(() => toast.remove(), 300);
            }, 3500);
        }

        function getShiftHours(shift) {
            if (!shift.time) return 0;
            const [start, end] = shift.time.split('-').map(value => value.trim());
            const parseTime = value => {
                const match = value.match(/^(\d{1,2}):(\d{2})$/);
                return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
            };
            const startMinutes = parseTime(start);
            const endMinutes = parseTime(end);
            if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return 0;
            return (endMinutes <= startMinutes ? endMinutes + 1440 - startMinutes : endMinutes - startMinutes) / 60;
        }

        function getPayrollRows() {
            return State.users.filter(user => user.role === 'employee').map(user => {
                const hours = State.shifts
                    .filter(shift => shift.employee === user.name)
                    .reduce((total, shift) => total + getShiftHours(shift), 0);
                return { user, hours, cost: hours * user.rate };
            });
        }

        function formatLocalDate(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        function getTodayDate() {
            return formatLocalDate(new Date());
        }

        window.exportTimeLogsCSV = function() {
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "ID,Employee,Date,Clock In,Clock Out,Duration,Status\r\n";

            State.timeLogs.forEach(log => {
                let row = `"${log.id}","${log.employee}","${log.date}","${log.clockIn}","${log.clockOut}","${log.duration}","${log.status}"`;
                csvContent += row + "\r\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `ShiftSync_TimeLogs_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Time logs exported to CSV successfully!');
        };

        window.exportPayrollCSV = function() {
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Employee,Title,Department,Hourly Rate (PHP),Scheduled Hours,Estimated Roster Cost (PHP)\r\n";

            getPayrollRows().forEach(({ user, hours, cost }) => {
                let row = `"${user.name}","${user.title}","${user.department}",${user.rate},${hours.toFixed(2)},${cost.toFixed(2)}`;
                csvContent += row + "\r\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `ShiftSync_Payroll_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Payroll summary exported to CSV successfully!');
        };


        window.openLeaveModal = function() {
            const modal = document.getElementById('leave-modal');
            if (!modal) return;
            const todayStr = getTodayDate();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = formatLocalDate(tomorrow);

            const startInput = document.getElementById('modal-leave-start');
            const endInput = document.getElementById('modal-leave-end');
            startInput.min = todayStr;
            endInput.min = todayStr;
            startInput.value = todayStr;
            endInput.value = tomorrowStr;
            modal.classList.remove('hidden');
        };

        window.closeLeaveModal = function() {
            const modal = document.getElementById('leave-modal');
            if (modal) modal.classList.add('hidden');
        };

        window.openLogsModal = function() {
            const modal = document.getElementById('logs-modal');
            if (!modal) return;
            const tbody = document.getElementById('logs-modal-tbody');

            tbody.innerHTML = State.timeLogs.map(l => `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td class="p-3 font-semibold text-slate-900 dark:text-white">${l.employee}</td>
                    <td class="p-3 text-slate-600 dark:text-slate-400">${l.date}</td>
                    <td class="p-3 text-slate-600 dark:text-slate-400 font-mono">${l.clockIn}</td>
                    <td class="p-3 text-slate-600 dark:text-slate-400 font-mono">${l.clockOut}</td>
                    <td class="p-3 font-semibold text-brand-600">${l.duration}</td>
                    <td class="p-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${l.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'}">${l.status}</span>
                    </td>
                </tr>
            `).join('');

            modal.classList.remove('hidden');
        };

        window.closeLogsModal = function() {
            const modal = document.getElementById('logs-modal');
            if (modal) modal.classList.add('hidden');
        };

        window.openShiftModal = function() {
            const modal = document.getElementById('shift-modal');
            if (!modal) return;
            const userSelect = document.getElementById('modal-shift-user');
            userSelect.innerHTML = State.users.map(u => `<option value="${u.name}">${u.name} (${u.role})</option>`).join('');
            const dateInput = document.getElementById('modal-shift-date');
            dateInput.min = getTodayDate();
            dateInput.value = getTodayDate();
            modal.classList.remove('hidden');
        };

        window.closeShiftModal = function() {
            const modal = document.getElementById('shift-modal');
            if (modal) modal.classList.add('hidden');
        };

        window.openSwapModal = function() {
            const modal = document.getElementById('swap-modal');
            if (!modal) return;

            const myShiftsSelect = document.getElementById('modal-swap-my-shift');
            const targetUserSelect = document.getElementById('modal-swap-target-user');

            const myShifts = State.shifts.filter(s => s.employee === State.currentUser.name);
            if (myShifts.length === 0) {
                myShiftsSelect.innerHTML = `<option value="">No shifts assigned to trade</option>`;
            } else {
                myShiftsSelect.innerHTML = myShifts.map(s => `<option value="${s.id}">${s.date} — ${s.type} (${s.role})</option>`).join('');
            }

            const otherUsers = State.users.filter(u => u.name !== State.currentUser.name);
            targetUserSelect.innerHTML = otherUsers.map(u => `<option value="${u.name}">${u.name} (${u.title})</option>`).join('');

            modal.classList.remove('hidden');
        };

        window.closeSwapModal = function() {
            const modal = document.getElementById('swap-modal');
            if (modal) modal.classList.add('hidden');
        };


        function toggleClockIn() {
            const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const nowDateStr = new Date().toISOString().split('T')[0];

            if (!State.timeClock.isClockedIn) {
                State.timeClock.isClockedIn = true;
                State.timeClock.startTime = Date.now();
                showToast('Clocked In successfully!');


                State.timeLogs.unshift({
                    id: 'tl_' + Date.now(),
                    employee: State.currentUser.name,
                    date: nowDateStr,
                    clockIn: nowTimeStr,
                    clockOut: 'Active',
                    duration: 'Live',
                    status: 'In Progress'
                });

                State.timeClock.timerInterval = setInterval(() => {
                    State.timeClock.elapsedSeconds++;
                    updateTimerUI();
                }, 1000);
            } else {
                State.timeClock.isClockedIn = false;
                clearInterval(State.timeClock.timerInterval);
                const workedHours = (State.timeClock.elapsedSeconds / 3600).toFixed(2);
                showToast(`Clocked Out. Total worked: ${workedHours} hrs`);


                const activeLog = State.timeLogs.find(l => l.employee === State.currentUser.name && l.status === 'In Progress');
                if (activeLog) {
                    activeLog.clockOut = nowTimeStr;
                    activeLog.duration = `${workedHours} hrs`;
                    activeLog.status = 'Completed';
                }

                State.timeClock.elapsedSeconds = 0;
            }
            render();
        }

        function updateTimerUI() {
            const timerEl = document.getElementById('punch-timer');
            if (!timerEl) return;
            const hrs = String(Math.floor(State.timeClock.elapsedSeconds / 3600)).padStart(2, '0');
            const mins = String(Math.floor((State.timeClock.elapsedSeconds % 3600) / 60)).padStart(2, '0');
            const secs = String(State.timeClock.elapsedSeconds % 60).padStart(2, '0');
            timerEl.innerText = `${hrs}:${mins}:${secs}`;
        }

        window.toggleTheme = function() {
            State.darkMode = !State.darkMode;
            document.documentElement.classList.toggle('dark', State.darkMode);
            render();
        };


        function switchView(viewName) {
            State.currentView = viewName;
            render();
        }


        function render() {
            const app = document.getElementById('app');
            app.innerHTML = '';

            if (!State.currentUser) {
                app.appendChild(renderAuthModal());
                return;
            }

            const shell = document.createElement('div');
            shell.className = 'h-full w-full flex flex-col md:flex-row overflow-hidden bg-slate-50 dark:bg-slate-950';
            shell.appendChild(renderSidebar());

            const mainContent = document.createElement('div');
            mainContent.className = 'flex-1 flex flex-col h-full overflow-hidden';
            mainContent.appendChild(renderHeader());

            const bodyScroll = document.createElement('main');
            bodyScroll.id = 'printable-area';
            bodyScroll.className = 'flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar';

            if (State.currentView === 'dashboard') bodyScroll.appendChild(renderDashboardView());
            else if (State.currentView === 'shifts') bodyScroll.appendChild(renderShiftsView());
            else if (State.currentView === 'calendar') bodyScroll.appendChild(renderCalendarView());
            else if (State.currentView === 'employees') bodyScroll.appendChild(renderEmployeesView());
            else if (State.currentView === 'leaves') bodyScroll.appendChild(renderLeavesView());
            else if (State.currentView === 'swaps') bodyScroll.appendChild(renderSwapsView());
            else if (State.currentView === 'analytics') bodyScroll.appendChild(renderAnalyticsView());
            else if (State.currentView === 'profile') bodyScroll.appendChild(renderProfileView());
            else bodyScroll.appendChild(renderDashboardView());

            mainContent.appendChild(bodyScroll);
            shell.appendChild(mainContent);
            app.appendChild(shell);

            setupModalFormListeners();
        }


        function setupModalFormListeners() {

            const leaveForm = document.getElementById('leave-modal-form');
            if (leaveForm && !leaveForm.dataset.bound) {
                leaveForm.dataset.bound = "true";
                const leaveStart = document.getElementById('modal-leave-start');
                const leaveEnd = document.getElementById('modal-leave-end');
                leaveStart.addEventListener('change', () => {
                    leaveEnd.min = leaveStart.value > getTodayDate() ? leaveStart.value : getTodayDate();
                    if (leaveEnd.value < leaveEnd.min) leaveEnd.value = leaveEnd.min;
                });
                leaveForm.onsubmit = function(e) {
                    e.preventDefault();
                    const type = document.getElementById('modal-leave-type').value;
                    const start = document.getElementById('modal-leave-start').value;
                    const end = document.getElementById('modal-leave-end').value;
                    const reason = document.getElementById('modal-leave-reason').value.trim();

                    if (!start || !end || start < getTodayDate() || end < getTodayDate() || start > end) {
                        showToast('Choose a valid leave date range.', 'error');
                        return;
                    }
                    const overlaps = State.leaves.some(leave =>
                        leave.employee === State.currentUser.name &&
                        leave.status !== 'Rejected' &&
                        start <= leave.end && end >= leave.start
                    );
                    if (overlaps) {
                        showToast('This request overlaps an existing leave request.', 'error');
                        return;
                    }

                    State.leaves.unshift({
                        id: 'l_' + Date.now(),
                        employee: State.currentUser.name,
                        type, start, end, reason, status: 'Pending'
                    });

                    window.closeLeaveModal();
                    leaveForm.reset();
                    showToast('Leave request submitted!');
                    render();
                };
            }


            const shiftForm = document.getElementById('shift-modal-form');
            if (shiftForm && !shiftForm.dataset.bound) {
                shiftForm.dataset.bound = "true";
                shiftForm.onsubmit = function(e) {
                    e.preventDefault();
                    const employee = document.getElementById('modal-shift-user').value;
                    const date = document.getElementById('modal-shift-date').value;
                    const type = document.getElementById('modal-shift-type').value;
                    const time = document.getElementById('modal-shift-time').value.trim();
                    const role = document.getElementById('modal-shift-role').value.trim();

                    if (!date || date < getTodayDate()) {
                        showToast('Choose today or a future date for the shift.', 'error');
                        return;
                    }

                    if (State.shifts.some(shift => shift.employee === employee && shift.date === date)) {
                        showToast('This employee already has a shift on that date.', 'error');
                        return;
                    }

                    State.shifts.unshift({
                        id: 's_' + Date.now(),
                        employee, date, type, time, role, location: 'BGC Central Branch', status: 'Confirmed'
                    });

                    window.closeShiftModal();
                    shiftForm.reset();
                    showToast('New shift assigned!');
                    render();
                };
            }


            const swapForm = document.getElementById('swap-modal-form');
            if (swapForm && !swapForm.dataset.bound) {
                swapForm.dataset.bound = "true";
                swapForm.onsubmit = function(e) {
                    e.preventDefault();
                    const shiftId = document.getElementById('modal-swap-my-shift').value;
                    const targetUser = document.getElementById('modal-swap-target-user').value;
                    const reason = document.getElementById('modal-swap-reason').value.trim();

                    const myShift = State.shifts.find(s => s.id === shiftId);
                    if (!myShift || !targetUser || targetUser === State.currentUser.name) {
                        showToast('Choose one of your assigned shifts and a coworker.', 'error');
                        return;
                    }

                    State.swaps.unshift({
                        id: 'sw_' + Date.now(),
                        requester: State.currentUser.name,
                        targetUser,
                        shiftId: myShift.id,
                        shiftDate: myShift.date,
                        shiftType: myShift.type,
                        reason,
                        status: 'Pending'
                    });

                    window.closeSwapModal();
                    swapForm.reset();
                    showToast('Swap request submitted to colleague!');
                    render();
                };
            }
        }


        function renderAuthModal() {
            const wrapper = document.createElement('div');
            wrapper.className = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 overflow-y-auto';

            const container = document.createElement('div');
            container.className = 'w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 my-auto transform transition-all';

            container.innerHTML = `
                    <div class="text-center mb-8">
                        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white text-2xl font-bold shadow-xl shadow-brand-500/20 mb-4">
                            <i class="fa-solid fa-calendar-check"></i>
                        </div>
                        <h2 class="text-2xl font-bold text-slate-900 dark:text-white">ShiftSync Enterprise</h2>
                        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Sign in to access your shift portal</p>
                    </div>

                    <div class="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                        <p class="font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Frontend demo only</p>
                        <p class="mt-1">This prototype does not provide secure authentication. Use sample accounts only; do not enter real credentials.</p>
                        <p class="mt-2">Demo password: <code class="font-bold">demo123</code></p>
                    </div>

                    <form id="auth-form" class="space-y-4">
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Email Address *</label>
                            <input type="email" id="auth-email" required autocomplete="username" placeholder="employee@shiftsync.ph" class="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Password *</label>
                            <input type="password" id="auth-password" required autocomplete="current-password" placeholder="Demo password" class="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none">
                        </div>
                        <p id="auth-error" class="hidden text-sm font-medium text-rose-600 dark:text-rose-400" role="alert"></p>
                        <button type="submit" class="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 transition flex items-center justify-center gap-2 mt-2">
                            <span>Sign In</span>
                            <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    </form>

                    <p class="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
                        Employee: <span class="font-semibold">employee@shiftsync.ph</span><br>
                        Administrator: <span class="font-semibold">admin@shiftsync.ph</span>
                    </p>
                `;

            container.querySelector('#auth-form').onsubmit = async (event) => {
                event.preventDefault();
                const email = container.querySelector('#auth-email').value.trim().toLowerCase();
                const password = container.querySelector('#auth-password').value;
                const error = container.querySelector('#auth-error');
                const form = event.currentTarget;
                const submitButton = form.querySelector('button[type="submit"]');
                const inputs = form.querySelectorAll('input');
                if (form.dataset.submitting === 'true') return;

                form.dataset.submitting = 'true';
                form.setAttribute('aria-busy', 'true');
                submitButton.disabled = true;
                submitButton.setAttribute('aria-busy', 'true');
                inputs.forEach(input => { input.disabled = true; });
                error.textContent = 'Signing in...';
                error.classList.remove('hidden');

                try {
                    if (!authCsrfToken) {
                        if (authReadyPromise) await authReadyPromise;
                    }
                    if (!authCsrfToken) {
                        await restoreAuthenticatedSession(false);
                    }
                    if (!authCsrfToken) throw new Error('Authentication service unavailable.');

                    const response = await fetchWithCsrfRefresh('/api/login.php', {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': authCsrfToken
                        },
                        body: JSON.stringify({ email, password })
                    });
                    const payload = await readAuthResponse(response);
                    if (response.status === 401) {
                        error.textContent = 'Invalid demo credentials. Check the email and password and try again.';
                        return;
                    }
                    if (
                        !response.ok ||
                        payload.success !== true ||
                        !payload.data?.user ||
                        !['admin', 'employee'].includes(payload.data.user.role) ||
                        typeof payload.data.csrfToken !== 'string'
                    ) {
                        throw new Error('Authentication service unavailable.');
                    }

                    authCsrfToken = payload.data.csrfToken;
                    State.currentUser = mapAuthenticatedUser(payload.data.user);
                    showToast(`Welcome back, ${State.currentUser.name}`);
                    render();
                } catch {
                    error.textContent = 'Authentication service unavailable. Please try again later.';
                    error.classList.remove('hidden');
                } finally {
                    if (form.isConnected) {
                        delete form.dataset.submitting;
                        form.removeAttribute('aria-busy');
                        submitButton.disabled = false;
                        submitButton.removeAttribute('aria-busy');
                        inputs.forEach(input => { input.disabled = false; });
                    }
                }
            };

            wrapper.appendChild(container);
            return wrapper;
        }


        function renderSidebar() {
            const sidebar = document.createElement('aside');
            sidebar.className = 'w-full md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-20 no-print';

            const navItems = [
                { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
                { id: 'shifts', label: 'Shift Roster', icon: 'fa-list-check' },
                { id: 'calendar', label: 'Calendar View', icon: 'fa-calendar-days' },
                { id: 'employees', label: 'Team Directory', icon: 'fa-users' },
                { id: 'leaves', label: 'Leave Requests', icon: 'fa-umbrella-beach' },
                { id: 'swaps', label: 'Shift Swaps', icon: 'fa-right-left' },
            ];

            if (State.currentUser.role === 'admin') {
                navItems.push({ id: 'analytics', label: 'Labor & Payroll', icon: 'fa-chart-line' });
            }

            sidebar.innerHTML = `
                <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-teal-500 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-brand-500/30">
                            <i class="fa-solid fa-calendar-check"></i>
                        </div>
                        <div>
                            <h1 class="font-bold text-slate-900 dark:text-white leading-tight">ShiftSync</h1>
                            <span class="text-xs text-slate-500 dark:text-slate-400">Enterprise PH</span>
                        </div>
                    </div>
                </div>

                <nav class="flex-1 p-4 space-y-1.5 overflow-y-auto">
                    ${navItems.map(item => `
                        <button onclick="switchView('${item.id}')" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${State.currentView === item.id ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/25' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}">
                            <i class="fa-solid ${item.icon} w-5 text-center"></i>
                            <span>${item.label}</span>
                        </button>
                    `).join('')}
                </nav>

                <div class="p-4 border-t border-slate-200 dark:border-slate-800">
                    <button onclick="switchView('profile')" class="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left">
                        <img src="${State.currentUser.photo}" class="w-10 h-10 rounded-full object-cover border border-slate-300 dark:border-slate-700" onerror="this.src='https://placehold.co/100x100/16a34a/ffffff?text=User'">
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">${State.currentUser.name}</p>
                            <p class="text-xs text-slate-500 dark:text-slate-400 truncate">${State.currentUser.title}</p>
                        </div>
                    </button>
                </div>
            `;
            return sidebar;
        }


        function renderHeader() {
            const header = document.createElement('header');
            header.className = 'h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between z-10 no-print';

            const titles = {
                dashboard: 'Workspace Dashboard',
                shifts: 'Shift Roster Schedule',
                calendar: 'Monthly Calendar View',
                employees: 'Employee Directory',
                leaves: 'Leave Requests & Approvals',
                swaps: 'Shift Swap Trading Queue',
                analytics: 'Labor Analytics & Payroll Costs',
                profile: 'My Account Settings'
            };

            const unreadNotifs = State.notifications.filter(n => !n.read).length;

            header.innerHTML = `
                <div class="flex items-center gap-4">
                    <h2 class="text-lg font-bold text-slate-900 dark:text-white">${titles[State.currentView] || 'Dashboard'}</h2>
                </div>

                <div class="flex items-center gap-3">
                    <button onclick="window.openLeaveModal()" class="hidden sm:flex px-3.5 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 hover:bg-brand-100 text-xs font-semibold transition items-center gap-1.5">
                        <i class="fa-solid fa-paper-plane"></i>
                        <span>Apply Leave</span>
                    </button>

                    <!-- Notifications Menu Dropdown -->
                    <div class="relative">
                        <button id="notif-toggle" class="relative w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                            <i class="fa-solid fa-bell"></i>
                            ${unreadNotifs > 0 ? `<span class="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">${unreadNotifs}</span>` : ''}
                        </button>
                        <div id="notif-dropdown" class="hidden absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 p-4">
                            <div class="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                                <span class="font-bold text-sm">Notifications</span>
                                <button id="mark-notifs-read" class="text-xs text-brand-600 font-medium hover:underline">Mark read</button>
                            </div>
                            <div class="space-y-3 mt-3 max-h-60 overflow-y-auto">
                                ${State.notifications.map(n => `
                                    <div class="p-2.5 rounded-xl ${n.read ? 'bg-slate-50 dark:bg-slate-800/40' : 'bg-brand-50/50 dark:bg-brand-950/30'}">
                                        <p class="text-xs font-bold text-slate-900 dark:text-white">${n.title}</p>
                                        <p class="text-xs text-slate-500 mt-0.5">${n.desc}</p>
                                        <span class="text-[10px] text-slate-400 mt-1 block">${n.time}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <button onclick="window.toggleTheme()" aria-label="Toggle light and dark theme" class="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        <i class="fa-solid ${State.darkMode ? 'fa-sun' : 'fa-moon'}"></i>
                    </button>

                    <button id="logout-btn" class="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-semibold transition">
                        Log Out
                    </button>
                </div>
            `;

            setTimeout(() => {
                const notifToggle = header.querySelector('#notif-toggle');
                const notifDropdown = header.querySelector('#notif-dropdown');
                const markRead = header.querySelector('#mark-notifs-read');

                if (notifToggle && notifDropdown) {
                    notifToggle.onclick = () => notifDropdown.classList.toggle('hidden');
                }

                if (markRead) {
                    markRead.onclick = () => {
                        State.notifications.forEach(n => n.read = true);
                        showToast('Notifications marked as read');
                        render();
                    };
                }

                const logoutBtn = header.querySelector('#logout-btn');

                if (logoutBtn) logoutBtn.onclick = async () => {
                    logoutBtn.disabled = true;
                    try {
                        if (!authCsrfToken) throw new Error('Logout token is unavailable.');
                        const response = await fetchWithCsrfRefresh('/api/logout.php', {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: {
                                Accept: 'application/json',
                                'X-CSRF-Token': authCsrfToken
                            }
                        });
                        const payload = await readAuthResponse(response);
                        if (!response.ok || payload.success !== true) {
                            throw new Error('Logout failed.');
                        }
                    } catch {
                        showToast('Could not confirm server sign-out. Please try again.', 'error');
                    } finally {
                        if (State.timeClock.isClockedIn) toggleClockIn();
                        authCsrfToken = null;
                        State.currentUser = null;
                        render();
                    }
                };
            }, 0);

            return header;
        }


        function renderDashboardView() {
            const container = document.createElement('div');
            container.className = 'space-y-6 max-w-7xl mx-auto';

            const userShifts = State.shifts.filter(s => s.employee === State.currentUser.name);
            const pendingLeaves = State.leaves.filter(l => l.status === 'Pending');
            const pendingSwaps = State.swaps.filter(s => s.status === 'Pending');

            container.innerHTML = `
                <!-- Welcome Banner -->
                <div class="bg-gradient-to-r from-brand-700 via-teal-700 to-emerald-800 rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <span class="px-3 py-1 rounded-full bg-white/20 text-xs font-semibold uppercase tracking-wider">Enterprise Workspace</span>
                        <h2 class="text-2xl md:text-3xl font-bold mt-2">Welcome back, ${State.currentUser.name}! 👋</h2>
                        <p class="text-brand-100 text-sm mt-1">Here is your operational overview, live time tracker, and shift schedules.</p>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="window.openShiftModal()" class="${State.currentUser.role === 'admin' ? '' : 'hidden'} px-4 py-2.5 bg-white text-brand-800 font-bold text-xs rounded-xl hover:bg-brand-50 transition shadow-lg flex items-center gap-2">
                            <i class="fa-solid fa-plus"></i> Assign Shift
                        </button>
                        <button onclick="window.openSwapModal()" class="px-4 py-2.5 bg-brand-600/80 hover:bg-brand-600 text-white font-semibold text-xs rounded-xl transition border border-white/20 flex items-center gap-2">
                            <i class="fa-solid fa-right-left"></i> Trade Shift
                        </button>
                    </div>
                </div>

                <!-- Clock-In Widget & Stats -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Clock In Card -->
                    <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
                        <div>
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-2">
                                    <div class="p-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-xl">
                                        <i class="fa-solid fa-business-time"></i>
                                    </div>
                                    <h3 class="font-bold text-slate-800 dark:text-slate-100">Live Time Tracker</h3>
                                </div>
                                <span class="px-2.5 py-1 rounded-full text-xs font-bold ${State.timeClock.isClockedIn ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                                    ${State.timeClock.isClockedIn ? 'Clocked In' : 'Clocked Out'}
                                </span>
                            </div>
                            <p class="text-xs text-slate-500">Current Branch: <strong>BGC Central Branch</strong></p>
                        </div>

                        <div class="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center border border-slate-100 dark:border-slate-800">
                            <div id="punch-timer" class="text-3xl font-extrabold font-mono text-slate-800 dark:text-slate-100">
                                ${String(Math.floor(State.timeClock.elapsedSeconds / 3600)).padStart(2, '0')}:${String(Math.floor((State.timeClock.elapsedSeconds % 3600) / 60)).padStart(2, '0')}:${String(State.timeClock.elapsedSeconds % 60).padStart(2, '0')}
                            </div>
                            <p class="text-[11px] text-slate-400 mt-1">Ready for shift execution</p>
                        </div>

                        <div class="flex items-center gap-2">
                            <button onclick="toggleClockIn()" class="flex-1 py-3 ${State.timeClock.isClockedIn ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs">
                                <i class="fa-solid ${State.timeClock.isClockedIn ? 'fa-stop' : 'fa-play'}"></i>
                                <span>${State.timeClock.isClockedIn ? 'Punch Out' : 'Punch In'}</span>
                            </button>
                            <button onclick="window.openLogsModal()" title="View Activity Logs" class="px-3.5 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition font-semibold text-xs flex items-center gap-1">
                                <i class="fa-solid fa-clock-rotate-left"></i>
                                <span class="hidden sm:inline">Logs</span>
                            </button>
                            <button onclick="window.exportTimeLogsCSV()" title="Export Logs CSV" class="px-3.5 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition font-semibold text-xs flex items-center gap-1">
                                <i class="fa-solid fa-file-arrow-down text-brand-600"></i>
                                <span class="hidden sm:inline">CSV</span>
                            </button>
                        </div>
                    </div>

                    <!-- Metrics Grid -->
                    <div class="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Shifts</span>
                            <span class="text-2xl font-bold text-slate-800 dark:text-slate-100">${State.currentUser.role === 'admin' ? State.shifts.length : userShifts.length}</span>
                            <p class="text-[11px] text-emerald-600 font-medium mt-1">Active roster</p>
                        </div>

                        <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Pending Leave</span>
                            <span class="text-2xl font-bold text-amber-600">${pendingLeaves.length}</span>
                            <p class="text-[11px] text-slate-500 font-medium mt-1">Needs review</p>
                        </div>

                        <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Swap Queue</span>
                            <span class="text-2xl font-bold text-teal-600">${pendingSwaps.length}</span>
                            <p class="text-[11px] text-slate-500 font-medium mt-1">Trades pending</p>
                        </div>

                        <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Hourly Rate</span>
                            <span class="text-2xl font-bold text-slate-800 dark:text-slate-100">₱${State.currentUser.rate}</span>
                            <p class="text-[11px] text-purple-600 font-medium mt-1">Standard pay</p>
                        </div>

                        <!-- Shift Feed -->
                        <div class="col-span-2 sm:col-span-4 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="font-bold text-slate-800 dark:text-slate-100 text-sm">Upcoming Shifts Roster</h3>
                                <button onclick="switchView('shifts')" class="text-xs text-brand-600 font-semibold hover:underline">View Roster →</button>
                            </div>
                            <div class="space-y-2.5">
                                ${State.shifts.slice(0, 3).map(s => `
                                    <div class="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                        <div class="flex items-center gap-3">
                                            <div class="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-900/50 text-brand-600 flex items-center justify-center font-bold text-xs">
                                                <i class="fa-solid fa-clock"></i>
                                            </div>
                                            <div>
                                                <p class="font-semibold text-xs text-slate-900 dark:text-white">${s.employee} — ${s.role}</p>
                                                <p class="text-[11px] text-slate-500">${s.date} • ${s.time} (${s.location})</p>
                                            </div>
                                        </div>
                                        <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">${s.status}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            return container;
        }


        function renderShiftsView() {
            const container = document.createElement('div');
            container.className = 'space-y-6 max-w-7xl mx-auto';

            let filteredShifts = State.shifts;
            if (State.shiftFilter !== 'All') {
                filteredShifts = filteredShifts.filter(s => s.type === State.shiftFilter);
            }
            if (State.searchQuery.trim() !== '') {
                const q = State.searchQuery.toLowerCase();
                filteredShifts = filteredShifts.filter(s => s.employee.toLowerCase().includes(q) || s.role.toLowerCase().includes(q) || s.location.toLowerCase().includes(q));
            }

            container.innerHTML = `
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Shift Roster Table</h2>
                        <p class="text-sm text-slate-500">Search and filter active work schedules.</p>
                    </div>
                    <div class="flex flex-wrap items-center gap-3">
                        <div class="relative min-w-[200px]">
                            <input type="text" id="shift-search" value="${State.searchQuery}" placeholder="Search staff or role..." class="w-full px-3.5 py-2 pl-9 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none">
                            <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                        </div>
                        <select id="shift-filter-select" class="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none">
                            <option value="All" ${State.shiftFilter === 'All' ? 'selected' : ''}>All Shifts</option>
                            <option value="Morning" ${State.shiftFilter === 'Morning' ? 'selected' : ''}>Morning</option>
                            <option value="Evening" ${State.shiftFilter === 'Evening' ? 'selected' : ''}>Evening</option>
                            <option value="Night" ${State.shiftFilter === 'Night' ? 'selected' : ''}>Night</option>
                        </select>
                        <button onclick="window.print()" class="px-3.5 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl hover:bg-slate-300 transition flex items-center gap-2">
                            <i class="fa-solid fa-print"></i> Print Schedule
                        </button>
                        ${State.currentUser.role === 'admin' ? `
                            <button onclick="window.openShiftModal()" class="px-4 py-2 rounded-xl bg-brand-600 text-white font-semibold text-xs hover:bg-brand-700 shadow-lg transition flex items-center gap-2">
                                <i class="fa-solid fa-plus"></i> Assign Shift
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    <th class="p-4">Employee</th>
                                    <th class="p-4">Shift Date</th>
                                    <th class="p-4">Type & Schedule</th>
                                    <th class="p-4">Assigned Role</th>
                                    <th class="p-4">Branch Location</th>
                                    <th class="p-4">Status</th>
                                    ${State.currentUser.role === 'admin' ? '<th class="p-4 text-right no-print">Actions</th>' : ''}
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                ${filteredShifts.map(s => `
                                    <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                                        <td class="p-4 font-semibold text-slate-900 dark:text-white flex items-center gap-3">
                                            <div class="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 flex items-center justify-center font-bold text-xs">
                                                ${s.employee.charAt(0)}
                                            </div>
                                            <span>${s.employee}</span>
                                        </td>
                                        <td class="p-4 text-slate-600 dark:text-slate-400">${s.date}</td>
                                        <td class="p-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                                            <span class="font-semibold text-slate-800 dark:text-slate-200 block">${s.type}</span>
                                            ${s.time}
                                        </td>
                                        <td class="p-4 text-slate-600 dark:text-slate-400">${s.role}</td>
                                        <td class="p-4 text-slate-600 dark:text-slate-400 text-xs">${s.location}</td>
                                        <td class="p-4">
                                            <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${s.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'}">${s.status}</span>
                                        </td>
                                        ${State.currentUser.role === 'admin' ? `
                                            <td class="p-4 text-right no-print">
                                                <button onclick="window.deleteShift('${s.id}')" class="text-rose-500 hover:text-rose-700 p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition">
                                                    <i class="fa-solid fa-trash-can"></i>
                                                </button>
                                            </td>
                                        ` : ''}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            setTimeout(() => {
                const search = container.querySelector('#shift-search');
                const select = container.querySelector('#shift-filter-select');

                if (search) {
                    search.oninput = (e) => {
                        State.searchQuery = e.target.value;
                        render();
                    };
                }
                if (select) {
                    select.onchange = (e) => {
                        State.shiftFilter = e.target.value;
                        render();
                    };
                }
            }, 0);

            window.deleteShift = (id) => {
                State.shifts = State.shifts.filter(s => s.id !== id);
                showToast('Shift removed', 'info');
                render();
            };

            return container;
        }


        function renderCalendarView() {
            const container = document.createElement('div');
            container.className = 'space-y-6 max-w-7xl mx-auto';

            const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const getMonday = date => {
                const monday = new Date(date);
                monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
                return monday;
            };

            container.innerHTML = `
                <div class="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div class="flex items-center space-x-3">
                        <h2 class="text-xl font-bold text-slate-900 dark:text-white">${months[State.calendarMonth]} ${State.calendarYear}</h2>
                        <div class="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                            <button id="cal-prev" class="px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition text-xs"><i class="fa-solid fa-chevron-left"></i></button>
                            <button id="cal-today" class="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition">Today</button>
                            <button id="cal-next" class="px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition text-xs"><i class="fa-solid fa-chevron-right"></i></button>
                        </div>
                    </div>
                </div>

                <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div class="flex items-center justify-between gap-3 p-4 border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <h3 class="font-bold text-slate-900 dark:text-white">Weekly Shift Schedule</h3>
                            <p id="week-range" class="text-xs text-slate-500 mt-1"></p>
                        </div>
                        <div class="flex items-center gap-1">
                            <button id="week-prev" aria-label="Previous week" class="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"><i class="fa-solid fa-chevron-left"></i></button>
                            <button id="week-next" aria-label="Next week" class="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"><i class="fa-solid fa-chevron-right"></i></button>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <div id="week-grid" class="grid grid-cols-7 min-w-[900px] lg:min-w-0 divide-x divide-slate-100 dark:divide-slate-800"></div>
                    </div>
                </section>

                <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div class="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-center text-xs font-bold text-slate-500 uppercase tracking-wider py-3">
                        <div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>
                    </div>
                    <div id="calendar-grid" class="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800 text-sm"></div>
                </div>
            `;

            setTimeout(() => {
                const prev = container.querySelector('#cal-prev');
                const next = container.querySelector('#cal-next');
                const today = container.querySelector('#cal-today');
                const previousWeek = container.querySelector('#week-prev');
                const nextWeek = container.querySelector('#week-next');

                const changeMonth = offset => {
                    const date = new Date(State.calendarYear, State.calendarMonth + offset, 1);
                    State.calendarMonth = date.getMonth();
                    State.calendarYear = date.getFullYear();
                    render();
                };
                if (prev) prev.onclick = () => changeMonth(-1);
                if (next) next.onclick = () => changeMonth(1);
                if (today) today.onclick = () => {
                    const now = new Date();
                    State.calendarMonth = now.getMonth();
                    State.calendarYear = now.getFullYear();
                    State.calendarWeekStart = getMonday(now).toISOString().slice(0, 10);
                    render();
                };

                const weekStart = new Date(`${State.calendarWeekStart}T12:00:00`);
                const weekGrid = container.querySelector('#week-grid');
                const weekRange = container.querySelector('#week-range');
                if (weekGrid && weekRange) {
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    weekRange.textContent = `${weekStart.toLocaleDateString()} – ${weekEnd.toLocaleDateString()}`;
                    for (let offset = 0; offset < 7; offset++) {
                        const day = new Date(weekStart);
                        day.setDate(day.getDate() + offset);
                        const date = day.toISOString().slice(0, 10);
                        const dayShifts = State.shifts.filter(shift => shift.date === date);
                        const cell = document.createElement('div');
                        cell.className = 'min-h-32 p-3';
                        cell.innerHTML = `
                            <div class="mb-3">
                                <p class="text-[10px] font-bold uppercase tracking-wide text-slate-400">${day.toLocaleDateString(undefined, { weekday: 'short' })}</p>
                                <p class="text-sm font-bold text-slate-800 dark:text-slate-100">${day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                            </div>
                            <div class="space-y-2">
                                ${dayShifts.map(shift => `
                                    <div class="rounded-lg border border-brand-200 dark:border-brand-900 bg-brand-50 dark:bg-brand-950/60 p-2 text-[10px] text-brand-800 dark:text-brand-200">
                                        <p class="font-bold truncate">${shift.employee}</p>
                                        <p class="truncate">${shift.type} · ${shift.time}</p>
                                    </div>
                                `).join('') || '<p class="text-[10px] text-slate-400">No shifts</p>'}
                            </div>
                        `;
                        weekGrid.appendChild(cell);
                    }
                }
                if (previousWeek) previousWeek.onclick = () => {
                    const date = new Date(`${State.calendarWeekStart}T12:00:00`);
                    date.setDate(date.getDate() - 7);
                    State.calendarWeekStart = date.toISOString().slice(0, 10);
                    render();
                };
                if (nextWeek) nextWeek.onclick = () => {
                    const date = new Date(`${State.calendarWeekStart}T12:00:00`);
                    date.setDate(date.getDate() + 7);
                    State.calendarWeekStart = date.toISOString().slice(0, 10);
                    render();
                };

                const grid = container.querySelector('#calendar-grid');
                if (grid) {
                    grid.innerHTML = '';
                    const daysInMonth = new Date(State.calendarYear, State.calendarMonth + 1, 0).getDate();
                    const firstDay = (new Date(State.calendarYear, State.calendarMonth, 1).getDay() + 6) % 7;

                    for (let i = 0; i < firstDay; i++) {
                        const emptyCell = document.createElement('div');
                        emptyCell.className = 'min-h-[100px] p-2 bg-slate-50/50 dark:bg-slate-900/30';
                        grid.appendChild(emptyCell);
                    }

                    for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = `${State.calendarYear}-${String(State.calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dayShifts = State.shifts.filter(s => s.date === dateStr);

                        const cell = document.createElement('div');
                        cell.className = 'min-h-[100px] p-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition flex flex-col justify-between';

                        cell.innerHTML = `
                            <div class="font-bold text-xs text-slate-700 dark:text-slate-300 mb-1">${day}</div>
                            <div class="space-y-1">
                                ${dayShifts.map(s => `
                                    <div class="p-1 rounded bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-900 text-[10px] text-brand-700 dark:text-brand-300 truncate">
                                        <span class="font-semibold">${s.employee}</span> (${s.type})
                                    </div>
                                `).join('')}
                            </div>
                        `;
                        grid.appendChild(cell);
                    }
                }
            }, 0);

            return container;
        }


        function renderEmployeesView() {
            const container = document.createElement('div');
            container.className = 'space-y-6 max-w-7xl mx-auto';

            container.innerHTML = `
                <div>
                    <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Team Roster Directory</h2>
                    <p class="text-sm text-slate-500">Contact details and job roles for enterprise staff.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${State.users.map(u => `
                        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
                            <div>
                                <div class="flex items-start justify-between mb-4">
                                    <img src="${u.photo}" class="w-16 h-16 rounded-2xl object-cover border-2 border-slate-200 dark:border-slate-700 shadow-md" onerror="this.src='https://placehold.co/100x100/16a34a/ffffff?text=User'">
                                    <span class="px-3 py-1 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400' : 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-400'} capitalize">${u.role}</span>
                                </div>
                                <h3 class="font-bold text-lg text-slate-900 dark:text-white">${u.name}</h3>
                                <p class="text-xs font-medium text-brand-600 dark:text-brand-400">${u.title} • ${u.department}</p>
                                <p class="text-xs text-slate-500 dark:text-slate-400 mt-3 line-clamp-2">${u.bio}</p>
                            </div>
                            <div class="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-500">
                                <div class="flex items-center gap-2"><i class="fa-solid fa-envelope w-4"></i> ${u.email}</div>
                                <div class="flex items-center gap-2"><i class="fa-solid fa-phone w-4"></i> ${u.phone}</div>
                                <div class="flex items-center gap-2"><i class="fa-solid fa-location-dot w-4"></i> ${u.location}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            return container;
        }


        function renderLeavesView() {
            const container = document.createElement('div');
            container.className = 'space-y-6 max-w-7xl mx-auto';

            container.innerHTML = `
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Leave Requests & Approvals</h2>
                        <p class="text-sm text-slate-500">Submit applications and manage approvals.</p>
                    </div>
                    <button onclick="window.openLeaveModal()" class="px-4 py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 shadow-lg shadow-brand-500/25 transition flex items-center gap-2">
                        <i class="fa-solid fa-paper-plane"></i> Apply Leave
                    </button>
                </div>

                <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    <th class="p-4">Employee</th>
                                    <th class="p-4">Leave Type</th>
                                    <th class="p-4">Dates</th>
                                    <th class="p-4">Reason</th>
                                    <th class="p-4">Status</th>
                                    ${State.currentUser.role === 'admin' ? '<th class="p-4 text-right">Actions</th>' : ''}
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                ${State.leaves.map(l => `
                                    <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                                        <td class="p-4 font-semibold text-slate-900 dark:text-white">${l.employee}</td>
                                        <td class="p-4 text-slate-600 dark:text-slate-400 font-medium">${l.type}</td>
                                        <td class="p-4 text-slate-600 dark:text-slate-400 text-xs">${l.start} to ${l.end}</td>
                                        <td class="p-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">${l.reason}</td>
                                        <td class="p-4">
                                            <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${l.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : l.status === 'Rejected' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'}">${l.status}</span>
                                        </td>
                                        ${State.currentUser.role === 'admin' ? `
                                            <td class="p-4 text-right space-x-2">
                                                ${l.status === 'Pending' ? `
                                                    <button onclick="window.updateLeave('${l.id}', 'Approved')" class="px-3 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-semibold rounded-lg text-xs transition">Approve</button>
                                                    <button onclick="window.updateLeave('${l.id}', 'Rejected')" class="px-3 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold rounded-lg text-xs transition">Reject</button>
                                                ` : ''}
                                            </td>
                                        ` : ''}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            window.updateLeave = (id, status) => {
                const leave = State.leaves.find(l => l.id === id);
                if (State.currentUser?.role === 'admin' && leave?.status === 'Pending' &&
                    (status === 'Approved' || status === 'Rejected')) {
                    leave.status = status;
                    showToast(`Leave application ${status}`);
                    render();
                }
            };

            return container;
        }


        function renderSwapsView() {
            const container = document.createElement('div');
            container.className = 'space-y-6 max-w-7xl mx-auto';

            container.innerHTML = `
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Shift Swap Trading Queue</h2>
                        <p class="text-sm text-slate-500">Peer-to-peer shift trade applications.</p>
                    </div>
                    <button onclick="window.openSwapModal()" class="px-4 py-2.5 rounded-xl bg-teal-600 text-white font-semibold text-sm hover:bg-teal-700 shadow-lg shadow-teal-500/25 transition flex items-center gap-2">
                        <i class="fa-solid fa-right-left"></i> Trade Shift
                    </button>
                </div>

                <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    <th class="p-4">Requester</th>
                                    <th class="p-4">Trading Partner</th>
                                    <th class="p-4">Shift Details</th>
                                    <th class="p-4">Reason</th>
                                    <th class="p-4">Status</th>
                                    ${State.currentUser.role === 'admin' ? '<th class="p-4 text-right">Actions</th>' : ''}
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                                ${State.swaps.map(s => `
                                    <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                                        <td class="p-4 font-semibold text-slate-900 dark:text-white">${s.requester}</td>
                                        <td class="p-4 text-slate-600 dark:text-slate-400 font-medium">${s.targetUser}</td>
                                        <td class="p-4 text-slate-600 dark:text-slate-400 text-xs">${s.shiftDate} (${s.shiftType})</td>
                                        <td class="p-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">${s.reason}</td>
                                        <td class="p-4">
                                            <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${s.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : s.status === 'Rejected' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'}">${s.status}</span>
                                        </td>
                                        ${State.currentUser.role === 'admin' ? `
                                            <td class="p-4 text-right space-x-2">
                                                ${s.status === 'Pending' ? `
                                                    <button onclick="window.updateSwap('${s.id}', 'Approved')" class="px-3 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-semibold rounded-lg text-xs transition">Approve</button>
                                                    <button onclick="window.updateSwap('${s.id}', 'Rejected')" class="px-3 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold rounded-lg text-xs transition">Reject</button>
                                                ` : ''}
                                            </td>
                                        ` : ''}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            window.updateSwap = (id, status) => {
                const swap = State.swaps.find(s => s.id === id);
                if (!swap || State.currentUser?.role !== 'admin' || swap.status !== 'Pending' ||
                    (status !== 'Approved' && status !== 'Rejected')) return;
                if (status === 'Approved') {
                    const shift = State.shifts.find(candidate =>
                        candidate.id === swap.shiftId ||
                        (!swap.shiftId && candidate.employee === swap.requester &&
                            candidate.date === swap.shiftDate && candidate.type === swap.shiftType)
                    );
                    const recipient = State.users.find(user => user.name === swap.targetUser);
                    if (!shift || shift.employee !== swap.requester || !recipient) {
                        showToast('The requested shift or recipient could not be found.', 'error');
                        return;
                    }
                    const recipientHasShift = State.shifts.some(candidate =>
                        candidate.id !== shift.id && candidate.employee === recipient.name && candidate.date === shift.date
                    );
                    const recipientHasLeave = State.leaves.some(leave =>
                        leave.employee === recipient.name && leave.status === 'Approved' &&
                        shift.date >= leave.start && shift.date <= leave.end
                    );
                    if (recipientHasShift || recipientHasLeave) {
                        showToast('The coworker is unavailable for this shift date.', 'error');
                        return;
                    }
                    shift.employee = recipient.name;
                    swap.shiftId = shift.id;
                }
                swap.status = status;
                showToast(`Shift swap ${status}`);
                render();
            };

            return container;
        }


        function renderAnalyticsView() {
            const container = document.createElement('div');
            container.className = 'space-y-6 max-w-7xl mx-auto';
            const payrollRows = getPayrollRows();
            const totalHours = payrollRows.reduce((total, row) => total + row.hours, 0);
            const totalCost = payrollRows.reduce((total, row) => total + row.cost, 0);
            const departmentCosts = payrollRows.reduce((totals, row) => {
                totals[row.user.department] = (totals[row.user.department] || 0) + row.cost;
                return totals;
            }, {});
            const departments = Object.entries(departmentCosts).sort((left, right) => right[1] - left[1]);
            const maxDepartmentCost = Math.max(...departments.map(([, cost]) => cost), 1);

            container.innerHTML = `
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Labor Analytics & Financial Costing (₱)</h2>
                        <p class="text-sm text-slate-500">Payroll estimates and departmental cost metrics.</p>
                    </div>
                    <button onclick="window.exportPayrollCSV()" class="px-4 py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-xs hover:bg-brand-700 shadow-lg shadow-brand-500/25 transition flex items-center gap-2">
                        <i class="fa-solid fa-file-arrow-down"></i> Export Payroll CSV
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span class="text-sm font-medium text-slate-500">Estimated Roster Cost</span>
                        <h3 class="text-3xl font-bold text-slate-900 dark:text-white mt-2">₱${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                        <p class="text-xs text-slate-500 font-medium mt-1">Planning estimate from assigned shifts</p>
                    </div>
                    <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span class="text-sm font-medium text-slate-500">Employee Hours</span>
                        <h3 class="text-3xl font-bold text-slate-900 dark:text-white mt-2">${totalHours.toFixed(1)} hrs</h3>
                        <p class="text-xs text-brand-600 font-medium mt-1">Across ${payrollRows.length} employees</p>
                    </div>
                    <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <span class="text-sm font-medium text-slate-500">Scheduled Shifts</span>
                        <h3 class="text-3xl font-bold text-slate-900 dark:text-white mt-2">${State.shifts.length}</h3>
                        <p class="text-xs text-brand-600 font-medium mt-1">Current sample roster</p>
                    </div>
                </div>

                <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 class="font-bold text-slate-900 dark:text-white mb-4">Department Cost Allocation (PHP)</h3>
                    <div class="space-y-4">
                        ${departments.map(([department, cost], index) => `
                            <div>
                                <div class="flex justify-between text-sm mb-1 font-medium">
                                    <span>${department}</span>
                                    <span class="text-slate-500">₱${cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div class="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                                    <div class="${index % 2 === 0 ? 'bg-brand-600' : 'bg-teal-500'} h-full rounded-full" style="width: ${Math.max(3, cost / maxDepartmentCost * 100)}%"></div>
                                </div>
                            </div>
                        `).join('') || '<p class="text-sm text-slate-500">No employee shifts are scheduled.</p>'}
                    </div>
                    <p class="text-xs text-slate-500 mt-5">Estimate uses sample hourly rates and the shifts currently in the roster. It is not a payroll result.</p>
                </div>
            `;
            return container;
        }


        function renderProfileView() {
            const container = document.createElement('div');
            container.className = 'space-y-6 max-w-3xl mx-auto';

            container.innerHTML = `
                <div>
                    <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Profile & Account Settings</h2>
                    <p class="text-sm text-slate-500">Manage user credentials and profile details.</p>
                </div>

                <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <form id="profile-form" class="space-y-5">
                        <div class="flex items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                            <img src="${State.currentUser.photo}" class="w-20 h-20 rounded-full object-cover border-2 border-brand-500 shadow-md" onerror="this.src='https://placehold.co/150x150/16a34a/ffffff?text=User'">
                            <div class="flex-1">
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Profile Photo URL</label>
                                <input type="text" id="prof-photo" value="${State.currentUser.photo}" class="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Full Name</label>
                                <input type="text" id="prof-name" value="${State.currentUser.name}" class="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Email Address</label>
                                <input type="email" id="prof-email" value="${State.currentUser.email}" class="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Job Title</label>
                                <input type="text" id="prof-title" value="${State.currentUser.title}" class="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Department</label>
                                <input type="text" id="prof-dept" value="${State.currentUser.department}" class="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-brand-500 outline-none">
                            </div>
                        </div>

                        <div class="flex justify-end pt-4">
                            <button type="submit" class="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 transition">
                                Save Profile Changes
                            </button>
                        </div>
                    </form>
                </div>
            `;

            setTimeout(() => {
                const form = container.querySelector('#profile-form');
                if (form) {
                    form.onsubmit = (e) => {
                        e.preventDefault();
                        State.currentUser.name = container.querySelector('#prof-name').value.trim();
                        State.currentUser.email = container.querySelector('#prof-email').value.trim();
                        State.currentUser.title = container.querySelector('#prof-title').value.trim();
                        State.currentUser.department = container.querySelector('#prof-dept').value.trim();
                        State.currentUser.photo = container.querySelector('#prof-photo').value.trim();

                        showToast('Profile settings saved successfully');
                        render();
                    };
                }
            }, 0);

            return container;
        }

render();
authReadyPromise = restoreAuthenticatedSession();
