# Yishan CRM 客户管理模块产品文档

> 产品定位：面向中小企业的通用客户关系管理能力
> 所属产品：Yishan 企业应用底座
> 模块名称：CRM / 客户管理
> 文档版本：V1.0
> 当前目标：建设一套可复用、可扩展、适合 AI 编码和客户定制的企业级 CRM 基础模块

---

# 1. 产品概述

## 1.1 背景

中小企业在客户管理场景中普遍存在以下问题：

* 客户信息分散在 Excel、微信、个人笔记中。
* 客户资源掌握在个人销售手里，企业难以统一管理。
* 客户跟进缺乏连续记录。
* 销售离职后客户信息容易丢失。
* 不知道哪些客户长期没有跟进。
* 无法快速判断客户当前状态。
* 客户、联系人、跟进记录混在一起。
* CRM 产品往往过于复杂，员工学习成本较高。
* 不同行业存在大量定制字段，标准 CRM 很难完全覆盖。

Yishan CRM 不试图复制大型 CRM 的全部能力。

核心原则：

> **用 30% 的复杂度覆盖中小企业 70%～80% 的客户管理需求。**

---

# 2. 产品定位

Yishan CRM 不是独立孤立的 CRM SaaS，而是：

```text
Yishan Enterprise Platform
        │
        ├── CRM
        ├── Project
        ├── OA
        ├── HRM
        ├── CMS
        └── Custom Business
```

其中 Yishan Core 提供：

```text
Tenant
Organization
Department
User
Role / Permission
DataScope
Dictionary
Tag
CustomField
SavedView
Attachment
AuditLog
Notification
Task / Job
Event
AI Runtime
```

CRM 只负责客户领域业务：

```text
Customer
Contact
FollowUp
CustomerPool
Opportunity
Contract
Order
Payment
```

这样避免 CRM 自己重复实现权限、组织、附件、日志等基础能力。

---

# 3. 产品目标

## 3.1 V1 核心目标

第一版本重点解决六个问题：

```text
客户是谁？
    ↓
谁负责？
    ↓
和谁联系？
    ↓
之前沟通过什么？
    ↓
下一步什么时候联系？
    ↓
这个客户目前是什么状态？
```

只要这六个问题能够快速回答，CRM 就已经能够产生实际业务价值。

---

# 4. 产品设计原则

## 4.1 简单优先

避免传统 CRM 大量菜单、标签页和状态。

默认只展示最重要的信息。

复杂能力按需展开。

---

## 4.2 业务对象优先

左侧菜单只表达业务对象：

```text
客户
联系人
跟进记录
销售机会
合同订单
数据分析
```

不把：

```text
重点客户
成交客户
今日客户
我的客户
公海客户
```

全部做成左侧菜单。

这些应该属于：

> 数据视图。

---

## 4.3 固定业务模型 + 可扩展字段

稳定字段直接进入数据库：

```text
name
owner
lifecycle
source
industry
...
```

行业定制字段进入：

```text
customData JSONB
```

例如医疗行业：

```text
医院等级
床位数量
医院性质
重点科室
年采购额
```

不需要修改 CRM 核心领域模型。

---

## 4.4 不做通用低代码业务 DSL

Yishan CRM 采用：

> 通用底座 + 标准 CRM 插件 + 定制业务代码

而不是：

> 一切业务全部配置化。

查询、字段、视图、表单允许配置。

核心业务流程仍然使用正常 TypeScript 业务代码实现。

---

# 5. 产品信息架构

最终导航建议：

```text
CRM
│
├── 客户
│
├── 联系人
│
├── 跟进记录
│
├── 销售机会            V2
│
├── 合同订单            V2
│
└── 数据分析            V2
```

V1 实际导航：

```text
CRM
│
├── 客户
├── 联系人
└── 跟进记录
```

做到非常克制。

---

# 6. CRM 核心领域模型

```text
                         Customer
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
       Contact           FollowUp         CustomerMember
          │
          │
          ├──────────────────────────────────┐
          │                                  │
     Opportunity V2                     Task / Reminder
          │
       Contract
          │
        Order
          │
       Payment
```

核心关系：

```text
Customer 1 —— N Contact

Customer 1 —— N FollowUp

Customer N —— N User
           CustomerMember

Customer 1 —— N Opportunity
```

---

# 7. 客户 Customer

## 7.1 定义

客户代表企业正在接触、服务或曾经发生过业务关系的：

* 企业；
* 机构；
* 个人。

支持两种类型：

```text
企业客户
个人客户
```

---

# 8. 客户生命周期

建议 V1 只设计四种。

```text
潜在客户
合作客户
沉睡客户
流失客户
```

对应：

```text
PROSPECT
ACTIVE
DORMANT
LOST
```

生命周期回答的问题是：

> 企业和这个客户目前是什么关系？

而不是：

> 这笔订单谈到哪个阶段？

销售阶段应该放到 Opportunity 中。

---

# 9. 客户等级

默认：

```text
A级
B级
C级
```

含义可以由企业自行定义。

例如：

```text
A

高价值 / 重点客户

B

普通目标客户

C

低优先级客户
```

第一版避免设计：

```text
重要
非常重要
五星客户
战略客户
...
```

造成重复概念。

---

# 10. 客户来源

默认内置：

```text
手动录入
官网
广告推广
活动
转介绍
渠道合作
销售开发
其他
```

来源由 Yishan Dictionary 管理。

企业管理员可以自行增加：

```text
抖音
小红书
微信公众号
猪八戒
展会
老客户介绍
```

CRM 本身不写死。

---

# 11. 客户标签

例如：

```text
重点客户
上海
医疗
高意向
老客户
政府客户
```

使用 Yishan 通用 Tag 能力。

允许：

```text
一个客户多个标签
```

标签主要用于：

* 搜索；
* 筛选；
* 分组；
* Saved View；
* AI 分析。

---

# 12. 客户负责人

每个客户原则上有一个主要负责人：

```text
ownerUserId
```

负责人承担：

* 主跟进责任；
* 客户维护；
* 跟进提醒；
* 公海规则责任。

---

# 13. 客户协同人

除了负责人之外，一个客户可以有多个协同成员。

例如：

```text
客户：上海 A 科技

负责人：
张三

协同：
李四
王五
```

数据模型：

```text
CustomerMember

customerId
userId
role
```

role：

```text
OWNER
COLLABORATOR
```

未来可以增加：

```text
VIEWER
EDITOR
```

---

# 14. 客户列表页

这是 CRM 使用频率最高的页面。

页面结构：

```text
客户
统一管理企业和个人客户

                      [导入] [导出] [+ 新建客户]

全部客户 | 我的客户 | 协同客户 | 待跟进 | 7天未跟进 | 公海
--------------------------------------------------------

[ 搜索客户名称、电话、联系人 ]

[负责人] [生命周期] [客户类型] [来源] [更多筛选]

--------------------------------------------------------

□ 客户名称
  联系人
  生命周期
  客户等级
  最近跟进
  下次跟进
  负责人
  更新时间
```

---

# 15. 默认列表字段

建议默认控制在 8 个左右：

| 字段    | 说明       |
| ----- | -------- |
| 客户名称  | 主信息      |
| 主要联系人 | 当前主要联系人  |
| 生命周期  | 潜在 / 合作等 |
| 客户等级  | A/B/C    |
| 最近跟进  | 判断活跃度    |
| 下次跟进  | 驱动行动     |
| 负责人   | 数据归属     |
| 更新时间  | 最近变化     |

用户可以通过：

> 设置列

增加：

* 来源；
* 行业；
* 电话；
* 地址；
* 标签；
* 创建时间；
* 自定义字段。

---

# 16. 客户搜索

统一搜索框支持：

```text
客户名称
联系人名称
手机号
电话号码
邮箱
```

例如输入：

```text
13800138000
```

直接搜索对应：

```text
客户
联系人
```

这对于 CRM 实际使用非常重要。

---

# 17. 快捷视图

客户列表顶部默认提供：

```text
全部客户

我的客户

协同客户

待跟进

7天未跟进

公海
```

其中：

### 我的客户

```text
ownerUserId = currentUser
```

### 协同客户

当前用户存在：

```text
CustomerMember
```

### 待跟进

```text
nextFollowUpAt <= today
```

### 7 天未跟进

```text
lastFollowUpAt < today - 7 days
```

---

# 18. Saved View

除了系统视图，用户可以保存自己的视图。

例如：

```text
上海医疗客户

条件：

行业 = 医疗
地区 = 上海
负责人 = 我
客户等级 = A
```

保存后显示：

```text
全部客户
我的客户
7天未跟进
上海医疗客户
```

Saved View 建议直接抽象为 Yishan Core 通用能力。

---

# 19. 高级筛选

不要像传统 CRM 一样默认展示十几个查询框。

默认：

```text
负责人
生命周期
客户类型
来源
```

点击：

```text
更多筛选
```

打开 Drawer：

```text
客户等级

行业

标签

创建时间

更新时间

最近跟进时间

下次跟进时间

协同人

所属部门

自定义字段
```

支持组合筛选。

---

# 20. 新建客户

点击：

```text
+ 新建客户
```

打开 Drawer 或独立页面。

推荐第一阶段使用 Drawer。

基本字段：

```text
客户名称 *

客户类型 *

主要联系人

联系人手机

客户来源

行业

客户等级

负责人

标签

地址

备注
```

高级字段放到：

```text
更多信息
```

避免创建客户时出现几十个输入框。

---

# 21. 客户去重

创建客户时进行基础查重。

检查：

```text
客户名称

手机号

联系人手机号

企业统一社会信用代码 V2
```

例如发现：

> 「上海某某科技有限公司」已经存在。

提示：

```text
发现可能重复客户

上海某某科技有限公司
负责人：张三
最近跟进：2026-08-25

[查看客户] [仍然创建]
```

是否允许继续创建由权限决定。

---

# 22. 客户详情页

推荐布局：

```text
上海某某科技有限公司

潜在客户 · A级 · 软件行业

负责人：张三
最近跟进：今天

                     [新增跟进] [编辑] [更多]

------------------------------------------------

概览 | 联系人 | 跟进记录 | 商机 | 合同 | 动态
```

V1：

```text
概览
联系人
跟进记录
动态
```

V2 增加：

```text
商机
合同
订单
```

---

# 23. 客户概览

概览页主要展示三个区域。

## 基础资料

```text
客户名称

客户类型

行业

客户来源

客户等级

地址

标签

负责人

协同人
```

---

## 联系人

显示前三个联系人：

```text
王总
CEO
138xxxxxx

李经理
采购经理
139xxxxxx
```

支持：

```text
查看全部

+ 新增联系人
```

---

## 最近跟进

例如：

```text
今天 14:30

张三 · 电话

客户计划 10 月启动项目，
重点关注数据安全和私有部署。

下次跟进：
10 月 3 日
```

---

# 24. 客户行动区域

客户详情页应该明显展示：

```text
下一步
```

例如：

```text
下次跟进

9 月 8 日
14:00

负责人
张三

[立即跟进]
```

CRM 的目标不是记录历史。

而是：

> 驱动下一次行动。

---

# 25. 联系人 Contact

联系人属于客户。

例如：

```text
客户
上海某某科技有限公司

├─ 王总       CEO
├─ 李经理     采购经理
└─ 陈工       技术负责人
```

---

# 26. 联系人数据

推荐字段：

```text
姓名 *

所属客户 *

职位

部门

手机

电话

邮箱

微信

性别

是否主要联系人

备注
```

---

# 27. 主要联系人

每个客户允许指定：

```text
Primary Contact
```

列表页默认显示主要联系人。

同时支持多个普通联系人。

---

# 28. 联系人列表

页面：

```text
联系人

                          [+ 新建联系人]

搜索联系人 / 手机 / 客户

-----------------------------------------------------

联系人      客户            职位       手机       负责人

王强        上海A科技        CEO        138xxx     张三
李伟        江苏B医疗        采购经理   139xxx     李四
```

这里负责人实际上继承客户负责人。

---

# 29. 跟进记录 FollowUp

跟进记录是 CRM V1 最重要的数据之一。

跟进类型：

```text
电话

微信

拜访

会议

邮件

其他
```

---

# 30. 新增跟进

点击：

```text
新增跟进
```

弹出：

```text
跟进方式
[电话 ▼]

跟进时间
2026-09-03 14:00

联系人
王总

跟进内容
----------------------------------
今天与王总电话沟通……

下一步计划
----------------------------------

下次跟进时间
2026-09-10 10:00

附件
+
```

保存。

---

# 31. 跟进后的自动行为

保存 FollowUp 后自动：

```text
Customer.lastFollowUpAt
=
FollowUp.followUpAt
```

如果设置：

```text
nextFollowUpAt
```

同步：

```text
Customer.nextFollowUpAt
```

从而自动出现在：

```text
待跟进客户
```

视图里。

---

# 32. 跟进记录时间线

客户详情页使用 Timeline：

```text
09-03

电话 · 张三

和王总沟通项目预算，
客户预计 10 月启动。

联系人：王总
下次跟进：09-10


08-28

微信 · 张三

发送产品介绍和案例。


08-20

拜访 · 李四

首次拜访客户。
```

---

# 33. 跟进记录独立页面

同时提供：

```text
CRM
 └ 跟进记录
```

用于管理人员查看团队活动。

支持筛选：

```text
跟进人

客户

跟进方式

时间

部门
```

---

# 34. 公海机制

公海用于企业统一管理无人维护客户。

客户状态：

```text
普通客户

↓

释放

↓

公海客户

↓

领取

↓

普通客户
```

---

# 35. V1 公海能力

第一版只实现：

```text
释放客户

领取客户

查看公海

领取历史
```

不做复杂自动规则。

---

# 36. 释放客户

拥有权限的用户可以：

```text
更多
→ 释放到公海
```

需要填写：

```text
释放原因
```

例如：

```text
长期无需求

无法联系

暂时无项目

其他
```

释放后：

```text
ownerUserId = NULL
```

同时记录 Audit Log。

---

# 37. 领取客户

员工进入：

```text
公海
```

点击：

```text
领取
```

领取后：

```text
ownerUserId = currentUser
```

记录：

```text
领取时间
领取人
来源
```

---

# 38. V2 公海规则

后续增加自动回收：

```text
30 天无有效跟进
        ↓
7 天前通知负责人
        ↓
仍未跟进
        ↓
自动进入公海
```

企业管理员可以配置：

```text
回收天数

每日最大领取数量

保护客户

成交客户是否进入公海

新客户保护期
```

但 V1 不建议开发规则引擎。

---

# 39. 客户转移

管理员或拥有权限人员支持：

```text
客户转移
```

例如：

```text
张三
 ↓
李四
```

可以：

```text
单个转移

批量转移
```

典型场景：

> 销售离职。

---

# 40. 批量操作

客户列表选择多项后：

```text
批量修改负责人

批量添加标签

批量修改等级

批量进入公海

批量删除
```

危险操作需要二次确认。

---

# 41. Excel 导入

第一版必须支持。

流程：

```text
下载模板
    ↓
填写数据
    ↓
上传 Excel
    ↓
字段映射
    ↓
数据校验
    ↓
预览
    ↓
导入
```

允许映射：

```text
Excel字段

↓

CRM字段
```

例如：

```text
公司名字
→
客户名称
```

---

# 42. 导入校验

检查：

```text
必填字段

手机号格式

日期格式

负责人是否存在

字典值是否合法

重复客户
```

导入结束展示：

```text
共 500 条

成功 476

失败 24

[下载失败数据]
```

---

# 43. Excel 导出

导出尊重：

```text
当前筛选条件

当前数据权限

导出权限
```

不能因为导出绕过 DataScope。

例如员工只能看自己的客户：

> 导出也只能导出自己的客户。

---

# 44. 删除与回收站

客户采用软删除：

```text
deletedAt
```

删除后进入：

```text
回收站
```

管理员可以：

```text
恢复

永久删除
```

普通销售原则上不能永久删除。

---

# 45. 动态 Activity

客户详情提供完整业务动态：

```text
09-03 张三新增跟进

09-02 李四编辑客户等级
B → A

08-30 张三新增联系人 王总

08-28 系统将负责人
李四 → 张三

08-20 张三创建客户
```

Activity 可以来自 Audit/Event。

---

# 46. 数据权限

CRM 必须依赖 Yishan DataScope。

支持：

```text
仅本人

本人及协同客户

本部门

本部门及下属部门

全部客户
```

---

# 47. 功能权限

建议权限编码：

```text
crm.customer.read

crm.customer.create

crm.customer.update

crm.customer.delete

crm.customer.export

crm.customer.import

crm.customer.transfer

crm.customer.release

crm.customer.claim


crm.contact.read

crm.contact.create

crm.contact.update

crm.contact.delete


crm.followup.read

crm.followup.create

crm.followup.update

crm.followup.delete
```

---

# 48. CRM 角色示例

### 销售

```text
查看自己客户

编辑自己客户

新增客户

新增联系人

新增跟进

领取公海客户
```

---

### 销售经理

增加：

```text
查看本部门客户

客户转移

查看团队跟进

释放客户
```

---

### 管理员

拥有：

```text
所有客户

导入

导出

永久删除

CRM 配置
```

---

# 49. 自定义字段

这是通用 SaaS 必须做好的能力。

例如标准 Customer：

```text
客户名称
行业
负责人
来源
```

医疗行业客户增加：

```text
医院等级

床位数量

医院性质

重点科室
```

制造行业：

```text
年产值

工厂规模

设备数量
```

字段定义由：

```text
Yishan CustomField
```

统一提供。

---

# 50. 自定义字段类型

V1 支持：

```text
文本

多行文本

数字

金额

日期

日期时间

单选

多选

布尔

用户

部门
```

已经基本足够。

---

# 51. CRM 设置中心

菜单：

```text
CRM 设置

├── 客户生命周期
├── 客户等级
├── 客户来源
├── 行业
├── 跟进方式
├── 自定义字段
└── 公海设置 V2
```

其中大量配置应直接基于：

```text
Yishan Dictionary
```

实现。

---

# 52. 通知与提醒

V1 支持：

```text
下次跟进提醒
```

例如：

```text
今天 09:00

你今天有 6 个客户需要跟进。
```

进入：

```text
待跟进客户
```

---

# 53. Task / Job

CRM 不自己实现定时任务系统。

依赖：

```text
Yishan Task / Job
```

例如：

```text
每天 08:00

查找：
nextFollowUpAt = today

↓

发送通知
```

以后公海自动回收也复用该机制。

---

# 54. Event

建议 CRM 从 V1 就定义标准领域事件。

例如：

```text
crm.customer.created

crm.customer.updated

crm.customer.deleted

crm.customer.owner_changed

crm.customer.claimed

crm.customer.released

crm.contact.created

crm.followup.created
```

---

# 55. 事件价值

未来：

```text
crm.followup.created
        ↓
AI 更新客户摘要
```

或者：

```text
crm.customer.created
        ↓
Webhook
        ↓
同步企业微信
```

再比如：

```text
crm.customer.became_active
        ↓
创建项目
```

因此 Event 是 Yishan 非常重要的通用基础设施。

---

# 56. AI CRM

AI 不作为单独 Chat 页面存在。

而应该嵌入真实业务流程。

---

# 57. AI 客户摘要

客户详情：

```text
AI 客户摘要

上海 A 科技当前处于需求确认阶段。

客户主要关注：
• 私有化部署
• 数据权限
• ERP 集成

决策人：
王总

预计预算：
15～20 万

主要风险：
预算尚未审批

建议下一步：
9 月 10 日确认预算审批进展
```

输入数据：

```text
Customer
Contact
FollowUp
Opportunity V2
Contract V2
```

---

# 58. AI 跟进助手

输入：

```text
今天和王总聊了下，
他们预算大概20万，
10月份准备启动，
担心私有化安全问题，
下周联系。
```

AI 输出：

```text
跟进内容：

与王总沟通项目计划。
客户预计10月份启动项目，
预算约20万元，
目前重点关注私有化部署及数据安全。

下一步：
准备私有化部署方案。

建议跟进：
2026-09-10
```

用户确认后才能保存。

---

# 59. AI 信息提取

用户粘贴：

```text
上海XX医疗有限公司，
联系人王经理，
电话138xxxx，
三级医院，
大概1200张床……
```

AI 自动识别：

```text
客户名称

联系人

电话

行业

医院等级

床位数量
```

再由用户确认。

这会很好地验证 Yishan AI Runtime。

---

# 60. AI 自然语言查询

以后允许：

```text
找出我的 A 类客户里面
一个月没有跟进的客户。
```

AI 转换成 CRM Query。

但必须：

> 先经过权限系统。

AI 不能绕过 DataScope。

最终效果：

```text
AI
 ↓
Intent / Query
 ↓
CRM Service
 ↓
Permission + DataScope
 ↓
Database
```

不能：

```text
AI
 ↓
直接 SQL
```

---

# 61. 数据模型建议

核心 Customer：

```text
crm_customer

id
tenant_id

name
type

lifecycle
level
source
industry

phone
email
address

owner_user_id
owner_dept_id

last_follow_up_at
next_follow_up_at

description

custom_data JSONB

created_by
updated_by

created_at
updated_at
deleted_at
```

---

# 62. Contact

```text
crm_contact

id
tenant_id
customer_id

name
gender

position
department

mobile
phone
email
wechat

is_primary

remark

created_by

created_at
updated_at
deleted_at
```

---

# 63. FollowUp

```text
crm_followup

id
tenant_id

customer_id
contact_id

user_id

type
content

follow_up_at
next_follow_up_at

created_at
updated_at
deleted_at
```

---

# 64. CustomerMember

```text
crm_customer_member

id
tenant_id

customer_id
user_id

role

created_at
```

---

# 65. CustomerPoolHistory

```text
crm_customer_pool_history

id
tenant_id

customer_id

action

from_user_id
to_user_id

reason

operator_id

created_at
```

action：

```text
RELEASE

CLAIM

TRANSFER

AUTO_RELEASE
```

---

# 66. API 设计原则

坚持 REST + 明确业务接口。

客户 CRUD：

```http
GET    /api/crm/customers

POST   /api/crm/customers

GET    /api/crm/customers/:id

PATCH  /api/crm/customers/:id

DELETE /api/crm/customers/:id
```

---

# 67. 客户业务接口

```http
POST /api/crm/customers/:id/transfer

POST /api/crm/customers/:id/release

POST /api/crm/customers/:id/claim
```

---

# 68. 联系人

```http
GET  /api/crm/customers/:customerId/contacts

POST /api/crm/customers/:customerId/contacts

GET  /api/crm/contacts/:id

PATCH /api/crm/contacts/:id

DELETE /api/crm/contacts/:id
```

---

# 69. 跟进

```http
GET /api/crm/customers/:customerId/followups

POST /api/crm/customers/:customerId/followups

PATCH /api/crm/followups/:id

DELETE /api/crm/followups/:id
```

---

# 70. 查询设计

例如：

```http
GET /api/crm/customers
```

参数：

```text
keyword

ownerId

lifecycle

level

source

industry

tagIds

lastFollowUpFrom

lastFollowUpTo

nextFollowUpFrom

nextFollowUpTo

page

pageSize

sort
```

不设计：

```text
万能 DSL endpoint
```

---

# 71. 前端目录建议

基于 Yishan：

```text
modules/
└── crm/
    ├── customers/
    ├── contacts/
    ├── followups/
    ├── components/
    ├── hooks/
    ├── services/
    ├── schemas/
    └── types/
```

页面：

```text
/crm/customers

/crm/customers/:id

/crm/contacts

/crm/followups
```

---

# 72. 后端领域结构

建议：

```text
modules/crm/

├── customer/
│   ├── customer.route.ts
│   ├── customer.schema.ts
│   ├── customer.service.ts
│   ├── customer.repository.ts
│   └── customer.policy.ts
│
├── contact/
│
├── followup/
│
├── pool/
│
└── shared/
```

依然保持：

```text
Route
 ↓
Service
 ↓
Repository
 ↓
Drizzle
```

不要因为 AI 编码而牺牲传统工程结构。

---

# 73. 页面设计规范

整体继续遵循 Yishan / Ant Design Pro 风格。

关键原则：

```text
企业级

简洁

克制

高信息效率

低学习成本
```

避免：
* 一页几十个筛选框；
* 左侧大量二级三级菜单；
* 多余卡片；
* 大面积渐变；
* 营销型视觉；
* 每个模块独立设计不同交互。

---

# 74. 客户列表最终推荐布局

```text
┌──────────────────────────────────────────────────────────┐
│ 客户                                                     │
│ 管理客户资料、负责人和跟进过程                           │
│                               导入  导出  + 新建客户     │
├──────────────────────────────────────────────────────────┤
│ 全部客户  我的客户  协同客户  待跟进  7天未跟进  公海   │
├──────────────────────────────────────────────────────────┤
│ 🔍 搜索客户 / 联系人 / 电话                             │
│                                                          │
│ 负责人 ▼   生命周期 ▼   类型 ▼   来源 ▼   更多筛选     │
├──────────────────────────────────────────────────────────┤
│ □ 客户名称   联系人   生命周期   最近跟进   下次跟进     │
│                                                          │
│   上海A科技   王总     潜在客户    今天       明天         │
│                                                          │
│   江苏B医疗   李经理   合作客户    3天前      -            │
│                                                          │
│   杭州C网络   陈总     潜在客户    8天前      今天         │
└──────────────────────────────────────────────────────────┘
```

---

# 75. 首页 Dashboard V2

CRM 后续可以增加简单工作台：

```text
今日待跟进
12

7天未跟进
8

本月新增客户
46

本月成交
6
```

下面：

```text
我的待办客户

最近跟进

销售漏斗
```

不要第一版做十几张图。

---

# 76. V1 产品范围

建议正式锁定：

| 模块         |    V1 |
| ---------- | ----: |
| 客户 CRUD    |     ✅ |
| 企业 / 个人客户  |     ✅ |
| 联系人        |     ✅ |
| 跟进记录       |     ✅ |
| 负责人        |     ✅ |
| 协同人        |     ✅ |
| 客户等级       |     ✅ |
| 生命周期       |     ✅ |
| 来源         |     ✅ |
| 标签         |     ✅ |
| 行业         |     ✅ |
| 自定义字段      |     ✅ |
| Saved View |     ✅ |
| 搜索         |     ✅ |
| 高级筛选       |     ✅ |
| Excel 导入   |     ✅ |
| Excel 导出   |     ✅ |
| 数据权限       |     ✅ |
| 操作日志       |     ✅ |
| 公海         | ✅ 基础版 |
| 回收站        |     ✅ |
| 跟进提醒       |     ✅ |
| AI 客户摘要    |  ⭐ 建议 |
| AI 跟进整理    |  ⭐ 建议 |
| 商机         |  ❌ V2 |
| 合同         |  ❌ V2 |
| 订单         |  ❌ V2 |
| 回款         |  ❌ V2 |
| BI         |  ❌ V2 |
| 自动化规则      |  ❌ V2 |

---

# 77. V2 产品范围

V2 将 CRM 从：

> 客户管理

升级成：

> 销售 CRM。

完整链路：

```text
Lead
 ↓
Customer
 ↓
Opportunity
 ↓
Contract
 ↓
Order
 ↓
Payment
```

增加：

```text
线索

销售机会

销售阶段

销售漏斗

预计成交金额

预计成交日期

合同

订单

回款

销售目标

团队数据分析
```

---

# 78. V3：CRM Automation

增加：

```text
Trigger
Condition
Action
```

例如：

```text
客户创建
        ↓
来源 = 官网
        ↓
自动分配给销售
```

---

另外：

```text
7天无跟进
      ↓
发送提醒
```

或者：

```text
30天无跟进
      ↓
进入公海
```

---

# 79. V4：Agent CRM

这时候再真正进入你未来重点发展的 Enterprise AI Platform / Agent Infrastructure。

例如：

```text
AI 每天检查所有待跟进客户

↓

识别高价值客户

↓

结合历史沟通生成跟进建议

↓

创建销售任务

↓

等待销售确认
```

甚至：

```text
客户调研 Agent

↓

搜索公开资料

↓

企业背景

↓

融资情况

↓

官网

↓

产品

↓

行业

↓

竞争情况

↓

写入 CRM Research
```

这里就开始真正需要：

```text
AI Runtime
Worker
LangGraph
Task
Event
Permission
Audit
Multi-tenant Isolation
```

这会非常契合 Yishan 后续的发展方向。

---

# 80. Yishan 与 CRM 的边界

这一条建议作为整个项目最重要的架构原则。

## Yishan Core

负责：

```text
组织

用户

部门

权限

租户

数据权限

字典

标签

附件

评论

自定义字段

Saved View

导入导出

审计日志

消息通知

任务系统

Event

Webhook

AI Runtime
```

---

## CRM Plugin

负责：

```text
客户

联系人

跟进

客户归属

协同

公海

销售机会

合同

订单
```

---

## Customer Business

负责客户特殊业务：

```text
医疗行业

医院

科室

医生

设备

经销商
```

或者：

```text
教育行业

学校

校区

课程

学生
```

形成：

```text
Yishan
   +
CRM
   +
Industry Business
```

---

# 81. 产品验收标准

CRM V1 真正达到 MVP 标准，需要至少能够完整走通下面这个故事：

```text
管理员创建：
销售部门

↓

创建销售：
张三

↓

张三新建：

上海某某科技有限公司

↓

添加联系人：
王总

↓

记录第一次电话：

客户有 CRM 需求，
预计10月份启动。

↓

设置：

9月10日再次联系

↓

9月10日：

客户自动进入
「待跟进」

↓

张三进入 CRM：

看到今天应该联系该客户

↓

完成第二次跟进

↓

经理能够查看：

客户资料
联系人
所有跟进历史

↓

张三离职

↓

经理批量把客户转移给李四

↓

所有客户和历史记录完整保留
```

如果这条业务链能够非常顺畅地跑通：

> CRM V1 就合格了。

---

# 82. 最终产品定位

我建议 Yishan CRM 最终不要宣传成：

> 「又一个 CRM。」

而应该定位成：

> **Yishan 企业应用体系中的标准客户关系能力。**

它既能够直接作为：

```text
中小企业 CRM
```

使用；

也可以作为：

```text
医疗客户系统
教育客户系统
渠道管理系统
招商系统
会员顾客系统
售前系统
```

的业务基础。

最终形成非常清晰的一套开发模型：

```text
                   Yishan Core
                       │
       ┌───────────────┼───────────────┐
       │               │               │
      CRM            Project          OA
       │
       ├─ Customer
       ├─ Contact
       ├─ FollowUp
       └─ Opportunity
              │
              ▼
        Industry Business
              │
       ┌──────┼─────────┐
       │      │         │
    医疗CRM  教育CRM   渠道CRM
```

这个方向比把 Yishan 做成一个「低代码 CRM 搭建器」更适合你目前的架构路线。

**第一阶段真正值得打磨的不是商机、合同、BI 等外围功能，而是 `Customer + Contact + FollowUp + DataScope + CustomField + SavedView + Audit + Import/Export`。**

这八块一旦做扎实，CRM 不但能用，**Yishan 的企业级底座也基本完成了一次真正的业务验证。**

---

# 附 A. 代码现状 vs 愿景差异表（2026-09-03 all 分支快照）

> 写文档时不动代码。下表用于追溯每条产品愿景在代码中的落地情况，方便后续排期。
> 表头：**愿景条目** / **代码现状** / **差距**。

### A.1 数据模型差异

| 愿景条目 | 代码现状 | 差距 |
| --- | --- | --- |
| `tenant_id` 多租户字段 | 8 张表全部缺失 | Yishan Core 当前为单租户模型；暂未引入 tenant 隔离 |
| `lifecycle`（PROSPECT/ACTIVE/DORMANT/LOST） | 用 `crm_customer_status`（待跟进/初步沟通/需求确认/方案报价/已成交/已流失）替代 | 二者语义有重叠；现状是销售阶段 + 成交状态混合，缺独立的"客户生命周期"。后续建议合并 |
| `custom_data JSONB` 自定义字段 | 不存在 | Core CustomField 平台未落地；当前业务字段全部硬编码 |
| `crm_customer_member` 协同人表 | 不存在 | 协同人能力缺失 |
| `crm_followup` 表 | 名为 `crm_activity`，字段基本一致（无 `tenant_id`、无 `wechat` 字段；`follow_up_at` → `occurred_at`，`next_follow_up_at` 已存在） | 重命名 / 迁移需要 drizzle 重生成 |
| `crm_customer_pool_history` | 已存在为 `crm_customer_transfer`，字段对齐（缺 `reason` 详尽归类、`AUTO_RELEASE` action） | 字段命名 / action 枚举对齐即可 |

### B.2 功能能力差异

| 愿景条目 | 代码现状 | 差距 |
| --- | --- | --- |
| Excel 导入 / 导出 | 未实现 | 依赖 Core 导入导出抽象 |
| 回收站（恢复 / 永久删除） | 仅软删（`deleted_at`），无恢复 / 永久删除接口 | 需新增路由 |
| 客户协同人视图（"协同客户"） | 未实现 | 待 `crm_customer_member` 表 |
| Saved View | 未实现 | 依赖 Core 通用能力 |
| 高级筛选 Drawer | 当前 ProTable 默认筛选项（负责人 / 类型 / 来源 / 状态 / 客户等级） | 与愿景基本一致；"协同人 / 自定义字段"缺 |
| 7天未跟进视图 | 未实现 | 工作台/列表需补充 |
| 批量操作（改负责人 / 加标签 / 进公海 / 删除） | 未实现 | 后续迭代 |
| 跟进提醒（每日推送待跟进客户） | 未实现 | 依赖 Core Task / Job + Notification |
| 公海自动回收（30 天规则） | 未实现 | 写在 V2 / V3 |
| 客户转移时同步 owner_dept_id | 当前留空 | TODO；待 Core 提供 UserService.getUserById().deptIds[0] |
| AI 客户摘要 / 跟进助手 / 信息提取 / 自然语言查询 | 未实现 | 依赖 AI Runtime；属于 V4 Agent CRM |
| 领域事件（crm.customer.created / .claimed / .released …） | 未实现 | Core Event 平台落地后再接入 |
| 字段权限码（`crm.customer.read / create / ...`） | 当前是 `crm:customer:list / detail / create / update / delete / claim / release / transfer / ...`，namespace 风格 + 列表/详情分离 | 与愿景风格不同：建议统一为 `crm.customer.<action>` 形式 |
| 软删恢复 / 永久删除 路由 | 无 | 待新增 |

### C. UI / 信息架构差异

| 愿景条目 | 代码现状 | 差距 |
| --- | --- | --- |
| 左侧菜单按业务对象：客户 / 联系人 / 跟进记录 | 当前：`工作台 / 我的客户 / 客户详情 / 公海 / 联系人 / 跟进记录 / CRM 设置` | 多了"工作台"，把"客户详情"暴露为菜单；按愿景应隐藏详情路由 |
| "我的客户 / 协同客户 / 待跟进 / 7天未跟进 / 公海" 快捷视图 | 仅有"我的客户 / 公海 / 待跟进"（待跟进在 dashboard 上） | 缺"协同客户 / 7天未跟进" |
| 客户列表页：8 个默认字段 + 自定义列 | 当前是 ProTable 默认字段（客户名称 / 类型 / 负责人 / 来源 / 状态 / 等级 / 创建时间 / 操作列） | 缺"主要联系人 / 最近跟进 / 下次跟进"作为核心列；"操作列"位置不变 |
| 客户详情 4 个 Tab：概览 / 联系人 / 跟进记录 / 动态 | 当前是"最近跟进 + 客户信息 + 联系人 + 跟进 + 流转"分块布局，无 Tab | 需重构为 Tab；"动态"待 Activity 平台 |
| 客户详情明显展示"下一步"行动区 | 未单独展示 | 待新增 |
| 工作台 V2（漏斗） | 当前是 6 个计数器 + 待跟进 + 最近动态 | 与愿景 V1 一致；V2 漏斗留待 |

### D. 文档 / 范围对齐建议

- **建议把"字段权限码"统一为 `crm.<entity>.<action>` 命名**（与 47 节对齐；代码 namespace 风格继续保留属于另一条路线，二选一即可）。
- **V1 范围表（76 节）当前所有项打 ✅**：建议区分"代码现状 = ✅ / 设计中 = 🚧 / 未实现 = ❌"三档状态，避免与上面差异表出现对不上的情况。
- **本表与代码同步节奏**：每次 CRM 模块改动后，把"代码现状"列重新对账一次；新增愿景条目时同步加行。

---

# 附 B. 现有模块文档索引

- 模块内 README（产品视角，539 行）：`apps/yishan-api/src/modules/crm/README.md`
- 模块 schema 定义：`apps/yishan-api/src/modules/crm/db/schema.ts`
- 模块 seed：`apps/yishan-api/src/modules/crm/seed.ts`
- 模块菜单 JSON：`apps/yishan-api/src/modules/crm/config/system-menu.json`
- 前端页面：`apps/yishan-admin/src/modules/crm/pages/*`
- Yishan 通用模块开发指南：`apps/yishan-api/docs/module-onboarding.md`
- Yishan 仓库根 CLAUDE.md：模块系统 / 数据范围 / OpenAPI 同步约定