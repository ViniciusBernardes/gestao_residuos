import {
  BadRequestException,
  Body,
  Controller,
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
import { diskStorage } from 'multer';
import { Request, Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { RouteRole } from '../../common/constants/route-role.enum';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { COAT_ALLOWED_MIMES, tenantCoatUploadDir } from '../../common/utils/tenant-coat-upload';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantsService } from './tenants.service';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  list(
    @CurrentUser() user: JwtUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tenants.list(user, page, limit);
  }

  @Get('current')
  async current(@CurrentUser() user: JwtUser) {
    return this.tenants.getCurrent(user.tenantId);
  }

  /** Brasão do município atual (autenticado). Sem @Roles — qualquer utilizador do tenant pode carregar para o menu. */
  @Get('current/coat-of-arms')
  async downloadCurrentCoat(@CurrentUser() user: JwtUser, @Res() res: Response) {
    const meta = await this.tenants.getCoatOfArmsForDownload(user.tenantId);
    if (!meta) throw new NotFoundException('Brasão não cadastrado');
    res.setHeader('Content-Type', meta.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(meta.downloadName)}"`);
    createReadStream(meta.fullPath).pipe(res);
  }

  @Post()
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateTenantDto, @Req() req: Request) {
    return this.tenants.create(user, dto, req);
  }

  /** Brasão por id (administração): pré-visualização ao editar outro município. */
  @Get(':id/coat-of-arms')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  async downloadCoatById(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const meta = await this.tenants.getCoatOfArmsForDownloadScoped(user, id);
    if (!meta) throw new NotFoundException('Brasão não cadastrado');
    res.setHeader('Content-Type', meta.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(meta.downloadName)}"`);
    createReadStream(meta.fullPath).pipe(res);
  }

  @Post(':id/coat-of-arms')
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
        destination: (_req, _file, cb) => cb(null, tenantCoatUploadDir()),
        filename: (_req, file, cb) => {
          const mime = file.mimetype;
          const ext =
            COAT_ALLOWED_MIMES.get(mime) ?? (extname(file.originalname) || '.png');
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 4 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (COAT_ALLOWED_MIMES.has(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('Apenas imagens PNG, JPEG, WebP ou GIF'), false);
      },
    }),
  )
  async uploadCoat(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('Arquivo ausente');
    const full = this.tenants.coatOfArmsFullPath(file.filename);
    if (!existsSync(full)) throw new NotFoundException('Falha ao gravar arquivo');
    return this.tenants.setCoatOfArms(user, id, file.filename, file.originalname, req);
  }

  @Get(':id')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  one(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.tenants.getById(user, id);
  }

  @Patch('current')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  async updateCurrent(@CurrentUser() user: JwtUser, @Body() dto: UpdateTenantDto, @Req() req: Request) {
    return this.tenants.updateCurrent(user, dto, req);
  }

  @Patch(':id')
  @Roles(RouteRole.ADMIN, RouteRole.MANAGER)
  updateOne(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @Req() req: Request,
  ) {
    return this.tenants.updateById(user, id, dto, req);
  }
}
