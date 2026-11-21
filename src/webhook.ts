/**
 * Verificação da assinatura dos avisos do Monitor de NF-e.
 *
 * Cada aviso chega com `X-FiscalAPI-Timestamp` (segundos Unix) e
 * `X-FiscalAPI-Assinatura: v1=<hex>`, onde `hex = HMAC-SHA256(segredo,
 * "{timestamp}." + corpo_bruto)` e o segredo é a string inteira `whsec_...`.
 * Na troca de segredo o cabeçalho traz `v1=nova,v1=anterior` por 24 h.
 */

/** Tolerância padrão entre o timestamp do aviso e o relógio local, em segundos. */
export const TOLERANCIA_ASSINATURA_PADRAO = 300;

export interface VerificarAssinaturaParams {
  /** Corpo bruto da requisição, exatamente como chegou (não o JSON reserializado). */
  corpo: string | Uint8Array | ArrayBuffer;
  /** Valor do cabeçalho `X-FiscalAPI-Assinatura`. */
  assinatura: string | null | undefined;
  /** Valor do cabeçalho `X-FiscalAPI-Timestamp`. */
  timestamp: string | number | null | undefined;
  /** Segredo do webhook (`whsec_...`). */
  segredo: string;
  /** Diferença máxima aceita, em segundos (padrão 300). */
  tolerancia?: number;
  /** Agora, em segundos Unix (para testes). */
  agora?: number;
}

type Subtle = {
  importKey(
    format: 'raw',
    key: Uint8Array,
    algorithm: { name: 'HMAC'; hash: 'SHA-256' },
    extractable: boolean,
    usages: string[],
  ): Promise<unknown>;
  sign(algorithm: 'HMAC', key: unknown, data: Uint8Array): Promise<ArrayBuffer>;
};

async function subtle(): Promise<Subtle> {
  const web = (globalThis as { crypto?: { subtle?: Subtle } }).crypto?.subtle;
  if (web) return web;
  // Node 18 sem `globalThis.crypto`: usa o WebCrypto do módulo nativo.
  const nome = 'node:crypto';
  const mod = (await import(nome)) as { webcrypto?: { subtle?: Subtle } };
  if (!mod.webcrypto?.subtle) throw new Error('WebCrypto indisponível neste ambiente.');
  return mod.webcrypto.subtle;
}

function bytes(corpo: string | Uint8Array | ArrayBuffer): Uint8Array {
  if (typeof corpo === 'string') return new TextEncoder().encode(corpo);
  return corpo instanceof Uint8Array ? corpo : new Uint8Array(corpo);
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparação em tempo constante (para strings do mesmo tamanho). */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Assinatura `v1` (hex) de um corpo: útil para testar seu receptor. */
export async function assinarAvisoWebhook(
  segredo: string,
  timestamp: string | number,
  corpo: string | Uint8Array | ArrayBuffer,
): Promise<string> {
  const s = await subtle();
  const chave = await s.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const prefixo = new TextEncoder().encode(`${String(timestamp).trim()}.`);
  const corpoBytes = bytes(corpo);
  const mensagem = new Uint8Array(prefixo.length + corpoBytes.length);
  mensagem.set(prefixo, 0);
  mensagem.set(corpoBytes, prefixo.length);
  return hex(await s.sign('HMAC', chave, mensagem));
}

/**
 * Confere se um aviso do Monitor de NF-e veio da FiscalAPI.
 * Devolve `true` só se alguma assinatura `v1=` bater e o timestamp estiver
 * dentro da tolerância. Depois de verificar, deduplique pelo `id` do corpo.
 */
export async function verificarAssinaturaWebhook(
  params: VerificarAssinaturaParams,
): Promise<boolean> {
  const { corpo, assinatura, timestamp, segredo } = params;
  if (!segredo || !assinatura || timestamp === null || timestamp === undefined) return false;
  const ts = String(timestamp).trim();
  if (!/^\d+$/.test(ts)) return false;
  const tolerancia = params.tolerancia ?? TOLERANCIA_ASSINATURA_PADRAO;
  const agora = params.agora ?? Math.floor(Date.now() / 1000);
  if (tolerancia > 0 && Math.abs(agora - Number(ts)) > tolerancia) return false;

  const recebidas = assinatura
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3).trim().toLowerCase());
  if (!recebidas.length) return false;

  const esperada = await assinarAvisoWebhook(segredo, ts, corpo);
  let ok = false;
  for (const r of recebidas) ok = iguais(esperada, r) || ok;
  return ok;
}
