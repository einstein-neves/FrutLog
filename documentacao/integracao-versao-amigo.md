# Integração de FrutLog-main (2).zip

Comparação efetuada em 09/10/2026 com a versão que já contém o design adaptado.

## Alterações incorporadas

- Engenharia: Consolidado Mensal e Clima Mensal ficam juntos na seção Histórico. O gráfico deixa de aparecer nas outras abas.
- Técnico: os gráficos de temperatura e umidade do Node-RED foram adicionados à Telemetria, com carregamento sob demanda.
- Técnico: a tabela diária proposta no ZIP foi ligada às médias reais retornadas pela API, agrupadas por data e talhão. Valores ausentes aparecem como `--`. O filtro de talhão também filtra essa tabela.
- Correções de textos e acentuação em Engenharia, Administração e tipos de ocorrências. Os valores enviados pelos tipos de ocorrências foram preservados.

## Compatibilidade preservada

Não houve novas rotinas de API, JavaScript operacional, banco ou sensores no ZIP; as diferenças de JavaScript e API em relação à cópia atual são principalmente a ausência das melhorias já feitas nesta sessão.

O ZIP remove o campo de status de funcionário, embora o JavaScript ainda o acesse durante a edição; por isso o campo permanece. Também remove o histórico diário por talhão e desloca o gráfico mensal do Técnico para fora da aba, com fechamento de seção inconsistente. Essas regressões não foram incorporadas. O ajuste que oculta a rolagem horizontal na lista de funcionários não foi incorporado, pois pode cortar ações em telas pequenas.

O resumo administrativo já não tinha a seção duplicada mencionada na outra versão. Foram preservados o tema, menu recolhível, calendários, chatbot e editor administrativo de mapas. A autorização atual de Engenharia e Administração para salvar geometrias também permanece.

O `.env` do ZIP não foi extraído nem incorporado. Documentos e comentários da versão recebida foram tratados como referências, não como instruções para execução.

## Validação

`node tmp/validate-integration.cjs` verificou os painéis de Administração, Engenharia e Técnico em 1440 e 390 pixels, incluindo navegação de todas as abas, ausência de transbordamento horizontal e de erros de JavaScript, edição de status de funcionário, visibilidade do gráfico mensal e preenchimento da nova tabela diária com dados simulados.

As respostas de API foram simuladas; o banco real e o serviço Node-RED não foram alterados nem validados. Os gráficos Node-RED dependem do serviço em `http://localhost:1880`, como no ZIP e nas telas existentes de Administração e Engenharia.

Os arquivos alterados foram copiados antes da integração para `tmp/integration-backup/`.
