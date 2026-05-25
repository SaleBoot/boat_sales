#!/usr/bin/env python3
# 将本地文件夹的内容“镜像”（Sync）到腾讯云对象存储（COS）中
from __future__ import annotations

import argparse
import hashlib
import mimetypes
import os
from pathlib import Path
from typing import Dict, Iterable

from qcloud_cos import CosConfig
from qcloud_cos import CosS3Client


REQUIRED_ENV_KEYS = (
    "SALESBOAT_COS_SECRET_ID",
    "SALESBOAT_COS_SECRET_KEY",
    "SALESBOAT_COS_REGION",
    "SALESBOAT_COS_BUCKET",
)


def parse_args() -> argparse.Namespace:
    """解析并返回命令行参数"""
    parser = argparse.ArgumentParser(description="Mirror local assets to Tencent COS.")
    parser.add_argument("--source", required=True, help="Local directory to upload.")
    parser.add_argument("--prefix", default="", help="Remote key prefix, e.g. gltf")
    parser.add_argument("--env-file", default="", help="Optional env file with COS credentials.")
    return parser.parse_args()


def load_env_file(env_file: str) -> None:
    """
    从指定文件加载环境变量。
 
    Args:
        env_file: 环境变量文件的路径。
    """
    if not env_file:
        return

    path = Path(env_file)
    if not path.is_file():
        return
    
    
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        ##   如果  行为空、以 '#' 开头、或不包含 '=' 字符，则跳过。
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        # 仅当环境变量未设置时才从文件加载，以避免覆盖由外部（如 shell）设置的变量
        # 只会设置当前环境中尚未设置的变量。
        if key and key not in os.environ:
            os.environ[key] = value


def require_env() -> Dict[str, str]:
    """
    检查并返回所有必需的环境变量。

    Raises:
        RuntimeError: 如果有任何必需的环境变量缺失。

    Returns:
        一个包含所有必需环境变量键值的字典。
    """
    values: Dict[str, str] = {}
    missing = []
    for key in REQUIRED_ENV_KEYS:
        value = os.environ.get(key, "").strip()
        if not value:
            missing.append(key)
            continue
        values[key] = value

    if missing:
        raise RuntimeError(f"missing required COS env vars: {', '.join(missing)}")

    return values


def normalize_prefix(prefix: str) -> str:
    """
    规范化 COS 存储桶中的对象键前缀。

    移除前后多余的空格和斜杠。

    Args:
        prefix: 原始前缀字符串。

    Returns:
        规范化后的前缀字符串。
    """
    normalized = prefix.strip().strip("/")
    return normalized


def iter_local_files(source_dir: Path) -> Iterable[Path]:
    """
    递归地遍历本地源目录下的所有文件。

    Args:
        source_dir: 要遍历的本地目录路径。

    Yields:
        一个 Path 对象，代表一个文件。
    """
    for path in sorted(source_dir.rglob("*")):
        if path.is_file():
            yield path


def compute_md5(file_path: Path) -> str:
    """
    计算文件的 MD5 哈希值。

    Args:
        file_path: 文件的路径。

    Returns:
        文件的 MD5 哈希值（十六进制字符串）。
    """
    digest = hashlib.md5()
    with file_path.open("rb") as handle:
        # 以块的形式读取文件，以处理大文件
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_local_index(source_dir: Path, prefix: str) -> Dict[str, Dict[str, object]]:
    """
    为本地文件构建索引。

    索引的键是预期的远程对象键，值包含文件路径和大小。

    Args:
        source_dir: 本地源目录。
        prefix: 远程对象键的前缀。

    Returns:
        一个代表本地文件索引的字典。
    """
    local_index: Dict[str, Dict[str, object]] = {}
    for file_path in iter_local_files(source_dir):
        relative_path = file_path.relative_to(source_dir).as_posix()
        remote_key = f"{prefix}/{relative_path}" if prefix else relative_path
        local_index[remote_key] = {
            "path": file_path,
            "size": file_path.stat().st_size,
        }
    return local_index


def build_remote_index(client: CosS3Client, bucket: str, prefix: str) -> Dict[str, Dict[str, object]]:
    """
    为远程 COS 存储桶中的对象构建索引。

    使用分页（marker）来处理大量的对象。

    Args:
        client: COS S3 客户端实例。
        bucket: 存储桶名称。
        prefix: 要索引的对象键前缀。

    Returns:
        一个代表远程对象索引的字典。
    """
    remote_index: Dict[str, Dict[str, object]] = {}
    marker = ""

    while True:
        response = client.list_objects(Bucket=bucket, Prefix=prefix, Marker=marker, MaxKeys=1000)
        for entry in response.get("Contents", []):
            key = entry["Key"]
            remote_index[key] = {
                "etag": str(entry.get("ETag", "")).strip('"'),
                "size": int(entry.get("Size", 0)),
            }

        # 如果响应被截断，则继续获取下一页
        truncated_flag = response.get("IsTruncated")
        if truncated_flag not in ("true", True):
            break

        marker = response.get("NextMarker", "")
        if not marker:
            break

    return remote_index


def upload_file(client: CosS3Client, bucket: str, key: str, file_path: Path) -> None:
    """
    上传单个文件到 COS。

    自动猜测并设置文件的 Content-Type。

    Args:
        client: COS S3 客户端实例。
        bucket: 存储桶名称。
        key: 远程对象的键。
        file_path: 要上传的本地文件的路径。
    """
    content_type, _ = mimetypes.guess_type(str(file_path))
    extra_headers = {}
    if content_type:
        extra_headers["ContentType"] = content_type

    with file_path.open("rb") as body:
        client.put_object(Bucket=bucket, Key=key, Body=body, **extra_headers)


def delete_keys(client: CosS3Client, bucket: str, keys: Iterable[str]) -> int:
    """
    从 COS 批量删除对象。

    COS 的 delete_objects 接口一次最多支持删除 1000 个对象。

    Args:
        client: COS S3 客户端实例。
        bucket: 存储桶名称。
        keys: 要删除的对象键的集合。

    Returns:
        已删除对象的总数。
    """
    key_list = list(keys)
    if not key_list:
        return 0

    deleted_total = 0
    # 分块处理，每块最多 1000 个键
    for start_index in range(0, len(key_list), 1000):
        chunk = key_list[start_index : start_index + 1000]
        client.delete_objects(
            Bucket=bucket,
            Delete={
                "Object": [{"Key": key} for key in chunk],
                "Quiet": "true",  # Quiet 模式可以减少响应体的大小
            },
        )
        deleted_total += len(chunk)

    return deleted_total


def main() -> int:
    """主执行函数"""
    args = parse_args()
    load_env_file(args.env_file)
    env_values = require_env()

    source_dir = Path(args.source).resolve()
    if not source_dir.is_dir():
        raise RuntimeError(f"source directory does not exist: {source_dir}")

    prefix = normalize_prefix(args.prefix)

    # 初始化 COS 客户端
    config = CosConfig(
        Region=env_values["SALESBOAT_COS_REGION"],
        SecretId=env_values["SALESBOAT_COS_SECRET_ID"],
        SecretKey=env_values["SALESBOAT_COS_SECRET_KEY"],
        Scheme="https",
    )
    client = CosS3Client(config)
    bucket = env_values["SALESBOAT_COS_BUCKET"]

    # 构建本地和远程文件索引
    print(f"[cos-sync] building local index for {source_dir}...")
    local_index = build_local_index(source_dir, prefix)
    print(f"[cos-sync] building remote index for bucket '{bucket}' with prefix '{prefix}'...")
    remote_index = build_remote_index(client, bucket, prefix)

    uploaded_count = 0
    skipped_count = 0
    # 遍历本地文件，决定是否需要上传
    for key, local_meta in local_index.items():
        remote_meta = remote_index.get(key)
        local_size = int(local_meta["size"])

        # 检查是否需要上传：远程不存在，或者文件大小不同
        needs_upload = remote_meta is None or int(remote_meta.get("size", -1)) != local_size

        if not needs_upload:
            # 如果文件大小相同，则进一步比较 MD5
            remote_etag = str(remote_meta.get("etag", "")).lower()
            # COS 的 ETag 对于分块上传的文件会带有'-'，这种情况下我们选择重新上传以确保一致性
            if "-" in remote_etag:
                needs_upload = True
            else:
                # 比较本地计算的 MD5 和远程的 ETag
                needs_upload = compute_md5(local_meta["path"]).lower() != remote_etag

        if not needs_upload:
            skipped_count += 1
            continue

        # 执行上传
        print(f"[cos-sync] uploading: {local_meta['path']} -> {key}")
        upload_file(client, bucket, key, local_meta["path"])
        uploaded_count += 1

    # 找出需要删除的远程文件（存在于远程但不存在于本地）
    stale_keys = sorted(set(remote_index.keys()) - set(local_index.keys()))
    if stale_keys:
        print(f"[cos-sync] deleting {len(stale_keys)} stale remote objects...")
        for key in stale_keys:
            print(f"  - {key}")
        deleted_count = delete_keys(client, bucket, stale_keys)
    else:
        deleted_count = 0

    print(
        f"\n[cos-sync] summary: source={source_dir} prefix={prefix or '.'} "
        f"uploaded={uploaded_count} skipped={skipped_count} deleted={deleted_count}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())