/**
 * Converte o JSON de `details` dos logs de auditoria em texto legível (pt-BR).
 */

const FIELD_PT: Record<string, string> = {
  email: 'e-mail',
  name: 'nome',
  password: 'senha',
  tradeName: 'nome fantasia',
  legalName: 'razão social',
  role: 'papel',
  active: 'ativo',
  code: 'código',
  description: 'descrição',
  cnpj: 'CNPJ',
  notes: 'observações',
  quantity: 'quantidade',
  materialId: 'material',
  depositId: 'depósito',
  depositFromId: 'depósito origem',
  depositToId: 'depósito destino',
  establishmentId: 'estabelecimento destino',
  activityBranchId: 'ramo de atividade',
  fullAccess: 'acesso total',
  documentAttached: 'documento anexado',
  fields: 'campos',
  items: 'itens',
  itemsRestored: 'itens restaurados',
  quantityDelta: 'variação de quantidade',
  ref: 'referência',
  key: 'chave',
  created: 'criados',
  skipped: 'ignorados',
  errorCount: 'erros',
};

const ROLE_PT: Record<string, string> = {
  DEPOSIT: 'Depósito de armazenagem',
  DESTINATION: 'Destino final',
};

function fmtRole(r: unknown): string {
  if (typeof r !== 'string') return String(r);
  return ROLE_PT[r] ?? r;
}

function fmtScalar(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

/** Texto completo para tooltip (JSON legível). */
export function auditDetailsRawJson(details: unknown): string {
  if (details == null) return '';
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

export type AuditDetailsContext = {
  /** Recurso técnico do log (`StockExit`, `User`, …) para desambiguar textos. */
  resource?: string;
};

/**
 * Linhas curtas para exibir na tabela (cada string é um parágrafo/fato).
 */
export function formatAuditDetailsLines(
  details: unknown,
  ctx?: AuditDetailsContext,
): string[] {
  if (details == null) return [];

  if (typeof details !== 'object' || Array.isArray(details)) {
    return [fmtScalar(details)];
  }

  const o = details as Record<string, unknown>;
  const keys = Object.keys(o);

  if (keys.length === 0) return ['Sem detalhes adicionais.'];

  // Anexo em saída
  if (o.documentAttached === true) {
    return ['Documento anexado à saída.'];
  }

  // Importação CSV
  if (
    typeof o.created === 'number' &&
    typeof o.skipped === 'number' &&
    typeof o.errorCount === 'number'
  ) {
    return [
      `Importação: ${o.created} registro(s) criado(s), ${o.skipped} ignorado(s), ${o.errorCount} erro(s).`,
    ];
  }

  // Perfil de permissão (create)
  if (typeof o.name === 'string' && typeof o.fullAccess === 'boolean') {
    const lines = [`Perfil: ${o.name}.`, `Acesso total: ${o.fullAccess ? 'sim' : 'não'}.`];
    return lines;
  }

  // Estabelecimento (create)
  if (typeof o.tradeName === 'string' && o.role != null) {
    return [`Nome fantasia: ${o.tradeName}.`, `Papel: ${fmtRole(o.role)}.`];
  }

  // Ramo de atividade (create): name + role, sem fullAccess
  if (
    typeof o.name === 'string' &&
    o.role != null &&
    o.fullAccess === undefined &&
    o.tradeName === undefined
  ) {
    return [`Ramo: ${o.name}.`, `Papel: ${fmtRole(o.role)}.`];
  }

  // Saída de estoque
  if (typeof o.establishmentId === 'string' && typeof o.items === 'number') {
    return [
      `Saída com ${o.items} item(ns).`,
      `Estabelecimento de destino (ID): ${shortId(o.establishmentId)}`,
    ];
  }

  if (typeof o.itemsRestored === 'number') {
    return [`Ao excluir a saída, ${o.itemsRestored} item(ns) voltaram ao estoque.`];
  }

  // Entrada de estoque
  if (o.quantity != null && typeof o.depositId === 'string') {
    return [
      `Quantidade: ${fmtScalar(o.quantity)}.`,
      `Depósito (ID): ${shortId(o.depositId)}`,
    ];
  }

  // Transferência
  if (o.ref != null && o.quantity != null && o.depositId === undefined) {
    return [`Referência da transferência: ${fmtScalar(o.ref)}.`, `Quantidade: ${fmtScalar(o.quantity)}.`];
  }

  // Ajuste
  if (o.quantityDelta != null && keys.length <= 2) {
    return [`Variação no saldo: ${fmtScalar(o.quantityDelta)}.`];
  }

  // Usuário: e-mail
  if (typeof o.email === 'string' && keys.length === 1) {
    return [`E-mail: ${o.email}.`];
  }

  // Perfil excluído (só nome)
  if (keys.length === 1 && typeof o.name === 'string') {
    if (ctx?.resource === 'PermissionProfile') {
      return [`Perfil excluído: “${o.name}”.`];
    }
    return [`Nome: ${o.name}.`];
  }

  // Campos alterados (updates genéricos)
  if (Array.isArray(o.fields) && o.fields.every((x) => typeof x === 'string')) {
    const labels = (o.fields as string[]).map((k) => FIELD_PT[k] ?? k.replace(/([A-Z])/g, ' $1').trim());
    return [`Campos enviados na alteração: ${labels.join(', ')}.`];
  }

  // Parâmetro do sistema
  if (typeof o.key === 'string' && keys.length === 1) {
    return [`Parâmetro: ${o.key}.`];
  }

  // Genérico: pares chave / valor legíveis
  return [summarizeObject(o)];
}

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

function summarizeObject(o: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue;
    const label = FIELD_PT[k] ?? k.replace(/([A-Z])/g, ' $1').trim();
    if (k === 'fields' && Array.isArray(v)) {
      parts.push(`${label}: ${(v as string[]).join(', ')}`);
      continue;
    }
    if (k === 'role' && typeof v === 'string') {
      parts.push(`${label}: ${fmtRole(v)}`);
      continue;
    }
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      parts.push(`${label}: ${JSON.stringify(v)}`);
      continue;
    }
    parts.push(`${label}: ${fmtScalar(v)}`);
  }
  return parts.join(' · ');
}
