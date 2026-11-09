import os
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"C:\Users\ashis\.gemini\antigravity\brain\8aed1abb-7b11-4e16-8016-fafa779e868e"
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

AVATARS = [
    {
        "id": "tech-scholar",
        "name": "Tech Scholar",
        "school": "SOICT",
        "filename": "avatar_tech_scholar.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="techBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1E1B4B"/><stop offset="100%" stop-color="#0F172A"/></linearGradient>
              <linearGradient id="techSkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FED7AA"/><stop offset="100%" stop-color="#FDBA74"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#techBg)"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#312E81"/>
            <path d="M42 68 L50 82 L58 68 Z" fill="#06B6D4"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="url(#techSkin)"/>
            <circle cx="50" cy="46" r="20" fill="url(#techSkin)"/>
            <path d="M28 44 C28 26, 72 26, 72 44 C68 34, 58 26, 50 26 C40 26, 32 34, 28 44 Z" fill="#1E1B4B"/>
            <path d="M30 40 Q38 32 50 34 Q62 32 70 40" stroke="#3730A3" stroke-width="3" fill="none" stroke-linecap="round"/>
            <rect x="33" y="42" width="14" height="11" rx="3" fill="#0F172A" stroke="#06B6D4" stroke-width="2"/>
            <rect x="53" y="42" width="14" height="11" rx="3" fill="#0F172A" stroke="#06B6D4" stroke-width="2"/>
            <line x1="47" y1="47" x2="53" y2="47" stroke="#06B6D4" stroke-width="2"/>
            <path d="M36 46 L39 47.5 L36 49" stroke="#22D3EE" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <line x1="41" y1="49" x2="44" y2="49" stroke="#22D3EE" stroke-width="1.2" stroke-linecap="round"/>
            <rect x="38" y="86" width="24" height="10" rx="3" fill="#030712" stroke="#06B6D4" stroke-width="1"/>
            <path d="M42 89 L45 91 L42 93" stroke="#22D3EE" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <line x1="47" y1="93" x2="50" y2="93" stroke="#22D3EE" stroke-width="1" stroke-linecap="round"/>
        </svg>"""
    },
    {
        "id": "cyber-guardian",
        "name": "Cyber Guardian",
        "school": "SOICT",
        "filename": "avatar_cyber_guardian.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="cyberBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#022C22"/><stop offset="100%" stop-color="#0F172A"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#cyberBg)"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#1E293B"/>
            <path d="M40 70 L50 82 L60 70 Z" fill="#065F46"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="46" r="20" fill="#FED7AA"/>
            <path d="M28 42 C28 26 72 26 72 42 C68 32 58 24 50 24 C40 24 32 32 28 42 Z" fill="#022C22"/>
            <path d="M29 42 L71 42 L68 52 L32 52 Z" fill="#064E3B" stroke="#22C55E" stroke-width="2"/>
            <line x1="35" y1="47" x2="65" y2="47" stroke="#4ADE80" stroke-width="1.5"/>
            <path d="M66 70 L78 66 L78 78 Q78 87 66 91 Q54 87 54 78 L54 66 Z" fill="#047857" stroke="#34D399" stroke-width="1.5"/>
            <path d="M62 78 L65 81 L70 75" stroke="#A7F3D0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>"""
    },
    {
        "id": "ai-researcher",
        "name": "AI Researcher",
        "school": "SOICT",
        "filename": "avatar_ai_researcher.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="aiBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#4A044E"/><stop offset="100%" stop-color="#701A75"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#aiBg)"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#581C87"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="46" r="20" fill="#FED7AA"/>
            <path d="M28 44 C28 26 72 26 72 44 C66 32 58 26 50 26 C40 26 34 32 28 44 Z" fill="#3B0764"/>
            <line x1="28" y1="32" x2="38" y2="24" stroke="#C084FC" stroke-width="1.2"/>
            <line x1="38" y1="24" x2="50" y2="20" stroke="#C084FC" stroke-width="1.2"/>
            <line x1="50" y1="20" x2="62" y2="24" stroke="#C084FC" stroke-width="1.2"/>
            <line x1="62" y1="24" x2="72" y2="32" stroke="#C084FC" stroke-width="1.2"/>
            <circle cx="28" cy="32" r="3" fill="#E879F9"/>
            <circle cx="38" cy="24" r="3.5" fill="#E879F9"/>
            <circle cx="50" cy="20" r="4" fill="#F0ABFC"/>
            <circle cx="62" cy="24" r="3.5" fill="#E879F9"/>
            <circle cx="72" cy="32" r="3" fill="#E879F9"/>
            <rect x="64" y="70" width="18" height="15" rx="4" fill="#3B0764" stroke="#E879F9" stroke-width="1.5"/>
            <circle cx="69" cy="76" r="1.5" fill="#F0ABFC"/>
            <circle cx="77" cy="76" r="1.5" fill="#F0ABFC"/>
            <line x1="70" y1="81" x2="76" y2="81" stroke="#F0ABFC" stroke-width="1" stroke-linecap="round"/>
            <line x1="73" y1="70" x2="73" y2="66" stroke="#E879F9" stroke-width="1"/>
            <circle cx="73" cy="65" r="1" fill="#F0ABFC"/>
        </svg>"""
    },
    {
        "id": "data-wizard",
        "name": "Data Wizard",
        "school": "SOICT",
        "filename": "avatar_data_wizard.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="dataBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#030712"/><stop offset="100%" stop-color="#1E1B4B"/></linearGradient>
              <linearGradient id="dataHood" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4338CA"/><stop offset="100%" stop-color="#1E1B4B"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#dataBg)"/>
            <circle cx="18" cy="28" r="1.8" fill="#38BDF8" opacity="0.6"/>
            <circle cx="24" cy="20" r="1.2" fill="#818CF8" opacity="0.6"/>
            <circle cx="82" cy="26" r="1.8" fill="#22D3EE" opacity="0.6"/>
            <circle cx="76" cy="18" r="1.2" fill="#C084FC" opacity="0.6"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="url(#dataHood)"/>
            <path d="M36 78 L36 96 M64 78 L64 96" stroke="#38BDF8" stroke-width="1.2" stroke-dasharray="3 2"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="46" r="20" fill="#FED7AA"/>
            <path d="M26 44 C26 22 40 18 50 16 C60 18 74 22 74 44 C68 32 58 26 50 26 C42 26 32 32 26 44 Z" fill="#1E1B4B"/>
            <path d="M30 42 Q40 32 50 35 Q60 32 70 42" stroke="#6366F1" stroke-width="3" fill="none" stroke-linecap="round"/>
            <rect x="32" y="43" width="36" height="8" rx="2" fill="#0F172A" stroke="#06B6D4" stroke-width="1.5"/>
            <line x1="35" y1="47" x2="65" y2="47" stroke="#22D3EE" stroke-width="1.5"/>
            <circle cx="40" cy="47" r="1.2" fill="#FFFFFF"/>
            <circle cx="60" cy="47" r="1.2" fill="#FFFFFF"/>
            <polygon points="50,75 57,71 50,67 43,71" fill="#38BDF8" opacity="0.9"/>
            <polygon points="43,71 50,75 50,83 43,79" fill="#0284C7" opacity="0.9"/>
            <polygon points="57,71 50,75 50,83 57,79" fill="#4F46E5" opacity="0.9"/>
            <polygon points="50,67 57,71 57,79 50,83 43,79 43,71" stroke="#A5F3FC" stroke-width="1" fill="none"/>
            <circle cx="76" cy="48" r="2" fill="#22D3EE"/>
            <line x1="73" y1="48" x2="79" y2="48" stroke="#22D3EE" stroke-width="0.8"/>
            <line x1="76" y1="45" x2="76" y2="51" stroke="#22D3EE" stroke-width="0.8"/>
            <circle cx="24" cy="50" r="1.8" fill="#A855F7"/>
        </svg>"""
    },
    {
        "id": "engineer",
        "name": "Innovator Engineer",
        "school": "SOE",
        "filename": "avatar_engineer.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="engBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7C2D12"/><stop offset="100%" stop-color="#C2410C"/></linearGradient>
              <linearGradient id="engHardhat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FBBF24"/><stop offset="100%" stop-color="#F59E0B"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#engBg)"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#EA580C"/>
            <rect x="34" y="74" width="6" height="26" fill="#FDE047"/>
            <rect x="60" y="74" width="6" height="26" fill="#FDE047"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="48" r="19" fill="#FED7AA"/>
            <path d="M26 44 C26 28 74 28 74 44 L78 48 L22 48 Z" fill="url(#engHardhat)"/>
            <rect x="46" y="27" width="8" height="17" rx="2" fill="#D97706"/>
            <circle cx="72" cy="78" r="11" fill="#7C2D12" stroke="#FDE047" stroke-width="2"/>
            <circle cx="72" cy="78" r="4" fill="#F59E0B"/>
            <line x1="72" y1="64" x2="72" y2="67" stroke="#FDE047" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="72" y1="89" x2="72" y2="92" stroke="#FDE047" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="58" y1="78" x2="61" y2="78" stroke="#FDE047" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="83" y1="78" x2="86" y2="78" stroke="#FDE047" stroke-width="2.5" stroke-linecap="round"/>
        </svg>"""
    },
    {
        "id": "civil-architect",
        "name": "Civil Architect",
        "school": "SOE",
        "filename": "avatar_civil_architect.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="archBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#075985"/><stop offset="100%" stop-color="#0C4A6E"/></linearGradient>
              <linearGradient id="archCoat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#334155"/><stop offset="100%" stop-color="#1E293B"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#archBg)"/>
            <line x1="15" y1="32" x2="85" y2="32" stroke="#38BDF8" stroke-width="0.6" opacity="0.25" stroke-dasharray="3 3"/>
            <line x1="15" y1="52" x2="85" y2="52" stroke="#38BDF8" stroke-width="0.6" opacity="0.25" stroke-dasharray="3 3"/>
            <line x1="32" y1="15" x2="32" y2="85" stroke="#38BDF8" stroke-width="0.6" opacity="0.25" stroke-dasharray="3 3"/>
            <line x1="68" y1="15" x2="68" y2="85" stroke="#38BDF8" stroke-width="0.6" opacity="0.25" stroke-dasharray="3 3"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="url(#archCoat)"/>
            <rect x="42" y="65" width="16" height="10" rx="2" fill="#0F172A"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="46" r="20" fill="#FED7AA"/>
            <path d="M28 44 C28 26 72 26 72 44 C66 32 58 26 50 26 C40 26 34 32 28 44 Z" fill="#0F172A"/>
            <path d="M32 38 Q42 32 52 34 Q62 33 68 39" stroke="#475569" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <circle cx="39" cy="46" r="7.5" fill="none" stroke="#F59E0B" stroke-width="1.8"/>
            <circle cx="61" cy="46" r="7.5" fill="none" stroke="#F59E0B" stroke-width="1.8"/>
            <line x1="46.5" y1="46" x2="53.5" y2="46" stroke="#F59E0B" stroke-width="1.8"/>
            <polygon points="30,82 42,94 30,94" fill="#F59E0B" opacity="0.9" stroke="#FDE047" stroke-width="1"/>
            <polygon points="33,88 38,92 33,92" fill="#1E293B"/>
            <path d="M68 95 L74 76 L80 95" stroke="#F8FAFC" stroke-width="1.8" stroke-linecap="round" fill="none"/>
            <circle cx="74" cy="76" r="2.5" fill="#F59E0B"/>
            <line x1="70" y1="87" x2="78" y2="87" stroke="#CBD5E1" stroke-width="1.2"/>
        </svg>"""
    },
    {
        "id": "speed-runner",
        "name": "Campus Athlete",
        "school": "SOE",
        "filename": "avatar_speed_runner.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="speedBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7F1D1D"/><stop offset="100%" stop-color="#EA580C"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#speedBg)"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#B91C1C"/>
            <path d="M42 68 L50 80 L58 68 Z" fill="#F97316"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="46" r="20" fill="#FED7AA"/>
            <path d="M28 42 C28 26 72 26 72 42 C66 32 58 26 50 26 C40 26 34 32 28 42 Z" fill="#450A0A"/>
            <rect x="26" y="38" width="48" height="8" rx="2" fill="#EF4444"/>
            <rect x="26" y="41" width="48" height="2" fill="#FFFFFF"/>
            <polygon points="74,62 66,76 72,76 64,92 78,74 71,74" fill="#FACC15" stroke="#B45309" stroke-width="1"/>
        </svg>"""
    },
    {
        "id": "lab-scientist",
        "name": "Lab Scientist",
        "school": "SOBT",
        "filename": "avatar_lab_scientist.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="labBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#064E3B"/><stop offset="100%" stop-color="#0F766E"/></linearGradient>
              <linearGradient id="labCoat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F8FAFC"/><stop offset="100%" stop-color="#E2E8F0"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#labBg)"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="url(#labCoat)"/>
            <path d="M44 68 L50 82 L56 68 Z" fill="#047857"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="46" r="20" fill="#FED7AA"/>
            <path d="M28 44 C28 26 72 26 72 44 C66 32 58 26 50 26 C40 26 34 32 28 44 Z" fill="#134E4A"/>
            <circle cx="39" cy="46" r="9" fill="#042F2E" stroke="#2DD4BF" stroke-width="2.2"/>
            <circle cx="61" cy="46" r="9" fill="#042F2E" stroke="#2DD4BF" stroke-width="2.2"/>
            <line x1="48" y1="46" x2="52" y2="46" stroke="#2DD4BF" stroke-width="2.2"/>
            <path d="M35 43 Q38 41 42 43" stroke="#A7F3D0" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            <path d="M57 43 Q60 41 64 43" stroke="#A7F3D0" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            <path d="M68 72 L74 88 C74.5 89.5 73.5 91 72 91 L58 91 C56.5 91 55.5 89.5 56 88 L62 72 L62 67 L68 67 Z" fill="#042F2E" stroke="#5EEAD4" stroke-width="1.5"/>
            <path d="M58 84 L72 84 L73.5 89 L56.5 89 Z" fill="#10B981"/>
            <circle cx="65" cy="80" r="1.5" fill="#6EE7B7"/>
            <circle cx="62" cy="76" r="1" fill="#A7F3D0"/>
            <circle cx="66" cy="69" r="1" fill="#A7F3D0"/>
        </svg>"""
    },
    {
        "id": "bio-innovator",
        "name": "Bio Innovator",
        "school": "SOBT",
        "filename": "avatar_bio_innovator.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="bioBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#022C22"/><stop offset="100%" stop-color="#042F2E"/></linearGradient>
              <linearGradient id="bioCoat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F0FDFA"/><stop offset="100%" stop-color="#CCFBF1"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#bioBg)"/>
            <circle cx="18" cy="28" r="2.5" fill="#34D399" opacity="0.6"/>
            <circle cx="26" cy="22" r="1.8" fill="#2DD4BF" opacity="0.6"/>
            <line x1="18" y1="28" x2="26" y2="22" stroke="#34D399" stroke-width="1" opacity="0.5"/>
            <circle cx="82" cy="30" r="2.2" fill="#6EE7B7" opacity="0.6"/>
            <circle cx="76" cy="22" r="1.5" fill="#34D399" opacity="0.6"/>
            <line x1="82" y1="30" x2="76" y2="22" stroke="#6EE7B7" stroke-width="1" opacity="0.5"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="url(#bioCoat)"/>
            <path d="M42 68 L50 82 L58 68 Z" fill="#0D9488"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="46" r="20" fill="#FED7AA"/>
            <path d="M28 44 C28 26 72 26 72 44 C66 32 58 26 50 26 C40 26 34 32 28 44 Z" fill="#134E4A"/>
            <path d="M34 38 Q42 30 52 32 Q62 30 66 38" stroke="#2DD4BF" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <path d="M30 43 Q50 40 70 43 L68 51 Q50 48 32 51 Z" fill="#042F2E" stroke="#10B981" stroke-width="1.5"/>
            <line x1="36" y1="46" x2="64" y2="46" stroke="#6EE7B7" stroke-width="1.2"/>
            <path d="M42 78 Q50 84 42 90 Q50 96 42 100" stroke="#10B981" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            <path d="M58 78 Q50 84 58 90 Q50 96 58 100" stroke="#06B6D4" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            <line x1="43" y1="81" x2="57" y2="81" stroke="#A7F3D0" stroke-width="1.8"/>
            <line x1="47" y1="84" x2="53" y2="84" stroke="#A7F3D0" stroke-width="1.8"/>
            <line x1="43" y1="87" x2="57" y2="87" stroke="#A7F3D0" stroke-width="1.8"/>
            <line x1="47" y1="93" x2="53" y2="93" stroke="#A7F3D0" stroke-width="1.8"/>
            <line x1="43" y1="96" x2="57" y2="96" stroke="#A7F3D0" stroke-width="1.8"/>
        </svg>"""
    },
    {
        "id": "business-leader",
        "name": "Business Leader",
        "school": "SOM",
        "filename": "avatar_business_leader.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="bizBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#172554"/><stop offset="100%" stop-color="#1E3A8A"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#bizBg)"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#1E293B"/>
            <polygon points="42,68 50,84 58,68 50,68" fill="#F8FAFC"/>
            <polygon points="49,70 51,70 53,88 50,94 47,88" fill="#EF4444"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="46" r="20" fill="#FED7AA"/>
            <path d="M28 44 C28 26 72 24 72 42 C64 30 56 26 50 26 C42 26 34 32 28 44 Z" fill="#0F172A"/>
            <path d="M78 68 Q78 61 84 61 Q78 61 78 54 Q78 61 72 61 Q78 61 78 68 Z" fill="#FACC15"/>
            <path d="M84 76 Q84 72 88 72 Q84 72 84 68 Q84 72 80 72 Q84 72 84 76 Z" fill="#FDE047"/>
        </svg>"""
    },
    {
        "id": "campus-ambassador",
        "name": "Campus Ambassador",
        "school": "SOM",
        "filename": "avatar_campus_ambassador.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="ambBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#78350F"/><stop offset="100%" stop-color="#D97706"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#ambBg)"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#92400E"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="46" r="20" fill="#FED7AA"/>
            <path d="M28 44 C28 26 72 26 72 44 C66 32 58 26 50 26 C40 26 34 32 28 44 Z" fill="#451A03"/>
            <polygon points="35,74 37,78 41,78.5 38,81.5 39,85.5 35,83.5 31,85.5 32,81.5 29,78.5 33,78" fill="#FACC15" stroke="#B45309" stroke-width="0.8"/>
            <polygon points="64,74 76,67 78,85 64,78" fill="#F59E0B" stroke="#D97706" stroke-width="1.2"/>
            <rect x="58" y="74" width="6" height="5" rx="1" fill="#78350F"/>
            <path d="M80 72 Q83 76 80 80" stroke="#FEF08A" stroke-width="1.2" stroke-linecap="round" fill="none"/>
            <path d="M83 69 Q87 76 83 83" stroke="#FEF08A" stroke-width="1.2" stroke-linecap="round" fill="none"/>
        </svg>"""
    },
    {
        "id": "fin-analyst",
        "name": "Fin Analyst",
        "school": "SOM",
        "filename": "avatar_fin_analyst.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="finBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#064E3B"/><stop offset="100%" stop-color="#0F172A"/></linearGradient>
              <linearGradient id="finSuit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1E293B"/><stop offset="100%" stop-color="#0F172A"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#finBg)"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="url(#finSuit)"/>
            <polygon points="42,68 50,84 58,68 50,68" fill="#F8FAFC"/>
            <polygon points="49,70 51,70 53,88 50,94 47,88" fill="#10B981"/>
            <polygon points="29,82 34,78 37,82" fill="#FACC15"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="46" r="20" fill="#FED7AA"/>
            <path d="M28 44 C28 26 72 24 72 42 C64 30 56 26 50 26 C42 26 34 32 28 44 Z" fill="#1E293B"/>
            <path d="M30 38 Q40 32 50 33 Q60 32 68 38" stroke="#334155" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <rect x="33" y="42" width="14" height="10" rx="2" fill="none" stroke="#FACC15" stroke-width="1.5"/>
            <rect x="53" y="42" width="14" height="10" rx="2" fill="none" stroke="#FACC15" stroke-width="1.5"/>
            <line x1="47" y1="46" x2="53" y2="46" stroke="#FACC15" stroke-width="1.5"/>
            <line x1="70" y1="68" x2="70" y2="82" stroke="#34D399" stroke-width="1"/>
            <rect x="68" y="72" width="4" height="6" fill="#10B981" rx="0.5"/>
            <line x1="77" y1="62" x2="77" y2="78" stroke="#34D399" stroke-width="1"/>
            <rect x="75" y="65" width="4" height="8" fill="#10B981" rx="0.5"/>
            <line x1="84" y1="56" x2="84" y2="72" stroke="#34D399" stroke-width="1"/>
            <rect x="82" y="59" width="4" height="7" fill="#10B981" rx="0.5"/>
            <path d="M66 84 Q76 80 88 56" stroke="#FACC15" stroke-width="2" stroke-linecap="round" fill="none"/>
            <polygon points="88,54 84,59 89,61" fill="#FACC15"/>
        </svg>"""
    },
    {
        "id": "legal-eagle",
        "name": "Legal Eagle",
        "school": "SOLJG",
        "filename": "avatar_legal_eagle.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="lawBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#3B0764"/><stop offset="100%" stop-color="#581C87"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#lawBg)"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#4C1D95"/>
            <path d="M44 68 L50 80 L56 68 Z" fill="#A855F7"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="46" r="20" fill="#FED7AA"/>
            <path d="M28 46 C28 26 72 26 72 46 C68 32 58 24 50 24 C40 24 32 32 28 46 Z" fill="#2E1065"/>
            <line x1="64" y1="72" x2="86" y2="72" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"/>
            <line x1="75" y1="67" x2="75" y2="88" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"/>
            <path d="M62 79 Q66 83 70 79 Z" fill="#FBBF24"/>
            <line x1="64" y1="72" x2="63" y2="79" stroke="#FDE68A" stroke-width="1"/>
            <line x1="68" y1="72" x2="69" y2="79" stroke="#FDE68A" stroke-width="1"/>
            <path d="M80 79 Q84 83 88 79 Z" fill="#FBBF24"/>
            <line x1="82" y1="72" x2="81" y2="79" stroke="#FDE68A" stroke-width="1"/>
            <line x1="86" y1="72" x2="87" y2="79" stroke="#FDE68A" stroke-width="1"/>
        </svg>"""
    },
    {
        "id": "justice-advocate",
        "name": "Justice Advocate",
        "school": "SOLJG",
        "filename": "avatar_justice_advocate.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="advBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#4C0519"/><stop offset="100%" stop-color="#881337"/></linearGradient>
              <linearGradient id="advRobe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1E293B"/><stop offset="100%" stop-color="#0F172A"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#advBg)"/>
            <line x1="18" y1="22" x2="18" y2="58" stroke="#F43F5E" stroke-width="1" opacity="0.3"/>
            <line x1="82" y1="22" x2="82" y2="58" stroke="#F43F5E" stroke-width="1" opacity="0.3"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="url(#advRobe)"/>
            <rect x="44" y="68" width="12" height="5" fill="#F8FAFC"/>
            <polygon points="45,73 49,73 48,88 44,88" fill="#F8FAFC"/>
            <polygon points="51,73 55,73 56,88 52,88" fill="#F8FAFC"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="46" r="20" fill="#FED7AA"/>
            <path d="M28 44 C28 26 72 26 72 44 C66 32 58 26 50 26 C40 26 34 32 28 44 Z" fill="#18181B"/>
            <path d="M30 38 Q40 32 50 33 Q60 32 68 38" stroke="#3F3F46" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <rect x="65" y="88" width="18" height="6" rx="1.5" fill="#78350F" stroke="#F59E0B" stroke-width="1"/>
            <rect x="68" y="74" width="12" height="7" rx="1.5" fill="#92400E" stroke="#F59E0B" stroke-width="1"/>
            <line x1="74" y1="78" x2="86" y2="68" stroke="#D97706" stroke-width="2.5" stroke-linecap="round"/>
            <polygon points="64,74 65.5,76 67.5,76.5 66,78 66.5,80 64,79 62,80 62.5,78 61,76.5 63,76" fill="#FDE047"/>
        </svg>"""
    },
    {
        "id": "creative-artist",
        "name": "Creative Artist",
        "school": "SOHSS",
        "filename": "avatar_creative_artist.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="artBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#831843"/><stop offset="100%" stop-color="#BE185D"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#artBg)"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#9D174D"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="48" r="19" fill="#FED7AA"/>
            <path d="M24 40 C24 26 70 20 78 34 C80 40 70 44 48 44 C28 44 24 43 24 40 Z" fill="#F43F5E"/>
            <path d="M50 20 L52 24" stroke="#BE123C" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M64 78 C64 71 85 67 87 78 C88 84 78 91 70 89 C66 88 64 83 64 78 Z" fill="#FEF08A" stroke="#CA8A04" stroke-width="1"/>
            <circle cx="71" cy="76" r="2" fill="#06B6D4"/>
            <circle cx="78" cy="74" r="2" fill="#EC4899"/>
            <circle cx="82" cy="80" r="2" fill="#8B5CF6"/>
            <circle cx="75" cy="84" r="2" fill="#EF4444"/>
        </svg>"""
    },
    {
        "id": "campus-scribe",
        "name": "Campus Scribe",
        "school": "SOHSS",
        "filename": "avatar_campus_scribe.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="scribeBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#451A03"/><stop offset="100%" stop-color="#78350F"/></linearGradient>
              <linearGradient id="scribeCoat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#854D0E"/><stop offset="100%" stop-color="#713F12"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#scribeBg)"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="url(#scribeCoat)"/>
            <path d="M38 66 Q50 72 62 66 Q66 74 60 78 Q50 74 40 78 Z" fill="#B91C1C"/>
            <rect x="42" y="76" width="7" height="16" rx="1.5" fill="#991B1B"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="46" r="20" fill="#FED7AA"/>
            <path d="M26 44 C26 24 74 24 74 44 C72 32 64 24 50 24 C36 24 28 32 26 44 Z" fill="#292524"/>
            <path d="M28 40 Q34 32 44 32 Q54 36 62 30 Q70 34 72 42" stroke="#57534E" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <path d="M26 84 C30 82 38 82 42 85 L42 98 C38 95 30 95 26 97 Z" fill="#FEF3C7" stroke="#D97706" stroke-width="1"/>
            <line x1="29" y1="87" x2="39" y2="87" stroke="#B45309" stroke-width="0.8"/>
            <line x1="29" y1="91" x2="39" y2="91" stroke="#B45309" stroke-width="0.8"/>
            <path d="M72 62 Q78 68 84 64 Q80 76 70 88" stroke="#FDE047" stroke-width="2" stroke-linecap="round" fill="none"/>
            <path d="M74 64 Q82 66 76 76 Z" fill="#FACC15"/>
            <polygon points="69,88 71,85 70,89" fill="#0F172A"/>
            <circle cx="67" cy="92" r="1.5" fill="#1C1917"/>
        </svg>"""
    },
    {
        "id": "bookworm",
        "name": "Academic Bookworm",
        "school": "SOVSAS",
        "filename": "avatar_bookworm.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="bookBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0C4A6E"/><stop offset="100%" stop-color="#0284C7"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#bookBg)"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#0369A1"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="46" r="20" fill="#FED7AA"/>
            <path d="M28 44 C28 26 72 26 72 44 C66 32 58 26 50 26 C40 26 34 32 28 44 Z" fill="#082F49"/>
            <circle cx="40" cy="46" r="8" fill="none" stroke="#38BDF8" stroke-width="2"/>
            <circle cx="60" cy="46" r="8" fill="none" stroke="#38BDF8" stroke-width="2"/>
            <line x1="48" y1="46" x2="52" y2="46" stroke="#38BDF8" stroke-width="2"/>
            <path d="M30 82 C38 80 47 82 50 85 C53 82 62 80 70 82 L70 96 C62 94 53 96 50 98 C47 96 38 94 30 96 Z" fill="#F8FAFC" stroke="#0284C7" stroke-width="1.5"/>
            <line x1="50" y1="85" x2="50" y2="98" stroke="#0284C7" stroke-width="1.5"/>
            <line x1="35" y1="86" x2="45" y2="86" stroke="#94A3B8" stroke-width="1"/>
            <line x1="35" y1="90" x2="45" y2="90" stroke="#94A3B8" stroke-width="1"/>
            <line x1="55" y1="86" x2="65" y2="86" stroke="#94A3B8" stroke-width="1"/>
            <line x1="55" y1="90" x2="65" y2="90" stroke="#94A3B8" stroke-width="1"/>
        </svg>"""
    },
    {
        "id": "quantum-physicist",
        "name": "Quantum Physicist",
        "school": "SOVSAS",
        "filename": "avatar_quantum_physicist.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="quantBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0F172A"/><stop offset="100%" stop-color="#312E81"/></linearGradient>
              <linearGradient id="quantCoat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3730A3"/><stop offset="100%" stop-color="#1E1B4B"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#quantBg)"/>
            <path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="url(#quantCoat)"/>
            <rect x="42" y="65" width="16" height="10" rx="2" fill="#1E1B4B"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="46" r="20" fill="#FED7AA"/>
            <path d="M28 44 C28 26 72 26 72 44 C66 32 58 26 50 26 C40 26 34 32 28 44 Z" fill="#1E1B4B"/>
            <path d="M30 38 Q40 30 50 32 Q60 30 70 38" stroke="#6366F1" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            <circle cx="39" cy="46" r="7.5" fill="none" stroke="#818CF8" stroke-width="1.8"/>
            <circle cx="61" cy="46" r="7.5" fill="none" stroke="#818CF8" stroke-width="1.8"/>
            <line x1="46.5" y1="46" x2="53.5" y2="46" stroke="#818CF8" stroke-width="1.8"/>
            <circle cx="50" cy="84" r="3.5" fill="#F43F5E"/>
            <circle cx="50" cy="84" r="1.5" fill="#FFE4E6"/>
            <ellipse cx="50" cy="84" rx="18" ry="6" fill="none" stroke="#22D3EE" stroke-width="1.2"/>
            <circle cx="67" cy="84" r="1.8" fill="#38BDF8"/>
            <ellipse cx="50" cy="84" rx="18" ry="6" fill="none" stroke="#A855F7" stroke-width="1.2" transform="rotate(-35 50 84)"/>
            <circle cx="38" cy="76" r="1.8" fill="#C084FC"/>
            <ellipse cx="50" cy="84" rx="18" ry="6" fill="none" stroke="#A855F7" stroke-width="1.2" transform="rotate(35 50 84)"/>
            <circle cx="62" cy="76" r="1.8" fill="#C084FC"/>
        </svg>"""
    },
    {
        "id": "gbu-admin",
        "name": "GBU Admin",
        "school": "ADMIN",
        "filename": "avatar_gbu_admin.png",
        "svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
            <defs>
              <linearGradient id="gbuBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#3B0764"/><stop offset="50%" stop-color="#1E1B4B"/><stop offset="100%" stop-color="#451A03"/></linearGradient>
              <linearGradient id="gbuGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FEF08A"/><stop offset="40%" stop-color="#FACC15"/><stop offset="100%" stop-color="#D97706"/></linearGradient>
              <linearGradient id="gbuRobe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1E1B4B"/><stop offset="100%" stop-color="#0F172A"/></linearGradient>
              <linearGradient id="gbuHair" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1E293B"/><stop offset="100%" stop-color="#0F172A"/></linearGradient>
            </defs>
            <rect width="100" height="100" rx="26" fill="url(#gbuBg)"/>
            <circle cx="50" cy="46" r="30" fill="#FBBF24" opacity="0.12"/>
            <path d="M16 66 C12 78 18 90 32 94" stroke="#FBBF24" stroke-width="2.2" stroke-linecap="round" fill="none"/>
            <path d="M84 66 C88 78 82 90 68 94" stroke="#FBBF24" stroke-width="2.2" stroke-linecap="round" fill="none"/>
            <path d="M15 64 Q19 61 22 66 Q18 69 15 64 Z" fill="#FDE047" stroke="#D97706" stroke-width="0.8"/>
            <path d="M12 73 Q16 70 20 74 Q15 78 12 73 Z" fill="#FDE047" stroke="#D97706" stroke-width="0.8"/>
            <path d="M14 82 Q18 80 23 83 Q19 87 14 82 Z" fill="#FDE047" stroke="#D97706" stroke-width="0.8"/>
            <path d="M21 90 Q25 87 30 90 Q26 94 21 90 Z" fill="#FDE047" stroke="#D97706" stroke-width="0.8"/>
            <path d="M85 64 Q81 61 78 66 Q82 69 85 64 Z" fill="#FDE047" stroke="#D97706" stroke-width="0.8"/>
            <path d="M88 73 Q84 70 80 74 Q85 78 88 73 Z" fill="#FDE047" stroke="#D97706" stroke-width="0.8"/>
            <path d="M86 82 Q82 80 77 83 Q81 87 86 82 Z" fill="#FDE047" stroke="#D97706" stroke-width="0.8"/>
            <path d="M79 90 Q75 87 70 90 Q74 94 79 90 Z" fill="#FDE047" stroke="#D97706" stroke-width="0.8"/>
            <path d="M22 100 C22 72 31 66 50 66 C69 66 78 72 78 100 Z" fill="url(#gbuRobe)"/>
            <polygon points="44,66 50,78 56,66" fill="#F8FAFC"/>
            <path d="M34 68 L43 78 L41 100 L31 100 L31 72 Z" fill="url(#gbuGold)"/>
            <path d="M66 68 L57 78 L59 100 L69 100 L69 72 Z" fill="url(#gbuGold)"/>
            <line x1="43" y1="78" x2="41" y2="100" stroke="#FEF08A" stroke-width="1"/>
            <line x1="57" y1="78" x2="59" y2="100" stroke="#FEF08A" stroke-width="1"/>
            <circle cx="50" cy="80" r="7" fill="#FACC15" stroke="#B45309" stroke-width="1.2"/>
            <polygon points="50,76 51.5,79 55,79.5 52.5,81.5 53,85 50,83 47,85 47.5,81.5 45,79.5 48.5,79" fill="#78350F"/>
            <rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA"/>
            <circle cx="50" cy="46" r="20" fill="#FED7AA"/>
            {/* Stately Academic Hair */}
            <path d="M28 44 C28 24 72 24 72 44 C68 34 60 28 50 28 C40 28 32 34 28 44 Z" fill="url(#gbuHair)"/>
            <path d="M30 38 Q40 32 50 34 Q60 32 70 38" stroke="#475569" stroke-width="2.5" stroke-linecap="round" fill="none"/>
            {/* Distinguished Gold Scholar Spectacles */}
            <circle cx="41" cy="47" r="6.5" fill="none" stroke="#FBBF24" stroke-width="1.8"/>
            <circle cx="59" cy="47" r="6.5" fill="none" stroke="#FBBF24" stroke-width="1.8"/>
            <line x1="47.5" y1="47" x2="52.5" y2="47" stroke="#FBBF24" stroke-width="1.8"/>
            {/* Regal Academic Crown resting on well-styled hair */}
            <path d="M36 28 C37 18 63 18 64 28 Z" fill="#581C87" opacity="0.8"/>
            <polygon points="34,28 37,16 43,23 50,11 57,23 63,16 66,28" fill="url(#gbuGold)" stroke="#B45309" stroke-width="1.2"/>
            <path d="M34 28 C34 28 50 31 66 28 L66 32 C66 32 50 35 34 32 Z" fill="#F59E0B" stroke="#B45309" stroke-width="1"/>
            <circle cx="50" cy="11" r="2.8" fill="#3B82F6" stroke="#1D4ED8" stroke-width="0.8"/>
            <circle cx="37" cy="16" r="2.2" fill="#EF4444" stroke="#991B1B" stroke-width="0.8"/>
            <circle cx="63" cy="16" r="2.2" fill="#EF4444" stroke="#991B1B" stroke-width="0.8"/>
            <circle cx="42" cy="30" r="1.3" fill="#3B82F6"/>
            <circle cx="50" cy="31" r="1.5" fill="#EF4444"/>
            <circle cx="58" cy="30" r="1.3" fill="#3B82F6"/>
        </svg>"""
    }
]

def render_all():
    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=EDGE_PATH, headless=True)
        page = browser.new_page(viewport={"width": 400, "height": 400})

        for av in AVATARS:
            html = f"""<!DOCTYPE html>
            <html>
            <head><style>body {{ margin: 0; background: transparent; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }}</style></head>
            <body>
            {av['svg']}
            </body>
            </html>"""
            page.set_content(html)
            svg_locator = page.locator("svg")
            out_path = os.path.join(ARTIFACT_DIR, av["filename"])
            svg_locator.screenshot(path=out_path, omit_background=True)
            print(f"Rendered: {out_path}")

        # Render combined grid
        grid_items_html = ""
        for av in AVATARS:
            grid_items_html += f"""
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 12px; text-align: center; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif;">
                <div style="width: 120px; height: 120px; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
                    {av['svg'].replace('width="300" height="300"', 'width="116" height="116"')}
                </div>
                <div style="font-weight: 700; font-size: 13.5px; margin-top: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{av['name']}</div>
                <div style="font-size: 11px; color: #38bdf8; font-weight: 700; margin-top: 2px; letter-spacing: 0.5px;">{av['school']}</div>
            </div>
            """

        grid_html = f"""<!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ margin: 0; padding: 24px; background: #0b0f19; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }}
                .grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; max-width: 860px; }}
                .header {{ text-align: center; margin-bottom: 22px; }}
                .title {{ color: #f8fafc; font-family: system-ui, sans-serif; font-size: 24px; font-weight: 800; }}
                .subtitle {{ color: #94a3b8; font-family: system-ui, sans-serif; font-size: 13px; font-weight: 500; margin-top: 4px; }}
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">GBU One — Complete Academic Avatar Pack</div>
                <div class="subtitle">All 19 School Avatars (SOICT, SOE, SOBT, SOM, SOLJG, SOHSS, SOVSAS & ADMIN)</div>
            </div>
            <div class="grid">
                {grid_items_html}
            </div>
        </body>
        </html>"""

        grid_page = browser.new_page(viewport={"width": 940, "height": 1150})
        grid_page.set_content(grid_html)
        grid_out = os.path.join(ARTIFACT_DIR, "avatars_grid.png")
        grid_page.screenshot(path=grid_out)
        print(f"Rendered Grid: {grid_out}")

        browser.close()

if __name__ == "__main__":
    render_all()
