import { SysUserResp } from '../../../../schemas/user.js'

export class HelloService {
  static getHealth () {
    return {
      module: 'hello',
      status: 'ok',
      time: new Date().toISOString()
    }
  }

  static getCurrentUser (currentUser: SysUserResp) {
    return {
      userId: currentUser.id,
      username: currentUser.username,
      module: 'hello',
      permission: 'authenticated'
    }
  }

  static echo (message: string, currentUser: SysUserResp) {
    return {
      echo: message,
      by: currentUser.username,
      module: 'hello'
    }
  }
}
