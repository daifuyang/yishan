export type LeadAssignmentDialogMode = 'transfer' | 'assign';

export function getLeadAssignmentDialogCopy(mode: LeadAssignmentDialogMode) {
  return mode === 'assign'
    ? {
        title: '分配线索',
        submitText: '确认分配',
        targetLabel: '分配给',
        targetPlaceholder: '请选择负责人',
        requiredMessage: '请选择负责人',
        successMessage: '线索已分配',
      }
    : {
        title: '转移线索',
        submitText: '确认转移',
        targetLabel: '转移给',
        targetPlaceholder: '请选择新负责人',
        requiredMessage: '请选择新负责人',
        successMessage: '线索已转移',
      };
}
