# server/main.py
from __future__ import annotations

import os
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Routers mounted under /api
from server.app.routers import machines as machines_router
from server.app.routers import analyze as analyze_router
from server.app.routers import analyze_image as analyze_image_router

# Optional: lazy helpers from your existing code
def _load_pipeline_and_rules():
    # Predict image: prefer server.inference, fallback server.ml
    try:
        from server.inference.pipeline import DiagnosticPipeline  # type: ignore
    except Exception:
        try:
            from server.ml.pipeline import DiagnosticPipeline  # type: ignore
        except Exception as exc:
            raise RuntimeError(
                "Could not import DiagnosticPipeline from server.inference.pipeline or server.ml.pipeline"
            ) from exc

    from server.rules.suggest import suggest  # your rules engine entrypoint
    from server.machines import resolve_machine

    def predict_image(image_path: str, meta: dict):
        pipe = DiagnosticPipeline()
        return pipe.predict_image(image_path, meta)

    return predict_image, suggest, resolve_machine


app = FastAPI(title="3D Diagnostics API", version="0.1.0")

# Permissive CORS for dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# ---------- Health ----------
@app.get("/health")
def health():
    mode = os.environ.get("INFERENCE_MODE", "stub")
    return {"status": "ok", "mode": mode}


# ---------- Multipart /api/analyze (image) ----------
# Keep this here for the camera flow in your app
@app.post("/api/analyze")
async def analyze_image(
    image: UploadFile = File(...),
    meta: str = Form(..., description="JSON string: {machine_id, experience, material, app_version}"),
):
    import json
    import tempfile
    import shutil

    try:
        meta_obj = json.loads(meta or "{}")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid meta JSON: {exc}") from exc

    upload_dir = os.environ.get("UPLOAD_DIR") or os.path.join(tempfile.gettempdir(), "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    # save file to disk
    suffix = os.path.splitext(image.filename or "upload.jpg")[-1] or ".jpg"
    fd, tmp_path = tempfile.mkstemp(prefix="img_", suffix=suffix, dir=upload_dir)
    os.close(fd)
    with open(tmp_path, "wb") as w:
        shutil.copyfileobj(image.file, w)

    # run inference + suggestions
    try:
        predict_image, suggest, resolve_machine = _load_pipeline_and_rules()

        machine_id = meta_obj.get("machine_id") or meta_obj.get("machine")  # flexibility
        if not machine_id:
            raise HTTPException(status_code=400, detail="meta.machine_id is required")

        machine = resolve_machine(machine_id)
        prediction = predict_image(tmp_path, meta_obj)  # your pipeline returns structured result
        suggestions = suggest(prediction, machine, meta_obj.get("experience", "Intermediate"))
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

    return {
        "machine": {"id": machine.get("id"), "brand": machine.get("brand"), "model": machine.get("model")},
        "predictions": getattr(prediction, "predictions", []),
        "issue": getattr(prediction, "issue", None),
        "confidence": getattr(prediction, "confidence", None),
        "explanations": getattr(prediction, "explanations", []),
        "suggestions": suggestions.get("suggestions"),
        "parameter_targets": suggestions.get("parameter_targets"),
        "slicer_profile_diff": suggestions.get("slicer_profile_diff"),
        "capability_notes": getattr(prediction, "capability_notes", []),
        "version": "mvp-0.1",
    }


# ---------- Mount routers under /api ----------
app.include_router(machines_router.router, prefix="/api")
app.include_router(analyze_router.router, prefix="/api")
app.include_router(analyze_image_router.router, prefix="/api")
