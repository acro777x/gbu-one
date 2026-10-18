export interface StudentEmailAttachment {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'doc' | 'image' | 'archive';
}

export interface StudentEmail {
  id: string;
  senderName: string;
  senderEmail: string;
  senderRole: string; // e.g. 'Office of Dean Academics', 'Training & Placement Cell', 'Examination Branch'
  avatarInitial: string;
  avatarColor: string;
  subject: string;
  preview: string;
  body: string;
  dateStr: string;
  timestamp: number;
  category: 'all' | 'official' | 'academics' | 'placements' | 'hostel';
  isUnread: boolean;
  isStarred: boolean;
  hasAttachment: boolean;
  attachments?: StudentEmailAttachment[];
  priority?: 'high' | 'normal';
}

export const INITIAL_STUDENT_EMAILS: StudentEmail[] = [
  {
    id: 'mail-001',
    senderName: 'Training & Placement Cell',
    senderEmail: 'placements@gbu.ac.in',
    senderRole: 'Corporate Relations & Placement Office',
    avatarInitial: 'TP',
    avatarColor: '#FF6A2B',
    subject: 'Campus Recruitment Drive 2026: Tech Mahindra & TCS Digital Schedule',
    preview: 'Eligible B.Tech CSE / IT / ECE final & pre-final year students must register before Oct 25. Online assessment link enclosed...',
    body: `Dear Students,\n\nGreetings from the Corporate Relations and Placement Cell, Gautam Buddha University.\n\nWe are pleased to announce the upcoming on-campus recruitment drive for Tech Mahindra and TCS Digital for the batch of 2026.\n\nKey Highlights:\n1. Eligibility: B.Tech (CSE, IT, ECE) / MCA with min. 65% or 7.0 CGPA aggregate.\n2. Online Cognitive & Technical Assessment: Saturday, 26 October 2026, 10:00 AM at Computing Labs 1-4 (SOICT).\n3. CTC Package: 7.5 LPA - 12.0 LPA based on technical interview performance.\n\nPlease verify your registered resume on the university placement portal and ensure all certificates are up to date.\n\nBest wishes,\nDr. Vivek Kumar\nHead, Placement & Corporate Relations\nGBU Greater Noida`,
    dateStr: 'Today, 09:15 AM',
    timestamp: Date.now() - 3600000 * 2,
    category: 'placements',
    isUnread: true,
    isStarred: true,
    hasAttachment: true,
    attachments: [
      { id: 'att-1', name: 'Placement_Drive_Eligibility_Schedule.pdf', size: '1.2 MB', type: 'pdf' },
      { id: 'att-2', name: 'Assessment_Syllabus_Guide.pdf', size: '850 KB', type: 'pdf' },
    ],
    priority: 'high',
  },
  {
    id: 'mail-002',
    senderName: 'Dean of Academic Affairs',
    senderEmail: 'dean.academics@gbu.ac.in',
    senderRole: 'Office of the Dean, Gautam Buddha University',
    avatarInitial: 'DA',
    avatarColor: '#F5B83D',
    subject: 'Notification: Mid-Semester Autumn 2026 Schedule & 75% Attendance Requirement',
    preview: 'As per academic ordinances, students with attendance below 75% will be detained from appearing in mid-term examinations...',
    body: `Notice to all Undergraduate & Postgraduate Students,\n\nThis is to notify that the Mid-Semester Examinations for the Autumn Semester 2026 will commence from Monday, 3 November 2026.\n\nPlease note:\n• The minimum mandatory attendance required to appear in the examinations is 75% in each registered course as per university ordinance clause 4.2.\n• Attendance condonation applications on medical grounds must be submitted to the respective Dean's Office latest by 28 October 2026.\n• Detailed date-sheets have been uploaded on the university portal.\n\nSd/-\nDean, Academic Affairs\nGautam Buddha University`,
    dateStr: 'Yesterday',
    timestamp: Date.now() - 3600000 * 24,
    category: 'academics',
    isUnread: true,
    isStarred: false,
    hasAttachment: true,
    attachments: [
      { id: 'att-3', name: 'Mid_Sem_Guidelines_Autumn2026.pdf', size: '2.4 MB', type: 'pdf' },
    ],
    priority: 'high',
  },
  {
    id: 'mail-003',
    senderName: 'Registrar Secretariat',
    senderEmail: 'registrar@gbu.ac.in',
    senderRole: 'Central Administrative Office',
    avatarInitial: 'RG',
    avatarColor: '#3DD68C',
    subject: 'Official Circular: National Youth Festival & Abhivyanjana 2026 Delegate Selection',
    preview: 'Auditions for university contingents representing GBU at AIU National Youth Festival will be held in the Main Auditorium...',
    body: `Respected Faculty and Dear Students,\n\nGBU will be participating in the 38th Inter-University National Youth Festival organized under the aegis of the Association of Indian Universities (AIU).\n\nAuditions for Music, Dance, Literary Arts, and Fine Arts categories are scheduled for 29th and 30th October 2026 at the Main Auditorium.\n\nAll interested students are encouraged to register through their school cultural coordinators.\n\nRegards,\nRegistrar\nGautam Buddha University`,
    dateStr: '2 days ago',
    timestamp: Date.now() - 3600000 * 48,
    category: 'official',
    isUnread: false,
    isStarred: true,
    hasAttachment: false,
  },
  {
    id: 'mail-004',
    senderName: 'Chief Warden Office',
    senderEmail: 'chiefwarden@gbu.ac.in',
    senderRole: 'Hostel Affairs & Student Residence Council',
    avatarInitial: 'CW',
    avatarColor: '#8B5CF6',
    subject: 'Hostel Advisory: Mess Menu Revisions & Biometric Attendance Sync',
    preview: 'Following the joint student-warden meeting, updated autumn mess menus and night attendance guidelines are effective from Monday...',
    body: `Dear Hostellers,\n\nPursuant to the recommendations of the Student Mess Committee, the revised menu for Birsa Munda, Guru Nanak, and Rani Laxmi Bai Hostels has been finalized.\n\nAdditionally, all residents are reminded that biometric check-in at hostel entry gates must be completed prior to 10:00 PM on weekdays.\n\nIn case of late library or lab work, prior out-pass approval through the GBU One student portal or department head is mandatory.\n\nWarm regards,\nOffice of the Chief Warden\nHostel Affairs Council`,
    dateStr: '3 days ago',
    timestamp: Date.now() - 3600000 * 72,
    category: 'hostel',
    isUnread: false,
    isStarred: false,
    hasAttachment: true,
    attachments: [
      { id: 'att-4', name: 'Hostel_Revised_Mess_Menu_2026.pdf', size: '640 KB', type: 'pdf' },
    ],
  },
  {
    id: 'mail-005',
    senderName: 'Central Bodhisattva Library',
    senderEmail: 'library@gbu.ac.in',
    senderRole: 'University Resource & Digital Library',
    avatarInitial: 'BL',
    avatarColor: '#06B6D4',
    subject: 'Reminder: Renew Borrowed Books & Remote IEEE/ACM Portal Access',
    preview: 'Students with overdue book issues are requested to renew online or deposit at circulation desk before end of month to waive fines...',
    body: `Dear Scholar/Student,\n\nThis is a courtesy reminder from the Central Bodhisattva Library.\n\nStudents who currently have books issued for more than 14 days may renew their borrowings via the university OPAC portal or at the circulation counter.\n\nFurthermore, off-campus VPN access for IEEE Xplore, ScienceDirect, and ACM Digital Library has been extended for all registered students. Use your GBU university email credentials to log in.\n\nHappy Learning,\nChief Librarian\nGBU Central Library`,
    dateStr: '4 days ago',
    timestamp: Date.now() - 3600000 * 96,
    category: 'academics',
    isUnread: false,
    isStarred: false,
    hasAttachment: false,
  },
];
