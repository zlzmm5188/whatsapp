import { Module, forwardRef } from "@nestjs/common";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";
import { FriendsModule } from "../friends/friends.module";
import { GroupsModule } from "../groups/groups.module";

@Module({
  imports: [FriendsModule, forwardRef(() => GroupsModule)],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
