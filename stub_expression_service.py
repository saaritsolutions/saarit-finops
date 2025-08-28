#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from urllib.parse import urlparse, parse_qs

class Handler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.lower() == '/api/expressions':
            resp = {
                "expressions": [
                    {"expressionId": "EXPR_CREDIT_CHECK", "expression": "creditScore >= 700 && monthlyIncome >= 15000 ? 'APPROVED' : (creditScore >= 650 ? 'MANUAL_REVIEW' : 'REJECTED')"}
                ],
                "pagination": {}
            }
            self._set_headers(200)
            self.wfile.write(json.dumps(resp).encode('utf-8'))
            return
        self._set_headers(404)
        self.wfile.write(json.dumps({"error": "not found"}).encode('utf-8'))

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path.lower() in ['/api/expressions/execute', '/api/expressions/execute', '/api/expressions/execute'] or parsed.path.lower().endswith('/execute'):
            length = int(self.headers.get('content-length', 0))
            body = self.rfile.read(length).decode('utf-8')
            try:
                payload = json.loads(body)
            except Exception:
                payload = {}
            vars = payload.get('Variables') or payload.get('variables') or {}
            # Accept both direct keys and customer.* keys
            creditScore = 0
            monthlyIncome = 0
            if isinstance(vars, dict):
                creditScore = int(vars.get('creditScore') or vars.get('customer.creditScore') or vars.get('customer', {}).get('creditScore') or 0)
                monthlyIncome = float(vars.get('monthlyIncome') or vars.get('customer.monthlyIncome') or vars.get('customer', {}).get('monthlyIncome') or 0)
            outcome = 'REJECTED'
            if creditScore >= 700 and monthlyIncome >= 15000:
                outcome = 'APPROVED'
            elif creditScore >= 650:
                outcome = 'MANUAL_REVIEW'
            resp = {
                "success": True,
                "result": outcome,
                "resultType": "string",
                "executionTimeMs": 3,
                "errorMessage": None,
                "executedAt": None
            }
            self._set_headers(200)
            self.wfile.write(json.dumps(resp).encode('utf-8'))
            return
        self._set_headers(404)
        self.wfile.write(json.dumps({"error": "not found"}).encode('utf-8'))

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 5004), Handler)
    print('Stub ExpressionBuilderService listening on http://0.0.0.0:5004')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('Shutting down')
        server.server_close()
