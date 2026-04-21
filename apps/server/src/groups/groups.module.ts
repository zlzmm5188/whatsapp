import { Module, forwardRef } from "@nestjs/common";
import { GroupsController } from "./groups.controller";
import { GroupsService } from "./groups.service";
import { ChatModule } from "../chat/chat.module";

@Module({
  imports: [forwardRef(() => ChatModule)],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
