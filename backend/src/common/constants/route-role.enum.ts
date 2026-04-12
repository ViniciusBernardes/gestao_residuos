/**
 * Usado apenas em @Roles() nos controllers. A autorização efetiva vem do
 * perfil de permissões (matriz) e do flag fullAccess no JWT.
 */
export enum RouteRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  OPERATOR = 'OPERATOR',
}
