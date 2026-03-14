from http.server import BaseHTTPRequestHandler, HTTPServer
import json

class MockAuthHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/auth/cli-token/':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            token = data.get('token')
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            if token == 'valid-mock-token-123':
                response = {
                    "success": True,
                    "username": "MockUser",
                    "message": "Token validated successfully."
                }
            else:
                response = {
                    "success": False,
                    "message": "Invalid or inactive token."
                }
                self.send_response(401)
                
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def run(port=8080):
    server_address = ('', port)
    httpd = HTTPServer(server_address, MockAuthHandler)
    print(f'Starting mock server on port {port}...')
    httpd.serve_forever()

if __name__ == '__main__':
    run()
