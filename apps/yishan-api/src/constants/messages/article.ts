export const ArticleMessageKeys = {
  LIST_SUCCESS: 'LIST_SUCCESS',
  DETAIL_SUCCESS: 'DETAIL_SUCCESS',
  CREATE_SUCCESS: 'CREATE_SUCCESS',
  UPDATE_SUCCESS: 'UPDATE_SUCCESS',
  DELETE_SUCCESS: 'DELETE_SUCCESS',
  PUBLISH_SUCCESS: 'PUBLISH_SUCCESS',
  CATEGORY_LIST_SUCCESS: 'CATEGORY_LIST_SUCCESS',
  CATEGORY_DETAIL_SUCCESS: 'CATEGORY_DETAIL_SUCCESS',
  CATEGORY_CREATE_SUCCESS: 'CATEGORY_CREATE_SUCCESS',
  CATEGORY_UPDATE_SUCCESS: 'CATEGORY_UPDATE_SUCCESS',
  CATEGORY_DELETE_SUCCESS: 'CATEGORY_DELETE_SUCCESS',
} as const;

export type ArticleMessageKey = typeof ArticleMessageKeys[keyof typeof ArticleMessageKeys];

const ARTICLE_MESSAGES = {
  'zh-CN': {
    LIST_SUCCESS: '获取文章列表成功',
    DETAIL_SUCCESS: '获取文章详情成功',
    CREATE_SUCCESS: '创建文章成功',
    UPDATE_SUCCESS: '更新文章成功',
    DELETE_SUCCESS: '删除文章成功',
    PUBLISH_SUCCESS: '文章发布成功',
    CATEGORY_LIST_SUCCESS: '获取分类列表成功',
    CATEGORY_DETAIL_SUCCESS: '获取分类详情成功',
    CATEGORY_CREATE_SUCCESS: '创建分类成功',
    CATEGORY_UPDATE_SUCCESS: '更新分类成功',
    CATEGORY_DELETE_SUCCESS: '删除分类成功',
  },
  'en-US': {
    LIST_SUCCESS: 'Fetched article list successfully',
    DETAIL_SUCCESS: 'Fetched article detail successfully',
    CREATE_SUCCESS: 'Article created successfully',
    UPDATE_SUCCESS: 'Article updated successfully',
    DELETE_SUCCESS: 'Article deleted successfully',
    PUBLISH_SUCCESS: 'Article published successfully',
    CATEGORY_LIST_SUCCESS: 'Fetched category list successfully',
    CATEGORY_DETAIL_SUCCESS: 'Fetched category detail successfully',
    CATEGORY_CREATE_SUCCESS: 'Category created successfully',
    CATEGORY_UPDATE_SUCCESS: 'Category updated successfully',
    CATEGORY_DELETE_SUCCESS: 'Category deleted successfully',
  },
} as const;

function resolveLocale(acceptLanguage?: string): keyof typeof ARTICLE_MESSAGES {
  if (!acceptLanguage) return 'zh-CN';
  const lang = acceptLanguage.split(',')[0].trim().toLowerCase();
  if (lang.startsWith('zh')) return 'zh-CN';
  if (lang.startsWith('en')) return 'en-US';
  return 'zh-CN';
}

export function getArticleMessage(key: ArticleMessageKey, acceptLanguage?: string): string {
  const locale = resolveLocale(acceptLanguage);
  const bundle = ARTICLE_MESSAGES[locale];
  return bundle[key] || ARTICLE_MESSAGES['zh-CN'][key];
}

