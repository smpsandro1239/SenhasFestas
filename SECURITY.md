# Política de Segurança — SenhasFestas

## Versões suportadas

A política aplica-se à versão actualmente mantida no branch `main`. Não assumas que branches antigas ou deployments não identificados recebem actualizações de segurança.

## Reportar uma vulnerabilidade

Se identificares uma vulnerabilidade, reporta-a através de uma **GitHub Security Advisory privada** no repositório:

https://github.com/smpsandro1239/SenhasFestas/security/advisories/new

Não abras uma issue pública nem publiques um exploit antes de existir uma correcção ou um plano de divulgação coordenado.

Inclui, sempre que possível:

- componente e versão/commit afectados;
- pré-condições e impacto potencial;
- passos mínimos para reproduzir, sem aceder a dados de terceiros;
- prova de conceito não destrutiva;
- mitigação conhecida, se existir.

Não incluas passwords, tokens, cookies, dados pessoais, dados reais de clientes ou segredos nos relatórios.

## Âmbito prioritário

São especialmente relevantes vulnerabilidades que afectem:

- autenticação, sessões, refresh tokens e controlo de acesso por evento;
- saldo, movimentos financeiros, estornos, pedidos, stock e fecho de caixa;
- isolamento entre eventos e dados de utilizadores;
- endpoints administrativos, uploads, exportações e ecrãs públicos;
- WebSockets, cache PWA e sincronização offline;
- configuração, secrets, pipelines CI/CD e dependências.

## Expectativas de resposta

A equipa deverá confirmar a recepção, avaliar a severidade, coordenar uma correcção e acordar a divulgação. Não existe neste momento um SLA público de resposta; evita prometer prazos que não estejam formalmente garantidos.
