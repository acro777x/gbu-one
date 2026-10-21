import React from 'react';
import { SheetOverlay } from './SheetOverlay';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  height?: number | string;
}

/**
 * The app's bottom sheet.
 *
 * The sheet is drawn inside the screen rather than in a native modal window,
 * because a React Native `Modal` has no touchable region on Android in this
 * app. See `src/components/ui/SheetOverlay.tsx`.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  height,
}) => {
  const numericHeight = typeof height === 'number' ? height : undefined;

  return (
    <SheetOverlay
      visible={visible}
      onClose={onClose}
      title={title}
      height={numericHeight}
    >
      {children}
    </SheetOverlay>
  );
};

export default BottomSheet;
