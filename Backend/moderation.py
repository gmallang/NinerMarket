import re

# Based on UNC Charlotte Housing & Residence Life's prohibited items list
# (housing.charlotte.edu/campus-living/about-your-room/prohibited-items) plus
# drugs/alcohol, which the Terms already prohibit listing. Scoped to the
# safety- and policy-critical items an RA would actually care about — not
# every room-compliance item on that page (e.g. WiFi routers, loft beds),
# since those aren't inherently unsafe to resell and would mostly generate
# false positives on a marketplace.
PROHIBITED_TERMS: dict[str, list[str]] = {
    "weapon": [
        "gun", "guns", "firearm", "firearms", "pistol", "pistols", "rifle", "rifles",
        "shotgun", "shotguns", "ammo", "ammunition", "bowie knife", "switchblade",
        "switchblades", "dagger", "daggers", "brass knuckles", "taser", "tasers",
        "stun gun", "nunchuck", "nunchucks",
    ],
    "fireworks or open flame": [
        "firework", "fireworks", "explosive", "explosives", "butane torch",
        "lighter fluid", "charcoal grill", "open flame grill", "candle", "candles",
        "incense", "oil lamp", "oil burning lamp",
    ],
    "space heater": ["space heater", "space heaters"],
    "halogen lamp": ["halogen lamp", "halogen lamps", "halogen bulb", "halogen bulbs"],
    "hot plate or open coil burner": [
        "hot plate", "hot plates", "open coil burner", "coil burner", "coil burners",
    ],
    "hoverboard or e-scooter": [
        "hoverboard", "hoverboards", "e-scooter", "e-scooters", "electric scooter",
        "electric scooters", "electric skateboard", "electric skateboards",
        "self-balancing scooter",
    ],
    "drugs or drug paraphernalia": [
        "marijuana", "weed", "cannabis", "bong", "bongs", "vape", "vapes", "vaping",
        "e-cigarette", "e-cigarettes", "nicotine pen", "edibles",
    ],
    "alcohol": [
        "alcohol", "beer", "beers", "liquor", "vodka", "whiskey", "tequila", "everclear",
    ],
}

# Compile each category's terms into a single alternation pattern at import
# time so find_prohibited_reasons never rebuilds regex objects on hot paths.
_COMPILED: dict[str, re.Pattern[str]] = {
    reason: re.compile(
        "|".join(rf"\b{re.escape(term)}\b" for term in terms),
        re.IGNORECASE,
    )
    for reason, terms in PROHIBITED_TERMS.items()
}


def find_prohibited_reasons(*texts: str) -> list[str]:
    """Checks listing text against a keyword list of items UNC Charlotte
    Housing & Residence Life prohibits, plus drugs/alcohol per our Terms.
    Returns the matched category labels (e.g. ["weapon", "alcohol"]) — empty
    if nothing matched. Word-filter based, so it will have false positives
    (e.g. "weed whacker") — that's an accepted trade-off; sellers can edit
    the listing to clear a flag."""
    combined = " ".join(t or "" for t in texts)
    return [reason for reason, pattern in _COMPILED.items() if pattern.search(combined)]
