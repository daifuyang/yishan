export interface UserFormInput { username: string; phone: string; email: string; password: string; birthDate: string }

export function validateUserForm(values: UserFormInput, editing: boolean): Partial<Record<keyof UserFormInput, string>> {
  const errors: Partial<Record<keyof UserFormInput, string>> = {}
  if (values.username.length > 50) errors.username = '用户名不能超过 50 字'
  if (!values.phone.trim() || values.phone.length > 20) errors.phone = '请输入 1–20 字的联系电话'
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = '邮箱格式不正确'
  if ((!editing || values.password) && !/^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,50}$/.test(values.password)) errors.password = '密码需为 6–50 位，包含字母和数字'
  if (values.birthDate) {
    const date = new Date(`${values.birthDate}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.birthDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== values.birthDate) errors.birthDate = '请选择有效出生日期'
  }
  return errors
}
