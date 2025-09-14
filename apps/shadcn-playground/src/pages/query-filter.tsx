import { useState } from "react";
import { QueryFilter, Card, CardContent, CardDescription, CardHeader, CardTitle, ProColumns } from '@zerocmf/yishan-shadcn';

export default function QueryFilterPage() {
  const [lastQuery, setLastQuery] = useState<Record<string, any>>({});

  const searchColumns: ProColumns[] = [
    {
      dataIndex: "username",
      title: "用户名",
      valueType: "input",
      placeholder: "请输入用户名",
    },
    {
      dataIndex: "email",
      title: "邮箱",
      valueType: "email",
      placeholder: "请输入邮箱地址",
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
