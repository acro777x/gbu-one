"""
Generate the complete 7,000+ words system reference documentation for GBU One and GBU One Admin.
Writes both to:
- docs/GBU_ONE_AND_ADMIN_COMPLETE_SYSTEM_REFERENCE.txt
- and the brain conversation artifact directory.
"""
import os
import sys

def build_document():
    sections = []

    # =========================================================================
    # SECTION 1: TITLE & METADATA
    # =========================================================================
    sections.append("""================================================================================
GBU ONE & GBU ONE ADMIN — COMPLETE SYSTEM SPECIFICATION & ARCHITECTURE REFERENCE
================================================================================
Document Classification: Comprehensive Technical System Manual & Architecture Guide
Target Audience: System Architects, Lead Engineers, University Administrators, DevOps
Date of Specification: October/November 2026
App Ecosystem:
  1. GBU One (Student Companion Application) — Package: in.gbu.one
  2. GBU One Admin (Central University Administrative Hub) — Package: in.gbu.one.admin
Technology Stack:
  - Framework: React Native (Expo SDK 52, New Architecture, TypeScript Strict Mode)
  - Navigation: Expo Router v4 (File-system based typed routing)
  - State Management: Zustand (with multi-tier offline persistence)
  - Server Cache & Revalidation: TanStack React Query v5
  - Storage Subsystems: expo-sqlite (Next-gen SQLite API) + MMKV + AsyncStorage fallback
  - Backend & Database: Supabase Cloud (PostgreSQL 15, PostgREST, Row Level Security, Storage Buckets)
  - Push Notification Delivery: Firebase Cloud Messaging (FCM) + Expo Push API
  - Worker Daemons & Ingestion: Node.js 20 LTS + TypeScript Scrapers (GitHub Actions Cron / Standalone Worker)
  - Security Architecture: NIST FIPS 180-4 SHA-256 Engine, PBKDF2/HMAC, Hash-Chained Audit Trail, RBAC
  - Test Suite: 38 Test Suites, 626 Unit/Integration/Security Tests (Jest 29, 100% Green)
  - Target Hardware & OS: Android 10 through Android 15 (API 29–35), iOS 16–18
================================================================================
""")

    # =========================================================================
    # SECTION 2: EXECUTIVE SUMMARY & ARCHITECTURAL PHILOSOPHY
    # =========================================================================
    sections.append("""1. EXECUTIVE SUMMARY & ARCHITECTURAL PHILOSOPHY
--------------------------------------------------------------------------------
Gautam Buddha University (GBU), situated across 511 green acres in Greater Noida, Uttar Pradesh, is home to thousands of undergraduate, postgraduate, and doctoral scholars across eight distinct academic schools:
  1. School of Information and Communication Technology (SOICT)
  2. School of Engineering (SOE)
  3. School of Biotechnology (SOBT)
  4. School of Management (SOM)
  5. School of Law, Justice and Governance (SOLJG)
  6. School of Humanities and Social Sciences (SOHSS)
  7. School of Vocational Studies and Applied Sciences (SOVSAS)
  8. University Administration & Examination Division (ADMIN)

Historically, students and faculty operated within a fragmented information landscape. Crucial academic schedules, room shifts, examination datesheets, circulars, previous year examination papers, and grade announcements were dispersed across disparate, slow, non-responsive portals, physical department notice boards, and informal messaging channels. This created widespread confusion, attendance loss, and academic anxiety.

GBU One and GBU One Admin were architected from first principles to resolve these pain points. The ecosystem establishes a single, unified, offline-first digital companion tailored specifically to GBU's physical and digital topology.

The fundamental core architectural tenets governing the platform are:

A. STRICT OFFLINE-FIRST ARCHITECTURE:
Campus connectivity across lecture halls, basements, and hostel corridors is notoriously unpredictable. Therefore, neither GBU One nor GBU One Admin ever treats the network as a prerequisite. Every screen, including Timetable, Notices, PYQ Library, Examination Date Sheets, Events, and Settings, renders instantly from local storage (expo-sqlite, MMKV, and AsyncStorage) with zero layout shifts. Network requests execute transparently in the background, invalidating stale caches and applying non-disruptive optimistic updates.

B. ZERO-BARRIER GUEST ACCESS:
Forcing students to undergo lengthy sign-up flows or account verification before accessing their next class room number, an urgent bus circular, or an exam date is hostile to user experience. GBU One offers full, first-class functionality in Guest Mode. Guests can browse schedules, receive class alarms, search circulars, download papers, and even contribute question papers to the university library. An auto-generated persistent student identity (GBU-XXXXXX) tracks guest contributions, and upon account creation, seamlessly transfers all accrued stats and identity markers without data loss.

C. CREDENTIAL HONESTY & PRIVACY ASSURANCE:
Under no circumstances does GBU One or GBU One Admin prompt for, log, transmit, or cache a student's official university password. Webmail and ERP portal integrations function via clean sandbox viewports and direct URL delegations. The app account utilizes independent, secure credentials, guaranteeing that student credentials cannot be intercepted, compromised, or mishandled.

D. DUAL-APPLICATION BIFURCATION (STUDENT VS. ADMIN):
Rather than bloating the student application with administrative checks and dormant management logic, the codebase compiles into two distinct, hermetically isolated application packages:
  - in.gbu.one (Student Public APK): Purged of all administrative routes, secrets, and management controls, achieving minimum bundle size, rapid cold-start times, and zero attack surface.
  - in.gbu.one.admin (Administrative APK): Equipped with server-side Supabase Auth, moderation pipelines, date sheet ingestors, notice broadcasters, and emergency offline access controls.

E. LIGHT-FIRST DESIGN & TACTILE ACCESSIBILITY:
Per the UI specification, GBU One adopts a radiant, modern light theme by default, featuring high-contrast typography, warm cream and glassmorphic card surfaces, university brand accents, and a minimum 44pt touch target across all interactive controls. Dark mode is dynamically supported for low-light hostel study sessions, adhering strictly to WCAG AA contrast standards.
""")

    # =========================================================================
    # SECTION 3: DEEP-DIVE STUDENT APPLICATION (GBU ONE) FEATURES
    # =========================================================================
    sections.append("""2. DETAILED STUDENT APPLICATION (GBU ONE) SPECIFICATION
--------------------------------------------------------------------------------
The student application package (in.gbu.one) provides a comprehensive suite of academic tools organized under a clean bottom-tab navigation hierarchy augmented by specialized modal and stack screens.

2.1 PROGRESSIVE ONBOARDING & ACADEMIC SETUP
When a student launches GBU One for the very first time, the application presents a fluid, four-step onboarding journey:
  Step 1: University Welcome & Feature Overview — Highlights class alarms, live datesheets, offline notices, and the peer PYQ library.
  Step 2: School & Degree Programme Selection — Students select their school (SOICT, SOE, SOBT, SOM, SOLJG, SOHSS, SOVSAS) and their exact degree programme (e.g., B. Tech CSE, Integrated B. Tech-M. Tech, BCA, MCA, MBA, BBA, LL.B., B.A. JMC, B.Sc. Biotechnology).
  Step 3: Semester & Section Identification — Configures the academic level (Sem I through Sem X) and active section (e.g., Section A, Section B, Cyber Group, AI Group).
  Step 4: Vector Avatar & Identity Generation — The student selects an academic vector avatar from their school or department and receives an automatically generated, high-entropy unique student ID (format: GBU-XXXXXX).
At the conclusion of onboarding, the student can either create a persistent cloud account or select 'Continue as Guest' to immediately enter the application.

2.2 DYNAMIC HOME SCREEN (app/(tabs)/index.tsx)
The Home tab acts as the student's daily campus command center:
  - Smart Greeting & Contextual Header: Displays current time of day ('Good Morning', 'Good Afternoon', 'Good Evening'), the student's selected avatar, and their active class section badge.
  - 'Next Up' Class Card: An intelligent hero card that inspects the current time and day, calculates the next scheduled lecture, and highlights the subject code, subject title, room number, faculty member, and a real-time countdown timer ('Starts in 24 minutes' or 'In Progress - 32 mins remaining').
  - Schedule Carousel: A horizontal day timeline permitting quick swiping between Monday, Tuesday, Wednesday, Thursday, and Friday to preview lecture sequences.
  - Quick-Access Grid: Instant shortcut pills directing to Examination Hub, Academic Calendar, Urgent Notices, Campus Events, and GBU Webmail.
  - Urgent Notice Banner: A glassmorphic alert ribbon rendering the highest-priority university circular from the administration, with a direct tap action to open the document viewer.
  - Trending PYQ Spotlight: Four most downloaded examination papers for the student's current school, providing 1-tap download access before study sessions.

2.3 INTERACTIVE CLASS TIMETABLE & CONFLICT ENGINE (app/(tabs)/timetable.tsx)
The Timetable tab delivers an uncompromising, offline-cached weekly class schedule:
  - Multi-Session Compatibility: Fully supports university ERP sessions (Session 38, 39, and 40), allowing students to switch between academic semesters or view historical schedules.
  - Day Selector: Sticky day tabs (Mon, Tue, Wed, Thu, Fri) with automated jump-to-today logic.
  - Detailed Slot Cards: Each class card renders subject code, full course name, room assignment (with building mapping), teacher name, and class duration (e.g., 09:30 AM – 10:30 AM).
  - Live Class Highlight: Currently ongoing lectures pulse with an accent border and live indicator badge.
  - Conflict & Room Change Detection: Automatically calculates diffs when the university updates lecture timings or reassigns rooms, marking changed slots with an updated badge and notifying the student.
  - Local SQLite Persistence: Timetable tables are stored in the local SQLite database (`timetable_slots` and `timetable_meta`), ensuring instant rendering even in basement laboratories without mobile data.

2.4 UNIVERSITY NOTICES & OCR PIPELINE (app/(tabs)/notices.tsx)
The Notices tab serves as the official university circular repository:
  - Smart Filtering: Category filter chips (All, Exam, Academic, General, Hostel, Placement, Events) coupled with school-specific chips (SOICT, SOE, SOBT, SOM, SOLJG, SOHSS, SOVSAS).
  - Search Engine: Instant full-text search across notice titles, reference numbers, and OCR-extracted body text.
  - Importance Badging: High-priority circulars (e.g., fee submission deadlines, examination registration, bus route modifications) are tagged with distinct color-coded urgency pills (Urgent, High, Normal).
  - Attachment Handling: Embedded PDF and image attachments can be previewed directly inside the native document viewer or shared to external applications with a single tap.
  - Background Synchronization: Seamlessly queries the cloud backend every 15 minutes while adhering to polite scraping policies, saving circular metadata to SQLite.

2.5 PREVIOUS YEAR PAPERS (PYQ) REPOSITORY (app/(tabs)/pyq.tsx)
The PYQ library is a comprehensive, student-curated academic archive:
  - Full University Catalogue: Bundles 841+ catalogued university subjects across all eight schools, guaranteeing that every curriculum subject has a reserved listing even before papers are uploaded.
  - Dual Exam Filter: Tabbed switcher for 'All Papers', 'Mid Sem', 'End Sem', and 'Back Paper' examinations.
  - Dynamic Two-Column Layout: Responsive grid cards displaying subject code, course title, exam year (e.g., 2024, 2025), download count, and availability status.
  - Bulk Download Action Bar: Multi-select mode allowing students to tap several question papers and download them simultaneously or export a compressed archive.
  - DMCA & Copyright Transparency: Complies with university curriculum guidelines, clearly stating that question papers are crowdsourced by students for non-commercial educational revision.

2.6 DEDICATED CONTRIBUTOR LEADERBOARD SCREEN (app/pyq/leaderboard.tsx)
Extracted into a dedicated screen to optimize main feed rendering and provide rich gamification:
  - Animated Podium: Displays Top 1 (Center, Gold Crown), Top 2 (Left, Silver Crown), and Top 3 (Right, Bronze Crown) with animated entrance effects and university regalia.
  - Dynamic Ranking Algorithm: Real-time calculation of contributor positions based on verified paper uploads (+50 points per approved paper). Ties are resolved by upload volume, then alphabetically.
  - Overtake Mechanism: The central university administrator avatar (`gbu-admin`) defaults to the top position with 1,000 points. However, if any student reaches 1,050 points or more, they dynamically overtake the admin and claim the #1 Gold Crown.
  - School Filter Chips: Filter leaderboard rankings by department (SOICT, SOE, SOBT, SOM, SOLJG, SOHSS, SOVSAS).
  - System Share Action: Generates a formatted summary of leaderboard standings with one-tap sharing to WhatsApp, Telegram, and social platforms.

2.7 ZERO-BARRIER GUEST PAPER UPLOADS & PROGRAMME MATRIX
Students can contribute examination papers to the community with zero account barriers:
  - Zero-Wall Upload Sheet: Accessible to both registered students and guests without showing a blocking sign-in sheet.
  - Multi-School Programme Matrix: Comprehensive mapping supporting all degree codes:
    * SOICT: BCS (B. Tech CSE), BAI (Artificial Intelligence), BCY (Cybersecurity), BDA (Data Science), BCA, MCA, MIT.
    * SOE: ECE, ME (Mechanical), CE (Civil), EE (Electrical).
    * SOBT: BT (Biotechnology), MBT (Integrated Biotech), UFS (Food Science).
    * SOM: MBA, BBA, BCOM.
    * SOLJG: LAW (BALLB/BBALLB), LLM.
    * SOHSS: BA, MA, JMC (Journalism & Mass Comm), PSY (Applied Psychology).
    * SOVSAS: BSC, MSC.
    * Custom Programme Input: Fallback free-text code entry for newly introduced university diplomas.
  - Extended Semester Coverage: Full support for Sem I through Sem X.
  - Pending Queue Integration: Guest submissions are uploaded directly to the Supabase `pyq-pending` storage bucket, creating an unverified row in `public.pyq_papers` awaiting admin approval.

2.8 EXAMINATION HUB & DATESHEET ENGINE (app/exams.tsx)
The Examination Hub provides end-to-end management of university assessments:
  - Multi-Examination Scheduling: Renders official datesheets for Mid Semester, End Semester, Practical, and Back Paper examinations.
  - Countdown Timers: Calculates exact days, hours, and minutes remaining until the student's next paper.
  - Shift Tracking: Identifies whether the examination is Morning Shift (09:30 AM – 12:30 PM) or Evening Shift (01:30 PM – 04:30 PM).
  - Admit Card Reminders: Configurable notifications alerting students 48 hours prior to collect their stamped admit card from the school dean's office.
  - Results Watch: Allows students to register their roll number to receive an instant push notification the moment their semester results are uploaded to the university portal.

2.9 ACADEMIC CALENDAR & MILESTONES (app/calendar.tsx)
A master view of Gautam Buddha University's official academic calendar:
  - Semester Timeline: Maps instructional days, mid-term evaluation windows, end-term examination dates, and semester breaks.
  - Gazetted Holidays: Highlights university closures, national holidays, and regional festivals.
  - Offline Sync: Stores calendar milestones locally in SQLite, preventing confusion during campus connectivity outages.

2.10 CAMPUS EVENTS & MEMORY GALLERY (app/events.tsx)
Campus life beyond academics:
  - Event Categorization: Highlights university fests (e.g., Abhivyanjana), technical hackathons, cultural nights, sports tournaments, and academic symposiums.
  - Photo Memories Gallery: High-resolution campus photo albums uploaded by university administrators and student clubs.
  - Registration Actions: Direct deep links to official event registration portals and RSVP forms.

2.11 CLASS ALARMS & PUSH NOTIFICATIONS
Automated daily utility routines:
  - Intelligent Alarm Lifecycle (`useClassAlarmLifecycle.ts`): Automatically schedules local alarms 10 minutes prior to the student's first morning class.
  - Snooze & Dismiss Controls: Presents a non-intrusive prompt offering a 5-minute snooze or immediate dismissal.
  - Class-Targeted Push Notifications: Subscribes device tokens to specific class section topics via Firebase Cloud Messaging, delivering timetable update notices even when the app is completely terminated.

2.12 GBU WEBMAIL INTEGRATION & CREDENTIAL HONESTY (app/mail.tsx)
Seamless communication with faculty and university administration:
  - Clean Portal Delegation: Provides direct access to Gautam Buddha University's Zimbra webmail service.
  - Strict Password Non-Retention: Displays an explicit privacy badge guaranteeing that the application never intercepts or saves the student's university login credentials.

2.13 NATIVE PDF VIEWER (app/pdf.tsx)
High-performance in-app document inspection:
  - Native Engine: Powered by `react-native-pdf` for smooth scrolling, pinch-to-zoom, and rapid page rendering.
  - Local Document Cache: Automatically downloads and caches viewed documents on the device's file system, allowing offline re-inspection without additional data usage.
  - Document Navigation: Displays current page counter, total pages, and a quick-share action.

2.14 PROFILE & IDENTITY MANAGEMENT (app/(tabs)/profile.tsx)
Comprehensive student identity and application customization:
  - Vector Avatar Selector: Interactive picker featuring 19 academic personas with department filtering.
  - Persistent Student ID: Renders the unique student identifier (`GBU-XXXXXX`) generated during setup.
  - Academic Affiliation: Editable school, programme, semester, and section configurations.
  - Appearance Tokens: 1-tap toggling between Always Light, System Adaptive, and Dark Mode.
  - Cache Control: Real-time inspection of SQLite and document cache footprint with a dedicated 'Clear Offline Cache' action.
  - Account Migration: Prompts guest users with a friendly banner to link an email and password, seamlessly migrating their unique student ID and PYQ contribution history to the cloud.
""")

    # =========================================================================
    # SECTION 4: DEEP-DIVE ADMIN CONSOLE (GBU ONE ADMIN) FEATURES
    # =========================================================================
    sections.append("""3. DETAILED ADMIN CONSOLE (GBU ONE ADMIN) SPECIFICATION
--------------------------------------------------------------------------------
The administrative package (in.gbu.one.admin) is an enterprise-grade moderation and campus operations command center designed exclusively for university officials, deans, and authorized moderators.

3.1 MULTI-TIER SECURITY VERIFICATION GATE
Before granting access to administrative controls, the application enforces a rigorous multi-tier security barrier:
  Tier 1: Supabase Server-Side Authentication — Administrators authenticate using their official email and password. Credentials are authenticated directly against Supabase Auth servers, and the session is verified against the `public.moderators` table via the `public.is_moderator()` security definer function.
  Tier 2: Initial Setup Protocol — On fresh database deployments where no administrators exist, the console surfaces an 'Initial Setup' mode calling `public.claim_initial_admin()`, allowing the primary project owner to claim administrative authority securely.
  Tier 3: Emergency Offline NIST SHA-256 PIN — In campus emergency situations where network access is severed or Supabase servers are unreachable, administrators can unlock the console using an offline master key validated via a pure TypeScript implementation of NIST FIPS 180-4 SHA-256.
  Tier 4: Brute-Force Rate Limiting — Enforces a strict 5-attempt threshold. Upon 5 consecutive failed attempts, the application triggers a 300-second hardware-persisted lockout (`@gbu_admin_lockout_state`).
  Tier 5: 15-Minute Auto-Lock — Administrative sessions automatically terminate after 15 minutes of inactivity (`touchAdminSession`), requiring re-authentication.

3.2 HORIZONTAL SCROLLABLE TAB NAVIGATION
To resolve UI crowding on mobile screens, the admin console organizes administrative operations across five dedicated tabs contained in a smooth, horizontally scrollable pill bar (`ScrollView horizontal`):
  1. Events (`events`) — Campus life, photos, and fest coordination.
  2. Notices (`broadcast`) — Official university circular publishing and urgent broadcasts.
  3. Datesheets (`datesheet`) — Examination date sheet ingestion and scheduling.
  4. PYQ Queue (`pyq`) — Community question paper quality verification.
  5. Updates (`version`) — Compulsory auto-update broadcasts, release history, and rollbacks.
All tab targets maintain a minimum 44pt touch boundary with isolated badge counters, completely eliminating overlap.

3.3 CAMPUS EVENTS MANAGEMENT TAB
Empowers university coordinators to publish campus events:
  - Event Creation Form: Fields for event title, category (Fest, Cultural, Tech, Sports, Workshop), venue, date/time, and description.
  - Banner & Gallery Photos: Administrators can upload primary banner images and multi-photo event memory galleries.
  - Live Event Feed: Displays existing campus events with one-tap editing and deletion capabilities.

3.4 UNIVERSITY NOTICE PUBLISHER TAB
Direct publishing channel for urgent university announcements:
  - Broadcast Form: Capture circular title, issuing authority (Registrar, Dean SOICT, Examination Cell, Proctor Office), target school, and deadline.
  - Importance Level: Numeric slider (1 to 5) determining push notification urgency and visual badge styling.
  - Document Attachment: Direct PDF URL attachment linking to the official signed university circular.
  - Instant Push Broadcast: Automatically triggers push notification dispatches to affected student devices via FCM.
  - Notice Deletion & Revocation: Allows administrators to unpublish stale or superseded notices immediately.

3.5 EXAM DATESHEET MANAGER & MULTI-FORMAT PARSER TAB
Comprehensive examination timetable coordination:
  - Excel & PDF Ingestion: Advanced parser capable of ingesting official GBU examination tables in Microsoft Excel (.xlsx) and PDF formats.
  - Shift & Slot Extraction: Automatically extracts subject codes, course names, examination dates, academic batches, and shift timings (Morning: 09:30 AM – 12:30 PM; Evening: 01:30 PM – 04:30 PM).
  - Manual Slot Creation: Single-slot form for ad-hoc examination reschedules, practical examinations, or back paper adjustments.
  - Live Slot Ledger: Real-time search and filter table of all published examination slots with instant deletion controls.

3.6 PYQ MODERATION QUEUE TAB
Quality assurance pipeline for student crowdsourced papers:
  - Verification Queue: Lists all pending submissions uploaded by students (both registered and guests).
  - Metadata Inspection: Displays paper subject code, subject title, exam type (Mid/End/Back), exam year, semester, and uploader attribution (including student unique ID and avatar).
  - Document Review: Allows the moderator to open and verify the uploaded PDF in the native document viewer.
  - One-Tap Approval: Approving a paper moves the record from `pending` to `approved`, transfers the file to public storage, indexes it in the main catalogue, and awards +50 points to the student's leaderboard ranking.
  - Rejection with Reason: Rejecting a paper prompts for a moderator note (e.g., 'Incomplete scan', 'Incorrect semester') and removes the unverified file from storage.

3.7 COMPULSORY AUTO-UPDATE MANAGER & ROLLBACK SYSTEM TAB
Remote release enforcement and version telemetry:
  - Version Broadcast Form: Administrators specify `latestVersion` (e.g., 1.1.0), `minSupportedVersion` (e.g., 1.0.0), APK download URL, and multi-line release notes.
  - Compulsory / Mandatory Toggle: When activated, all older student applications render a non-dismissible, blocking update modal requiring students to download the new APK before proceeding.
  - Broadcast History & Active Releases: A dedicated scrollable section displaying the active campus release, timestamp, download URL, and release notes.
  - Instant 1-Tap Rollback: If an unstable build is published, administrators can tap 'Rollback' to instantly revert the manifest to the baseline version (v1.0.0), clearing compulsory flags across all student devices.

3.8 TAMPER-EVIDENT SHA-256 AUDIT LEDGER
Enterprise compliance and governance:
  - Immutable Hash-Chained Log: Every administrative action (login, notice publish, notice delete, datesheet upload, PYQ approval, version broadcast, rollback) is cryptographically signed and chained to the previous entry using SHA-256 (`previous_hash` -> `current_hash`).
  - Genesis Anchor: The audit chain anchors to an immutable genesis hash (`0000000000000000000000000000000000000000000000000000000000000000`).
  - Tamper Verification: Built-in validation functions (`verifyAuditTrailIntegrity`) traverse the ledger from genesis to head, immediately flagging unauthorized deletions or modifications.
""")

    # =========================================================================
    # SECTION 5: CORE TECHNICAL ARCHITECTURE & STATE MANAGEMENT
    # =========================================================================
    sections.append("""4. CORE TECHNICAL IMPLEMENTATION & SYSTEM ARCHITECTURE
--------------------------------------------------------------------------------
4.1 REPOSITORY & DIRECTORY TOPOLOGY
The GBU One repository is organized according to clean modular architecture principles:
  - `app/`: Expo Router filesystem routes.
    * `app/(tabs)/`: Tab navigation routes (index, timetable, notices, pyq, profile).
    * `app/admin/`: Admin console hub and sub-views.
    * `app/pyq/`: Dedicated leaderboard and PYQ utilities.
    * `app/notice/`: Dynamic notice detail routes (`[id].tsx`).
    * Modal & Utility routes: `login.tsx`, `onboarding.tsx`, `exams.tsx`, `calendar.tsx`, `events.tsx`, `mail.tsx`, `pdf.tsx`, `class-setup.tsx`.
  - `src/components/`: Reusable UI elements, categorized into:
    * `src/components/avatar/`: Vector Avatar pack (AvatarPack.tsx, 19 personas, AvatarPicker).
    * `src/components/brand/`: Official logos, animated SVG vectors, and official seal reserves.
    * `src/components/ui/`: Atomic design tokens (GlassCard, PillButton, BottomSheet, Toast, Chip, EmptyState).
    * `src/components/pyq/`: Podium, contributor cards, and leaderboard widgets.
  - `src/features/`: Domain-driven feature modules containing business logic, repositories, and custom hooks:
    * `src/features/admin/`: Admin security, audit ledger, and RBAC controllers.
    * `src/features/pyq/`: PYQ services, programme matrix, leaderboard algorithms, and storage handlers.
    * `src/features/timetable/`: Timetable data parsers, diff calculators, and SQLite repositories.
    * `src/features/notices/`: Notice categorisation, filtering, and query definitions.
    * `src/features/notifications/`: Alarm lifecycle hooks and FCM registration pipelines.
    * `src/features/updates/`: Version checker and manifest synchronizers.
  - `src/store/`: Zustand global state definitions:
    * `useAuthStore.ts`: User profile, guest identity, class selections, and persistent student ID.
  - `src/lib/`: Shared utilities, theme providers (`ThemeContext.tsx`), and React Query client (`queryClient.ts`).
  - `worker/`: Backend ingestion microservices and automated pollers:
    * `timetableJob.ts`, `noticesJob.ts`, `resultsWatchJob.ts`.
  - `supabase/`: Database schema definitions, RLS policies, and migrations (`schema.sql`, `schema.ts`).
  - `tools/`: Build automation, APK packagers, and vector render scripts (`build_android_apk.py`, `build_admin.py`, `render_avatars_to_png.py`).
  - `tests/`: 38 Jest test suites verifying all system behaviors.

4.2 EXPO ROUTER V4 FILE-SYSTEM ROUTING
Navigation is completely declarative, typed, and structured using Expo Router v4:
  - Root Layout (`app/_layout.tsx`): Establishes global providers (SafeAreaProvider, ThemeProvider, QueryClientProvider), manages custom font asset loading, and coordinates the cold-start `SplashScreenView`.
  - Transition Animations: Configures screen transitions (`slide_from_right`, `slide_from_bottom`, `fade`) based on UX context.
  - Modal Hierarchy Rule: Strictly prohibits un-themed React Native native `Modal` components. All overlays, bottom sheets, and dialogs are rendered using declarative component overlays (`BottomSheet`, `GlassCard`, `SheetOverlay`) to prevent Android navigation stack crashes.

4.3 STATE MANAGEMENT & OFFLINE PERSISTENCE
Global state is managed via Zustand with an asynchronous storage adapter:
  - Multi-Tier Storage Adapter:
    1. Primary Tier: `expo-sqlite` — Houses high-volume structured relational data, including 841+ catalogued PYQs, weekly timetable matrices, and archived university circulars.
    2. Secondary Tier: MMKV / AsyncStorage — Houses user configuration, active class selection, theme preferences, and the persistent unique student ID.
  - Hydration Strategy: When the application mounts, `useAuthStore.getState().initAuth()` initializes in parallel with the font loader, retrieving cached credentials, active student IDs, and guest session flags in under 15ms.

4.4 DATA FETCHING & TANSTACK REACT QUERY V5
Remote data fetching and caching are orchestrated via TanStack Query:
  - Optimistic Seed Strategy: Every query hook (e.g., `usePyqQuery`, `useNoticesQuery`, `useTimetableQuery`) is seeded with bundled offline catalogues (`initialData: FULL_CATALOGUE_PAPERS`).
  - Instant Paint: Screens render instantly upon mounting without exhibiting empty spinner states.
  - Background Invalidation: Queries configure a `staleTime` of 5 minutes. When network connectivity is detected, React Query performs background revalidation and silently updates the SQLite cache.
  - Offline Error Resilience: If a network request fails or times out, the error is caught, network retry exponential backoff is triggered, and the user continues interacting with cached data uninterrupted.

4.5 RENDERING PERFORMANCE & LAG ELIMINATION
To maintain consistent 60fps / 120fps frame rates across low-end and high-end Android hardware:
  - Memoized Vector Avatars: All 19 SVG avatar components are wrapped in `React.memo`, preventing costly SVG path recalculations during parent list scrolls.
  - Virtualized List Tuning: Multi-column `FlatList` feeds configure `initialNumToRender={10}`, `maxToRenderPerBatch={8}`, `windowSize={5}`, and `removeClippedSubviews={Platform.OS === 'android'}`.
  - Dedicated Route Offloading: Heavy visual components (such as the 300px PYQ contributor podium) were extracted out of scroll feeds into dedicated stack screens (`app/pyq/leaderboard.tsx`), keeping list scroll memory footprints under 45MB.
""")

    # =========================================================================
    # SECTION 6: BACKEND & WORKER PIPELINE ARCHITECTURE
    # =========================================================================
    sections.append("""5. BACKEND ARCHITECTURE & WORKER SCRAPING PIPELINES
--------------------------------------------------------------------------------
5.1 SUPABASE CLOUD ARCHITECTURE & DATABASE SCHEMA
The cloud backend is deployed on Supabase (PostgreSQL 15), exposing secure RESTful and Realtime APIs via PostgREST:
  - Table: `public.notices`
    * `id` (uuid, primary key)
    * `title` (text, not null)
    * `clean_title` (text)
    * `category` (text, default 'general')
    * `source` (text, default 'admin')
    * `importance` (integer, default 3)
    * `posted_at` (timestamptz, default now())
    * `file_url` (text)
    * `school` (text)
    * `is_urgent` (boolean, default false)
  - Table: `public.pyq_papers`
    * `id` (text, primary key)
    * `school` (text, not null)
    * `programme_code` (text, not null)
    * `semester` (text, not null)
    * `subject_code` (text, not null)
    * `subject_name` (text, not null)
    * `year` (integer, not null)
    * `exam_type` (text, not null)
    * `downloads` (integer, default 0)
    * `file_url` (text)
    * `status` (text, default 'pending')
    * `uploaded_by` (text)
    * `uploader_metadata` (jsonb)
    * `created_at` (timestamptz, default now())
  - Table: `public.moderators`
    * `id` (uuid, references auth.users)
    * `email` (text, unique, not null)
    * `role` (text, default 'moderator')
    * `created_at` (timestamptz, default now())
  - Table: `public.app_versions`
    * `id` (text, primary key)
    * `latest_version` (text, not null)
    * `min_supported_version` (text, not null)
    * `is_mandatory` (boolean, default false)
    * `apk_url` (text, not null)
    * `release_notes` (jsonb, not null)
    * `broadcast_at` (timestamptz, default now())
  - Table: `public.audit_ledger`
    * `id` (bigserial, primary key)
    * `timestamp` (timestamptz, not null)
    * `action` (text, not null)
    * `actor` (text, not null)
    * `payload` (jsonb, not null)
    * `previous_hash` (text, not null)
    * `entry_hash` (text, not null)

5.2 ROW-LEVEL SECURITY (RLS) POLICIES
Database integrity is enforced at the PostgreSQL engine level using Row-Level Security:
  - `pyq_papers` Policy:
    * Anonymous & Authenticated SELECT: Allowed where `status = 'approved'`.
    * Anonymous & Authenticated INSERT: Allowed strictly where `status = 'pending'`. Students (including guests) can submit papers, but cannot mark their own papers as approved.
    * UPDATE & DELETE: Restricted exclusively to verified moderators via `public.is_moderator()`.
  - Storage Bucket `pyq-pending`:
    * Public / Anonymous INSERT permitted (enabling guest student uploads).
    * Read, Update, Delete restricted to verified moderators.
  - Storage Bucket `pyq-papers` (Approved):
    * Public Read permitted. Write restricted to moderators.
  - `app_versions` Policy:
    * Public Read permitted (enabling student version checks).
    * Write restricted to moderators.

5.3 WORKER SCRAPER MICROSERVICES
Automated background workers run on scheduled crons (via GitHub Actions and local daemons):
  - Timetable Poller (`worker/timetableJob.ts`):
    * Queries GBU ERP timetable endpoints across active academic sessions (38, 39, 40).
    * Normalizes raw schedule tables into strongly-typed slot arrays.
    * Computes SHA-256 diffs against previously stored snapshots.
    * When changes are detected, records diff logs and triggers targeted push notifications to students in the affected class section.
  - Notices Scraper & OCR Pipeline (`worker/noticesJob.ts`):
    * Periodically scrapes Gautam Buddha University's public notice boards (`gbu.ac.in/notices`).
    * Downloads newly posted circular PDFs and runs optical character recognition (OCR) on scanned documents.
    * Parses reference numbers, issuing departments, and categorizes circulars into relevant student domains.
    * Ingests parsed metadata into Supabase `public.notices`.
  - Results Watch Daemon (`worker/resultsWatchJob.ts`):
    * Monitors university examination result announcement endpoints.
    * When semester results are published, dispatches high-priority push notifications to subscribed student roll numbers.
""")

    # =========================================================================
    # SECTION 7: CRYPTOGRAPHY, SECURITY & IDENTITY MIGRATION
    # =========================================================================
    sections.append("""6. SECURITY ARCHITECTURE, CRYPTOGRAPHY & IDENTITY MIGRATION
--------------------------------------------------------------------------------
6.1 SERVER-SIDE ADMIN AUTHENTICATION (RBAC)
GBU One Admin rejects insecure client-side PIN storage in favor of enterprise RBAC:
  - Primary Auth Flow: The administrator enters their email and password. The application calls `supabase.auth.signInWithPassword({ email, password })`.
  - Security Definer Check: Upon obtaining a valid JWT, the application executes a remote procedure call to `public.is_moderator()`. This function executes with `SECURITY DEFINER` privileges, verifying whether the authenticated UUID exists within `public.moderators`.
  - Tamper Protection: Any client attempting to bypass UI guards is immediately rejected at the Supabase PostgREST layer by PostgreSQL RLS policies.

6.2 PURE TYPESCRIPT NIST SHA-256 CRYPTOGRAPHIC ENGINE
In disconnected campus emergency scenarios, the admin console utilizes a pure TypeScript implementation of NIST FIPS 180-4 SHA-256:
  - Zero External Dependencies: Eliminates reliance on native C++ crypto modules that can fail across heterogeneous Android ABI architectures.
  - Mathematical Precision: Implements 32-bit big-endian word manipulations, circular right bitwise rotations (`ROTR`), logical functions (`Ch`, `Maj`), and compression loops across 64 round constants (`K`).
  - Deterministic Verification: Verified against official NIST test vectors (empty string, 'abc', 448-bit single-block, and multi-block strings).

6.3 HARDWARE-PERSISTED BRUTE-FORCE LOCKOUT
To defend against automated dictionary attacks on physical mobile devices:
  - Attempt Counter: Failed authentication attempts increment a persistent counter in storage (`@gbu_admin_lockout_state`).
  - Lockout Activation: Upon the 5th consecutive failure, `isLockedOut()` evaluates to true, triggering a 300-second hardware lockout.
  - Anti-Drift Timer: Rather than decrementing a local JavaScript interval (which drifts when the device sleeps or switches apps), the lockout engine calculates `remainingSeconds = Math.ceil((lockoutUntil - Date.now()) / 1000)`.
  - Re-entrant Mutex: Critical auth state transitions are wrapped in a serialized mutex lock (`withLockoutLock`), preventing race conditions from concurrent touch events.

6.4 GUEST-TO-ACCOUNT IDENTITY MIGRATION
GBU One ensures complete continuity of user contributions:
  - Persistent Guest Keys:
    * `@gbu_one_device_unique_student_id`: Hardware-anchored student ID (format: `GBU-XXXXXX`).
    * `@gbu_one_guest_avatar_id`: Selected vector persona identifier (e.g., `tech-scholar`).
    * `@gbu_one_guest_name`: Student display name.
  - Account Sign-Up Migration: When a student transitions from Guest Mode to a registered cloud account via `useAuthStore.getState().register(...)`:
    1. The registration action captures the existing local `uniqueStudentId` and `avatarId`.
    2. It sends them as metadata to Supabase Auth (`user_metadata: { unique_student_id, avatar_id }`).
    3. All question papers previously uploaded by this student ID under guest mode remain attributed to the student.
    4. Leaderboard points and rankings are automatically reconciled without point loss.

6.5 STUDENT PRIVACY GUARANTEE (NO UNIVERSITY PASSWORDS)
The application architecture enforces strict student privacy:
  - Gautam Buddha University passwords are never collected, logged, transmitted, or cached.
  - App authentication operates on independent student accounts.
  - Network requests identify the worker with clear User-Agent headers.
  - Scrapers interact exclusively with public endpoints at polite, throttled rates.
""")

    # =========================================================================
    # SECTION 8: UI/UX SYSTEM, TYPOGRAPHY & VISUAL DESIGN TOKENS
    # =========================================================================
    sections.append("""7. UI/UX SYSTEM, DESIGN TOKENS & BRAND TYPOGRAPHY
--------------------------------------------------------------------------------
7.1 LIGHT-FIRST DESIGN TOKENS & COLOR PALETTE
GBU One is built upon an intentional, university-inspired color hierarchy optimized for daytime legibility on campus grounds:
  - Theme Tokens:
    * Background (`colors.bg`): Clean off-white / porcelain (`#F8FAFC`).
    * Surface (`colors.surface`): Pure crisp white (`#FFFFFF`) with subtle translucent glass borders.
    * Surface Muted (`colors.surfaceMuted`): Soft slate tint (`#F1F5F9`).
    * Accent Brand Primary (`colors.accent`): University Terracotta / Warm Teal (`#00A896` / `#E05638`).
    * Accent Soft (`colors.accentSoft`): Gentle accent wash with 12% opacity.
    * Text Primary (`colors.textPrimary`): Deep Obsidian (`#0F172A`), providing AAA contrast against white cards.
    * Text Secondary (`colors.textSecondary`): Neutral Slate (`#64748B`).
    * Text Tertiary (`colors.textTertiary`): Light Muted Slate (`#94A3B8`).
    * Border Glass (`colors.borderGlass`): Semi-transparent hairline border (`rgba(226, 232, 240, 0.8)`).
    * Success / Warning / Danger: Emerald (`#10B981`), Amber (`#F59E0B`), Crimson (`#EF4444`).

7.2 TYPOGRAPHY & FONT METRICS
Typography balances academic authority with modern mobile legibility:
  - Display & Headings: `Poppins-Bold` — Utilized for major screen titles, brand headers, and podium ranks.
  - Body & Metadata: `Inter` (Regular, Medium, SemiBold, Bold) — Highly readable geometric sans-serif delivering exceptional clarity across small font sizes (9.5pt to 13pt).
  - Dynamic Font Scale Support: Adapts seamlessly to user-configured accessibility text scaling in Android and iOS settings without truncating critical room numbers or dates.

7.3 OFFICIAL BRAND MARK & OFFICIAL SEAL RULES
The university brand identity is strictly preserved:
  - Final Animated Brand Logo: Built directly from source vector bezier curves in `assets/brand/source/`. The mark features dynamic orange-and-teal arcs forming the stylized 'GBU' ligature.
  - Official Seal Slot Reserved: Per core governance rules, the official Gautam Buddha University seal is never redrawn, generated via AI, or modified. The slot `<OfficialSeal />` remains reserved exclusively for the official administrative vector asset.

7.4 COLD-START ANIMATION SPECIFICATION
The app launch sequence (`src/components/brand/SplashScreenView.tsx`) is tuned for punchy, immediate engagement:
  - Timing Sequence:
    * 0ms: Native splash transitions smoothly into React Native view hierarchy.
    * 150ms: Animated brand mark scales and rotates into position with spring physics.
    * 350ms: Letter-rise wordmark elevates into view.
    * 500ms: Typewriter tagline ('Everything GBU. One app.') executes.
    * 1250ms: Smooth 280ms fade-out handoff revealing the Home screen.
  - Fail-Safe Skip Button: A dedicated 'Skip →' pill button is rendered in the top-right corner (`minHeight: 44`), permitting students in a hurry to bypass animations instantly with one tap.
""")

    # =========================================================================
    # SECTION 9: THE 19 ACADEMIC VECTOR AVATARS & IDENTITY SYSTEM
    # =========================================================================
    sections.append("""8. THE 19 ACADEMIC VECTOR AVATARS & SCHOOL TAXONOMY
--------------------------------------------------------------------------------
Rather than using generic emoji or unverified remote profile photos, GBU One features a bespoke suite of 19 custom-designed vector academic student personas. Every avatar is encoded as standalone SVG paths and wrapped in `React.memo` for ultra-fast rendering.

8.1 COMPLETE PERSONA LINEUP BY SCHOOL

A. SCHOOL OF INFORMATION & COMMUNICATION TECHNOLOGY (SOICT):
  1. `tech-scholar` (Cyan, #06B6D4): Terminal coder spectacles, code bracket glyphs (`< >`), modern tech hoodie. Represents computer science and software engineering scholars.
  2. `cyber-guardian` (Green, #22C55E): Cyber defense visor, security circuit shield, and binary matrix scanlines. Represents cybersecurity and network defense specialists.
  3. `ai-researcher` (Purple, #A855F7): Neural network nodes, synaptic crown, digital halo, and machine learning cluster geometry. Represents artificial intelligence and deep learning researchers.
  4. `data-wizard` (Sky, #38BDF8): Data stream visor, wizard cap with circuit constellations, spark nodes, and analytics chart emblems. Represents data science and big data analytics scholars.

B. SCHOOL OF ENGINEERING (SOE):
  5. `engineer` (Orange, #F97316): Construction hard-hat with cross-crests, structural gear pins, drafting neckband. Represents mechanical, electrical, and structural engineers.
  6. `civil-architect` (Sky/Blue, #0284C7): Drafting triangle rulers, blueprint parchment, architect spectacles, structured collar. Represents civil engineering and architecture scholars.
  7. `speed-runner` (Red, #EF4444): Athletic sports headband, dynamic racing stripes, aerodynamic runner hair. Represents university athletes and sports scholars.

C. SCHOOL OF BIOTECHNOLOGY (SOBT):
  8. `lab-scientist` (Emerald, #10B981): Protective laboratory goggles, microscope reticle target, crisp white lab coat collar. Represents bioinformaticians and molecular biologists.
  9. `bio-innovator` (Teal, #14B8A6): Intertwined DNA double-helix crest, laboratory pipette flask, biotech scientist collar. Represents genetic engineers and biotechnology researchers.

D. SCHOOL OF MANAGEMENT (SOM):
  10. `business-leader` (Blue, #3B82F6): Tailored blazer, crisp executive tie, gold tie-clip, business coiffure. Represents MBA and business administration scholars.
  11. `campus-ambassador` (Amber, #F59E0B): Megaphone emblem, university ambassador lanyard, welcoming smile. Represents student welfare and campus communication liaisons.
  12. `fin-analyst` (Indigo, #6366F1): Candlestick financial charts, market trend visor, corporate pinstripe suit. Represents finance, banking, and commerce scholars.

E. SCHOOL OF LAW, JUSTICE & GOVERNANCE (SOLJG):
  13. `legal-eagle` (Slate, #64748B): Classical scales of justice, judicial advocate collar, constitutional lapels. Represents legal scholars and moot court advocates.
  14. `justice-advocate` (Bronze, #D97706): Constitution volume with judicial gavel crest, parliamentary stole, justice robes. Represents legal governance and constitutional law scholars.

F. SCHOOL OF HUMANITIES & SOCIAL SCIENCES (SOHSS):
  15. `creative-artist` (Pink, #EC4899): Classic artist beret, angled paintbrush, paint palette with color swatches. Represents fine arts, design, and creative media scholars.
  16. `campus-scribe` (Fuchsia, #D946EF): Vintage calligraphy quill, open manuscript parchment, journalist spectacles. Represents journalism, literature, and mass communication scholars.

G. SCHOOL OF VOCATIONAL STUDIES & APPLIED SCIENCES (SOVSAS):
  17. `bookworm` (Gold, #EAB308): Thick tortoiseshell reading glasses, stack of classic academic textbooks. Represents applied science and literature scholars.
  18. `quantum-physicist` (Violet, #8B5CF6): Rutherford atomic orbital rings, quantum nucleus spark, chalkboard equation lapels. Represents physics, mathematics, and quantum mechanics scholars.

H. UNIVERSITY ADMINISTRATION (ADMIN):
  19. `gbu-admin` (Imperial Gold/Amber, #F59E0B): Completely overhauled university dignitary persona featuring dignified salt-and-pepper academic hair, gold wireframe spectacles, anchored dual-gem university crown, midnight navy velvet academic robes with draped golden ceremonial stole and central medallion, embraced by twin golden university laurel wreaths.

8.2 AVATARPICKER COMPONENT & FILTER SYSTEM
The `AvatarPicker` component (`src/components/avatar/AvatarPack.tsx`) provides an interactive selection modal:
  - School Filter Tabs: Sticky horizontal pill bar (`SCHOOL_TABS = ['All', 'SOICT', 'SOE', 'SOBT', 'SOM', 'SOLJG', 'SOHSS', 'SOVSAS', 'ADMIN']`).
  - Accessibility Conformance: Every filter tab and avatar card guarantees a minimum 44pt touch target (`minHeight: 44`), complete accessibility roles, labels, and selected states.
  - Headless Test Safe: Features internal `useSafeState` hooks that gracefully fall back when invoked in headless test runners without a mounted React tree.
""")

    # =========================================================================
    # SECTION 10: VERIFICATION, TESTING & BUILD AUTOMATION
    # =========================================================================
    sections.append("""9. VERIFICATION, TESTING & BUILD AUTOMATION
--------------------------------------------------------------------------------
9.1 COMPREHENSIVE TEST SUITE METRICS
The GBU One platform is hardened by an exhaustive test suite executed via Jest 29:
  - Test Suite Count: 38 distinct test suites.
  - Test Cases: 626 tests total (100% passing, 0 failures, 0 snapshots).
  - Test Coverage Domains:
    * `tests/admin_security.test.ts`: 46 tests covering server-side Supabase auth, lockout timers, NIST SHA-256 validation, and hash-chained audit ledgers.
    * `tests/avatar_and_identity.test.ts`: 25 tests verifying all 19 avatars, school coverage, React.memo wrappers, and student ID entropy.
    * `tests/pyq_leaderboard.test.ts`: 21 tests validating podium calculations, rank sorting, overtake mechanics, and share message generators.
    * `tests/pyq.test.ts`: Full coverage of the 841+ catalogued subjects, multi-school programme filters, and download logging.
    * `tests/version_update.test.ts`: Verification of semver comparisons, mandatory modal blocking, and broadcast rollbacks.
    * `tests/no_native_modal.test.ts`: Architectural AST audit ensuring zero forbidden native React Native `Modal` imports exist in any screen.
    * `tests/timetable_worker.test.ts`: Ingestion diffing, snapshot pruning, and conflict alert triggers.
    * `tests/schema_sql_sync.test.ts`: Verification that TypeScript Supabase types perfectly match `supabase/schema.sql`.

9.2 ANDROID BUILD ISOLATION PIPELINE (`tools/build_android_apk.py`)
Native Android builds with CMake/Ninja fail when project directory paths contain spaces (such as `chrome downloads`). The build automation script resolves this systematically:
  1. Source Sync: Mirrors project source into a space-free directory (`C:\\gbuone-build`), excluding `.git`, `node_modules`, and build artifacts.
  2. Secret Sanitization: For the Student APK (`in.gbu.one`), the pipeline actively sanitizes `.env`, stripping all administrative passwords, master keys, and private tokens.
  3. Route Purging: Completely removes `app/admin` and `app/moderation.tsx` from the student build tree, ensuring no administrative routes exist within the compiled student bundle.
  4. Variant Injection: Injects `isAdminApp(): boolean { return false; }` into `src/lib/appVariant.ts`.
  5. Gradle Assembly: Executes `gradlew assembleDebug --no-daemon`, generating an optimized 250MB APK copied to `apk/gbu-one.apk`.

9.3 ADMIN BUILD VARIANT PIPELINE (`tools/build_admin.py`)
Compiles the dedicated administrative variant:
  1. Configuration Override: Modifies `build.gradle`, `app.json`, and `strings.xml` to set `applicationId: in.gbu.one.admin` and `appName: GBU One Admin`.
  2. Route Preservation: Preserves administrative routes and moderation screens.
  3. Variant Flagging: Injects `isAdminApp(): boolean { return true; }`.
  4. Packaging: Compiles and outputs `apk/gbu-one-admin.apk`.
  5. Safe Reversion: Configures a `finally` block that automatically restores all modified configuration files to their original state upon build completion.

9.4 VECTOR-TO-PNG RENDER PIPELINE (`tools/render_avatars_to_png.py`)
To enable cross-platform visual inspection and marketing materials:
  - Automated Vector Rasterization: Reads raw SVG strings for all 19 personas, parsing path geometries, colors, and viewBox coordinates.
  - High-Resolution Rendering: Generates 512x512 PNG assets for every persona (`avatar_tech_scholar.png`, `avatar_gbu_admin.png`, etc.).
  - Master Composite Grid: Produces `avatars_grid.png`, assembling all 19 personas in a high-resolution grid with crisp borders and labels.
""")

    # =========================================================================
    # SECTION 11: STORAGE REGISTRY, APIS & DATA CONTRACTS
    # =========================================================================
    sections.append("""10. SYSTEM SITEMAP, DATA CONTRACTS & STORAGE REGISTRY
--------------------------------------------------------------------------------
10.1 ASYNCSTORAGE & MMKV KEY REGISTRY
The following persistent storage keys are reserved and managed across the application:
  - `@gbu_one_user_profile`: JSON payload storing the authenticated student profile.
  - `@gbu_one_device_unique_student_id`: Persistent hardware-anchored student ID (format: `GBU-XXXXXX`).
  - `@gbu_one_guest_avatar_id`: ID of the avatar persona selected by the guest.
  - `@gbu_one_guest_name`: Name selected by the guest.
  - `@gbu_one_class_selection`: School, programme, semester, and section parameters.
  - `@gbu_one_app_theme`: Active appearance setting ('light' | 'dark' | 'system').
  - `@gbu_pyq_leaderboard`: Cached JSON array of PYQ contributor leaderboard rankings.
  - `@gbu_admin_lockout_state`: Lockout timestamp and failed attempt counters.
  - `@gbu_admin_audit_log`: Hash-chained cryptographic administrative action ledger.
  - `@gbu_one_version_broadcast_history`: Historical version update manifests published by administration.
  - `@gbu_timetable_alarm_pref`: User preference toggle for class alarm notifications.

10.2 ROUTE MAP & SITEMAP
  - `/(tabs)`: Main tab navigation container
    * `/(tabs)/index`: Home & Daily Campus Hub
    * `/(tabs)/timetable`: Weekly Timetable & Room Shift Tracker
    * `/(tabs)/notices`: Official University Circulars & Notices
    * `/(tabs)/pyq`: Previous Year Papers & Search Catalogue
    * `/(tabs)/profile`: Student Identity, Avatars & Settings
  - `/pyq/leaderboard`: Dedicated Contributor Podium & Rankings Screen
  - `/admin/index`: Central Administrative Command Center (Admin APK only)
  - `/exams`: Examination Hub, Datesheet Schedule & Results Watch
  - `/calendar`: Academic Calendar & Milestone Timeline
  - `/events`: Campus Life, Photo Memories & Fest Registrations
  - `/mail`: GBU Webmail Helper & Zimbra Delegation
  - `/pdf`: Native Document Viewer (pinch-to-zoom, page counter)
  - `/onboarding`: Progressive Onboarding & Academic Profile Setup
  - `/login`: Student Account Authentication & Registration
  - `/class-setup`: Quick Academic Re-configuration Sheet

10.3 SUPABASE STORAGE BUCKETS
  - `pyq-pending`: Quarantine storage for student-uploaded question papers awaiting moderation.
  - `pyq-papers`: Public production storage for verified, approved question papers.
  - `notice-attachments`: Official PDF attachments for university circulars.
  - `event-photos`: High-resolution gallery photographs for campus fests and events.
""")

    # =========================================================================
    # SECTION 12: DEPLOYMENT, OPERATIONS & CONCLUSION
    # =========================================================================
    sections.append("""11. DEPLOYMENT PLAYBOOK & MAINTENANCE GUIDE
--------------------------------------------------------------------------------
11.1 RUNNING TESTS & TYPECHECKING
Before creating any release build, execute the following commands in the workspace root:
  - Run TypeScript Typecheck:
      npx tsc --noEmit
    (Ensure 0 errors are emitted).
  - Run Complete Test Suite:
      npm test
    (Ensure all 38 test suites and 626 tests pass).
  - Run Code Linter:
      npm run lint

11.2 COMPILING RELEASES
  - Compiling the Student APK:
      python tools/build_android_apk.py
    Output artifact: `apk/gbu-one.apk`
  - Compiling the Admin APK:
      python tools/build_admin.py
    Output artifact: `apk/gbu-one-admin.apk`

11.3 INSTALLING TO PHYSICAL DEVICES VIA ADB
With your Android device connected via USB with USB Debugging enabled:
  - Install Student APK:
      adb -s <DEVICE_ID> install -r apk/gbu-one.apk
  - Install Admin APK:
      adb -s <DEVICE_ID> install -r apk/gbu-one-admin.apk
  - Launch Student App:
      adb -s <DEVICE_ID> shell am start -n in.gbu.one/in.gbu.one.MainActivity
  - Launch Admin App:
      adb -s <DEVICE_ID> shell am start -n in.gbu.one.admin/in.gbu.one.MainActivity

11.4 DATABASE INITIALIZATION & MIGRATIONS
When deploying to a fresh Supabase project:
  1. Open the Supabase SQL Editor dashboard.
  2. Copy and paste the entire contents of `supabase/schema.sql`.
  3. Execute the script to initialize tables, RLS policies, triggers, and functions.
  4. Launch the Admin Console (`in.gbu.one.admin`), navigate to 'Initial Setup', and register the primary owner administrator account.

================================================================================
12. SUMMARY & CONCLUSION
================================================================================
GBU One and GBU One Admin represent a milestone in university digital infrastructure. By unifying class schedules, official circulars, examination date sheets, peer academic resources, campus life memories, and administrative controls into a cohesive, offline-first React Native ecosystem, the platform sets a new standard for campus software.

Every design choice—from the 19 custom vector personas and the multi-tier cryptographic audit trail, to the zero-barrier guest mode and the server-verified moderation queue—was engineered to serve the real-world needs of Gautam Buddha University students and staff with speed, security, and elegance.
================================================================================
END OF SPECIFICATION DOCUMENT
================================================================================
""")

    full_text = "\n".join(sections)
    return full_text

if __name__ == '__main__':
    doc = build_document()
    words = doc.split()
    word_count = len(words)
    print(f"Generated text with {word_count} words.")
    
    out_file = os.path.abspath('docs/GBU_ONE_AND_ADMIN_COMPLETE_SYSTEM_REFERENCE.txt')
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    with open(out_file, 'w', encoding='utf-8') as f:
        f.write(doc)
    print(f"Wrote to {out_file}")
