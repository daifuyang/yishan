/** Extract only the user-facing server message, never request credentials or payloads. */
export function chatError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = error.response as
      | { data?: { message?: string }; status?: number }
      | undefined;
    if (response?.data?.message) return response.data.message;
    if (response?.status === 401) return '登录已过期，请重新登录';
  }
  if (error instanceof Error) {
    try {
      const body: unknown = JSON.parse(error.message);
      if (
        typeof body === 'object' &&
        body &&
        'message' in body &&
        typeof body.message === 'string'
      )
        return body.message;
    } catch {
      // Streaming failures can also be plain text.
    }
    return error.message || '请求失败，请重试';
  }
  return '请求失败，请重试';
}
