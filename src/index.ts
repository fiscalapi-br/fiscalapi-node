export {
  FiscalAPI,
  DEFAULT_BASE_URL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  MONITOR_NFE_MAX_LOTE,
} from './client.js';
export type {
  Certificado,
  Documento,
  DocumentoIE,
  FiscalAPIOptions,
  ListarChavesMonitorNfeParams,
  ListarNotasNfseParams,
} from './client.js';
export {
  verificarAssinaturaWebhook,
  assinarAvisoWebhook,
  TOLERANCIA_ASSINATURA_PADRAO,
} from './webhook.js';
export type { VerificarAssinaturaParams } from './webhook.js';
export {
  FiscalAPIError,
  AuthenticationError,
  InsufficientBalanceError,
  RateLimitError,
  BadRequestError,
  ServerError,
  APIConnectionError,
} from './errors.js';
export type * from './types.js';
export { VERSION } from './version.js';
export { FiscalAPI as default } from './client.js';
