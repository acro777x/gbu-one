import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Polygon,
  Line,
  Ellipse,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { useAppTheme } from '../../lib/ThemeContext';

export interface AvatarSvgProps {
  size?: number;
}

// ----------------------------------------------------------------------
// 1. Tech Scholar (SOICT - Cyan/Indigo, coder glasses & terminal symbol)
// ----------------------------------------------------------------------
export const TechScholarAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="techBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#1E1B4B" />
        <Stop offset="100%" stopColor="#0F172A" />
      </LinearGradient>
      <LinearGradient id="techSkin" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#FED7AA" />
        <Stop offset="100%" stopColor="#FDBA74" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#techBg)" />
    {/* Body / Hoodie */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#312E81" />
    <Path d="M42 68 L50 82 L58 68 Z" fill="#06B6D4" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="url(#techSkin)" />
    <Circle cx="50" cy="46" r="20" fill="url(#techSkin)" />
    {/* Hair */}
    <Path d="M28 44 C28 26, 72 26, 72 44 C68 34, 58 26, 50 26 C40 26, 32 34, 28 44 Z" fill="#1E1B4B" />
    <Path d="M30 40 Q38 32 50 34 Q62 32 70 40" stroke="#3730A3" strokeWidth="3" fill="none" strokeLinecap="round" />
    {/* Coder Glasses (Cyan frames) */}
    <Rect x="33" y="42" width="14" height="11" rx="3" fill="#0F172A" stroke="#06B6D4" strokeWidth="2" />
    <Rect x="53" y="42" width="14" height="11" rx="3" fill="#0F172A" stroke="#06B6D4" strokeWidth="2" />
    <Line x1="47" y1="47" x2="53" y2="47" stroke="#06B6D4" strokeWidth="2" />
    {/* Terminal prompt (>_) in glasses */}
    <Path d="M36 46 L39 47.5 L36 49" stroke="#22D3EE" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Line x1="41" y1="49" x2="44" y2="49" stroke="#22D3EE" strokeWidth="1.2" strokeLinecap="round" />
    {/* Terminal symbol badge on hoodie */}
    <Rect x="38" y="86" width="24" height="10" rx="3" fill="#030712" stroke="#06B6D4" strokeWidth="1" />
    <Path d="M42 89 L45 91 L42 93" stroke="#22D3EE" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Line x1="47" y1="93" x2="50" y2="93" stroke="#22D3EE" strokeWidth="1" strokeLinecap="round" />
  </Svg>
));
TechScholarAvatar.displayName = 'TechScholarAvatar';

// ----------------------------------------------------------------------
// 2. Cyber Guardian (SOICT - Neon Green/Slate, cybersecurity visor & shield)
// ----------------------------------------------------------------------
export const CyberGuardianAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="cyberBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#022C22" />
        <Stop offset="100%" stopColor="#0F172A" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#cyberBg)" />
    {/* Cyber Armor Collar */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#1E293B" />
    <Path d="M40 70 L50 82 L60 70 Z" fill="#065F46" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="46" r="20" fill="#FED7AA" />
    {/* Dark Hair */}
    <Path d="M28 42 C28 26 72 26 72 42 C68 32 58 24 50 24 C40 24 32 32 28 42 Z" fill="#022C22" />
    {/* Neon Green Visor */}
    <Path d="M29 42 L71 42 L68 52 L32 52 Z" fill="#064E3B" stroke="#22C55E" strokeWidth="2" />
    <Line x1="35" y1="47" x2="65" y2="47" stroke="#4ADE80" strokeWidth="1.5" />
    {/* Security Shield Badge */}
    <Path d="M66 70 L78 66 L78 78 Q78 87 66 91 Q54 87 54 78 L54 66 Z" fill="#047857" stroke="#34D399" strokeWidth="1.5" />
    <Path d="M62 78 L65 81 L70 75" stroke="#A7F3D0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
));
CyberGuardianAvatar.displayName = 'CyberGuardianAvatar';

// ----------------------------------------------------------------------
// 3. AI Researcher (SOICT - Violet/Fuchsia, neural network nodes & bot face)
// ----------------------------------------------------------------------
export const AiResearcherAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="aiBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#4A044E" />
        <Stop offset="100%" stopColor="#701A75" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#aiBg)" />
    {/* Futuristic Tech Coat */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#581C87" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="46" r="20" fill="#FED7AA" />
    {/* Purple Hair */}
    <Path d="M28 44 C28 26 72 26 72 44 C66 32 58 26 50 26 C40 26 34 32 28 44 Z" fill="#3B0764" />
    {/* Neural Network Nodes on Top */}
    <Line x1="28" y1="32" x2="38" y2="24" stroke="#C084FC" strokeWidth="1.2" />
    <Line x1="38" y1="24" x2="50" y2="20" stroke="#C084FC" strokeWidth="1.2" />
    <Line x1="50" y1="20" x2="62" y2="24" stroke="#C084FC" strokeWidth="1.2" />
    <Line x1="62" y1="24" x2="72" y2="32" stroke="#C084FC" strokeWidth="1.2" />
    <Circle cx="28" cy="32" r="3" fill="#E879F9" />
    <Circle cx="38" cy="24" r="3.5" fill="#E879F9" />
    <Circle cx="50" cy="20" r="4" fill="#F0ABFC" />
    <Circle cx="62" cy="24" r="3.5" fill="#E879F9" />
    <Circle cx="72" cy="32" r="3" fill="#E879F9" />
    {/* Bot Companion Badge */}
    <Rect x="64" y="70" width="18" height="15" rx="4" fill="#3B0764" stroke="#E879F9" strokeWidth="1.5" />
    <Circle cx="69" cy="76" r="1.5" fill="#F0ABFC" />
    <Circle cx="77" cy="76" r="1.5" fill="#F0ABFC" />
    <Line x1="70" y1="81" x2="76" y2="81" stroke="#F0ABFC" strokeWidth="1" strokeLinecap="round" />
    <Line x1="73" y1="70" x2="73" y2="66" stroke="#E879F9" strokeWidth="1" />
    <Circle cx="73" cy="65" r="1" fill="#F0ABFC" />
  </Svg>
));
AiResearcherAvatar.displayName = 'AiResearcherAvatar';

// ----------------------------------------------------------------------
// 4. Data Wizard (SOICT - Indigo/Cyan, floating data cube & matrix runes)
// ----------------------------------------------------------------------
export const DataWizardAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="dataBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#030712" />
        <Stop offset="100%" stopColor="#1E1B4B" />
      </LinearGradient>
      <LinearGradient id="dataHood" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#4338CA" />
        <Stop offset="100%" stopColor="#1E1B4B" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#dataBg)" />
    {/* Binary Spark Nodes */}
    <Circle cx="18" cy="28" r="1.8" fill="#38BDF8" opacity="0.6" />
    <Circle cx="24" cy="20" r="1.2" fill="#818CF8" opacity="0.6" />
    <Circle cx="82" cy="26" r="1.8" fill="#22D3EE" opacity="0.6" />
    <Circle cx="76" cy="18" r="1.2" fill="#C084FC" opacity="0.6" />
    {/* Tech Wizard Hoodie */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="url(#dataHood)" />
    <Path d="M36 78 L36 96 M64 78 L64 96" stroke="#38BDF8" strokeWidth="1.2" strokeDasharray="3 2" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="46" r="20" fill="#FED7AA" />
    {/* Cyber Wizard Cowl / Hair */}
    <Path d="M26 44 C26 22 40 18 50 16 C60 18 74 22 74 44 C68 32 58 26 50 26 C42 26 32 32 26 44 Z" fill="#1E1B4B" />
    <Path d="M30 42 Q40 32 50 35 Q60 32 70 42" stroke="#6366F1" strokeWidth="3" fill="none" strokeLinecap="round" />
    {/* Augmented Cyber Visor */}
    <Rect x="32" y="43" width="36" height="8" rx="2" fill="#0F172A" stroke="#06B6D4" strokeWidth="1.5" />
    <Line x1="35" y1="47" x2="65" y2="47" stroke="#22D3EE" strokeWidth="1.5" />
    <Circle cx="40" cy="47" r="1.2" fill="#FFFFFF" />
    <Circle cx="60" cy="47" r="1.2" fill="#FFFFFF" />
    {/* Isometric Floating Data Cube */}
    <Polygon points="50,75 57,71 50,67 43,71" fill="#38BDF8" opacity="0.9" />
    <Polygon points="43,71 50,75 50,83 43,79" fill="#0284C7" opacity="0.9" />
    <Polygon points="57,71 50,75 50,83 57,79" fill="#4F46E5" opacity="0.9" />
    <Polygon points="50,67 57,71 57,79 50,83 43,79 43,71" stroke="#A5F3FC" strokeWidth="1" fill="none" />
    {/* Digital Rune Sparks */}
    <Circle cx="76" cy="48" r="2" fill="#22D3EE" />
    <Line x1="73" y1="48" x2="79" y2="48" stroke="#22D3EE" strokeWidth="0.8" />
    <Line x1="76" y1="45" x2="76" y2="51" stroke="#22D3EE" strokeWidth="0.8" />
    <Circle cx="24" cy="50" r="1.8" fill="#A855F7" />
  </Svg>
));
DataWizardAvatar.displayName = 'DataWizardAvatar';

// ----------------------------------------------------------------------
// 5. Innovator Engineer (SOE - Orange/Amber, hardhat & mechanical gear)
// ----------------------------------------------------------------------
export const EngineerAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="engBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#7C2D12" />
        <Stop offset="100%" stopColor="#C2410C" />
      </LinearGradient>
      <LinearGradient id="engHardhat" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#FBBF24" />
        <Stop offset="100%" stopColor="#F59E0B" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#engBg)" />
    {/* High-vis Vest / Shirt */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#EA580C" />
    <Rect x="34" y="74" width="6" height="26" fill="#FDE047" />
    <Rect x="60" y="74" width="6" height="26" fill="#FDE047" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="48" r="19" fill="#FED7AA" />
    {/* Hardhat Helmet */}
    <Path d="M26 44 C26 28 74 28 74 44 L78 48 L22 48 Z" fill="url(#engHardhat)" />
    <Rect x="46" y="27" width="8" height="17" rx="2" fill="#D97706" />
    {/* Mechanical Gear Motif */}
    <Circle cx="72" cy="78" r="11" fill="#7C2D12" stroke="#FDE047" strokeWidth="2" />
    <Circle cx="72" cy="78" r="4" fill="#F59E0B" />
    <Line x1="72" y1="64" x2="72" y2="67" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" />
    <Line x1="72" y1="89" x2="72" y2="92" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" />
    <Line x1="58" y1="78" x2="61" y2="78" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" />
    <Line x1="83" y1="78" x2="86" y2="78" stroke="#FDE047" strokeWidth="2.5" strokeLinecap="round" />
  </Svg>
));
EngineerAvatar.displayName = 'EngineerAvatar';

// ----------------------------------------------------------------------
// 6. Civil Architect (SOE - Blueprint Blue/Amber, drafting compass & schematics)
// ----------------------------------------------------------------------
export const CivilArchitectAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="archBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#075985" />
        <Stop offset="100%" stopColor="#0C4A6E" />
      </LinearGradient>
      <LinearGradient id="archCoat" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#334155" />
        <Stop offset="100%" stopColor="#1E293B" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#archBg)" />
    {/* Blueprint Grid Lines */}
    <Line x1="15" y1="32" x2="85" y2="32" stroke="#38BDF8" strokeWidth="0.6" opacity="0.25" strokeDasharray="3 3" />
    <Line x1="15" y1="52" x2="85" y2="52" stroke="#38BDF8" strokeWidth="0.6" opacity="0.25" strokeDasharray="3 3" />
    <Line x1="32" y1="15" x2="32" y2="85" stroke="#38BDF8" strokeWidth="0.6" opacity="0.25" strokeDasharray="3 3" />
    <Line x1="68" y1="15" x2="68" y2="85" stroke="#38BDF8" strokeWidth="0.6" opacity="0.25" strokeDasharray="3 3" />
    {/* Structured Coat */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="url(#archCoat)" />
    <Rect x="42" y="65" width="16" height="10" rx="2" fill="#0F172A" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="46" r="20" fill="#FED7AA" />
    {/* Styled Hair */}
    <Path d="M28 44 C28 26 72 26 72 44 C66 32 58 26 50 26 C40 26 34 32 28 44 Z" fill="#0F172A" />
    <Path d="M32 38 Q42 32 52 34 Q62 33 68 39" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    {/* Architect Round Glasses */}
    <Circle cx="39" cy="46" r="7.5" fill="none" stroke="#F59E0B" strokeWidth="1.8" />
    <Circle cx="61" cy="46" r="7.5" fill="none" stroke="#F59E0B" strokeWidth="1.8" />
    <Line x1="46.5" y1="46" x2="53.5" y2="46" stroke="#F59E0B" strokeWidth="1.8" />
    {/* Drafting Triangle Set-Square */}
    <Polygon points="30,82 42,94 30,94" fill="#F59E0B" opacity="0.9" stroke="#FDE047" strokeWidth="1" />
    <Polygon points="33,88 38,92 33,92" fill="#1E293B" />
    {/* Compass Divider on Shoulder */}
    <Path d="M68 95 L74 76 L80 95" stroke="#F8FAFC" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    <Circle cx="74" cy="76" r="2.5" fill="#F59E0B" />
    <Line x1="70" y1="87" x2="78" y2="87" stroke="#CBD5E1" strokeWidth="1.2" />
  </Svg>
));
CivilArchitectAvatar.displayName = 'CivilArchitectAvatar';

// ----------------------------------------------------------------------
// 7. Campus Athlete / Speed Runner (SOE - Athletic headband & thunderbolt)
// ----------------------------------------------------------------------
export const SpeedRunnerAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="speedBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#7F1D1D" />
        <Stop offset="100%" stopColor="#EA580C" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#speedBg)" />
    {/* Track Jersey */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#B91C1C" />
    <Path d="M42 68 L50 80 L58 68 Z" fill="#F97316" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="46" r="20" fill="#FED7AA" />
    {/* Hair */}
    <Path d="M28 42 C28 26 72 26 72 42 C66 32 58 26 50 26 C40 26 34 32 28 42 Z" fill="#450A0A" />
    {/* Athletic Headband */}
    <Rect x="26" y="38" width="48" height="8" rx="2" fill="#EF4444" />
    <Rect x="26" y="41" width="48" height="2" fill="#FFFFFF" />
    {/* Thunderbolt Icon on Shoulder */}
    <Polygon points="74,62 66,76 72,76 64,92 78,74 71,74" fill="#FACC15" stroke="#B45309" strokeWidth="1" />
  </Svg>
));
SpeedRunnerAvatar.displayName = 'SpeedRunnerAvatar';

// ----------------------------------------------------------------------
// 8. Lab Scientist (SOBT - Emerald/Teal, goggles & chemistry flask)
// ----------------------------------------------------------------------
export const LabScientistAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="labBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#064E3B" />
        <Stop offset="100%" stopColor="#0F766E" />
      </LinearGradient>
      <LinearGradient id="labCoat" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#F8FAFC" />
        <Stop offset="100%" stopColor="#E2E8F0" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#labBg)" />
    {/* Lab Coat */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="url(#labCoat)" />
    <Path d="M44 68 L50 82 L56 68 Z" fill="#047857" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="46" r="20" fill="#FED7AA" />
    {/* Teal Hair */}
    <Path d="M28 44 C28 26 72 26 72 44 C66 32 58 26 50 26 C40 26 34 32 28 44 Z" fill="#134E4A" />
    {/* Scientist Goggles */}
    <Circle cx="39" cy="46" r="9" fill="#042F2E" stroke="#2DD4BF" strokeWidth="2.2" />
    <Circle cx="61" cy="46" r="9" fill="#042F2E" stroke="#2DD4BF" strokeWidth="2.2" />
    <Line x1="48" y1="46" x2="52" y2="46" stroke="#2DD4BF" strokeWidth="2.2" />
    {/* Goggle reflections */}
    <Path d="M35 43 Q38 41 42 43" stroke="#A7F3D0" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <Path d="M57 43 Q60 41 64 43" stroke="#A7F3D0" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    {/* Chemistry Flask with bubbles */}
    <Path d="M68 72 L74 88 C74.5 89.5 73.5 91 72 91 L58 91 C56.5 91 55.5 89.5 56 88 L62 72 L62 67 L68 67 Z" fill="#042F2E" stroke="#5EEAD4" strokeWidth="1.5" />
    <Path d="M58 84 L72 84 L73.5 89 L56.5 89 Z" fill="#10B981" />
    <Circle cx="65" cy="80" r="1.5" fill="#6EE7B7" />
    <Circle cx="62" cy="76" r="1" fill="#A7F3D0" />
    <Circle cx="66" cy="69" r="1" fill="#A7F3D0" />
  </Svg>
));
LabScientistAvatar.displayName = 'LabScientistAvatar';

// ----------------------------------------------------------------------
// 9. Bio Innovator (SOBT - Mint/Teal, DNA double-helix & biotech visor)
// ----------------------------------------------------------------------
export const BioInnovatorAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="bioBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#022C22" />
        <Stop offset="100%" stopColor="#042F2E" />
      </LinearGradient>
      <LinearGradient id="bioCoat" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#F0FDFA" />
        <Stop offset="100%" stopColor="#CCFBF1" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#bioBg)" />
    {/* Molecule Nodes in Background */}
    <Circle cx="18" cy="28" r="2.5" fill="#34D399" opacity="0.6" />
    <Circle cx="26" cy="22" r="1.8" fill="#2DD4BF" opacity="0.6" />
    <Line x1="18" y1="28" x2="26" y2="22" stroke="#34D399" strokeWidth="1" opacity="0.5" />
    <Circle cx="82" cy="30" r="2.2" fill="#6EE7B7" opacity="0.6" />
    <Circle cx="76" cy="22" r="1.5" fill="#34D399" opacity="0.6" />
    <Line x1="82" y1="30" x2="76" y2="22" stroke="#6EE7B7" strokeWidth="1" opacity="0.5" />
    {/* Biotech Lab Coat */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="url(#bioCoat)" />
    <Path d="M42 68 L50 82 L58 68 Z" fill="#0D9488" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="46" r="20" fill="#FED7AA" />
    {/* Hair with Mint Highlight */}
    <Path d="M28 44 C28 26 72 26 72 44 C66 32 58 26 50 26 C40 26 34 32 28 44 Z" fill="#134E4A" />
    <Path d="M34 38 Q42 30 52 32 Q62 30 66 38" stroke="#2DD4BF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    {/* Bio Visor */}
    <Path d="M30 43 Q50 40 70 43 L68 51 Q50 48 32 51 Z" fill="#042F2E" stroke="#10B981" strokeWidth="1.5" />
    <Line x1="36" y1="46" x2="64" y2="46" stroke="#6EE7B7" strokeWidth="1.2" />
    {/* Glowing Double-Helix DNA Strand Motif */}
    <Path d="M42 78 Q50 84 42 90 Q50 96 42 100" stroke="#10B981" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    <Path d="M58 78 Q50 84 58 90 Q50 96 58 100" stroke="#06B6D4" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    <Line x1="43" y1="81" x2="57" y2="81" stroke="#A7F3D0" strokeWidth="1.8" />
    <Line x1="47" y1="84" x2="53" y2="84" stroke="#A7F3D0" strokeWidth="1.8" />
    <Line x1="43" y1="87" x2="57" y2="87" stroke="#A7F3D0" strokeWidth="1.8" />
    <Line x1="47" y1="93" x2="53" y2="93" stroke="#A7F3D0" strokeWidth="1.8" />
    <Line x1="43" y1="96" x2="57" y2="96" stroke="#A7F3D0" strokeWidth="1.8" />
  </Svg>
));
BioInnovatorAvatar.displayName = 'BioInnovatorAvatar';

// ----------------------------------------------------------------------
// 10. Business Leader (SOM - Blue/Navy, suit & growth spark)
// ----------------------------------------------------------------------
export const BusinessLeaderAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="bizBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#172554" />
        <Stop offset="100%" stopColor="#1E3A8A" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#bizBg)" />
    {/* Crisp Navy Blazer */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#1E293B" />
    {/* White Collared Shirt */}
    <Polygon points="42,68 50,84 58,68 50,68" fill="#F8FAFC" />
    {/* Crimson Tie */}
    <Polygon points="49,70 51,70 53,88 50,94 47,88" fill="#EF4444" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="46" r="20" fill="#FED7AA" />
    {/* Slick Hair */}
    <Path d="M28 44 C28 26 72 24 72 42 C64 30 56 26 50 26 C42 26 34 32 28 44 Z" fill="#0F172A" />
    {/* Growth Spark / Star Accent */}
    <Path
      d="M78 68 Q78 61 84 61 Q78 61 78 54 Q78 61 72 61 Q78 61 78 68 Z"
      fill="#FACC15"
    />
    <Path
      d="M84 76 Q84 72 88 72 Q84 72 84 68 Q84 72 80 72 Q84 72 84 76 Z"
      fill="#FDE047"
    />
  </Svg>
));
BusinessLeaderAvatar.displayName = 'BusinessLeaderAvatar';

// ----------------------------------------------------------------------
// 11. Campus Ambassador (SOM - Yellow/Gold, star badge & megaphone)
// ----------------------------------------------------------------------
export const CampusAmbassadorAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="ambBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#78350F" />
        <Stop offset="100%" stopColor="#D97706" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#ambBg)" />
    {/* Blazer */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#92400E" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="46" r="20" fill="#FED7AA" />
    {/* Warm Brown Hair */}
    <Path d="M28 44 C28 26 72 26 72 44 C66 32 58 26 50 26 C40 26 34 32 28 44 Z" fill="#451A03" />
    {/* Star Badge on Left Lapel */}
    <Polygon points="35,74 37,78 41,78.5 38,81.5 39,85.5 35,83.5 31,85.5 32,81.5 29,78.5 33,78" fill="#FACC15" stroke="#B45309" strokeWidth="0.8" />
    {/* Megaphone / Bullhorn on Right */}
    <Polygon points="64,74 76,67 78,85 64,78" fill="#F59E0B" stroke="#D97706" strokeWidth="1.2" />
    <Rect x="58" y="74" width="6" height="5" rx="1" fill="#78350F" />
    <Path d="M80 72 Q83 76 80 80" stroke="#FEF08A" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    <Path d="M83 69 Q87 76 83 83" stroke="#FEF08A" strokeWidth="1.2" strokeLinecap="round" fill="none" />
  </Svg>
));
CampusAmbassadorAvatar.displayName = 'CampusAmbassadorAvatar';

// ----------------------------------------------------------------------
// 12. Fin Analyst (SOM - Emerald/Gold, stock candlesticks & bull trend)
// ----------------------------------------------------------------------
export const FinAnalystAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="finBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#064E3B" />
        <Stop offset="100%" stopColor="#0F172A" />
      </LinearGradient>
      <LinearGradient id="finSuit" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#1E293B" />
        <Stop offset="100%" stopColor="#0F172A" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#finBg)" />
    {/* Tailored Business Suit */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="url(#finSuit)" />
    <Polygon points="42,68 50,84 58,68 50,68" fill="#F8FAFC" />
    <Polygon points="49,70 51,70 53,88 50,94 47,88" fill="#10B981" />
    <Polygon points="29,82 34,78 37,82" fill="#FACC15" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="46" r="20" fill="#FED7AA" />
    {/* Executive Haircut */}
    <Path d="M28 44 C28 26 72 24 72 42 C64 30 56 26 50 26 C42 26 34 32 28 44 Z" fill="#1E293B" />
    <Path d="M30 38 Q40 32 50 33 Q60 32 68 38" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    {/* Executive Square Frames */}
    <Rect x="33" y="42" width="14" height="10" rx="2" fill="none" stroke="#FACC15" strokeWidth="1.5" />
    <Rect x="53" y="42" width="14" height="10" rx="2" fill="none" stroke="#FACC15" strokeWidth="1.5" />
    <Line x1="47" y1="46" x2="53" y2="46" stroke="#FACC15" strokeWidth="1.5" />
    {/* Bullish Market Candlesticks */}
    <Line x1="70" y1="68" x2="70" y2="82" stroke="#34D399" strokeWidth="1" />
    <Rect x="68" y="72" width="4" height="6" fill="#10B981" rx="0.5" />
    <Line x1="77" y1="62" x2="77" y2="78" stroke="#34D399" strokeWidth="1" />
    <Rect x="75" y="65" width="4" height="8" fill="#10B981" rx="0.5" />
    <Line x1="84" y1="56" x2="84" y2="72" stroke="#34D399" strokeWidth="1" />
    <Rect x="82" y="59" width="4" height="7" fill="#10B981" rx="0.5" />
    {/* Upward Growth Arrow */}
    <Path d="M66 84 Q76 80 88 56" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" fill="none" />
    <Polygon points="88,54 84,59 89,61" fill="#FACC15" />
  </Svg>
));
FinAnalystAvatar.displayName = 'FinAnalystAvatar';

// ----------------------------------------------------------------------
// 13. Legal Eagle (SOLJG - Purple/Violet, scales of justice)
// ----------------------------------------------------------------------
export const LegalEagleAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="lawBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#3B0764" />
        <Stop offset="100%" stopColor="#581C87" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#lawBg)" />
    {/* Judicial Robe */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#4C1D95" />
    <Path d="M44 68 L50 80 L56 68 Z" fill="#A855F7" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="46" r="20" fill="#FED7AA" />
    {/* Regal Violet Hair */}
    <Path d="M28 46 C28 26 72 26 72 46 C68 32 58 24 50 24 C40 24 32 32 28 46 Z" fill="#2E1065" />
    {/* Scales of Justice */}
    <Line x1="64" y1="72" x2="86" y2="72" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
    <Line x1="75" y1="67" x2="75" y2="88" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
    {/* Left Pan */}
    <Path d="M62 79 Q66 83 70 79 Z" fill="#FBBF24" />
    <Line x1="64" y1="72" x2="63" y2="79" stroke="#FDE68A" strokeWidth="1" />
    <Line x1="68" y1="72" x2="69" y2="79" stroke="#FDE68A" strokeWidth="1" />
    {/* Right Pan */}
    <Path d="M80 79 Q84 83 88 79 Z" fill="#FBBF24" />
    <Line x1="82" y1="72" x2="81" y2="79" stroke="#FDE68A" strokeWidth="1" />
    <Line x1="86" y1="72" x2="87" y2="79" stroke="#FDE68A" strokeWidth="1" />
  </Svg>
));
LegalEagleAvatar.displayName = 'LegalEagleAvatar';

// ----------------------------------------------------------------------
// 14. Justice Advocate (SOLJG - Crimson/Slate, judicial gavel & barrister tabs)
// ----------------------------------------------------------------------
export const JusticeAdvocateAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="advBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#4C0519" />
        <Stop offset="100%" stopColor="#881337" />
      </LinearGradient>
      <LinearGradient id="advRobe" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#1E293B" />
        <Stop offset="100%" stopColor="#0F172A" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#advBg)" />
    {/* Law Pillars Background */}
    <Line x1="18" y1="22" x2="18" y2="58" stroke="#F43F5E" strokeWidth="1" opacity="0.3" />
    <Line x1="82" y1="22" x2="82" y2="58" stroke="#F43F5E" strokeWidth="1" opacity="0.3" />
    {/* Judicial Robe */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="url(#advRobe)" />
    {/* Barrister Tabs */}
    <Rect x="44" y="68" width="12" height="5" fill="#F8FAFC" />
    <Polygon points="45,73 49,73 48,88 44,88" fill="#F8FAFC" />
    <Polygon points="51,73 55,73 56,88 52,88" fill="#F8FAFC" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="46" r="20" fill="#FED7AA" />
    {/* Advocate Hair */}
    <Path d="M28 44 C28 26 72 26 72 44 C66 32 58 26 50 26 C40 26 34 32 28 44 Z" fill="#18181B" />
    <Path d="M30 38 Q40 32 50 33 Q60 32 68 38" stroke="#3F3F46" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    {/* Judicial Gavel & Sound Block */}
    <Rect x="65" y="88" width="18" height="6" rx="1.5" fill="#78350F" stroke="#F59E0B" strokeWidth="1" />
    <Rect x="68" y="74" width="12" height="7" rx="1.5" fill="#92400E" stroke="#F59E0B" strokeWidth="1" />
    <Line x1="74" y1="78" x2="86" y2="68" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />
    <Polygon points="64,74 65.5,76 67.5,76.5 66,78 66.5,80 64,79 62,80 62.5,78 61,76.5 63,76" fill="#FDE047" />
  </Svg>
));
JusticeAdvocateAvatar.displayName = 'JusticeAdvocateAvatar';

// ----------------------------------------------------------------------
// 15. Creative Artist (SOHSS - Pink/Rose, beret & color palette)
// ----------------------------------------------------------------------
export const CreativeArtistAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="artBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#831843" />
        <Stop offset="100%" stopColor="#BE185D" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#artBg)" />
    {/* Smock / Shirt */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#9D174D" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="48" r="19" fill="#FED7AA" />
    {/* Chic Beret */}
    <Path d="M24 40 C24 26 70 20 78 34 C80 40 70 44 48 44 C28 44 24 43 24 40 Z" fill="#F43F5E" />
    <Path d="M50 20 L52 24" stroke="#BE123C" strokeWidth="2.5" strokeLinecap="round" />
    {/* Artist Palette */}
    <Path d="M64 78 C64 71 85 67 87 78 C88 84 78 91 70 89 C66 88 64 83 64 78 Z" fill="#FEF08A" stroke="#CA8A04" strokeWidth="1" />
    <Circle cx="71" cy="76" r="2" fill="#06B6D4" />
    <Circle cx="78" cy="74" r="2" fill="#EC4899" />
    <Circle cx="82" cy="80" r="2" fill="#8B5CF6" />
    <Circle cx="75" cy="84" r="2" fill="#EF4444" />
  </Svg>
));
CreativeArtistAvatar.displayName = 'CreativeArtistAvatar';

// ----------------------------------------------------------------------
// 16. Campus Scribe (SOHSS - Amber/Sepia, feather quill & parchment)
// ----------------------------------------------------------------------
export const CampusScribeAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="scribeBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#451A03" />
        <Stop offset="100%" stopColor="#78350F" />
      </LinearGradient>
      <LinearGradient id="scribeCoat" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#854D0E" />
        <Stop offset="100%" stopColor="#713F12" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#scribeBg)" />
    {/* Tweed Jacket */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="url(#scribeCoat)" />
    {/* Scholar Wool Scarf */}
    <Path d="M38 66 Q50 72 62 66 Q66 74 60 78 Q50 74 40 78 Z" fill="#B91C1C" />
    <Rect x="42" y="76" width="7" height="16" rx="1.5" fill="#991B1B" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="46" r="20" fill="#FED7AA" />
    {/* Literary Wavy Hair */}
    <Path d="M26 44 C26 24 74 24 74 44 C72 32 64 24 50 24 C36 24 28 32 26 44 Z" fill="#292524" />
    <Path d="M28 40 Q34 32 44 32 Q54 36 62 30 Q70 34 72 42" stroke="#57534E" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    {/* Parchment Codex */}
    <Path d="M26 84 C30 82 38 82 42 85 L42 98 C38 95 30 95 26 97 Z" fill="#FEF3C7" stroke="#D97706" strokeWidth="1" />
    <Line x1="29" y1="87" x2="39" y2="87" stroke="#B45309" strokeWidth="0.8" />
    <Line x1="29" y1="91" x2="39" y2="91" stroke="#B45309" strokeWidth="0.8" />
    {/* Feather Quill Pen */}
    <Path d="M72 62 Q78 68 84 64 Q80 76 70 88" stroke="#FDE047" strokeWidth="2" strokeLinecap="round" fill="none" />
    <Path d="M74 64 Q82 66 76 76 Z" fill="#FACC15" />
    <Polygon points="69,88 71,85 70,89" fill="#0F172A" />
    <Circle cx="67" cy="92" r="1.5" fill="#1C1917" />
  </Svg>
));
CampusScribeAvatar.displayName = 'CampusScribeAvatar';

// ----------------------------------------------------------------------
// 17. Academic Bookworm (SOVSAS - Sky/Blue, reading glasses & open book)
// ----------------------------------------------------------------------
export const BookwormAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="bookBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#0C4A6E" />
        <Stop offset="100%" stopColor="#0284C7" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#bookBg)" />
    {/* Sweater */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="#0369A1" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="46" r="20" fill="#FED7AA" />
    {/* Hair */}
    <Path d="M28 44 C28 26 72 26 72 44 C66 32 58 26 50 26 C40 26 34 32 28 44 Z" fill="#082F49" />
    {/* Round Reading Glasses */}
    <Circle cx="40" cy="46" r="8" fill="none" stroke="#38BDF8" strokeWidth="2" />
    <Circle cx="60" cy="46" r="8" fill="none" stroke="#38BDF8" strokeWidth="2" />
    <Line x1="48" y1="46" x2="52" y2="46" stroke="#38BDF8" strokeWidth="2" />
    {/* Open Academic Book */}
    <Path d="M30 82 C38 80 47 82 50 85 C53 82 62 80 70 82 L70 96 C62 94 53 96 50 98 C47 96 38 94 30 96 Z" fill="#F8FAFC" stroke="#0284C7" strokeWidth="1.5" />
    <Line x1="50" y1="85" x2="50" y2="98" stroke="#0284C7" strokeWidth="1.5" />
    <Line x1="35" y1="86" x2="45" y2="86" stroke="#94A3B8" strokeWidth="1" />
    <Line x1="35" y1="90" x2="45" y2="90" stroke="#94A3B8" strokeWidth="1" />
    <Line x1="55" y1="86" x2="65" y2="86" stroke="#94A3B8" strokeWidth="1" />
    <Line x1="55" y1="90" x2="65" y2="90" stroke="#94A3B8" strokeWidth="1" />
  </Svg>
));
BookwormAvatar.displayName = 'BookwormAvatar';

// ----------------------------------------------------------------------
// 18. Quantum Physicist (SOVSAS - Cosmic Indigo, Rutherford-Bohr atom rings)
// ----------------------------------------------------------------------
export const QuantumPhysicistAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="quantBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#0F172A" />
        <Stop offset="100%" stopColor="#312E81" />
      </LinearGradient>
      <LinearGradient id="quantCoat" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#3730A3" />
        <Stop offset="100%" stopColor="#1E1B4B" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#quantBg)" />
    {/* Lab Coat / Turtleneck */}
    <Path d="M22 100 C22 75 32 68 50 68 C68 68 78 75 78 100 Z" fill="url(#quantCoat)" />
    <Rect x="42" y="65" width="16" height="10" rx="2" fill="#1E1B4B" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="46" r="20" fill="#FED7AA" />
    {/* Physicist Hair */}
    <Path d="M28 44 C28 26 72 26 72 44 C66 32 58 26 50 26 C40 26 34 32 28 44 Z" fill="#1E1B4B" />
    <Path d="M30 38 Q40 30 50 32 Q60 30 70 38" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    {/* Physicist Wire Spectacles */}
    <Circle cx="39" cy="46" r="7.5" fill="none" stroke="#818CF8" strokeWidth="1.8" />
    <Circle cx="61" cy="46" r="7.5" fill="none" stroke="#818CF8" strokeWidth="1.8" />
    <Line x1="46.5" y1="46" x2="53.5" y2="46" stroke="#818CF8" strokeWidth="1.8" />
    {/* Rutherford-Bohr Quantum Atom */}
    <Circle cx="50" cy="84" r="3.5" fill="#F43F5E" />
    <Circle cx="50" cy="84" r="1.5" fill="#FFE4E6" />
    <Ellipse cx="50" cy="84" rx="18" ry="6" fill="none" stroke="#22D3EE" strokeWidth="1.2" />
    <Circle cx="67" cy="84" r="1.8" fill="#38BDF8" />
    <Ellipse cx="50" cy="84" rx="18" ry="6" fill="none" stroke="#A855F7" strokeWidth="1.2" transform="rotate(-35 50 84)" />
    <Circle cx="38" cy="76" r="1.8" fill="#C084FC" />
    <Ellipse cx="50" cy="84" rx="18" ry="6" fill="none" stroke="#A855F7" strokeWidth="1.2" transform="rotate(35 50 84)" />
    <Circle cx="62" cy="76" r="1.8" fill="#C084FC" />
  </Svg>
));
QuantumPhysicistAvatar.displayName = 'QuantumPhysicistAvatar';

// ----------------------------------------------------------------------
// 19. GBU Admin / Scholar (ADMIN - Regal crown, academic robe, golden laurels)
// ----------------------------------------------------------------------
export const GbuAdminAvatar = React.memo<AvatarSvgProps>(({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="gbuBg" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#3B0764" />
        <Stop offset="50%" stopColor="#1E1B4B" />
        <Stop offset="100%" stopColor="#451A03" />
      </LinearGradient>
      <LinearGradient id="gbuGold" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#FEF08A" />
        <Stop offset="40%" stopColor="#FACC15" />
        <Stop offset="100%" stopColor="#D97706" />
      </LinearGradient>
      <LinearGradient id="gbuRobe" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#1E1B4B" />
        <Stop offset="100%" stopColor="#0F172A" />
      </LinearGradient>
      <LinearGradient id="gbuHair" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0%" stopColor="#1E293B" />
        <Stop offset="100%" stopColor="#0F172A" />
      </LinearGradient>
    </Defs>
    <Rect width="100" height="100" rx="26" fill="url(#gbuBg)" />
    {/* Stately Halo Aura */}
    <Circle cx="50" cy="46" r="30" fill="#FBBF24" opacity="0.12" />
    {/* Golden University Laurel Wreath Embracing the Persona */}
    <Path d="M16 66 C12 78 18 90 32 94" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    <Path d="M84 66 C88 78 82 90 68 94" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    {/* Left Leaves */}
    <Path d="M15 64 Q19 61 22 66 Q18 69 15 64 Z" fill="#FDE047" stroke="#D97706" strokeWidth="0.8" />
    <Path d="M12 73 Q16 70 20 74 Q15 78 12 73 Z" fill="#FDE047" stroke="#D97706" strokeWidth="0.8" />
    <Path d="M14 82 Q18 80 23 83 Q19 87 14 82 Z" fill="#FDE047" stroke="#D97706" strokeWidth="0.8" />
    <Path d="M21 90 Q25 87 30 90 Q26 94 21 90 Z" fill="#FDE047" stroke="#D97706" strokeWidth="0.8" />
    {/* Right Leaves */}
    <Path d="M85 64 Q81 61 78 66 Q82 69 85 64 Z" fill="#FDE047" stroke="#D97706" strokeWidth="0.8" />
    <Path d="M88 73 Q84 70 80 74 Q85 78 88 73 Z" fill="#FDE047" stroke="#D97706" strokeWidth="0.8" />
    <Path d="M86 82 Q82 80 77 83 Q81 87 86 82 Z" fill="#FDE047" stroke="#D97706" strokeWidth="0.8" />
    <Path d="M79 90 Q75 87 70 90 Q74 94 79 90 Z" fill="#FDE047" stroke="#D97706" strokeWidth="0.8" />
    {/* Academic Robe */}
    <Path d="M22 100 C22 72 31 66 50 66 C69 66 78 72 78 100 Z" fill="url(#gbuRobe)" />
    <Polygon points="44,66 50,78 56,66" fill="#F8FAFC" />
    {/* Academic Stole / Sash draped gracefully over shoulders */}
    <Path d="M34 68 L43 78 L41 100 L31 100 L31 72 Z" fill="url(#gbuGold)" />
    <Path d="M66 68 L57 78 L59 100 L69 100 L69 72 Z" fill="url(#gbuGold)" />
    <Line x1="43" y1="78" x2="41" y2="100" stroke="#FEF08A" strokeWidth="1" />
    <Line x1="57" y1="78" x2="59" y2="100" stroke="#FEF08A" strokeWidth="1" />
    {/* University Medallion */}
    <Circle cx="50" cy="80" r="7" fill="#FACC15" stroke="#B45309" strokeWidth="1.2" />
    <Polygon points="50,76 51.5,79 55,79.5 52.5,81.5 53,85 50,83 47,85 47.5,81.5 45,79.5 48.5,79" fill="#78350F" />
    {/* Head & Neck */}
    <Rect x="44" y="58" width="12" height="12" rx="4" fill="#FED7AA" />
    <Circle cx="50" cy="46" r="20" fill="#FED7AA" />
    {/* Stately Academic Coiffure / Hair */}
    <Path d="M28 44 C28 24 72 24 72 44 C68 34 60 28 50 28 C40 28 32 34 28 44 Z" fill="url(#gbuHair)" />
    <Path d="M30 38 Q40 32 50 34 Q60 32 70 38" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    {/* Distinguished Gold Scholar Spectacles */}
    <Circle cx="41" cy="47" r="6.5" fill="none" stroke="#FBBF24" strokeWidth="1.8" />
    <Circle cx="59" cy="47" r="6.5" fill="none" stroke="#FBBF24" strokeWidth="1.8" />
    <Line x1="47.5" y1="47" x2="52.5" y2="47" stroke="#FBBF24" strokeWidth="1.8" />
    {/* Regal Academic Crown resting on well-styled hair */}
    <Path d="M36 28 C37 18 63 18 64 28 Z" fill="#581C87" opacity="0.8" />
    <Polygon points="34,28 37,16 43,23 50,11 57,23 63,16 66,28" fill="url(#gbuGold)" stroke="#B45309" strokeWidth="1.2" />
    <Path d="M34 28 C34 28 50 31 66 28 L66 32 C66 32 50 35 34 32 Z" fill="#F59E0B" stroke="#B45309" strokeWidth="1" />
    <Circle cx="50" cy="11" r="2.8" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="0.8" />
    <Circle cx="37" cy="16" r="2.2" fill="#EF4444" stroke="#991B1B" strokeWidth="0.8" />
    <Circle cx="63" cy="16" r="2.2" fill="#EF4444" stroke="#991B1B" strokeWidth="0.8" />
    <Circle cx="42" cy="30" r="1.3" fill="#3B82F6" />
    <Circle cx="50" cy="31" r="1.5" fill="#EF4444" />
    <Circle cx="58" cy="30" r="1.3" fill="#3B82F6" />
  </Svg>
));
GbuAdminAvatar.displayName = 'GbuAdminAvatar';

// ----------------------------------------------------------------------
// AVATARS Array and Lookups
// ----------------------------------------------------------------------
export interface AvatarItem {
  id: string;
  name: string;
  school: string;
  color: string;
  bg: string;
  component: React.ComponentType<AvatarSvgProps>;
}

export const AVATARS: AvatarItem[] = [
  // SOICT (4 avatars)
  {
    id: 'tech-scholar',
    name: 'Tech Scholar',
    school: 'SOICT',
    color: '#06B6D4',
    bg: '#1E1B4B',
    component: TechScholarAvatar,
  },
  {
    id: 'cyber-guardian',
    name: 'Cyber Guardian',
    school: 'SOICT',
    color: '#22C55E',
    bg: '#022C22',
    component: CyberGuardianAvatar,
  },
  {
    id: 'ai-researcher',
    name: 'AI Researcher',
    school: 'SOICT',
    color: '#A855F7',
    bg: '#4A044E',
    component: AiResearcherAvatar,
  },
  {
    id: 'data-wizard',
    name: 'Data Wizard',
    school: 'SOICT',
    color: '#38BDF8',
    bg: '#030712',
    component: DataWizardAvatar,
  },
  // SOE (3 avatars)
  {
    id: 'engineer',
    name: 'Innovator Engineer',
    school: 'SOE',
    color: '#F97316',
    bg: '#7C2D12',
    component: EngineerAvatar,
  },
  {
    id: 'civil-architect',
    name: 'Civil Architect',
    school: 'SOE',
    color: '#0284C7',
    bg: '#075985',
    component: CivilArchitectAvatar,
  },
  {
    id: 'speed-runner',
    name: 'Campus Athlete',
    school: 'SOE',
    color: '#EF4444',
    bg: '#7F1D1D',
    component: SpeedRunnerAvatar,
  },
  // SOBT (2 avatars)
  {
    id: 'lab-scientist',
    name: 'Lab Scientist',
    school: 'SOBT',
    color: '#10B981',
    bg: '#064E3B',
    component: LabScientistAvatar,
  },
  {
    id: 'bio-innovator',
    name: 'Bio Innovator',
    school: 'SOBT',
    color: '#14B8A6',
    bg: '#022C22',
    component: BioInnovatorAvatar,
  },
  // SOM (3 avatars)
  {
    id: 'business-leader',
    name: 'Business Leader',
    school: 'SOM',
    color: '#3B82F6',
    bg: '#172554',
    component: BusinessLeaderAvatar,
  },
  {
    id: 'campus-ambassador',
    name: 'Campus Ambassador',
    school: 'SOM',
    color: '#F59E0B',
    bg: '#78350F',
    component: CampusAmbassadorAvatar,
  },
  {
    id: 'fin-analyst',
    name: 'Fin Analyst',
    school: 'SOM',
    color: '#10B981',
    bg: '#064E3B',
    component: FinAnalystAvatar,
  },
  // SOLJG (2 avatars)
  {
    id: 'legal-eagle',
    name: 'Legal Eagle',
    school: 'SOLJG',
    color: '#8B5CF6',
    bg: '#3B0764',
    component: LegalEagleAvatar,
  },
  {
    id: 'justice-advocate',
    name: 'Justice Advocate',
    school: 'SOLJG',
    color: '#E11D48',
    bg: '#4C0519',
    component: JusticeAdvocateAvatar,
  },
  // SOHSS (2 avatars)
  {
    id: 'creative-artist',
    name: 'Creative Artist',
    school: 'SOHSS',
    color: '#EC4899',
    bg: '#831843',
    component: CreativeArtistAvatar,
  },
  {
    id: 'campus-scribe',
    name: 'Campus Scribe',
    school: 'SOHSS',
    color: '#D97706',
    bg: '#451A03',
    component: CampusScribeAvatar,
  },
  // SOVSAS (2 avatars)
  {
    id: 'bookworm',
    name: 'Academic Bookworm',
    school: 'SOVSAS',
    color: '#0EA5E9',
    bg: '#0C4A6E',
    component: BookwormAvatar,
  },
  {
    id: 'quantum-physicist',
    name: 'Quantum Physicist',
    school: 'SOVSAS',
    color: '#6366F1',
    bg: '#0F172A',
    component: QuantumPhysicistAvatar,
  },
  // ADMIN (1 avatar)
  {
    id: 'gbu-admin',
    name: 'GBU Admin',
    school: 'ADMIN',
    color: '#EAB308',
    bg: '#3B0764',
    component: GbuAdminAvatar,
  },
];

export function getAvatarById(id?: string): AvatarItem {
  const fallback = AVATARS.find((a) => a.id === 'tech-scholar') || AVATARS[0];
  if (!id) return fallback;
  const found = AVATARS.find((a) => a.id === id);
  return found ?? fallback;
}

// ----------------------------------------------------------------------
// Interactive AvatarPicker Component with School Filter Tabs
// ----------------------------------------------------------------------
export const SCHOOL_TABS = [
  'All',
  'SOICT',
  'SOE',
  'SOBT',
  'SOM',
  'SOLJG',
  'SOHSS',
  'SOVSAS',
  'ADMIN',
] as const;

export type SchoolTab = (typeof SCHOOL_TABS)[number];

export interface AvatarPickerProps {
  selectedId?: string;
  onSelect: (avatarId: string) => void;
  size?: number;
  horizontal?: boolean;
  scrollable?: boolean;
  selectedSchool?: SchoolTab;
  defaultSchool?: SchoolTab;
  onSchoolChange?: (school: SchoolTab) => void;
  showSchoolTabs?: boolean;
  showTabs?: boolean;
}

// Helper hook that safely falls back when invoked outside a mounted React component tree (e.g. in headless unit tests)
function useSafeState<T>(initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const dispatcher = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher?.current;
  if (dispatcher) {
    return React.useState<T>(initialValue);
  }
  return [initialValue, () => {}];
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({
  selectedId,
  onSelect,
  size = 56,
  horizontal = false,
  scrollable = false,
  selectedSchool: selectedSchoolProp,
  defaultSchool,
  onSchoolChange,
  showSchoolTabs = true,
  showTabs,
}) => {
  const { colors } = useAppTheme();
  const effectiveDefaultSchool = defaultSchool || 'All';
  const [internalSchool, setInternalSchool] = useSafeState<SchoolTab>(effectiveDefaultSchool);

  const activeSchool =
    selectedSchoolProp !== undefined
      ? selectedSchoolProp
      : defaultSchool !== undefined
      ? defaultSchool
      : internalSchool;
  const effectiveShowTabs = showTabs !== undefined ? showTabs : showSchoolTabs;

  const handleSchoolTabPress = (tab: SchoolTab) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore
      }
    }
    setInternalSchool(tab);
    onSchoolChange?.(tab);
  };

  const handleSelect = (id: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore
      }
    }
    onSelect(id);
  };

  const squircleRadius = Math.round(size * 0.36);

  const displayedAvatars =
    activeSchool === 'All'
      ? AVATARS
      : AVATARS.filter((avatar) => avatar.school === activeSchool);

  const renderTabs = () => {
    if (!effectiveShowTabs) return null;
    return (
      <View style={styles.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContainer}
          keyboardShouldPersistTaps="handled"
          accessibilityRole="tablist"
        >
          {SCHOOL_TABS.map((tab) => {
            const isTabActive = activeSchool === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabPill,
                  {
                    backgroundColor: isTabActive ? colors.accent : colors.surfaceAlt,
                    borderColor: isTabActive ? colors.accent : colors.borderGlass,
                  },
                ]}
                onPress={() => handleSchoolTabPress(tab)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityLabel={`Filter avatars by ${tab}`}
                accessibilityState={{ selected: isTabActive }}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: isTabActive ? colors.onAccent : colors.textSecondary,
                    },
                    isTabActive && styles.tabTextActive,
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderCards = () =>
    displayedAvatars.map((avatar) => {
      const isSelected = avatar.id === (selectedId || AVATARS[0].id);
      const AvatarComponent = avatar.component;

      return (
        <TouchableOpacity
          key={avatar.id}
          style={[
            horizontal ? styles.horizontalCard : styles.avatarCard,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: isSelected ? avatar.color : colors.borderGlass,
              borderWidth: isSelected ? 2.5 : 1,
            },
          ]}
          onPress={() => handleSelect(avatar.id)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Select avatar ${avatar.name} from school ${avatar.school}`}
          accessibilityState={{ selected: isSelected }}
        >
          <View
            style={[
              styles.avatarWrapper,
              {
                width: size,
                height: size,
                borderRadius: squircleRadius,
              },
            ]}
          >
            <AvatarComponent size={size} />
            {isSelected && (
              <View
                style={[
                  styles.checkmarkBadge,
                  { backgroundColor: avatar.color },
                ]}
              >
                <Check size={12} color="#FFFFFF" strokeWidth={3} />
              </View>
            )}
          </View>

          <Text
            style={[
              styles.avatarName,
              { color: isSelected ? colors.textPrimary : colors.textSecondary },
              isSelected && styles.avatarNameSelected,
            ]}
            numberOfLines={1}
          >
            {avatar.name}
          </Text>
          <Text style={[styles.avatarSchool, { color: avatar.color }]}>
            {avatar.school}
          </Text>
        </TouchableOpacity>
      );
    });

  if (horizontal) {
    return (
      <View style={styles.pickerContainer}>
        {renderTabs()}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalContainer}
          keyboardShouldPersistTaps="handled"
        >
          {renderCards()}
        </ScrollView>
      </View>
    );
  }

  if (scrollable) {
    return (
      <View style={styles.pickerContainer}>
        {renderTabs()}
        <ScrollView
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          contentContainerStyle={styles.gridContainer}
          keyboardShouldPersistTaps="handled"
        >
          {renderCards()}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.pickerContainer}>
      {renderTabs()}
      <View style={styles.gridContainer}>{renderCards()}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  pickerContainer: {
    width: '100%',
  },
  tabBarWrapper: {
    marginBottom: 8,
  },
  tabBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 8,
  },
  tabPill: {
    minHeight: 44, // min touch target 44pt
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    fontWeight: '500',
  },
  tabTextActive: {
    fontFamily: 'Inter-Bold',
    fontWeight: '700',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 10,
  },
  horizontalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    gap: 10,
  },
  avatarCard: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 16,
    marginBottom: 4,
  },
  horizontalCard: {
    width: 90,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 16,
  },
  avatarWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  checkmarkBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
  avatarName: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  avatarNameSelected: {
    fontFamily: 'Inter-SemiBold',
    fontWeight: '700',
  },
  avatarSchool: {
    fontFamily: 'Inter-Bold',
    fontSize: 9.5,
    marginTop: 2,
    letterSpacing: 0.4,
  },
});

export default AVATARS;
