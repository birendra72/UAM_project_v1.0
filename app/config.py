import os
from dotenv import load_dotenv
from urllib.parse import urlparse, urlunparse

load_dotenv()

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///uam.db")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_BUCKET: str = os.getenv("MINIO_BUCKET", "artifacts")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "my-secret-key-for-uam")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours
    USE_MINIO: bool = os.getenv("USE_MINIO", "false").lower() == "true"

    def __init__(self):
        # Clean DATABASE_URL to remove invalid psycopg2 options like 'pgbouncer'
        if self.DATABASE_URL.startswith("postgresql"):
            parsed = urlparse(self.DATABASE_URL)
            # Remove query parameters that psycopg2 doesn't recognize
            invalid_params = {'pgbouncer'}
            query_params = parsed.query.split('&') if parsed.query else []
            valid_params = [p for p in query_params if not any(inv in p for inv in invalid_params)]
            parsed = parsed._replace(query='&'.join(valid_params) if valid_params else '')
            self.DATABASE_URL = urlunparse(parsed)

            # Ensure password is properly URL-encoded to handle special characters like @
            if '@' in parsed.netloc and parsed.netloc.count('@') > 1:
                # Reconstruct with proper encoding
                user_pass, host_port = parsed.netloc.rsplit('@', 1)
                if ':' in user_pass:
                    user, password = user_pass.rsplit(':', 1)
                    # URL encode the password
                    from urllib.parse import quote
                    encoded_password = quote(password, safe='')
                    self.DATABASE_URL = self.DATABASE_URL.replace(f'{user}:{password}@{host_port}', f'{user}:{encoded_password}@{host_port}')


settings = Settings()
