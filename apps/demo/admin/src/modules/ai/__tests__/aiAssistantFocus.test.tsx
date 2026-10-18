import { render, screen } from '@testing-library/react';
import {
  registerAssistantRegion,
  useCoordinatedFormFocus,
} from '@yishan/core-system-admin/form-assistance';
import React from 'react';

function FocusHarness({ enabled = true }: { enabled?: boolean }) {
  const assistant = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => registerAssistantRegion(() => assistant.current), []);
  useCoordinatedFormFocus(enabled);
  return (
    <>
      <input aria-label="原生表单" />
      <div ref={assistant}>
        <input aria-label="助手输入" />
      </div>
      <input aria-label="其他区域" />
    </>
  );
}

it('lets the assistant keep focus while the participating native form still traps other regions', () => {
  const { rerender } = render(<FocusHarness />);
  const form = screen.getByLabelText('原生表单');
  const assistant = screen.getByLabelText('助手输入');
  const trap = (event: FocusEvent) => {
    if (event.target !== form) form.focus();
  };
  window.addEventListener('focusin', trap);
  try {
    assistant.focus();
    expect(document.activeElement).toBe(assistant);
    screen.getByLabelText('其他区域').focus();
    expect(document.activeElement).toBe(form);
    rerender(<FocusHarness enabled={false} />);
    assistant.focus();
    expect(document.activeElement).toBe(form);
  } finally {
    window.removeEventListener('focusin', trap);
  }
});
