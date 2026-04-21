import { join } from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { FriendsModule } from "./friends/friends.module";
import { MessagesModule } from "./messages/messages.module";
import { ChatModule } from "./chat/chat.module";
import { PrismaModule } from "./prisma/prisma.module";
import { GroupsModule } from "./groups/groups.module";
import { UploadModule } from "./upload/upload.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "uploads"),
      serveRoot: "/uploads",
      serveStaticOptions: { index: false, fallthrough: true },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    FriendsModule,
    GroupsModule,
    MessagesModule,
    ChatModule,
    UploadModule,
  ],
})
export class AppModule {}
