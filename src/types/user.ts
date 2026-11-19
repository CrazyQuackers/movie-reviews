/** User as returned by the API. Never contains the password hash. */
export interface PublicUser {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}
