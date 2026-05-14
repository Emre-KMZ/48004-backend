from django.core.management.base import BaseCommand
from ministore.models import CustomUser, StoreStatus, Category, Product


CATEGORIES = [
    {"name": "Electronics", "description": "Gadgets, devices, and accessories"},
    {"name": "Clothing", "description": "Apparel for all occasions"},
    {"name": "Home & Kitchen", "description": "Everything for your home"},
    {"name": "Books", "description": "Fiction, non-fiction, and more"},
    {"name": "Sports", "description": "Equipment and apparel for athletes"},
]

PRODUCTS = [
    {"name": "Wireless Headphones", "description": "Noise-cancelling over-ear headphones", "price": "89.99", "stock": 50, "category": "Electronics"},
    {"name": "Mechanical Keyboard", "description": "RGB backlit mechanical keyboard", "price": "129.99", "stock": 30, "category": "Electronics"},
    {"name": "USB-C Hub", "description": "7-in-1 USB-C hub with HDMI and ethernet", "price": "39.99", "stock": 100, "category": "Electronics"},
    {"name": "Running Shoes", "description": "Lightweight shoes for long-distance running", "price": "74.99", "stock": 40, "category": "Sports"},
    {"name": "Yoga Mat", "description": "Non-slip 6mm thick yoga mat", "price": "24.99", "stock": 60, "category": "Sports"},
    {"name": "Cotton T-Shirt", "description": "Classic fit 100% cotton t-shirt", "price": "14.99", "stock": 200, "category": "Clothing"},
    {"name": "Denim Jacket", "description": "Classic denim jacket, unisex", "price": "59.99", "stock": 35, "category": "Clothing"},
    {"name": "Coffee Maker", "description": "12-cup programmable coffee maker", "price": "49.99", "stock": 25, "category": "Home & Kitchen"},
    {"name": "Non-Stick Pan Set", "description": "3-piece non-stick frying pan set", "price": "34.99", "stock": 45, "category": "Home & Kitchen"},
    {"name": "The Pragmatic Programmer", "description": "Classic software engineering book", "price": "44.99", "stock": 20, "category": "Books"},
    {"name": "Atomic Habits", "description": "Build good habits, break bad ones", "price": "18.99", "stock": 80, "category": "Books"},
]


class Command(BaseCommand):
    help = "Seed the database with sample data"

    def handle(self, *args, **kwargs):
        self.stdout.write("Seeding database...")

        # Store status
        StoreStatus.objects.get_or_create(store_name="MiniStore", defaults={"is_online": True})
        self.stdout.write("  ✓ StoreStatus")

        # Admin user
        if not CustomUser.objects.filter(email="admin@ministore.com").exists():
            CustomUser.objects.create_superuser(
                email="admin@ministore.com",
                password="admin123",
                full_name="Admin User",
            )
            self.stdout.write("  ✓ Admin user: admin@ministore.com / admin123")
        else:
            self.stdout.write("  - Admin user already exists")

        # Customer user
        if not CustomUser.objects.filter(email="customer@ministore.com").exists():
            CustomUser.objects.create_user(
                email="customer@ministore.com",
                password="customer123",
                full_name="Jane Doe",
                role="Customer",
            )
            self.stdout.write("  ✓ Customer user: customer@ministore.com / customer123")
        else:
            self.stdout.write("  - Customer user already exists")

        # Categories
        category_map = {}
        for cat in CATEGORIES:
            obj, created = Category.objects.get_or_create(name=cat["name"], defaults={"description": cat["description"]})
            category_map[obj.name] = obj
        self.stdout.write(f"  ✓ {len(CATEGORIES)} categories")

        # Products
        created_count = 0
        for p in PRODUCTS:
            _, created = Product.objects.get_or_create(
                name=p["name"],
                defaults={
                    "description": p["description"],
                    "price": p["price"],
                    "stock": p["stock"],
                    "category": category_map.get(p["category"]),
                    "is_active": True,
                },
            )
            if created:
                created_count += 1
        self.stdout.write(f"  ✓ {created_count} products created ({len(PRODUCTS) - created_count} already existed)")

        self.stdout.write(self.style.SUCCESS("Done."))
