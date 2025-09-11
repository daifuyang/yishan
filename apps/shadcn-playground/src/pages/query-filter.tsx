import { useState } from "react";
import { QueryFilter, type ColumnConfig, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@zerocmf/yishan-shadcn';

export default function QueryFilterPage() {
  const [lastQuery, setLastQuery] = useState<Record<string, any>>({});

  const searchColumns: ColumnConfig[] = [
    {
      key: "username",
      label: "用户名",
      type: "input",
      placeholder: "请输入用户名",
      required: true,
    },
    {
      key: "email",
      label: "邮箱",
      type: "email",
      placeholder: "请输入邮箱地址",
      required: true,
      pattern: {
        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
        message: "请输入有效的邮箱地址",
      },
    },
    {
      key: "phone",
      label: "手机号",
      type: "tel",
      placeholder: "请输入手机号",
      required: true,
      pattern: {
        value: /^1[3-9]\d{9}$/,
        message: "请输入有效的手机号",
      },
    },
    {
      key: "status",
      label: "状态",
      type: "select",
      placeholder: "选择状态",
      options: [
        { label: "全部状态", value: "all" },
        { label: "启用", value: "active" },
        { label: "禁用", value: "inactive" },
        { label: "待审核", value: "pending" },
      ],
    },
    {
      key: "role",
      label: "角色",
      type: "select",
      placeholder: "选择用户角色",
      options: [
        { label: "管理员", value: "admin" },
        { label: "普通用户", value: "user" },
        { label: "VIP用户", value: "vip" },
      ],
    },
    {
      key: "birthday",
      label: "生日",
      type: "date",
      placeholder: "请选择生日",
    },
    {
      key: "appointmentTime",
      label: "预约时间",
      type: "dateTime",
      placeholder: "请选择预约时间",
    },
    {
      key: "meetingTime",
      label: "会议时间",
      type: "time",
      placeholder: "请选择会议时间",
    },
    {
      key: "activityPeriod",
      label: "活动周期",
      type: "dateRange",
      placeholder: "请选择活动周期",
    },
    {
      key: "eventPeriod",
      label: "事件周期",
      type: "dateTimeRange",
      placeholder: "请选择事件周期",
    },
    {
      key: "search",
      label: "搜索关键词",
      type: "input",
      placeholder: "请输入关键词搜索",
    },
    {
      key: "priceRange",
      label: "价格区间",
      type: "input",
      placeholder: "请输入价格",
    },
  ];

  const handleQuery = (values: Record<string, any>) => {
    setLastQuery(values);
    console.log("查询参数:", values);
  };

  const handleReset = () => {
    setLastQuery({});
    console.log("重置查询");
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">QueryFilter 组件演示</h1>
        <p className="text-muted-foreground">
          展示 QueryFilter
          筛选组件的完整功能，包括多种输入类型、验证规则、数据收集等
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>筛选表单</CardTitle>
              <CardDescription>
                使用下面的筛选条件来测试 QueryFilter 组件的各种功能
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QueryFilter
                columns={searchColumns}
                onSubmit={handleQuery}
                onReset={handleReset}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>查询结果</CardTitle>
              <CardDescription>显示最新的查询参数</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(lastQuery).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">查询参数:</p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(lastQuery, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无查询参数</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>支持的输入类型</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1">
                <li>• 文本输入 (input)</li>
                <li>• 邮箱输入 (email)</li>
                <li>• 电话输入 (tel)</li>
                <li>• 下拉选择 (select)</li>
                <li>• 日期选择 (date)</li>
                <li>• 日期时间 (dateTime)</li>
                <li>• 时间选择 (time)</li>
                <li>• 日期范围 (dateRange)</li>
                <li>• 日期时间范围 (dateTimeRange)</li>
                <li>• 数字范围 (numberRange)</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
