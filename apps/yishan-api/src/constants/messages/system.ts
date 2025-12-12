export const SystemMessageKeys = {
  SYSTEM_OPTION_GET_SUCCESS: 'SYSTEM_OPTION_GET_SUCCESS',
  SYSTEM_OPTION_SET_SUCCESS: 'SYSTEM_OPTION_SET_SUCCESS',
} as const;

export const getSystemMessage = (key: keyof typeof SystemMessageKeys, lang?: string) => {
  const dict: Record<string, Record<string, string>> = {
    'zh-CN': {
      SYSTEM_OPTION_GET_SUCCESS: '获取系统参数成功',
      SYSTEM_OPTION_SET_SUCCESS: '设置系统参数成功',
    },
    'en-US': {
      SYSTEM_OPTION_GET_SUCCESS: 'Fetched system option successfully',
      SYSTEM_OPTION_SET_SUCCESS: 'Updated system option successfully',
    },
  };
  const l = ['zh-CN', 'en-US'].includes(lang || '') ? (lang as string) : 'zh-CN';
  return dict[l][key];
};

