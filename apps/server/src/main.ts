import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import type { ServerOptions } from "socket.io";
import type { INestApplicationContext } from "@nestjs/common";
import { AppModule } from "./app.module";

// Custom IoAdapter that reads CORS_ORIGIN at bootstrap time, not at class-
// decoration time. Putting `cors` on `@WebSocketGateway({ cors })` reads
// `process.env` before ConfigModule has loaded `.env`, so the value was
// always stale. See apps/server/src/chat/chat.gateway.ts.
class CorsIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[],
  ) {
    super(app);
  }
  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.origins,
        credentials: true,
      },
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
  const origins = corsOrigin.split(",").map((o) => o.trim());
  app.enableCors({
    origin: origins,
    credentials: true,
  });
  app.useWebSocketAdapter(new CorsIoAdapter(app, origins));

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${port}`);
}

bootstrap();
