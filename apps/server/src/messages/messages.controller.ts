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

  @Get("dm/:peerId")
  historyDM(
    @CurrentUser() me: string,
    @Param("peerId") peerId: string,
    @Query("take", new DefaultValuePipe(50), ParseIntPipe) take: number,
    @Query("before") before?: string,
  ) {
    return this.messages.history(me, peerId, take, before);
  }

  @Get("group/:groupId")
  historyGroup(
    @CurrentUser() me: string,
    @Param("groupId") groupId: string,
    @Query("take", new DefaultValuePipe(50), ParseIntPipe) take: number,
    @Query("before") before?: string,
  ) {
    return this.messages.groupHistory(me, groupId, take, before);
  }

  @Post("dm/:peerId/read")
  markReadDM(@CurrentUser() me: string, @Param("peerId") peerId: string) {
    return this.messages.markRead(me, peerId);
  }

  @Post("group/:groupId/read")
  markReadGroup(@CurrentUser() me: string, @Param("groupId") groupId: string) {
    return this.messages.markGroupRead(me, groupId);
  }
}
