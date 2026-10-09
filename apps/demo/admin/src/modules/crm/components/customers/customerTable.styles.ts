import { createStyles } from 'antd-style';

/** Scoped to this list; preserve header, filters, pagination and density control. */
export const useCustomerTableStyles = createStyles(() => ({
  table: {
    '& .ant-table-tbody > .crm-customer-row > .ant-table-cell': {
      paddingBlock: 7,
      verticalAlign: 'middle',
      whiteSpace: 'nowrap',
    },
    '& .ant-table-small .ant-table-tbody > .crm-customer-row > .ant-table-cell':
      {
        paddingBlock: 5,
      },
    '& .ant-table-large .ant-table-tbody > .crm-customer-row > .ant-table-cell':
      {
        paddingBlock: 9,
      },
    '& .crm-customer-row > .ant-table-cell .ant-tag': {
      fontSize: 12,
      height: 22,
      lineHeight: '20px',
      paddingInline: 6,
      borderRadius: 4,
    },
  },
}));
