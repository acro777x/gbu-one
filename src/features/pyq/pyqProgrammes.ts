/**
 * GBU One — Comprehensive Programmes and Courses mapping per School
 * Covers SOICT, SOE, SOBT, SOM, SOLJG, SOHSS, SOVSAS, SOUS
 */

export interface ProgrammeDescriptor {
  code: string;
  label: string;
}

export const PROGRAMMES_BY_SCHOOL: Record<string, ProgrammeDescriptor[]> = {
  SOICT: [
    { code: 'BCS', label: 'B.Tech CSE' },
    { code: 'BAI', label: 'B.Tech AI' },
    { code: 'BDA', label: 'Data Analytics' },
    { code: 'BCY', label: 'Cyber Sec' },
    { code: 'BCA', label: 'BCA' },
    { code: 'MCA', label: 'MCA' },
    { code: 'MTECH', label: 'M.Tech' },
  ],
  SOE: [
    { code: 'ECE', label: 'ECE' },
    { code: 'ME', label: 'Mechanical' },
    { code: 'CE', label: 'Civil' },
    { code: 'EE', label: 'Electrical' },
    { code: 'MTECH', label: 'M.Tech' },
  ],
  SOBT: [
    { code: 'BT', label: 'B.Tech Biotech' },
    { code: 'MBT', label: 'M.Sc Biotech' },
    { code: 'IBT', label: 'Integrated Biotech' },
  ],
  SOM: [
    { code: 'MBA', label: 'MBA' },
    { code: 'BBA', label: 'BBA' },
    { code: 'BCOM', label: 'B.Com' },
    { code: 'IMBA', label: 'Integrated MBA' },
  ],
  SOLJG: [
    { code: 'LAW', label: 'BA/BBA LLB' },
    { code: 'LLM', label: 'LLM' },
  ],
  SOL: [
    { code: 'LAW', label: 'BA/BBA LLB' },
    { code: 'LLM', label: 'LLM' },
  ],
  SOHSS: [
    { code: 'BA', label: 'BA' },
    { code: 'MA', label: 'MA' },
    { code: 'JMC', label: 'Journalism' },
    { code: 'PSY', label: 'Applied Psychology' },
    { code: 'MSW', label: 'MSW' },
  ],
  SOVSAS: [
    { code: 'BSC', label: 'B.Sc' },
    { code: 'MSC', label: 'M.Sc' },
  ],
  SOUS: [
    { code: 'BARCH', label: 'B.Arch' },
    { code: 'MPLAN', label: 'M.Plan' },
  ],
};
