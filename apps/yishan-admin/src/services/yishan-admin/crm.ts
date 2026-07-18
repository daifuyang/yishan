import { request } from '@umijs/max';

const base = '/api/modules/crm/v1/admin';

export async function getHospitals(params?: any) {
  return request(`${base}/hospitals/`, { method: 'GET', params });
}

export async function getHospital(id: number) {
  return request(`${base}/hospitals/${id}`, { method: 'GET' });
}

export async function createHospital(data: any) {
  return request(`${base}/hospitals/`, { method: 'POST', data });
}

export async function updateHospital(id: number, data: any) {
  return request(`${base}/hospitals/${id}`, { method: 'PUT', data });
}

export async function deleteHospital(id: number) {
  return request(`${base}/hospitals/${id}`, { method: 'DELETE' });
}

export async function searchHospitals(params?: any) {
  return request(`${base}/hospitals/search/options`, { method: 'GET', params });
}

export async function getHospitalAccounts(hospitalId: number) {
  return request(`${base}/hospitals/${hospitalId}/accounts`, { method: 'GET' });
}

export async function createHospitalAccount(hospitalId: number, data: any) {
  return request(`${base}/hospitals/${hospitalId}/accounts`, { method: 'POST', data });
}

export async function assignHospitalAccount(hospitalId: number, data: any) {
  return request(`${base}/hospitals/${hospitalId}/accounts/assign`, { method: 'POST', data });
}

export async function updateHospitalAccount(hospitalId: number, userId: number, data: any) {
  return request(`${base}/hospitals/${hospitalId}/accounts/${userId}`, { method: 'PUT', data });
}

export async function deleteHospitalAccount(hospitalId: number, userId: number) {
  return request(`${base}/hospitals/${hospitalId}/accounts/${userId}`, { method: 'DELETE' });
}

export async function getCustomerStatuses() {
  return request(`${base}/customers/statuses`, { method: 'GET' });
}

export async function getCustomers(params?: any) {
  return request(`${base}/customers/`, { method: 'GET', params });
}

export async function createCustomer(data: any) {
  return request(`${base}/customers/`, { method: 'POST', data });
}

export async function updateCustomer(id: number, data: any) {
  return request(`${base}/customers/${id}`, { method: 'PUT', data });
}

export async function dispatchCustomer(id: number, data: any) {
  return request(`${base}/customers/${id}/dispatch`, { method: 'POST', data });
}

export async function getMembers(params?: any) {
  return request(`${base}/members/`, { method: 'GET', params });
}

export async function getMember(id: number) {
  return request(`${base}/members/${id}`, { method: 'GET' });
}

export async function createMember(data: any) {
  return request(`${base}/members/`, { method: 'POST', data });
}

export async function updateMember(id: number, data: any) {
  return request(`${base}/members/${id}`, { method: 'PUT', data });
}

export async function addMemberRemark(id: number, data: any) {
  return request(`${base}/members/${id}/remarks`, { method: 'POST', data });
}

export async function getDispatchStatuses() {
  return request(`${base}/dispatches/statuses`, { method: 'GET' });
}

export async function getDispatches(params?: any) {
  return request(`${base}/dispatches/`, { method: 'GET', params });
}

export async function getDispatch(id: number) {
  return request(`${base}/dispatches/${id}`, { method: 'GET' });
}

export async function updateDispatch(id: number, data: any) {
  return request(`${base}/dispatches/${id}`, { method: 'PUT', data });
}

export async function addDispatchReply(id: number, data: any) {
  return request(`${base}/dispatches/${id}/replies`, { method: 'POST', data });
}

export async function addDispatchLog(id: number, data: any) {
  return request(`${base}/dispatches/${id}/logs`, { method: 'POST', data });
}

