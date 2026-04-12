import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { RouteRole } from '../../common/constants/route-role.enum';
import { diskStorage } from 'multer';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateExitDto } from './dto/create-exit.dto';
import { UpdateExitDto } from './dto/update-exit.dto';
import { ExitsService } from './exits.service';

function ensureExitsUploadDir(): string {
  const dir = join(process.cwd(), 'uploads', 'stock-exits');
  mkdirSync(dir, { recursive: true });
  return dir;
}

@ApiTags('exits')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('exits')
export class ExitsController {
  constructor(private readonly exits: ExitsService) {}

  @Get()
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  list(
    @CurrentUser() user: JwtUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.exits.list(user.tenantId, page, limit);
  }

  @Get(':id/document')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  async downloadDocument(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { fullPath, downloadName } = await this.exits.resolveDocumentFile(user.tenantId, id);
    if (!existsSync(fullPath)) throw new NotFoundException('Arquivo não encontrado no servidor');
    const safe = downloadName.replace(/"/g, '\\"');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
    createReadStream(fullPath).pipe(res);
  }

  @Post(':id/document')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, ensureExitsUploadDir()),
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname) || '.bin';
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async uploadDocument(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) throw new NotFoundException('Arquivo ausente');
    return this.exits.attachDocument(user.tenantId, id, user.sub, file, req);
  }

  @Get(':id')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  getOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.exits.getOne(user.tenantId, id);
  }

  @Post()
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateExitDto, @Req() req: Request) {
    return this.exits.create(user.tenantId, user.sub, dto, req);
  }

  @Patch(':id')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateExitDto,
    @Req() req: Request,
  ) {
    return this.exits.update(user.tenantId, id, user.sub, dto, req);
  }

  @Delete(':id')
  @Roles(RouteRole.ADMIN)
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string, @Req() req: Request) {
    return this.exits.remove(user.tenantId, id, user.sub, req);
  }
}
