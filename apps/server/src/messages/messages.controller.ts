import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { MessagesService } from "./messages.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { CurrentUser } from "../auth/current-user.decorator";

@UseGuards(JwtAuthGuard)
@Controller("messages")
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get("conversations")
  conversations(@CurrentUser() me: string) {
    return this.messages.conversations(me);
  }

  @Get(":peerId")
  history(
    @CurrentUser() me: string,
    @Param("peerId") peerId: string,
    @Query("take", new DefaultValuePipe(50), ParseIntPipe) take: number,
    @Query("before") before?: string,
  ) {
    return this.messages.history(me, peerId, take, before);
  }

  @Post(":peerId/read")
  markRead(@CurrentUser() me: string, @Param("peerId") peerId: string) {
    return this.messages.markRead(me, peerId);
  }
}
