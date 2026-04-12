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
import { EstablishmentRole } from '@prisma/client';
import { RouteRole } from '../../common/constants/route-role.enum';
import { diskStorage } from 'multer';
import { Request, Response } from 'express';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { EstablishmentsService } from './establishments.service';
import { CreateEstablishmentDto } from './dto/create-establishment.dto';
import { UpdateEstablishmentDto } from './dto/update-establishment.dto';

function ensureUploadDir(): string {
  const dir = join(process.cwd(), 'uploads', 'establishments');
  mkdirSync(dir, { recursive: true });
  return dir;
}

@ApiTags('establishments')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('establishments')
export class EstablishmentsController {
  constructor(private readonly service: EstablishmentsService) {}

  @Get()
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  list(
    @CurrentUser() user: JwtUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: EstablishmentRole,
  ) {
    return this.service.list(user.tenantId, page, limit, role);
  }

  @Get(':id')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  getOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.getOne(user.tenantId, id);
  }

  @Get(':id/legal-document')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER, RouteRole.OPERATOR)
  async downloadDoc(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const est = await this.service.getOne(user.tenantId, id);
    if (!est.legalRepDocPath) throw new NotFoundException('Arquivo não enviado');
    const full = join(ensureUploadDir(), est.legalRepDocPath);
    if (!existsSync(full)) throw new NotFoundException('Arquivo não encontrado no servidor');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${est.legalRepDocPath}"`);
    createReadStream(full).pipe(res);
  }

  @Post()
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateEstablishmentDto,
    @Req() req: Request,
  ) {
    return this.service.create(user.tenantId, dto, user.sub, req);
  }

  @Patch(':id')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateEstablishmentDto,
    @Req() req: Request,
  ) {
    return this.service.update(user.tenantId, id, dto, user.sub, req);
  }

  @Delete(':id')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string, @Req() req: Request) {
    return this.service.remove(user.tenantId, id, user.sub, req);
  }

  @Post(':id/legal-document')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
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
        destination: (_req, _file, cb) => cb(null, ensureUploadDir()),
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname) || '.bin';
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async uploadDoc(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new NotFoundException('Arquivo ausente');
    return this.service.setLegalDocumentPath(user.tenantId, id, file.filename);
  }
}
