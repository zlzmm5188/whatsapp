import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { GroupsService } from "./groups.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { AddMembersDto, CreateGroupDto } from "./groups.dto";

@UseGuards(JwtAuthGuard)
@Controller("groups")
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Post()
  create(@CurrentUser() me: string, @Body() body: CreateGroupDto) {
    return this.groups.create(
      me,
      body.name,
      body.memberIds,
      body.description,
      body.avatar,
    );
  }

  @Get()
  list(@CurrentUser() me: string) {
    return this.groups.list(me);
  }

  @Get(":id")
  get(@CurrentUser() me: string, @Param("id") id: string) {
    return this.groups.get(me, id);
  }

  @Post(":id/members")
  addMembers(
    @CurrentUser() me: string,
    @Param("id") id: string,
    @Body() body: AddMembersDto,
  ) {
    return this.groups.addMembers(me, id, body.memberIds);
  }

  @Delete(":id/members/:userId")
  removeMember(
    @CurrentUser() me: string,
    @Param("id") id: string,
    @Param("userId") userId: string,
  ) {
    return this.groups.removeMember(me, id, userId);
  }

  @Delete(":id/leave")
  leave(@CurrentUser() me: string, @Param("id") id: string) {
    return this.groups.removeMember(me, id, me);
  }
}
