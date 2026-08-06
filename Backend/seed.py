from datetime import datetime, timedelta, timezone

from models import Listing, Rating, User

RATING_COMMENTS = [
    "Smooth transaction, exactly as described.",
    "Fast and friendly, would buy from again.",
    "Great communication and fair price.",
    "Item was in great condition, thank you!",
    "On time and polite, easy meetup.",
    "Would definitely recommend this seller.",
    "Everything went perfectly, no issues.",
    "Very responsive and helpful.",
]


def _make_ratings(
    seller_id: str,
    avg: float,
    count: int,
    listing_ids: list[str],
    rater_ids: list[str],
    now: datetime,
) -> list[Rating]:
    if count <= 0:
        return []
    base = int(avg)
    total = round(avg * count)
    stars_list = [base] * count
    for i in range(total - base * count):
        stars_list[i] += 1
    out = []
    for i in range(count):
        out.append(
            Rating(
                id=f"r-{seller_id}-{i + 1}",
                rater_id=rater_ids[i % len(rater_ids)],
                ratee_id=seller_id,
                listing_id=listing_ids[i % len(listing_ids)] if listing_ids else "",
                stars=max(1, min(5, stars_list[i])),
                comment=RATING_COMMENTS[i % len(RATING_COMMENTS)],
                created_at=now - timedelta(days=i % 90, hours=(i * 7) % 24),
            )
        )
    return out


def seed_dev_store(users: dict, listings: dict, ratings: dict) -> None:
    if users or listings:
        return

    now = datetime.now(timezone.utc)

    def user(
        user_id: str,
        name: str,
        rating_avg: float,
        rating_count: int,
        school_year: str = "Junior",
        payment_methods: list[str] | None = None,
    ) -> User:
        return User(
            id=user_id,
            email=f"{user_id}@charlotte.edu",
            display_name=name,
            school_year=school_year,
            payment_methods=payment_methods or ["Cash", "Venmo"],
            rating_avg=rating_avg,
            rating_count=rating_count,
        )

    sellers = {
        "seller-1":  user("seller-1",  "Maya T.",    4.9, 32, "Senior",    ["Cash", "Venmo", "Zelle"]),
        "seller-2":  user("seller-2",  "Jordan K.",  5.0, 18, "Junior",    ["Cash", "Venmo"]),
        "seller-3":  user("seller-3",  "Priya S.",   4.7, 41, "Graduate",  ["Zelle", "PayPal"]),
        "seller-4":  user("seller-4",  "Chris L.",   4.8, 27, "Senior",    ["Cash", "Venmo", "Apple Pay"]),
        "seller-5":  user("seller-5",  "Sam R.",     4.6, 15, "Sophomore", ["Cash", "Venmo", "PayPal"]),
        "seller-6":  user("seller-6",  "Alex P.",    4.5, 22, "Junior",    ["Cash", "Venmo"]),
        "seller-7":  user("seller-7",  "Olivia M.",  4.9, 38, "Senior",    ["Venmo", "Zelle", "Apple Pay"]),
        "seller-8":  user("seller-8",  "Nadia W.",   4.8, 11, "Freshman",  ["Cash", "Venmo"]),
        "seller-9":  user("seller-9",  "Tyler B.",   4.4, 9,  "Junior",    ["Cash", "Venmo", "Zelle"]),
        "seller-10": user("seller-10", "Emma Z.",    5.0, 25, "Faculty / Staff", ["Cash", "PayPal"]),
        "seller-11": user("seller-11", "Lena H.",    4.7, 19, "Sophomore", ["Cash", "Venmo", "Apple Pay"]),
        "seller-12": user("seller-12", "Felix G.",   4.6, 14, "Graduate",  ["Venmo", "Zelle"]),
        "seller-13": user("seller-13", "Daniel R.",  4.7, 12, "Senior",    ["Venmo", "Zelle", "Bank Transfer"]),
        "seller-14": user("seller-14", "Sofia L.",   4.9, 16, "Graduate",  ["Venmo", "Zelle"]),
        "u-anna":    user("u-anna",    "Anna C.",    4.8, 21, "Senior",    ["Cash", "Venmo", "Zelle"]),
    }
    users.update(sellers)

    demo = [
        (1,  "Organic Chemistry (Clayden) 2nd Ed.", 45,   "textbooks",  "Good",     "North Campus",      200, "seller-1",  "2h"),
        (2,  "IKEA KALLAX Shelf Unit (White)",       35,   "furniture",  "Like New", "West Dorms",        201, "seller-2",  "5h"),
        (3,  "Twin XL Mattress Topper",              28,   "movein",     "Good",     "East Side",         202, "seller-3",  "1d"),
        (4,  'MacBook Pro 14" M2 (2023)',            1100, "electronics","Excellent","Main Quad",          203, "seller-4",  "3h"),
        (5,  "Trek 7.2 FX City Bike",                280,  "bikes",      "Good",     "South Gate",        204, "seller-5",  "6h"),
        (6,  "Calculus: Early Transcendentals 8e",   30,   "textbooks",  "Fair",     "Engineering Hall",  205, "seller-6",  "12h"),
        (7,  "Mini Fridge (Galanz 3.1 cu ft)",       65,   "movein",     "Good",     "Res Life Complex",  206, "seller-7",  "2d"),
        (8,  "Desk Lamp + USB Charging Hub",         18,   "movein",     "Like New", "North Campus",      207, "seller-8",  "4h"),
        (9,  "Sigma Chi Formal Suit (38R)",           55,   "clothing",   "Good",     "Greek Row",         208, "seller-9",  "1d"),
        (10, "Peer Tutoring — Orgo & Bio Chem",      20,   "services",   "Service",  "Science Center",    209, "seller-10", "3d"),
        (11, "Psychology 101 Course Pack Bundle",    22,   "textbooks",  "Good",     "Social Sciences",   210, "seller-11", "7h"),
        (12, "Standing Desk Converter",              48,   "furniture",  "Like New", "Off-Campus Ave",    211, "seller-12", "5d"),
        (13, "2BR Sublet — Spring Semester",         750,  "housing",    "Good",     "Off-Campus Ave",    212, "seller-13", "1d"),
        (14, "Roommate Wanted — UWalk 2BR",          550,  "housing",    "Good",     "UWalk",             213, "seller-14", "3h"),
    ]


    hours_map = {"h": 1, "d": 24}
    seller_listing_ids: dict[str, list[str]] = {}

    for _, name, price, category, condition, campus, image, seller_id, ago in demo:
        n = int(ago[:-1])
        listing = Listing(
            id=str(_),
            seller_id=seller_id,
            name=name,
            price=price,
            category=category,
            condition=condition,
            description=name,
            status="active",
            photos=[f"https://picsum.photos/seed/{image}/400/400"],
            pickup_location=campus,
            created_at=now - timedelta(hours=n * hours_map[ago[-1]]),
        )
        listings[listing.id] = listing
        seller_listing_ids.setdefault(seller_id, []).append(listing.id)

    rater_pool = [sid for sid in sellers if sid != "u-anna"] + ["u-anna"]
    for seller_id, seller in sellers.items():
        raters = [r for r in rater_pool if r != seller_id]
        for rating in _make_ratings(
            seller_id,
            seller.rating_avg,
            seller.rating_count,
            seller_listing_ids.get(seller_id, []),
            raters,
            now,
        ):
            ratings[rating.id] = rating
