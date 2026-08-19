from fastapi import HTTPException
from starlette.status import HTTP_400_BAD_REQUEST, HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN, HTTP_404_NOT_FOUND, HTTP_429_TOO_MANY_REQUESTS, HTTP_500_INTERNAL_SERVER_ERROR, HTTP_503_SERVICE_UNAVAILABLE


class ApiException(HTTPException):
    def __init__(self, code: str, message: str, status_code: int = HTTP_400_BAD_REQUEST, details: dict | None = None): 
        content = {
            'error': {
                'code': code,
                'message': message,
                'details': details,
            }
        }
        super().__init__(status_code=status_code, detail=content)


class AuthenticationError(ApiException):
    def __init__(self, message: str = 'Authentication required.'):
        super().__init__('AUTHENTICATION_REQUIRED', message, HTTP_401_UNAUTHORIZED)


class AuthorizationError(ApiException):
    def __init__(self, message: str = 'Access denied.'):
        super().__init__('FORBIDDEN', message, HTTP_403_FORBIDDEN)


class NotFoundError(ApiException):
    def __init__(self, message: str = 'Resource not found.'):
        super().__init__('NOT_FOUND', message, HTTP_404_NOT_FOUND)


class RateLimitError(ApiException):
    def __init__(self, message: str = 'Too many requests.'):
        super().__init__('RATE_LIMIT_EXCEEDED', message, HTTP_429_TOO_MANY_REQUESTS)


class ServiceUnavailableError(ApiException):
    def __init__(self, message: str = 'Service temporarily unavailable.'):
        super().__init__('SERVICE_UNAVAILABLE', message, HTTP_503_SERVICE_UNAVAILABLE)
