import "@fastify/jwt";

export interface AuthUser {
  id: number;
  username: string;
  role: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: AuthUser;
  }
}
