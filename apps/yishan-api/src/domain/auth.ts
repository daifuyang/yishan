export interface LoginDTO {
  username?: string
  email?: string
  password: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  accessTokenExpiresIn: number  // accessToken过期时间（秒）
  refreshTokenExpiresIn: number // refreshToken过期时间（秒）
  tokenType: string
}

export interface JWTPayload {
  id: number
  email: string
  username: string
  real_name: string
  status: number
  iat: number
  exp: number
}

export interface RefreshTokenDTO {
  refreshToken: string
}

export interface RefreshTokenResponse {
  accessToken: string
  refreshToken: string
  accessTokenExpiresIn: number  // accessToken过期时间（秒）
  refreshTokenExpiresIn: number // refreshToken过期时间（秒）
  tokenType: string
}