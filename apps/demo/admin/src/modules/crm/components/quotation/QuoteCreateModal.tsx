import React, { useState } from 'react';
import QuoteFormModal from './QuoteFormModal';
import QuoteDetailModal from './QuoteDetailModal';
type QuoteFormProps = React.ComponentProps<typeof QuoteFormModal>;

export default function QuoteCreateModal(props: QuoteFormProps) {
  const [detailId, setDetailId] = useState<number | null>(null);
  return (
    <>
      <QuoteFormModal
        {...props}
        onSaved={(id) => {
          setDetailId(id);
          props.onSaved?.(id);
        }}
      />
      <QuoteDetailModal
        quotationId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={props.onChanged}
      />
    </>
  );
}
