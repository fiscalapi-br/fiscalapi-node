# FiscalAPI SDK Node.js / TypeScript

SDK oficial em Node.js e TypeScript da [FiscalAPI](https://fiscalapi.com.br) para consultar inscrição estadual (SINTEGRA) nos 27 estados, CNPJ na Receita Federal, Simples Nacional, certidões (CND estadual, CND Federal, CNDT, CRF/FGTS), XML de NF-e e de CT-e pela chave e imóvel rural no CNIR/CAFIR e no SIGEF. O Monitor de NF-e acompanha a nota pela chave, sem certificado, e avisa no seu webhook quando ela é cancelada.

Cobre também NFS-e por chave, DIFAL de saída por UF, emissão de NFS-e Nacional e perfil do produtor rural. Pacote `fiscalapi-br` no npm. Documentação: [docs.fiscalapi.com.br](https://docs.fiscalapi.com.br) e [guia Node.js](https://docs.fiscalapi.com.br/docs/guias/node-lote).

- Zero dependências: usa o `fetch` nativo (Node 18+, Bun, Deno, edge runtimes).
- Tipado em TypeScript, com ESM e CommonJS.
- Novas tentativas automáticas em `429` e em falhas temporárias.
- Erros tipados para chave inválida, falta de saldo e limite de requisições.

## Instalação

```bash
npm install fiscalapi-br
```

## Antes de começar

1. Crie sua conta em [app.fiscalapi.com.br](https://app.fiscalapi.com.br) e copie a chave de API no painel.
2. **Plano ou recarga:** pela API, toda consulta pede plano ou saldo, a partir de R$ 50 por mês. As 10 consultas grátis do mês são só no painel: teste lá antes de assinar. Sem plano nem saldo, a API responde `402` (`InsufficientBalanceError`). Sem chave, `403` (`AuthenticationError`).
3. Planos e consumo de créditos: [docs.fiscalapi.com.br](https://docs.fiscalapi.com.br/docs/referencia/plans-and-limits).

> Não use a chave de API no navegador: ela daria acesso ao seu saldo a qualquer visitante. Chame a FiscalAPI a partir do seu servidor.

## Uso rápido

```ts
import { FiscalAPI } from 'fiscalapi-br';

const api = new FiscalAPI('sua-chave'); // ou defina FISCALAPI_API_KEY

// CNPJ na Receita Federal
const empresa = await api.consultarCnpj({ cnpj: '68178106000113' });
console.log(empresa.result?.razao_social, empresa.result?.situacao_cadastral);

// Inscrição estadual de um produtor rural pelo CPF, em MT (CPF fictício)
const resp = await api.consultarIe({ uf: 'MT', cpf: '52998224725' });
for (const ie of resp.results) {
  console.log(ie.inscricao_estadual, ie.situacao_ie, ie.municipio);
}
```

CommonJS:

```js
const { FiscalAPI } = require('fiscalapi-br');
```

## Métodos

| Método | Endpoint | O que retorna |
|---|---|---|
| `consultarIe({ uf, cpf \| cnpj \| ie, secundarias? })` | `GET /api/consultar` | Inscrições estaduais em uma UF |
| `consultarIeTodos({ cpf \| cnpj \| ie, secundarias? })` | `GET /api/consultar-ie-todos` | Inscrições em todos os estados |
| `consultarCnpj({ cnpj, forceFresh? })` | `GET /api/consultar-cnpj` | Dados cadastrais da Receita Federal |
| `consultarCnd({ uf, cpf \| cnpj })` | `GET /api/consultar-cnd` | CND estadual (ICMS) com PDF |
| `consultarCndTodos({ cpf \| cnpj })` | `GET /api/consultar-cnd-todos` | CND estadual em todos os estados disponíveis |
| `consultarCndFederal({ cnpj \| cpf + dataNascimento, emitirNova? })` | `GET /api/consultar-cnd-federal` | CND Federal (Receita Federal + PGFN) |
| `consultarCndt({ cpf \| cnpj })` | `GET /api/consultar-cndt` | Certidão de débitos trabalhistas |
| `consultarCrfFgts({ cpf \| cnpj })` | `GET /api/consultar-crf-fgts` | Regularidade do FGTS |
| `consultarCertidoesTodas({ cpf \| cnpj, skipEstaduais? })` | `GET /api/certidoes-todas` | Todas as certidões em uma chamada |
| `consultarSimplesNacional({ cnpj })` | `GET /api/consultar-simples-nacional` | Situação no Simples Nacional e SIMEI |
| `consultarNfse({ chave, danfse? })` | `GET /api/consultar-nfse` | NFS-e (padrão nacional) por chave, sem certificado |
| `consultarNfeXml({ chave, certificado, senha, manifestar? })` | `POST /api/consultar-nfe-xml` | XML completo da NF-e |
| `consultarCteXml({ chave, certificado, senha })` | `POST /api/consultar-cte-xml` | XML completo do CT-e |
| `cadastrarChavesMonitorNfe({ chaves, prazoDias? })` | `POST /api/monitor-nfe/chaves` | Coloca até 1.000 chaves no Monitor de NF-e |
| `removerChavesMonitorNfe({ chaves })` / `removerChaveMonitorNfe({ chave })` | `POST /api/monitor-nfe/chaves/remover` / `DELETE /api/monitor-nfe/chaves/{chave}` | Para de monitorar |
| `listarChavesMonitorNfe({ status?, ativo?, alteradoDesde?, cursor?, limite? })` / `iterarChavesMonitorNfe(...)` | `GET /api/monitor-nfe/chaves` | Chaves monitoradas (uma página / todas) |
| `consultarChaveMonitorNfe({ chave })` | `GET /api/monitor-nfe/chaves/{chave}` | Situação, eventos e entregas que falharam |
| `cadastrarWebhookMonitorNfe({ url })`, `consultarWebhookMonitorNfe()`, `removerWebhookMonitorNfe()`, `rotacionarSegredoWebhookMonitorNfe()`, `testarWebhookMonitorNfe()` | `/api/monitor-nfe/webhook` | Webhook dos avisos |
| `criarEmpresaNfse(empresa)`, `listarEmpresasNfse()`, `obterEmpresaNfse({ empresaId })`, `atualizarEmpresaNfse({ empresaId, mudancas })` | `/api/nfse/empresas` | Empresas emissoras de NFS-e |
| `enviarCertificadoNfse({ certificado, senha })` / `excluirCertificadoNfse({ raiz })` | `PUT /api/nfse/certificados` / `DELETE /api/nfse/certificados/{raiz}` | Certificado A1 da empresa (multipart) |
| `emitirNfse(nota, { idempotencyKey? })` | `POST /api/nfse/notas` | Emite NFS-e (assíncrono, `202`) |
| `obterNfse({ notaId })`, `listarNfse({ status?, ambiente?, referencia?, atualizadaDesde?, cursor?, limite? })` / `iterarNfse(...)` | `GET /api/nfse/notas` | NFS-e emitidas (uma / uma página / todas) |
| `cancelarNfse({ notaId, motivo, justificativa })`, `substituirNfse({ notaId, substituicao })` | `POST /api/nfse/notas/{id}/cancelamento` e `/substituicao` | Cancela ou substitui |
| `baixarXmlNfse({ notaId })` / `baixarPdfNfse({ notaId })` | `GET /api/nfse/notas/{id}/xml` e `/pdf` | XML autorizado (string) e DANFSe (bytes) |
| `configurarWebhookNfse({ url })`, `obterWebhookNfse()`, `removerWebhookNfse()`, `reenviarWebhookNfse({ notaId })` | `/api/nfse/webhook` | Webhook da emissão |
| `consultarDifalSaida({ certificado, senha, competencia, ufs? })` | `POST /api/consultar-difal-saida` | DIFAL de saída por UF de destino (Beta) |
| `consultarSigef({ cpf \| cnpj })` | `GET /api/consultar-sigef` | Parcelas certificadas no SIGEF/INCRA |
| `consultarSigefParcela({ uuid, forceFresh? })` | `GET /api/consultar-sigef-parcela` | Uma parcela com polígono, vértices e confrontantes |
| `consultarCnir({ cpf \| cnpj })` | `GET /api/consultar-cnir` | Imóveis rurais no CNIR/CAFIR |
| `perfilProdutor({ cpf \| cnpj })` | `GET /api/perfil-produtor` | Perfil consolidado do produtor |

Informe **um** documento por chamada. Pontuação é aceita. As respostas trazem o JSON completo da API, com tipos exportados (`ConsultaIEResponse`, `CNDResponse`, `NfeXmlResponse`, `CteXmlResponse`, `DifalSaidaResponse` etc.).

## Exemplos

### Inscrição Estadual em todos os estados

```ts
const resp = await api.consultarIeTodos({ cnpj: '12.345.678/0001-95' });
if (resp.complete === false) {
  console.warn('Algum estado não respondeu; tente de novo antes de concluir que não há IE.');
}
for (const uf of resp.results) {
  for (const ie of uf.results) console.log(uf.uf, ie.inscricao_estadual, ie.situacao_ie);
}
```

### CNPJ

```ts
const empresa = await api.consultarCnpj({ cnpj: '12345678000195' });
console.log(empresa.result?.razao_social, empresa.result?.situacao_cadastral);

// Dado atual, sem cache (consome mais créditos):
await api.consultarCnpj({ cnpj: '12345678000195', forceFresh: true });
```

### Simples Nacional

```ts
const r = await api.consultarSimplesNacional({ cnpj: '11222333000181' });
console.log(r.optante_simples, r.situacao_simei, r.regime_regular_ibs);
```

### NFS-e por chave

```ts
const nfse = await api.consultarNfse({
  chave: '35503082211222333000181000000000012326100000045676',
  danfse: true, // opcional: PDF do DANFSe em base64
});
console.log(nfse.emitente?.razao_social, nfse.tributacao_municipal?.valor_servico);
```

Uma consulta nova leva de 30 a 60 segundos. Só a NFS-e entregue é cobrada.

### Certidões com PDF

```ts
import { writeFile } from 'node:fs/promises';

const cnd = await api.consultarCnd({ uf: 'MT', cpf: '12345678909' });
console.log(cnd.result?.status, cnd.result?.validade_iso);
if (cnd.result?.pdf_base64) {
  await writeFile('cnd-mt.pdf', Buffer.from(cnd.result.pdf_base64, 'base64'));
}

const federal = await api.consultarCndFederal({ cnpj: '12345678000195' });
// CPF: a Receita exige a data de nascimento (DD/MM/AAAA ou AAAA-MM-DD)
const federalPf = await api.consultarCndFederal({ cpf: '12345678909', dataNascimento: '12/04/1985' });
const trabalhista = await api.consultarCndt({ cnpj: '12345678000195' });
const fgts = await api.consultarCrfFgts({ cnpj: '12345678000195' });
```

O campo `status` vem como `negativa`, `positiva`, `positiva_com_efeitos_de_negativa`, `nao_contribuinte`, `sem_certidao` ou `erro`.

### XML de NF-e por chave

```ts
import { readFile, writeFile } from 'node:fs/promises';

const resp = await api.consultarNfeXml({
  chave: '35260112345678000195550010000012341000012345',
  certificado: await readFile('certificado.pfx'), // bytes ou string base64
  senha: 'senha-do-certificado',
});
const nota = resp.resultados[0];
if (nota.status === 'ok' && nota.xml) {
  await writeFile(`${nota.chave}.xml`, nota.xml, 'utf8');
} else {
  console.log(nota.status, nota.mensagem);
}
```

O certificado A1 precisa ser de um participante da nota (emitente, destinatário, transportador ou autorizado) e **não é armazenado** pela API. Só há cobrança quando o XML é devolvido.

### XML de CT-e por chave

```ts
import { readFile, writeFile } from 'node:fs/promises';

const cte = await api.consultarCteXml({
  chave: '51261011222333000181570010000001231123456784',
  certificado: await readFile('certificado.pfx'), // bytes ou string base64
  senha: 'senha-do-certificado',
});
if (cte.status === 'ok' && cte.xml) {
  await writeFile(`${cte.chave}.xml`, cte.xml, 'utf8');
} else {
  console.log(cte.status, cte.mensagem);
}
```

Aceita CT-e (modelo 57), CT-e OS (67) e GTV-e (64). O certificado A1 precisa ser de um participante do documento (emitente, tomador, remetente, destinatário, expedidor ou recebedor) e **não é armazenado** pela API. Só há cobrança quando o XML é devolvido.

### Monitor de NF-e por chave

Cadastre as chaves e a FiscalAPI acompanha cada nota na SEFAZ por até 180 dias. Quando a nota é cancelada, denegada ou recebe um evento (carta de correção, por exemplo), chega um aviso no seu webhook. Sem certificado.

```ts
// 1. Webhook (uma vez). Guarde o segredo: ele só volta aqui.
const { segredo } = await api.cadastrarWebhookMonitorNfe({ url: 'https://seu-sistema.com/fiscalapi/avisos' });

// 2. Chaves: até 1.000 por chamada
const r = await api.cadastrarChavesMonitorNfe({
  chaves: ['35261111222333000181550010000001231123456787'],
  prazoDias: 180, // opcional, de 1 a 180
});
console.log(r.aceitas, r.valor_cobrado);
for (const item of r.resultados.filter((x) => x.situacao === 'invalida')) console.log(item.chave, item.motivo);

// 3. Consultar e listar
const nota = await api.consultarChaveMonitorNfe({ chave: '35261111222333000181550010000001231123456787' });
for await (const item of api.iterarChavesMonitorNfe({ alteradoDesde: '2026-11-21T00:00:00-03:00' })) {
  console.log(item.chave, item.status, item.entregas_falhas);
}
```

Cobra uma vez por chave aceita. Chave já monitorada não é cobrada de novo; chave inválida volta com `motivo` e não é cobrada. Sem saldo para todas, `402` e nenhuma entra.

**Receber o aviso.** Confira a assinatura com o corpo **bruto** (antes do `JSON.parse`):

```ts
import express from 'express';
import { verificarAssinaturaWebhook } from 'fiscalapi-br';

app.post('/fiscalapi/avisos', express.raw({ type: 'application/json' }), async (req, res) => {
  const ok = await verificarAssinaturaWebhook({
    corpo: req.body, // Buffer com os bytes recebidos
    assinatura: req.get('X-FiscalAPI-Assinatura'),
    timestamp: req.get('X-FiscalAPI-Timestamp'),
    segredo: process.env.FISCALAPI_WEBHOOK_SEGREDO!,
    // tolerancia: 300 (padrão, em segundos)
  });
  if (!ok) return res.sendStatus(401);
  const aviso = JSON.parse(req.body.toString('utf8'));
  // deduplique por aviso.id: a entrega é "pelo menos uma vez"
  res.sendStatus(200); // responda 2xx em até 10 s
});
```

A assinatura é `v1=` + HMAC-SHA256 do segredo inteiro (`whsec_...`) sobre `"{timestamp}." + corpo`. Depois de `rotacionarSegredoWebhookMonitorNfe()`, o cabeçalho traz `v1=nova,v1=anterior` por 24 h: o helper aceita qualquer uma. Tipos de aviso: `nfe.status_alterado`, `nfe.evento_registrado`, `nfe.monitoramento_encerrado` e `teste`. Detalhes: [documentação](https://docs.fiscalapi.com.br).

### Emissão de NFS-e Nacional

Emita a NFS-e do padrão nacional pela sua empresa, assinada com o certificado A1 dela. A nota é processada em segundos e o resultado chega por webhook. Homologação é grátis (1.000 notas por mês); em produção, só a nota autorizada é cobrada.

**Primeira nota (homologação):**

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { FiscalAPI } from 'fiscalapi-br';

const api = new FiscalAPI(process.env.FISCALAPI_API_KEY!);

// 1. Certificado A1 (e-CNPJ ICP-Brasil) da empresa, uma vez
await api.enviarCertificadoNfse({
  certificado: await readFile('empresa.pfx'),
  senha: process.env.SENHA_CERTIFICADO,
});

// 2. Empresa emissora (fictícia: troque pelos dados da sua)
const empresa = await api.criarEmpresaNfse({
  cnpj: '11.222.333/0001-81',
  razao_social: 'Exemplo Servicos de Tecnologia Ltda',
  im: '123456',
  cod_mun_ibge: '4106902', // Curitiba
  regime: { op_simp_nac: 3, reg_ap_trib_sn: 1 }, // ME/EPP do Simples
  serie: '00001',
});

// 3. Webhook (opcional). O segredo só volta no primeiro cadastro: guarde-o.
const { segredo } = await api.configurarWebhookNfse({ url: 'https://seu-sistema.com.br/webhooks/nfse' });

// 4. Emita
const nota = await api.emitirNfse({
  empresa_id: empresa.id,
  ambiente: 'homologacao',
  referencia: 'teste-0001', // o seu id do pedido; obrigatório em produção
  preset: 'simples_servico',
  competencia: '2026-11-22',
  tomador: { tipo: 'cnpj', documento: '12.345.678/0001-95', nome: 'Cliente Exemplo Comercio Ltda' },
  servico: {
    codigo_tributacao_nacional: '01.07.01',
    descricao: 'Suporte técnico em informática, novembro de 2026',
  },
  valores: { valor_servico: '1500.00', percentual_tributos_aproximado: '6.00' },
});
console.log(nota.id, nota.status); // "pendente"; avisos em nota.avisos

// 5. Sem webhook, consulte
const atual = await api.obterNfse({ notaId: nota.id });
if (atual.status === 'autorizada') {
  await writeFile('danfse.pdf', await api.baixarPdfNfse({ notaId: nota.id }));
  await writeFile('nfse.xml', await api.baixarXmlNfse({ notaId: nota.id }), 'utf8');
} else if (atual.status === 'rejeitada') {
  console.log(atual.erros); // [{ codigo, descricao }]
}
```

Para produção, troque `ambiente` para `'producao'` e mande sempre a `referencia` (ou `{ idempotencyKey }` no segundo argumento): repetir o mesmo pedido devolve a nota que já existe, sem emitir outra. Com ela, o SDK também repete a chamada em falha de rede e `5xx`. Sem nenhuma das duas, `emitirNfse` em produção lança erro antes de chamar a API.

**Cancelar, substituir e sincronizar:**

```ts
await api.cancelarNfse({ notaId, motivo: 1, justificativa: 'Valor do serviço informado errado na nota.' });

const nova = await api.substituirNfse({
  notaId,
  substituicao: { referencia: 'pedido-1001-v2', motivo: '99', justificativa: 'Descrição corrigida a pedido do cliente.',
    competencia: '2026-11-20', tomador, servico, valores: { ...valores, iss: { tributacao: 1 } } },
});

for await (const n of api.iterarNfse({ ambiente: 'producao', atualizadaDesde: ultimoUpdatedAt })) {
  // trate repetidos pelo id
}
```

**Receber o aviso.** O webhook da emissão usa o mesmo esquema de assinatura do Monitor de NF-e, e o mesmo helper serve:

```ts
app.post('/webhooks/nfse', express.raw({ type: 'application/json' }), async (req, res) => {
  const ok = await verificarAssinaturaWebhook({
    corpo: req.body, // Buffer com os bytes recebidos
    assinatura: req.get('X-FiscalAPI-Assinatura'),
    timestamp: req.get('X-FiscalAPI-Timestamp'),
    segredo: process.env.FISCALAPI_NFSE_WEBHOOK_SEGREDO!,
  });
  if (!ok) return res.sendStatus(401);
  const aviso: AvisoWebhookNfse = JSON.parse(req.body.toString('utf8'));
  // aviso.evento: autorizada, rejeitada, cancelada, substituida ou cancelamento_recusado
  // deduplique por X-FiscalAPI-Entrega + aviso.updated_at; filtre por aviso.ambiente
  res.sendStatus(204); // responda 2xx em até 10 s
});
```

Erros da API chegam com o código em `err.code` (ex.: `NFSE_DADOS_INVALIDOS`, com a lista em `err.body.erros`; `NFSE_REFERENCIA_EM_USO`; `NFSE_TERMOS_PENDENTES`). Campos, presets, IBS/CBS e a tabela de erros: [documentação da emissão](https://docs.fiscalapi.com.br/docs/emissao-nfse/visao-geral).

### DIFAL de saída por UF de destino (Beta)

```ts
import { readFile } from 'node:fs/promises';

const difal = await api.consultarDifalSaida({
  certificado: await readFile('certificado-do-emitente.pfx'), // bytes ou string base64
  senha: 'senha-do-certificado',
  competencia: '2026-10',
  ufs: ['RS', 'SC'], // omita para as 10 UFs
});
for (const uf of difal.ufs) {
  console.log(uf.uf, uf.status, uf.valor_em_aberto);
  for (const nota of uf.notas.filter((n) => n.em_aberto)) {
    console.log('  ', nota.serie, nota.numero, nota.situacao_guia_difal, nota.valor_em_aberto);
  }
}
if (!difal.completo) console.log('Alguma UF não veio completa: os totais podem estar incompletos.');
```

Lista as NF-e do mês com DIFAL e FCP destacados, a situação da guia de cada nota e o valor em aberto, nas UFs de destino AC, AP, DF, GO, MS, MT, RR, RS, SC e SE. O certificado A1 é o do **emitente** das notas e **não é armazenado** pela API. Só `paga` quita: `sem_guia_no_portal`, `pendente_pagamento` e `geracao_rejeitada` somam em `valor_em_aberto`, menos em DF, GO e MT, onde a guia é emitida no sistema da SEFAZ e a nota `sem_guia_no_portal` soma em `valor_a_conferir`. Cobra 1 consulta por UF com `status: 'ok'`. Guia emitida fora do portal (ERP, Portal GNRE) não aparece. Detalhes: [documentação](https://docs.fiscalapi.com.br/docs/difal/consultar-difal-saida).

### Imóvel rural

```ts
const sigef = await api.consultarSigef({ cpf: '12345678909' });
for (const p of sigef.result?.parcelas ?? []) {
  console.log(p.denominacao, p.area_ha, p.municipio, p.uf);
}

const parcela = await api.consultarSigefParcela({ uuid: '0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b' });
console.log(parcela.result?.geometria_wkt);

const cnir = await api.consultarCnir({ cpf: '12345678909' });
console.log(cnir.total_imoveis, 'imóveis');
```

### Perfil do produtor

```ts
const perfil = await api.perfilProdutor({ cpf: '12345678909' });
```

## Status da fonte

Uma resposta `200` pode trazer `source_status.status` diferente de `success` (por exemplo, `timeout` quando o órgão não respondeu a tempo). Confira esse campo antes de concluir que o documento não tem registro.

## Erros

```ts
import {
  FiscalAPIError, AuthenticationError, InsufficientBalanceError,
  RateLimitError, BadRequestError, ServerError, APIConnectionError,
} from 'fiscalapi-br';

try {
  await api.consultarIe({ uf: 'SP', cnpj: '12345678000195' });
} catch (err) {
  if (err instanceof AuthenticationError) {
    // chave ausente, inválida ou revogada (401/403)
  } else if (err instanceof InsufficientBalanceError) {
    console.log(err.consultasRestantes); // plano ou saldo esgotado (402)
  } else if (err instanceof RateLimitError) {
    console.log(err.retryAfter); // limite por minuto do plano (429)
  } else if (err instanceof BadRequestError) {
    console.log(err.code, err.message); // parâmetro ausente ou inválido (400/422)
  } else if (err instanceof FiscalAPIError) {
    console.log(err.status, err.requestId); // informe o requestId ao suporte
  }
}
```

## Novas tentativas e timeout

```ts
const api = new FiscalAPI('sua-chave', { timeoutMs: 200_000, maxRetries: 3 });
```

- `429`: o SDK espera o tempo do cabeçalho `Retry-After` e tenta de novo (menos `NFSE_HOMOLOG_LIMITE`, o limite mensal de homologação).
- `500`, `502`, `503`, `504` e falhas de rede: novas tentativas com espera exponencial, **só em consultas GET**. POST, PUT, PATCH e DELETE (NF-e, cadastro no monitor, webhook) não são repetidos automaticamente; a exceção é `emitirNfse` e `substituirNfse` com `referencia` ou `idempotencyKey`, que a API trata sem duplicar.
- Algumas consultas (NF-e, SIGEF) podem levar até 3 minutos; o timeout padrão é 200 s.

## Links

- Documentação: [docs.fiscalapi.com.br](https://docs.fiscalapi.com.br)
- Guias (Excel, Google Sheets, n8n, Make, Power Automate, Python, Node.js, PHP): [docs.fiscalapi.com.br/docs/guias](https://docs.fiscalapi.com.br/docs/guias)
- Especificação OpenAPI: [docs.fiscalapi.com.br/openapi.json](https://docs.fiscalapi.com.br/openapi.json)
- Servidor MCP: [fiscalapi-br/fiscalapi-mcp](https://github.com/fiscalapi-br/fiscalapi-mcp)
- Para desenvolvedores: [fiscalapi.com.br/desenvolvedores](https://fiscalapi.com.br/desenvolvedores/)
- Painel: [app.fiscalapi.com.br](https://app.fiscalapi.com.br)
- Suporte: contato@fiscalapi.com.br

## Licença

MIT
