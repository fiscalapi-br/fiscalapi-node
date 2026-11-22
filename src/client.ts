import {
  APIConnectionError,
  AuthenticationError,
  BadRequestError,
  FiscalAPIError,
  InsufficientBalanceError,
  RateLimitError,
  ServerError,
} from './errors.js';
import type {
  AmbienteNfse,
  CertificadoNfse,
  EmpresaNfse,
  EmpresaNfseIn,
  EmpresaNfsePatch,
  NotaNfse,
  NotaNfseIn,
  PaginaNotasNfse,
  ReenvioWebhookNfse,
  StatusNotaNfse,
  SubstituicaoNfseIn,
  WebhookNfse,
  WebhookNfseConfigurado,
  CadastroMonitorResponse,
  CertidaoFederalResponse,
  CertidoesTodasResponse,
  CNDResponse,
  CNDTodosResponse,
  CnirResponse,
  ChaveMonitorada,
  ChaveMonitoradaDetalhe,
  ChaveParaMonitorar,
  CNPJResponse,
  ConsultaIEResponse,
  ConsultaIETodosResponse,
  CteXmlResponse,
  DifalSaidaResponse,
  ListaChavesMonitoradas,
  NfeXmlResponse,
  NfseResponse,
  PerfilProdutorResponse,
  RemoverMonitorResponse,
  SegredoWebhookRotacionado,
  SigefParcelaResponse,
  SigefResponse,
  SimplesNacionalResponse,
  StatusMonitorNfe,
  TesteWebhookEnfileirado,
  UfDifal,
  WebhookMonitorAtual,
  WebhookMonitorCriado,
} from './types.js';
import { VERSION } from './version.js';

export const DEFAULT_BASE_URL = 'https://api.fiscalapi.com.br';
/** Algumas consultas (NF-e, SIGEF) podem levar até 180 s no servidor. */
export const DEFAULT_TIMEOUT_MS = 200_000;
export const DEFAULT_MAX_RETRIES = 3;

const RETRYABLE_ANY_METHOD = new Set([429]);
const RETRYABLE_IDEMPOTENT = new Set([500, 502, 503, 504]);
const MAX_BACKOFF_MS = 30_000;
const MAX_RETRY_AFTER_MS = 60_000;

export interface FiscalAPIOptions {
  /** Chave de API. Se omitida, lê `FISCALAPI_API_KEY` do ambiente (Node). */
  apiKey?: string;
  baseUrl?: string;
  /** Tempo máximo de cada tentativa, em milissegundos. */
  timeoutMs?: number;
  /** Novas tentativas em 429 e (para GET) em 5xx/falha de rede. */
  maxRetries?: number;
  /** Implementação de fetch alternativa (padrão: `globalThis.fetch`). */
  fetch?: typeof fetch;
  /** Sufixo opcional para o `User-Agent`. */
  userAgent?: string;
}

/** Um documento: CPF ou CNPJ (pontuação é aceita). */
export type Documento = { cpf: string; cnpj?: never } | { cnpj: string; cpf?: never };

/** Um documento: CPF, CNPJ ou o número da Inscrição Estadual. */
export type DocumentoIE =
  | { cpf: string; cnpj?: never; ie?: never }
  | { cnpj: string; cpf?: never; ie?: never }
  | { ie: string; cpf?: never; cnpj?: never };

/** Certificado A1: bytes do .pfx/.p12 ou o conteúdo já em base64. */
export type Certificado = Uint8Array | ArrayBuffer | string;

type QueryValue = string | number | boolean | undefined;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: Record<string, unknown>;
  form?: FormData;
  headers?: Record<string, string>;
  /** Devolve os bytes da resposta (XML, PDF) em vez do JSON. */
  binary?: boolean;
  /** Repete em 5xx e falha de rede (GET sempre; POST só com chave de idempotência). */
  idempotent?: boolean;
}

/** Até 1.000 chaves por chamada no Monitor de NF-e. */
export const MONITOR_NFE_MAX_LOTE = 1000;

const NFSE = '/api/nfse';

/** Filtros da listagem de NFS-e emitidas. */
export interface ListarNotasNfseParams {
  status?: StatusNotaNfse;
  ambiente?: AmbienteNfse;
  /** Busca pela sua referência. */
  referencia?: string;
  /**
   * Só notas com `updated_at` igual ou posterior (ISO 8601). A nota do próprio
   * instante volta de novo: trate a repetição pelo `id`.
   */
  atualizadaDesde?: string | Date;
  /** `proximo` da página anterior. */
  cursor?: string;
  /** Notas por página, de 1 a 100 (padrão do servidor: 50). */
  limite?: number;
}

/** Filtros da listagem do Monitor de NF-e. */
export interface ListarChavesMonitorNfeParams {
  /** Só notas nesta situação. */
  status?: StatusMonitorNfe;
  /** `true`: só monitoramentos correndo; `false`: só os encerrados. */
  ativo?: boolean;
  /**
   * Só o que mudou a partir deste instante (o servidor volta 5 min: itens podem
   * repetir; deduplique por `chave` + `atualizada_em`). Sem fuso = horário de Brasília.
   */
  alteradoDesde?: string | Date;
  /** `proximo_cursor` da página anterior. */
  cursor?: string;
  /** Itens por página, de 1 a 1.000 (padrão do servidor: 100). */
  limite?: number;
}

export class FiscalAPI {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;

  constructor(apiKeyOrOptions?: string | FiscalAPIOptions, options: FiscalAPIOptions = {}) {
    const opts: FiscalAPIOptions =
      typeof apiKeyOrOptions === 'string'
        ? { ...options, apiKey: apiKeyOrOptions }
        : { ...(apiKeyOrOptions ?? {}) };
    const key = opts.apiKey ?? readEnv('FISCALAPI_API_KEY');
    if (!key) {
      throw new Error(
        "Informe a chave de API: new FiscalAPI('sua-chave') ou a variável FISCALAPI_API_KEY.",
      );
    }
    const fetchImpl = opts.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new Error('fetch não disponível: use Node 18+ ou passe a opção `fetch`.');
    }
    this.apiKey = key;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = Math.max(0, opts.maxRetries ?? DEFAULT_MAX_RETRIES);
    this.fetchImpl = fetchImpl.bind(globalThis);
    const ua = `fiscalapi-br-node/${VERSION}`;
    this.userAgent = opts.userAgent ? `${ua} ${opts.userAgent}` : ua;
  }

  // ---------------------------------------------------------------- IE

  /** Inscrição Estadual em uma UF (`GET /api/consultar`). */
  consultarIe(
    params: { uf: string; secundarias?: boolean } & DocumentoIE,
  ): Promise<ConsultaIEResponse> {
    return this.get('/api/consultar', {
      uf: uf(params.uf),
      ...umDocumento(params, ['cpf', 'cnpj', 'ie']),
      secundarias: params.secundarias || undefined,
    });
  }

  /** Inscrição Estadual em todos os estados (`GET /api/consultar-ie-todos`). */
  consultarIeTodos(
    params: { secundarias?: boolean } & DocumentoIE,
  ): Promise<ConsultaIETodosResponse> {
    return this.get('/api/consultar-ie-todos', {
      ...umDocumento(params, ['cpf', 'cnpj', 'ie']),
      secundarias: params.secundarias || undefined,
    });
  }

  // -------------------------------------------------------------- CNPJ

  /** Dados cadastrais na Receita Federal (`GET /api/consultar-cnpj`). */
  consultarCnpj(params: { cnpj: string; forceFresh?: boolean }): Promise<CNPJResponse> {
    if (!params.cnpj?.trim()) throw new Error('Informe o CNPJ.');
    return this.get('/api/consultar-cnpj', {
      cnpj: params.cnpj.trim(),
      force_fresh: params.forceFresh || undefined,
    });
  }

  /** Situação no Simples Nacional e SIMEI (`GET /api/consultar-simples-nacional`). */
  consultarSimplesNacional(params: { cnpj: string }): Promise<SimplesNacionalResponse> {
    if (!params.cnpj?.trim()) throw new Error('Informe o CNPJ.');
    return this.get('/api/consultar-simples-nacional', { cnpj: params.cnpj.trim() });
  }

  // --------------------------------------------------------- Certidões

  /** CND estadual (ICMS) em uma UF (`GET /api/consultar-cnd`). */
  consultarCnd(params: { uf: string } & Documento): Promise<CNDResponse> {
    return this.get('/api/consultar-cnd', {
      uf: uf(params.uf),
      ...umDocumento(params, ['cpf', 'cnpj']),
    });
  }

  /** CND estadual em todos os estados disponíveis (`GET /api/consultar-cnd-todos`). */
  consultarCndTodos(params: Documento): Promise<CNDTodosResponse> {
    return this.get('/api/consultar-cnd-todos', umDocumento(params, ['cpf', 'cnpj']));
  }

  /**
   * CND Federal — Receita Federal + PGFN (`GET /api/consultar-cnd-federal`).
   * Para CPF, a Receita exige a data de nascimento do titular
   * (`DD/MM/AAAA` ou `AAAA-MM-DD`).
   */
  consultarCndFederal(
    params: { emitirNova?: boolean } & (
      | { cnpj: string; cpf?: never; dataNascimento?: never }
      | { cpf: string; dataNascimento: string; cnpj?: never }
    ),
  ): Promise<CertidaoFederalResponse> {
    const doc = umDocumento(params, ['cpf', 'cnpj']);
    const dataNascimento = params.dataNascimento?.trim();
    if (doc.cpf && !dataNascimento) {
      throw new Error('Informe dataNascimento: a CND Federal de CPF exige a data de nascimento.');
    }
    return this.get('/api/consultar-cnd-federal', {
      ...doc,
      data_nascimento: doc.cpf ? dataNascimento : undefined,
      emitir_nova: params.emitirNova || undefined,
    });
  }

  /** CNDT — débitos trabalhistas (`GET /api/consultar-cndt`). */
  consultarCndt(params: Documento): Promise<CertidaoFederalResponse> {
    return this.get('/api/consultar-cndt', umDocumento(params, ['cpf', 'cnpj']));
  }

  /** CRF — regularidade do FGTS (`GET /api/consultar-crf-fgts`). */
  consultarCrfFgts(params: Documento): Promise<CertidaoFederalResponse> {
    return this.get('/api/consultar-crf-fgts', umDocumento(params, ['cpf', 'cnpj']));
  }

  /** Todas as certidões em uma chamada (`GET /api/certidoes-todas`). */
  consultarCertidoesTodas(
    params: { skipEstaduais?: boolean } & Documento,
  ): Promise<CertidoesTodasResponse> {
    return this.get('/api/certidoes-todas', {
      ...umDocumento(params, ['cpf', 'cnpj']),
      skip_estaduais: params.skipEstaduais || undefined,
    });
  }

  // -------------------------------------------------------------- NF-e

  /**
   * XML completo de uma NF-e pela chave de acesso (`POST /api/consultar-nfe-xml`).
   * O certificado A1 precisa ser de um participante da nota e não é armazenado.
   * Não é repetido automaticamente em 5xx.
   */
  consultarNfeXml(params: {
    chave: string;
    certificado: Certificado;
    senha: string;
    manifestar?: boolean;
  }): Promise<NfeXmlResponse> {
    if (!params.chave) throw new Error('Informe a chave de acesso.');
    return this.request('POST', '/api/consultar-nfe-xml', undefined, {
      chave: params.chave.replace(/\D/g, ''),
      certificado: certificadoBase64(params.certificado),
      senha: params.senha,
      manifestar: params.manifestar ?? true,
    });
  }

  /**
   * XML completo de um CT-e, CT-e OS ou GTV-e pela chave de acesso
   * (`POST /api/consultar-cte-xml`). O certificado A1 precisa ser de um
   * participante do documento e não é armazenado. Só há cobrança quando o XML
   * é devolvido. Não é repetido automaticamente em 5xx.
   */
  consultarCteXml(params: {
    chave: string;
    certificado: Certificado;
    senha: string;
  }): Promise<CteXmlResponse> {
    if (!params.chave) throw new Error('Informe a chave de acesso.');
    return this.request('POST', '/api/consultar-cte-xml', undefined, {
      // Aceita CNPJ alfanumérico: só tira separadores e põe em maiúsculas.
      chave: params.chave.replace(/[^0-9A-Za-z]/g, '').toUpperCase(),
      certificado: certificadoBase64(params.certificado),
      senha: params.senha,
    });
  }

  // ------------------------------------------------------------- DIFAL

  /**
   * DIFAL de saída (EC 87/2015) por UF de destino, num mês
   * (`POST /api/consultar-difal-saida`). Beta. O certificado A1 é o do
   * EMITENTE das notas e não é armazenado. `ufs` omitido = as 10 UFs
   * atendidas (AC, AP, DF, GO, MS, MT, RR, RS, SC, SE). Cobra 1 consulta por
   * UF com `status: 'ok'`. Pode levar cerca de 70 s. Não é repetido
   * automaticamente em 5xx.
   */
  consultarDifalSaida(params: {
    certificado: Certificado;
    senha: string;
    /** Mês de emissão das notas, `AAAA-MM`. */
    competencia: string;
    /** UFs de destino. Omitido ou vazio = as 10. */
    ufs?: UfDifal[];
  }): Promise<DifalSaidaResponse> {
    const competencia = (params.competencia ?? '').trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) {
      throw new Error('Informe a competência no formato AAAA-MM (ex.: 2026-10).');
    }
    const ufs = params.ufs?.map((u) => uf(u));
    return this.request('POST', '/api/consultar-difal-saida', undefined, {
      certificado: certificadoBase64(params.certificado),
      senha: params.senha,
      competencia,
      ...(ufs && ufs.length ? { ufs } : {}),
    });
  }

  /**
   * NFS-e (padrão nacional) pela chave de acesso, sem certificado
   * (`GET /api/consultar-nfse`). Com `danfse: true`, inclui o PDF em base64.
   * Uma consulta nova pode levar de 30 a 60 segundos.
   */
  consultarNfse(params: { chave: string; danfse?: boolean }): Promise<NfseResponse> {
    const chave = (params.chave ?? '').replace(/\D/g, '');
    if (!chave) throw new Error('Informe a chave de acesso.');
    return this.get('/api/consultar-nfse', { chave, danfse: params.danfse || undefined });
  }


  // -------------------------------------------------- Monitor de NF-e

  /**
   * Coloca até 1.000 chaves de NF-e no monitor (`POST /api/monitor-nfe/chaves`).
   * Cada chave aceita é cobrada uma vez e acompanhada por até `prazoDias`
   * (1 a 180, padrão 180). Chave já monitorada não é cobrada de novo; chave
   * inválida volta com o motivo, sem cobrança. Sem saldo para todas as aceitas,
   * a API responde 402 (`InsufficientBalanceError`) e nenhuma chave entra.
   * Não é repetido automaticamente em 5xx.
   */
  cadastrarChavesMonitorNfe(params: {
    /** Chaves (string) ou objetos com `statusConhecido` (padrão `autorizada`). */
    chaves: Array<string | ChaveParaMonitorar>;
    prazoDias?: number;
  }): Promise<CadastroMonitorResponse> {
    const chaves = lote(params.chaves).map((c) => {
      const item = typeof c === 'string' ? { chave: c } : c;
      const chave = chaveNfe(item.chave);
      return item.statusConhecido
        ? { chave, status_conhecido: item.statusConhecido }
        : { chave };
    });
    const body: Record<string, unknown> = { chaves };
    if (params.prazoDias !== undefined) {
      const p = params.prazoDias;
      if (!Number.isInteger(p) || p < 1 || p > 180) {
        throw new Error('prazoDias deve ser um inteiro de 1 a 180.');
      }
      body.prazo_dias = p;
    }
    return this.request('POST', '/api/monitor-nfe/chaves', undefined, body);
  }

  /**
   * Para de monitorar até 1.000 chaves (`POST /api/monitor-nfe/chaves/remover`).
   * Sem estorno e sem aviso no webhook.
   */
  removerChavesMonitorNfe(params: { chaves: string[] }): Promise<RemoverMonitorResponse> {
    const chaves = lote(params.chaves).map((c) => chaveNfe(c));
    return this.request('POST', '/api/monitor-nfe/chaves/remover', undefined, { chaves });
  }

  /**
   * Para de monitorar uma chave (`DELETE /api/monitor-nfe/chaves/{chave}`).
   * Chave fora do monitor: `BadRequestError` com status 404.
   */
  async removerChaveMonitorNfe(params: { chave: string }): Promise<void> {
    await this.request('DELETE', `/api/monitor-nfe/chaves/${chaveNfe(params.chave)}`);
  }

  /** Uma página das chaves monitoradas (`GET /api/monitor-nfe/chaves`). */
  listarChavesMonitorNfe(params: ListarChavesMonitorNfeParams = {}): Promise<ListaChavesMonitoradas> {
    return this.get('/api/monitor-nfe/chaves', queryListagem(params));
  }

  /**
   * Percorre todas as páginas da listagem, seguindo `proximo_cursor`.
   *
   * ```ts
   * for await (const item of api.iterarChavesMonitorNfe({ ativo: true })) { ... }
   * ```
   */
  async *iterarChavesMonitorNfe(
    params: Omit<ListarChavesMonitorNfeParams, 'cursor'> = {},
  ): AsyncGenerator<ChaveMonitorada, void, undefined> {
    let cursor: string | undefined;
    do {
      const pagina = await this.listarChavesMonitorNfe({ ...params, cursor });
      for (const item of pagina.itens ?? []) yield item;
      cursor = pagina.proximo_cursor ?? undefined;
    } while (cursor);
  }

  /**
   * Situação, eventos, próxima verificação e entregas que falharam de uma chave
   * (`GET /api/monitor-nfe/chaves/{chave}`).
   */
  consultarChaveMonitorNfe(params: { chave: string }): Promise<ChaveMonitoradaDetalhe> {
    return this.get(`/api/monitor-nfe/chaves/${chaveNfe(params.chave)}`, {});
  }

  /**
   * Cadastra ou troca a URL do webhook (`PUT /api/monitor-nfe/webhook`).
   * Só `https` na porta 443, com nome público. O `segredo` volta só aqui:
   * guarde-o. Cadastrar de novo gera outro segredo e reativa o webhook.
   */
  cadastrarWebhookMonitorNfe(params: { url: string }): Promise<WebhookMonitorCriado> {
    const url = (params.url ?? '').trim();
    if (!url) throw new Error('Informe a URL do webhook.');
    return this.request('PUT', '/api/monitor-nfe/webhook', undefined, { url });
  }

  /** URL cadastrada e se os avisos estão saindo (`GET /api/monitor-nfe/webhook`). */
  consultarWebhookMonitorNfe(): Promise<WebhookMonitorAtual> {
    return this.get('/api/monitor-nfe/webhook', {});
  }

  /** Remove o webhook (`DELETE /api/monitor-nfe/webhook`). O monitoramento continua. */
  async removerWebhookMonitorNfe(): Promise<void> {
    await this.request('DELETE', '/api/monitor-nfe/webhook');
  }

  /**
   * Gera um segredo novo (`POST /api/monitor-nfe/webhook/rotacionar-segredo`).
   * Por 24 h os avisos levam as duas assinaturas (`v1=nova,v1=anterior`).
   */
  rotacionarSegredoWebhookMonitorNfe(): Promise<SegredoWebhookRotacionado> {
    return this.request('POST', '/api/monitor-nfe/webhook/rotacionar-segredo');
  }

  /** Enfileira um aviso `tipo: 'teste'` (`POST /api/monitor-nfe/webhook/teste`). */
  testarWebhookMonitorNfe(): Promise<TesteWebhookEnfileirado> {
    return this.request('POST', '/api/monitor-nfe/webhook/teste');
  }

  // ------------------------------------------------- Emissão de NFS-e

  /**
   * Cadastra a empresa emissora (`POST /api/nfse/empresas`). Envie antes o
   * certificado A1 da mesma raiz do CNPJ (`enviarCertificadoNfse`).
   */
  criarEmpresaNfse(empresa: EmpresaNfseIn): Promise<EmpresaNfse> {
    if (!empresa || typeof empresa !== 'object') throw new Error('Informe os dados da empresa.');
    return this.send('POST', `${NFSE}/empresas`, { body: { ...empresa } });
  }

  /** Empresas emissoras da conta, ativas e desativadas (`GET /api/nfse/empresas`). */
  listarEmpresasNfse(): Promise<EmpresaNfse[]> {
    return this.send('GET', `${NFSE}/empresas`);
  }

  /** Uma empresa emissora (`GET /api/nfse/empresas/{empresaId}`). */
  obterEmpresaNfse(params: { empresaId: string }): Promise<EmpresaNfse> {
    return this.send('GET', `${NFSE}/empresas/${id(params.empresaId, 'empresaId')}`);
  }

  /**
   * Edita a empresa (`PATCH /api/nfse/empresas/{empresaId}`): mande só o que muda.
   * `{ ativa: false }` desliga a empresa; `{ ativa: true }` religa.
   */
  atualizarEmpresaNfse(params: { empresaId: string; mudancas: EmpresaNfsePatch }): Promise<EmpresaNfse> {
    const mudancas = params.mudancas;
    if (!mudancas || typeof mudancas !== 'object' || !Object.keys(mudancas).length) {
      throw new Error('Informe ao menos um campo em mudancas.');
    }
    return this.send('PATCH', `${NFSE}/empresas/${id(params.empresaId, 'empresaId')}`, {
      body: { ...mudancas },
    });
  }

  /**
   * Envia ou renova o certificado A1 da empresa (`PUT /api/nfse/certificados`,
   * multipart). e-CNPJ ICP-Brasil, `.pfx` de até 100 KB, da mesma raiz do CNPJ
   * que vai emitir. Substitui o anterior da mesma raiz. Não é repetido em 5xx.
   */
  enviarCertificadoNfse(params: {
    /** Bytes do `.pfx`/`.p12`, um `Blob`, ou o conteúdo em base64. */
    certificado: Certificado | Blob;
    /** Senha do certificado (vazia se o `.pfx` não tiver). */
    senha?: string;
    /** Nome do arquivo no envio (padrão `certificado.pfx`). */
    nomeArquivo?: string;
  }): Promise<CertificadoNfse> {
    const form = new FormData();
    form.append('certificado', certificadoBlob(params.certificado), params.nomeArquivo || 'certificado.pfx');
    form.append('senha', params.senha ?? '');
    return this.send('PUT', `${NFSE}/certificados`, { form });
  }

  /**
   * Exclui o certificado de uma raiz (`DELETE /api/nfse/certificados/{raiz}`).
   * Aceita a raiz (8 caracteres) ou o CNPJ inteiro, com ou sem pontuação.
   * Antes, desative as empresas da raiz.
   */
  async excluirCertificadoNfse(params: { raiz: string }): Promise<void> {
    let raiz = (params.raiz ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    if (raiz.length === 14) raiz = raiz.slice(0, 8);
    if (raiz.length !== 8) throw new Error('Informe a raiz do CNPJ (8 caracteres) ou o CNPJ.');
    await this.send('DELETE', `${NFSE}/certificados/${raiz}`);
  }

  /**
   * Pede a emissão de uma NFS-e (`POST /api/nfse/notas`). A resposta é `202`,
   * com a nota `pendente`; o resultado chega pelo webhook ou por `obterNfse`.
   * Em produção, mande `referencia` (ou `idempotencyKey`): o mesmo pedido
   * devolve a nota que já existe. Com uma delas, o SDK repete a chamada em
   * falha de rede e 5xx sem risco de nota em dobro.
   */
  emitirNfse(nota: NotaNfseIn, opcoes: { idempotencyKey?: string } = {}): Promise<NotaNfse> {
    if (!nota || typeof nota !== 'object') throw new Error('Informe os dados da nota.');
    const chave = chaveIdempotencia(nota.referencia, opcoes.idempotencyKey, nota.ambiente === 'producao');
    return this.send('POST', `${NFSE}/notas`, {
      body: { ...nota },
      headers: opcoes.idempotencyKey ? { 'Idempotency-Key': opcoes.idempotencyKey.trim() } : undefined,
      idempotent: chave !== undefined,
    });
  }

  /** Uma NFS-e emitida (`GET /api/nfse/notas/{notaId}`). */
  obterNfse(params: { notaId: string }): Promise<NotaNfse> {
    return this.send('GET', `${NFSE}/notas/${id(params.notaId, 'notaId')}`);
  }

  /**
   * Uma página das NFS-e emitidas (`GET /api/nfse/notas`), em ordem de
   * `updated_at`. Para sincronizar, use `atualizadaDesde`.
   */
  listarNfse(params: ListarNotasNfseParams = {}): Promise<PaginaNotasNfse> {
    const { limite } = params;
    if (limite !== undefined && (!Number.isInteger(limite) || limite < 1 || limite > 100)) {
      throw new Error('limite deve ser um inteiro de 1 a 100.');
    }
    const desde = params.atualizadaDesde;
    return this.send('GET', `${NFSE}/notas`, {
      query: {
        status: params.status,
        ambiente: params.ambiente,
        referencia: params.referencia || undefined,
        atualizada_desde: desde instanceof Date ? desde.toISOString() : desde || undefined,
        cursor: params.cursor || undefined,
        limite,
      },
    });
  }

  /**
   * Percorre todas as páginas da listagem, seguindo o cursor `proximo`.
   *
   * ```ts
   * for await (const nota of api.iterarNfse({ ambiente: 'producao' })) { ... }
   * ```
   */
  async *iterarNfse(
    params: Omit<ListarNotasNfseParams, 'cursor'> = {},
  ): AsyncGenerator<NotaNfse, void, undefined> {
    let cursor: string | undefined;
    do {
      const pagina = await this.listarNfse({ ...params, cursor });
      for (const nota of pagina.itens ?? []) yield nota;
      cursor = pagina.proximo ?? undefined;
    } while (cursor);
  }

  /**
   * Pede o cancelamento de uma NFS-e autorizada
   * (`POST /api/nfse/notas/{notaId}/cancelamento`). A resposta traz a nota
   * `cancelando`; o resultado chega pelo webhook (`cancelada` ou
   * `cancelamento_recusado`).
   */
  cancelarNfse(params: {
    notaId: string;
    /** `1` erro na emissão, `2` serviço não prestado, `9` outros. */
    motivo: 1 | 2 | 9;
    /** De 15 a 255 caracteres. */
    justificativa: string;
  }): Promise<NotaNfse> {
    const justificativa = (params.justificativa ?? '').trim();
    if (justificativa.length < 15 || justificativa.length > 255) {
      throw new Error('justificativa deve ter de 15 a 255 caracteres.');
    }
    return this.send('POST', `${NFSE}/notas/${id(params.notaId, 'notaId')}/cancelamento`, {
      body: { motivo: params.motivo, justificativa },
    });
  }

  /**
   * Substitui uma NFS-e autorizada por outra com os dados corrigidos
   * (`POST /api/nfse/notas/{notaId}/substituicao`). Devolve a nota NOVA,
   * `pendente`, com `substitui_id`. Em produção, mande `referencia` da nota
   * nova (ou `idempotencyKey`).
   */
  substituirNfse(params: {
    notaId: string;
    substituicao: SubstituicaoNfseIn;
    idempotencyKey?: string;
  }): Promise<NotaNfse> {
    const s = params.substituicao;
    if (!s || typeof s !== 'object') throw new Error('Informe os dados da substituição.');
    const chave = chaveIdempotencia(s.referencia, params.idempotencyKey, false);
    return this.send('POST', `${NFSE}/notas/${id(params.notaId, 'notaId')}/substituicao`, {
      body: { ...s },
      headers: params.idempotencyKey ? { 'Idempotency-Key': params.idempotencyKey.trim() } : undefined,
      idempotent: chave !== undefined,
    });
  }

  /** XML da NFS-e autorizada (`GET /api/nfse/notas/{notaId}/xml`). Não cobra. */
  async baixarXmlNfse(params: { notaId: string }): Promise<string> {
    const bytes = await this.send<Uint8Array>('GET', `${NFSE}/notas/${id(params.notaId, 'notaId')}/xml`, {
      binary: true,
      headers: { Accept: 'application/xml, application/problem+json' },
    });
    return new TextDecoder('utf-8').decode(bytes);
  }

  /** PDF do DANFSe (`GET /api/nfse/notas/{notaId}/pdf`). Não cobra. */
  baixarPdfNfse(params: { notaId: string }): Promise<Uint8Array> {
    return this.send('GET', `${NFSE}/notas/${id(params.notaId, 'notaId')}/pdf`, {
      binary: true,
      headers: { Accept: 'application/pdf, application/problem+json' },
    });
  }

  /**
   * Configura o webhook da emissão (`PUT /api/nfse/webhook`). Um por conta,
   * para os dois ambientes. O `segredo` volta só no primeiro cadastro: guarde-o.
   * Chamar de novo troca a URL e mantém o segredo (`segredo: null`).
   */
  configurarWebhookNfse(params: { url: string }): Promise<WebhookNfseConfigurado> {
    const url = (params.url ?? '').trim();
    if (!url) throw new Error('Informe a URL do webhook.');
    return this.send('PUT', `${NFSE}/webhook`, { body: { url } });
  }

  /** Webhook da emissão (`GET /api/nfse/webhook`). Sem webhook: `url: null`. */
  obterWebhookNfse(): Promise<WebhookNfse> {
    return this.send('GET', `${NFSE}/webhook`);
  }

  /** Remove o webhook da emissão (`DELETE /api/nfse/webhook`). As notas continuam. */
  async removerWebhookNfse(): Promise<void> {
    await this.send('DELETE', `${NFSE}/webhook`);
  }

  /** Põe de novo na fila os avisos de uma nota (`POST /api/nfse/notas/{notaId}/webhook`). */
  reenviarWebhookNfse(params: { notaId: string }): Promise<ReenvioWebhookNfse> {
    return this.send('POST', `${NFSE}/notas/${id(params.notaId, 'notaId')}/webhook`);
  }

  // ------------------------------------------------------ Imóvel rural

  /** Parcelas certificadas no SIGEF/INCRA (`GET /api/consultar-sigef`). */
  consultarSigef(params: Documento): Promise<SigefResponse> {
    return this.get('/api/consultar-sigef', umDocumento(params, ['cpf', 'cnpj']));
  }

  /** Uma parcela SIGEF pelo UUID (`GET /api/consultar-sigef-parcela`). */
  consultarSigefParcela(params: {
    uuid: string;
    forceFresh?: boolean;
  }): Promise<SigefParcelaResponse> {
    if (!params.uuid?.trim()) throw new Error('Informe o UUID da parcela.');
    return this.get('/api/consultar-sigef-parcela', {
      uuid: params.uuid.trim(),
      force_fresh: params.forceFresh || undefined,
    });
  }

  /** Imóveis rurais no CNIR/CAFIR (`GET /api/consultar-cnir`). */
  consultarCnir(params: Documento): Promise<CnirResponse> {
    return this.get('/api/consultar-cnir', umDocumento(params, ['cpf', 'cnpj']));
  }

  // ------------------------------------------------------------ Perfil

  /** Perfil consolidado do produtor rural (`GET /api/perfil-produtor`). */
  perfilProdutor(params: Documento): Promise<PerfilProdutorResponse> {
    return this.get('/api/perfil-produtor', umDocumento(params, ['cpf', 'cnpj']));
  }

  // -------------------------------------------------------- Transporte

  private get<T>(path: string, query: Record<string, QueryValue>): Promise<T> {
    return this.request<T>('GET', path, query);
  }

  private request<T>(
    method: Method,
    path: string,
    query?: Record<string, QueryValue>,
    body?: Record<string, unknown>,
  ): Promise<T> {
    return this.send<T>(method, path, { query, body });
  }

  private async send<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
    const { query, body, form } = opts;
    const url = this.baseUrl + path + encodeQuery(query);
    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      Accept: 'application/json',
      'User-Agent': this.userAgent,
      ...(opts.headers ?? {}),
    };
    // multipart: o fetch põe o Content-Type com o boundary.
    if (body !== undefined && form === undefined) headers['Content-Type'] = 'application/json';
    const payload = form ?? (body !== undefined ? JSON.stringify(body) : undefined);
    const idempotent = method === 'GET' || opts.idempotent === true;

    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method,
          headers,
          body: payload,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if (idempotent && attempt < this.maxRetries) {
          await sleep(backoff(attempt, null));
          continue;
        }
        const reason = err instanceof Error ? err.message : String(err);
        throw new APIConnectionError(`Falha ao conectar à FiscalAPI: ${reason}`, { cause: err });
      }

      let text: string;
      let raw: Uint8Array | undefined;
      try {
        if (opts.binary) {
          raw = new Uint8Array(await response.arrayBuffer());
          text = response.ok ? '' : new TextDecoder('utf-8').decode(raw);
        } else {
          text = await response.text();
        }
      } catch (err) {
        clearTimeout(timer);
        if (idempotent && attempt < this.maxRetries) {
          await sleep(backoff(attempt, null));
          continue;
        }
        throw new APIConnectionError('Conexão interrompida ao ler a resposta.', { cause: err });
      }
      clearTimeout(timer);

      if (response.ok) {
        if (raw !== undefined) return raw as T;
        return parseJson(text) as T;
      }

      const status = response.status;
      const retryable =
        (RETRYABLE_ANY_METHOD.has(status) && !limiteDoMes(text)) ||
        (idempotent && RETRYABLE_IDEMPOTENT.has(status));
      if (retryable && attempt < this.maxRetries) {
        await sleep(backoff(attempt, response.headers.get('retry-after')));
        continue;
      }
      throw errorFromResponse(status, text, response.headers);
    }
  }
}

// -------------------------------------------------------------- utilitários

function readEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[name];
}

function uf(value: string): string {
  const v = (value ?? '').trim().toUpperCase();
  if (v.length !== 2) throw new Error('Informe a UF com 2 letras (ex.: MT).');
  return v;
}

function umDocumento(
  params: Partial<Record<'cpf' | 'cnpj' | 'ie', string>>,
  allowed: Array<'cpf' | 'cnpj' | 'ie'>,
): Record<string, string> {
  const informados: Record<string, string> = {};
  for (const key of allowed) {
    const v = params[key];
    if (typeof v === 'string' && v.trim()) informados[key] = v.trim();
  }
  const n = Object.keys(informados).length;
  const nomes = allowed.join(' ou ');
  if (n === 0) throw new Error(`Informe ${nomes}.`);
  if (n > 1) throw new Error(`Informe apenas um: ${nomes}.`);
  return informados;
}

function encodeQuery(query?: Record<string, QueryValue>): string {
  if (!query) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

function lote<T>(chaves: T[]): T[] {
  if (!Array.isArray(chaves) || chaves.length === 0) throw new Error('Informe ao menos uma chave.');
  if (chaves.length > MONITOR_NFE_MAX_LOTE) {
    throw new Error(`Envie no máximo ${MONITOR_NFE_MAX_LOTE} chaves por chamada.`);
  }
  return chaves;
}

/** Chave de NF-e só com dígitos (tira pontos, espaços e o prefixo "NFe"). */
function chaveNfe(chave: string): string {
  const digitos = (chave ?? '').replace(/\D/g, '');
  if (!digitos) throw new Error('Informe a chave de acesso.');
  return digitos;
}

function queryListagem(params: ListarChavesMonitorNfeParams): Record<string, QueryValue> {
  const { limite } = params;
  if (limite !== undefined && (!Number.isInteger(limite) || limite < 1 || limite > 1000)) {
    throw new Error('limite deve ser um inteiro de 1 a 1.000.');
  }
  const desde = params.alteradoDesde;
  return {
    status: params.status,
    ativo: params.ativo,
    alterado_desde: desde instanceof Date ? desde.toISOString() : desde || undefined,
    cursor: params.cursor || undefined,
    limite,
  };
}

function certificadoBase64(cert: Certificado): string {
  if (typeof cert === 'string') return cert.replace(/\s+/g, '');
  const bytes = cert instanceof Uint8Array ? cert : new Uint8Array(cert);
  const NodeBuffer = (
    globalThis as {
      Buffer?: { from(b: Uint8Array): { toString(enc: 'base64'): string } };
    }
  ).Buffer;
  if (NodeBuffer) return NodeBuffer.from(bytes).toString('base64');
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Id (UUID) de empresa ou nota, pronto para o caminho. */
function id(valor: string, nome: string): string {
  const v = (valor ?? '').trim();
  if (!v) throw new Error(`Informe ${nome}.`);
  return encodeURIComponent(v);
}

/**
 * Confere `referencia` x `Idempotency-Key` antes de chamar: diferentes entre
 * si é 422 na API; em produção, sem nenhuma das duas, também. Devolve a chave
 * efetiva (ou `undefined`).
 */
function chaveIdempotencia(
  referencia: string | null | undefined,
  idempotencyKey: string | undefined,
  producao: boolean,
): string | undefined {
  const ref = typeof referencia === 'string' ? referencia.trim() : '';
  const key = (idempotencyKey ?? '').trim();
  if (ref && key && ref !== key) {
    throw new Error('referencia e idempotencyKey diferentes: mande só uma, ou as duas iguais.');
  }
  if (producao && !ref && !key) {
    throw new Error('Em produção, informe referencia (ou idempotencyKey) para não emitir a nota em dobro.');
  }
  return ref || key || undefined;
}

function certificadoBlob(cert: Certificado | Blob): Blob {
  if (typeof Blob !== 'undefined' && cert instanceof Blob) return cert;
  let bytes: Uint8Array;
  if (typeof cert === 'string') {
    const b64 = cert.replace(/\s+/g, '');
    const NodeBuffer = (
      globalThis as { Buffer?: { from(s: string, enc: 'base64'): Uint8Array } }
    ).Buffer;
    if (NodeBuffer) {
      bytes = new Uint8Array(NodeBuffer.from(b64, 'base64'));
    } else {
      const bin = atob(b64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    }
  } else {
    bytes = cert instanceof Uint8Array ? cert : new Uint8Array(cert as ArrayBuffer);
  }
  if (!bytes.length) throw new Error('Informe o certificado (.pfx).');
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/x-pkcs12' });
}

/** 429 do limite mensal de homologação: repetir não adianta. */
function limiteDoMes(text: string): boolean {
  return text.includes('NFSE_HOMOLOG_LIMITE');
}

function backoff(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const s = Number(retryAfter);
    if (Number.isFinite(s) && s >= 0) return Math.min(s * 1000, MAX_RETRY_AFTER_MS);
  }
  const base = Math.min(MAX_BACKOFF_MS, 500 * 2 ** attempt);
  return base + Math.random() * (base / 4);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJson(text: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new FiscalAPIError('Resposta da API não é JSON válido.', {
      body: text.slice(0, 500),
      cause: err,
    });
  }
}

function errorFromResponse(status: number, text: string, headers: Headers): FiscalAPIError {
  let body: unknown = text ? text.slice(0, 500) : undefined;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    // mantém o texto
  }

  let code: string | undefined;
  let message = `Erro HTTP ${status}`;
  let requestId: string | undefined;
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const c = b.error ?? b.title;
    if (typeof c === 'string') code = c;
    const detail = b.message ?? b.detail;
    if (typeof detail === 'string' && detail) message = detail;
    else if (Array.isArray(detail) && detail.length)
      message = detail
        .map((d) =>
          d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d),
        )
        .join('; ');
    if (typeof b.request_id === 'string' && b.request_id) requestId = b.request_id;
  } else if (typeof body === 'string' && body) {
    message = body;
  }

  const h: Record<string, string> = {};
  headers.forEach((value, key) => {
    h[key.toLowerCase()] = value;
  });
  const init = { status, code, requestId, body, headers: h };

  if (status === 401 || status === 403) return new AuthenticationError(message, init);
  if (status === 402) return new InsufficientBalanceError(message, init);
  if (status === 429) return new RateLimitError(message, init);
  if (status >= 500) return new ServerError(message, init);
  if (status >= 400) return new BadRequestError(message, init);
  return new FiscalAPIError(message, init);
}
