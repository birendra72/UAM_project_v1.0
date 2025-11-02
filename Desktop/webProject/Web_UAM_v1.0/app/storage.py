import os
from abc import ABC, abstractmethod
from typing import BinaryIO, Optional, IO, cast
from datetime import timedelta
import boto3
from botocore.client import Config
from minio import Minio
from app.config import settings


class StorageBackend(ABC):
    @abstractmethod
    def upload_fileobj(self, key: str, fileobj: BinaryIO, metadata: Optional[dict] = None) -> str:
        pass

    @abstractmethod
    def put_object(self, key: str, data: bytes, metadata: Optional[dict] = None) -> str:
        pass

    @abstractmethod
    def get_presigned_url(self, key: str, expiry_seconds: int = 3600) -> str:
        pass

    @abstractmethod
    def get_object(self, key: str) -> IO[bytes]:
        pass

    @abstractmethod
    def download_stream(self, key: str) -> IO[bytes]:
        pass

    @abstractmethod
    def list_prefix(self, prefix: str) -> list[str]:
        pass

    @abstractmethod
    def delete_file(self, key: str) -> None:
        pass


class LocalStorage(StorageBackend):
    def __init__(self, base_path: str = "./storage"):
        self.base_path = base_path
        os.makedirs(self.base_path, exist_ok=True)

    def upload_fileobj(self, key: str, fileobj: BinaryIO, metadata: Optional[dict] = None) -> str:
        path = os.path.join(self.base_path, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(fileobj.read())
        return key

    def put_object(self, key: str, data: bytes, metadata: Optional[dict] = None) -> str:
        path = os.path.join(self.base_path, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(data)
        return key

    def get_presigned_url(self, key: str, expiry_seconds: int = 3600) -> str:
        # For local, return file path or serve via static
        return f"/files/{key}"

    def get_object(self, key: str) -> IO[bytes]:
        path = os.path.join(self.base_path, key)
        return open(path, 'rb')

    def download_stream(self, key: str) -> IO[bytes]:
        path = os.path.join(self.base_path, key)
        return open(path, 'rb')

    def list_prefix(self, prefix: str) -> list[str]:
        path = os.path.join(self.base_path, prefix)
        if not os.path.exists(path):
            return []
        return [os.path.relpath(os.path.join(root, file), self.base_path)
                for root, dirs, files in os.walk(path) for file in files]

    def delete_file(self, key: str) -> None:
        path = os.path.join(self.base_path, key)
        if os.path.exists(path):
            os.remove(path)


class S3MinIOClient(StorageBackend):
    def __init__(self, endpoint: str, access_key: str, secret_key: str, bucket: str, secure: bool = False):
        self.client = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure
        )
        self.bucket = bucket
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)

    def upload_fileobj(self, key: str, fileobj: BinaryIO, metadata: Optional[dict] = None) -> str:
        self.client.put_object(
            self.bucket,
            key,
            fileobj,
            length=-1,
            part_size=10*1024*1024,  # 10MB
            metadata=metadata or {}
        )
        return key

    def put_object(self, key: str, data: bytes, metadata: Optional[dict] = None) -> str:
        from io import BytesIO
        fileobj = BytesIO(data)
        return self.upload_fileobj(key, fileobj, metadata)

    def get_presigned_url(self, key: str, expiry_seconds: int = 3600) -> str:
        return self.client.presigned_get_object(self.bucket, key, expires=timedelta(seconds=expiry_seconds))

    def get_object(self, key: str) -> IO[bytes]:
        from typing import cast
        response = self.client.get_object(self.bucket, key)
        return cast(IO[bytes], response)  # MinIO response is file-like

    def download_stream(self, key: str) -> IO[bytes]:
        from typing import cast
        response = self.client.get_object(self.bucket, key)
        return cast(IO[bytes], response)  # MinIO response is file-like

    def list_prefix(self, prefix: str) -> list[str]:
        objects = self.client.list_objects(self.bucket, prefix=prefix)
        return [obj.object_name for obj in objects]

    def delete_file(self, key: str) -> None:
        self.client.remove_object(self.bucket, key)


# Factory function
def get_storage_backend() -> StorageBackend:
    if not settings.USE_MINIO:
        return LocalStorage("./storage")
    else:
        return S3MinIOClient(
            settings.MINIO_ENDPOINT,
            settings.MINIO_ACCESS_KEY,
            settings.MINIO_SECRET_KEY,
            settings.MINIO_BUCKET,
            secure=False  # For local MinIO
        )


storage = get_storage_backend()
