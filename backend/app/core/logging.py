from __future__ import annotations

from loguru import logger
import sys


def configure_logging() -> None:
    logger.remove()
    logger.add(
        sys.stdout,
        level='INFO',
        format='<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>',
        enqueue=True,
        backtrace=False,
        diagnose=False,
    )
