import { PageContainer, type ActionType, type ProColumns, ProTable } from "@ant-design/pro-components";
import React, { useRef } from "react";
import { getLoginLogList } from "@/services/generated/sysLoginLogs";
import { Tag } from "antd";

const statusEnum = {
  "0": { text: "失败", status: "Error" },
  "1": { text: "成功", status: "Success" },
} as const;

const LoginLogList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);

  const columns: ProColumns<API.sysLoginLog>[] = [
    { title: "ID", dataIndex: "id", search: false, width: 80 },
    { title: "账号", dataIndex: "username", width: 140 },
    { title: "姓名", dataIndex: "realName", search: false, width: 140 },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      valueEnum: statusEnum as any,
      render: (_, record) => (
        <Tag color={record.status === "1" ? "green" : "red"}>
          {record.status === "1" ? "成功" : "失败"}
        </Tag>
      ),
    },
    { title: "提示信息", dataIndex: "message", search: false, ellipsis: true, width: 220 },
    { title: "IP", dataIndex: "ipAddress", search: false, width: 150 },
    { title: "User-Agent", dataIndex: "userAgent", search: false, ellipsis: true, width: 260 },
    { title: "创建时间", dataIndex: "createdAt", search: false, valueType: "dateTime", width: 180 },
  ];

  return (
    <PageContainer>
      <ProTable<API.sysLoginLog>
        headerTitle="登录日志"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 120 }}
        request={async (params) => {
          const { current, pageSize, ...restParams } = params as any;
          const result = await getLoginLogList({
            page: current,
            pageSize,
            ...restParams,
          });
          return {
            data: result.data || [],
            success: result.success,
            total: result.pagination?.total || 0,
          };
        }}
        columns={columns}
        scroll={{ x: 1300 }}
      />
    </PageContainer>
  );
};

export default LoginLogList;
