import { and, asc, count, desc, eq, gte, lte, like, or, isNull } from 'drizzle-orm'
import { drizzleDb, type AppQueryDb } from '@yishan/core-system-api/database'
import { crmCustomer, crmCustomerStatus, crmCustomerRemark, crmDispatch, crmDispatchReply } from '../db/schema.js'
import { sysUser } from '@yishan/core-system-api/schema'
import { todayYmd, formatBusinessNumber } from './_number-id.js'

const active=(t:any)=>isNull(t.deletedAt); const page=(q:any,p:any)=>p.pageSize===0?q:q.limit(p.pageSize).offset((p.page-1)*p.pageSize)
export class CustomersRepository {
 static async list(q:any,db:AppQueryDb=drizzleDb){const c:any[]=[active(crmCustomer)];if(q.creatorUserId)c.push(eq(crmCustomer.creatorId,q.creatorUserId));if(q.statusId)c.push(eq(crmCustomer.statusId,Number(q.statusId)));if(q.startTime)c.push(gte(crmCustomer.createdAt,new Date(q.startTime)));if(q.endTime)c.push(lte(crmCustomer.createdAt,new Date(q.endTime)));if(q.keyword)c.push(or(like(crmCustomer.mobile,`%${q.keyword}%`),like(crmCustomer.name,`%${q.keyword}%`),like(crmCustomer.numberId,`%${q.keyword}%`))!);const where=and(...c);const [items,totals]=await Promise.all([page(db.select().from(crmCustomer).where(where).orderBy(desc(crmCustomer.createdAt)),q),db.select({total:count()}).from(crmCustomer).where(where)]);return {list:items,total:Number(totals[0]?.total??0)}}
 static async findById(id:number,includeDispatches=false){const [r]=await drizzleDb.select().from(crmCustomer).where(and(eq(crmCustomer.id,id),active(crmCustomer))).limit(1);if(!r)return null;const [status]=await drizzleDb.select().from(crmCustomerStatus).where(eq(crmCustomerStatus.id,r.statusId)).limit(1);const [owner]=await drizzleDb.select({id:sysUser.id,username:sysUser.username,realName:sysUser.realName}).from(sysUser).where(eq(sysUser.id,r.ownerUserId)).limit(1);const dispatches=includeDispatches?await drizzleDb.select().from(crmDispatch).where(eq(crmDispatch.customerId,id)).orderBy(desc(crmDispatch.createdAt)):undefined;return {...r,status:status??null,owner:owner??null,...(includeDispatches?{dispatches}: {})}}
 static async create(input:any,db:AppQueryDb=drizzleDb){const r=await db.insert(crmCustomer).values(input);return this.findById(Number(r[0].insertId))}
 static async update(id:number,input:any,db:AppQueryDb=drizzleDb){await db.update(crmCustomer).set(input).where(eq(crmCustomer.id,id));return this.findById(id)}
 // 客户编号生成（CUS + YYYYMMDD + 6 位 base36 随机，无分隔符）：
 // - 业务约定：历史 12059 行 VIP/CUS 老数据不动。
 // - 17 字符，daily unique 靠 UNIQUE 索引 + service 层 1062 重试兜底。
 // - 6 位 base36 单日 1000 条生日冲突 ~0.023%，重试 5 次后实际概率 < 10^-10。
 // 纯函数同步返回——没有 SQL 不需要 async。
 static nextNumber(): string {
   return formatBusinessNumber(todayYmd())
 }
 static addRemark(customerId:number,userId:number,content:string){return drizzleDb.insert(crmCustomerRemark).values({customerId,userId,content})}
 static async ensureDefaultStatuses(db:AppQueryDb=drizzleDb){for(const [id,name] of [[1,'资料录入'],[2,'待跟进'],[3,'重单'],[4,'已手术'],[5,'无效用户']] as const)await db.insert(crmCustomerStatus).values({id,name,sortOrder:id,status:1}).onDuplicateKeyUpdate({set:{name,sortOrder:id,status:1}})}
 static listStatuses(){return drizzleDb.select().from(crmCustomerStatus).where(eq(crmCustomerStatus.status,1)).orderBy(asc(crmCustomerStatus.sortOrder))}
 static async dispatchCustomer(customerId:number,hospitalIds:number[],statusId:number,actorId:number,replyContent:string){const ids=await drizzleDb.transaction(async tx=>{const ids:number[]=[];for(const hospitalId of hospitalIds){const r=await tx.insert(crmDispatch).values({customerId,hospitalId,statusId,finishedAt:new Date(),creatorId:actorId,updaterId:actorId});const dispatchId=Number(r[0].insertId);ids.push(dispatchId); // 派单留言（默认 "此客户是贵医院潜在客户，请跟进"）也要写入 crm_dispatch_reply，
   // 否则派单详情面板会显示"暂无对话"——历史上是 bug，replyContent 静默被丢。
   if (replyContent && replyContent.trim()) {
     await tx.insert(crmDispatchReply).values({dispatchId,userId:actorId,content:replyContent.trim()})
   }
 }await tx.update(crmCustomer).set({statusId:2,updaterId:actorId}).where(eq(crmCustomer.id,customerId));return ids});return Promise.all(ids.map(id=>this.findById(id)))}
}
