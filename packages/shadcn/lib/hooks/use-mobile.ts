import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    // 初始检查
    checkIsMobile()

    // 监听窗口大小变化
    window.addEventListener("resize", checkIsMobile)
    
    // 清理监听器
    return () => window.removeEventListener("resize", checkIsMobile)
  }, [])

  return isMobile
}