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
