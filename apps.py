from django.apps import AppConfig
import nltk

class MyAppConfig(AppConfig):  # Renamed to MyAppConfig to avoid naming conflict
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'app'
    def ready(self):
        nltk.download("wordnet")
        nltk.download("stopwords")
        nltk.download("punkt")
