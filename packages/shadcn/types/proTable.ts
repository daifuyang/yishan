import { ReactNode } from "react";

export type ProColumns = {
    key?: string;
    dataIndex: string;
    title: string;
    valueType?: string;
    order?: number;
    placeholder?: string;
    search?: boolean | {

    };
    options?: {
        label: string;
        value: string;
    }[];
    cell?: (record: any) => ReactNode;
}
