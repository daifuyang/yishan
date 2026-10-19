import { CreateDeptFieldsSchema } from '../schemas/department.js'
import type { UserCreateForm } from './user-creation-form.service.js'

/** Native department form metadata, derived from the same contract as the create endpoint. */
export class DepartmentCreationFormService {
  static getCreateForm(): UserCreateForm {
    const labels: Record<string, string> = { name: '部门名称', parentId: '上级部门', status: '状态', sort_order: '排序', description: '备注', leaderId: '负责人' }
    const required: readonly string[] = CreateDeptFieldsSchema.required ?? []
    const fields = Object.entries(CreateDeptFieldsSchema.properties).map(([name, schema]) => ({
      name, label: labels[name] ?? name, required: required.includes(name), sensitive: false,
      selector: name === 'parentId' ? 'deptTree' : name === 'leaderId' ? 'userOptions' : 'text',
      constraints: Object.fromEntries(['type', 'minLength', 'maxLength', 'enum', 'format', 'pattern', 'minimum', 'maximum'].filter(key => schema[key] !== undefined).map(key => [key, schema[key]])),
    }))
    return { schemaVersion: 1, editableFields: Object.keys(CreateDeptFieldsSchema.properties), fields, defaults: {}, missingFields: [] }
  }
}
