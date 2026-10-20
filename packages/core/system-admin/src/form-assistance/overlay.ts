/** Compatibility exports; shared overlay coordination lives in Core Admin. */
export {
  isEventInsideAssistant, notifyUserFormOverlay, peekAssistantRegion, peekUserFormOverlay,
  registerAssistantEscape, registerAssistantRegion, registerUserFormOverlay, runAssistantEscape,
  subscribeUserFormOverlay, useCoordinatedFormFocus, type UserFormOverlayInfo,
} from '@yishan/core-admin/form-assistance';
