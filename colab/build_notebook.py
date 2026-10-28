"""Builds colab/cod-talking-avatar.ipynb. Run: python3 colab/build_notebook.py"""
import json
import pathlib

HERE = pathlib.Path(__file__).parent


def md(text):
    return {"cell_type": "markdown", "metadata": {}, "source": text.strip("\n").splitlines(True)}


def code(text):
    return {"cell_type": "code", "metadata": {"cellView": "form"}, "execution_count": None,
            "outputs": [], "source": text.strip("\n").splitlines(True)}


INTRO = """
# 🎬 COD Pilot: شخصية كتهضر بالدارجة

**كيفاش تخدم (3 خطوات):**

0. **مرة وحدة فقط:** فاليسار كليكي على 🔑 (Secrets) ← **Add new secret** ← Name: `GEMINI_API_KEY` ← Value: المفتاح ديالك ← شعل **Notebook access**.
1. فالفوق: **Runtime ← Change runtime type ← T4 GPU ← Save**.
2. كليكي ▶️ على **الخطوة 1** وتسنى (5 حتى 8 دقايق). غادي تبان ليك 4 شخصيات.
3. عمر الخانات فـ **الخطوة 2** وكليكي ▶️. الفيديو كيخرج ويتحمل بوحدو.

> كل مرة تحل الصفحة من جديد خاصك تعاود الخطوة 1. الخطوة 2 عاودها شحال ما بغيتي.
"""

INSTALL = r'''
#@title ▶️ الخطوة 1: تثبيت البرنامج وصناعة الشخصيات (5-8 دقايق)
#@markdown بدل هاد الرقم إلا بغيتي وجوه جداد:
seed = 7  #@param {type:"integer"}
import os, subprocess, sys, glob
from IPython.display import display, HTML, clear_output

def run(cmd, what):
    print('⏳', what)
    p = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if p.returncode:
        print(p.stdout[-2000:], p.stderr[-3000:])
        raise SystemExit('❌ وقع مشكل فـ: ' + what + '. صور الشاشة وصيفطها.')

try:
    import torch
    gpu = torch.cuda.is_available()
except Exception:
    gpu = False
if not gpu:
    raise SystemExit('❌ ما كاينش GPU. دير: Runtime ← Change runtime type ← T4 GPU ← Save، ومن بعد عاود الخطوة 1.')

os.chdir('/content')
if not os.path.exists('/content/SadTalker/.ready'):
    run('pip install -q uv', 'كنوجدو الأدوات')
    run('uv python install 3.8 && uv venv -q --seed -p 3.8 /content/st38', 'كنوجدو Python 3.8')
    run('rm -rf SadTalker && git clone -q --depth 1 https://github.com/OpenTalker/SadTalker.git', 'كنجيبو SadTalker')
    PY = '/content/st38/bin/python'
    run(f'{PY} -m pip install -q numpy==1.23.5 torch==2.0.1 torchvision==0.15.2 torchaudio==2.0.2', 'كنثبتو torch (شي 3 دقايق)')
    run(f'{PY} -m pip install -q numpy==1.23.5 face_alignment==1.3.5 imageio==2.19.3 imageio-ffmpeg==0.4.7 '
        'librosa==0.9.2 numba resampy==0.3.1 pydub==0.25.1 scipy==1.10.1 kornia==0.6.8 tqdm yacs==0.1.8 pyyaml '
        'joblib==1.1.0 scikit-image==0.19.3 basicsr==1.4.2 facexlib==0.3.0 gfpgan av safetensors', 'كنثبتو الباقي')
    # basicsr 1.4.2 still imports a torchvision module that newer versions renamed.
    run("sed -i 's/torchvision.transforms.functional_tensor import/torchvision.transforms.functional import/' "
        "/content/st38/lib/python3.8/site-packages/basicsr/data/degradations.py || true", 'كنصلحو basicsr')
    rel = 'https://github.com/OpenTalker/SadTalker/releases/download/v0.0.2-rc/'
    files = {f'checkpoints/{n}': rel + n for n in ['mapping_00109-model.pth.tar', 'mapping_00229-model.pth.tar',
                                                  'SadTalker_V0.0.2_256.safetensors', 'SadTalker_V0.0.2_512.safetensors']}
    files.update({
        'gfpgan/weights/alignment_WFLW_4HG.pth': 'https://github.com/xinntao/facexlib/releases/download/v0.1.0/alignment_WFLW_4HG.pth',
        'gfpgan/weights/detection_Resnet50_Final.pth': 'https://github.com/xinntao/facexlib/releases/download/v0.1.0/detection_Resnet50_Final.pth',
        'gfpgan/weights/GFPGANv1.4.pth': 'https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth',
        'gfpgan/weights/parsing_parsenet.pth': 'https://github.com/xinntao/facexlib/releases/download/v0.2.2/parsing_parsenet.pth',
    })
    os.makedirs('SadTalker/checkpoints', exist_ok=True); os.makedirs('SadTalker/gfpgan/weights', exist_ok=True)
    run(' && '.join(f'wget -q -nc {u} -O SadTalker/{p}' for p, u in files.items()), 'كنجيبو الموديلات (شي دقيقة)')
    open('/content/SadTalker/.ready', 'w').close()

CHARACTERS = [
    ('سلمى', 'female', 'a friendly Moroccan woman around 30 wearing a soft beige hijab'),
    ('ياسمين', 'female', 'a young Moroccan woman around 25 with long dark wavy hair'),
    ('يوسف', 'male', 'a young Moroccan man around 28 with short black hair and a trimmed beard, casual t-shirt'),
    ('الحاج عمر', 'male', 'a trustworthy Moroccan man around 50 with short grey hair and a grey beard, simple shirt'),
]
os.makedirs('/content/characters', exist_ok=True)
if not os.path.exists(f'/content/characters/.seed{seed}'):
    run('pip install -q diffusers', 'كنوجدو صانع الصور')
    print('⏳ كنصاوبو الشخصيات...')
    from diffusers import AutoPipelineForText2Image
    pipe = AutoPipelineForText2Image.from_pretrained('stabilityai/sdxl-turbo', torch_dtype=torch.float16, variant='fp16').to('cuda')
    for i, (name, _, who) in enumerate(CHARACTERS, 1):
        prompt = (f'photorealistic head and shoulders portrait photo of {who}, looking straight at the camera, '
                  'face centered and fully visible, relaxed friendly expression, mouth closed, soft even studio light, '
                  'plain light background, sharp focus, natural skin texture')
        img = pipe(prompt=prompt, num_inference_steps=4, guidance_scale=0.0, width=512, height=512,
                   generator=torch.Generator('cuda').manual_seed(seed * 10 + i)).images[0]
        img.save(f'/content/characters/{i}.png')
    del pipe; torch.cuda.empty_cache()
    for f in glob.glob('/content/characters/.seed*'): os.remove(f)
    open(f'/content/characters/.seed{seed}', 'w').close()

clear_output()
import base64
cards = ''.join(
    f'<div style="text-align:center;margin:6px"><img src="data:image/png;base64,{base64.b64encode(open(f"/content/characters/{i}.png","rb").read()).decode()}" width="180" style="border-radius:12px"><br><b>{i}. {name}</b></div>'
    for i, (name, _, _) in enumerate(CHARACTERS, 1))
display(HTML(f'<div dir="rtl" style="display:flex;flex-wrap:wrap">{cards}</div>'))
print('✅ واجد! ختار الشخصية فالخطوة 2. (إلا ما عجبكش شي وجه: بدل الرقم seed وعاود الخطوة 1)')
'''

MAKE = r'''
#@title ▶️ الخطوة 2: صايب الفيديو
#@markdown **الشخصية** (شوف الصور اللي خرجو فالخطوة 1):
character = "1. سلمى"  #@param ["1. سلمى", "2. ياسمين", "3. يوسف", "4. الحاج عمر", "5. صورة ديالي (غادي نطلبها منك)"]
#@markdown **النص بالدارجة** (خليه خاوي باش Gemini يكتبو من سمية المنتج):
text = ""  #@param {type:"string"}
#@markdown **سمية المنتج والثمن** (كيتستعملو إلا كان النص خاوي):
product = "مثلا: سيروم الشعر، 199 درهم، التوصيل فابور"  #@param {type:"string"}
#@markdown **الصوت:**
voice = "تلقائي"  #@param ["تلقائي", "Kore (امرأة، قوية)", "Sulafat (امرأة، دافية)", "Leda (امرأة، شابة)", "Aoede (امرأة، خفيفة)", "Puck (راجل، فرحان)", "Orus (راجل، ثابت)", "Charon (راجل، كيشرح)", "Fenrir (راجل، متحمس)"]
style = "عادي"  #@param ["عادي", "حماسي (تيكتوك)", "هادئ ومقنع", "شهادة ديال كليان"]
add_product_photo = True  #@param {type:"boolean"}

import os, json, base64, wave, glob, shutil, subprocess, time, requests
from IPython.display import display, HTML, clear_output
from google.colab import files

if not os.path.exists('/content/SadTalker/.ready'):
    raise SystemExit('❌ دير الخطوة 1 هي الأولى.')

def key():
    try:
        from google.colab import userdata
        k = userdata.get('GEMINI_API_KEY')
        if k: return k.strip()
    except Exception:
        pass
    from getpass import getpass
    return getpass('حط المفتاح ديال Gemini هنا (ما غاديش يبان) ودير Enter: ').strip()
KEY = key()

def gemini(path, body):
    r = requests.post('https://generativelanguage.googleapis.com' + path, json=body,
                      headers={'x-goog-api-key': KEY}, timeout=180)
    if r.ok: return r.json()
    try: msg = r.json()['error']['message']
    except Exception: msg = r.text[:300]
    # Limits are per model, so a 429 lets the caller try the next model.
    if r.status_code == 429: raise RuntimeError('LIMIT')
    if 'API key' in msg or r.status_code in (401, 403): raise SystemExit('❌ المفتاح ديال Gemini غالط. شوف 🔑 Secrets.')
    raise RuntimeError(msg)

STYLES = {'عادي': 'Warm, clear, conversational advertising delivery, moderate pace.',
          'حماسي (تيكتوك)': 'Energetic, excited, fast-paced advertising delivery, like a TikTok ad.',
          'هادئ ومقنع': 'Calm, soft, trustworthy tone, like a friend giving advice.',
          'شهادة ديال كليان': 'Like a real customer giving an honest testimonial, casual and spontaneous.'}

LIMIT_MSG = '❌ وصلتي للحد ديال اليوم فـ Gemini الفابور. عاود من بعد.'

def write_script():
    prompt = ('Write a short Moroccan Darija (Arabic script) video ad script, spoken by one person to the camera, '
              'for this product: ' + product + '. 60 to 90 words, natural UGC tone, hook first, end with a call to '
              'order with cash on delivery. Return only the spoken text, no titles, no emojis, no stage directions.')
    last = None
    for m in ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']:
        try:
            d = gemini(f'/v1beta/models/{m}:generateContent', {'contents': [{'parts': [{'text': prompt}]}]})
            parts = (d.get('candidates') or [{}])[0].get('content', {}).get('parts', [])
            out = ''.join(p.get('text', '') for p in parts).strip()
            if out: return out
        except RuntimeError as e:
            last = e
    if str(last) == 'LIMIT': raise SystemExit(LIMIT_MSG)
    raise SystemExit(f'❌ Gemini ما قدرش يكتب النص: {last}')

def to_wav(b64, mime, out):
    raw = base64.b64decode(b64)
    if raw[:4] == b'RIFF':
        open(out, 'wb').write(raw); return
    rate = 24000
    if 'rate=' in (mime or ''): rate = int(mime.split('rate=')[1].split(';')[0])
    with wave.open(out, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(raw)

def speak(txt, voice_name, out):
    last = None
    delivery = 'Speak in natural Moroccan Darija, with authentic Moroccan pronunciation. ' + STYLES[style]
    try:
        d = gemini('/v1beta/interactions', {
            'model': 'gemini-3.8-flash-lite-tts',
            'input': [{'type': 'user_input', 'content': [{'type': 'text', 'text': txt, 'annotations': [
                {'type': 'speech_metadata', 'style': delivery + ' Read the transcript exactly; do not add words.'}]}]}],
            'response_format': {'type': 'audio'},
            'generation_config': {'speech_config': [{'voice': voice_name}]}})
        for s in d.get('steps', []):
            if s.get('type') == 'model_output':
                for p in s.get('content', []):
                    if p.get('type') == 'audio' and p.get('data'):
                        return to_wav(p['data'], p.get('mime_type'), out)
    except RuntimeError as e:
        last = e
    for m in ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts']:
        try:
            d = gemini(f'/v1beta/models/{m}:generateContent', {
                'contents': [{'parts': [{'text': delivery + ' Read exactly this text:\n' + txt}]}],
                'generationConfig': {'responseModalities': ['AUDIO'], 'speechConfig': {
                    'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice_name}}}}})
            for p in (d.get('candidates') or [{}])[0].get('content', {}).get('parts', []):
                if 'inlineData' in p:
                    return to_wav(p['inlineData']['data'], p['inlineData'].get('mimeType'), out)
        except RuntimeError as e:
            last = e
    if str(last) == 'LIMIT': raise SystemExit(LIMIT_MSG)
    raise SystemExit('❌ Gemini ما رجعش الصوت. عاود من بعد شوية.')

def ask_photo(msg, tag):
    print(msg)
    up = files.upload()
    if not up: raise SystemExit('❌ ما تحطات حتى صورة.')
    paths = []
    for name in up:
        path = f'/content/upload_{tag}_' + name.replace(' ', '_')
        shutil.move(name, path)
        paths.append(path)
    return paths

work = f'/content/work/{int(time.time())}'
os.makedirs(work, exist_ok=True)
num = int(character.split('.')[0])
if num == 5:
    face = ask_photo('📷 حط صورة الشخصية (وجه واضح، كيشوف للكاميرا):', 'face')[0]
else:
    face = f'/content/characters/{num}.png'
voice_name = voice.split(' ')[0] if voice != 'تلقائي' else {1: 'Sulafat', 2: 'Leda', 3: 'Puck', 4: 'Orus', 5: 'Kore'}[num]
photos = ask_photo('🛍️ حط صورة المنتج (تقدر تختار بزاف ديال الصور):', 'product') if add_product_photo else []

script = text.strip() or write_script()
if len(script) > 1500:
    raise SystemExit(f'❌ النص طويل بزاف ({len(script)} حرف). خليه تحت 1500 حرف (شي دقيقة ديال الكلام).')
print('📝 النص:\n' + script + '\n')
print('⏳ كنصاوبو الصوت...')
speak(script, voice_name, f'{work}/voice.wav')

print('⏳ كنخليو الشخصية تهضر (هادي كتاخد شي 2 حتى 6 دقايق)...')
p = subprocess.run(['/content/st38/bin/python', 'inference.py', '--driven_audio', f'{work}/voice.wav',
                    '--source_image', face, '--result_dir', f'{work}/st', '--size', '256', '--still',
                    '--preprocess', 'full', '--enhancer', 'gfpgan'], cwd='/content/SadTalker',
                   capture_output=True, text=True)
vids = sorted(glob.glob(f'{work}/st/*.mp4'))
if p.returncode or not vids:
    print(p.stdout[-2000:], p.stderr[-3000:])
    raise SystemExit('❌ الشخصية ما قدراتش تهضر. إلا كانت صورة ديالك، جرب صورة فيها الوجه واضح وقريب.')

print('⏳ كنركبو الفيديو 9:16...')
out = f'/content/video_{os.path.basename(work)}.mp4'
bg = '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:5,eq=brightness=-0.08[bg];[0:v]scale=1080:1080:force_original_aspect_ratio=decrease[fg];'
if photos:
    # Each product photo takes an equal slice of the voice, one after another.
    with wave.open(f'{work}/voice.wav') as w:
        seg = w.getnframes() / w.getframerate() / len(photos)
    inputs = ['-i', vids[-1], '-i', f'{work}/voice.wav']
    graph = bg + '[bg][fg]overlay=(W-w)/2:160[t0];'
    for i, ph in enumerate(photos):
        inputs += ['-loop', '1', '-i', ph]
        end = 'inf' if i == len(photos) - 1 else f'{(i + 1) * seg:.3f}'
        graph += (f'[{i + 2}:v]scale=960:640:force_original_aspect_ratio=decrease[p{i}];'
                  f"[t{i}][p{i}]overlay=(W-w)/2:1260:shortest=1:enable='between(t,{i * seg:.3f},{end})'[t{i + 1}];")
    graph += f'[t{len(photos)}]fps=25,format=yuv420p[v]'
else:
    inputs = ['-i', vids[-1], '-i', f'{work}/voice.wav']
    graph = bg + '[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=25,format=yuv420p[v]'
p = subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', *inputs, '-filter_complex', graph,
                    '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast',
                    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out],
                   capture_output=True, text=True)
if p.returncode:
    print(p.stderr[-2000:])
    raise SystemExit('❌ وقع مشكل فالتركيب ديال الفيديو.')

clear_output()
print('📝 النص:\n' + script + '\n')
b64 = base64.b64encode(open(out, 'rb').read()).decode()
display(HTML(f'<video src="data:video/mp4;base64,{b64}" controls width="300"></video>'))
print('✅ الفيديو واجد! غادي يتحمل دابا لـ Downloads.')
files.download(out)
'''

nb = {
    "nbformat": 4, "nbformat_minor": 0,
    "metadata": {"colab": {"provenance": [], "gpuType": "T4"}, "accelerator": "GPU",
                 "kernelspec": {"name": "python3", "display_name": "Python 3"},
                 "language_info": {"name": "python"}},
    "cells": [md(INTRO), code(INSTALL), code(MAKE)],
}
(HERE / 'cod-talking-avatar.ipynb').write_text(json.dumps(nb, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print('wrote', HERE / 'cod-talking-avatar.ipynb')
