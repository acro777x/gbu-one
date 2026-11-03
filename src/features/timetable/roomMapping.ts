/**
 * GBU One — Gautam Buddha University Room & Building Mapping
 *
 * Gautam Buddha University campus room designations:
 *  - LL: Low Lecture Hall (Low Building / School of Law block)
 *  - LP: Low Practical Lab (Low Lab in Low Building)
 *  - IP: ICT Practical Lab (SOICT Lab in SOICT Building)
 *  - IL... (CLT): ICT Central Lecture Theatre -> "ICT New Building"
 *  - IL: ICT Lecture Hall (SOICT Building)
 *  - EL: Engineering Lecture Hall (SOE Building)
 *  - EP: Engineering Practical Lab (SOE Building)
 *  - BL: Biotechnology Lecture Hall (SOBT Building)
 *  - BP: Biotechnology Practical Lab (SOBT Building)
 *  - AL/AP: Applied Sciences / Architecture / SOM Building
 *  - CCC: Central Computer Centre
 *  - ONLINE: Online Lecture
 */

export interface RoomLocationInfo {
  roomCode: string;
  building: string;
  roomType: string;
  fullDisplay: string;
  shortDisplay: string;
}

export function parseRoomLocation(room?: string | null, fallbackSchool?: string): RoomLocationInfo {
  const cleanRoom = (room || '').trim();
  if (!cleanRoom || cleanRoom.toUpperCase() === 'TBD' || cleanRoom.toUpperCase() === 'ROOM TBD') {
    return {
      roomCode: cleanRoom || 'TBD',
      building: fallbackSchool || 'To be announced',
      roomType: 'Classroom',
      fullDisplay: cleanRoom ? `${cleanRoom} • ${fallbackSchool || 'Room TBD'}` : 'Room to be announced',
      shortDisplay: cleanRoom || 'TBD',
    };
  }

  const upper = cleanRoom.toUpperCase();

  // 1. Central Lecture Theatre / ICT New Building (CLT)
  if (upper.includes('CLT') || upper.includes('CENTRAL LECTURE')) {
    return {
      roomCode: cleanRoom,
      building: 'ICT New Building',
      roomType: 'Central Lecture Theatre',
      fullDisplay: `${cleanRoom} • ICT New Building`,
      shortDisplay: cleanRoom,
    };
  }

  // 2. Low Building: Low Lecture Hall (LL) e.g. LL101, LL102
  if (/^LL\s*\d+/i.test(upper)) {
    return {
      roomCode: cleanRoom,
      building: 'Low Building',
      roomType: 'Low Lecture Hall',
      fullDisplay: `${cleanRoom} • Low Building`,
      shortDisplay: cleanRoom,
    };
  }

  // 3. Low Building: Low Practical Lab (LP) e.g. LP101, LP103
  if (/^LP\s*\d+/i.test(upper)) {
    return {
      roomCode: cleanRoom,
      building: 'Low Building',
      roomType: 'Low Practical Lab',
      fullDisplay: `${cleanRoom} • Low Building (Low Lab)`,
      shortDisplay: cleanRoom,
    };
  }

  // 4. SOICT Building: ICT Practical Lab (IP) e.g. IP101, IP102
  if (/^IP\s*\d+/i.test(upper)) {
    return {
      roomCode: cleanRoom,
      building: 'SOICT Building',
      roomType: 'ICT Practical Lab',
      fullDisplay: `${cleanRoom} • SOICT (ICT Lab)`,
      shortDisplay: cleanRoom,
    };
  }

  // 5. SOICT Building: ICT Lecture Hall (IL) e.g. IL101, IL201
  if (/^IL\s*\d+/i.test(upper)) {
    return {
      roomCode: cleanRoom,
      building: 'SOICT Building',
      roomType: 'ICT Lecture Hall',
      fullDisplay: `${cleanRoom} • SOICT Building`,
      shortDisplay: cleanRoom,
    };
  }

  // 6. SOE Building: Engineering Lecture (EL) & Engineering Practical (EP)
  if (/^EL\s*\d+/i.test(upper)) {
    return {
      roomCode: cleanRoom,
      building: 'SOE Building',
      roomType: 'Engineering Lecture Hall',
      fullDisplay: `${cleanRoom} • SOE Building`,
      shortDisplay: cleanRoom,
    };
  }
  if (/^EP\s*\d+/i.test(upper)) {
    return {
      roomCode: cleanRoom,
      building: 'SOE Building',
      roomType: 'Engineering Practical Lab',
      fullDisplay: `${cleanRoom} • SOE Lab`,
      shortDisplay: cleanRoom,
    };
  }

  // 7. SOBT Building: Biotech Lecture (BL) & Biotech Practical (BP)
  if (/^BL\s*\d+/i.test(upper)) {
    return {
      roomCode: cleanRoom,
      building: 'SOBT Building',
      roomType: 'Biotech Lecture Hall',
      fullDisplay: `${cleanRoom} • SOBT Building`,
      shortDisplay: cleanRoom,
    };
  }
  if (/^BP\s*\d+/i.test(upper) || upper.startsWith('BTLAB')) {
    return {
      roomCode: cleanRoom,
      building: 'SOBT Building',
      roomType: 'Biotech Practical Lab',
      fullDisplay: `${cleanRoom} • SOBT Lab`,
      shortDisplay: cleanRoom,
    };
  }

  // 8. SOM / Architecture / Humanities (AL, AP)
  if (/^AL\s*\d+/i.test(upper)) {
    return {
      roomCode: cleanRoom,
      building: 'SOM / Humanities Building',
      roomType: 'Lecture Hall',
      fullDisplay: `${cleanRoom} • SOM / Humanities`,
      shortDisplay: cleanRoom,
    };
  }
  if (/^AP\s*\d+/i.test(upper)) {
    return {
      roomCode: cleanRoom,
      building: 'SOM / Architecture Building',
      roomType: 'Practical Lab / Studio',
      fullDisplay: `${cleanRoom} • SOM / Studio`,
      shortDisplay: cleanRoom,
    };
  }

  // 9. Central Computer Centre (CCC)
  if (upper.startsWith('CCC') || upper.startsWith('COMP')) {
    return {
      roomCode: cleanRoom,
      building: 'Central Computer Centre',
      roomType: 'Computing Centre',
      fullDisplay: `${cleanRoom} • Central Computer Centre`,
      shortDisplay: cleanRoom,
    };
  }

  // 10. Online Lecture
  if (upper.startsWith('ONLINE')) {
    return {
      roomCode: cleanRoom,
      building: 'Virtual Classroom',
      roomType: 'Online Lecture',
      fullDisplay: `${cleanRoom} • Online`,
      shortDisplay: cleanRoom,
    };
  }

  // Fallback: Use university school or generic room
  const building = fallbackSchool ? `${fallbackSchool} Building` : 'Campus Building';
  return {
    roomCode: cleanRoom,
    building,
    roomType: 'Lecture Room',
    fullDisplay: fallbackSchool ? `${cleanRoom} • ${fallbackSchool}` : cleanRoom,
    shortDisplay: cleanRoom,
  };
}

/** Formats a room string cleanly for card headers and details */
export function formatRoomLocation(room?: string | null, fallbackSchool?: string): string {
  return parseRoomLocation(room, fallbackSchool).fullDisplay;
}
