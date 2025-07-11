# gemini-legion-backend/src/core/config.py

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Manages application settings loaded from environment variables.
    """
    # The name of the commander, consistent with the frontend constant.
    LEGION_COMMANDER_NAME: str = "Steven"
    
    # Your Gemini API Key. The application will not function without this.
    GEMINI_API_KEY: str

    # Configuration to load variables from a .env file.
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding='utf-8')

# Create a single, importable instance of the settings.
# Other modules will import this `settings` object to access configuration.
settings = Settings()