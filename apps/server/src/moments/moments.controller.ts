import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { MomentsService } from "./moments.service";
import { CreateCommentDto, CreateMomentDto } from "./moments.dto";
import type {
  MomentCommentDTO,
  MomentDTO,
} from "@im/shared";

@UseGuards(JwtAuthGuard)
@Controller("moments")
export class MomentsController {
  constructor(private readonly moments: MomentsService) {}

  // Timeline of self + friends.
  @Get()
  feed(
    @CurrentUser() meId: string,
    @Query("take") take?: string,
    @Query("before") before?: string,
  ): Promise<MomentDTO[]> {
    const n = take ? Number.parseInt(take, 10) : 20;
    return this.moments.feed(meId, Number.isFinite(n) ? n : 20, before);
  }

  // My own moments (shortcut for "我的朋友圈" page).
  @Get("mine")
  mine(
    @CurrentUser() meId: string,
    @Query("take") take?: string,
    @Query("before") before?: string,
  ): Promise<MomentDTO[]> {
    const n = take ? Number.parseInt(take, 10) : 20;
    return this.moments.myMoments(meId, Number.isFinite(n) ? n : 20, before);
  }

  // Moments by a specific user (self or a friend).
  @Get("user/:userId")
  byUser(
    @CurrentUser() meId: string,
    @Param("userId") userId: string,
    @Query("take") take?: string,
    @Query("before") before?: string,
  ): Promise<MomentDTO[]> {
    const n = take ? Number.parseInt(take, 10) : 20;
    return this.moments.userMoments(
      meId,
      userId,
      Number.isFinite(n) ? n : 20,
      before,
    );
  }

  @Get(":id")
  get(
    @CurrentUser() meId: string,
    @Param("id") id: string,
  ): Promise<MomentDTO> {
    return this.moments.getById(meId, id);
  }

  @Post()
  create(
    @CurrentUser() meId: string,
    @Body() body: CreateMomentDto,
  ): Promise<MomentDTO> {
    return this.moments.create(meId, body);
  }

  @Delete(":id")
  remove(
    @CurrentUser() meId: string,
    @Param("id") id: string,
  ): Promise<{ ok: true }> {
    return this.moments.delete(meId, id);
  }

  @Post(":id/like")
  like(
    @CurrentUser() meId: string,
    @Param("id") id: string,
  ): Promise<MomentDTO> {
    return this.moments.like(meId, id);
  }

  @Delete(":id/like")
  unlike(
    @CurrentUser() meId: string,
    @Param("id") id: string,
  ): Promise<MomentDTO> {
    return this.moments.unlike(meId, id);
  }

  @Post(":id/comments")
  comment(
    @CurrentUser() meId: string,
    @Param("id") id: string,
    @Body() body: CreateCommentDto,
  ): Promise<MomentCommentDTO> {
    return this.moments.addComment(meId, id, body);
  }

  @Delete(":id/comments/:commentId")
  deleteComment(
    @CurrentUser() meId: string,
    @Param("id") id: string,
    @Param("commentId") commentId: string,
  ): Promise<{ ok: true }> {
    return this.moments.deleteComment(meId, id, commentId);
  }
}
