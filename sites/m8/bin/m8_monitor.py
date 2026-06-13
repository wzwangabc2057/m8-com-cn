#!/usr/bin/env python3
"""
m8 news bot 监控脚本

每 30min 跑一次（系统 cron，不依赖 Claude Code）。检查：
- state.last_run 在工作时段内不应陈旧
- 8086 / CMS 可达
- errors 暴涨
异常 → telegram 通知

用法：
    python3 m8_monitor.py [--quiet] [--test-alert]

--quiet      OK 时不输出（cron 推荐）
--test-alert 强制发一条测试通知，不检查
"""
import json
import os
import ssl
import sys
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import datetime, timezone, timedelta

BJ = timezone(timedelta(hours=8))
SCRIPT_DIR = Path(__file__).resolve().parent
SITE_DIR = SCRIPT_DIR.parent
ENV_PATH = SITE_DIR / '.env'
STATE_PATH = SCRIPT_DIR / 'news_bot_state.json'
LOG_PATH = SCRIPT_DIR / 'news_bot.log'
MONITOR_LOG = SCRIPT_DIR / 'monitor.log'
ALERT_STATE = SCRIPT_DIR / 'monitor_alert_state.json'

ENV = {}
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            ENV[k.strip()] = v.strip()


def parse_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}

TG_TOKEN = ENV.get('TELEGRAM_BOT_TOKEN', '')
TG_CHAT = ENV.get('TELEGRAM_CHAT_ID', '')
API_8086_TOKEN = ENV.get('API_8086_TOKEN', '')
API_8086_BASE = ENV.get('API_8086_BASE', 'http://156.254.5.245:8086')
CF_TOKEN = ENV.get('CF_CMS_TOKEN', '')
CMS_BASE = (
    ENV.get('M8_CMS_BASE_URL')
    or ENV.get('CF_CMS_URL')
    or 'https://cloudflare-sites-cms.pages.dev'
).rstrip('/')
REQUIRE_8086 = parse_bool(ENV.get('M8_REQUIRE_8086'), default=False)

try:
    import certifi
except ImportError:  # pragma: no cover - optional dependency
    certifi = None

STALE_FLASH_MIN = 90
STALE_DIGEST_HOURS = 14
ALERT_DEDUP_MIN = 60


def build_ssl_context():
    cafile = ENV.get('SSL_CERT_FILE') or os.environ.get('SSL_CERT_FILE')
    if cafile:
        return ssl.create_default_context(cafile=cafile)
    if certifi is not None:
        return ssl.create_default_context(cafile=certifi.where())
    return ssl.create_default_context()


SSL_CONTEXT = build_ssl_context()


def urlopen(req, timeout=10):
    return urllib.request.urlopen(req, timeout=timeout, context=SSL_CONTEXT)


def now_bj():
    return datetime.now(BJ)


def is_work_hour(t):
    return t.weekday() < 5 and 9 <= t.hour <= 15


def is_after_digest(t):
    return t.weekday() < 5 and t.hour >= 18


def telegram(text):
    if not TG_TOKEN or not TG_CHAT:
        return False, 'no telegram creds'
    try:
        data = urllib.parse.urlencode({
            'chat_id': TG_CHAT,
            'text': text,
            'parse_mode': 'HTML',
        }).encode()
        req = urllib.request.Request(
            f'https://api.telegram.org/bot{TG_TOKEN}/sendMessage',
            data=data,
        )
        urlopen(req, timeout=10).read()
        return True, 'sent'
    except Exception as e:
        return False, str(e)


def check_8086():
    try:
        req = urllib.request.Request(
            f'{API_8086_BASE}/api/v1/queryXgbNews',
            data=b'{"limit":1}',
            headers={'x-custom-token': API_8086_TOKEN, 'Content-Type': 'application/json'},
        )
        body = urlopen(req, timeout=10).read()
        d = json.loads(body)
        if d.get('code') == 0:
            return True, None
        return False, f'8086 returned code={d.get("code")} msg={d.get("message")}'
    except Exception as e:
        return False, f'8086 unreachable: {e}'


def check_cms():
    try:
        req = urllib.request.Request(
            f'{CMS_BASE}/api/posts?siteId=m8.com.cn&pageSize=1',
            headers={
                'Authorization': f'Bearer {CF_TOKEN}',
                'User-Agent': 'm8-monitor/1.0',
            },
        )
        urlopen(req, timeout=10).read()
        return True, None
    except Exception as e:
        return False, f'CMS unreachable: {e}'


def check_state():
    problems = []
    if not STATE_PATH.exists():
        problems.append(f'state file missing: {STATE_PATH}')
        return None, problems
    try:
        state = json.loads(STATE_PATH.read_text())
    except Exception as e:
        problems.append(f'state file unparseable: {e}')
        return None, problems

    last_run_str = state.get('last_run')
    now = now_bj()

    if last_run_str:
        try:
            last = datetime.fromisoformat(last_run_str.replace('Z', '+00:00'))
            last_bj = last.astimezone(BJ)
            delta_min = (now - last_bj).total_seconds() / 60
            if is_work_hour(now) and delta_min > STALE_FLASH_MIN:
                problems.append(
                    f'flash 任务陈旧：last_run={last_bj.strftime("%m-%d %H:%M")} BJ '
                    f'(已 {delta_min:.0f} min 未跑，工作时段应 ≤ {STALE_FLASH_MIN}min)'
                )
        except Exception as e:
            problems.append(f'last_run 解析失败: {last_run_str} → {e}')

    stats = state.get('stats', {})
    errors = stats.get('errors', 0)
    if errors >= 5:
        problems.append(f'errors={errors}（≥5 累计错误，请查 log）')

    return state, problems


def should_alert(key):
    """避免同一问题 1 小时内重复推。"""
    now = now_bj().timestamp()
    history = {}
    if ALERT_STATE.exists():
        try:
            history = json.loads(ALERT_STATE.read_text())
        except Exception:
            history = {}
    last = history.get(key, 0)
    if now - last < ALERT_DEDUP_MIN * 60:
        return False
    history[key] = now
    ALERT_STATE.write_text(json.dumps(history))
    return True


def log_line(line):
    try:
        with open(MONITOR_LOG, 'a') as f:
            f.write(f'[{now_bj().strftime("%Y-%m-%d %H:%M:%S")}] {line}\n')
    except Exception:
        pass


def main():
    args = sys.argv[1:]
    quiet = '--quiet' in args
    test_alert = '--test-alert' in args

    if test_alert:
        ok, info = telegram(
            f'<b>m8 monitor 测试</b>\n时间：{now_bj().strftime("%Y-%m-%d %H:%M BJ")}\n'
            f'如果你看到这条，monitor + telegram 通道工作正常。'
        )
        print(f'telegram test: ok={ok} info={info}')
        sys.exit(0 if ok else 1)

    problems = []
    warnings = []

    state, p = check_state()
    problems.extend(('state', x) for x in p)

    ok, msg = check_8086()
    if not ok:
        if REQUIRE_8086:
            problems.append(('8086', msg))
        else:
            warnings.append(('8086', msg))
            log_line(f'WARN [8086-optional] {msg}')

    ok, msg = check_cms()
    if not ok:
        problems.append(('cms', msg))

    if not problems:
        if warnings:
            warning_text = '; '.join(item[1] for item in warnings)
            if not quiet:
                print(f'WARN at {now_bj().strftime("%H:%M")} BJ: {warning_text}')
            log_line(f'OK_WITH_WARNINGS {warning_text}')
        else:
            if not quiet:
                print(f'OK at {now_bj().strftime("%H:%M")} BJ')
            log_line('OK')
        sys.exit(0)

    bullets = '\n'.join(f'• {p[1]}' for p in problems)
    text = (
        f'<b>m8 news bot 异常</b>\n'
        f'时间：{now_bj().strftime("%Y-%m-%d %H:%M BJ")}\n\n{bullets}'
    )

    alert_key = '|'.join(p[0] for p in problems)
    if should_alert(alert_key):
        sent, info = telegram(text)
        log_line(f'ALERT [{alert_key}] sent={sent} info={info}')
        print(f'alert sent={sent} info={info}\n{text}')
    else:
        log_line(f'alert suppressed (dedup): [{alert_key}]')
        print(f'alert suppressed (within {ALERT_DEDUP_MIN}min dedup)\n{text}')

    sys.exit(1)


if __name__ == '__main__':
    main()
