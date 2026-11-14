# Gera um ambiente de teste do coletor com dados no formato da API da Riot.
import gzip, json, os, shutil, sys

SRC = os.path.join(os.path.dirname(__file__), "..", "collector", "coletor_riot.py")
root = sys.argv[1]
shutil.rmtree(root, ignore_errors=True)
for d in ["dados/cache/partidas", "dados/cache/timelines", "dados/ddragon/16.20.1", "dados/ddragon/16.21.1", "dados/ddragon/icons", "saida"]:
    os.makedirs(os.path.join(root, d), exist_ok=True)
shutil.copy(SRC, os.path.join(root, "coletor_riot.py"))

def wj(path, obj, gz=False):
    p = os.path.join(root, path)
    if gz:
        with gzip.open(p, "wt", encoding="utf-8") as f: json.dump(obj, f)
    else:
        with open(p, "w", encoding="utf-8") as f: json.dump(obj, f)

ME, OLD_PUUID = "PUUID-NEW", "PUUID-OLD"
wj("dados/cache/conta.json", {"puuid": ME, "puuids": [ME, OLD_PUUID], "gameName": "Hikarika", "tagLine": "BRIAR"})
wj("dados/cache/indisponiveis.json", {"matches": [], "timelines": ["BR1_2"]})

ITEMS = {
  "6676": ("A Coletora", 3000, [], ["Damage"]), "3748": ("Hidra Titânica", 3300, [], ["Health"]),
  "6673": ("Arco-Escudo Imortal", 3000, [], ["Damage"]), "6692": ("Eclipse", 2900, [], ["Damage"]),
  "6333": ("Dança da Morte", 3300, [], ["Damage"]), "3156": ("Mandíbula de Malmortius", 3100, [], ["Damage"]),
  "3047": ("Botas Galvanizadas de Aço", 1200, [], ["Boots", "Armor"]),
  "1001": ("Botas", 300, ["3047"], ["Boots"]), "1036": ("Espada Longa", 350, ["6676", "6692"], ["Damage"]),
  "2003": ("Poção de Vida", 50, [], ["Consumable"]), "3340": ("Totem Invisível", 0, [], ["Trinket"]),
  "1102": ("Filhote de Pé-de-Vento", 450, [], ["Jungle"]),
}
def item_json():
    data = {}
    for k, (n, g, into, tags) in ITEMS.items():
        data[k] = {"name": n, "gold": {"total": g, "purchasable": k != "3340" or True}, "into": into,
                   "tags": tags, "maps": {"11": True}}
    return {"data": data}
CHAMPS = {"Briar": 233, "LeeSin": 64, "Viego": 234, "Graves": 104, "Khazix": 121, "Ahri": 103, "Jinx": 222,
          "Thresh": 412, "Darius": 122, "Ezreal": 81, "Leona": 89, "Garen": 86, "Lux": 99}
champ_json = {"data": {k: {"id": k, "key": str(v), "name": {"LeeSin": "Lee Sin", "Khazix": "Kha'Zix"}.get(k, k),
                            "tags": ["Fighter"]} for k, v in CHAMPS.items()}}
runes_json = [{"id": 8000, "name": "Precisão", "icon": "perk-images/Styles/7201_Precision.png", "slots": [
    {"runes": [{"id": 8010, "name": "Conquistador", "icon": "perk-images/c.png"},
               {"id": 8008, "name": "Ritmo Fatal", "icon": "perk-images/l.png"}]},
    {"runes": [{"id": 9111, "name": "Triunfo", "icon": "perk-images/t.png"}]},
    {"runes": [{"id": 9104, "name": "Lenda: Espontaneidade", "icon": "perk-images/a.png"}]},
    {"runes": [{"id": 8014, "name": "Golpe de Misericórdia", "icon": "perk-images/g.png"}]}]},
  {"id": 8100, "name": "Dominação", "icon": "perk-images/Styles/7200_Domination.png", "slots": [
    {"runes": [{"id": 8112, "name": "Eletrocutar", "icon": "perk-images/e.png"}]},
    {"runes": [{"id": 8143, "name": "Impacto Repentino", "icon": "perk-images/s.png"}]},
    {"runes": [{"id": 8140, "name": "Lembranças Macabras", "icon": "perk-images/m.png"}]},
    {"runes": [{"id": 8105, "name": "Caçador Incansável", "icon": "perk-images/r.png"}]}]}]
spell_json = {"data": {"SummonerSmite": {"id": "SummonerSmite", "key": "11", "name": "Golpear"},
                       "SummonerFlash": {"id": "SummonerFlash", "key": "4", "name": "Flash"}}}
for v in ["16.20.1", "16.21.1"]:
    wj(f"dados/ddragon/{v}/pt_BR_item.json", item_json())
    wj(f"dados/ddragon/{v}/pt_BR_champion.json", champ_json)
    wj(f"dados/ddragon/{v}/pt_BR_runesReforged.json", runes_json)
    wj(f"dados/ddragon/{v}/pt_BR_summoner.json", spell_json)
wj("dados/ddragon/versions.json", ["16.21.1", "16.20.1"])
# Ícones falsos (PNG de 1x1) para não depender de rede
PNG = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000"
                    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082")
import urllib.parse
def icon(kind, key):
    safe = urllib.parse.quote(f"{kind}_{key}", safe="").replace("%", "_")
    with open(os.path.join(root, "dados/ddragon/icons", safe + ".png"), "wb") as f: f.write(PNG)
for k in ITEMS: icon("item", k)
for k in CHAMPS: icon("champion", k)
for st in runes_json:
    icon("rune", st["icon"])
    for sl in st["slots"]:
        for r in sl["runes"]: icon("rune", r["icon"])
icon("spell", "SummonerSmite"); icon("spell", "SummonerFlash")

def perks(prim=8000, key=8010, sub=8100):
    return {"statPerks": {"offense": 5005, "flex": 5008, "defense": 5011}, "styles": [
        {"description": "primaryStyle", "style": prim, "selections": [{"perk": key}, {"perk": 9111}, {"perk": 9104}, {"perk": 8014}]},
        {"description": "subStyle", "style": sub, "selections": [{"perk": 8143}, {"perk": 8105}]}]}

def participant(pid, team, champ, pos, puuid, win, k, d, a, items, name="Outro", tag="BR1", spells=(4, 14), early=False):
    p = {"participantId": pid, "teamId": team, "championId": CHAMPS[champ], "championName": champ,
         "teamPosition": pos, "individualPosition": pos or "Invalid", "puuid": puuid, "win": win,
         "kills": k, "deaths": d, "assists": a, "totalMinionsKilled": 40, "neutralMinionsKilled": 150,
         "goldEarned": 13000, "goldSpent": 12500, "totalDamageDealtToChampions": 24000, "totalDamageTaken": 30000,
         "visionScore": 30, "champLevel": 16, "champExperience": 15000, "summoner1Id": spells[0], "summoner2Id": spells[1],
         "riotIdGameName": name, "riotIdTagline": tag, "gameEndedInEarlySurrender": early,
         "perks": perks(), "challenges": {"killParticipation": 0.6, "soloKills": 2, "initialCrabCount": 1}}
    for i in range(7):
        p[f"item{i}"] = items[i] if i < len(items) else 0
    return p

def match(mid, start, dur, queue, me_champ, me_win, me_kda, me_items, me_puuid=ME, me_name="Hikarika", me_tag="BRIAR",
          opp_pos="JUNGLE", early=False, version="16.21.712.1234"):
    team_me, team_en = 100, 200
    ps = [participant(1, team_me, "Darius", "TOP", "p1", me_win, 3, 4, 2, [3047]),
          participant(2, team_me, me_champ, "JUNGLE", me_puuid, me_win, *me_kda, me_items, name=me_name, tag=me_tag,
                      spells=(11, 4), early=early),
          participant(3, team_me, "Ahri", "MIDDLE", "p3", me_win, 5, 2, 6, []),
          participant(4, team_me, "Jinx", "BOTTOM", "p4", me_win, 6, 3, 4, []),
          participant(5, team_me, "Thresh", "UTILITY", "p5", me_win, 0, 5, 12, []),
          participant(6, team_en, "Garen", "TOP", "p6", not me_win, 2, 3, 1, []),
          participant(7, team_en, "Graves", opp_pos, "p7", not me_win, 4, 5, 3, [6676, 3047], spells=(11, 4)),
          participant(8, team_en, "Lux", "MIDDLE", "p8", not me_win, 3, 4, 5, []),
          participant(9, team_en, "Ezreal", "BOTTOM", "p9", not me_win, 4, 4, 2, []),
          participant(10, team_en, "Leona", "UTILITY", "p10", not me_win, 1, 6, 8, [])]
    return {"metadata": {"matchId": mid, "participants": [p["puuid"] for p in ps]},
            "info": {"gameCreation": start - 60000, "gameStartTimestamp": start, "gameEndTimestamp": start + dur * 1000,
                     "gameDuration": dur, "gameVersion": version, "queueId": queue, "mapId": 11, "gameMode": "CLASSIC",
                     "platformId": "BR1", "gameId": int(mid.split("_")[1]), "participants": ps,
                     "teams": [{"teamId": 100, "win": me_win, "bans": [{"championId": 121}],
                                "objectives": {"dragon": {"first": True, "kills": 3}, "baron": {"first": False, "kills": 0},
                                               "riftHerald": {"first": True, "kills": 1}, "tower": {"first": True, "kills": 7},
                                               "champion": {"first": True, "kills": 20}}},
                               {"teamId": 200, "win": not me_win, "bans": [],
                                "objectives": {"dragon": {"first": False, "kills": 1}, "baron": {"first": True, "kills": 1}}}]}}

def timeline(n_min, purchases, kills, elite):
    frames = []
    for m in range(n_min + 1):
        pfs = {}
        for pid in range(1, 11):
            pfs[str(pid)] = {"participantId": pid, "totalGold": 500 + m * (420 if pid == 2 else 380),
                             "currentGold": 100 + (m * 37) % 900, "xp": m * (430 if pid == 2 else 400),
                             "level": min(18, 1 + m // 2), "minionsKilled": m * 2,
                             "jungleMinionsKilled": m * (6 if pid in (2, 7) else 0),
                             "position": {"x": 7000 + m * 10, "y": 7000 - m * 10}}
        frames.append({"timestamp": m * 60000 + (35 if m else 0), "participantFrames": pfs, "events": []})
    def put(ts, ev):
        frames[min(len(frames) - 1, int(ts // 60000) + 1)]["events"].append(dict(ev, timestamp=ts))
    for ts, typ, item, *rest in purchases:
        ev = {"type": typ, "participantId": 2}
        if typ == "ITEM_UNDO":
            ev.update({"beforeId": item, "afterId": 0, "goldGain": 2900})
        else:
            ev["itemId"] = item
        put(ts, ev)
    for ts, killer, victim, assists in kills:
        put(ts, {"type": "CHAMPION_KILL", "killerId": killer, "victimId": victim, "assistingParticipantIds": assists,
                 "position": {"x": 5000, "y": 5000}, "bounty": 300, "shutdownBounty": 0})
    for ts, mt, sub, team, killer in elite:
        put(ts, {"type": "ELITE_MONSTER_KILL", "monsterType": mt, "monsterSubType": sub, "killerTeamId": team,
                 "killerId": killer, "assistingParticipantIds": [1, 3]})
    put(600000, {"type": "BUILDING_KILL", "buildingType": "TOWER_BUILDING", "laneType": "MID_LANE",
                 "towerType": "OUTER_TURRET", "teamId": 200, "killerId": 3})
    put(500000, {"type": "WARD_PLACED", "creatorId": 2})  # deve ser ignorado
    return {"metadata": {}, "info": {"frameInterval": 60000, "participants": [{"participantId": i, "puuid": f"x{i}"} for i in range(1, 11)],
                                     "frames": frames}}

T = 1793000000000  # ~ out/2026
m1 = match("BR1_1", T, 1950, 420, "Briar", True, (9, 2, 7), [6676, 3748, 6673, 6692, 3047, 0, 3340])
t1 = timeline(32, [(90000, "ITEM_PURCHASED", 1102), (620000, "ITEM_PURCHASED", 6676), (1040000, "ITEM_PURCHASED", 3748),
                   (1400000, "ITEM_PURCHASED", 6673), (1700000, "ITEM_PURCHASED", 6692), (1702000, "ITEM_UNDO", 6692),
                   (1730000, "ITEM_PURCHASED", 6692), (500000, "ITEM_DESTROYED", 1036)],
              [(300000, 2, 7, [3]), (840000, 7, 2, [8]), (1300000, 2, 9, [4]), (1500000, 3, 8, [2])],
              [(560000, "DRAGON", "FIRE_DRAGON", 100, 2), (870000, "DRAGON", "WATER_DRAGON", 200, 7),
               (1560000, "BARON_NASHOR", None, 200, 7)])
m2 = match("BR1_2", T - 86400000 * 160, 2100, 420, "Briar", False, (4, 6, 5), [6676, 3748, 6333, 3047, 0, 0, 3340],
           me_puuid=OLD_PUUID, me_name="KD o Pai do Ynga", me_tag="BR1", version="16.20.400.1")
m3 = match("BR1_3", T - 86400000, 200, 420, "Briar", False, (0, 0, 0), [0, 0, 0, 0, 0, 0, 3340], early=True)
m4 = match("BR1_4", T - 86400000 * 2, 1700, 440, "LeeSin", True, (7, 0, 9), [6692, 3156, 3047, 0, 0, 0, 3340])
t4 = timeline(28, [(700000, "ITEM_PURCHASED", 6692), (1300000, "ITEM_PURCHASED", 3156)], [(400000, 2, 7, [])], [])
m5 = match("BR1_5", T - 86400000 * 3, 1500, 420, "Briar", True, (5, 1, 3), [6676, 3748, 0, 0, 0, 0, 3340], opp_pos="")
m6 = {"metadata": {"matchId": "BR1_6"}, "info": dict(m5["info"], participants=[dict(p, puuid="nobody") for p in m5["info"]["participants"]])}

wj("dados/cache/partidas/BR1_1.json.gz", m1, gz=True); wj("dados/cache/timelines/BR1_1.json.gz", t1, gz=True)
wj("dados/cache/partidas/BR1_2.json.gz", m2, gz=True)
wj("dados/cache/partidas/BR1_3.json.gz", m3, gz=True)
wj("dados/cache/partidas/BR1_4.json.gz", m4, gz=True); wj("dados/cache/timelines/BR1_4.json.gz", t4, gz=True)
wj("dados/cache/partidas/BR1_5.json.gz", m5, gz=True)
wj("dados/cache/partidas/BR1_6.json.gz", m6, gz=True)
print("fixtures ok:", root)
