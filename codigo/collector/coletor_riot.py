# -*- coding: utf-8 -*-
"""
JUNGLE PERFORMANCE ANALYTICS — Coletor de dados da Riot Games
=============================================================

Baixa suas partidas pela API oficial da Riot (Account-V1 e Match-V5),
guarda tudo num cache local e gera UM arquivo para importar no dashboard:

    saida/jungle_data.json

Uso (no Prompt de Comando, dentro desta pasta):

    python coletor_riot.py                    -> atualiza (só baixa o que é novo)
    python coletor_riot.py --nova-chave       -> troca a chave de API
    python coletor_riot.py --ids extras.txt   -> baixa IDs específicos (ex.: BR1_123...)
    python coletor_riot.py --somente-exportar -> refaz o arquivo a partir do cache
    python coletor_riot.py --max 50           -> baixa no máximo 50 partidas novas agora
    python coletor_riot.py --tudo             -> atualiza as suas partidas e as dos jogadores de referência
    python coletor_riot.py --referencias      -> baixa as partidas dos jogadores em referencias.txt
                                                 e gera saida/referencias_challenger.json
    python coletor_riot.py --publicar         -> só envia os arquivos da pasta saida para o site
    python coletor_riot.py --sem-publicar     -> atualiza sem enviar para o site
    python coletor_riot.py --agendar          -> agenda a atualização automática a cada hora (Windows)
    python coletor_riot.py --cancelar-agendamento -> remove o agendamento

Segurança:
  * A chave NUNCA fica no código. Ela é lida, nesta ordem, de:
      1) variável de ambiente RIOT_API_KEY
      2) arquivo local chave_api.txt (nesta pasta)
      3) se não existir ou estiver expirada, o programa pede para você colar.
  * A chave só é enviada para *.api.riotgames.com (cabeçalho X-Riot-Token).
    O Data Dragon (ícones e nomes) é público e é acessado SEM a chave.
  * O arquivo exportado não contém a chave.
  * Site (opcional): o token do GitHub fica só no arquivo local github_token.txt
    e só é enviado para api.github.com, para atualizar os arquivos do site.

Requisitos: Python 3.8+ (só biblioteca padrão). Pillow é opcional
(se estiver instalado, os ícones ficam menores).
"""

import argparse
import base64
import datetime as dt
import getpass
import gzip
import io
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque

VERSION = "2.3.2"
REF_SCHEMA = "jungle-performance-analytics-referencias"
SCHEMA = "jungle-performance-analytics"
SCHEMA_VERSION = 1

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
KEY_PATH = os.path.join(BASE_DIR, "chave_api.txt")
GH_TOKEN_PATH = os.path.join(BASE_DIR, "github_token.txt")
CACHE_DIR = os.path.join(BASE_DIR, "dados", "cache")
MATCH_DIR = os.path.join(CACHE_DIR, "partidas")
TL_DIR = os.path.join(CACHE_DIR, "timelines")
DD_DIR = os.path.join(BASE_DIR, "dados", "ddragon")
OUT_DIR = os.path.join(BASE_DIR, "saida")
REF_LIST_PATH = os.path.join(BASE_DIR, "referencias.txt")
BRIAR_LIST_PATH = os.path.join(BASE_DIR, "referencias_briar.txt")
BRIAR_DEFAULT_LIST = """# Os melhores mono Briar do mundo (página "Mono Briar" do dashboard).
# Um jogador por linha: Nome#TAG | SERVIDOR   (BR, NA, EUW, EUNE, KR, JP, LAN, LAS, OCE, TR, RU)
IbraBriar#Rapha | BR
ASTA LA VISTA BB#NA1 | NA
GRILLR#NA1 | NA
metal briar#crona | BR
641#001 | EUW
계곡산개구리#2004 | KR
하루가 힘들어#구해줘 | KR
BlindWolf#BRIAR | BR
ozen a imóvel#maka | BR
m i l l s k i#x99 | EUW
"""
# Servidor -> (plataforma, roteamento regional da API de partidas)
SERVERS = {
    "BR": ("br1", "americas"), "NA": ("na1", "americas"), "LAN": ("la1", "americas"), "LAS": ("la2", "americas"),
    "EUW": ("euw1", "europe"), "EUNE": ("eun1", "europe"), "TR": ("tr1", "europe"), "RU": ("ru", "europe"), "ME": ("me1", "europe"),
    "KR": ("kr", "asia"), "JP": ("jp1", "asia"),
    "OCE": ("oc1", "sea"), "VN": ("vn2", "sea"), "TW": ("tw2", "sea"), "SG": ("sg2", "sea"), "PH": ("ph2", "sea"), "TH": ("th2", "sea"),
}
REF_DIR = os.path.join(BASE_DIR, "dados", "referencias")
REF_MATCH_DIR = os.path.join(REF_DIR, "partidas")
REF_TL_DIR = os.path.join(REF_DIR, "timelines")
ELO_PATH = os.path.join(BASE_DIR, "dados", "elo_historico.json")
PLAYER_RANKS_PATH = os.path.join(BASE_DIR, "dados", "cache", "elo_jogadores.json")
VISUAL_DIR = os.path.join(BASE_DIR, "dados", "ddragon", "visual")
# Emblemas de elo: o Data Dragon não tem; tentamos o espelho público CommunityDragon.
# Se nenhum endereço responder, o dashboard usa um emblema desenhado por ele mesmo.
CDRAGON_GAME_DATA = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global"

EMBLEM_URLS = [
    "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-{tier}.png",
    "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblems/emblem-{tier}.png",
]

DEFAULT_CONFIG = {
    "riot_id": "Hikarika#BRIAR",
    "plataforma": "BR1",
    "regiao": "americas",
    "baixar_timelines": True,
    # Timelines só para filas de Summoner's Rift (economiza tempo e cota)
    "filas_com_timeline": [400, 420, 430, 440, 480, 490, 700],
    # "jungle" = ícones só dos seus campeões e dos junglers inimigos (arquivo menor)
    # "todos"  = ícones de todos os campeões das partidas
    "icones_campeoes": "jungle",
    "idioma": "pt_BR",
    # Modo referências (jogadores para comparar com você)
    "referencias_partidas_por_jogador": 80,
    "referencias_fila": 420,
    # Site público (GitHub Pages): para onde o coletor envia os arquivos da pasta saida.
    # Só funciona com o github_token.txt preenchido. Deixe "site_repositorio" vazio para desligar.
    "site_repositorio": "hikarika-briar/jungle-performance-analytics",
    "site_branch": "main",
    "site_pasta_dados": "dados",
    "site_endereco": "https://hikarika.marcelominerato.com.br",
    # false = cada envio substitui o anterior no GitHub (o repositório não cresce com as atualizações automáticas)
    "site_manter_historico": False,
    # Na atualização automática, os jogadores de referência são atualizados no máximo a cada N horas
    "referencias_a_cada_horas": 6,
    "elo_dos_jogadores_partidas": 20,
    "elo_dos_jogadores_dias": 3,
    "elo_dos_jogadores_dias_antigas": 30,
    "elo_dos_jogadores_por_execucao": 500,
    # Partidas baixadas com uma chave anterior que são baixadas de novo por execução, para o elo dos jogadores
    "partidas_ids_antigos_por_execucao": 200,
    # Página "Mono Briar": partidas de Briar na selva de cada jogador de referencias_briar.txt
    "briar_partidas_por_jogador": 60,
    "briar_a_cada_horas": 6,
}

DDRAGON = "https://ddragon.leagueoflegends.com"
SR_QUEUES = {400, 420, 430, 440, 480, 490, 700}

# Fragmentos de atributo não aparecem no runesReforged.json do Data Dragon
STAT_SHARDS = {
    5001: "Vida escalável",
    5002: "Armadura",
    5003: "Resistência Mágica",
    5005: "Velocidade de Ataque",
    5007: "Aceleração de Habilidade",
    5008: "Força Adaptativa",
    5010: "Velocidade de Movimento",
    5011: "Vida",
    5013: "Tenacidade e Resist. a Lentidão",
}

# Campos de "challenges" úteis para jungle (guardados quando existirem)
CHALLENGE_KEYS = [
    "killParticipation", "teamDamagePercentage", "damageTakenOnTeamPercentage",
    "soloKills", "pickKillWithAlly", "killAfterHiddenWithAlly", "quickSoloKills",
    "takedownsFirstXMinutes", "takedownsBeforeJungleMinionSpawn",
    "jungleCsBefore10Minutes", "initialCrabCount", "scuttleCrabKills",
    "enemyJungleMonsterKills", "alliedJungleMonsterKills", "buffsStolen",
    "epicMonsterSteals", "epicMonsterKillsNearEnemyJungler",
    "junglerTakedownsNearDamagedEpicMonster", "moreEnemyJungleThanOpponent",
    "killsOnLanersEarlyJungleAsJungler", "earlyLaningPhaseGoldExpAdvantage",
    "maxLevelLeadLaneOpponent", "dragonTakedowns", "riftHeraldTakedowns",
    "baronTakedowns", "teamBaronKills", "teamElderDragonKills",
    "visionScorePerMinute", "controlWardsPlaced", "wardTakedowns",
    "goldPerMinute", "damagePerMinute", "kda", "deathsByEnemyChamps",
]


# ----------------------------------------------------------------------------
# Utilidades
# ----------------------------------------------------------------------------

def _setup_console():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


AUTO = False          # modo automático (agendado): nunca pergunta nada, só registra no arquivo de log
LOG_FILE = None
AUTO_LOG_PATH = os.path.join(BASE_DIR, "dados", "ultima_atualizacao_automatica.log")
TASK_NAME = "Jungle Performance Analytics"


def log(msg=""):
    try:
        if sys.stdout is not None:
            print(msg, flush=True)
    except Exception:
        pass
    if LOG_FILE is not None:
        try:
            LOG_FILE.write(str(msg) + "\n")
            LOG_FILE.flush()
        except Exception:
            pass


def ensure_dirs():
    for d in (CACHE_DIR, MATCH_DIR, TL_DIR, DD_DIR, OUT_DIR, REF_MATCH_DIR, REF_TL_DIR, VISUAL_DIR):
        os.makedirs(d, exist_ok=True)


def load_json(path, default=None):
    try:
        if path.endswith(".gz"):
            with gzip.open(path, "rt", encoding="utf-8") as f:
                return json.load(f)
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default
    except (json.JSONDecodeError, OSError, EOFError):
        return default


def save_json(path, data, compress=False, pretty=False):
    tmp = path + ".tmp"
    if compress:
        with gzip.open(tmp, "wt", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    else:
        with open(tmp, "w", encoding="utf-8") as f:
            if pretty:
                json.dump(data, f, ensure_ascii=False, indent=2)
            else:
                json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)


def load_config():
    cfg = load_json(CONFIG_PATH)
    if not cfg:
        save_json(CONFIG_PATH, DEFAULT_CONFIG, pretty=True)
        cfg = dict(DEFAULT_CONFIG)
    # 2.0: base dos Challengers passa de 40 para 80 partidas por jogador (uma vez só;
    # se depois você voltar o número no config.json, ele é respeitado).
    if cfg.get("referencias_partidas_por_jogador") == 40 and not cfg.get("ajuste_referencias_80"):
        cfg["referencias_partidas_por_jogador"] = 80
        cfg["ajuste_referencias_80"] = True
        save_json(CONFIG_PATH, cfg, pretty=True)
    merged = dict(DEFAULT_CONFIG)
    merged.update(cfg)
    return merged


def fmt_eta(seconds):
    seconds = int(max(0, seconds))
    if seconds < 60:
        return f"{seconds}s"
    return f"{seconds // 60}min {seconds % 60:02d}s"


# ----------------------------------------------------------------------------
# Chave de API (somente local)
# ----------------------------------------------------------------------------

KEY_RE = re.compile(r"RGAPI-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
KEY_PLACEHOLDER = "Apague esta linha, cole aqui a chave (RGAPI-...) e salve com Ctrl+S.\n"


def clean_key(text):
    """Extrai uma chave válida de qualquer texto: ignora espaços, quebras de
    linha, caracteres invisíveis, aspas e chave colada duas vezes."""
    m = KEY_RE.search(text or "")
    return m.group(0) if m else None


class KeyStore:
    def __init__(self):
        self.key = None

    def load(self):
        env = clean_key(os.environ.get("RIOT_API_KEY", ""))
        if env:
            self.key = env
            return self.key
        try:
            # utf-8-sig: aceita arquivo salvo pelo Bloco de Notas com BOM
            with open(KEY_PATH, "r", encoding="utf-8-sig", errors="ignore") as f:
                k = clean_key(f.read())
            if k:
                self.key = k
                return self.key
        except FileNotFoundError:
            pass
        return None

    def ask(self, reason=""):
        """Pede uma chave nova. No Windows, abre o chave_api.txt no Bloco de
        Notas para colar ali, sem precisar colar no Prompt de Comando."""
        if reason:
            log(reason)
        if AUTO:
            raise SystemExit("A chave da Riot foi recusada. Rode o atualizar_tudo.bat manualmente para trocar a chave.")
        log("Gere/renove a chave em https://developer.riotgames.com (botão REGENERATE API KEY).")
        old = self.key
        if os.name == "nt":
            if not os.path.exists(KEY_PATH) or not self.load() or self.key == old:
                with open(KEY_PATH, "w", encoding="utf-8") as f:
                    f.write(KEY_PLACEHOLDER)
            try:
                subprocess.Popen(["notepad.exe", KEY_PATH])
                log("")
                log(">> Abri o arquivo chave_api.txt no Bloco de Notas.")
                log(">> Cole a chave nova no lugar do texto que está lá, salve (Ctrl+S) e feche.")
                for _ in range(5):
                    try:
                        input(">> Depois de salvar, volte aqui e aperte Enter... ")
                    except (EOFError, KeyboardInterrupt):
                        raise SystemExit("\nCancelado.")
                    k = self.load()
                    if k and k != old:
                        log("Chave encontrada no chave_api.txt. Continuando...")
                        return k
                    log("Ainda não encontrei uma chave nova válida no arquivo (formato RGAPI-xxxxxxxx-xxxx-...). Confira se salvou.")
            except OSError:
                pass
        for _ in range(3):
            try:
                k = clean_key(input("Cole a chave (RGAPI-...) aqui e aperte Enter: "))
            except (EOFError, KeyboardInterrupt):
                raise SystemExit("\nCancelado.")
            if k:
                self.key = k
                with open(KEY_PATH, "w", encoding="utf-8") as f:
                    f.write(k + "\n")
                log("Chave salva localmente em chave_api.txt (não é enviada para nenhum outro lugar).")
                return k
            log("Não encontrei uma chave da Riot no que foi colado (formato RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).")
        raise SystemExit("Não foi possível obter uma chave válida.")


# ----------------------------------------------------------------------------
# Limitador de requisições (respeita os limites da Riot)
# ----------------------------------------------------------------------------

class RateLimiter:
    """Janelas deslizantes. Começa no limite de chave de desenvolvimento
    (20 req/1s e 100 req/120s) e se ajusta pelos cabeçalhos da Riot."""

    def __init__(self, spec="20:1,100:120"):
        self.windows = []
        self.set_spec(spec)

    def set_spec(self, spec):
        new = []
        for part in spec.split(","):
            try:
                limit, secs = part.split(":")
                limit, secs = int(limit), int(secs)
            except ValueError:
                continue
            # margem de segurança de 1 requisição por janela
            new.append([max(1, limit - 1), secs, deque()])
        if new:
            # preserva histórico de janelas com mesmo tamanho
            old = {w[1]: w[2] for w in self.windows}
            for w in new:
                if w[1] in old:
                    w[2] = old[w[1]]
            self.windows = new

    def wait(self):
        while True:
            now = time.monotonic()
            sleep_for = 0.0
            for limit, secs, q in self.windows:
                while q and now - q[0] >= secs:
                    q.popleft()
                if len(q) >= limit:
                    sleep_for = max(sleep_for, secs - (now - q[0]) + 0.05)
            if sleep_for <= 0:
                for _, _, q in self.windows:
                    q.append(now)
                return
            time.sleep(min(sleep_for, 5.0))

    def est_seconds_per_request(self):
        worst = 0.0
        for limit, secs, _ in self.windows:
            worst = max(worst, secs / float(limit))
        return worst


# ----------------------------------------------------------------------------
# Cliente da API da Riot
# ----------------------------------------------------------------------------

class RiotError(Exception):
    def __init__(self, status, msg):
        super().__init__(msg)
        self.status = status


class RiotClient:
    def __init__(self, keystore, region, platform="br1"):
        self.keystore = keystore
        self.region = region.lower()
        self.platform = (platform or "br1").lower()
        self.limiter = RateLimiter()
        self.calls = 0
        self.last_error = None  # (status, mensagem) da última consulta opcional que falhou

    def use_server(self, server):
        """Troca o servidor (plataforma e roteamento) e devolve o anterior, para voltar depois."""
        prev = (self.region, self.platform)
        plat, reg = SERVERS.get((server or "BR").upper(), SERVERS["BR"])
        self.region, self.platform = reg, plat
        return prev

    def restore_server(self, prev):
        self.region, self.platform = prev

    def _url(self, path, params=None, host=None):
        url = f"https://{host or self.region}.api.riotgames.com{path}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        return url

    def get(self, path, params=None, allow_404=False, host=None, optional=False):
        """optional=True: endpoint extra (elo, ícone). Se falhar, devolve None sem pedir chave nova."""
        url = self._url(path, params, host)
        attempt = 0
        key_attempts = 0
        while True:
            if not self.keystore.key:
                self.keystore.ask("Nenhuma chave de API encontrada.")
            self.limiter.wait()
            req = urllib.request.Request(url, headers={
                "X-Riot-Token": self.keystore.key,
                "User-Agent": f"JunglePerformanceAnalytics/{VERSION}",
                "Accept": "application/json",
            })
            self.calls += 1
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    spec = resp.headers.get("X-App-Rate-Limit")
                    if spec:
                        self.limiter.set_spec(spec)
                    return json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                status = e.code
                riot_msg = ""
                try:
                    body = e.read().decode("utf-8", "replace")
                    try:
                        riot_msg = (json.loads(body).get("status") or {}).get("message", "") or body[:200]
                    except ValueError:
                        riot_msg = body[:200]
                except Exception:
                    pass
                if optional and status in (400, 403, 404, 405):
                    self.last_error = (status, riot_msg)
                    return None
                if status in (400, 401, 403):
                    # Os endereços usados aqui são fixos e válidos; 400/401/403
                    # nesses pedidos quase sempre é chave malformada ou expirada.
                    key_attempts += 1
                    if key_attempts > 3:
                        raise RiotError(status, f"Chave recusada várias vezes (erro {status}: {riot_msg}).")
                    self.keystore.ask(
                        f"\nA Riot recusou a chave (erro {status}{': ' + riot_msg if riot_msg else ''}).\n"
                        "Chaves de desenvolvimento expiram a cada 24 horas."
                    )
                    continue
                if status == 404:
                    if allow_404:
                        return None
                    raise RiotError(404, f"Não encontrado: {path}")
                if status == 429:
                    retry = e.headers.get("Retry-After")
                    wait = int(retry) if retry and retry.isdigit() else 10
                    log(f"   limite da Riot atingido, aguardando {wait}s...")
                    time.sleep(wait + 1)
                    continue
                if 500 <= status < 600:
                    attempt += 1
                    if attempt > 5:
                        raise RiotError(status, f"Falha do servidor da Riot ({status}) em {path}")
                    wait = min(60, 2 ** attempt)
                    log(f"   servidor da Riot respondeu {status}, nova tentativa em {wait}s...")
                    time.sleep(wait)
                    continue
                raise RiotError(status, f"Erro HTTP {status} em {path}{': ' + riot_msg if riot_msg else ''}")
            except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                attempt += 1
                if attempt > 5:
                    raise RiotError(0, f"Sem conexão com a Riot: {e}")
                wait = min(60, 2 ** attempt)
                log(f"   problema de conexão ({e}), nova tentativa em {wait}s...")
                time.sleep(wait)

    # Endpoints ---------------------------------------------------------------

    def account_by_riot_id(self, game_name, tag_line):
        gn = urllib.parse.quote(game_name, safe="")
        tl = urllib.parse.quote(tag_line, safe="")
        return self.get(f"/riot/account/v1/accounts/by-riot-id/{gn}/{tl}")

    def match_ids(self, puuid, start=0, count=100, start_time=None, queue=None):
        params = {"start": start, "count": count}
        if start_time:
            params["startTime"] = int(start_time)
        if queue:
            params["queue"] = int(queue)
        return self.get(f"/lol/match/v5/matches/by-puuid/{puuid}/ids", params)

    def match(self, match_id):
        return self.get(f"/lol/match/v5/matches/{match_id}", allow_404=True)

    def timeline(self, match_id):
        return self.get(f"/lol/match/v5/matches/{match_id}/timeline", allow_404=True)

    def summoner(self, puuid):
        return self.get(f"/lol/summoner/v4/summoners/by-puuid/{puuid}", host=self.platform, optional=True)

    def league_entries(self, puuid, summoner_id=None):
        r = self.get(f"/lol/league/v4/entries/by-puuid/{puuid}", host=self.platform, optional=True)
        if r is None and summoner_id:
            r = self.get(f"/lol/league/v4/entries/by-summoner/{summoner_id}", host=self.platform, optional=True)
        return r


# ----------------------------------------------------------------------------
# Data Dragon (público, sem chave)
# ----------------------------------------------------------------------------

def http_get_public(url, binary=False, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": f"JunglePerformanceAnalytics/{VERSION}"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
                return data if binary else json.loads(data.decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(1 + i)
        except Exception:
            time.sleep(1 + i)
    return None


class DataDragon:
    def __init__(self, lang="pt_BR", offline=False):
        self.lang = lang
        self.offline = offline
        self.versions = None

    def get_versions(self):
        if self.versions is not None:
            return self.versions
        path = os.path.join(DD_DIR, "versions.json")
        cached = load_json(path)
        fresh = None if self.offline else http_get_public(f"{DDRAGON}/api/versions.json")
        if fresh:
            save_json(path, fresh)
            self.versions = fresh
        else:
            self.versions = cached or []
        return self.versions

    def version_for_patch(self, patch):
        """'16.20' -> '16.20.1' (primeira versão do Data Dragon desse patch)."""
        for v in self.get_versions():
            if v.startswith(patch + "."):
                return v
        return None

    def _data(self, version, name):
        path = os.path.join(DD_DIR, version, f"{self.lang}_{name}.json")
        cached = load_json(path)
        if cached is not None:
            return cached
        if self.offline:
            return None
        url = f"{DDRAGON}/cdn/{version}/data/{self.lang}/{name}.json"
        data = http_get_public(url)
        if data is not None:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            save_json(path, data)
        return data

    def items(self, version):
        return self._data(version, "item")

    def champions(self, version):
        return self._data(version, "champion")

    def runes(self, version):
        return self._data(version, "runesReforged")

    def rune_stat_texts(self, version):
        """Textos dos valores de fim de partida das runas ("Total de dano: @eogvar1@"),
        do Community Dragon, no idioma do config (com inglês como reserva)."""
        lang = (self.lang or "pt_BR").lower()
        tag = version or "latest"
        path = os.path.join(DD_DIR, tag, f"cdragon_perks_{lang}.json")
        data = load_json(path)
        if data is None and not self.offline:
            for loc in ([lang] if lang != "en_us" else []) + ["default"]:
                data = http_get_public(f"{CDRAGON_GAME_DATA}/{loc}/v1/perks.json", retries=2)
                if isinstance(data, list) and data:
                    os.makedirs(os.path.dirname(path), exist_ok=True)
                    save_json(path, data)
                    break
                data = None
        if data is None:  # sem internet: usa o último arquivo salvo de qualquer versão
            for v in sorted(os.listdir(DD_DIR) if os.path.isdir(DD_DIR) else [], reverse=True):
                data = load_json(os.path.join(DD_DIR, v, f"cdragon_perks_{lang}.json"))
                if data is not None:
                    break
        out = {}
        for pk in data or []:
            descs = [d for d in (pk.get("endOfGameStatDescs") or []) if isinstance(d, str) and d.strip()]
            if pk.get("id") and descs:
                out[str(pk["id"])] = descs
        return out

    def spells(self, version):
        return self._data(version, "summoner")

    def icon(self, kind, version, key):
        """Baixa (com cache) um ícone e devolve data URI."""
        if kind == "item":
            url = f"{DDRAGON}/cdn/{version}/img/item/{key}.png"
        elif kind == "champion":
            url = f"{DDRAGON}/cdn/{version}/img/champion/{key}.png"
        elif kind == "spell":
            url = f"{DDRAGON}/cdn/{version}/img/spell/{key}.png"
        elif kind == "rune":
            url = f"{DDRAGON}/cdn/img/{key}"
        else:
            return None
        safe = urllib.parse.quote(f"{kind}_{key}", safe="").replace("%", "_")
        path = os.path.join(DD_DIR, "icons", safe + ".png")
        raw = None
        if os.path.exists(path):
            with open(path, "rb") as f:
                raw = f.read()
        elif not self.offline:
            raw = http_get_public(url, binary=True)
            if raw:
                os.makedirs(os.path.dirname(path), exist_ok=True)
                with open(path, "wb") as f:
                    f.write(raw)
        if not raw:
            return None
        return to_data_uri(raw)


def _lanczos(Image):
    """Filtro de redução nítido, compatível com Pillow antiga e nova."""
    return getattr(getattr(Image, "Resampling", Image), "LANCZOS", 1)


ICON_MAX = 128  # o maior ícone do painel aparece com 84 px; 128 deixa nítido também em telas com zoom


def to_data_uri(png_bytes, size=ICON_MAX):
    """Converte o ícone para WebP de alta qualidade, sem perder resolução.
    Só reduz ícones maiores que `size`. Sem a Pillow, usa o PNG original."""
    try:
        from PIL import Image  # opcional
        im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
        if max(im.size) > size:
            im.thumbnail((size, size), _lanczos(Image))
        buf = io.BytesIO()
        im.save(buf, format="WEBP", quality=94, method=6)
        out = buf.getvalue()
        if len(out) < len(png_bytes) or max(im.size) < max(Image.open(io.BytesIO(png_bytes)).size):
            return "data:image/webp;base64," + base64.b64encode(out).decode("ascii")
    except Exception:
        pass
    return "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")


def classify_items(item_json):
    """Marca itens 'completos' (lendários), botas e demais.
    Regra documentada:
      completo = comprável no Summoner's Rift, sem evolução comprável,
                 custo total >= 2000, não é consumível, amuleto ou bota."""
    out = {}
    if not item_json:
        return out
    data = item_json.get("data", {})
    for sid, it in data.items():
        gold = it.get("gold", {}) or {}
        tags = it.get("tags", []) or []
        maps = it.get("maps", {}) or {}
        into = it.get("into", []) or []
        purchasable_into = [i for i in into if (data.get(i, {}).get("gold", {}) or {}).get("purchasable")
                            and not data.get(i, {}).get("requiredAlly")]
        final = len(purchasable_into) == 0
        total = gold.get("total", 0) or 0
        is_boots = "Boots" in tags
        consumable = "Consumable" in tags or bool(it.get("consumed"))
        trinket = "Trinket" in tags
        on_sr = maps.get("11", True)
        purchasable = bool(gold.get("purchasable"))
        completed = (final and purchasable and on_sr and total >= 2000
                     and not is_boots and not consumable and not trinket)
        boots_done = is_boots and total >= 900 and purchasable
        out[int(sid)] = {
            "name": it.get("name", f"Item {sid}"),
            "gold": total,
            "completed": completed,
            "boots": bool(boots_done),
            "tags": tags,
            "from": [int(x) for x in (it.get("from") or []) if str(x).isdigit()],
        }
    return out


# ----------------------------------------------------------------------------
# Processamento: dados brutos da API -> formato compacto do dashboard
# ----------------------------------------------------------------------------

def patch_of(game_version):
    parts = (game_version or "").split(".")
    return ".".join(parts[:2]) if len(parts) >= 2 else (game_version or "?")


def duration_seconds(info):
    d = info.get("gameDuration", 0) or 0
    # Antes do patch 11.20 o valor vinha em milissegundos
    if "gameEndTimestamp" not in info and d > 100000:
        d = d / 1000.0
    return int(round(d))


def runes_of(p):
    perks = p.get("perks") or {}
    styles = perks.get("styles") or []
    prim = next((s for s in styles if s.get("description") == "primaryStyle"), styles[0] if styles else {})
    sub = next((s for s in styles if s.get("description") == "subStyle"), styles[1] if len(styles) > 1 else {})
    stat = perks.get("statPerks") or {}
    # Valores de fim de partida de cada runa (o mesmo que o cliente mostra em Runas:
    # dano causado, ouro, cura, tempo...). O texto de cada valor vem de meta.runeStats.
    rvars = {}
    for st in (prim, sub):
        for sel in st.get("selections") or []:
            vals = [sel.get("var1"), sel.get("var2"), sel.get("var3")]
            if sel.get("perk") and any(v is not None for v in vals):
                rvars[str(sel["perk"])] = vals
    return {
        "primaryStyle": prim.get("style"),
        "subStyle": sub.get("style"),
        "primary": [s.get("perk") for s in (prim.get("selections") or [])],
        "secondary": [s.get("perk") for s in (sub.get("selections") or [])],
        "shards": [stat.get("offense"), stat.get("flex"), stat.get("defense")],
        "vars": rvars,
    }


def riot_id_of(p):
    name = p.get("riotIdGameName") or p.get("summonerName") or ""
    tag = p.get("riotIdTagline") or ""
    return f"{name}#{tag}" if tag else name


def full_participant(p):
    ch = p.get("challenges") or {}
    return {
        "pid": p.get("participantId"),
        "puuid": p.get("puuid"),
        "riotId": riot_id_of(p),
        "teamId": p.get("teamId"),
        "championId": p.get("championId"),
        "championName": p.get("championName"),
        "position": p.get("teamPosition") or "",
        "individualPosition": p.get("individualPosition") or "",
        "win": bool(p.get("win")),
        "k": p.get("kills", 0), "d": p.get("deaths", 0), "a": p.get("assists", 0),
        "cs": p.get("totalMinionsKilled", 0),
        "jcs": p.get("neutralMinionsKilled", 0),
        "gold": p.get("goldEarned", 0),
        "goldSpent": p.get("goldSpent", 0),
        "dmg": p.get("totalDamageDealtToChampions", 0),
        "dmgTaken": p.get("totalDamageTaken", 0),
        "selfMitigated": p.get("damageSelfMitigated"),
        "heal": p.get("totalHeal"),
        "healAllies": p.get("totalHealsOnTeammates"),
        "shieldAllies": p.get("totalDamageShieldedOnTeammates"),
        "vision": p.get("visionScore", 0),
        "wards": p.get("wardsPlaced"),
        "objDmg": p.get("damageDealtToObjectives"),
        "cc": p.get("timeCCingOthers"),
        "multi": p.get("largestMultiKill"),
        "level": p.get("champLevel", 0),
        "xp": p.get("champExperience"),
        "items": [p.get(f"item{i}", 0) for i in range(7)],
        "spells": [p.get("summoner1Id"), p.get("summoner2Id")],
        "runes": runes_of(p),
        "dragonKills": p.get("dragonKills"),
        "baronKills": p.get("baronKills"),
        "objectivesStolen": p.get("objectivesStolen"),
        "timeDead": p.get("totalTimeSpentDead"),
        "earlySurrender": bool(p.get("gameEndedInEarlySurrender")),
        "challenges": {k: ch.get(k) for k in CHALLENGE_KEYS if k in ch},
    }


# Elo atual dos outros jogadores (Solo/Duo), por PUUID. Preenchido por update_player_ranks.
PLAYER_RANKS = {}


def keystone_of(p):
    styles = (p.get("perks") or {}).get("styles") or []
    prim = next((s for s in styles if s.get("description") == "primaryStyle"), styles[0] if styles else {})
    sub = next((s for s in styles if s.get("description") == "subStyle"), styles[1] if len(styles) > 1 else {})
    sel = prim.get("selections") or []
    return (sel[0].get("perk") if sel else None), sub.get("style")


def light_participant(p):
    keystone, sub_style = keystone_of(p)
    known = PLAYER_RANKS.get(p.get("puuid"))
    rank = (known.get("solo") or {"tier": None}) if known else None
    out = {
        "pid": p.get("participantId"),
        "teamId": p.get("teamId"),
        "championId": p.get("championId"),
        "championName": p.get("championName"),
        "riotId": riot_id_of(p),
        "position": p.get("teamPosition") or "",
        "k": p.get("kills", 0), "d": p.get("deaths", 0), "a": p.get("assists", 0),
        "gold": p.get("goldEarned", 0),
        "dmg": p.get("totalDamageDealtToChampions", 0),
        "dmgTaken": p.get("totalDamageTaken", 0),
        "selfMitigated": p.get("damageSelfMitigated"),
        "objDmg": p.get("damageDealtToObjectives"),
        "cc": p.get("timeCCingOthers"),
        "vision": p.get("visionScore", 0),
        "wards": p.get("wardsPlaced"),
        "multi": p.get("largestMultiKill"),
        "cs": (p.get("totalMinionsKilled", 0) or 0) + (p.get("neutralMinionsKilled", 0) or 0),
        "level": p.get("champLevel", 0),
        "items": [p.get(f"item{i}", 0) for i in range(7)],
        "spells": [p.get("summoner1Id"), p.get("summoner2Id")],
        "keystone": keystone, "subStyle": sub_style,
        "win": bool(p.get("win")),
    }
    if rank:
        out["rank"] = rank
    return out


def find_enemy_jungler(participants, me):
    enemies = [p for p in participants if p.get("teamId") != me.get("teamId")]
    by_pos = [p for p in enemies if p.get("teamPosition") == "JUNGLE"]
    if len(by_pos) == 1:
        return by_pos[0], "position"
    smite = [p for p in enemies if 11 in (p.get("summoner1Id"), p.get("summoner2Id"))]
    if len(smite) == 1:
        return smite[0], "smite"
    return None, None


TIMELINE_EVENT_TYPES = {
    "ITEM_PURCHASED", "ITEM_SOLD", "ITEM_DESTROYED", "ITEM_UNDO",
    "CHAMPION_KILL", "ELITE_MONSTER_KILL", "BUILDING_KILL", "DRAGON_SOUL_GIVEN",
    "WARD_PLACED", "TURRET_PLATE_DESTROYED",
}
LANE_SNAP_MINUTES = (5, 10, 15, 20)


def compact_timeline(tl, me_pid, opp_pid, pid_team):
    info = (tl or {}).get("info") or {}
    frames = info.get("frames") or []
    if not frames:
        return None

    def frow(pf, ts):
        pos = pf.get("position") or {}
        return [
            int(round(ts / 1000)),
            pf.get("totalGold"), pf.get("currentGold"), pf.get("xp"), pf.get("level"),
            pf.get("minionsKilled"), pf.get("jungleMinionsKilled"),
            pos.get("x"), pos.get("y"),
        ]

    me_rows, opp_rows, team_rows = [], [], []
    items, kills, elite, buildings, souls = [], [], [], [], []
    wards, plates, lanes = [], [], {}
    for fr in frames:
        ts = fr.get("timestamp", 0) or 0
        pfs = fr.get("participantFrames") or {}
        mf = pfs.get(str(me_pid))
        if mf:
            me_rows.append(frow(mf, ts))
        if opp_pid:
            of = pfs.get(str(opp_pid))
            if of:
                opp_rows.append(frow(of, ts))
        tg = {100: [0, 0], 200: [0, 0]}
        for spid, pf in pfs.items():
            team = pid_team.get(int(spid))
            if team in tg:
                tg[team][0] += pf.get("totalGold", 0) or 0
                tg[team][1] += pf.get("xp", 0) or 0
        team_rows.append([int(round(ts / 1000)), tg[100][0], tg[200][0], tg[100][1], tg[200][1]])
        # Ouro, nível e farm dos 10 jogadores em alguns minutos (estado de cada lane)
        minute = int(round(ts / 60000))
        if minute in LANE_SNAP_MINUTES and str(minute) not in lanes:
            lanes[str(minute)] = [[int(spid), pf.get("totalGold"), pf.get("level"),
                                   (pf.get("minionsKilled") or 0) + (pf.get("jungleMinionsKilled") or 0)]
                                  for spid, pf in sorted(pfs.items(), key=lambda kv: int(kv[0]))]

        for ev in fr.get("events") or []:
            t = ev.get("type")
            if t not in TIMELINE_EVENT_TYPES:
                continue
            ets = round((ev.get("timestamp", 0) or 0) / 1000.0, 1)
            if t in ("ITEM_PURCHASED", "ITEM_SOLD", "ITEM_DESTROYED"):
                if ev.get("participantId") == me_pid:
                    items.append([ets, t[5], ev.get("itemId")])  # P, S, D
            elif t == "ITEM_UNDO":
                if ev.get("participantId") == me_pid:
                    items.append([ets, "U", ev.get("beforeId"), ev.get("afterId")])
            elif t == "CHAMPION_KILL":
                pos = ev.get("position") or {}
                kills.append([ets, ev.get("killerId"), ev.get("victimId"),
                              ev.get("assistingParticipantIds") or [], pos.get("x"), pos.get("y"),
                              ev.get("bounty"), ev.get("shutdownBounty")])
            elif t == "ELITE_MONSTER_KILL":
                pos = ev.get("position") or {}
                elite.append([ets, ev.get("monsterType"), ev.get("monsterSubType"),
                              ev.get("killerTeamId"), ev.get("killerId"),
                              ev.get("assistingParticipantIds") or [], pos.get("x"), pos.get("y")])
            elif t == "BUILDING_KILL":
                pos = ev.get("position") or {}
                buildings.append([ets, ev.get("buildingType"), ev.get("laneType"), ev.get("towerType"),
                                  ev.get("teamId"), ev.get("killerId"), pos.get("x"), pos.get("y"),
                                  ev.get("assistingParticipantIds") or []])
            elif t == "TURRET_PLATE_DESTROYED":
                pos = ev.get("position") or {}
                plates.append([ets, ev.get("killerId"), ev.get("laneType"), ev.get("teamId"), pos.get("x"), pos.get("y")])
            elif t == "WARD_PLACED":
                who = ev.get("creatorId")
                if who in (me_pid, opp_pid):
                    wards.append([ets, 0 if who == me_pid else 1, ev.get("wardType")])
            elif t == "DRAGON_SOUL_GIVEN":
                souls.append([ets, ev.get("teamId"), ev.get("name")])

    return {
        "frameInterval": info.get("frameInterval", 60000),
        "frameCols": ["t", "totalGold", "currentGold", "xp", "level", "cs", "jcs", "x", "y"],
        "me": me_rows,
        "opp": opp_rows,
        "teamCols": ["t", "goldBlue", "goldRed", "xpBlue", "xpRed"],
        "team": team_rows,
        "itemCols": ["t", "type(P=compra,S=venda,D=destruído,U=desfeito)", "itemId", "afterId(U)"],
        "items": items,
        "killCols": ["t", "killerPid", "victimPid", "assistPids", "x", "y", "bounty", "shutdown"],
        "kills": kills,
        "eliteCols": ["t", "monsterType", "subType", "killerTeamId", "killerPid", "assistPids", "x", "y"],
        "elite": elite,
        "buildingCols": ["t", "buildingType", "lane", "towerType", "ownerTeamId", "killerPid", "x", "y", "assistPids"],
        "buildings": buildings,
        "souls": souls,
        "plateCols": ["t", "killerPid", "lane", "ownerTeamId", "x", "y"],
        "plates": plates,
        "wardCols": ["t", "quem(0=você,1=jungler inimigo)", "wardType"],
        "wards": wards,
        "laneCols": ["pid", "totalGold", "level", "cs"],
        "lanes": lanes,
    }


def process_match(raw, raw_tl, my_puuids):
    """Converte a resposta da API em um registro compacto.
    Identifica você pelo PUUID (nunca pelo nome), então troca de Riot ID
    não quebra o histórico."""
    meta = raw.get("metadata") or {}
    info = raw.get("info") or {}
    parts = info.get("participants") or []
    me_raw = next((p for p in parts if p.get("puuid") in my_puuids), None)
    if me_raw is None:
        return None
    opp_raw, opp_how = find_enemy_jungler(parts, me_raw)
    pid_team = {p.get("participantId"): p.get("teamId") for p in parts}
    dur = duration_seconds(info)
    teams = []
    for t in info.get("teams") or []:
        obj = t.get("objectives") or {}
        teams.append({
            "teamId": t.get("teamId"),
            "win": bool(t.get("win")),
            "objectives": {k: {"first": bool(v.get("first")), "kills": v.get("kills", 0)} for k, v in obj.items()},
            "bans": [b.get("championId") for b in (t.get("bans") or [])],
        })
    team_kills = sum(p.get("kills", 0) or 0 for p in parts if p.get("teamId") == me_raw.get("teamId"))
    me = full_participant(me_raw)
    record = {
        "matchId": meta.get("matchId") or f"{info.get('platformId')}_{info.get('gameId')}",
        "platformId": info.get("platformId"),
        "gameCreation": info.get("gameCreation"),
        "gameStart": info.get("gameStartTimestamp") or info.get("gameCreation"),
        "gameEnd": info.get("gameEndTimestamp"),
        "duration": dur,
        "gameVersion": info.get("gameVersion"),
        "patch": patch_of(info.get("gameVersion")),
        "queueId": info.get("queueId"),
        "mapId": info.get("mapId"),
        "gameMode": info.get("gameMode"),
        "remake": bool(me_raw.get("gameEndedInEarlySurrender")) or dur < 300,
        "teamKills": team_kills,
        "me": me,
        "opp": full_participant(opp_raw) if opp_raw else None,
        "oppIdentifiedBy": opp_how,
        "participants": [light_participant(p) for p in parts],
        "teams": teams,
        "timeline": None,
    }
    if raw_tl:
        record["timeline"] = compact_timeline(
            raw_tl, me_raw.get("participantId"),
            opp_raw.get("participantId") if opp_raw else None, pid_team)
    return record


# ----------------------------------------------------------------------------
# Metadados (nomes em português + ícones) a partir do Data Dragon
# ----------------------------------------------------------------------------

def build_meta(records, dd, icon_mode="jungle"):
    versions = dd.get_versions()
    latest = versions[0] if versions else None
    patches = sorted({r["patch"] for r in records if r.get("patch")}, reverse=True)
    dd_versions = []
    for p in patches:
        v = dd.version_for_patch(p)
        if v and v not in dd_versions:
            dd_versions.append(v)
    if latest and latest not in dd_versions:
        dd_versions.insert(0, latest)
    if not dd_versions:
        log("Aviso: sem acesso ao Data Dragon e sem cache. Nomes e ícones ficarão genéricos.")
        return {"ddragonVersion": None, "items": {}, "champions": {}, "runes": {}, "runeStyles": {},
                "spells": {}, "shards": {str(k): v for k, v in STAT_SHARDS.items()},
                "icons": {"item": {}, "champion": {}, "rune": {}, "spell": {}}}

    # Itens: versão mais recente vence; versões antigas preenchem itens removidos
    items, item_ver = {}, {}
    for v in reversed(dd_versions):
        for iid, meta in classify_items(dd.items(v)).items():
            items[iid] = meta
            item_ver[iid] = v

    champs, champ_ver = {}, {}
    for v in reversed(dd_versions):
        cj = dd.champions(v) or {}
        for key, c in (cj.get("data") or {}).items():
            try:
                cid = int(c.get("key"))
            except (TypeError, ValueError):
                continue
            st = c.get("stats") or {}
            keep = ("hp", "hpperlevel", "attackdamage", "attackdamageperlevel", "armor", "armorperlevel",
                    "spellblock", "spellblockperlevel", "movespeed", "attackrange", "attackspeed", "attackspeedperlevel")
            champs[cid] = {"key": c.get("id", key), "name": c.get("name", key), "tags": c.get("tags", []),
                           "stats": {k: st[k] for k in keep if k in st}}
            champ_ver[cid] = v

    runes, styles = {}, {}
    for v in reversed(dd_versions):
        for st in dd.runes(v) or []:
            styles[st["id"]] = {"name": st.get("name"), "icon": st.get("icon")}
            for si, slot in enumerate(st.get("slots") or []):
                for r in slot.get("runes") or []:
                    runes[r["id"]] = {"name": r.get("name"), "style": st["id"], "slot": si, "icon": r.get("icon")}

    spells, spell_ver = {}, {}
    for v in reversed(dd_versions):
        sj = dd.spells(v) or {}
        for key, s in (sj.get("data") or {}).items():
            try:
                sid = int(s.get("key"))
            except (TypeError, ValueError):
                continue
            spells[sid] = {"key": s.get("id", key), "name": s.get("name", key)}
            spell_ver[sid] = v

    # Quais ícones embutir (só o que aparece nas suas partidas)
    used_items, used_champs, used_runes, used_spells = set(), set(), set(), set()
    # Placar: campeões, feitiços e runas dos 10 jogadores. Nas referências entram todos os jogos
    # (para as "Partidas para estudar"), sem os itens dos outros jogadores.
    if icon_mode == "refs":
        for r in records:
            for p in r.get("participants") or []:
                if p.get("championId"):
                    used_champs.add(p["championId"])
                used_spells.update(x for x in (p.get("spells") or []) if x)
                for x in (p.get("keystone"), p.get("subStyle")):
                    if x:
                        used_runes.add(x)
            for t in r.get("teams") or []:
                used_champs.update(b for b in (t.get("bans") or []) if b and b > 0)
    if icon_mode != "refs":
        for r in records[:40]:
            for p in r.get("participants") or []:
                if p.get("championId"):
                    used_champs.add(p["championId"])
                used_spells.update(x for x in (p.get("spells") or []) if x)
                for x in (p.get("keystone"), p.get("subStyle")):
                    if x:
                        used_runes.add(x)
                used_items.update(i for i in (p.get("items") or []) if i)
            for t in r.get("teams") or []:
                used_champs.update(b for b in (t.get("bans") or []) if b and b > 0)
    for r in records:
        me, opp = r["me"], r.get("opp")
        for who in (me, opp):
            if not who:
                continue
            used_champs.add(who["championId"])
            used_items.update(i for i in who["items"] if i)
        for row in (r.get("timeline") or {}).get("items") or []:
            if len(row) >= 3 and row[2]:
                used_items.add(row[2])
        used_spells.update(s for s in me["spells"] if s)
        ru = me["runes"]
        used_runes.update(x for x in (ru["primary"] + ru["secondary"]) if x)
        for sid in (ru["primaryStyle"], ru["subStyle"]):
            if sid:
                used_runes.add(sid)
        if icon_mode == "todos":
            used_champs.update(p["championId"] for p in r["participants"])

    icons = {"item": {}, "champion": {}, "rune": {}, "spell": {}}
    total = len(used_items) + len(used_champs) + len(used_runes) + len(used_spells)
    log(f"Preparando {total} ícones (nomes em português pelo Data Dragon)...")
    for iid in sorted(used_items):
        if iid in items:
            u = dd.icon("item", item_ver.get(iid, latest), iid)
            if u:
                icons["item"][str(iid)] = u
    for cid in sorted(used_champs):
        c = champs.get(cid)
        if c:
            u = dd.icon("champion", champ_ver.get(cid, latest), c["key"])
            if u:
                icons["champion"][str(cid)] = u
    for rid in sorted(used_runes):
        meta = runes.get(rid) or styles.get(rid)
        if meta and meta.get("icon"):
            u = dd.icon("rune", None, meta["icon"])
            if u:
                icons["rune"][str(rid)] = u
    for sid in sorted(used_spells):
        s = spells.get(sid)
        if s:
            u = dd.icon("spell", spell_ver.get(sid, latest), s["key"])
            if u:
                icons["spell"][str(sid)] = u

    return {
        "ddragonVersion": latest,
        "items": {str(k): v for k, v in items.items() if k in used_items},
        "champions": {str(k): v for k, v in champs.items()},
        "runes": {str(k): {kk: vv for kk, vv in v.items() if kk != "icon"} for k, v in runes.items()},
        "runeStyles": {str(k): {"name": v["name"]} for k, v in styles.items()},
        "runeStats": {k: v for k, v in dd.rune_stat_texts(latest).items() if int(k) in runes},
        "spells": {str(k): {"name": v["name"]} for k, v in spells.items()},
        "shards": {str(k): v for k, v in STAT_SHARDS.items()},
        "icons": icons,
        "itemRule": "completo = comprável no SR, sem evolução comprável, custo >= 2000, não é bota/consumível/amuleto",
    }



# ----------------------------------------------------------------------------
# Perfil, elo e imagens (opcionais: se falharem, a coleta segue normal)
# ----------------------------------------------------------------------------

def fetch_profile(client, puuid):
    out = {"fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat()}
    try:
        s = client.summoner(puuid) or {}
        if s:
            out["profileIconId"] = s.get("profileIconId")
            out["summonerLevel"] = s.get("summonerLevel")
        entries = client.league_entries(puuid, s.get("id"))
        if isinstance(entries, list):
            out["ranked"] = {}
            for e in entries:
                q = e.get("queueType")
                if q:
                    out["ranked"][q] = {"tier": e.get("tier"), "rank": e.get("rank"), "lp": e.get("leaguePoints"),
                                        "wins": e.get("wins"), "losses": e.get("losses"), "hotStreak": bool(e.get("hotStreak"))}
    except RiotError as e:
        log(f"   (não consegui ler elo/ícone: {e})")
    return out


def record_elo(profile):
    """Guarda um ponto no histórico de elo sempre que o elo da Solo/Duo muda."""
    hist = load_json(ELO_PATH, []) or []
    solo = ((profile or {}).get("ranked") or {}).get("RANKED_SOLO_5x5")
    if not solo or not solo.get("tier"):
        return hist
    point = {"t": profile.get("fetchedAt"), "tier": solo["tier"], "rank": solo.get("rank"), "lp": solo.get("lp"),
             "wins": solo.get("wins"), "losses": solo.get("losses"), "source": "coletor"}
    last = hist[-1] if hist else None
    same = last and all(last.get(k) == point[k] for k in ("tier", "rank", "lp", "wins", "losses"))
    if not same:
        hist.append(point)
        save_json(ELO_PATH, hist, pretty=True)
    return hist


def visual_image(url, cache_name, max_w=None, square=None, quality=90, trim=False):
    """Baixa uma imagem pública (com cache) e devolve data URI reduzida (Pillow opcional).
    trim=True corta a área transparente antes de reduzir (os emblemas de elo vêm numa
    tela enorme e quase vazia; sem o corte, o emblema em si ficava com ~50 px)."""
    path = os.path.join(VISUAL_DIR, cache_name)
    raw = None
    if os.path.exists(path):
        with open(path, "rb") as f:
            raw = f.read()
    else:
        raw = http_get_public(url, binary=True, retries=2)
        if raw:
            with open(path, "wb") as f:
                f.write(raw)
    if not raw:
        return None
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(raw))
        im = im.convert("RGBA") if square else im.convert("RGB")
        if trim and square:
            box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
            if box:
                im = im.crop(box)
        if square:
            if max(im.size) > square:
                im.thumbnail((square, square), _lanczos(Image))
        elif max_w and im.width > max_w:
            im = im.resize((max_w, round(im.height * max_w / im.width)), _lanczos(Image))
        buf = io.BytesIO()
        im.save(buf, format="WEBP", quality=quality, method=6)
        return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception:
        mime = "image/jpeg" if raw[:3] == b"\xff\xd8\xff" else "image/png"
        return f"data:{mime};base64," + base64.b64encode(raw).decode("ascii")


CLASS_ART = {"fighter": "Briar", "slayer": "Zed", "tank": "Leona", "mage": "Lux", "marksman": "Jinx", "controller": "Lulu", "specialist": "Teemo"}


def build_visuals(dd, records, profile, extra_tiers=()):
    """Splash do campeão mais jogado, ícone de invocador e emblemas de elo."""
    vis = {"splash": {}, "emblems": {}}
    versions = dd.get_versions() if not dd.offline else (load_json(os.path.join(DD_DIR, "versions.json")) or [])
    latest = versions[0] if versions else None
    counts = {}
    for r in records[:150]:
        if r.get("mapId") == 11 and r.get("me"):
            k = r["me"].get("championName")
            counts[k] = counts.get(k, 0) + 1
    for key in [k for k, _ in sorted(counts.items(), key=lambda kv: -kv[1])][:2]:
        u = visual_image(f"{DDRAGON}/cdn/img/champion/splash/{key}_0.jpg", f"splash_{key}_0.jpg", max_w=1920, quality=88)
        if u:
            vis["splash"][key] = u
    # Arte de carregamento de um campeão de cada classe, para o menu "Guia de cada classe" (aba Matchups)
    vis["classArt"] = {}
    for cls, key in CLASS_ART.items():
        u = visual_image(f"{DDRAGON}/cdn/img/champion/loading/{key}_0.jpg", f"loading_{key}_0.jpg", max_w=308, quality=80)
        if u:
            vis["classArt"][cls] = u
    icon_id = (profile or {}).get("profileIconId")
    if icon_id is not None and latest:
        u = visual_image(f"{DDRAGON}/cdn/{latest}/img/profileicon/{icon_id}.png", f"profileicon_{icon_id}.png", square=256, quality=94)
        if u:
            vis["profileIcon"] = u
    tiers = set(t.lower() for t in extra_tiers if t)
    solo = ((profile or {}).get("ranked") or {}).get("RANKED_SOLO_5x5") or {}
    if solo.get("tier"):
        tiers.add(solo["tier"].lower())
    for tier in sorted(tiers):
        for pattern in EMBLEM_URLS:
            u = visual_image(pattern.format(tier=tier), f"emblem_{tier}.png", square=480, quality=94, trim=True)
            if u:
                vis["emblems"][tier.upper()] = u
                break
    got = [k for k in ("profileIcon",) if vis.get(k)] + [f"splash {k}" for k in vis["splash"]] + [f"emblema {k}" for k in vis["emblems"]] + ([f"{len(vis['classArt'])} artes de classe"] if vis.get("classArt") else [])
    log(f"Imagens do perfil: {', '.join(got) if got else 'nenhuma (o dashboard usa o visual padrão)'}")
    return vis


def import_old_cache():
    """Se esta pasta for nova, reaproveita o cache das versões anteriores do coletor
    (partidas, referências, imagens, histórico de elo e a chave mais recente)."""
    import shutil
    def count(c):
        pm = os.path.join(c, "dados", "cache", "partidas")
        return len([f for f in os.listdir(pm) if f.endswith(".json.gz")]) if os.path.isdir(pm) else 0
    here = count(BASE_DIR)
    if here >= 50:
        return
    root = os.path.dirname(os.path.dirname(BASE_DIR))
    found = []
    try:
        for name in os.listdir(root):
            d = os.path.join(root, name)
            if not os.path.isdir(d) or "coletor" not in name.lower():
                continue
            for c in (os.path.join(d, "jungle-coletor"), d):
                if os.path.abspath(c) != os.path.abspath(BASE_DIR) and os.path.isdir(os.path.join(c, "dados")):
                    found.append(c)
    except OSError:
        return
    found = sorted(set(found), key=count, reverse=True)
    if not found or count(found[0]) <= here:
        return
    log(f"Achei {len(found)} pasta(s) anterior(es) do coletor (a maior com {count(found[0])} partidas).")
    log("Copiando o cache para esta pasta, para não baixar tudo de novo...")
    copied = 0
    for best in found:
        for sub in (("dados", "cache"), ("dados", "referencias"), ("dados", "ddragon")):
            src, dst = os.path.join(best, *sub), os.path.join(BASE_DIR, *sub)
            if not os.path.isdir(src):
                continue
            for dirpath, _, files in os.walk(src):
                target_dir = os.path.join(dst, os.path.relpath(dirpath, src))
                os.makedirs(target_dir, exist_ok=True)
                for fn in files:
                    t = os.path.join(target_dir, fn)
                    if not os.path.exists(t):
                        shutil.copy2(os.path.join(dirpath, fn), t)
                        copied += 1
        src = os.path.join(best, "dados", "elo_historico.json")
        if os.path.exists(src) and not os.path.exists(ELO_PATH):
            shutil.copy2(src, ELO_PATH)
    keys = [os.path.join(c, "chave_api.txt") for c in found if os.path.exists(os.path.join(c, "chave_api.txt"))]
    if keys and not os.path.exists(KEY_PATH):
        shutil.copy2(max(keys, key=os.path.getmtime), KEY_PATH)
        log("Usei a chave salva mais recente das pastas anteriores.")
    toks = [os.path.join(c, "github_token.txt") for c in found if os.path.exists(os.path.join(c, "github_token.txt"))]
    if toks and not os.path.exists(GH_TOKEN_PATH):
        shutil.copy2(max(toks, key=os.path.getmtime), GH_TOKEN_PATH)
        log("Usei o token do site salvo na pasta anterior.")
    log(f"Pronto: {copied} arquivos copiados.")


# ----------------------------------------------------------------------------
# Site público (GitHub Pages): envia os arquivos da pasta saida para o repositório
# ----------------------------------------------------------------------------

GH_TOKEN_RE = re.compile(r"(github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})")
GH_TOKEN_PLACEHOLDER = "Apague esta linha, cole aqui o token do GitHub (github_pat_...) e salve com Ctrl+S.\n"
GH_API = os.environ.get("JPA_GITHUB_API", "https://api.github.com").rstrip("/")


def load_github_token():
    env = GH_TOKEN_RE.search(os.environ.get("GITHUB_TOKEN", "") or "")
    if env:
        return env.group(0)
    try:
        with open(GH_TOKEN_PATH, "r", encoding="utf-8-sig", errors="ignore") as f:
            m = GH_TOKEN_RE.search(f.read())
        return m.group(0) if m else None
    except FileNotFoundError:
        return None


def ask_github_token():
    """Abre o github_token.txt no Bloco de Notas para colar o token (Windows)."""
    log("Crie o token em https://github.com/settings/personal-access-tokens/new")
    log("(Only select repositories -> o repositório do site; Permissions -> Contents: Read and write).")
    if os.name != "nt":
        log(f"Depois cole o token no arquivo {GH_TOKEN_PATH}.")
        return load_github_token()
    if not load_github_token():
        with open(GH_TOKEN_PATH, "w", encoding="utf-8") as f:
            f.write(GH_TOKEN_PLACEHOLDER)
    try:
        subprocess.Popen(["notepad.exe", GH_TOKEN_PATH])
        log(">> Abri o arquivo github_token.txt no Bloco de Notas.")
        log(">> Cole o token no lugar do texto que está lá, salve (Ctrl+S) e feche.")
        for _ in range(5):
            try:
                input(">> Depois de salvar, volte aqui e aperte Enter... ")
            except (EOFError, KeyboardInterrupt):
                raise SystemExit("\nCancelado.")
            t = load_github_token()
            if t:
                log("Token encontrado. Continuando...")
                return t
            log("Ainda não encontrei um token válido no arquivo (começa com github_pat_). Confira se salvou.")
    except OSError:
        pass
    return None


class GitHubError(Exception):
    def __init__(self, status, msg):
        super().__init__(msg)
        self.status = status


def gh_request(token, method, path, body=None, timeout=60):
    url = path if path.startswith("http") else GH_API + path
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28", "User-Agent": f"JunglePerformanceAnalytics/{VERSION}"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    last = None
    for attempt in range(3):
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
                return json.loads(raw.decode("utf-8")) if raw else {}
        except urllib.error.HTTPError as e:
            try:
                msg = json.loads(e.read().decode("utf-8")).get("message", "")
            except Exception:
                msg = ""
            if e.code >= 500 and attempt < 2:
                time.sleep(2 + attempt * 3)
                last = GitHubError(e.code, msg)
                continue
            raise GitHubError(e.code, msg)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last = GitHubError(0, str(e))
            if attempt < 2:
                time.sleep(2 + attempt * 3)
                continue
    raise last or GitHubError(0, "sem resposta")


def git_blob_sha(data):
    import hashlib
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


SITE_STATE_PATH = os.path.join(BASE_DIR, "dados", "site_publicado.json")


def stable_hash(data):
    """Hash do conteúdo sem os campos que mudam a cada execução (data de geração, hora da consulta do perfil)."""
    import hashlib
    try:
        obj = json.loads(data.decode("utf-8"))
        if isinstance(obj, dict):
            obj.pop("generatedAt", None)
            if isinstance(obj.get("profile"), dict):
                obj["profile"] = {k: v for k, v in obj["profile"].items() if k != "fetchedAt"}
        data = json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    except Exception:
        pass
    return hashlib.sha1(data).hexdigest()


def publish_site(cfg, names=None, ask=False):
    """Envia os arquivos da pasta saida para o repositório do site num único commit.
    Só envia o que mudou. Devolve True se o site ficou atualizado (ou já estava)."""
    repo = (cfg.get("site_repositorio") or "").strip().strip("/")
    if not repo or "/" not in repo:
        return False
    token = load_github_token()
    if not token:
        if not ask:
            log("")
            log("Site: para atualizar o site automaticamente, rode publicar_site.bat uma vez e cole o token do GitHub.")
            return False
        token = ask_github_token()
        if not token:
            log("Site: sem token, não enviei nada.")
            return False
    branch = cfg.get("site_branch") or "main"
    folder = (cfg.get("site_pasta_dados") or "dados").strip("/")
    names = names or ["jungle_data.json", "referencias_challenger.json", "referencias_briar.json"]
    files = []
    for n in names:
        p = os.path.join(OUT_DIR, n)
        if os.path.exists(p):
            with open(p, "rb") as f:
                data = f.read()
            if len(data) > 95 * 1024 * 1024:
                log(f"Site: {n} tem {len(data) / 1048576:.0f} MB, acima do limite do GitHub (100 MB). Não enviei.")
                continue
            files.append((f"{folder}/{n}", data))
    if not files:
        log("Site: nenhum arquivo na pasta saida para enviar.")
        return False
    log("")
    log(f"Atualizando o site ({repo})...")
    base = f"/repos/{repo}"
    state = load_json(SITE_STATE_PATH, {}) or {}
    keep_history = bool(cfg.get("site_manter_historico"))
    try:
        for attempt in range(2):
            ref = gh_request(token, "GET", f"{base}/git/ref/heads/{urllib.parse.quote(branch)}")
            head = ref["object"]["sha"]
            commit = gh_request(token, "GET", f"{base}/git/commits/{head}")
            tree = gh_request(token, "GET", f"{base}/git/trees/{commit['tree']['sha']}?recursive=1")
            remote = {e["path"]: e["sha"] for e in tree.get("tree", []) if e.get("type") == "blob"}
            changed = []
            for path, data in files:
                if remote.get(path) == git_blob_sha(data):
                    continue
                prev = state.get(path) or {}
                # Mesmo conteúdo do último envio (só mudou a data de geração): não precisa enviar de novo
                if prev.get("blob") and prev.get("blob") == remote.get(path) and prev.get("hash") == stable_hash(data):
                    continue
                changed.append((path, data))
            if not changed:
                log("Site: os arquivos já estavam atualizados.")
                return True
            entries = []
            for path, data in changed:
                log(f"   enviando {path} ({len(data) / 1048576:.1f} MB)...")
                blob = gh_request(token, "POST", f"{base}/git/blobs",
                                  {"content": base64.b64encode(data).decode("ascii"), "encoding": "base64"}, timeout=600)
                entries.append({"path": path, "mode": "100644", "type": "blob", "sha": blob["sha"]})
            new_tree = gh_request(token, "POST", f"{base}/git/trees", {"base_tree": commit["tree"]["sha"], "tree": entries})
            when = dt.datetime.now().strftime("%d/%m/%Y %H:%M")
            new_commit = gh_request(token, "POST", f"{base}/git/commits", {
                "message": f"Atualiza os dados do site ({when}, coletor v{VERSION})",
                "tree": new_tree["sha"], "parents": [head] if keep_history else []})
            try:
                gh_request(token, "PATCH", f"{base}/git/refs/heads/{urllib.parse.quote(branch)}",
                           {"sha": new_commit["sha"], "force": not keep_history})
            except GitHubError as e:
                if e.status == 422 and attempt == 0:
                    log("   o site mudou enquanto eu enviava; tentando de novo...")
                    continue
                raise
            for (path, data), entry in zip(changed, entries):
                state[path] = {"blob": entry["sha"], "hash": stable_hash(data), "at": dt.datetime.now().isoformat(timespec="seconds")}
            for path, data in files:
                if path not in state or state[path].get("blob") != remote.get(path):
                    if remote.get(path) == git_blob_sha(data):
                        state[path] = {"blob": remote[path], "hash": stable_hash(data), "at": state.get(path, {}).get("at")}
            save_json(SITE_STATE_PATH, state, pretty=True)
            site = cfg.get("site_endereco") or f"https://github.com/{repo}"
            log(f"Site atualizado: {', '.join(p.split('/')[-1] for p, _ in changed)}. Em cerca de 1 minuto aparece em {site}")
            return True
    except GitHubError as e:
        if e.status == 401:
            log("Site: o GitHub recusou o token (inválido ou expirado). Rode publicar_site.bat e cole um token novo.")
        elif e.status in (403, 404):
            log(f"Site: o token não tem acesso ao repositório {repo}. Confira se ele foi criado para esse")
            log("repositório e com a permissão Contents: Read and write.")
        elif e.status == 409:
            log("Site: o repositório está vazio. Crie um README nele pelo GitHub e tente de novo.")
        else:
            log(f"Site: não consegui atualizar ({e.status or 'sem conexão'}{': ' + str(e) if str(e) else ''}). Os arquivos continuam na pasta saida.")
        return False
    return False


def pillow_ok():
    try:
        import PIL  # noqa: F401
        return True
    except Exception:
        return False


def schedule_task(enable=True, hours=1):
    """Cria (ou remove) no Agendador de Tarefas do Windows a atualização automática, sem abrir janela."""
    if os.name != "nt":
        log("O agendamento automático é feito pelo Agendador de Tarefas do Windows.")
        return False
    run = lambda cmd: subprocess.run(cmd, capture_output=True, text=True, errors="replace")
    if not enable:
        r = run(["schtasks", "/Delete", "/TN", TASK_NAME, "/F"])
        log("Agendamento removido." if r.returncode == 0 else "Não havia agendamento para remover.")
        return r.returncode == 0
    exe = sys.executable
    pyw = os.path.join(os.path.dirname(exe), "pythonw.exe")
    if not os.path.exists(pyw):
        pyw = exe
    tr = f'"{pyw}" "{os.path.abspath(__file__)}" --tudo --automatico'
    r = run(["schtasks", "/Create", "/F", "/SC", "HOURLY", "/MO", str(hours), "/TN", TASK_NAME, "/TR", tr])
    if r.returncode != 0:
        log("Não consegui criar o agendamento:")
        log((r.stdout or "") + (r.stderr or ""))
        return False
    log(f"Pronto: a atualização roda sozinha a cada {hours} hora(s), sem abrir janela, enquanto o computador estiver ligado.")
    log("Vou rodar a primeira agora, em segundo plano. Em alguns minutos o resultado aparece em:")
    log(f"   {AUTO_LOG_PATH}")
    run(["schtasks", "/Run", "/TN", TASK_NAME])
    if not pillow_ok():
        log("")
        log("Aviso: a Pillow não está instalada neste Python, então os arquivos ficam maiores. Para instalar:")
        log(f'   "{exe}" -m pip install pillow')
    return True

# ----------------------------------------------------------------------------
# Fluxo principal
# ----------------------------------------------------------------------------

def cache_path(kind, match_id):
    d = MATCH_DIR if kind == "match" else TL_DIR
    return os.path.join(d, f"{match_id}.json.gz")


def read_ids_file(path):
    ids = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            s = line.strip().split("#")[0].strip()
            if not s:
                continue
            s = s.replace(" ", "")
            if "_" not in s and s.isdigit():
                s = "BR1_" + s
            ids.append(s.upper())
    return ids


def load_player_ranks():
    PLAYER_RANKS.clear()
    PLAYER_RANKS.update(load_json(PLAYER_RANKS_PATH, {}) or {})


RANK_BUDGET = {"left": None}  # consultas de elo que ainda cabem nesta execução


def _rank_age_days(pu, now):
    old = PLAYER_RANKS.get(pu)
    if not old:
        return None
    try:
        return (now - dt.datetime.fromisoformat(old["t"])).total_seconds() / 86400
    except Exception:
        return None


def fetch_player_ranks(client, todo, label):
    """Consulta o elo atual (Solo/Duo) de uma lista de PUUIDs, respeitando o limite por execução."""
    left = RANK_BUDGET["left"]
    if left is not None:
        if left <= 0:
            if todo:
                log(f"{label}: {len(todo)} jogadores ficam para a próxima atualização (limite de consultas desta execução).")
            return 0
        rest = todo[left:]
        todo = todo[:left]
    else:
        rest = []
    if not todo:
        return 0
    now = dt.datetime.now(dt.timezone.utc)
    log(f"{label}: {len(todo)} consultas (~{fmt_eta(len(todo) * client.limiter.est_seconds_per_request())})" + (f"; outros {len(rest)} ficam para as próximas atualizações." if rest else "."))
    fails, got = 0, 0
    try:
        for i, pu in enumerate(todo, 1):
            try:
                entries = client.league_entries(pu)
            except RiotError as e:
                fails += 1
                log(f"   (elo de um jogador não veio: {e})")
                if fails >= 8:
                    log("   Muitas falhas seguidas: o elo dos jogadores que faltam fica para a próxima atualização.")
                    break
                continue
            if entries is None:  # falha da API: não guarda, tenta de novo na próxima vez
                fails += 1
                if fails == 1 and client.last_error:
                    st, msg = client.last_error
                    log(f"   (a Riot recusou a consulta de elo: erro {st}{': ' + msg if msg else ''})")
                if fails >= 8:
                    log("   A Riot não respondeu o elo de vários jogadores: os que faltam ficam para a próxima atualização.")
                    break
                continue
            fails = 0
            got += 1
            rec = {"t": now.isoformat()}
            for e in entries:
                if e.get("queueType") == "RANKED_SOLO_5x5":
                    rec["solo"] = {"tier": e.get("tier"), "rank": e.get("rank"), "lp": e.get("leaguePoints")}
            PLAYER_RANKS[pu] = rec
            if i % 25 == 0:
                save_json(PLAYER_RANKS_PATH, PLAYER_RANKS)
                log(f"   elo dos jogadores... {i}/{len(todo)}")
    except KeyboardInterrupt:
        log("Interrompido: o elo dos jogadores que faltam fica para a próxima atualização.")
    save_json(PLAYER_RANKS_PATH, PLAYER_RANKS)
    if RANK_BUDGET["left"] is not None:
        RANK_BUDGET["left"] = max(0, RANK_BUDGET["left"] - got - fails)
    log(f"   elo de {got} jogador(es) atualizado(s).")
    return got


def refresh_old_ids(client, cfg, ids, current_puuid, my_puuids):
    """A Riot usa IDs de jogador (PUUID) diferentes para cada chave de API. Partidas baixadas com uma
    chave anterior guardam IDs que a chave atual não reconhece, e o elo desses jogadores não vem.
    Baixa de novo essas partidas (das mais recentes para as mais antigas) para trocar pelos IDs atuais."""
    limit = int(cfg.get("partidas_ids_antigos_por_execucao", 200) or 0)
    old_mine = set(my_puuids or []) - {current_puuid}
    if not limit or not old_mine or not current_puuid:
        return 0
    stale = []
    for mid in ids:
        mp = cache_path("match", mid)
        if not os.path.exists(mp):
            continue
        raw = load_json(mp) or {}
        info = raw.get("info") or {}
        if info.get("mapId") != 11 or info.get("queueId") not in SR_QUEUES:
            continue
        pus = {p.get("puuid") for p in info.get("participants") or []}
        if current_puuid not in pus and pus & old_mine:
            stale.append((mid, raw))
    if not stale:
        return 0
    todo = stale[:limit]
    load_player_ranks()
    log("")
    log(f"{len(stale)} partidas suas foram baixadas com uma chave anterior da Riot, que usava outros IDs de jogador.")
    log(f"Baixando {len(todo)} delas de novo para buscar o elo dos jogadores (~{fmt_eta(len(todo) * client.limiter.est_seconds_per_request())})"
        + (f"; as outras {len(stale) - len(todo)} ficam para as próximas atualizações." if len(stale) > len(todo) else "."))
    done = 0
    try:
        for i, (mid, old) in enumerate(todo, 1):
            try:
                raw = client.match(mid)
            except RiotError as e:
                log(f"   (não consegui baixar {mid}: {e})")
                break
            if raw is None:
                continue
            parts = (raw.get("info") or {}).get("participants") or []
            if not any(p.get("puuid") == current_puuid for p in parts):
                log("   A Riot devolveu a partida sem o seu ID atual; deixo como está.")
                break
            for p in (old.get("info") or {}).get("participants") or []:
                PLAYER_RANKS.pop(p.get("puuid"), None)  # elo guardado com o ID antigo não vale
            save_json(cache_path("match", mid), raw, compress=True)
            done += 1
            if i % 25 == 0:
                save_json(PLAYER_RANKS_PATH, PLAYER_RANKS)
                log(f"   partidas com IDs atualizados... {i}/{len(todo)}")
    except KeyboardInterrupt:
        log("Interrompido: as partidas que faltam ficam para a próxima atualização.")
    save_json(PLAYER_RANKS_PATH, PLAYER_RANKS)
    log(f"   {done} partida(s) com os IDs da chave atual.")
    return done


def update_player_ranks(client, cfg, ids, my_puuids, share=1.0, current_puuid=None):
    """Elo atual (Solo/Duo) dos outros 9 jogadores das suas partidas, para o placar.
    As partidas mais recentes são consultadas de novo a cada poucos dias; as antigas, uma vez por mês."""
    load_player_ranks()
    n_recent = int(cfg.get("elo_dos_jogadores_partidas", 20) or 0)
    days = float(cfg.get("elo_dos_jogadores_dias", 3) or 3)
    days_old = float(cfg.get("elo_dos_jogadores_dias_antigas", 30) or 30)
    now = dt.datetime.now(dt.timezone.utc)
    recent, older, seen = [], [], set()
    k = 0
    for mid in ids:
        if not os.path.exists(cache_path("match", mid)):
            continue
        info = (load_json(cache_path("match", mid)) or {}).get("info") or {}
        if info.get("mapId") != 11 or info.get("queueId") not in SR_QUEUES:
            continue
        k += 1
        if current_puuid and not any(p.get("puuid") == current_puuid for p in info.get("participants") or []):
            continue  # IDs de uma chave anterior: a chave atual não consegue consultar o elo deles
        for p in info.get("participants") or []:
            pu = p.get("puuid")
            if not pu or pu in my_puuids or pu in seen:
                continue
            seen.add(pu)
            age = _rank_age_days(pu, now)
            if k <= n_recent:
                if age is None or age > days:
                    recent.append(pu)
            elif age is None or age > days_old:
                older.append(pu)
    budget = RANK_BUDGET["left"]
    if budget is not None and share < 1.0:
        RANK_BUDGET["left"] = int(budget * share)  # guarda o resto para as partidas dos Challengers
    fetch_player_ranks(client, recent + older, "Elo dos outros jogadores das suas partidas")
    if budget is not None and share < 1.0:
        used = int(budget * share) - RANK_BUDGET["left"]
        RANK_BUDGET["left"] = max(0, budget - used)


def ref_study_candidates(recs):
    """Partidas dos Challengers que podem aparecer em 'Partidas para estudar' (vitórias disputadas, sem stomp)."""
    out = []
    for r in recs:
        me = r.get("me") or {}
        team = (r.get("timeline") or {}).get("team") or []
        if not me.get("win") or (r.get("duration") or 0) < 1200 or len(team) < 15:
            continue
        tid = me.get("teamId")
        d = [(row[0], (row[1] - row[2]) if tid == 100 else (row[2] - row[1])) for row in team]
        worst = min(x for _, x in d)
        upto20 = [x for t, x in d if t <= 1200]
        if not upto20:
            continue
        if max(upto20) >= 6000 and worst > -800:
            continue
        if worst <= -1500 or abs(upto20[-1]) <= 2500:
            out.append(r)
    return out


def export(cfg, account, dd, unavailable, profile=None):
    my_puuids = set(account.get("puuids") or [account.get("puuid")])
    load_player_ranks()
    records, skipped = [], 0
    names_seen = {}
    files = sorted(f for f in os.listdir(MATCH_DIR) if f.endswith(".json.gz"))
    for fn in files:
        mid = fn[:-8]
        raw = load_json(os.path.join(MATCH_DIR, fn))
        if not raw:
            skipped += 1
            continue
        tl = load_json(cache_path("tl", mid)) if os.path.exists(cache_path("tl", mid)) else None
        rec = process_match(raw, tl, my_puuids)
        if rec is None:
            skipped += 1
            continue
        records.append(rec)
        rid = rec["me"].get("riotId")
        if rid:
            prev = names_seen.get(rid)
            names_seen[rid] = max(prev or 0, rec.get("gameStart") or 0)
    records.sort(key=lambda r: r.get("gameStart") or 0, reverse=True)
    meta = build_meta(records, dd, cfg.get("icones_campeoes", "jungle"))
    profile = profile or load_json(os.path.join(CACHE_DIR, "perfil.json"), {}) or {}
    meta["visual"] = build_visuals(dd, records, profile)
    with_tl = sum(1 for r in records if r.get("timeline"))
    starts = [r["gameStart"] for r in records if r.get("gameStart")]
    out = {
        "schema": SCHEMA,
        "schemaVersion": SCHEMA_VERSION,
        "source": "riot-api",
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "collector": {"version": VERSION},
        "player": {
            "puuid": account.get("puuid"),
            "puuids": sorted(my_puuids),
            "riotId": f"{account.get('gameName')}#{account.get('tagLine')}",
            "platform": cfg["plataforma"],
            "region": cfg["regiao"],
            "namesSeen": [k for k, _ in sorted(names_seen.items(), key=lambda kv: -kv[1])],
        },
        "stats": {
            "matches": len(records),
            "withTimeline": with_tl,
            "withoutTimeline": len(records) - with_tl,
            "timelineUnavailable": sorted(unavailable.get("timelines", [])),
            "matchesUnavailable": sorted(unavailable.get("matches", [])),
            "oldestGame": min(starts) if starts else None,
            "newestGame": max(starts) if starts else None,
            "skippedRecords": skipped,
        },
        "meta": meta,
        "profile": {k: v for k, v in profile.items() if k != "ranked"},
        "rank": {"current": (profile.get("ranked") or {}), "history": load_json(ELO_PATH, []) or []},
        "matches": records,
    }
    path = os.path.join(OUT_DIR, "jungle_data.json")
    save_json(path, out)
    size_mb = os.path.getsize(path) / (1024 * 1024)
    log("")
    log("=" * 64)
    log(f" Arquivo pronto: {path}")
    log(f" {len(records)} partidas ({with_tl} com timeline, {len(records) - with_tl} sem) · {size_mb:.1f} MB")
    log(" Próximo passo: no dashboard, abra 'Configurações e Importação'")
    log(" e importe este arquivo. Partidas repetidas não são duplicadas.")
    log("=" * 64)
    return path



# ----------------------------------------------------------------------------
# Modo referências: partidas públicas de outros junglers para comparação
# ----------------------------------------------------------------------------

def read_refs_entries(path):
    """Um Riot ID por linha (Nome#TAG), com o servidor opcional depois de | (padrão: BR).
    Linhas vazias ou começando com # são ignoradas."""
    out, seen = [], set()
    with open(path, "r", encoding="utf-8-sig") as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith("#") or s.startswith("//"):
                continue
            server = "BR"
            for sep in ("|", ";", "\t"):
                if sep in s:
                    s, server = s.split(sep, 1)
                    s, server = s.strip(), server.strip().upper() or "BR"
                    break
            if "#" not in s:
                log(f"   ignorado (falta o #TAG): {s}")
                continue
            if server not in SERVERS:
                log(f"   servidor desconhecido ({server}) para {s}: usando BR")
                server = "BR"
            if s not in seen:
                seen.add(s)
                out.append({"rid": s, "server": server})
    return out


def read_refs_file(path):
    return [e["rid"] for e in read_refs_entries(path)]


def ref_cache_path(kind, match_id):
    d = REF_MATCH_DIR if kind == "match" else REF_TL_DIR
    return os.path.join(d, f"{match_id}.json.gz")


def jungle_record_of(raw, puuid, queue, champion=None):
    """Retorna o participante se a partida for da fila pedida, na jungle (e com o campeão pedido) e não for remake."""
    info = (raw or {}).get("info") or {}
    if queue and info.get("queueId") != queue:
        return None
    me = next((p for p in info.get("participants") or [] if p.get("puuid") == puuid), None)
    if not me or me.get("teamPosition") != "JUNGLE":
        return None
    if champion and me.get("championName") != champion:
        return None
    if me.get("gameEndedInEarlySurrender") or duration_seconds(info) < 300:
        return None
    return me


def collect_references(client, cfg, ref_ids, per_player, servers=None, champion=None):
    """servers: Riot ID -> servidor (BR, NA, EUW, KR...); champion: só partidas com esse campeão na selva."""
    queue = cfg.get("referencias_fila", 420)
    accounts_path = os.path.join(REF_DIR, "contas.json")
    accounts = load_json(accounts_path, {}) or {}
    not_found = []
    servers = servers or {}
    what = f"partidas de {champion} na jungle" if champion else "partidas de jungle"
    log(f"{len(ref_ids)} jogadores de referência · até {per_player} {what} (fila {queue}) de cada")
    est = len(ref_ids) * (2 + per_player * 2) * client.limiter.est_seconds_per_request()
    log(f"Tempo estimado na primeira vez: ~{fmt_eta(est)} (nas próximas, só o que for novo)")
    log("(Pode fechar a qualquer momento: o que já foi baixado fica salvo.)")
    for n, rid in enumerate(ref_ids, 1):
        game_name, tag = rid.rsplit("#", 1)
        server = servers.get(rid, "BR")
        log("")
        log(f"[{n}/{len(ref_ids)}] {rid}" + (f" · servidor {server}" if servers else ""))
        prev = client.use_server(server) if servers else None
        try:
            try:
                acc = client.account_by_riot_id(game_name.strip(), tag.strip())
            except RiotError as e:
                if e.status == 404:
                    log("   não encontrado. Confira o Riot ID (copie do perfil no OP.GG, com a TAG exata) e o servidor.")
                    not_found.append(rid)
                    continue
                raise
            found, scanned = _collect_player(client, cfg, accounts, accounts_path, rid, acc, per_player, queue, champion, server)
        finally:
            if prev:
                client.restore_server(prev)
        log(f"   ok: {found} {what} (olhei {scanned} ranqueadas)")
    return accounts, not_found


def _collect_player(client, cfg, accounts, accounts_path, rid, acc, per_player, queue, champion, server):
    puuid = acc["puuid"]
    accounts[rid] = {"puuid": puuid, "gameName": acc.get("gameName"), "tagLine": acc.get("tagLine"),
                     "server": server, "profile": fetch_profile(client, puuid)}
    save_json(accounts_path, accounts, pretty=True)
    found, scanned, start = 0, 0, 0
    while found < per_player and start < 300:
        ids = client.match_ids(puuid, start=start, count=100, queue=queue) or []
        if not ids:
            break
        for mid in ids:
            if found >= per_player:
                break
            scanned += 1
            mp = ref_cache_path("match", mid)
            raw = load_json(mp) if os.path.exists(mp) else None
            if raw is not None and not any(p.get("puuid") == puuid for p in (raw.get("info") or {}).get("participants") or []):
                raw = None  # baixada com uma chave anterior (outros IDs de jogador): baixa de novo
            if raw is None:
                raw = client.match(mid)
                if raw is None:
                    continue
                save_json(mp, raw, compress=True)
            if not jungle_record_of(raw, puuid, queue, champion):
                continue
            tp = ref_cache_path("tl", mid)
            if not os.path.exists(tp):
                tl = client.timeline(mid)
                if tl is not None:
                    save_json(tp, tl, compress=True)
            found += 1
            log(f"   {found}/{per_player} partidas  ({mid})")
        if len(ids) < 100:
            break
        start += 100
    return found, scanned


def export_refs(cfg, ref_ids, accounts, not_found, dd, per_player, client=None, servers=None, champion=None,
                out_name="referencias_challenger.json", kind="challenger"):
    queue = cfg.get("referencias_fila", 420)
    servers = servers or {}
    load_player_ranks()
    files = sorted(f for f in os.listdir(REF_MATCH_DIR) if f.endswith(".json.gz"))
    raws = {}
    for fn in files:
        raw = load_json(os.path.join(REF_MATCH_DIR, fn))
        if raw:
            raws[fn[:-8]] = raw
    players, all_records = [], []
    for rid in ref_ids:
        acc = accounts.get(rid)
        if not acc:
            continue
        puuid = acc["puuid"]
        recs = []
        for mid, raw in raws.items():
            if not jungle_record_of(raw, puuid, queue, champion):
                continue
            tp = ref_cache_path("tl", mid)
            tl = load_json(tp) if os.path.exists(tp) else None
            rec = process_match(raw, tl, {puuid})
            if rec:
                recs.append(rec)
        recs.sort(key=lambda r: r.get("gameStart") or 0, reverse=True)
        recs = recs[:per_player]
        if client is not None:
            # Elo dos outros jogadores das vitórias disputadas (as que podem virar "Partidas para estudar")
            now = dt.datetime.now(dt.timezone.utc)
            days_old = float(cfg.get("elo_dos_jogadores_dias_antigas", 30) or 30)
            todo = []
            for r in ref_study_candidates(recs):
                for p in ((raws.get(r["matchId"]) or {}).get("info") or {}).get("participants") or []:
                    pu = p.get("puuid")
                    if pu and pu != puuid and pu not in todo:
                        age = _rank_age_days(pu, now)
                        if age is None or age > days_old:
                            todo.append(pu)
            if todo:
                prev = client.use_server(servers.get(rid, acc.get("server") or "BR")) if (servers or acc.get("server")) else None
                try:
                    fetch_player_ranks(client, todo, f"   Elo dos jogadores das partidas para estudar de {rid}")
                finally:
                    if prev:
                        client.restore_server(prev)
        for r in recs:  # coloca o elo conhecido de cada jogador no placar
            pmap = {p.get("participantId"): p.get("puuid") for p in ((raws.get(r["matchId"]) or {}).get("info") or {}).get("participants") or []}
            for lp in r.get("participants") or []:
                pr = PLAYER_RANKS.get(pmap.get(lp.get("pid")))
                if pr is not None and lp.get("pid") != (r.get("me") or {}).get("pid"):
                    lp["rank"] = pr.get("solo") or {"tier": None}
        all_records.extend(recs)
        prof = acc.get("profile") or {}
        solo = (prof.get("ranked") or {}).get("RANKED_SOLO_5x5")
        icon = None
        if prof.get("profileIconId") is not None:
            vers = dd.get_versions() if not dd.offline else (load_json(os.path.join(DD_DIR, "versions.json")) or [])
            if vers:
                icon = visual_image(f"{DDRAGON}/cdn/{vers[0]}/img/profileicon/{prof['profileIconId']}.png",
                                    f"profileicon_{prof['profileIconId']}.png", square=128, quality=92)
        players.append({
            "riotId": f"{acc.get('gameName')}#{acc.get('tagLine')}",
            "listedAs": rid,
            "server": servers.get(rid) or acc.get("server") or "BR",
            "puuid": puuid,
            "rank": solo,
            "level": prof.get("summonerLevel"),
            "icon": icon,
            "matches": recs,
        })
        log(f"   {rid}: {len(recs)} partidas ({sum(1 for r in recs if r.get('timeline'))} com timeline)")
    meta = build_meta(all_records, dd, "refs") if all_records else {}
    if meta:
        tiers = ({(p.get("rank") or {}).get("tier") for p in players} - {None}) | {"MASTER", "CHALLENGER"}
        meta["visual"] = {"emblems": build_visuals(dd, [], {}, extra_tiers=tiers)["emblems"]}
    out = {
        "schema": REF_SCHEMA,
        "schemaVersion": 1,
        "source": "riot-api",
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "collector": {"version": VERSION},
        "queue": queue,
        "kind": kind,
        "champion": champion,
        "perPlayer": per_player,
        "notFound": not_found,
        "players": players,
        "meta": meta,
    }
    path = os.path.join(OUT_DIR, out_name)
    save_json(path, out)
    size_mb = os.path.getsize(path) / (1024 * 1024)
    log("")
    log("=" * 64)
    log(f" Arquivo pronto: {path}")
    log(f" {len(players)} jogadores · {len(all_records)} partidas · {size_mb:.1f} MB")
    if not_found:
        log(f" Não encontrados: {', '.join(not_found)}")
    log(f" No dashboard: aba '{'Mono Briar' if kind == 'briar' else 'Rumo ao Challenger'}'. Ele não se mistura com as suas partidas.")
    log("=" * 64)
    return path


def run_references(args, cfg, dd, client=None):
    path = args.referencias if isinstance(args.referencias, str) else REF_LIST_PATH
    if not os.path.exists(path):
        raise SystemExit(f"Não achei {path}. Crie o arquivo com um Riot ID por linha (Nome#TAG).")
    ref_ids = read_refs_file(path)
    if not ref_ids:
        raise SystemExit(f"{path} está vazio. Coloque um Riot ID por linha (Nome#TAG).")
    per_player = args.por_jogador or int(cfg.get("referencias_partidas_por_jogador", 40))
    accounts_path = os.path.join(REF_DIR, "contas.json")
    if args.somente_exportar or args.offline:
        accounts = load_json(accounts_path, {}) or {}
        export_refs(cfg, ref_ids, accounts, [r for r in ref_ids if r not in accounts], dd, per_player)
        return
    if client is None:
        keys = KeyStore()
        if args.nova_chave or not keys.load():
            keys.ask("Vamos configurar sua chave de API da Riot.")
        client = RiotClient(keys, cfg["regiao"], cfg.get("plataforma", "BR1"))
    accounts, not_found = {}, []
    try:
        accounts, not_found = collect_references(client, cfg, ref_ids, per_player)
    except KeyboardInterrupt:
        log("\nInterrompido. Vou gerar o arquivo com o que já foi baixado.")
        accounts = load_json(accounts_path, {}) or {}
    log(f"Requisições à API nesta execução: {client.calls}")
    if RANK_BUDGET["left"] is None:
        RANK_BUDGET["left"] = int(cfg.get("elo_dos_jogadores_por_execucao", 500) or 0)
    export_refs(cfg, ref_ids, accounts, not_found, dd, per_player, client=client)


def run_briar(args, cfg, dd, client=None):
    """Mono Briar: as partidas de Briar na selva dos jogadores de referencias_briar.txt, em vários servidores."""
    if not os.path.exists(BRIAR_LIST_PATH):
        with open(BRIAR_LIST_PATH, "w", encoding="utf-8") as f:
            f.write(BRIAR_DEFAULT_LIST)
        log(f"Criei {BRIAR_LIST_PATH} com a lista dos mono Briar.")
    entries = read_refs_entries(BRIAR_LIST_PATH)
    if not entries:
        log(f"{BRIAR_LIST_PATH} está vazio: nada a fazer na página Mono Briar.")
        return None
    ref_ids = [e["rid"] for e in entries]
    servers = {e["rid"]: e["server"] for e in entries}
    per_player = int(cfg.get("briar_partidas_por_jogador", 60) or 60)
    accounts_path = os.path.join(REF_DIR, "contas.json")
    if args.somente_exportar or args.offline:
        accounts = load_json(accounts_path, {}) or {}
        return export_refs(cfg, ref_ids, accounts, [r for r in ref_ids if r not in accounts], dd, per_player,
                           servers=servers, champion="Briar", out_name="referencias_briar.json", kind="briar")
    if client is None:
        keys = KeyStore()
        if args.nova_chave or not keys.load():
            keys.ask("Vamos configurar sua chave de API da Riot.")
        client = RiotClient(keys, cfg["regiao"], cfg.get("plataforma", "BR1"))
    try:
        accounts, not_found = collect_references(client, cfg, ref_ids, per_player, servers=servers, champion="Briar")
    except KeyboardInterrupt:
        log("\nInterrompido. Vou gerar o arquivo com o que já foi baixado.")
        accounts, not_found = load_json(accounts_path, {}) or {}, []
    if RANK_BUDGET["left"] is None:
        RANK_BUDGET["left"] = int(cfg.get("elo_dos_jogadores_por_execucao", 500) or 0)
    return export_refs(cfg, ref_ids, accounts, not_found, dd, per_player, client=client, servers=servers,
                       champion="Briar", out_name="referencias_briar.json", kind="briar")


def main():
    _setup_console()
    ap = argparse.ArgumentParser(description="Coletor de partidas da Riot para o Jungle Performance Analytics")
    ap.add_argument("--nova-chave", action="store_true", help="pede uma nova chave de API")
    ap.add_argument("--ids", metavar="ARQUIVO", help="arquivo .txt com IDs de partidas (um por linha)")
    ap.add_argument("--somente-exportar", action="store_true", help="gera o arquivo só com o cache local")
    ap.add_argument("--max", type=int, default=0, help="máximo de partidas novas nesta execução")
    ap.add_argument("--offline", action="store_true", help="não acessa a internet (usa só o cache)")
    ap.add_argument("--referencias", nargs="?", const=True, metavar="ARQUIVO",
                    help="baixa partidas dos jogadores de referência (padrão: referencias.txt)")
    ap.add_argument("--por-jogador", type=int, default=0, help="partidas de jungle por jogador de referência")
    ap.add_argument("--briar", action="store_true", help="baixa as partidas de Briar dos jogadores de referencias_briar.txt (página Mono Briar)")
    ap.add_argument("--tudo", action="store_true", help="atualiza as suas partidas e depois os jogadores de referência")
    ap.add_argument("--publicar", action="store_true", help="só envia os arquivos da pasta saida para o site")
    ap.add_argument("--sem-publicar", action="store_true", help="não envia os arquivos para o site")
    ap.add_argument("--novo-token", action="store_true", help="pede um novo token do GitHub para o site")
    ap.add_argument("--automatico", action="store_true", help="modo agendado: não pergunta nada e grava o log em dados")
    ap.add_argument("--agendar", action="store_true", help="agenda a atualização automática a cada hora (Windows)")
    ap.add_argument("--horas", type=int, default=1, help="intervalo do agendamento, em horas")
    ap.add_argument("--cancelar-agendamento", action="store_true", help="remove o agendamento")
    args = ap.parse_args()
    global AUTO, LOG_FILE
    if args.automatico:
        AUTO = True
        os.makedirs(os.path.dirname(AUTO_LOG_PATH), exist_ok=True)
        LOG_FILE = open(AUTO_LOG_PATH, "w", encoding="utf-8")
        log(f"Atualização automática iniciada em {dt.datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    if args.agendar or args.cancelar_agendamento:
        schedule_task(enable=args.agendar, hours=max(1, args.horas))
        return

    ensure_dirs()
    import_old_cache()
    cfg = load_config()
    log(f"Jungle Performance Analytics · coletor v{VERSION}")
    if args.publicar or args.novo_token:
        if args.novo_token and os.path.exists(GH_TOKEN_PATH):
            os.remove(GH_TOKEN_PATH)
        publish_site(cfg, ask=not AUTO)
        return
    publish = not (args.sem_publicar or args.offline)
    if args.briar:
        log("Mono Briar: partidas de Briar na selva dos jogadores de referencias_briar.txt.")
        run_briar(args, cfg, DataDragon(cfg.get("idioma", "pt_BR"), offline=args.offline))
        if publish:
            publish_site(cfg, ["referencias_briar.json"])
        return
    if args.referencias:
        log("Modo referências: partidas públicas de outros junglers, para comparar com você.")
        run_references(args, cfg, DataDragon(cfg.get("idioma", "pt_BR"), offline=args.offline))
        if publish:
            publish_site(cfg, ["referencias_challenger.json"])
        return
    log(f"Conta: {cfg['riot_id']} · servidor {cfg['plataforma']} · roteamento {cfg['regiao']}")

    account_path = os.path.join(CACHE_DIR, "conta.json")
    unavailable_path = os.path.join(CACHE_DIR, "indisponiveis.json")
    account = load_json(account_path, {}) or {}
    unavailable = load_json(unavailable_path, {"matches": [], "timelines": []})
    dd = DataDragon(cfg.get("idioma", "pt_BR"), offline=args.offline)

    if args.somente_exportar or args.offline:
        if not account.get("puuid"):
            raise SystemExit("Ainda não há conta em cache. Rode sem --somente-exportar primeiro.")
        export(cfg, account, dd, unavailable)
        if publish:
            publish_site(cfg, ["jungle_data.json"])
        return

    keys = KeyStore()
    if args.nova_chave or not keys.load():
        keys.ask("Vamos configurar sua chave de API da Riot.")
    client = RiotClient(keys, cfg["regiao"], cfg.get("plataforma", "BR1"))

    # 1) Riot ID -> PUUID
    if "#" not in cfg["riot_id"]:
        raise SystemExit('Riot ID inválido no config.json (use o formato "Nome#TAG").')
    game_name, tag = cfg["riot_id"].rsplit("#", 1)
    try:
        acc = client.account_by_riot_id(game_name, tag)
    except RiotError as e:
        if e.status == 404:
            raise SystemExit(f"Riot ID {cfg['riot_id']} não encontrado. Confira o config.json.")
        raise SystemExit(str(e))
    puuids = set(account.get("puuids") or [])
    if account.get("puuid"):
        puuids.add(account["puuid"])
    puuids.add(acc["puuid"])
    account = {"puuid": acc["puuid"], "puuids": sorted(puuids),
               "gameName": acc.get("gameName"), "tagLine": acc.get("tagLine")}
    save_json(account_path, account, pretty=True)
    log(f"PUUID localizado. Riot ID atual: {acc.get('gameName')}#{acc.get('tagLine')}")
    profile = fetch_profile(client, acc["puuid"])
    save_json(os.path.join(CACHE_DIR, "perfil.json"), profile, pretty=True)
    record_elo(profile)
    solo = (profile.get("ranked") or {}).get("RANKED_SOLO_5x5")
    if solo:
        log(f"Elo atual (Solo/Duo): {solo['tier']} {solo.get('rank') or ''} · {solo.get('lp')} PDL · {solo.get('wins')}V {solo.get('losses')}D")

    # 2) Lista de partidas (paginada de 100 em 100)
    if args.ids:
        ids = read_ids_file(args.ids)
        log(f"{len(ids)} IDs lidos de {args.ids}.")
    else:
        ids, start = [], 0
        while True:
            page = client.match_ids(acc["puuid"], start=start, count=100) or []
            ids.extend(page)
            log(f"   listando partidas... {len(ids)}")
            if len(page) < 100:
                break
            start += 100
        log(f"A Riot listou {len(ids)} partidas para esta conta.")

    missing_match = [m for m in ids if not os.path.exists(cache_path("match", m))
                     and m not in unavailable["matches"]]
    want_tl = cfg.get("baixar_timelines", True)
    tl_queues = set(cfg.get("filas_com_timeline") or SR_QUEUES)

    todo = missing_match[: args.max] if args.max else missing_match
    # timelines faltando para partidas já em cache
    tl_todo = []
    if want_tl:
        for m in ids:
            if os.path.exists(cache_path("match", m)) and not os.path.exists(cache_path("tl", m)) \
                    and m not in unavailable["timelines"]:
                raw = load_json(cache_path("match", m)) or {}
                if (raw.get("info") or {}).get("queueId") in tl_queues:
                    tl_todo.append(m)

    est_req = len(todo) * (2 if want_tl else 1) + len(tl_todo)
    if est_req:
        eta = est_req * client.limiter.est_seconds_per_request()
        log(f"Novas partidas: {len(todo)} · timelines pendentes: {len(tl_todo)} · tempo estimado: ~{fmt_eta(eta)}")
        log("(Pode fechar a qualquer momento: o que já foi baixado fica salvo e não é baixado de novo.)")
    else:
        log("Nada novo para baixar.")

    t0 = time.monotonic()
    done = 0
    try:
        for i, mid in enumerate(todo, 1):
            raw = client.match(mid)
            if raw is None:
                unavailable["matches"].append(mid)
                save_json(unavailable_path, unavailable, pretty=True)
                log(f"[{i}/{len(todo)}] {mid}  indisponível na API (404)")
                continue
            save_json(cache_path("match", mid), raw, compress=True)
            status = "partida ok"
            q = (raw.get("info") or {}).get("queueId")
            if want_tl and q in tl_queues:
                tl = client.timeline(mid)
                if tl is None:
                    unavailable["timelines"].append(mid)
                    save_json(unavailable_path, unavailable, pretty=True)
                    status += " · timeline indisponível"
                else:
                    save_json(cache_path("tl", mid), tl, compress=True)
                    status += " · timeline ok"
            done += 1
            elapsed = time.monotonic() - t0
            rest = (elapsed / done) * (len(todo) - i) if done else 0
            log(f"[{i}/{len(todo)}] {mid}  {status}  (restam ~{fmt_eta(rest)})")
        for i, mid in enumerate(tl_todo, 1):
            tl = client.timeline(mid)
            if tl is None:
                unavailable["timelines"].append(mid)
                save_json(unavailable_path, unavailable, pretty=True)
                log(f"[timeline {i}/{len(tl_todo)}] {mid}  indisponível")
            else:
                save_json(cache_path("tl", mid), tl, compress=True)
                log(f"[timeline {i}/{len(tl_todo)}] {mid}  ok")
    except KeyboardInterrupt:
        log("\nInterrompido. O que já foi baixado está salvo; vou gerar o arquivo com isso.")

    try:
        refresh_old_ids(client, cfg, ids, acc["puuid"], puuids)
    except Exception as e:
        log(f"   (não consegui atualizar os IDs das partidas antigas: {e})")
    RANK_BUDGET["left"] = int(cfg.get("elo_dos_jogadores_por_execucao", 500) or 0)
    try:
        update_player_ranks(client, cfg, ids, puuids, share=0.5 if args.tudo else 1.0, current_puuid=acc["puuid"])
    except Exception as e:  # o placar funciona sem o elo dos outros jogadores
        log(f"   (não consegui atualizar o elo dos jogadores: {e})")
    log(f"Requisições à API nesta execução: {client.calls}")
    export(cfg, account, dd, unavailable, profile)
    briar_due = False
    if args.tudo:
        briar_path = os.path.join(OUT_DIR, "referencias_briar.json")
        every_b = float(cfg.get("briar_a_cada_horas") or 0)
        age_b = (time.time() - os.path.getmtime(briar_path)) / 3600 if os.path.exists(briar_path) else None
        briar_due = not (AUTO and every_b and age_b is not None and age_b < every_b)
    if args.tudo:
        refs_path = os.path.join(OUT_DIR, "referencias_challenger.json")
        every = float(cfg.get("referencias_a_cada_horas") or 0)
        age_h = (time.time() - os.path.getmtime(refs_path)) / 3600 if os.path.exists(refs_path) else None
        if AUTO and every and age_h is not None and age_h < every:
            log("")
            log(f"Referências atualizadas há {age_h:.1f} h: a próxima atualização delas fica para daqui a {every - age_h:.1f} h.")
        else:
            log("")
            log("Agora, os jogadores de referência...")
            args.referencias = True
            keep = 0
            if briar_due and RANK_BUDGET["left"]:
                keep = RANK_BUDGET["left"] // 2  # metade das consultas de elo fica para os mono Briar
                RANK_BUDGET["left"] -= keep
            run_references(args, cfg, dd, client)
            if keep:
                RANK_BUDGET["left"] = (RANK_BUDGET["left"] or 0) + keep
    if args.tudo:
        if not briar_due:
            log(f"Mono Briar atualizado há {age_b:.1f} h: a próxima atualização fica para daqui a {every_b - age_b:.1f} h.")
        else:
            log("")
            log("Agora, os mono Briar (página Mono Briar)...")
            try:
                run_briar(args, cfg, dd, client)
            except RiotError as e:
                log(f"   (não consegui atualizar os mono Briar: {e})")
    if publish:
        publish_site(cfg, ["jungle_data.json", "referencias_challenger.json", "referencias_briar.json"] if args.tudo else ["jungle_data.json"])
    if not pillow_ok():
        log("")
        log("Dica: a Pillow não está instalada neste Python, então os arquivos ficam maiores. Para instalar:")
        log(f'   "{sys.executable}" -m pip install pillow')
    if AUTO:
        log(f"Atualização automática concluída em {dt.datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")


if __name__ == "__main__":
    try:
        main()
    except RiotError as e:
        log(f"\nErro da API da Riot: {e}")
        sys.exit(1)
    except SystemExit as e:
        if AUTO and e.code not in (None, 0):
            log(f"Parou: {e.code}")
        raise
    except Exception:
        import traceback
        log("Erro inesperado:")
        log(traceback.format_exc())
        sys.exit(1)
