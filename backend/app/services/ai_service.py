import base64
import httpx
from sqlalchemy.orm import Session
from app.models.models import AdminSettings

PROVIDER_URLS = {
    "openai": "https://api.openai.com/v1/chat/completions",
    "anthropic": "https://api.anthropic.com/v1/messages",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
}

AVAILABLE_MODELS = {
    "openai": [
        {"id": "gpt-4o", "name": "GPT-4o", "recommended": True},
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini"},
        {"id": "gpt-4-turbo", "name": "GPT-4 Turbo"},
        {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo"},
    ],
    "anthropic": [
        {"id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4", "recommended": True},
        {"id": "claude-haiku-4-20250414", "name": "Claude Haiku 4"},
        {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet"},
    ],
    "gemini": [
        {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "recommended": True},
        {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro"},
        {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash"},
    ],
}


def get_setting(db: Session, key: str) -> str | None:
    row = db.query(AdminSettings).filter(AdminSettings.key == key).first()
    return row.value if row else None


def set_setting(db: Session, key: str, value: str):
    row = db.query(AdminSettings).filter(AdminSettings.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AdminSettings(key=key, value=value))
    db.commit()


async def ai_vision(db: Session, prompt: str, system: str, image: bytes, mime: str) -> str:
    provider = get_setting(db, "ai_provider") or "openai"
    model = get_setting(db, "ai_model") or "gpt-4o-mini"
    key = get_setting(db, f"{provider}_api_key")
    if not key:
        return "[ERRO] Chave de API nao configurada. Acesse o painel de administracao."
    b64 = base64.b64encode(image).decode()
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            if provider == "openai":
                msgs = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "high"}}]}]
                r = await client.post(PROVIDER_URLS["openai"], headers={"Authorization": f"Bearer {key}"},
                                      json={"model": model, "messages": msgs, "temperature": 0.2})
                r.raise_for_status()
                return r.json()["choices"][0]["message"]["content"]
            if provider == "anthropic":
                body = {"model": model, "max_tokens": 2048, "messages": [{"role": "user", "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": mime, "data": b64}},
                    {"type": "text", "text": prompt}]}]}
                if system:
                    body["system"] = system
                r = await client.post(PROVIDER_URLS["anthropic"], json=body,
                                      headers={"x-api-key": key, "anthropic-version": "2023-06-01"})
                r.raise_for_status()
                return r.json()["content"][0]["text"]
            url = PROVIDER_URLS["gemini"].format(model=model) + f"?key={key}"
            r = await client.post(url, json={"contents": [{"parts": [
                {"text": f"{system}\n\n{prompt}" if system else prompt},
                {"inline_data": {"mime_type": mime, "data": b64}}]}]})
            r.raise_for_status()
            return r.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        return f"[ERRO] Falha na analise da imagem: {str(e)}"


async def ai_generate(db: Session, prompt: str, system_prompt: str = "") -> str:
    provider = get_setting(db, "ai_provider") or "openai"
    model = get_setting(db, "ai_model") or "gpt-4o-mini"
    api_key = get_setting(db, f"{provider}_api_key")

    if not api_key:
        return "[ERRO] Chave de API nao configurada. Acesse o painel de administracao."

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            if provider == "openai":
                return await _call_openai(client, api_key, model, system_prompt, prompt)
            elif provider == "anthropic":
                return await _call_anthropic(client, api_key, model, system_prompt, prompt)
            elif provider == "gemini":
                return await _call_gemini(client, api_key, model, system_prompt, prompt)
    except Exception as e:
        return f"[ERRO] Falha na geracao: {str(e)}"


async def _call_openai(client: httpx.AsyncClient, key: str, model: str, system: str, prompt: str) -> str:
    msgs = []
    if system:
        msgs.append({"role": "system", "content": system})
    msgs.append({"role": "user", "content": prompt})
    r = await client.post(
        PROVIDER_URLS["openai"],
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": model, "messages": msgs, "temperature": 0.7},
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


async def _call_anthropic(client: httpx.AsyncClient, key: str, model: str, system: str, prompt: str) -> str:
    body = {"model": model, "max_tokens": 4096, "messages": [{"role": "user", "content": prompt}]}
    if system:
        body["system"] = system
    r = await client.post(
        PROVIDER_URLS["anthropic"],
        headers={"x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
        json=body,
    )
    r.raise_for_status()
    return r.json()["content"][0]["text"]


async def _call_gemini(client: httpx.AsyncClient, key: str, model: str, system: str, prompt: str) -> str:
    full_prompt = f"{system}\n\n{prompt}" if system else prompt
    url = PROVIDER_URLS["gemini"].format(model=model) + f"?key={key}"
    r = await client.post(url, json={"contents": [{"parts": [{"text": full_prompt}]}]})
    r.raise_for_status()
    return r.json()["candidates"][0]["content"]["parts"][0]["text"]
