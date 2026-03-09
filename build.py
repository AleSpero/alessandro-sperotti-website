#!/usr/bin/env python3
"""Build localized HTML pages from template.html + i18n/*.json."""

import json
import os
import re

SITE_URL = "https://alessandrosperotti.com"

LANGUAGES = {
    "en": {"lang_attr": "en",      "output": "index.html",    "base_path": ""},
    "it": {"lang_attr": "it",      "output": "it/index.html", "base_path": "../"},
    "zh": {"lang_attr": "zh-Hans", "output": "zh/index.html", "base_path": "../"},
}

LANG_LABELS = {"en": "EN", "it": "IT", "zh": "中文"}

ROOT = os.path.dirname(os.path.abspath(__file__))


def build_hreflang_tags():
    tags = []
    for code, cfg in LANGUAGES.items():
        href = f'{SITE_URL}/' if code == "en" else f'{SITE_URL}/{code}/'
        tags.append(f'<link rel="alternate" hreflang="{cfg["lang_attr"]}" href="{href}" />')
    tags.append(f'<link rel="alternate" hreflang="x-default" href="{SITE_URL}/" />')
    return "\n        ".join(tags)


def build_lang_switcher(current_code):
    current_label = LANG_LABELS[current_code]
    options = []
    for code, label in LANG_LABELS.items():
        if code == current_code:
            continue
        base = LANGUAGES[current_code]["base_path"]
        if code == "en":
            href = f"{base}index.html"
        else:
            href = f"{base}{code}/index.html"
        options.append(f'<a href="{href}">{label}</a>')
    return (
        f'<div class="lang-switcher">'
        f'<button class="lang-current"><i class="fas fa-globe"></i> {current_label} <i class="fas fa-chevron-down lang-arrow"></i></button>'
        f'<div class="lang-dropdown">{"".join(options)}</div>'
        f'</div>'
    )


def build_page(template, translations, lang_code):
    cfg = LANGUAGES[lang_code]
    hreflang = build_hreflang_tags()
    switcher = build_lang_switcher(lang_code)

    html = template
    html = html.replace("{{lang}}", cfg["lang_attr"])
    html = html.replace("{{base_path}}", cfg["base_path"])
    html = html.replace("{{hreflang_tags}}", hreflang)
    html = html.replace("{{lang_switcher}}", switcher)

    for key, value in translations.items():
        html = html.replace("{{" + key + "}}", value)

    remaining = re.findall(r"\{\{(\w+)\}\}", html)
    if remaining:
        print(f"  WARNING: unresolved placeholders in {lang_code}: {remaining}")

    return html


def main():
    template_path = os.path.join(ROOT, "template.html")
    with open(template_path, "r", encoding="utf-8") as f:
        template = f.read()

    for lang_code, cfg in LANGUAGES.items():
        json_path = os.path.join(ROOT, "i18n", f"{lang_code}.json")
        with open(json_path, "r", encoding="utf-8") as f:
            translations = json.load(f)

        html = build_page(template, translations, lang_code)

        out_path = os.path.join(ROOT, cfg["output"])
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html)

        print(f"  Built {cfg['output']} ({cfg['lang_attr']})")

    print("\nDone. Generated pages for:", ", ".join(LANGUAGES.keys()))


if __name__ == "__main__":
    main()
