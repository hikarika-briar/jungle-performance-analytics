# Formato do arquivo `jungle_data.json` (schema v1)

Um único arquivo JSON em vez de vários (`manifest`, `matches`, `timelines`,
`metadata`): fica mais simples de importar e as timelines vêm já resumidas
(uma timeline bruta da Riot tem ~1 MB; aqui cada partida ocupa poucos KB).

```
{
  "schema": "jungle-performance-analytics",
  "schemaVersion": 1,
  "source": "riot-api",
  "generatedAt": "ISO-8601",
  "player": { "puuid", "puuids": [...], "riotId", "platform", "region", "namesSeen": [...] },
  "stats":  { "matches", "withTimeline", "withoutTimeline", "timelineUnavailable": [...],
              "matchesUnavailable": [...], "oldestGame", "newestGame" },
  "meta":   { "ddragonVersion", "items", "champions", "runes", "runeStyles", "runeStats",
              "spells", "shards", "icons": { "item", "champion", "rune", "spell" }, "itemRule" },
  "matches": [ Match, ... ]
}
```

## Match

| Campo | Origem (Match-V5) |
|---|---|
| `matchId` | `metadata.matchId` (chave de deduplicação) |
| `gameCreation`, `gameStart`, `gameEnd` | `info.gameCreation`, `gameStartTimestamp`, `gameEndTimestamp` (ms) |
| `duration` | `info.gameDuration` em segundos (convertido de ms em partidas antigas) |
| `gameVersion`, `patch` | `info.gameVersion` e os dois primeiros números dele |
| `queueId`, `mapId`, `gameMode` | `info.*` |
| `remake` | `gameEndedInEarlySurrender` do jogador ou duração < 5 min |
| `teamKills` | soma de `kills` do seu time |
| `me` | participante cujo `puuid` é o seu |
| `opp` | inimigo com `teamPosition = JUNGLE`; se faltar, o inimigo com Golpear (`oppIdentifiedBy`) |
| `participants` | os 10 jogadores, resumidos (campeão, posição, K/D/A, ouro, dano, farm, itens); a partir da 1.9 também Riot ID, dano recebido, visão, dano a objetivos, controle de grupo, maior multiabate, runa-chave e, nas partidas recentes, `rank` (elo atual Solo/Duo) |
| `teams` | `teamId`, `win`, `objectives` (`first`, `kills`) e banimentos |
| `timeline` | resumo da Match-V5 timeline, ou `null` |

### Participante (`me` e `opp`)

`k`, `d`, `a` = kills/deaths/assists · `cs` = `totalMinionsKilled` (tropas) ·
`jcs` = `neutralMinionsKilled` (monstros). Farm total = `cs + jcs`; os dois
campos são disjuntos e nunca são somados duas vezes. `gold` = `goldEarned`
(ouro obtido, não ouro disponível) · `dmg` = `totalDamageDealtToChampions` ·
`items` = `item0..item6` · `spells` = `summoner1Id`, `summoner2Id` ·
`runes` = `{ primaryStyle, subStyle, primary[4], secondary[2], shards[3], vars }` a partir de `perks`;
`vars` (1.8+) = `{ idDaRuna: [var1, var2, var3] }`, os valores de fim de partida que o cliente mostra em Runas,
e `meta.runeStats` = `{ idDaRuna: ["Total de dano: @eogvar1@", ...] }` (textos do Community Dragon) ·
`heal`, `healAllies`, `shieldAllies` (1.8+) = cura total, cura em aliados e escudo em aliados ·
`challenges` = subconjunto útil para jungle, só quando a API envia.

## Timeline (resumida)

Os snapshots da Riot são por minuto (`frameInterval` = 60000 ms). São
retratos do minuto, não eventos exatos.

- `me`, `opp`: linhas `[t, totalGold, currentGold, xp, level, cs, jcs, x, y]` (t em segundos)
- `team`: linhas `[t, ouroAzul, ouroVermelho, xpAzul, xpVermelho]`
- `items`: seus eventos de item `[t, tipo, itemId, afterId]`, tipo `P` compra, `S` venda,
  `D` destruído (componente usado), `U` compra desfeita (`ITEM_UNDO`, `itemId` = beforeId)
- `kills`: todos os `CHAMPION_KILL` `[t, matador, vítima, [assistências], x, y, bounty, shutdown]`
- `elite`: `ELITE_MONSTER_KILL` `[t, monsterType, monsterSubType, timeDoMatador, matador, [assistências], x, y]` (x e y a partir da versão 1.7)
- `buildings`: `BUILDING_KILL` `[t, buildingType, laneType, towerType, timeDonoDaEstrutura, matador, x, y, [assistências]]` (x e y a partir da 1.7; assistências a partir da 2.0)
- `plates` (2.0+): `TURRET_PLATE_DESTROYED` `[t, matador, laneType, timeDonoDaTorre, x, y]`
- `wards` (2.0+): `WARD_PLACED` do jungler e do jungler inimigo `[t, quem (0 = você, 1 = jungler inimigo), wardType]` (a Riot não informa o local da ward)
- `lanes` (2.0+): `{ "5" | "10" | "15" | "20": [[pid, ouroTotal, nível, farm], ...] }`, o estado dos 10 jogadores nesses minutos
- `souls`: `DRAGON_SOUL_GIVEN`

Outros eventos (wards, níveis de habilidade, placas) são descartados.

## Itens "completos"

Regra aplicada sobre o `item.json` do Data Dragon: comprável no Summoner's Rift,
sem evolução comprável, custo total ≥ 2000, e não é bota, consumível ou amuleto.
A ordem de compra vem só dos eventos `P` desses itens, desfazendo os `U`.
Sem timeline, a ordem não é deduzida dos slots finais.

## Dados ausentes

Valores que a API não envia ficam `null`, nunca `0`. Partidas sem timeline
têm `timeline: null` e ficam fora das análises que dependem dela.

## Arquivo de referências (`saida/referencias_challenger.json`)

Gerado por `python coletor_riot.py --referencias` (ou `atualizar_referencias.bat`).
Fica separado do `jungle_data.json` e é importado na aba **Rumo ao Challenger**.

```
{
  "schema": "jungle-performance-analytics-referencias",
  "schemaVersion": 1,
  "queue": 420,                 // fila coletada (Solo/Duo)
  "perPlayer": 40,              // partidas de jungle por jogador
  "notFound": ["Nome#TAG"],     // Riot IDs que a API não encontrou
  "players": [
    { "riotId": "Nome#TAG", "listedAs": "como está no referencias.txt", "puuid": "...",
      "matches": [ ...mesmo formato de partida do jungle_data.json, com "me" = o jogador de referência... ] }
  ],
  "meta": { ...nomes e ícones, igual ao jungle_data.json... }
}
```

Só entram partidas em que o jogador estava na jungle (teamPosition JUNGLE), sem remakes.
O cache dessas partidas fica em `dados/referencias/`, separado do cache das suas partidas.

## Novidades da versão 1.3

No `jungle_data.json`:

```
"profile": { "profileIconId": 6262, "summonerLevel": 247, "fetchedAt": "..." },
"rank": {
  "current": { "RANKED_SOLO_5x5": { "tier": "EMERALD", "rank": "I", "lp": 3, "wins": 235, "losses": 253 } },
  "history": [ { "t": "2026-11-03T04:00:00Z", "tier": "EMERALD", "rank": "I", "lp": 3, "wins": 235, "losses": 253, "source": "coletor" } ]
},
"meta": { ..., "visual": { "profileIcon": "data:image/webp;base64,...", "splash": { "Briar": "data:..." }, "emblems": { "EMERALD": "data:..." } } }
```

O histórico de elo fica em `dados/elo_historico.json` e ganha um ponto a cada
execução em que o elo muda. A Riot não informa o elo de partidas antigas, então o
histórico começa na primeira execução da versão 1.3.

No `referencias_challenger.json`, cada jogador ganha `rank`, `level` e `icon`.

Elo dos outros jogadores (2.2): `participants[].rank` é o elo Solo/Duo **atual** de cada
jogador, `{ "tier": "MASTER", "rank": "I", "lp": 120 }`, ou `{ "tier": null }` quando o
jogador já foi consultado e não tem elo no Solo/Duo. Sem o campo `rank`, o jogador ainda
não foi consultado. Vale para as suas partidas e, no `referencias_challenger.json`, para as
partidas candidatas a "Partidas para estudar". O cache fica em
`dados/cache/elo_jogadores.json`.

## referencias_briar.json (coletor 2.3)

Mesmo formato do `referencias_challenger.json`, com `"kind": "briar"` e `"champion": "Briar"`.
Só entram partidas de Briar na selva. Cada jogador ganha `server` (BR, NA, EUW, KR...).

No `meta.champions`, a partir da 2.3, cada campeão traz `stats` do Data Dragon: `hp`, `hpperlevel`,
`attackdamage`, `attackdamageperlevel`, `armor`, `armorperlevel`, `spellblock`, `spellblockperlevel`,
`movespeed`, `attackrange`, `attackspeed`, `attackspeedperlevel`.

No `meta.visual`, a partir da 2.3.2: `classArt` = `{ "fighter" | "slayer" | "tank" | "mage" | "marksman" | "controller" | "specialist": "data:image/webp;base64,..." }`,
a arte de carregamento (Data Dragon) de um campeão de cada classe, usada no menu "Guia de cada classe".
