import { Module } from "@nestjs/common";
import { ChatGateway } from "./chat.gateway";
import { AuthModule } from "../auth/auth.module";
import { FriendsModule } from "../friends/friends.module";
import { MessagesModule } from "../messages/messages.module";

@Module({
  imports: [AuthModule, FriendsModule, MessagesModule],
  providers: [ChatGateway],
})
export class ChatModule {}
