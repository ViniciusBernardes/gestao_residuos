import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IntegrationsService {
  private readonly log = new Logger(IntegrationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async lookupCep(cepRaw: string) {
    const cep = cepRaw.replace(/\D/g, '');
    if (cep.length !== 8) throw new BadRequestException('CEP deve ter 8 dígitos');
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) throw new BadRequestException('Falha ao consultar CEP');
    const data = (await res.json()) as { erro?: boolean; ibge?: string; localidade?: string; uf?: string; logradouro?: string; bairro?: string; complemento?: string };
    if (data.erro) throw new BadRequestException('CEP não encontrado');
    return {
      cep,
      street: data.logradouro ?? '',
      district: data.bairro ?? '',
      complement: data.complemento ?? '',
      cityName: data.localidade ?? '',
      ufSigla: data.uf ?? '',
      ibgeCityCode: data.ibge ? parseInt(data.ibge, 10) : null,
    };
  }

  async lookupCnpj(cnpjRaw: string) {
    const cnpj = cnpjRaw.replace(/\D/g, '');
    if (cnpj.length !== 14) throw new BadRequestException('CNPJ deve ter 14 dígitos');

    const fromBrasil = await this.fetchCnpjBrasilApi(cnpj);
    if (fromBrasil) return { ...fromBrasil, _provider: 'brasilapi' };

    const fromRw = await this.fetchCnpjReceitaWs(cnpj);
    if (fromRw) return fromRw;

    throw new BadRequestException(
      'Não foi possível consultar o CNPJ (serviços externos indisponíveis ou CNPJ inválido). Tente de novo em alguns minutos.',
    );
  }

  private async fetchCnpjBrasilApi(cnpj: string): Promise<Record<string, unknown> | null> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 25_000);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'GestaoResiduos/1.0 (backend; CNPJ lookup)',
        },
        signal: ac.signal,
      });

      const text = await res.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        this.log.warn(`BrasilAPI CNPJ ${cnpj}: resposta não é JSON (${res.status})`);
        return null;
      }

      if (res.ok && body && typeof body === 'object' && !Array.isArray(body)) {
        return body as Record<string, unknown>;
      }

      const msg =
        body &&
        typeof body === 'object' &&
        'message' in body &&
        typeof (body as { message: unknown }).message === 'string'
          ? (body as { message: string }).message
          : `HTTP ${res.status}`;
      this.log.warn(`BrasilAPI CNPJ ${cnpj}: ${msg}`);
      return null;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      this.log.warn(`BrasilAPI CNPJ ${cnpj}: ${reason}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Formato próximo ao da BrasilAPI para o front preencher o mesmo conjunto de campos.
   */
  private mapReceitaWsToBrasilLikeShape(
    raw: Record<string, unknown>,
    cnpjDigits: string,
  ): Record<string, unknown> {
    const nome = String(raw.nome ?? '');
    const fantasia = String(raw.fantasia ?? '').trim();
    const ap = raw.atividade_principal as { code?: string; text?: string }[] | undefined;
    const asp = raw.atividades_secundarias as { code?: string; text?: string }[] | undefined;
    const primary = ap?.[0];
    let cnae_fiscal: number | undefined;
    if (primary?.code) {
      const d = primary.code.replace(/\D/g, '');
      if (d.length >= 7) cnae_fiscal = parseInt(d.slice(0, 7), 10);
    }
    const cepDigits = String(raw.cep ?? '').replace(/\D/g, '');
    const telDigits = String(raw.telefone ?? '').replace(/\D/g, '');

    return {
      razao_social: nome,
      nome_fantasia: fantasia || nome,
      cnpj: cnpjDigits,
      cep: cepDigits,
      logradouro: raw.logradouro ?? '',
      numero: raw.numero != null ? String(raw.numero) : '',
      complemento: raw.complemento ?? '',
      bairro: raw.bairro ?? '',
      municipio: raw.municipio ?? '',
      uf: raw.uf ?? '',
      email: raw.email ?? null,
      ddd_telefone_1: telDigits || null,
      cnae_fiscal: cnae_fiscal ?? null,
      cnae_fiscal_descricao: primary?.text ?? null,
      cnaes_secundarios:
        asp?.map((x) => {
          const d = x.code?.replace(/\D/g, '') ?? '';
          const n = d.length >= 7 ? parseInt(d.slice(0, 7), 10) : NaN;
          return {
            codigo: Number.isFinite(n) ? n : null,
            descricao: x.text ?? '',
          };
        }) ?? [],
      qsa: raw.qsa,
      descricao_situacao_cadastral: raw.situacao,
      _provider: 'receitaws',
    };
  }

  private async fetchCnpjReceitaWs(cnpj: string): Promise<Record<string, unknown> | null> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 25_000);
    try {
      const res = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'GestaoResiduos/1.0 (backend; CNPJ lookup)',
        },
        signal: ac.signal,
      });

      const text = await res.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        this.log.warn(`ReceitaWS CNPJ ${cnpj}: resposta não é JSON (${res.status})`);
        return null;
      }

      const j = body as Record<string, unknown>;
      if (j.status === 'ERROR') {
        const m = typeof j.message === 'string' ? j.message : 'CNPJ não encontrado';
        this.log.warn(`ReceitaWS CNPJ ${cnpj}: ${m}`);
        throw new BadRequestException(m);
      }
      if (j.status !== 'OK') {
        this.log.warn(`ReceitaWS CNPJ ${cnpj}: status ${String(j.status)}`);
        return null;
      }

      return this.mapReceitaWsToBrasilLikeShape(j, cnpj);
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      const reason = e instanceof Error ? e.message : String(e);
      this.log.warn(`ReceitaWS CNPJ ${cnpj}: ${reason}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async listUfs() {
    return this.prisma.ibgeUf.findMany({ orderBy: { sigla: 'asc' } });
  }

  /** Carrega municípios da BrasilAPI e persiste (IBGE). */
  async syncMunicipiosForUf(ufSigla: string) {
    const sigla = ufSigla.toUpperCase().trim();
    if (sigla.length !== 2) throw new BadRequestException('UF inválida');
    const uf = await this.prisma.ibgeUf.findUnique({ where: { sigla } });
    if (!uf) throw new BadRequestException('UF não cadastrada na base IBGE local');

    const res = await fetch(
      `https://brasilapi.com.br/api/ibge/municipios/v1/${sigla}?providers=dados-abertos-br,gov,wikipedia`,
    );
    if (!res.ok) throw new BadRequestException('Falha ao listar municípios (BrasilAPI)');
    const list = (await res.json()) as { nome: string; codigo_ibge: string }[];
    let n = 0;
    for (const m of list) {
      const id = parseInt(m.codigo_ibge, 10);
      if (Number.isNaN(id)) continue;
      await this.prisma.ibgeMunicipio.upsert({
        where: { id },
        create: { id, nome: m.nome, ufId: uf.id },
        update: { nome: m.nome, ufId: uf.id },
      });
      n++;
    }
    this.log.log(`Sincronizados ${n} municípios para ${sigla}`);
    return { uf: sigla, count: n };
  }

  async listMunicipios(ufSigla: string) {
    const sigla = ufSigla.toUpperCase().trim();
    const uf = await this.prisma.ibgeUf.findUnique({ where: { sigla } });
    if (!uf) throw new BadRequestException('UF inválida');
    const count = await this.prisma.ibgeMunicipio.count({ where: { ufId: uf.id } });
    if (count === 0) await this.syncMunicipiosForUf(sigla);
    return this.prisma.ibgeMunicipio.findMany({
      where: { ufId: uf.id },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    });
  }
}
