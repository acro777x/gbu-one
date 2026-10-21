/**
 * GBU One — Document route.
 *
 * `/pdf?url=<encoded>&title=<encoded>` hosts the in-app viewer. The screen
 * lives in `src/components/pdf/PdfViewerScreen.tsx` so it can be reused by
 * any other place that has a document to show.
 */
import React from 'react';
import PdfViewerScreen from '../src/components/pdf/PdfViewerScreen';

export default function PdfRoute() {
  return <PdfViewerScreen />;
}
