import os
import redis
from flask_caching import Cache

# Default to SimpleCache (for local development without Redis)
cache_config = {
    'CACHE_TYPE': 'SimpleCache',
    'CACHE_DEFAULT_TIMEOUT': 300
}

# If Redis is running on localhost, use it!
try:
    # Test connection with a fast timeout
    r = redis.Redis(host='localhost', port=6379, db=0, socket_connect_timeout=1)
    if r.ping():
        cache_config = {
            'CACHE_TYPE': 'RedisCache',
            'CACHE_REDIS_HOST': 'localhost',
            'CACHE_REDIS_PORT': 6379,
            'CACHE_DEFAULT_TIMEOUT': 300
        }
except Exception:
    pass

cache = Cache(config=cache_config)
