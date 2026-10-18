import React from 'react';

/**
 * Reserved slot for the Official GBU Seal.
 * Per docs/LOGO_BRIEF.md:
 * "The official GBU seal is not part of the logo and must never be redrawn or generated.
 *  Reserve a <OfficialSeal /> slot (renders nothing until the owner supplies the official vector)."
 */
export interface OfficialSealProps {
  size?: number;
  className?: string;
}

export const OfficialSeal: React.FC<OfficialSealProps> = () => {
  // Slot intentionally reserved; renders null until official vector is provided by university.
  return null;
};

export default OfficialSeal;
