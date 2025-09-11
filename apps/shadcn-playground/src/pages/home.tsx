import { Link } from 'react-router'
import { Button } from "@zerocmf/yishan-shadcn"

export function Home() {
  return (
    <div className="container mx-auto py-8">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">Shadcn 组件库</h1>
        <p className="text-xl text-muted-foreground">
          基于 React Router 的组件展示和测试平台
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link to="/pro-table">
            <Button size="lg">查看表格组件</Button>
          </Link>
          <Link to="/query-filter">
            <Button size="lg" variant="outline">查看筛选组件</Button>
          </Link>
          <Link to="/date-picker">
            <Button size="lg" variant="secondary">查看日期选择器</Button>
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-6xl mx-auto">
          <div className="border rounded-lg p-6 text-left">
            <h3 className="text-lg font-semibold mb-2">ProTable 组件</h3>
            <p className="text-sm text-muted-foreground mb-4">
              高性能数据表格组件，支持分页、排序、筛选等功能
            </p>
            <Link to="/pro-table">
              <Button variant="link" className="p-0">了解更多 →</Button>
            </Link>
          </div>
          
          <div className="border rounded-lg p-6 text-left">
            <h3 className="text-lg font-semibold mb-2">QueryFilter 组件</h3>
            <p className="text-sm text-muted-foreground mb-4">
              灵活的查询筛选组件，支持多种输入类型和验证规则
            </p>
            <Link to="/query-filter">
              <Button variant="link" className="p-0">了解更多 →</Button>
            </Link>
          </div>
          
          <div className="border rounded-lg p-6 text-left">
            <h3 className="text-lg font-semibold mb-2">DatePicker 组件</h3>
            <p className="text-sm text-muted-foreground mb-4">
              优雅的日期选择器组件，支持日期范围限制、禁用日期等配置
            </p>
            <Link to="/date-picker">
              <Button variant="link" className="p-0">了解更多 →</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}