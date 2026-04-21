import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

interface AuthedRequest extends Request {
  user?: { userId: string; username: string };
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) {
      throw new Error("CurrentUser used without JwtAuthGuard");
    }
    return req.user.userId;
  },
);
