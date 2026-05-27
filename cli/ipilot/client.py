import json
import urllib.request
import urllib.error


class ApiClient:

    def __init__(self, base_url, token=None):
        self.base_url = base_url.rstrip('/')
        self.token = token

    def _headers(self):
        headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        return headers

    def _request(self, method, path, data=None):
        url = f'{self.base_url}/api/v1{path}'
        body = json.dumps(data).encode('utf-8') if data else None
        req = urllib.request.Request(url, data=body, headers=self._headers(), method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8') if e.fp else str(e)
            try:
                return {'error': json.loads(msg).get('message', msg)}
            except json.JSONDecodeError:
                return {'error': msg}
        except urllib.error.URLError as e:
            return {'error': f'Connection failed: {e.reason}'}

    def login(self, api_key):
        return self._request('POST', '/auth/login', {'api_key': api_key})

    def logout(self):
        return self._request('POST', '/auth/logout')

    def list_servers(self):
        return self._request('GET', '/servers')

    def get_server(self, server_id):
        return self._request('GET', f'/servers/{server_id}')

    def create_server(self, name, server_type, memory=None):
        return self._request('POST', '/servers', {
            'name': name,
            'type': server_type,
            'memory': memory,
        })

    def delete_server(self, server_id):
        return self._request('DELETE', f'/servers/{server_id}')

    def server_status(self, server_id):
        return self._request('GET', f'/servers/{server_id}/status')

    def get_logs(self, server_id, lines=50, follow=False):
        params = f'?lines={lines}&follow={"true" if follow else "false"}'
        return self._request('GET', f'/servers/{server_id}/logs{params}')

    def list_backups(self, server_id=None):
        path = f'/servers/{server_id}/backups' if server_id else '/backups'
        return self._request('GET', path)

    def create_backup(self, server_id):
        return self._request('POST', f'/servers/{server_id}/backups')

    def deploy(self, server_id, branch):
        return self._request('POST', f'/servers/{server_id}/deploy', {'branch': branch})
