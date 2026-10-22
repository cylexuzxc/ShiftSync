const State = {
            currentUser: null,
            currentView: 'dashboard',
            darkMode: false,
            searchQuery: '',
            calendarMonth: 9,
            calendarYear: 2026,
            calendarWeekStart: '2026-10-19',
            shiftFilter: 'All',
            timeClock: {
                isClockedIn: false,
                startTime: null,
                timerInterval: null,
                elapsedSeconds: 0
            },
            timeLogs: [
                { id: 'tl1', employee: 'Reighnier Pamintuan', date: '2026-10-22', clockIn: '08:55 AM', clockOut: '05:05 PM', duration: '8.17 hrs', status: 'Completed' },
                { id: 'tl2', employee: 'Juan Dela Cruz', date: '2026-10-22', clockIn: '09:02 AM', clockOut: '06:00 PM', duration: '8.96 hrs', status: 'Completed' },
                { id: 'tl3', employee: 'Angelica Reyes', date: '2026-10-22', clockIn: '01:58 PM', clockOut: 'Active', duration: 'Live', status: 'In Progress' }
            ],
            notifications: [
                { id: 'n1', title: 'Shift Swap Approved', desc: 'Maria Santos accepted your shift trade request for Oct 25.', time: '10 mins ago', read: false },
                { id: 'n2', title: 'New Schedule Posted', desc: 'Next week\'s enterprise roster has been published.', time: '1 hour ago', read: false },
                { id: 'n3', title: 'Leave Request Pending', desc: 'Angelica Reyes submitted a new sick leave request.', time: '3 hours ago', read: false }
            ],
            users: [
                { id: 'u1', name: 'Maria Santos', email: 'admin@shiftsync.ph', role: 'admin', title: 'HR & Operations Director', department: 'Management', bio: 'Overseeing enterprise shift operations and workforce growth.', phone: '+63 917 555 0192', location: 'Makati City, Metro Manila', rate: 380, photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
                { id: 'u2', name: 'Juan Dela Cruz', email: 'employee@shiftsync.ph', role: 'employee', title: 'Senior Software Engineer', department: 'Engineering', bio: 'Building scalable enterprise web products.', phone: '+63 928 555 8392', location: 'BGC, Taguig City', rate: 290, photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
                { id: 'u3', name: 'Angelica Reyes', email: 'angelica@shiftsync.ph', role: 'employee', title: 'Customer Success Lead', department: 'Operations', bio: 'Managing client success and team performance.', phone: '+63 939 555 3821', location: 'Cebu IT Park, Cebu', rate: 230, photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150' },
                { id: 'u4', name: 'Marcus Vance', email: 'marcus@shiftsync.ph', role: 'employee', title: 'DevOps Specialist', department: 'Engineering', bio: 'Specializing in DevOps & Cloud Infrastructure.', phone: '+63 917 888 1234', location: 'Ortigas, Pasig City', rate: 320, photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' }
            ],
            shifts: [
                { id: 's1', employee: 'Juan Dela Cruz', date: '2026-10-23', time: '09:00 - 18:00', type: 'Morning', role: 'Frontend Lead', location: 'BGC Central Branch', status: 'Confirmed' },
                { id: 's2', employee: 'Angelica Reyes', date: '2026-10-23', time: '14:00 - 23:00', type: 'Evening', role: 'Support Shift Lead', location: 'Makati Branch', status: 'Confirmed' },
                { id: 's3', employee: 'Marcus Vance', date: '2026-10-24', time: '00:00 - 08:00', type: 'Night', role: 'Cloud Reliability', location: 'Remote / Virtual', status: 'Pending' },
                { id: 's4', employee: 'Maria Santos', date: '2026-10-25', time: '08:00 - 17:00', type: 'Morning', role: 'Operations Oversight', location: 'HQ Makati', status: 'Confirmed' },
                { id: 's5', employee: 'Juan Dela Cruz', date: '2026-10-26', time: '09:00 - 18:00', type: 'Morning', role: 'Sprint Release', location: 'BGC Central Branch', status: 'Confirmed' }
            ],
            leaves: [
                { id: 'l1', employee: 'Juan Dela Cruz', type: 'Vacation', start: '2026-10-28', end: '2026-11-02', status: 'Approved', reason: 'Family vacation in Boracay' },
                { id: 'l2', employee: 'Angelica Reyes', type: 'Sick Leave', start: '2026-10-24', end: '2026-10-25', status: 'Pending', reason: 'Medical appointment and recovery' }
            ],
            swaps: [
                { id: 'sw1', requester: 'Angelica Reyes', targetUser: 'Juan Dela Cruz', shiftDate: '2026-10-23', shiftType: 'Evening', reason: 'Family engagement on Friday night', status: 'Pending' },
                { id: 'sw2', requester: 'Marcus Vance', targetUser: 'Maria Santos', shiftDate: '2026-10-24', shiftType: 'Night', reason: 'Overlapping maintenance window', status: 'Approved' }
            ]
        };
State.currentUser = null;
