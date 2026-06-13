#!/usr/bin/env python3
"""
m8 cover image generator

调用 0.88 上的 sd-server (z-image-turbo) 生成 1024x1024 PNG，
上传到 m8 CMS asset，可选 PUT post 设置 coverImage。

用法：
    # 仅生成 + 上传，返回 publicUrl
    python3 m8_image_gen.py --slug huahong-flash --prompt "..."

    # 生成 + 上传 + 更新 post coverImage
    python3 m8_image_gen.py --slug huahong-flash --prompt "..." --update-post

    # 自检（生成一张 + 上传 + 删 + 报告）
    python3 m8_image_gen.py --selftest
"""
import argparse
import base64
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

BJ = timezone(timedelta(hours=8))
SCRIPT_DIR = Path(__file__).resolve().parent
SITE_DIR = SCRIPT_DIR.parent
ENV_PATH = SITE_DIR / '.env'

ENV = {}
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            ENV[k.strip()] = v.strip()

ZIMAGE_BASE = ENV.get('ZIMAGE_BASE', 'http://192.168.0.88:8081')
DEFAULT_SIZE = ENV.get('ZIMAGE_DEFAULT_SIZE', '1024x1024')
DEFAULT_STEPS = int(ENV.get('ZIMAGE_DEFAULT_STEPS', '8'))
CF_TOKEN = ENV.get('CF_CMS_TOKEN', '')
CMS_BASE = (
    ENV.get('M8_CMS_BASE_URL')
    or ENV.get('CF_CMS_URL')
    or 'https://cloudflare-sites-cms.pages.dev'
).rstrip('/')
SITE_ID = 'm8.com.cn'

# 智谱 CogView（云端，带"AI生成"水印，质量高于 Z-Image）
ZHIPU_TOKEN = ENV.get('ZHIPU_API_TOKEN', '')
ZHIPU_BASE = ENV.get('ZHIPU_API_BASE', 'https://open.bigmodel.cn/api/paas/v4')
COGVIEW_MODEL = ENV.get('COGVIEW_DEFAULT_MODEL', 'cogview-3-plus')


def now_bj():
    return datetime.now(BJ)


NEGATIVE_PROMPT = (
    "text, words, letters, characters, chinese characters, japanese, korean, "
    "numbers, watermark, logo, brand name, signature, caption, subtitle, "
    "blurry, low quality, distorted, ugly, deformed, cropped"
)


def gen_image_zimage(prompt, size=DEFAULT_SIZE, steps=DEFAULT_STEPS, seed=None,
                     negative_prompt=NEGATIVE_PROMPT, timeout=180):
    """调用 0.88 sd-server (Z-Image Turbo)，返回 PNG bytes。本地、无水印、~64s。"""
    body = {
        'prompt': prompt,
        'model': 'sd-cpp-local',
        'n': 1,
        'size': size,
        'response_format': 'b64_json',
        'steps': steps,
        'negative_prompt': negative_prompt,
    }
    if seed is not None:
        body['seed'] = seed
    req = urllib.request.Request(
        f'{ZIMAGE_BASE}/v1/images/generations',
        data=json.dumps(body).encode(),
        headers={'Content-Type': 'application/json'},
    )
    resp = urllib.request.urlopen(req, timeout=timeout).read()
    d = json.loads(resp)
    if 'data' not in d or not d['data']:
        raise RuntimeError(f'no image in response: {d}')
    b64 = d['data'][0].get('b64_json')
    if not b64:
        raise RuntimeError(f'no b64_json: {d}')
    return base64.b64decode(b64)


def gen_image_cogview(prompt, size=DEFAULT_SIZE, model=None, timeout=120):
    """调用智谱 CogView，返回 JPEG bytes（注意：右下角带 'AI生成' 水印）。"""
    if not ZHIPU_TOKEN:
        raise RuntimeError('ZHIPU_API_TOKEN missing in .env')
    body = {
        'model': model or COGVIEW_MODEL,
        'prompt': prompt,
        'size': size,
    }
    req = urllib.request.Request(
        f'{ZHIPU_BASE}/images/generations',
        data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {ZHIPU_TOKEN}',
            'Content-Type': 'application/json',
        },
    )
    resp = urllib.request.urlopen(req, timeout=timeout).read()
    d = json.loads(resp)
    if 'data' not in d or not d['data']:
        raise RuntimeError(f'no image in cogview response: {d}')
    img_url = d['data'][0].get('url')
    if not img_url:
        raise RuntimeError(f'no url in cogview response: {d}')
    # 智谱图床偶发慢，重试 3 次
    last_err = None
    for attempt in range(3):
        try:
            return urllib.request.urlopen(img_url, timeout=180).read()
        except Exception as e:
            last_err = e
    raise RuntimeError(f'cogview image download failed after 3 retries: {last_err}')


def gen_image(prompt, size=DEFAULT_SIZE, steps=DEFAULT_STEPS, seed=None,
              negative_prompt=NEGATIVE_PROMPT, timeout=180, backend='zimage'):
    """统一入口。backend ∈ {'zimage', 'cogview'}。返回图片 bytes（PNG 或 JPEG）。"""
    if backend == 'cogview':
        return gen_image_cogview(prompt, size=size, timeout=timeout)
    return gen_image_zimage(prompt, size=size, steps=steps, seed=seed,
                            negative_prompt=negative_prompt, timeout=timeout)


def upload_asset(png_bytes, filename):
    """multipart 上传到 CMS，返回 (publicUrl, fullUrl)。"""
    mime = 'image/jpeg' if filename.lower().endswith(('.jpg', '.jpeg')) else 'image/png'
    boundary = '----m8imgupload' + str(int(now_bj().timestamp()))
    body = b''
    body += f'--{boundary}\r\n'.encode()
    body += f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode()
    body += f'Content-Type: {mime}\r\n\r\n'.encode()
    body += png_bytes
    body += f'\r\n--{boundary}--\r\n'.encode()

    req = urllib.request.Request(
        f'{CMS_BASE}/api/assets?siteId={urllib.parse.quote(SITE_ID)}',
        data=body,
        headers={
            'Authorization': f'Bearer {CF_TOKEN}',
            'Content-Type': f'multipart/form-data; boundary={boundary}',
            'User-Agent': 'm8-imagegen/1.0',
        },
    )
    resp = urllib.request.urlopen(req, timeout=30).read()
    d = json.loads(resp)
    if not d.get('success'):
        raise RuntimeError(f'upload failed: {d}')
    public = d.get('publicUrl')
    full = f'https://m8.com.cn{public}' if public and public.startswith('/') else public
    return public, full


def update_post_cover(slug, full_cover_url):
    """PUT post 的 coverImage（CMS 不支持 PATCH，PUT 是部分更新）。"""
    payload = {'coverImage': full_cover_url}
    req = urllib.request.Request(
        f'{CMS_BASE}/api/posts/{slug}?siteId={urllib.parse.quote(SITE_ID)}',
        data=json.dumps(payload).encode(),
        headers={
            'Authorization': f'Bearer {CF_TOKEN}',
            'Content-Type': 'application/json',
            'User-Agent': 'm8-imagegen/1.0',
        },
        method='PUT',
    )
    resp = urllib.request.urlopen(req, timeout=15).read()
    return json.loads(resp)


COVER_STYLE_PRESET = (
    "abstract editorial illustration in english only, financial news magazine cover, "
    "minimalist geometric design, deep navy blue background with gold accents, "
    "no people, no text, no chinese, no characters, no letters, no numbers, "
    "clean negative space, sharp focus, soft cinematic lighting, 4k"
)

GEMMA_HOST = '192.168.0.88'
GEMMA_SSH_USER = 'macstudio'
GEMMA_SSH_PASSWORD = '918kangbing'
GEMMA_MODEL = 'gemma4:31b'


def build_cover_prompt(topic):
    """从 article topic 构造 cover 提示词。topic 应该已经是英文描述。"""
    return f'{topic}, {COVER_STYLE_PRESET}'


def enhance_with_gemma(topic, timeout=120):
    """通过 0.88 ollama 上的 gemma4 把 topic 增强成专业 SD prompt。"""
    import subprocess
    sys_prompt = (
        "You are an expert AI art prompt engineer. Convert the topic below into a "
        "high-quality English image generation prompt for stable diffusion. "
        "Output ONLY the prompt, no explanation. "
        "Required style: abstract conceptual art, navy blue and gold palette, "
        "hexagonal patterns, glowing circuits, cinematic lighting, "
        "macro photography composition, isometric perspective. "
        "CRITICAL: Do NOT use any word that diffusion models tend to render as visible text — "
        "avoid words like 'professional', 'editorial', 'magazine', 'cover', 'title', 'banner', 'poster'. "
        "End the prompt with this exact phrase: "
        "'no text anywhere in the image, no words, no letters, no characters, no numbers, no logos, no signatures'. "
        "Keep the prompt under 80 words."
    )
    full_prompt = f'{sys_prompt}\n\nTopic: {topic}'
    body = json.dumps({
        'model': GEMMA_MODEL,
        'prompt': full_prompt,
        'stream': False,
    }, ensure_ascii=False).replace("'", "'\\''")
    remote_cmd = (
        f"curl -sS --max-time {timeout} -X POST http://127.0.0.1:11434/api/generate "
        f"-H 'Content-Type: application/json' "
        f"-d '{body}'"
    )
    cmd = [
        'sshpass', '-p', GEMMA_SSH_PASSWORD,
        'ssh', '-o', 'StrictHostKeyChecking=no',
        '-o', 'ConnectTimeout=10',
        f'{GEMMA_SSH_USER}@{GEMMA_HOST}',
        remote_cmd,
    ]
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 30)
    if p.returncode != 0:
        raise RuntimeError(f'gemma ssh failed: {p.stderr[:200]}')
    try:
        d = json.loads(p.stdout)
        return d.get('response', '').strip()
    except Exception as e:
        raise RuntimeError(f'gemma response parse failed: {e}, raw: {p.stdout[:200]}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--prompt', help='直接 prompt（不附加 style preset）')
    ap.add_argument('--topic', help='文章主题（自动附加 cover style preset）')
    ap.add_argument('--slug', help='文章 slug，用于命名上传文件 + 可选 update post')
    ap.add_argument('--size', default=DEFAULT_SIZE)
    ap.add_argument('--steps', type=int, default=DEFAULT_STEPS)
    ap.add_argument('--seed', type=int, default=None)
    ap.add_argument('--update-post', action='store_true', help='生成后 PATCH post.coverImage')
    ap.add_argument('--enhance', action='store_true', help='先用 0.88 上 gemma4 把 topic 增强成专业 prompt')
    ap.add_argument('--backend', choices=['zimage', 'cogview'], default='zimage',
                    help='zimage=本地 sd-server 无水印 ~64s; cogview=智谱云端 高质量 ~10s 带"AI生成"水印')
    ap.add_argument('--selftest', action='store_true')
    ap.add_argument('--save-local', help='保存 PNG 到指定路径（debug 用）')
    args = ap.parse_args()

    if args.selftest:
        topic = 'futuristic chip on dark blue circuit board'
        slug = 'selftest-' + now_bj().strftime('%Y%m%d-%H%M%S')
        args.topic = topic
        args.slug = slug

    if not args.prompt and not args.topic:
        ap.error('--prompt 或 --topic 至少给一个')
    if not args.slug:
        ap.error('--slug 必填')

    if args.enhance and args.topic:
        print(f'[gen] enhancing topic via gemma4 on 0.88...', flush=True)
        try:
            enhanced = enhance_with_gemma(args.topic)
            print(f'[gen] gemma enhanced: {enhanced[:200]}...', flush=True)
            prompt = enhanced
        except Exception as e:
            print(f'[gen] gemma failed, fallback to manual prompt: {e}', flush=True)
            prompt = args.prompt or build_cover_prompt(args.topic)
    else:
        prompt = args.prompt or build_cover_prompt(args.topic)

    print(f'[gen] slug={args.slug} backend={args.backend}', flush=True)
    print(f'[gen] prompt={prompt[:120]}...', flush=True)

    t0 = now_bj().timestamp()
    png = gen_image(prompt, size=args.size, steps=args.steps, seed=args.seed,
                    backend=args.backend)
    t_gen = now_bj().timestamp() - t0
    print(f'[gen] image {len(png)} bytes in {t_gen:.1f}s ({args.backend})', flush=True)

    if args.save_local:
        Path(args.save_local).write_bytes(png)
        print(f'[gen] saved local: {args.save_local}', flush=True)

    # cogview 返回 JPEG，zimage 返回 PNG；按 backend 命名
    ext = 'jpg' if args.backend == 'cogview' else 'png'
    filename = f'{args.slug}-cover.{ext}'
    public, full = upload_asset(png, filename)
    print(f'[gen] uploaded publicUrl={public}', flush=True)
    print(f'[gen] uploaded fullUrl={full}', flush=True)

    if args.update_post:
        try:
            r = update_post_cover(args.slug, full)
            print(f'[gen] post PATCH ok: {r}', flush=True)
        except Exception as e:
            print(f'[gen] post PATCH failed: {e}', flush=True)
            sys.exit(2)

    print(json.dumps({
        'slug': args.slug,
        'publicUrl': public,
        'fullUrl': full,
        'gen_seconds': round(t_gen, 1),
        'png_bytes': len(png),
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
