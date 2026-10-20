import {
  aiAnswerDraftQuestion,
  aiDraftQuestions,
} from '@/services/generated/ai';

export type DraftQuestion = Awaited<
  ReturnType<typeof aiDraftQuestions>
>['data']['questions'][number];
export type DraftQuestionAnswer = Parameters<typeof aiAnswerDraftQuestion>[1];

const options = { skipErrorHandler: true } as const;

export async function listDraftQuestions(
  draftId: string,
  conversationId: string,
) {
  const result = await aiDraftQuestions({ draftId, conversationId }, options);
  if (!result?.success)
    throw new Error(result?.message || '读取问题失败，请重试');
  return result.data;
}

export async function answerDraftQuestion(
  draftId: string,
  answer: DraftQuestionAnswer,
) {
  const result = await aiAnswerDraftQuestion({ draftId }, answer, options);
  if (!result?.success)
    throw new Error(result?.message || '保存选择失败，请重试');
  return result.data;
}
