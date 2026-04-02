from django.db import models

class StoreStatus(models.Model):
    store_name = models.CharField(max_length=100)
    is_online = models.BooleanField(default=True)

    def __str__(self):
        return self.store_name
