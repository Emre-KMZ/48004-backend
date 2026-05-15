import os
from django.core.management.base import BaseCommand
from django.core.management import call_command
from ministore.models import Category, Product, Order
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.conf import settings

class Command(BaseCommand):
    help = 'Resets database to current_state.json and uploads initial_media to Minio'

    def handle(self, *args, **options):
        self.stdout.write("Clearing existing data...")
        Order.objects.all().delete()
        Product.objects.all().delete()
        Category.objects.all().delete()
        
        self.stdout.write("Loading fixture data...")
        fixture_path = os.path.join(settings.BASE_DIR, 'ministore', 'fixtures', 'current_state.json')
        if os.path.exists(fixture_path):
            call_command('loaddata', fixture_path)
        else:
            self.stdout.write("No current_state.json fixture found.")
        
        self.stdout.write("Uploading media to Minio...")
        initial_media_dir = os.path.join(settings.BASE_DIR, 'initial_media')
        if os.path.exists(initial_media_dir):
            for root, dirs, files in os.walk(initial_media_dir):
                for file in files:
                    if file == '.DS_Store':
                        continue
                    local_path = os.path.join(root, file)
                    rel_path = os.path.relpath(local_path, initial_media_dir)
                    
                    with open(local_path, 'rb') as f:
                        if default_storage.exists(rel_path):
                            default_storage.delete(rel_path)
                        default_storage.save(rel_path, ContentFile(f.read()))
                        self.stdout.write(f"Uploaded {rel_path}")
        else:
            self.stdout.write("No initial_media directory found.")
            
        self.stdout.write(self.style.SUCCESS('Successfully reset application state!'))
