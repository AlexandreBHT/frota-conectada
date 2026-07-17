# Organização dos componentes

Esta versão cria a base da arquitetura do FrotaControl. As novas funcionalidades devem ser separadas por domínio:

- `layout`: navegação e estrutura geral
- `dashboard`: indicadores e visão geral
- `vehicles`: cadastro e dados dos veículos
- `trips`: checklist, início e encerramento de viagens
- `maintenance`: manutenção e alertas
- `reports`: relatórios e gráficos

A tela atual permanece funcional enquanto os módulos são extraídos gradualmente, evitando uma refatoração grande e arriscada de uma única vez.
