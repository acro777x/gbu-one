import React from 'react';
import { SheetOverlay } from './SheetOverlay';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  height?: number | string;
  /**
   * The ACTION the close control performs, in the student's words:
   * "Close" for an ordinary sheet, "Dismiss alarm" for the class alarm.
   */
  closeLabel?: string;
  /** Whether a tap on the backdrop closes the sheet. Default: true. */
  dismissOnBackdropPress?: boolean;
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
  closeLabel,
  dismissOnBackdropPress,
}) => {
  const numericHeight = typeof height === 'number' ? height : undefined;

  return (
    <SheetOverlay
      visible={visible}
      onClose={onClose}
      title={title}
      height={numericHeight}
      closeLabel={closeLabel}
      dismissOnBackdropPress={dismissOnBackdropPress}
    >
      {children}
    </SheetOverlay>
  );
};

export default BottomSheet;
