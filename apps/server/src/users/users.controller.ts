import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { CurrentUser } from "../auth/current-user.decorator";

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  nickname?: string;

  // `null` means "clear this field"; `undefined` means "don't touch it".
  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsString()
  @MaxLength(256)
  bio?: string | null;

  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatar?: string | null;
}

@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("search")
  search(@CurrentUser() me: string, @Query("q") q: string) {
    return this.users.search(me, q ?? "");
  }

  @Patch("me")
  updateMe(@CurrentUser() me: string, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(me, dto);
  }
}
