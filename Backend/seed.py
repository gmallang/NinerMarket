from datetime import datetime, timedelta, timezone

from auth import hash_password
from models import Listing, Rating, User

SEED_PASSWORD = "ninermarket-demo"

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


def seed_dev_store(
    users: dict, listings: dict, ratings: dict, threads: dict, notifications: dict
) -> None:
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
        email: str | None = None,
    ) -> User:
        return User(
            id=user_id,
            email=email or f"{user_id}@charlotte.edu",
            display_name=name,
            school_year=school_year,
            payment_methods=payment_methods or ["Cash", "Venmo"],
            rating_avg=rating_avg,
            rating_count=rating_count,
            password_hash=hash_password(SEED_PASSWORD),
            email_verified=True,
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
        "u-anna":    user("u-anna",    "Anna C.",    4.8, 21, "Senior",    ["Cash", "Venmo", "Zelle"], email="anna@charlotte.edu"),
    }
    users.update(sellers)

    demo = [
        (1,  "Organic Chemistry (Clayden) 2nd Ed.", 45,   "textbooks",  "Good",     "North Campus",      "photo-1544716278-ca5e3f4abd8c", "seller-1",  "2h"),
        (2,  "IKEA KALLAX Shelf Unit (White)",       35,   "furniture",  "Like New", "West Dorms",        "photo-1650315532817-02e0e9245e74", "seller-2",  "5h"),
        (3,  "Twin XL Mattress Topper",              28,   "movein",     "Good",     "East Side",         "photo-1505693416388-ac5ce068fe85", "seller-3",  "1d"),
        (4,  'MacBook Pro 14" M2 (2023)',            1100, "electronics","Excellent","Main Quad",          "photo-1517336714731-489689fd1ca8", "seller-4",  "3h"),
        (5,  "Trek 7.2 FX City Bike",                280,  "bikes",      "Good",     "South Gate",        "photo-1485965120184-e220f721d03e", "seller-5",  "6h"),
        (6,  "Calculus: Early Transcendentals 8e",   30,   "textbooks",  "Fair",     "Engineering Hall",  "photo-1512820790803-83ca734da794", "seller-6",  "12h"),
        (7,  "Mini Fridge (Galanz 3.1 cu ft)",       65,   "movein",     "Good",     "Res Life Complex",  "photo-1584568694244-14fbdf83bd30", "seller-7",  "2d"),
        (8,  "Desk Lamp + USB Charging Hub",         18,   "movein",     "Like New", "North Campus",      "photo-1507473885765-e6ed057f782c", "seller-8",  "4h"),
        (9,  "Sigma Chi Formal Suit (38R)",           55,   "clothing",   "Good",     "Greek Row",         "photo-1592343516109-362f7bd871aa", "seller-9",  "1d"),
        (10, "Peer Tutoring — Orgo & Bio Chem",      20,   "services",   "Service",  "Science Center",    "photo-1434030216411-0b793f4b4173", "seller-10", "3d"),
        (11, "Psychology 101 Course Pack Bundle",    22,   "textbooks",  "Good",     "Social Sciences",   "photo-1456513080510-7bf3a84b82f8", "seller-11", "7h"),
        (12, "Standing Desk Converter",              48,   "furniture",  "Like New", "Off-Campus Ave",    "photo-1593642632559-0c6d3fc62b89", "seller-12", "5d"),
        (13, "2BR Sublet — Spring Semester",         750,  "housing",    "Good",     "Off-Campus Ave",    "photo-1522708323590-d24dbb6b0267", "seller-13", "1d"),
        (14, "Roommate Wanted — UWalk 2BR",          550,  "housing",    "Good",     "UWalk",             "photo-1502672260266-1c1ef2d93688", "seller-14", "3h"),
    ]


    hours_map = {"h": 1, "d": 24}
    seller_listing_ids: dict[str, list[str]] = {}

    # Extra picsum seeds used only to build multi-photo galleries on the stock
    # listings, so the detail page's prev/next arrows, dots and counter are
    # testable without uploading custom photos.
    gallery_extra = [
        "photo-1523275335684-37898b6baf30",
        "photo-1550259979-ed79b48d2a30",
        "photo-1542291026-7eec264c27ff",
        "photo-1496181133206-80ce9b88a853",
        "photo-1505740420928-5e560c06d30e",
        "photo-1526170375885-4d8ecf77b99f",
        "photo-1493666438817-866a91353ca9",
        "photo-1523192191542-242acc4e7396",
    ]

    for idx, (_, name, price, category, condition, campus, image, seller_id, ago) in enumerate(demo):
        n = int(ago[:-1])
        # Use picsum.photos for actual photography placeholders instead of text
        photo = f"https://picsum.photos/seed/{image}/800/800"
        # Primary photo first, then 2–4 gallery images from the extra pool
        # (rotated per listing so adjacent cards differ). Kept under 5 so the
        # thumbnails strip doesn't force itself to the URL-list only.
        extras = [
            f"https://picsum.photos/seed/{gallery_extra[(idx + j) % len(gallery_extra)]}/800/800"
            for j in range(2 + (idx % 3))
        ]
        photos = [photo, *extras]
        listing = Listing(
            id=str(_),
            seller_id=seller_id,
            name=name,
            price=price,
            category=category,
            condition=condition,
            description=name,
            status="active",
            photos=photos,
            photos_small=photos,
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

    _seed_demo_threads(threads, now)
    _seed_demo_notifications(notifications, now)


def _seed_demo_threads(threads: dict, now: datetime) -> None:
    def minutes_ago(n: int) -> str:
        return (now - timedelta(minutes=n)).isoformat()

    def hours_ago(n: int) -> str:
        return minutes_ago(n * 60)

    def days_ago(n: int) -> str:
        return minutes_ago(n * 1440)

    seed = [
        {
            "id": 1,
            "user_id": "u-anna",
            "listingId": "4",
            "name": "Chris L.",
            "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&auto=format",
            "online": True,
            "unread": 2,
            "lastMsg": "Is it still available?",
            "lastTimestamp": hours_ago(3),
            "messages": [
                {"id": 1, "text": "Hey! Is the MacBook still available?", "sent": False, "timestamp": hours_ago(8)},
                {"id": 2, "text": "Yes it is! Just listed it yesterday.", "sent": True, "timestamp": minutes_ago(8 * 60 - 2)},
                {"id": 3, "text": "What's the lowest you'd go?", "sent": False, "timestamp": minutes_ago(8 * 60 - 3)},
                {"id": 4, "text": "I could do $1,050 if you pick up today.", "sent": True, "timestamp": hours_ago(7)},
                {"id": 5, "text": "Is it still available?", "sent": False, "timestamp": hours_ago(3)},
            ],
        },
        {
            "id": 2,
            "user_id": "u-anna",
            "listingId": "1",
            "name": "Maya T.",
            "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&auto=format",
            "online": False,
            "unread": 0,
            "lastMsg": "Can you hold it til Friday?",
            "lastTimestamp": days_ago(1),
            "messages": [
                {"id": 1, "text": "Hi! Is the Organic Chem book in good shape?", "sent": False, "timestamp": hours_ago(26)},
                {"id": 2, "text": "Yep, no highlighting, all pages intact.", "sent": True, "timestamp": minutes_ago(26 * 60 - 5)},
                {"id": 3, "text": "Can you hold it til Friday?", "sent": False, "timestamp": minutes_ago(26 * 60 - 10)},
            ],
        },
        {
            "id": 3,
            "user_id": "u-anna",
            "listingId": "5",
            "name": "Sam R.",
            "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&auto=format",
            "online": True,
            "unread": 2,
            "lastMsg": "Meet at the bike rack?",
            "lastTimestamp": hours_ago(6),
            "messages": [
                {"id": 1, "text": "Does the bike come with a lock?", "sent": False, "timestamp": hours_ago(7)},
                {"id": 2, "text": "No lock, but I can throw in the pump.", "sent": True, "timestamp": minutes_ago(7 * 60 - 2)},
                {"id": 3, "text": "Deal! Meet at the bike rack?", "sent": False, "timestamp": hours_ago(6)},
            ],
        },
        {
            "id": 4,
            "user_id": "u-anna",
            "listingId": "7",
            "name": "Olivia M.",
            "avatar": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&h=80&fit=crop&auto=format",
            "online": False,
            "unread": 1,
            "lastMsg": "Does the fridge smell?",
            "lastTimestamp": days_ago(2),
            "messages": [
                {"id": 1, "text": "Does the fridge smell?", "sent": False, "timestamp": days_ago(2)},
            ],
        },
    ]
    for t in seed:
        threads[t["id"]] = t


def _seed_demo_notifications(notifications: dict, now: datetime) -> None:
    def hours_ago(n: int) -> str:
        return (now - timedelta(hours=n)).isoformat()

    notifications["u-anna"] = [
        {
            "id": "n-1",
            "user_id": "u-anna",
            "text": "Chris L. sent you a message about MacBook Pro 14\" M2 (2023).",
            "listing_id": "4",
            "created_at": hours_ago(3),
            "read": False,
        },
        {
            "id": "n-2",
            "user_id": "u-anna",
            "text": "New listing in Housing & Leasing: 2BR Sublet — Spring Semester.",
            "listing_id": "13",
            "created_at": hours_ago(8),
            "read": False,
        },
        {
            "id": "n-3",
            "user_id": "u-anna",
            "text": "Welcome to NinerMarket! Complete your profile to get started.",
            "listing_id": "",
            "created_at": hours_ago(30),
            "read": True,
        },
    ]


def seed_supabase_store(db) -> None:
    """Insert the demo data into a real Supabase database (idempotent).

    Each table is seeded only when empty, so re-runs are safe and partial
    states can be completed by running again.
    """
    users, listings, ratings, threads, notifications = {}, {}, {}, {}, {}
    seed_dev_store(users, listings, ratings, threads, notifications)

    def table_empty(table: str) -> bool:
        return not db.table(table).select("id").limit(1).execute().data

    if users and table_empty("users"):
        db.table("users").insert([u.model_dump(mode="json") for u in users.values()]).execute()
    if listings and table_empty("listings"):
        db.table("listings").insert([l.model_dump(mode="json") for l in listings.values()]).execute()
    if ratings and table_empty("ratings"):
        db.table("ratings").insert([r.model_dump(mode="json") for r in ratings.values()]).execute()

    if threads and table_empty("threads"):
        next_msg_id = 1
        for t in threads.values():
            messages = t.pop("messages", [])
            row = dict(t)
            row["id"] = str(row["id"])
            db.table("threads").insert(row).execute()
            if messages:
                db.table("messages").insert(
                    [
                        {**m, "id": next_msg_id + i, "thread_id": str(row["id"])}
                        for i, m in enumerate(messages)
                    ]
                ).execute()
                next_msg_id += len(messages)

    if notifications and table_empty("notifications"):
        for uid, items in notifications.items():
            db.table("notifications").insert(items).execute()
