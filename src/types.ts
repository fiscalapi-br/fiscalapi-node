/**
 * Tipos das respostas da FiscalAPI. Campos novos podem aparecer sem aviso;
 * o SDK devolve o JSON completo da API.
 */

export type StatusFonte = 'success' | 'error' | 'timeout' | 'skipped';

export type StatusCertidao =
  | 'negativa'
  | 'positiva'
  | 'positiva_com_efeitos_de_negativa'
  | 'nao_contribuinte'
  | 'sem_certidao'
  | 'erro';

export interface SourceStatus {
  status: StatusFonte;
  error_code?: string;
  error_message?: string;
}

export interface CnaeSecundario {
  codigo: string;
  descricao?: string;
}

export interface InscricaoEstadual {
  inscricao_estadual: string;
  razao_social?: string;
  nome_fantasia?: string;
  situacao_ie?: string;
  uf_ie?: string;
  tipo_ie?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  numero?: string;
  municipio?: string;
  municipio_ibge?: string;
  cep?: string;
  regime_pagamento?: string;
  data_situacao?: string;
  situacao_contribuinte?: string;
  data_inicio_atividade?: string;
  cnae_codigo?: string;
  cnae_descricao?: string;
  regime_apuracao_icms?: string;
  situacao_nfe?: string;
  cpf_cnpj?: string;
  situacao_cadastral?: string;
  cnaes_secundarios?: CnaeSecundario[] | null;
  [extra: string]: unknown;
}

export interface ConsultaIEResponse {
  request_id: string;
  document: string;
  document_type: string;
  uf?: string;
  cached?: boolean;
  results: InscricaoEstadual[];
}

export interface IEPorUF {
  uf: string;
  source_status: SourceStatus;
  results: InscricaoEstadual[];
}

export interface ConsultaIETodosResponse {
  request_id: string;
  document: string;
  document_type: string;
  cached_ufs?: string[];
  results: IEPorUF[];
  /** `false` quando algum estado falhou: resultado vazio não é "não encontrado". */
  complete?: boolean;
}

export interface CNPJResult {
  razao_social?: string;
  nome_fantasia?: string;
  situacao_cadastral?: string;
  data_situacao_cadastral?: string;
  cnae_principal_codigo?: string;
  cnae_principal_descricao?: string;
  cnaes_secundarios?: Array<Record<string, string>>;
  natureza_juridica?: string;
  capital_social?: string;
  endereco?: Record<string, string>;
  qsa?: Array<Record<string, string>>;
  porte?: string;
  [extra: string]: unknown;
}

export interface CNPJResponse {
  request_id: string;
  cnpj: string;
  cached?: boolean;
  source_status: SourceStatus;
  result: CNPJResult | null;
}

export interface Certidao {
  status: StatusCertidao;
  status_raw?: string;
  validade?: string;
  validade_iso?: string;
  emissao?: string;
  emissao_iso?: string;
  protocolo?: string;
  pdf_base64?: string;
  url_verificacao?: string;
  codigo_autenticacao?: string;
  [extra: string]: unknown;
}

export interface CNDResponse {
  request_id: string;
  document: string;
  document_type: string;
  uf: string;
  cached?: boolean;
  source_status: SourceStatus;
  result: Certidao | null;
}

export interface CNDPorUF {
  uf: string;
  source_status: SourceStatus;
  result: Certidao | null;
}

export interface CNDTodosResponse {
  request_id: string;
  document: string;
  document_type: string;
  results: CNDPorUF[];
}

export interface CertidaoFederal extends Certidao {
  tipo: 'cndt' | 'cnd_federal' | 'crf_fgts';
  orgao?: string;
  modo?: 'consulta' | 'emissao';
}

export interface CertidaoFederalResponse {
  request_id: string;
  document: string;
  document_type: string;
  cached?: boolean;
  source_status: SourceStatus;
  result: CertidaoFederal | null;
}

export interface CertidoesTodasResponse {
  request_id: string;
  document: string;
  document_type: string;
  cnd_estaduais: CNDTodosResponse | null;
  certidoes_federais: CertidaoFederalResponse[];
}

export interface NfeXmlResultado {
  chave: string;
  /** ok | nao_autorizado | nao_encontrado | chave_invalida | cancelada | fora_prazo | somente_resumo | certificado_recusado | erro */
  status: string;
  cstat?: string;
  mensagem?: string;
  from_cache?: boolean;
  manifestacao?: string | null;
  /** XML completo (nfeProc), presente quando `status === 'ok'`. */
  xml?: string | null;
}

export interface NfeXmlResponse {
  request_id: string;
  total: number;
  com_dado: number;
  creditos_cobrados: number;
  resultados: NfeXmlResultado[];
}

export interface CteXmlResponse {
  request_id: string;
  chave: string;
  status: 'ok' | 'nao_autorizado' | 'nao_encontrado' | 'erro';
  /** XML completo (cteProc), presente quando `status === 'ok'`. */
  xml?: string | null;
  mensagem?: string;
  creditos_cobrados: number;
}

/** UFs de destino atendidas pelo DIFAL de saída. */
export type UfDifal = 'AC' | 'AP' | 'DF' | 'GO' | 'MS' | 'MT' | 'RR' | 'RS' | 'SC' | 'SE';

/** Situação da guia de um tributo da nota. Só `paga` quita. */
export type SituacaoGuiaDifal =
  | 'sem_guia_no_portal'
  | 'pendente_pagamento'
  | 'paga'
  | 'geracao_rejeitada'
  | 'aguardando_processamento'
  | 'substituida'
  | 'guia_gerada'
  | 'nao_se_aplica'
  | 'desconhecida';

/** ok (cobrada) | parcial, erro, nao_consultada (não cobradas). */
export type StatusUfDifal = 'ok' | 'parcial' | 'erro' | 'nao_consultada';

export interface NotaDifal {
  serie: string;
  numero: string;
  /** AAAA-MM-DD */
  data_emissao: string | null;
  /** Vencimento do imposto, AAAA-MM-DD. */
  vencimento: string | null;
  destinatario: string;
  uf_destino: string;
  valor_total: number | null;
  valor_difal: number | null;
  valor_fcp: number | null;
  situacao_guia_difal: SituacaoGuiaDifal;
  situacao_guia_fcp: SituacaoGuiaDifal;
  /** Sem guia no portal (menos em DF, GO e MT), ou guia pendente de pagamento ou rejeitada. */
  em_aberto: boolean;
  valor_em_aberto: number;
  /**
   * Guia existe, mas o pagamento não foi confirmado; em DF, GO e MT, também a nota
   * sem guia no portal (lá a guia é emitida no sistema da SEFAZ). Fora do valor em aberto.
   */
  a_conferir: boolean;
  valor_a_conferir: number;
}

export interface GuiaDifal {
  numero: string;
  vencimento_imposto: string | null;
  data_limite_pagamento: string | null;
  uf: string;
  tributo: string;
  valor: number | null;
  /** paga | pendente_pagamento | geracao_rejeitada | aguardando_processamento | substituida */
  situacao: string | null;
}

export interface UfDifalResultado {
  uf: string;
  status: StatusUfDifal;
  mensagem: string;
  total_documentos: number;
  valor_difal: number;
  valor_fcp: number;
  valor_em_aberto: number;
  notas_em_aberto: number;
  valor_a_conferir: number;
  notas_a_conferir: number;
  notas: NotaDifal[];
  guias: GuiaDifal[];
}

export interface DifalSaidaResponse {
  request_id: string;
  fonte: string;
  /** CNPJ ou CPF do titular do certificado. */
  emitente_tipo: string;
  emitente_documento: string;
  /** AAAA-MM */
  competencia: string;
  periodo_inicio: string;
  periodo_fim: string;
  total_documentos: number;
  valor_difal: number;
  valor_fcp: number;
  valor_em_aberto: number;
  notas_em_aberto: number;
  valor_a_conferir: number;
  notas_a_conferir: number;
  /** `true` só quando todas as UFs pedidas vieram `ok`. */
  completo: boolean;
  ufs: UfDifalResultado[];
  avisos: string[];
  /** Consultas usadas: 1 por UF com `status: 'ok'`. */
  creditos_cobrados: number;
}

export interface SigefParcela {
  parcel_id?: string;
  codigo_parcela?: string;
  denominacao?: string;
  area_ha?: number;
  municipio?: string;
  uf?: string;
  codigo_ibge?: string;
  detentor?: string;
  matricula?: string;
  cns?: string;
  status?: string;
  data_certificacao?: string;
  natureza?: string;
  codigo_sncr?: string;
  cartorio?: string;
  geometria_wkt?: string;
  vertices?: Array<Record<string, unknown>>;
  confrontantes?: Array<Record<string, unknown>>;
  [extra: string]: unknown;
}

export interface SigefResponse {
  request_id: string;
  document: string;
  document_type: string;
  cached?: boolean;
  source_status: SourceStatus;
  result: { total_parcelas: number; area_total_ha: number; parcelas: SigefParcela[] } | null;
}

export interface SigefParcelaResponse {
  request_id: string;
  parcel_id: string;
  cached?: boolean;
  consultado_em?: string;
  completo?: boolean;
  avisos?: string[];
  source_status: SourceStatus;
  result: SigefParcela | null;
}

export interface CnirResponse {
  request_id: string;
  document: string;
  document_type: string;
  source_status: SourceStatus;
  pessoa_fisica?: Record<string, unknown> | null;
  pessoa_juridica?: Record<string, unknown> | null;
  imoveis_cafir: Array<Record<string, unknown>>;
  total_imoveis: number;
  total_imoveis_ativos: number;
}

export interface PerfilProdutorResponse {
  request_id: string;
  document: string;
  receita_federal?: CNPJResponse | null;
  inscricoes_estaduais?: ConsultaIETodosResponse | null;
  cnd_estaduais?: CNDTodosResponse | null;
  certidoes_federais?: CertidaoFederalResponse[];
  cnir?: CnirResponse | null;
  [extra: string]: unknown;
}

export interface SimplesNacionalEventoFuturo {
  regime: string;
  descricao: string;
  data_efeito: string;
}

export interface SimplesNacionalPeriodoAnterior {
  data_inicial: string;
  data_final: string;
  detalhamento: string;
}

export interface SimplesNacionalMaisInfo {
  opcoes_periodos_anteriores?: string;
  opcoes_periodos_anteriores_lista?: SimplesNacionalPeriodoAnterior[];
  enquadramentos_simei_periodos_anteriores?: string;
  enquadramentos_simei_periodos_anteriores_lista?: SimplesNacionalPeriodoAnterior[];
  eventos_futuros_simples?: string;
  eventos_futuros_simei?: string;
  mei_tac?: string;
}

export interface SimplesNacionalResponse {
  request_id: string;
  cnpj: string;
  /** Para filiais, a situação é a da matriz. */
  cnpj_matriz: string;
  nome_empresarial: string;
  data_consulta: string;
  situacao_simples: string;
  optante_simples: boolean;
  data_opcao_simples?: string | null;
  situacao_simei: string;
  enquadrado_simei: boolean;
  regime_regular_ibs: string;
  regime_regular_cbs: string;
  eventos_futuros?: SimplesNacionalEventoFuturo[];
  mais_info?: SimplesNacionalMaisInfo | null;
  cached: boolean;
}

export interface NfseEndereco {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  municipio?: string | null;
  uf?: string | null;
}

export interface NfseEmitente {
  razao_social?: string | null;
  cpf_cnpj?: string | null;
  inscricao_municipal?: string | null;
  situacao_simples_nacional?: string | null;
  regime_especial_tributacao?: string | null;
  endereco?: NfseEndereco | null;
}

export interface NfsePessoa {
  cpf_cnpj?: string | null;
  inscricao_municipal?: string | null;
  nome?: string | null;
}

export interface NfseServico {
  pais?: string | null;
  municipio?: string | null;
  codigo_tributacao_nacional?: string | null;
  descricao_codigo?: string | null;
  item_nbs?: string | null;
  descricao?: string | null;
}

export interface NfseTributacaoMunicipal {
  tributacao_issqn?: string | null;
  municipio_incidencia?: string | null;
  valor_servico?: number | null;
  desconto_incondicionado?: number | null;
  deducoes?: number | null;
  beneficio_municipal?: number | null;
  base_calculo?: number | null;
  /** Percentual (2.5 = 2,5%). */
  aliquota?: number | null;
  valor_issqn?: number | null;
  retencao?: string | null;
}

export interface NfseTributacaoFederal {
  situacao_pis_cofins?: string | null;
  base_calculo_pis_cofins?: number | null;
  aliquota_pis?: number | null;
  valor_pis?: number | null;
  aliquota_cofins?: number | null;
  valor_cofins?: number | null;
  irrf?: number | null;
  contribuicoes_sociais_retidas?: number | null;
  contribuicao_previdenciaria_retida?: number | null;
}

export interface NfseResponse {
  request_id: string;
  chave: string;
  numero_nfse?: string | null;
  codigo_municipio_emissor?: string | null;
  data_geracao?: string | null;
  versao?: string | null;
  dps?: { numero?: string | null; serie?: string | null; data_emissao?: string | null } | null;
  /** `codigo` 100 gerada, 101 substituição, 102 decisão judicial, 103 avulsa. Não indica cancelamento. */
  situacao?: { codigo?: string | null; descricao?: string | null } | null;
  emitente?: NfseEmitente | null;
  tomador?: NfsePessoa | null;
  intermediario?: NfsePessoa | null;
  servico?: NfseServico | null;
  tributacao_municipal?: NfseTributacaoMunicipal | null;
  tributacao_federal?: NfseTributacaoFederal | null;
  total_tributos?: Array<{ descricao: string; valor?: number | null }>;
  informacoes_complementares?: string | null;
  ambiente_gerador?: string | null;
  cached: boolean;
  /** PDF do DANFSe em base64 (só com `danfse: true`). */
  danfse_pdf_base64?: string | null;
  /** Presente quando o PDF pedido não pôde ser obtido. */
  aviso?: string | null;
  [extra: string]: unknown;
}

// ------------------------------------------------------- Monitor de NF-e

/** Situação de uma NF-e no monitor. */
export type StatusMonitorNfe =
  | 'autorizada'
  | 'autorizada_fora_prazo'
  | 'denegada'
  | 'cancelada'
  | 'cancelada_fora_prazo'
  | 'nao_encontrada'
  | 'chave_divergente';

/** Uma chave para monitorar, com a situação que você já conhece (padrão `autorizada`). */
export interface ChaveParaMonitorar {
  chave: string;
  statusConhecido?: StatusMonitorNfe;
}

export interface ResultadoCadastroMonitor {
  chave: string;
  /** `aceita` (cobrada), `ja_monitorada` (sem nova cobrança) ou `invalida` (veja `motivo`). */
  situacao: 'aceita' | 'ja_monitorada' | 'invalida';
  /** Motivo da recusa: vazia, tamanho, caractere, dv, uf, data, modelo, tpemis, emitente, fora_do_prazo_sefaz... */
  motivo?: string | null;
  encerra_em?: string | null;
}

export interface CadastroMonitorResponse {
  /** Um resultado por chave enviada, na mesma ordem. */
  resultados: ResultadoCadastroMonitor[];
  /** Chaves que entraram no monitor e foram cobradas. */
  aceitas: number;
  /** Valor cobrado nesta chamada, em reais (ex.: `"0,03"`). */
  valor_cobrado: string;
}

export interface RemoverMonitorResponse {
  removidas: number;
  nao_encontradas: string[];
}

export interface EventoNfeMonitorada {
  tipo: 'cancelamento' | 'carta_correcao' | 'epec' | 'outro';
  /** Código do evento (ex.: `110111` para cancelamento). */
  codigo: string;
  sequencia: number;
  protocolo?: string | null;
  registrado_em?: string | null;
  texto?: string | null;
}

export interface ChaveMonitorada {
  chave: string;
  /** Nulo até a primeira verificação. */
  status: StatusMonitorNfe | null;
  ativo: boolean;
  criada_em: string;
  encerra_em: string;
  encerrada_em?: string | null;
  motivo_encerramento?: string | null;
  ultima_verificacao_em?: string | null;
  proxima_verificacao_em?: string | null;
  atualizada_em: string;
  /** Avisos que o webhook não recebeu depois de todas as tentativas. */
  entregas_falhas: number;
}

export interface EntregaFalhaMonitor {
  id: string;
  tipo: string;
  criada_em: string;
  tentativas: number;
  ultimo_erro?: string | null;
}

export interface ChaveMonitoradaDetalhe extends ChaveMonitorada {
  eventos: EventoNfeMonitorada[];
  entregas_que_falharam: EntregaFalhaMonitor[];
}

export interface ListaChavesMonitoradas {
  itens: ChaveMonitorada[];
  /** Passe em `cursor` para a próxima página. Nulo na última. */
  proximo_cursor: string | null;
}

export interface WebhookMonitorCriado {
  url: string;
  /** Segredo da assinatura. Mostrado só agora: guarde-o. */
  segredo: string;
}

export interface WebhookMonitorAtual {
  url: string;
  /** Falso quando os avisos falharam por 3 dias seguidos. Cadastre de novo. */
  ativo: boolean;
  falhando_desde?: string | null;
}

export interface SegredoWebhookRotacionado {
  segredo: string;
  /** Até quando os avisos levam também a assinatura do segredo anterior. */
  anterior_valido_ate: string;
}

export interface TesteWebhookEnfileirado {
  id: string;
  estado: 'pendente';
}

/** Corpo do aviso que a FiscalAPI envia ao seu webhook. */
export interface AvisoMonitorNfe {
  id: string;
  tipo:
    | 'nfe.status_alterado'
    | 'nfe.evento_registrado'
    | 'nfe.monitoramento_encerrado'
    | 'teste';
  ocorrido_em: string;
  chave?: string | null;
  status_anterior?: StatusMonitorNfe | null;
  status_atual?: StatusMonitorNfe | null;
  evento?: EventoNfeMonitorada | null;
  monitoramento?: {
    ativo: boolean;
    encerra_em: string | null;
    motivo_encerramento: string | null;
  } | null;
}

// ------------------------------------------------------ Emissão de NFS-e

/** Ambiente da nota: `homologacao` (sem valor fiscal, grátis) ou `producao`. */
export type AmbienteNfse = 'homologacao' | 'producao';

/** Situação de uma NFS-e emitida pela API. */
export type StatusNotaNfse =
  | 'pendente'
  | 'processando'
  | 'autorizada'
  | 'rejeitada'
  | 'cancelando'
  | 'cancelada'
  | 'substituida';

/** Eventos que o webhook da emissão envia. */
export type EventoWebhookNfse =
  | 'autorizada'
  | 'rejeitada'
  | 'cancelada'
  | 'substituida'
  | 'cancelamento_recusado';

/** Cenário pronto que preenche os campos fixos da nota. */
export type PresetNfse = 'simples_servico' | 'regime_normal_servico' | 'locacao_bem_movel';

/** Valor decimal. Prefira texto (`"1500.00"`) para não perder casas. */
export type DecimalNfse = string | number;

/** Regime tributário do prestador. */
export interface RegimeNfse {
  /** `1` não optante, `2` MEI, `3` ME/EPP do Simples Nacional. */
  op_simp_nac: 1 | 2 | 3;
  /** Só para ME/EPP, e obrigatório nele: `1`, `2` ou `3`. */
  reg_ap_trib_sn?: 1 | 2 | 3 | null;
  /** Regime especial (padrão `0`, nenhum). */
  reg_esp_trib?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 9;
  /** Regime de apuração do IBS/CBS do optante do Simples. */
  reg_ap_ibscbs_sn?: 1 | 2 | 3 | null;
}

/** Corpo do cadastro da empresa emissora (`POST /api/nfse/empresas`). */
export interface EmpresaNfseIn {
  /** CNPJ, com ou sem pontuação. */
  cnpj: string;
  razao_social: string;
  /** Inscrição municipal, se houver. */
  im?: string | null;
  /** Município do estabelecimento (IBGE, 7 dígitos). */
  cod_mun_ibge: string;
  regime: RegimeNfse;
  /** Série da DPS, de `00001` a `49999`. */
  serie: string;
  /** Primeiro número de DPS em produção (padrão 1), para continuar uma numeração. */
  primeiro_ndps_producao?: number | null;
  /** Só `certificado` (padrão). */
  auth_modo?: 'certificado';
  /** Omitido: vale o certificado da raiz do CNPJ. */
  certificado_id?: string | null;
}

/**
 * Edição da empresa (`PATCH /api/nfse/empresas/{id}`): mande só o que muda.
 * CNPJ, série, numeração, `auth_modo` e `certificado_id` não mudam.
 * `{ ativa: false }` desliga a empresa; `{ ativa: true }` religa.
 */
export interface EmpresaNfsePatch {
  razao_social?: string;
  im?: string | null;
  cod_mun_ibge?: string;
  /** Muda campo a campo; `op_simp_nac` vai sempre que `regime` for enviado. */
  regime?: RegimeNfse;
  ativa?: boolean;
}

/** Ponto de atenção que não impede o cadastro nem a emissão. */
export interface AvisoValidacaoNfse {
  codigo?: string;
  campo?: string;
  mensagem?: string;
  [extra: string]: unknown;
}

export interface EmpresaNfse {
  id: string;
  cnpj: string;
  razao_social: string;
  im: string | null;
  cod_mun_ibge: string;
  regime: {
    op_simp_nac: number;
    reg_ap_trib_sn: number | null;
    reg_esp_trib: number;
    reg_ap_ibscbs_sn: number | null;
  };
  auth_modo: string;
  certificado_id: string | null;
  serie: string;
  proximo_ndps_producao: number;
  proximo_ndps_homologacao: number;
  ativa: boolean;
  /** Posse do CNPJ conferida pelo certificado. Só empresa verificada emite em produção. */
  verificada: boolean;
  verificada_em: string | null;
  /** Município conveniado ao padrão nacional (`null`: não deu para confirmar). */
  convenio_ok: boolean | null;
  /** `MUNICIPIO_SEM_CONVENIO` ou `CONVENIO_NAO_CONFIRMADO`. */
  avisos: AvisoValidacaoNfse[];
  created_at: string | null;
  updated_at: string | null;
}

/** Metadados do certificado A1 guardado. O arquivo e a senha nunca voltam. */
export interface CertificadoNfse {
  id: string;
  /** Raiz do CNPJ do titular (8 caracteres). */
  cnpj_raiz: string;
  titular_cnpj: string;
  /** SHA-256 do certificado. */
  fingerprint: string;
  valido_ate: string;
  created_at: string | null;
}

export interface EnderecoNacionalNfse {
  /** 8 dígitos, da UF do município. */
  cep: string;
  cod_mun_ibge: string;
  logradouro: string;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
}

export interface EnderecoExteriorNfse {
  /** ISO, 2 letras. */
  cod_pais: string;
  cod_postal: string;
  cidade: string;
  estado_provincia: string;
  logradouro: string;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
}

export interface TomadorNfse {
  tipo: 'cpf' | 'cnpj' | 'estrangeiro' | 'nao_identificado';
  /** CPF ou CNPJ, com ou sem pontuação. Obrigatório para `cpf` e `cnpj`. */
  documento?: string | null;
  /** Obrigatório, menos em `nao_identificado`. */
  nome?: string | null;
  email?: string | null;
  endereco?: EnderecoNacionalNfse | null;
  /** Obrigatório para `estrangeiro`. */
  endereco_ext?: EnderecoExteriorNfse | null;
  /** Estrangeiro: `nif` ou `motivo_sem_nif` (um dos dois). */
  nif?: string | null;
  /** `1` dispensado, `2` não exigido. */
  motivo_sem_nif?: 1 | 2 | null;
}

export interface DestinatarioNfse {
  tipo: 'cpf' | 'cnpj';
  documento: string;
  nome: string;
  endereco: EnderecoNacionalNfse;
}

export interface ServicoNfse {
  /** Lista nacional, 6 dígitos, com ou sem pontos (`01.07.01`). */
  codigo_tributacao_nacional: string;
  /** Até 2.000 caracteres; aceita quebra de linha. */
  descricao: string;
  codigo_nbs?: string | null;
  codigo_atividade_sn?: string | null;
  /** Omitido: o município da empresa. */
  cod_mun_prestacao?: string | null;
}

export interface IssNfse {
  /** `1` tributável, `4` não incidência. */
  tributacao: 1 | 2 | 3 | 4;
  retido?: boolean;
  /** Alíquota em %, até 2 casas. */
  aliquota?: DecimalNfse | null;
}

export interface ValoresNfse {
  valor_servico: DecimalNfse;
  desconto_incondicionado?: DecimalNfse;
  iss?: IssNfse | null;
  /** Obrigatório para ME/EPP do Simples. */
  percentual_tributos_aproximado?: DecimalNfse | null;
  /** Obrigatório para não optante. */
  tributos_aproximados?: {
    federal: DecimalNfse;
    estadual: DecimalNfse;
    municipal: DecimalNfse;
  } | null;
}

export interface IbsCbsNfse {
  cclass_trib?: string | null;
  cst?: string | null;
  cind_op?: string | null;
  ind_final?: 0 | 1 | null;
  tp_oper?: number | null;
}

export interface BemMovelNfse {
  ncm: string;
  descricao: string;
  quantidade: number;
}

/** Dados da nota, comuns à emissão e à substituição. */
export interface DadosNotaNfse {
  /** `AAAA-MM-DD`. */
  competencia: string;
  tomador: TomadorNfse;
  destinatario?: DestinatarioNfse | null;
  servico: ServicoNfse;
  valores: ValoresNfse;
  ibs_cbs?: IbsCbsNfse | null;
  bens_moveis?: BemMovelNfse[];
  /** De 1 a 20 letras ou números. */
  codigo_interno?: string | null;
}

/** Corpo de `POST /api/nfse/notas`. */
export interface NotaNfseIn extends DadosNotaNfse {
  empresa_id: string;
  ambiente: AmbienteNfse;
  /**
   * O seu id da nota (pedido, venda), até 50 caracteres. Obrigatório em
   * produção (ou use `idempotencyKey`). Garante que o mesmo pedido não vira duas notas.
   */
  referencia?: string | null;
  preset?: PresetNfse | null;
}

/** Corpo de `POST /api/nfse/notas/{id}/substituicao`. Empresa e ambiente vêm da original. */
export interface SubstituicaoNfseIn extends DadosNotaNfse {
  /** Referência da nota NOVA. Obrigatória em produção (ou use `idempotencyKey`). */
  referencia?: string | null;
  /** `01` a `05` ou `99` (outros). */
  motivo: '01' | '02' | '03' | '04' | '05' | '99';
  /** De 15 a 255 caracteres. Obrigatória com motivo `99`. */
  justificativa?: string | null;
}

/** Motivo de rejeição (ou de recusa do cancelamento). */
export interface ErroNotaNfse {
  codigo?: string;
  descricao?: string;
  [extra: string]: unknown;
}

export interface NotaNfse {
  id: string;
  status: StatusNotaNfse;
  ambiente: AmbienteNfse;
  referencia: string | null;
  empresa_id: string;
  dps_id: string;
  /** 50 dígitos, depois de autorizada. */
  chave_acesso: string | null;
  numero_nfse: string | null;
  erros: ErroNotaNfse[] | null;
  /** O primeiro código de `erros`. */
  erro_codigo: string | null;
  avisos: AvisoValidacaoNfse[];
  autorizada_em: string | null;
  cancelada_em: string | null;
  substitui_id: string | null;
  substituida_por_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PaginaNotasNfse {
  itens: NotaNfse[];
  /** Cursor da próxima página; `null` no fim. */
  proximo: string | null;
}

export interface WebhookNfse {
  url: string | null;
  ativo: boolean;
  /** Últimos 4 caracteres do segredo, para conferir qual está em uso. */
  segredo_final: string | null;
  eventos: EventoWebhookNfse[];
}

export interface WebhookNfseConfigurado extends WebhookNfse {
  /** Segredo do HMAC. Só no primeiro cadastro: guarde-o. `null` ao trocar a URL. */
  segredo: string | null;
}

export interface ReenvioWebhookNfse {
  /** Avisos postos de novo na fila (`0`: não havia aviso para mandar). */
  reenfileiradas: number;
}

/** Corpo do aviso que o webhook da emissão recebe: a nota no momento do evento. */
export interface AvisoWebhookNfse extends NotaNfse {
  evento: EventoWebhookNfse;
}
