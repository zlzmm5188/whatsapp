import { Module } from "@nestjs/common";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";
import { AuthModule } from "../auth/auth.module";
import { FriendsModule } from "../friends/friends.module";

@Module({
  imports: [AuthModule, FriendsModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
