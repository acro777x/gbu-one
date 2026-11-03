import { parseRoomLocation, formatRoomLocation } from '../src/features/timetable/roomMapping';

describe('GBU Room & Building Mapping', () => {
  it('maps Low Lecture Hall (LL) to Low Building correctly', () => {
    const info = parseRoomLocation('LL101', 'SOICT');
    expect(info.building).toBe('Low Building');
    expect(info.roomType).toBe('Low Lecture Hall');
    expect(info.fullDisplay).toBe('LL101 • Low Building');
    expect(formatRoomLocation('LL101', 'SOICT')).toBe('LL101 • Low Building');
  });

  it('maps Low Practical Lab (LP) to Low Building correctly', () => {
    const info = parseRoomLocation('LP103', 'SOICT');
    expect(info.building).toBe('Low Building');
    expect(info.roomType).toBe('Low Practical Lab');
    expect(info.fullDisplay).toContain('Low Building (Low Lab)');
  });

  it('maps ICT Practical Lab (IP) to SOICT Building correctly', () => {
    const info = parseRoomLocation('IP102');
    expect(info.building).toBe('SOICT Building');
    expect(info.roomType).toBe('ICT Practical Lab');
    expect(info.fullDisplay).toContain('SOICT (ICT Lab)');
  });

  it('maps Central Lecture Theatre (CLT) to ICT New Building', () => {
    const info = parseRoomLocation('IL-103 (CLT.)');
    expect(info.building).toBe('ICT New Building');
    expect(info.roomType).toBe('Central Lecture Theatre');
    expect(info.fullDisplay).toBe('IL-103 (CLT.) • ICT New Building');
  });

  it('maps ICT Lecture Hall (IL) to SOICT Building', () => {
    const info = parseRoomLocation('IL101');
    expect(info.building).toBe('SOICT Building');
    expect(info.roomType).toBe('ICT Lecture Hall');
  });

  it('maps SOE engineering lecture & practicals', () => {
    expect(parseRoomLocation('EL101').building).toBe('SOE Building');
    expect(parseRoomLocation('EP104').building).toBe('SOE Building');
  });

  it('maps SOBT biotechnology halls & labs', () => {
    expect(parseRoomLocation('BL201').building).toBe('SOBT Building');
    expect(parseRoomLocation('BP105').building).toBe('SOBT Building');
    expect(parseRoomLocation('BTLab1').building).toBe('SOBT Building');
  });

  it('handles empty or TBD room gracefully', () => {
    expect(formatRoomLocation(undefined, 'SOICT')).toBe('Room to be announced');
    expect(formatRoomLocation('TBD', 'SOICT')).toBe('TBD • SOICT');
  });
});
