from django.db import migrations, models


def sync_is_available_with_stock(apps, schema_editor):
    Product = apps.get_model("ministore", "Product")
    Product.objects.filter(stock=0).update(is_available=False)
    Product.objects.filter(stock__gt=0).update(is_available=True)


class Migration(migrations.Migration):

    dependencies = [
        ("ministore", "0005_customuser_date_joined"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="is_available",
            field=models.BooleanField(default=True),
        ),
        migrations.RunPython(sync_is_available_with_stock, migrations.RunPython.noop),
    ]
