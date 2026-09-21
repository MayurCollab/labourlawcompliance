import { Fragment } from 'react';

import { splitWhatsAppBoldSegments } from '@/utils/whatsappTemplatePreview';

/**
 * Renders resolved WhatsApp preview text with real bold styling for the
 * `*like this*` segments a template's substituted variables carry — matching
 * how WhatsApp itself renders that syntax, instead of showing raw asterisks.
 */
export function WhatsAppPreviewText({ text }: { text: string }) {
  return (
    <>
      {splitWhatsAppBoldSegments(text).map((segment, index) => (
        <Fragment key={index}>
          {segment.bold ? <strong>{segment.text}</strong> : segment.text}
        </Fragment>
      ))}
    </>
  );
}
