import dayjs, { Dayjs } from 'dayjs'

/**
 * 时间工具类
 * 提供统一的时间格式化和处理方法
 */
export class DateTimeUtil {
  /**
   * 默认的数据库时间格式
   */
  static readonly DB_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'
  
  /**
   * 默认的日期格式
   */
  static readonly DB_DATE_FORMAT = 'YYYY-MM-DD'
  
  /**
   * 默认的时间格式
   */
  static readonly DB_TIME_FORMAT = 'HH:mm:ss'

  /**
   * 获取当前时间的数据库格式字符串
   * @returns 格式化的时间字符串 (YYYY-MM-DD HH:mm:ss)
   */
  static now(): string {
    return dayjs().format(this.DB_DATETIME_FORMAT)
  }

  /**
   * 获取当前日期的数据库格式字符串
   * @returns 格式化的日期字符串 (YYYY-MM-DD)
   */
  static today(): string {
    return dayjs().format(this.DB_DATE_FORMAT)
  }

  /**
   * 格式化时间为数据库格式
   * @param date 时间对象、时间戳或时间字符串
   * @returns 格式化的时间字符串 (YYYY-MM-DD HH:mm:ss)
   */
  static formatDateTime(date?: string | number | Date | Dayjs): string {
    return dayjs(date).format(this.DB_DATETIME_FORMAT)
  }

  /**
   * 格式化日期为数据库格式
   * @param date 时间对象、时间戳或时间字符串
   * @returns 格式化的日期字符串 (YYYY-MM-DD)
   */
  static formatDate(date?: string | number | Date | Dayjs): string {
    return dayjs(date).format(this.DB_DATE_FORMAT)
  }

  /**
   * 格式化时间为指定格式
   * @param date 时间对象、时间戳或时间字符串
   * @param format 格式字符串
   * @returns 格式化的时间字符串
   */
  static format(date?: string | number | Date | Dayjs, format: string = this.DB_DATETIME_FORMAT): string {
    return dayjs(date).format(format)
  }

  /**
   * 获取时间戳（毫秒）
   * @param date 时间对象、时间戳或时间字符串
   * @returns 时间戳
   */
  static timestamp(date?: string | number | Date | Dayjs): number {
    return dayjs(date).valueOf()
  }

  /**
   * 获取Unix时间戳（秒）
   * @param date 时间对象、时间戳或时间字符串
   * @returns Unix时间戳
   */
  static unix(date?: string | number | Date | Dayjs): number {
    return dayjs(date).unix()
  }

  /**
   * 判断时间是否有效
   * @param date 时间对象、时间戳或时间字符串
   * @returns 是否有效
   */
  static isValid(date?: string | number | Date | Dayjs): boolean {
    return dayjs(date).isValid()
  }

  /**
   * 获取dayjs实例
   * @param date 时间对象、时间戳或时间字符串
   * @returns dayjs实例
   */
  static dayjs(date?: string | number | Date | Dayjs): Dayjs {
    return dayjs(date)
  }
}

/**
 * 导出默认实例（兼容性）
 */
export default DateTimeUtil