import { Module, forwardRef } from "@nestjs/common";
import { ChatGateway } from "./chat.gateway";
import { AuthModule } from "../auth/auth.module";
import { FriendsModule } from "../friends/friends.module";
import { MessagesModule } from "../messages/messages.module";
import { GroupsModule } from "../groups/groups.module";

@Module({
  imports: [
    AuthModule,
    FriendsModule,
    forwardRef(() => MessagesModule),
    forwardRef(() => GroupsModule),
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
