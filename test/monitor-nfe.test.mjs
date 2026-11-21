// Testes do Monitor de NF-e: assinatura do webhook (vetor fixo) e montagem
// das requisições (fetch simulado, sem rede). Rode com `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FiscalAPI,
  BadRequestError,
  assinarAvisoWebhook,
  verificarAssinaturaWebhook,
} from '../dist/esm/index.js';

const SEGREDO = 'whsec_dGVzdGUtZG8tc2RrLWZpc2NhbGFwaQ';
const TS = 1795294800;
const CORPO =
  '{"id":"evt_0123456789abcdef0123456789abcdef","tipo":"teste","ocorrido_em":"2026-11-21T17:00:00-03:00"}';
const V1 = '8b03e794ca99a1c2c684cf54191aae0af0f7d4e696ef598f9258365861fa8933';
const V1_ANTERIOR = '31ed23b2a446bf7329ed246b1bd0e1a717f11b19244290f3b4c9acb0f3396846';
const CHAVE = '35261111222333000181550010000001231123456787';

const base = { corpo: CORPO, timestamp: String(TS), segredo: SEGREDO, agora: TS + 10 };

test('assinatura: vetor fixo', async () => {
  assert.equal(await assinarAvisoWebhook(SEGREDO, TS, CORPO), V1);
  assert.equal(await assinarAvisoWebhook('whsec_anterior', TS, CORPO), V1_ANTERIOR);
});

test('assinatura: aceita v1 válida, em bytes e entre várias', async () => {
  assert.equal(await verificarAssinaturaWebhook({ ...base, assinatura: `v1=${V1}` }), true);
  assert.equal(
    await verificarAssinaturaWebhook({ ...base, corpo: new TextEncoder().encode(CORPO), assinatura: `v1=${V1}` }),
    true,
  );
  assert.equal(
    await verificarAssinaturaWebhook({ ...base, assinatura: `v1=${V1_ANTERIOR}, v1=${V1}` }),
    true,
  );
});

test('assinatura: recusa corpo, segredo, formato e timestamp errados', async () => {
  const ok = { ...base, assinatura: `v1=${V1}` };
  assert.equal(await verificarAssinaturaWebhook({ ...ok, corpo: CORPO + ' ' }), false);
  assert.equal(await verificarAssinaturaWebhook({ ...ok, segredo: 'whsec_outro' }), false);
  assert.equal(await verificarAssinaturaWebhook({ ...ok, assinatura: V1 }), false);
  assert.equal(await verificarAssinaturaWebhook({ ...ok, assinatura: `v0=${V1}` }), false);
  assert.equal(await verificarAssinaturaWebhook({ ...ok, assinatura: '' }), false);
  assert.equal(await verificarAssinaturaWebhook({ ...ok, timestamp: 'abc' }), false);
  assert.equal(await verificarAssinaturaWebhook({ ...ok, timestamp: String(TS + 1) }), false);
  assert.equal(await verificarAssinaturaWebhook({ ...ok, agora: TS + 301 }), false);
  assert.equal(await verificarAssinaturaWebhook({ ...ok, agora: TS - 301 }), false);
  assert.equal(await verificarAssinaturaWebhook({ ...ok, agora: TS + 301, tolerancia: 600 }), true);
});

function simulado(respostas = []) {
  const chamadas = [];
  const fetch = async (url, init) => {
    chamadas.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    const r = respostas.shift() ?? { status: 200, body: {} };
    return new Response(r.status === 204 ? null : JSON.stringify(r.body), {
      status: r.status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { api: new FiscalAPI('fapi_teste', { fetch, baseUrl: 'https://api.exemplo', maxRetries: 0 }), chamadas };
}

test('cadastrar: corpo com status_conhecido e prazo_dias', async () => {
  const { api, chamadas } = simulado([{ status: 200, body: { resultados: [], aceitas: 1, valor_cobrado: '0,03' } }]);
  const r = await api.cadastrarChavesMonitorNfe({
    chaves: [`NFe ${CHAVE.slice(0, 4)}.${CHAVE.slice(4)}`, { chave: CHAVE, statusConhecido: 'cancelada' }],
    prazoDias: 30,
  });
  assert.equal(r.valor_cobrado, '0,03');
  const c = chamadas[0];
  assert.equal(c.method, 'POST');
  assert.equal(c.url, 'https://api.exemplo/api/monitor-nfe/chaves');
  assert.equal(c.headers['X-API-Key'], 'fapi_teste');
  assert.deepEqual(c.body, {
    chaves: [{ chave: CHAVE }, { chave: CHAVE, status_conhecido: 'cancelada' }],
    prazo_dias: 30,
  });
});

test('cadastrar: valida lote e prazo antes de chamar', async () => {
  const { api, chamadas } = simulado();
  assert.throws(() => api.cadastrarChavesMonitorNfe({ chaves: [] }));
  assert.throws(() => api.cadastrarChavesMonitorNfe({ chaves: Array(1001).fill(CHAVE) }));
  assert.throws(() => api.cadastrarChavesMonitorNfe({ chaves: [CHAVE], prazoDias: 181 }));
  assert.equal(chamadas.length, 0);
});

test('remover em lote, remover uma e detalhe', async () => {
  const { api, chamadas } = simulado([
    { status: 200, body: { removidas: 1, nao_encontradas: [] } },
    { status: 204 },
    { status: 200, body: { chave: CHAVE, eventos: [], entregas_que_falharam: [] } },
  ]);
  await api.removerChavesMonitorNfe({ chaves: [CHAVE] });
  await api.removerChaveMonitorNfe({ chave: CHAVE });
  const d = await api.consultarChaveMonitorNfe({ chave: CHAVE });
  assert.equal(d.chave, CHAVE);
  assert.deepEqual(
    chamadas.map((c) => [c.method, c.url]),
    [
      ['POST', 'https://api.exemplo/api/monitor-nfe/chaves/remover'],
      ['DELETE', `https://api.exemplo/api/monitor-nfe/chaves/${CHAVE}`],
      ['GET', `https://api.exemplo/api/monitor-nfe/chaves/${CHAVE}`],
    ],
  );
  assert.deepEqual(chamadas[0].body, { chaves: [CHAVE] });
});

test('listar: filtros na query e iteração pelo cursor', async () => {
  const { api, chamadas } = simulado([
    { status: 200, body: { itens: [{ chave: 'a' }, { chave: 'b' }], proximo_cursor: 'c1' } },
    { status: 200, body: { itens: [{ chave: 'c' }], proximo_cursor: null } },
  ]);
  const vistos = [];
  for await (const item of api.iterarChavesMonitorNfe({ ativo: true, status: 'cancelada', limite: 2 })) {
    vistos.push(item.chave);
  }
  assert.deepEqual(vistos, ['a', 'b', 'c']);
  assert.equal(chamadas[0].url, 'https://api.exemplo/api/monitor-nfe/chaves?status=cancelada&ativo=true&limite=2');
  assert.equal(chamadas[1].url, 'https://api.exemplo/api/monitor-nfe/chaves?status=cancelada&ativo=true&cursor=c1&limite=2');
});

test('webhook: put, get, delete, rotacionar e teste', async () => {
  const { api, chamadas } = simulado([
    { status: 200, body: { url: 'https://exemplo.com/h', segredo: 'whsec_x' } },
    { status: 200, body: { url: 'https://exemplo.com/h', ativo: true } },
    { status: 200, body: { segredo: 'whsec_y', anterior_valido_ate: '2026-11-22T17:00:00-03:00' } },
    { status: 202, body: { id: 'evt_1', estado: 'pendente' } },
    { status: 204 },
  ]);
  assert.equal((await api.cadastrarWebhookMonitorNfe({ url: ' https://exemplo.com/h ' })).segredo, 'whsec_x');
  assert.equal((await api.consultarWebhookMonitorNfe()).ativo, true);
  assert.equal((await api.rotacionarSegredoWebhookMonitorNfe()).segredo, 'whsec_y');
  assert.equal((await api.testarWebhookMonitorNfe()).estado, 'pendente');
  await api.removerWebhookMonitorNfe();
  assert.deepEqual(
    chamadas.map((c) => [c.method, c.url.replace('https://api.exemplo', '')]),
    [
      ['PUT', '/api/monitor-nfe/webhook'],
      ['GET', '/api/monitor-nfe/webhook'],
      ['POST', '/api/monitor-nfe/webhook/rotacionar-segredo'],
      ['POST', '/api/monitor-nfe/webhook/teste'],
      ['DELETE', '/api/monitor-nfe/webhook'],
    ],
  );
  assert.deepEqual(chamadas[0].body, { url: 'https://exemplo.com/h' });
});

test('404 vira BadRequestError com o código da API', async () => {
  const { api } = simulado([{ status: 404, body: { title: 'WEBHOOK_NAO_CADASTRADO', detail: 'Nenhum webhook cadastrado.' } }]);
  await assert.rejects(api.consultarWebhookMonitorNfe(), (err) => {
    assert.ok(err instanceof BadRequestError);
    assert.equal(err.status, 404);
    assert.equal(err.code, 'WEBHOOK_NAO_CADASTRADO');
    return true;
  });
});
