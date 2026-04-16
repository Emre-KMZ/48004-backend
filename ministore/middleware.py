import jwt
from django.conf import settings
from django.http import JsonResponse

class JWTSecurityMiddleware:
    """
    Middleware to intercept every request to the '/api/' path,
    validate the JWT token, check expiration, and verify permissions.
    """
    def __init__(self, get_response):
        self.get_response = get_response
        self.open_paths = [
            '/api/login/',
            '/api/register/',
        ]

    def __call__(self, request):
        path = request.path

        # If not an /api/ route, skip JWT filtering
        if not path.startswith('/api/'):
            return self.get_response(request)

        # Allow open paths completely without tokens
        if any(path.startswith(open_path) for open_path in self.open_paths):
            return self.get_response(request)

        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return JsonResponse(
                {'error': 'Unauthorized', 'message': 'Missing or malformed Authorization header.'},
                status=401
            )

        token = auth_header.split(' ')[1]

        try:
            # Decode the token, this checks the signature and checks 'exp' claim automatically
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            
            # Extract the role or default to 'Customer'
            role = payload.get('role', 'Customer')
            
            # Attach to request for views to use if needed
            request.user_role = role
            request.jwt_payload = payload

        except jwt.ExpiredSignatureError:
            return JsonResponse(
                {'error': 'Unauthorized', 'message': 'Session expired.'},
                status=401
            )
        except jwt.InvalidTokenError:
            return JsonResponse(
                {'error': 'Unauthorized', 'message': 'Invalid token.'},
                status=401
            )

        # Role-aware authorization checking (Customer vs Admin)
        if path.startswith('/api/admin/'):
            if request.user_role != 'Admin':
                return JsonResponse(
                    {'error': 'Forbidden', 'message': 'You do not have permission to perform this action.'},
                    status=403
                )

        response = self.get_response(request)
        return response
