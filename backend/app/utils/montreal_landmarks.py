"""
Montréal Landmarks Dictionary
==============================
Pre-geocoded coordinates for common Montréal locations.
Used as the primary geocoding source to avoid Nominatim network calls.
Falls back to Nominatim only if the location is not found here.
"""

# Format: normalized_key → (lat, lon)
MONTREAL_LANDMARKS: dict[str, tuple[float, float]] = {

    # ── Metro stations ────────────────────────────────────────────────────────
    "jean-talon":                  (45.5345, -73.6240),
    "jean talon":                  (45.5345, -73.6240),
    "jean-talon metro":            (45.5345, -73.6240),
    "station jean-talon":          (45.5345, -73.6240),
    "berri-uqam":                  (45.5166, -73.5632),
    "berri uqam":                  (45.5166, -73.5632),
    "berri":                       (45.5166, -73.5632),
    "guy-concordia":               (45.4944, -73.5786),
    "guy concordia":               (45.4944, -73.5786),
    "guy-concordia metro":         (45.4944, -73.5786),
    "mcgill metro":                (45.5048, -73.5714),
    "mcgill station":              (45.5048, -73.5714),
    "peel":                        (45.5011, -73.5705),
    "peel metro":                  (45.5011, -73.5705),
    "mont-royal":                  (45.5213, -73.5837),
    "mont royal metro":            (45.5213, -73.5837),
    "laurier":                     (45.5302, -73.5849),
    "laurier metro":               (45.5302, -73.5849),
    "rosemont":                    (45.5367, -73.5922),
    "rosemont metro":              (45.5367, -73.5922),
    "snowdon":                     (45.4905, -73.6225),
    "côte-des-neiges":             (45.4928, -73.6120),
    "cote-des-neiges":             (45.4928, -73.6120),
    "vendome":                     (45.4784, -73.6002),
    "vendôme":                     (45.4784, -73.6002),
    "lionel-groulx":               (45.4750, -73.5837),
    "atwater":                     (45.4823, -73.5870),
    "atwater metro":               (45.4823, -73.5870),
    "place-des-arts":              (45.5084, -73.5688),
    "place des arts":              (45.5084, -73.5688),
    "champ-de-mars":               (45.5098, -73.5540),
    "square-victoria":             (45.5028, -73.5606),
    "bonaventure":                 (45.4958, -73.5647),
    "frontenac":                   (45.5345, -73.5485),
    "papineau":                    (45.5260, -73.5560),
    "joliette":                    (45.5483, -73.5443),
    "pie-ix":                      (45.5567, -73.5513),
    "viau":                        (45.5617, -73.5438),
    "langelier":                   (45.5650, -73.5313),
    "radisson":                    (45.5680, -73.5160),
    "honoré-beaugrand":            (45.5634, -73.5027),
    "angrignon":                   (45.4483, -73.6020),
    "monk":                        (45.4567, -73.5953),
    "jolicoeur":                   (45.4617, -73.5917),
    "verdun":                      (45.4667, -73.5717),
    "de l'église":                 (45.4717, -73.5650),
    "lasalle":                     (45.4383, -73.6020),

    # ── Universities ──────────────────────────────────────────────────────────
    "mcgill university":           (45.5048, -73.5772),
    "mcgill":                      (45.5048, -73.5772),
    "concordia university":        (45.4944, -73.5786),
    "concordia":                   (45.4944, -73.5786),
    "uqam":                        (45.5166, -73.5632),
    "université du québec":        (45.5166, -73.5632),
    "université de montréal":      (45.5015, -73.6148),
    "universite de montreal":      (45.5015, -73.6148),
    "udem":                        (45.5015, -73.6148),
    "polytechnique":               (45.5045, -73.6143),
    "hec montréal":                (45.4975, -73.6150),
    "dawson college":              (45.4938, -73.5795),

    # ── Neighbourhoods ────────────────────────────────────────────────────────
    "plateau-mont-royal":          (45.5213, -73.5837),
    "plateau mont-royal":          (45.5213, -73.5837),
    "le plateau":                  (45.5213, -73.5837),
    "plateau":                     (45.5213, -73.5837),
    "mile end":                    (45.5225, -73.5985),
    "vieux-montréal":              (45.5088, -73.5540),
    "vieux montreal":              (45.5088, -73.5540),
    "old montreal":                (45.5088, -73.5540),
    "vieux-port":                  (45.5074, -73.5494),
    "vieux port":                  (45.5074, -73.5494),
    "downtown":                    (45.5017, -73.5673),
    "centre-ville":                (45.5017, -73.5673),
    "rosemont-petite-patrie":      (45.5367, -73.5922),
    "villeray":                    (45.5500, -73.6167),
    "outremont":                   (45.5167, -73.6083),
    "côte-des-neiges":             (45.4928, -73.6120),
    "ndg":                         (45.4783, -73.6200),
    "notre-dame-de-grâce":         (45.4783, -73.6200),
    "verdun":                      (45.4617, -73.5683),
    "lasalle":                     (45.4283, -73.6367),
    "lachine":                     (45.4383, -73.6733),
    "anjou":                       (45.6017, -73.5533),
    "saint-leonard":               (45.5883, -73.5933),
    "montreal-nord":               (45.5983, -73.6233),
    "rivière-des-prairies":        (45.6283, -73.5717),
    "pointe-aux-trembles":         (45.6583, -73.5050),
    "mercier":                     (45.5683, -73.5317),
    "hochelaga":                   (45.5400, -73.5400),
    "maisonneuve":                 (45.5483, -73.5483),
    "rosemont":                    (45.5367, -73.5922),
    "saint-michel":                (45.5650, -73.6033),
    "parc-extension":              (45.5333, -73.6433),

    # ── Landmarks & places ────────────────────────────────────────────────────
    "mount royal":                 (45.5038, -73.5877),
    "mont-royal park":             (45.5038, -73.5877),
    "parc du mont-royal":          (45.5038, -73.5877),
    "olympic stadium":             (45.5596, -73.5517),
    "stade olympique":             (45.5596, -73.5517),
    "biodome":                     (45.5596, -73.5517),
    "botanical garden":            (45.5590, -73.5560),
    "jardin botanique":            (45.5590, -73.5560),
    "notre-dame basilica":         (45.5046, -73.5565),
    "notre dame basilica":         (45.5046, -73.5565),
    "jean-drapeau park":           (45.5096, -73.5287),
    "parc jean-drapeau":           (45.5096, -73.5287),
    "ile sainte-helene":           (45.5096, -73.5287),
    "bell centre":                 (45.4961, -73.5694),
    "centre bell":                 (45.4961, -73.5694),
    "place ville-marie":           (45.5028, -73.5697),
    "central station":             (45.4958, -73.5681),
    "gare centrale":               (45.4958, -73.5681),
    "windsor station":             (45.4978, -73.5700),
    "palais des congrès":          (45.5063, -73.5580),
    "convention center":           (45.5063, -73.5580),
    "complexe desjardins":         (45.5083, -73.5650),
    "marché jean-talon":           (45.5367, -73.6183),
    "jean-talon market":           (45.5367, -73.6183),
    "marché atwater":              (45.4783, -73.5817),
    "atwater market":              (45.4783, -73.5817),
    "plateau":                     (45.5213, -73.5837),

    # ── South Shore ───────────────────────────────────────────────────────────
    "brossard":                    (45.4617, -73.4617),
    "mail champlain":              (45.4533, -73.4700),
    "carrefour du richelieu":      (45.3667, -73.2667),
    "longueuil":                   (45.5317, -73.5133),
    "saint-lambert":               (45.4983, -73.5067),
    "greenfield park":             (45.4817, -73.4700),

    # ── North Shore ───────────────────────────────────────────────────────────
    "laval":                       (45.6066, -73.7124),
    "montmorency":                 (45.5583, -73.7133),
    "cartier":                     (45.5617, -73.7067),

    # ── Hospitals ─────────────────────────────────────────────────────────────
    "royal victoria hospital":     (45.5096, -73.5881),
    "montreal general hospital":   (45.4983, -73.5867),
    "jewish general hospital":     (45.4983, -73.6217),
    "sainte-justine hospital":     (45.5017, -73.6233),
    "notre-dame hospital":         (45.5183, -73.5617),

    # ── Airports ──────────────────────────────────────────────────────────────
    "pierre elliott trudeau airport": (45.4706, -73.7408),
    "trudeau airport":             (45.4706, -73.7408),
    "yul":                         (45.4706, -73.7408),
    "montreal airport":            (45.4706, -73.7408),
}


def lookup_landmark(name: str) -> tuple[float, float] | None:
    """
    Look up a place name in the landmarks dictionary.
    Returns (lat, lon) if found, None otherwise.
    Normalizes the input: lowercase, strip whitespace, remove accents.
    """
    import unicodedata

    def normalize(s: str) -> str:
        s = s.lower().strip()
        # Remove accents
        s = ''.join(
            c for c in unicodedata.normalize('NFD', s)
            if unicodedata.category(c) != 'Mn'
        )
        # Remove common noise words
        for noise in [' station', ' metro station', ' metro', ' arr.', ',']:
            s = s.replace(noise, '')
        return s.strip()

    key = normalize(name)

    # Exact match
    if key in MONTREAL_LANDMARKS:
        return MONTREAL_LANDMARKS[key]

    # Prefix / substring match — return first match
    for landmark_key, coords in MONTREAL_LANDMARKS.items():
        if key in landmark_key or landmark_key in key:
            return coords

    return None
