import { useEffect, useRef, useState } from 'react';

/** 对真实回复文本做显示节奏控制；网络结束后继续逐字显示剩余内容。 */
export function useTypewriterText(content: string, animate: boolean) {
  const [text, setText] = useState(() => (animate ? '' : content));
  const target = useRef(content);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    target.current = content;
    if (!animate) {
      clearTimeout(timer.current);
      timer.current = undefined;
      setText(content);
      return;
    }
    if (!content.startsWith(text)) {
      clearTimeout(timer.current);
      timer.current = undefined;
      setText('');
      return;
    }
    if (text === content || timer.current !== undefined) return;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      setText((current) => {
        const codePoint = target.current.codePointAt(current.length);
        return codePoint === undefined
          ? current
          : current + String.fromCodePoint(codePoint);
      });
    }, 18);
  }, [animate, content, text]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      timer.current = undefined;
    },
    [],
  );
  return {
    text: animate ? text : content,
    pending: animate && text !== content,
  };
}
