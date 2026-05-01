from django.conf import settings
from django.db import models, transaction
from django.core.validators import MinValueValidator
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db.models.signals import pre_delete, pre_save, post_delete
from django.dispatch import receiver
from django.core.files.storage import default_storage
import uuid

class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'Admin')
        return self.create_user(email, password, **extra_fields)

class CustomUser(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=50, default='Customer')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    def __str__(self):
        return self.email


class StoreStatus(models.Model):
    store_name = models.CharField(max_length=100)
    is_online = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "store statuses"

    def __str__(self):
        return self.store_name


def category_image_path(instance, filename):
    ext = filename.split('.')[-1]
    timestamp = int(time.time())
    return f'categories/images/cat_{timestamp}_{uuid.uuid4().hex[:6]}.{ext}'

class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    slug = models.SlugField(max_length=150, unique=True, blank=True, null=True)
    image = models.ImageField(upload_to=category_image_path, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


def product_image_path(instance, filename):
    ext = filename.split('.')[-1]
    prod_id = instance.product.id if instance.product else "new"
    return f'products/images/product_{prod_id}_{uuid.uuid4().hex[:8]}.{ext}'

class Product(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    keywords = models.TextField(blank=True)
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    stock = models.PositiveIntegerField(default=0)
    is_available = models.BooleanField(default=True)
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def in_stock(self):
        return self.stock > 0

    def save(self, *args, **kwargs):
        # Keep availability in sync with stock for source-of-truth consistency.
        self.is_available = self.stock > 0
        super().save(*args, **kwargs)

class ProductImage(models.Model):
    product = models.ForeignKey(Product, related_name='images', on_delete=models.CASCADE)
    image = models.ImageField(upload_to=product_image_path)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"Image for {self.product.name}"


class Cart(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cart",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Cart of {self.user.email}"

    @property
    def total_price(self):
        return sum(item.line_total for item in self.items.all())

    @property
    def total_items(self):
        return sum(item.quantity for item in self.items.all())


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="cart_items"
    )
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])

    class Meta:
        unique_together = ("cart", "product")

    def __str__(self):
        return f"{self.quantity}x {self.product.name}"

    @property
    def line_total(self):
        return self.product.price * self.quantity


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        SHIPPED = "shipped", "Shipped"
        DELIVERED = "delivered", "Delivered"
        CANCELLED = "cancelled", "Cancelled"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="orders",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    shipping_address = models.TextField()
    contact_name = models.CharField(max_length=255, blank=True, default="")
    contact_email = models.EmailField(blank=True, default="")
    contact_phone = models.CharField(max_length=50, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Order #{self.pk} by {self.user.email}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True, related_name="order_items"
    )
    product_name = models.CharField(max_length=200)
    product_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    def __str__(self):
        return f"{self.quantity}x {self.product_name}"

    @property
    def line_total(self):
        return self.product_price * self.quantity


def _adjust_inventory_for_order(order, *, increment):
    """
    Increment/decrement inventory for all order items atomically.
    Called by order status transitions and delete hooks.
    """
    if not order.pk:
        return

    with transaction.atomic():
        for item in order.items.select_related("product"):
            if not item.product_id:
                continue

            product = Product.objects.select_for_update().get(pk=item.product_id)
            if increment:
                product.stock = product.stock + item.quantity
            else:
                product.stock = product.stock - item.quantity
            if product.stock < 0:
                raise ValueError(f"Negative stock adjustment prevented for product {product.id}")
            product.save(update_fields=["stock", "is_available"])

# Disk File Cleanup Hooks
# Disk File Cleanup Hooks mapped to ProductImage explicitly
@receiver(post_delete, sender=ProductImage)
def auto_delete_file_on_delete(sender, instance, **kwargs):
    if instance.image and default_storage.exists(instance.image.name):
        default_storage.delete(instance.image.name)

@receiver(pre_save, sender=ProductImage)
def auto_delete_file_on_change(sender, instance, **kwargs):
    if not instance.pk:
        return False
    try:
        old_file = ProductImage.objects.get(pk=instance.pk).image
    except ProductImage.DoesNotExist:
        return False
    
    new_file = instance.image
    if not old_file == new_file and old_file and default_storage.exists(old_file.name):
        default_storage.delete(old_file.name)


@receiver(pre_save, sender=Order)
def handle_order_status_inventory_transitions(sender, instance, **kwargs):
    if not instance.pk:
        return

    previous = Order.objects.filter(pk=instance.pk).values_list("status", flat=True).first()
    if previous == instance.status:
        return

    if previous != Order.Status.CANCELLED and instance.status == Order.Status.CANCELLED:
        _adjust_inventory_for_order(instance, increment=True)
    elif previous == Order.Status.CANCELLED and instance.status != Order.Status.CANCELLED:
        _adjust_inventory_for_order(instance, increment=False)


@receiver(pre_delete, sender=Order)
def restock_on_order_delete(sender, instance, **kwargs):
    if instance.status != Order.Status.CANCELLED:
        _adjust_inventory_for_order(instance, increment=True)
