# Changelog

As versões seguem [SemVer](https://semver.org/lang/pt-BR/). Cada tag `vX.Y.Z` publica o pacote no npm.

## 0.7.0 (2026-11-22)

- Emissão de NFS-e Nacional (`/api/nfse`):
  - empresas: `criarEmpresaNfse`, `listarEmpresasNfse`, `obterEmpresaNfse`, `atualizarEmpresaNfse`;
  - certificado A1 em multipart: `enviarCertificadoNfse`, `excluirCertificadoNfse`;
  - notas: `emitirNfse` (com `referencia` ou `idempotencyKey`), `obterNfse`, `listarNfse` e `iterarNfse` (cursor), `cancelarNfse`, `substituirNfse`, `baixarXmlNfse`, `baixarPdfNfse`;
  - webhook: `configurarWebhookNfse`, `obterWebhookNfse`, `removerWebhookNfse`, `reenviarWebhookNfse`.
- Tipos da emissão (`NotaNfseIn`, `NotaNfse`, `EmpresaNfse`, `AvisoWebhookNfse` etc.).
- `verificarAssinaturaWebhook` vale também para os avisos da emissão (mesmo esquema do Monitor de NF-e).
- `emitirNfse` e `substituirNfse` com chave de idempotência são repetidos em falha de rede e `5xx`; o `429` `NFSE_HOMOLOG_LIMITE` não é repetido.

## 0.6.0 (2026-11-21)

- Monitor de NF-e por chave (cadastro, listagem, detalhe e webhook) e `verificarAssinaturaWebhook`.
