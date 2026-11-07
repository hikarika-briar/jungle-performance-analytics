# Coletor de dados · Jungle Performance Analytics

Programa que baixa suas partidas pela API oficial da Riot e gera o arquivo
`saida\jungle_data.json`, que você importa no dashboard.

## Atualizar tudo com um clique (recomendado)

Dê dois cliques em **atualizar_tudo.bat**. Ele faz, nesta ordem:

1. baixa as suas partidas novas;
2. lê o seu elo atual, ícone e nível (e guarda um ponto no histórico de elo);
3. baixa a arte da sua campeã mais jogada para o banner do dashboard;
4. atualiza os jogadores de referência.

No fim, a pasta `saida` tem dois arquivos: `jungle_data.json` (as suas partidas) e
`referencias_challenger.json` (as referências). Importe os dois no dashboard,
em **Configurações e Importação** (o dashboard reconhece cada um sozinho).

Com o site configurado (veja abaixo), ele também envia os dois arquivos para o
site público no fim, sozinho.

## Site público (hikarika.marcelominerato.com.br)

O coletor atualiza o site sozinho no fim do `atualizar_tudo.bat`. Para isso ele
precisa de um token do GitHub, criado uma vez só:

1. Abra https://github.com/settings/personal-access-tokens/new
2. Token name: `coletor`. Expiration: o prazo que preferir.
3. Repository access: **Only select repositories** → `jungle-performance-analytics`.
4. Permissions → Repository permissions → **Contents: Read and write**.
5. Clique em **Generate token** e copie.
6. Dê dois cliques em **publicar_site.bat**: o `github_token.txt` abre no Bloco de Notas.
   Cole o token, salve (Ctrl+S), feche e aperte Enter na janela preta.

Pronto. A partir daí, cada `atualizar_tudo.bat` envia só o que mudou, e o site
mostra os dados novos em cerca de 1 minuto. Para enviar de novo sem baixar nada,
rode `publicar_site.bat`. Para trocar o token, rode `trocar_token_site.bat`.

O token fica só no `github_token.txt`, no seu computador, e só é enviado para
`api.github.com`. Ele só consegue mexer no repositório do site. As metas, o elo
marcado mês a mês e o fundo do banner do site não vêm do coletor.

## Atualização automática a cada hora

Dê dois cliques em **agendar_atualizacao.bat**. Ele cria uma tarefa no Agendador de
Tarefas do Windows que roda o coletor a cada hora, sem abrir janela, e já roda a
primeira na hora. A cada execução:

- as suas partidas novas são baixadas e o site é atualizado (só se algo mudou);
- os jogadores de referência são atualizados no máximo a cada 6 horas
  (`referencias_a_cada_horas` no `config.json`), com as últimas 80 partidas de cada um
  (`referencias_partidas_por_jogador`);
- o elo atual dos outros jogadores é buscado para o placar, nas suas partidas e nas
  partidas dos Challengers usadas em "Partidas para estudar". São no máximo 500
  consultas por execução (`elo_dos_jogadores_por_execucao`), então o histórico inteiro
  fica completo em algumas execuções. Jogadores das últimas 20 partidas
  (`elo_dos_jogadores_partidas`; 0 desliga) são consultados de novo a cada 3 dias
  (`elo_dos_jogadores_dias`); os das partidas mais antigas, a cada 30 dias
  (`elo_dos_jogadores_dias_antigas`);
- se você trocou de chave da Riot (por exemplo, da chave de desenvolvimento para a Personal API Key),
  as partidas baixadas com a chave anterior guardam IDs de jogador que a chave nova não reconhece.
  O coletor (2.3.1+) baixa essas partidas de novo, até 200 por execução
  (`partidas_ids_antigos_por_execucao`), das mais recentes para as mais antigas, e aí o elo dos
  jogadores delas aparece;
- o resultado fica em `dados\ultima_atualizacao_automatica.log`.

Só roda com o computador ligado. Para outro intervalo, rode no Prompt de Comando
`python coletor_riot.py --agendar --horas 3`. Para parar, use **cancelar_agendamento.bat**.

Se a chave da Riot for recusada, a execução automática não pergunta nada: ela
para e registra o motivo no log. Rode o `atualizar_tudo.bat` para resolver.
Em notebook, se não rodar fora da tomada: Agendador de Tarefas → tarefa
"Jungle Performance Analytics" → Propriedades → Condições → desmarque
"Iniciar a tarefa somente se o computador estiver ligado à rede elétrica".

Na atualização automática, cada envio substitui o anterior no GitHub, para o
repositório não crescer sem parar (`site_manter_historico` no `config.json`).

**Atualizando o coletor:** nas próximas versões, basta trocar o arquivo
`coletor_riot.py` (e os .bat, se vierem). Se você extrair uma versão nova numa
pasta separada, na primeira execução ele acha as pastas antigas do coletor na
mesma pasta (ex.: Downloads) e copia o cache, o histórico de elo e a chave mais
recente, para não baixar tudo de novo.

## Chave da Riot que não vence a cada 24 horas

A chave de desenvolvimento expira todo dia. Para uso pessoal, a Riot oferece a
**Personal API Key**, que não expira diariamente:

1. Entre em https://developer.riotgames.com com a sua conta da Riot.
2. Clique em **Register Product** e escolha **Personal API Key**.
3. Preencha nome e uma descrição detalhada do projeto (ex.: "Dashboard pessoal que
   analisa as minhas partidas de jungle e compara com dados públicos de alguns
   jogadores; não é distribuído ao público") e envie.
4. Acompanhe o pedido no painel do portal. Quando a chave pessoal estiver liberada,
   cole no `chave_api.txt` (ou rode `trocar_chave.bat`) uma única vez.

A chave pessoal é para uso seu (ou de um grupo pequeno e privado), com o mesmo
limite da chave de desenvolvimento: 20 pedidos por segundo e 100 a cada 2 minutos.

## Uso (Windows)

1. Extraia esta pasta em qualquer lugar. Se já tinha uma versão anterior, extraia
   por cima e aceite substituir os arquivos (a pasta `dados` é mantida).
2. Dê dois cliques em **atualizar_dados.bat**.
3. Espere terminar. Na primeira vez, cerca de 460 partidas com timeline levam
   15 a 20 minutos (limite da chave: 100 consultas a cada 2 minutos).
   Pode fechar no meio: o que já baixou fica salvo e não é baixado de novo.
4. No dashboard, abra **Configurações e Importação** e importe
   `saida\jungle_data.json`.

## Quando a chave expirar (a cada 24 horas)

1. Gere uma chave nova em https://developer.riotgames.com (botão **REGENERATE API KEY**).
2. Dê dois cliques em **trocar_chave.bat**: o arquivo `chave_api.txt` abre no Bloco de Notas.
3. Apague o que estiver lá, cole a chave nova, salve (Ctrl+S) e feche.
4. Rode `atualizar_dados.bat` de novo.

Se você rodar o `atualizar_dados.bat` com a chave vencida, ele mesmo abre o
Bloco de Notas e espera você salvar a chave nova. Não precisa colar nada no
Prompt de Comando. Espaços, quebras de linha ou a chave colada duas vezes não
atrapalham: o coletor extrai só a chave válida do arquivo.

## Jogadores de referência (aba "Rumo ao Challenger")

1. A lista fica em **referencias.txt** (um Riot ID por linha). Já vem com os 10
   junglers Challenger que você escolheu; pode editar no Bloco de Notas.
2. Dê dois cliques em **atualizar_referencias.bat**.
3. Na primeira vez leva uns 15 a 20 minutos (40 partidas de jungle em Solo/Duo de
   cada um, com timeline). Nas próximas, só baixa o que for novo.
4. No dashboard, abra a aba **Rumo ao Challenger** e importe
   `saida\referencias_challenger.json`. Esse arquivo fica separado das suas
   partidas e nunca se mistura com elas.

Para mudar quantas partidas por jogador: `python coletor_riot.py --referencias --por-jogador 60`.

## Comandos (Prompt de Comando, dentro da pasta)

| Comando | O que faz |
|---|---|
| `python coletor_riot.py` | Atualiza (incremental) |
| `python coletor_riot.py --nova-chave` | Troca a chave (abre o Bloco de Notas) |
| `python coletor_riot.py --ids extras.txt` | Baixa IDs específicos (veja `extras_exemplo.txt`) |
| `python coletor_riot.py --somente-exportar` | Refaz o arquivo só com o cache, sem chamar a API |
| `python coletor_riot.py --max 50` | Baixa no máximo 50 partidas novas nesta execução |
| `python coletor_riot.py --referencias` | Baixa as partidas dos jogadores de `referencias.txt` |
| `python coletor_riot.py --tudo` | Suas partidas, elo, imagens e referências, em sequência |
| `python coletor_riot.py --publicar` | Só envia os arquivos da pasta `saida` para o site |
| `python coletor_riot.py --sem-publicar` | Atualiza sem enviar para o site |
| `python coletor_riot.py --agendar` | Agenda a atualização automática a cada hora |
| `python coletor_riot.py --cancelar-agendamento` | Remove o agendamento |

## Configuração (`config.json`, criado no primeiro uso)

- `riot_id`: `Hikarika#BRIAR`. Se você trocar de nome, atualize aqui.
  O histórico não quebra: as partidas são identificadas pelo PUUID.
- `plataforma`: `BR1` · `regiao`: `americas` (roteamento regional da Account-V1 e Match-V5).
- `baixar_timelines`: `true`. Timelines trazem ordem de compra, eventos e curvas por minuto.
- `filas_com_timeline`: timelines só para filas do Summoner's Rift (economiza cota).
- `icones_campeoes`: `"jungle"` (só seus campeões e junglers inimigos, arquivo menor)
  ou `"todos"` (ícone dos 10 campeões de cada partida).
- `site_repositorio`: repositório do site no GitHub (`hikarika-briar/jungle-performance-analytics`).
  Deixe vazio (`""`) para não enviar nada para o site.

## Segurança da chave

- A chave nunca fica no código. Ordem de leitura: variável de ambiente
  `RIOT_API_KEY`, depois o arquivo local `chave_api.txt`, depois o programa pede.
- Ela só é enviada para `americas.api.riotgames.com` (cabeçalho `X-Riot-Token`).
  O Data Dragon (nomes e ícones) é público e é acessado sem a chave.
- O arquivo exportado e o dashboard não contêm a chave.
- Para apagar a chave do computador, exclua `chave_api.txt`.

## O que fica no seu computador

- `dados\cache\partidas` e `dados\cache\timelines`: respostas da API (compactadas).
- `dados\cache\indisponiveis.json`: partidas ou timelines que a API não devolveu (404).
- `dados\ddragon`: nomes em português e ícones.
- `saida\jungle_data.json`: o arquivo para importar.

Python 3.8 ou mais novo, só biblioteca padrão. Se a Pillow estiver instalada
(`pip install pillow`), os ícones ficam menores e o arquivo exportado também.

Detalhes do formato do arquivo: `FORMATO_DOS_DADOS.md`.

## Página Mono Briar (coletor 2.3)

A página **Mono Briar** compara as suas partidas de Briar com as dos melhores Briar do mundo.
Os jogadores ficam em `referencias_briar.txt`, um por linha, com o servidor depois da barra:

```
IbraBriar#Rapha | BR
ASTA LA VISTA BB#NA1 | NA
641#001 | EUW
계곡산개구리#2004 | KR
```

Servidores aceitos: BR, NA, LAN, LAS, EUW, EUNE, TR, RU, ME, KR, JP, OCE, VN, TW, SG, PH, TH.
O coletor busca só as partidas de Briar na selva (Solo/Duo) de cada um, até 60 por jogador
(`briar_partidas_por_jogador` no `config.json`). A atualização automática (`atualizar_tudo.bat`)
inclui os mono Briar no máximo a cada 6 horas (`briar_a_cada_horas`); para rodar só eles, use
**atualizar_briar.bat**. O arquivo gerado é `saida\referencias_briar.json`, enviado para o site junto
com os outros.

A 2.3 também manda os atributos de cada campeão (vida, dano de ataque, armadura, resistência
mágica, alcance e velocidade, com o crescimento por nível) para a tabela "Classes dos campeões".

A 2.3.2 baixa também a arte de carregamento de um campeão de cada classe (Briar, Zed, Leona, Lux,
Jinx, Lulu e Teemo) para o menu "Guia de cada classe" da aba Matchups. As imagens ficam guardadas em
`dados\ddragon\visual` e vão dentro do `jungle_data.json`, então aparecem no site e no dashboard.
