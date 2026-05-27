import argparse
import sys

from . import __version__
from .config import load_config, save_config, set_key, get
from .client import ApiClient
from .output import print_output


def get_client():
    config = load_config()
    return ApiClient(config.get('api_url', 'http://localhost:8080'), config.get('token'))


def cmd_login(args):
    result = get_client().login(args.api_key)
    if 'token' in result:
        set_key('token', result['token'])
        print_output({'status': 'Logged in successfully'}, args.output)
    else:
        print_output(result, args.output)


def cmd_logout(args):
    result = get_client().logout()
    set_key('token', None)
    print_output(result or {'status': 'Logged out'}, args.output)


def cmd_server_list(args):
    result = get_client().list_servers()
    data = result if isinstance(result, list) else result.get('servers', result)
    print_output(data, args.output)


def cmd_server_create(args):
    result = get_client().create_server(args.name, args.type, args.memory)
    print_output(result, args.output)


def cmd_server_delete(args):
    result = get_client().delete_server(args.server)
    print_output(result, args.output)


def cmd_server_status(args):
    result = get_client().server_status(args.server)
    print_output(result, args.output)


def cmd_logs(args):
    result = get_client().get_logs(args.server, args.lines, args.follow)
    print_output(result, args.output)


def cmd_backup_list(args):
    result = get_client().list_backups(args.server)
    data = result if isinstance(result, list) else result.get('backups', result)
    print_output(data, args.output)


def cmd_backup_create(args):
    result = get_client().create_backup(args.server)
    print_output(result, args.output)


def cmd_deploy(args):
    result = get_client().deploy(args.server, args.branch)
    print_output(result, args.output)


def cmd_config_get(args):
    config = load_config()
    if args.key:
        value = config.get(args.key)
        print_output({args.key: value}, args.output)
    else:
        print_output(config, args.output)


def cmd_config_set(args):
    set_key(args.key, args.value)
    print_output({args.key: args.value, 'status': 'set'}, args.output)


def build_parser():
    parser = argparse.ArgumentParser(
        prog='ipilot',
        description='Infra Pilot CLI - Infrastructure management tool',
    )
    parser.add_argument('--version', action='version', version=f'%(prog)s {__version__}')
    parser.add_argument('--output', '-o', choices=['json', 'table', 'yaml', 'plain'],
                        default=get('output_format', 'table'),
                        help='Output format (default: table)')

    sub = parser.add_subparsers(dest='command')

    p_login = sub.add_parser('login', help='Authenticate with the API')
    p_login.add_argument('api_key', help='API key')

    sub.add_parser('logout', help='Clear authentication token')

    p_server = sub.add_parser('server', help='Server management commands')
    p_server_sub = p_server.add_subparsers(dest='subcommand')

    p_server_list = p_server_sub.add_parser('list', help='List all servers')
    p_server_create = p_server_sub.add_parser('create', help='Create a new server')
    p_server_create.add_argument('name', help='Server name')
    p_server_create.add_argument('--type', '-t', required=True, help='Server type')
    p_server_create.add_argument('--memory', '-m', type=int, help='Memory in MB')
    p_server_delete = p_server_sub.add_parser('delete', help='Delete a server')
    p_server_delete.add_argument('server', help='Server ID or name')
    p_server_status = p_server_sub.add_parser('status', help='Get server status')
    p_server_status.add_argument('server', help='Server ID or name')

    p_logs = sub.add_parser('logs', help='Fetch server logs')
    p_logs.add_argument('server', help='Server ID or name')
    p_logs.add_argument('--lines', '-n', type=int, default=50, help='Number of lines')
    p_logs.add_argument('--follow', '-f', action='store_true', help='Follow log output')

    p_backup = sub.add_parser('backup', help='Backup management')
    p_backup_sub = p_backup.add_subparsers(dest='subcommand')
    p_backup_list = p_backup_sub.add_parser('list', help='List backups')
    p_backup_list.add_argument('server', nargs='?', help='Server ID (optional)')
    p_backup_create = p_backup_sub.add_parser('create', help='Create a backup')
    p_backup_create.add_argument('server', help='Server ID or name')

    p_deploy = sub.add_parser('deploy', help='Deploy a branch to a server')
    p_deploy.add_argument('server', help='Server ID or name')
    p_deploy.add_argument('branch', help='Branch to deploy')

    p_config = sub.add_parser('config', help='Configuration management')
    p_config_sub = p_config.add_subparsers(dest='subcommand')
    p_config_get = p_config_sub.add_parser('get', help='Get config value(s)')
    p_config_get.add_argument('key', nargs='?', help='Config key')
    p_config_set = p_config_sub.add_parser('set', help='Set a config value')
    p_config_set.add_argument('key', help='Config key')
    p_config_set.add_argument('value', help='Config value')

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    cmd_map = {
        'login': cmd_login,
        'logout': cmd_logout,
    }

    if args.command == 'server':
        sub_map = {
            'list': cmd_server_list,
            'create': cmd_server_create,
            'delete': cmd_server_delete,
            'status': cmd_server_status,
        }
        sub_map.get(args.subcommand, lambda a: parser.print_help())(args)
    elif args.command == 'logs':
        cmd_logs(args)
    elif args.command == 'backup':
        sub_map = {
            'list': cmd_backup_list,
            'create': cmd_backup_create,
        }
        sub_map.get(args.subcommand, lambda a: parser.print_help())(args)
    elif args.command == 'deploy':
        cmd_deploy(args)
    elif args.command == 'config':
        sub_map = {
            'get': cmd_config_get,
            'set': cmd_config_set,
        }
        sub_map.get(args.subcommand, lambda a: parser.print_help())(args)
    elif args.command in cmd_map:
        cmd_map[args.command](args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
