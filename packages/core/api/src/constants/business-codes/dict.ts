export const DictErrorCode = {
  DICT_TYPE_NOT_FOUND: 32501,
  DICT_TYPE_ALREADY_EXISTS: 32502,
  DICT_TYPE_DELETE_FORBIDDEN: 32503,
  DICT_DATA_NOT_FOUND: 32511,
  DICT_DATA_ALREADY_EXISTS: 32512,
} as const;

export const DictErrorMessages = {
  [DictErrorCode.DICT_TYPE_NOT_FOUND]: "字典类型不存在",
  [DictErrorCode.DICT_TYPE_ALREADY_EXISTS]: "字典类型已存在",
  [DictErrorCode.DICT_TYPE_DELETE_FORBIDDEN]: "该字典类型下存在数据，禁止删除",
  [DictErrorCode.DICT_DATA_NOT_FOUND]: "字典数据不存在",
  [DictErrorCode.DICT_DATA_ALREADY_EXISTS]: "字典数据已存在",
} as const;

export type DictErrorCodeType = typeof DictErrorCode[keyof typeof DictErrorCode];
export type DictErrorMessageType = typeof DictErrorMessages[keyof typeof DictErrorMessages];