import json
import sys


def format_output(data, fmt='table'):
    formatters = {
        'json': format_json,
        'table': format_table,
        'yaml': format_yaml,
        'plain': format_plain,
    }
    formatter = formatters.get(fmt, format_table)
    return formatter(data)


def format_json(data):
    return json.dumps(data, indent=2, default=str)


def format_yaml(data):
    lines = []
    _to_yaml(data, lines, 0)
    return '\n'.join(lines)


def _to_yaml(obj, lines, indent):
    prefix = '  ' * indent
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, (dict, list)):
                lines.append(f'{prefix}{k}:')
                _to_yaml(v, lines, indent + 1)
            else:
                lines.append(f'{prefix}{k}: {_yaml_value(v)}')
    elif isinstance(obj, list):
        for item in obj:
            if isinstance(item, (dict, list)):
                lines.append(f'{prefix}-')
                _to_yaml(item, lines, indent + 1)
            else:
                lines.append(f'{prefix}- {_yaml_value(item)}')
    else:
        lines.append(f'{prefix}{_yaml_value(obj)}')


def _yaml_value(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, str):
        if any(c in v for c in ':{}[]&*!|>%`@#'):
            return f"'{v}'"
        return v
    return str(v)


def format_table(data):
    if isinstance(data, list):
        if not data:
            return '(no data)'
        if isinstance(data[0], dict):
            return _dict_table(data)
        return '\n'.join(str(item) for item in data)
    if isinstance(data, dict):
        if 'error' in data:
            return f'Error: {data["error"]}'
        if any(isinstance(v, list) for v in data.values()):
            for k, v in data.items():
                if isinstance(v, list) and v:
                    return _dict_table(v)
        return _key_value_table(data)
    return str(data)


def _dict_table(items):
    if not items:
        return '(no data)'
    keys = list(items[0].keys())
    col_widths = {k: len(k) for k in keys}
    for item in items:
        for k in keys:
            col_widths[k] = max(col_widths[k], len(str(item.get(k, ''))))

    header = ' | '.join(k.ljust(col_widths[k]) for k in keys)
    sep = '-+-'.join('-' * col_widths[k] for k in keys)
    rows = [header, sep]
    for item in items:
        rows.append(' | '.join(str(item.get(k, '')).ljust(col_widths[k]) for k in keys))
    return '\n'.join(rows)


def _key_value_table(data):
    if 'error' in data:
        return f'Error: {data["error"]}'
    max_key = max(len(k) for k in data)
    lines = []
    for k, v in data.items():
        lines.append(f'{k.ljust(max_key)} : {_yaml_value(v)}')
    return '\n'.join(lines)


def format_plain(data):
    if isinstance(data, list):
        return '\n'.join(str(item) for item in data)
    if isinstance(data, dict):
        if 'error' in data:
            return f'Error: {data["error"]}'
        return '\n'.join(f'{k}: {v}' for k, v in data.items())
    return str(data)


def print_output(data, fmt='table'):
    sys.stdout.write(format_output(data, fmt))
    sys.stdout.write('\n')
