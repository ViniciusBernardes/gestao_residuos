/**
 * Rótulos de auditoria alinhados à navegação do sistema (menu lateral).
 * `resource` vem do backend (nome do modelo / recurso técnico).
 */

export type AuditResourcePresentation = {
  /** Onde no menu o usuário encontraria isso (ex.: "Materiais", "Configurações"). */
  menu: string;
  /** Nome legível do registro afetado. */
  title: string;
};

const RESOURCE_MAP: Record<string, AuditResourcePresentation> = {
  User: { menu: 'Usuários', title: 'Usuário' },
  RecyclableMaterial: { menu: 'Materiais', title: 'Material' },
  MaterialType: { menu: 'Tipos de material', title: 'Tipo de material' },
  UnitOfMeasure: { menu: 'Unidades', title: 'Unidade de medida' },
  Establishment: { menu: 'Depósito / destino final', title: 'Estabelecimento' },
  StockMovement: { menu: 'Estoque', title: 'Movimentação de estoque' },
  StockExit: { menu: 'Saídas', title: 'Saída' },
  ActivityBranch: { menu: 'Ramos de atividade', title: 'Ramo de atividade' },
  PermissionProfile: { menu: 'Perfis de permissão', title: 'Perfil de permissão' },
  SystemParameter: { menu: 'Administração', title: 'Parâmetro do sistema' },
  CustomReport: { menu: 'Administração', title: 'Relatório personalizado' },
  Tenant: { menu: 'Administração', title: 'Município (tenant)' },
  backup: { menu: 'Administração', title: 'Backup de dados' },
};

/** Exibe o nome técnico só quando não há mapeamento (novos recursos). */
export function getAuditResourcePresentation(resource: string): AuditResourcePresentation & { raw: string } {
  const mapped = RESOURCE_MAP[resource];
  if (mapped) {
    return { ...mapped, raw: resource };
  }
  return {
    menu: 'Outros',
    title: humanizePascalCase(resource),
    raw: resource,
  };
}

function humanizePascalCase(s: string): string {
  if (!s) return s;
  const spaced = s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Criar',
  UPDATE: 'Alterar',
  DELETE: 'Excluir',
  SOFT_DELETE: 'Desativar',
  STOCK_EXIT: 'Saída de estoque',
  STOCK_ENTRY: 'Entrada de estoque',
  STOCK_TRANSFER: 'Transferência',
  STOCK_ADJUSTMENT: 'Ajuste de estoque',
  PARAM_SET: 'Definir parâmetro',
  IMPORT_MATERIALS_CSV: 'Importar materiais (CSV)',
  BACKUP_EXPORT: 'Exportar backup (JSON)',
};

export function formatAuditAction(action: string): string {
  return ACTION_LABELS[action] ?? humanizeAction(action);
}

function humanizeAction(action: string): string {
  if (!action) return '—';
  const lower = action.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
