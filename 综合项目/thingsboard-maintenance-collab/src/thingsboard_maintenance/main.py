from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from thingsboard_maintenance.api.routes import router
from thingsboard_maintenance.db import init_db, sqlite_path


def create_app(db_path: Path | None = None) -> FastAPI:
    resolved_db_path = db_path or sqlite_path()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_db(Path(app.state.db_path))
        yield

    app = FastAPI(
        title="ThingsBoard Maintenance Collaboration API",
        version="0.1.0",
        description="Read-only AI assistance and maintenance work-order collaboration.",
        lifespan=lifespan,
    )
    app.state.db_path = resolved_db_path
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)

    return app


app = create_app()
