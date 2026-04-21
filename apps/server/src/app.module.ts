import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { FriendsModule } from "./friends/friends.module";
import { MessagesModule } from "./messages/messages.module";
import { ChatModule } from "./chat/chat.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    FriendsModule,
    MessagesModule,
    ChatModule,
  ],
})
export class AppModule {}
