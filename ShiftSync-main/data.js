// Sample data only. In Stage 3 this is replaced by fetch() calls to a PHP/MySQL API.
// Demo password for every account: demo123  (NOT real authentication)

// Date helpers (local time, YYYY-MM-DD strings)
function mon(d){d=new Date(d);d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d}
function add(d,n){d=new Date(d);d.setDate(d.getDate()+n);return d}
function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}

const DB = {
  users: [
    {id:1,no:'A001',name:'Maria Santos',email:'admin@shiftsync.demo',role:'admin',dept:'Operations'},
    {id:2,no:'E101',name:'Ana Reyes',email:'ana@shiftsync.demo',role:'employee',dept:'Front Desk'},
    {id:3,no:'E102',name:'Ben Cruz',email:'ben@shiftsync.demo',role:'employee',dept:'Kitchen'},
    {id:4,no:'E103',name:'Carla Lim',email:'carla@shiftsync.demo',role:'employee',dept:'Front Desk'},
    {id:5,no:'E104',name:'Dan Tan',email:'dan@shiftsync.demo',role:'employee',dept:'Kitchen'}
  ],
  shifts: [
    {id:1,name:'Morning',start:'07:00',end:'15:00',color:'#2563eb'},
    {id:2,name:'Mid',start:'11:00',end:'19:00',color:'#7c3aed'},
    {id:3,name:'Evening',start:'15:00',end:'23:00',color:'#0891b2'}
  ],
  schedules: [],
  leaves: [
    {id:1,emp:2,type:'Vacation',start:ymd(add(new Date(),10)),end:ymd(add(new Date(),12)),reason:'Family trip',status:'pending',remarks:''},
    {id:2,emp:3,type:'Sick',start:ymd(add(new Date(),3)),end:ymd(add(new Date(),3)),reason:'Medical check-up',status:'pending',remarks:''},
    {id:3,emp:2,type:'Personal',start:ymd(add(new Date(),-20)),end:ymd(add(new Date(),-20)),reason:'Errands',status:'approved',remarks:'Enjoy!'},
    {id:4,emp:4,type:'Vacation',start:ymd(add(new Date(),-9)),end:ymd(add(new Date(),-7)),reason:'Beach weekend',status:'rejected',remarks:'Short staffed that week.'}
  ]
};

// Seed weekday shifts for employees, 1 week back to 2 weeks ahead
let sid = 1;
for (let i = -7; i < 14; i++) {
  const d = add(new Date(), i);
  if (d.getDay() % 6 === 0) continue; // skip Sat/Sun
  [2,3,4,5].forEach((e,k) => DB.schedules.push({id:sid++,emp:e,shift:(k+i+10)%3+1,date:ymd(d),notes:''}));
}
