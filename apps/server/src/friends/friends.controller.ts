import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { FriendsService } from "./friends.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { CurrentUser } from "../auth/current-user.decorator";

class SendRequestDto {
  @IsString()
  toUsername!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  message?: string;
}

@UseGuards(JwtAuthGuard)
@Controller("friends")
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get()
  list(@CurrentUser() me: string) {
    return this.friends.list(me);
  }

  @Get("requests")
  requests(@CurrentUser() me: string) {
    return this.friends.incomingRequests(me);
  }

  @Post("requests")
  send(@CurrentUser() me: string, @Body() dto: SendRequestDto) {
    return this.friends.sendRequest(me, dto.toUsername, dto.message);
  }

  @Post("requests/:id/accept")
  accept(@CurrentUser() me: string, @Param("id") id: string) {
    return this.friends.accept(me, id);
  }

  @Post("requests/:id/reject")
  reject(@CurrentUser() me: string, @Param("id") id: string) {
    return this.friends.reject(me, id);
  }

  @Delete(":friendId")
  remove(@CurrentUser() me: string, @Param("friendId") friendId: string) {
    return this.friends.remove(me, friendId);
  }
}
