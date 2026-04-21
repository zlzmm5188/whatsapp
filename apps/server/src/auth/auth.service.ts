import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto, RegisterDto } from "./auth.dto";
import { toPublicUser } from "../users/user.mapper";
import type { AuthResponse, PublicUser } from "@im/shared";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException("username already taken");
    }

    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new ConflictException("email already registered");
      }
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    // The findUnique checks above are a fast-path for the common case, but a
    // concurrent request can slip between them and `user.create` (especially
    // widened by the ~100ms bcrypt hash). Catch the unique-constraint error
    // so we still return 409 instead of a 500.
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          username: dto.username,
          nickname: dto.nickname,
          password: hashed,
          email: dto.email ?? null,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const target = Array.isArray(err.meta?.target)
          ? (err.meta?.target as string[])
          : [];
        if (target.includes("username")) {
          throw new ConflictException("username already taken");
        }
        if (target.includes("email")) {
          throw new ConflictException("email already registered");
        }
        throw new ConflictException("duplicate entry");
      }
      throw err;
    }

    return this.sign(user.id, toPublicUser(user));
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (!user) {
      throw new UnauthorizedException("invalid credentials");
    }
    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) {
      throw new UnauthorizedException("invalid credentials");
    }
    return this.sign(user.id, toPublicUser(user));
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("user not found");
    }
    return toPublicUser(user);
  }

  async verifyToken(token: string): Promise<string | null> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: process.env.JWT_SECRET ?? "dev-secret-change-me",
      });
      return payload.sub;
    } catch {
      return null;
    }
  }

  private sign(userId: string, user: PublicUser): AuthResponse {
    const token = this.jwt.sign({ sub: userId, username: user.username });
    return { token, user };
  }
}
