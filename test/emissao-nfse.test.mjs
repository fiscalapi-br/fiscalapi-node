// Testes da Emissão de NFS-e: montagem das requisições (fetch simulado, sem
// rede) e a assinatura do webhook com o vetor da documentação. Rode com `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FiscalAPI,
  BadRequestError,
  RateLimitError,
  ServerError,
  verificarAssinaturaWebhook,
} from '../dist/esm/index.js';

// Empresa fictícia da documentação (CNPJ com DV válido, não é de cliente).
const EMPRESA_ID = '8f1c2a4e-5b6d-4e7f-9a0b-1c2d3e4f5a6b';
const NOTA_ID = '3b8e2f4a-6c1d-4e9f-8a7b-2c3d4e5f6a7b';

const NOTA = {
  empresa_id: EMPRESA_ID,
  ambiente: 'homologacao',
  referencia: 'teste-0001',
  preset: 'simples_servico',
  competencia: '2026-11-22',
  tomador: { tipo: 'cnpj', documento: '12.345.678/0001-95', nome: 'Cliente Exemplo Comercio Ltda' },
  servico: { codigo_tributacao_nacional: '01.07.01', descricao: 'Suporte técnico em informática' },
  valores: { valor_servico: '1500.00', percentual_tributos_aproximado: '6.00' },
};

function simulado(respostas = []) {
  const chamadas = [];
  const fetch = async (url, init) => {
    let body = init.body;
    if (typeof body === 'string') body = JSON.parse(body);
    chamadas.push({ url, method: init.method, headers: init.headers, body });
    const r = respostas.shift() ?? { status: 200, body: {} };
    const headers = { 'content-type': r.contentType ?? 'application/json', ...(r.headers ?? {}) };
    let payload = null;
    if (r.raw !== undefined) payload = r.raw;
    else if (r.status !== 204) payload = JSON.stringify(r.body);
    return new Response(payload, { status: r.status, headers });
  };
  const api = new FiscalAPI('fapi_teste', { fetch, baseUrl: 'https://api.exemplo', maxRetries: 0 });
  return { api, chamadas, fetch };
}

const caminhos = (chamadas) => chamadas.map((c) => [c.method, c.url.replace('https://api.exemplo', '')]);

test('empresas: criar, listar, obter e atualizar', async () => {
  const { api, chamadas } = simulado([
    { status: 201, body: { id: EMPRESA_ID, verificada: true } },
    { status: 200, body: [{ id: EMPRESA_ID }] },
    { status: 200, body: { id: EMPRESA_ID } },
    { status: 200, body: { id: EMPRESA_ID, ativa: false } },
  ]);
  const empresa = {
    cnpj: '11.222.333/0001-81',
    razao_social: 'Exemplo Servicos de Tecnologia Ltda',
    im: '123456',
    cod_mun_ibge: '4106902',
    regime: { op_simp_nac: 3, reg_ap_trib_sn: 1 },
    serie: '00001',
  };
  assert.equal((await api.criarEmpresaNfse(empresa)).verificada, true);
  const lista = await api.listarEmpresasNfse();
  assert.ok(Array.isArray(lista));
  assert.equal(lista[0].id, EMPRESA_ID);
  await api.obterEmpresaNfse({ empresaId: EMPRESA_ID });
  assert.equal((await api.atualizarEmpresaNfse({ empresaId: EMPRESA_ID, mudancas: { ativa: false } })).ativa, false);
  assert.deepEqual(caminhos(chamadas), [
    ['POST', '/api/nfse/empresas'],
    ['GET', '/api/nfse/empresas'],
    ['GET', `/api/nfse/empresas/${EMPRESA_ID}`],
    ['PATCH', `/api/nfse/empresas/${EMPRESA_ID}`],
  ]);
  assert.deepEqual(chamadas[0].body, empresa);
  assert.deepEqual(chamadas[3].body, { ativa: false });
  assert.equal(chamadas[0].headers['Content-Type'], 'application/json');
  assert.throws(() => api.atualizarEmpresaNfse({ empresaId: EMPRESA_ID, mudancas: {} }));
  assert.throws(() => api.obterEmpresaNfse({ empresaId: ' ' }));
});

test('certificado: multipart com o arquivo e a senha; excluir pela raiz', async () => {
  const { api, chamadas } = simulado([
    { status: 200, body: { id: 'c1', cnpj_raiz: '11222333' } },
    { status: 200, body: { id: 'c2' } },
    { status: 204 },
    { status: 204 },
  ]);
  const pfx = new Uint8Array([0x30, 0x82, 0x01, 0x02]);
  assert.equal((await api.enviarCertificadoNfse({ certificado: pfx, senha: 's3nha' })).cnpj_raiz, '11222333');
  const c = chamadas[0];
  assert.equal(c.method, 'PUT');
  assert.equal(c.url, 'https://api.exemplo/api/nfse/certificados');
  assert.ok(c.body instanceof FormData);
  assert.equal(c.headers['Content-Type'], undefined, 'o fetch põe o boundary');
  assert.equal(c.body.get('senha'), 's3nha');
  const arquivo = c.body.get('certificado');
  assert.equal(arquivo.name, 'certificado.pfx');
  assert.deepEqual(new Uint8Array(await arquivo.arrayBuffer()), pfx);

  // base64 também é aceito
  await api.enviarCertificadoNfse({ certificado: Buffer.from(pfx).toString('base64'), nomeArquivo: 'empresa.pfx' });
  const outro = chamadas[1].body.get('certificado');
  assert.equal(outro.name, 'empresa.pfx');
  assert.deepEqual(new Uint8Array(await outro.arrayBuffer()), pfx);
  assert.equal(chamadas[1].body.get('senha'), '');

  await api.excluirCertificadoNfse({ raiz: '11.222.333' });
  await api.excluirCertificadoNfse({ raiz: '11.222.333/0001-81' });
  assert.deepEqual(caminhos(chamadas.slice(2)), [
    ['DELETE', '/api/nfse/certificados/11222333'],
    ['DELETE', '/api/nfse/certificados/11222333'],
  ]);
  await assert.rejects(api.excluirCertificadoNfse({ raiz: '123' }));
});

test('emitir: corpo da nota, Idempotency-Key e validação da referência', async () => {
  const { api, chamadas } = simulado([
    { status: 202, body: { id: NOTA_ID, status: 'pendente' } },
    { status: 202, body: { id: NOTA_ID, status: 'pendente' }, headers: { 'idempotent-replayed': 'true' } },
  ]);
  const nota = await api.emitirNfse(NOTA);
  assert.equal(nota.status, 'pendente');
  assert.deepEqual(chamadas[0].body, NOTA);
  assert.equal(chamadas[0].headers['Idempotency-Key'], undefined);

  const prod = { ...NOTA, ambiente: 'producao', referencia: undefined };
  await api.emitirNfse(prod, { idempotencyKey: 'pedido-1001' });
  assert.equal(chamadas[1].headers['Idempotency-Key'], 'pedido-1001');
  assert.deepEqual(caminhos(chamadas), [
    ['POST', '/api/nfse/notas'],
    ['POST', '/api/nfse/notas'],
  ]);

  assert.throws(() => api.emitirNfse(prod), /referencia/);
  assert.throws(() => api.emitirNfse({ ...NOTA, referencia: 'a' }, { idempotencyKey: 'b' }), /diferentes/);
  assert.equal(chamadas.length, 2);
});

test('emitir: com referência repete em 5xx; sem referência, não', async () => {
  const respostas = [
    { status: 503, body: { title: 'FEATURE_UNDER_REVIEW' } },
    { status: 202, body: { id: NOTA_ID, status: 'pendente' } },
  ];
  const chamadas = [];
  const fetch = async (url, init) => {
    chamadas.push(init.method);
    const r = respostas.shift();
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'retry-after': '0' } });
  };
  const api = new FiscalAPI('fapi_teste', { fetch, baseUrl: 'https://api.exemplo', maxRetries: 1 });
  assert.equal((await api.emitirNfse(NOTA)).id, NOTA_ID);
  assert.equal(chamadas.length, 2);

  respostas.push({ status: 503, body: { title: 'FEATURE_UNDER_REVIEW' } });
  await assert.rejects(api.emitirNfse({ ...NOTA, referencia: undefined }), ServerError);
  assert.equal(chamadas.length, 3);
});

test('429 do limite de homologação não é repetido', async () => {
  let n = 0;
  const fetch = async () => {
    n++;
    return new Response(JSON.stringify({ title: 'NFSE_HOMOLOG_LIMITE', status: 429, detail: 'Limite do mês.' }), {
      status: 429,
      headers: { 'retry-after': '0' },
    });
  };
  const api = new FiscalAPI('fapi_teste', { fetch, baseUrl: 'https://api.exemplo', maxRetries: 3 });
  await assert.rejects(api.emitirNfse(NOTA), (err) => {
    assert.ok(err instanceof RateLimitError);
    assert.equal(err.code, 'NFSE_HOMOLOG_LIMITE');
    return true;
  });
  assert.equal(n, 1);
});

test('notas: obter, listar com filtros, iterar pelo cursor, cancelar e substituir', async () => {
  const { api, chamadas } = simulado([
    { status: 200, body: { id: NOTA_ID, status: 'autorizada' } },
    { status: 200, body: { itens: [{ id: 'a' }, { id: 'b' }], proximo: 'c1' } },
    { status: 200, body: { itens: [{ id: 'c' }], proximo: null } },
    { status: 202, body: { id: NOTA_ID, status: 'cancelando' } },
    { status: 202, body: { id: 'nova', substitui_id: NOTA_ID } },
  ]);
  assert.equal((await api.obterNfse({ notaId: NOTA_ID })).status, 'autorizada');
  const vistos = [];
  for await (const n of api.iterarNfse({
    ambiente: 'producao',
    status: 'autorizada',
    atualizadaDesde: new Date('2026-11-22T03:00:00Z'),
    limite: 2,
  })) {
    vistos.push(n.id);
  }
  assert.deepEqual(vistos, ['a', 'b', 'c']);
  const cancel = await api.cancelarNfse({
    notaId: NOTA_ID,
    motivo: 1,
    justificativa: ' Valor do serviço informado errado na nota. ',
  });
  assert.equal(cancel.status, 'cancelando');
  const subst = {
    referencia: 'pedido-1001-v2',
    motivo: '99',
    justificativa: 'Descrição do serviço corrigida a pedido do cliente.',
    competencia: '2026-11-20',
    tomador: NOTA.tomador,
    servico: NOTA.servico,
    valores: { ...NOTA.valores, iss: { tributacao: 1 } },
  };
  assert.equal((await api.substituirNfse({ notaId: NOTA_ID, substituicao: subst })).substitui_id, NOTA_ID);

  const desde = encodeURIComponent('2026-11-22T03:00:00.000Z');
  assert.deepEqual(caminhos(chamadas), [
    ['GET', `/api/nfse/notas/${NOTA_ID}`],
    ['GET', `/api/nfse/notas?status=autorizada&ambiente=producao&atualizada_desde=${desde}&limite=2`],
    ['GET', `/api/nfse/notas?status=autorizada&ambiente=producao&atualizada_desde=${desde}&cursor=c1&limite=2`],
    ['POST', `/api/nfse/notas/${NOTA_ID}/cancelamento`],
    ['POST', `/api/nfse/notas/${NOTA_ID}/substituicao`],
  ]);
  assert.deepEqual(chamadas[3].body, { motivo: 1, justificativa: 'Valor do serviço informado errado na nota.' });
  assert.deepEqual(chamadas[4].body, subst);

  assert.throws(() => api.cancelarNfse({ notaId: NOTA_ID, motivo: 1, justificativa: 'curta' }));
  assert.throws(() => api.listarNfse({ limite: 101 }));
});

test('XML e PDF: devolve o conteúdo; erro em JSON vira exceção', async () => {
  const xml = '<?xml version="1.0" encoding="UTF-8"?><NFSe><infNFSe Id="NFS4106"/></NFSe>';
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  const { api, chamadas } = simulado([
    { status: 200, raw: xml, contentType: 'application/xml' },
    { status: 200, raw: pdf, contentType: 'application/pdf' },
    { status: 409, body: { title: 'NFSE_NOTA_SEM_XML', status: 409, detail: 'A nota ainda não foi autorizada.' } },
  ]);
  assert.equal(await api.baixarXmlNfse({ notaId: NOTA_ID }), xml);
  assert.deepEqual(await api.baixarPdfNfse({ notaId: NOTA_ID }), pdf);
  await assert.rejects(api.baixarPdfNfse({ notaId: NOTA_ID }), (err) => {
    assert.ok(err instanceof BadRequestError);
    assert.equal(err.status, 409);
    assert.equal(err.code, 'NFSE_NOTA_SEM_XML');
    return true;
  });
  assert.deepEqual(caminhos(chamadas), [
    ['GET', `/api/nfse/notas/${NOTA_ID}/xml`],
    ['GET', `/api/nfse/notas/${NOTA_ID}/pdf`],
    ['GET', `/api/nfse/notas/${NOTA_ID}/pdf`],
  ]);
});

test('webhook: configurar, obter, reenviar e remover', async () => {
  const { api, chamadas } = simulado([
    { status: 200, body: { url: 'https://seu-sistema.com.br/webhooks/nfse', ativo: true, segredo: 'whsec_x' } },
    { status: 200, body: { url: 'https://seu-sistema.com.br/webhooks/nfse', ativo: true, segredo_final: 'Y2Fv' } },
    { status: 202, body: { reenfileiradas: 1 } },
    { status: 204 },
  ]);
  assert.equal((await api.configurarWebhookNfse({ url: ' https://seu-sistema.com.br/webhooks/nfse ' })).segredo, 'whsec_x');
  assert.equal((await api.obterWebhookNfse()).segredo_final, 'Y2Fv');
  assert.equal((await api.reenviarWebhookNfse({ notaId: NOTA_ID })).reenfileiradas, 1);
  await api.removerWebhookNfse();
  assert.deepEqual(caminhos(chamadas), [
    ['PUT', '/api/nfse/webhook'],
    ['GET', '/api/nfse/webhook'],
    ['POST', `/api/nfse/notas/${NOTA_ID}/webhook`],
    ['DELETE', '/api/nfse/webhook'],
  ]);
  assert.deepEqual(chamadas[0].body, { url: 'https://seu-sistema.com.br/webhooks/nfse' });
});

test('assinatura do aviso da emissão: vetor da documentação', async () => {
  const corpo =
    '{"id":"3b8e2f4a-6c1d-4e9f-8a7b-2c3d4e5f6a7b","status":"autorizada","ambiente":"homologacao","evento":"autorizada"}';
  const params = {
    corpo,
    timestamp: '1795439400',
    assinatura: 'v1=0c95c6c219de4c9a004efd0b8896f1e8e0d36bd373d86eb859f65506d5c0b9ed',
    segredo: 'whsec_RXhlbXBsbyBkZSBzZWdyZWRvLCBuYW8gdXNlIGVtIHByb2R1Y2Fv',
    agora: 1795439400,
  };
  assert.equal(await verificarAssinaturaWebhook(params), true);
  assert.equal(await verificarAssinaturaWebhook({ ...params, corpo: corpo.replace('homologacao', 'producao') }), false);
  assert.equal(await verificarAssinaturaWebhook({ ...params, agora: 1795439400 + 301 }), false);
});
