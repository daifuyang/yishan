export interface LoginDTO {
  email: string
  password: string
}

export interface AuthResponse {
  user: {
    id: number
    email: string
    username: string
  }
  token: string
}

export interface JWTPayload {
  id: number
  email: string
  username: string
  iat: number
  exp: number
}