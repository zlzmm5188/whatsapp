import { Module, forwardRef } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { FriendsModule } from "../friends/friends.module";
import { ChatModule } from "../chat/chat.module";
import { AuthModule } from "../auth/auth.module";
import { MomentsController } from "./moments.controller";
import { MomentsService } from "./moments.service";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    FriendsModule,
    forwardRef(() => ChatModule),
  ],
  controllers: [MomentsController],
  providers: [MomentsService],
  exports: [MomentsService],
})
export class MomentsModule {}
