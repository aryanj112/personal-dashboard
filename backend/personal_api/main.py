from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.db import create_schema
from .routers import dashboard, finance, habits, links, modules, networking, notes, resume, system, tasks, companies


def create_app() -> FastAPI:
    app = FastAPI(title="Personal API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(system.router)
    app.include_router(habits.router)
    app.include_router(tasks.router)
    app.include_router(modules.router)
    app.include_router(dashboard.router)
    app.include_router(networking.router)
    app.include_router(companies.router)
    app.include_router(notes.router)
    app.include_router(links.router)
    app.include_router(finance.router)
    app.include_router(resume.router)

    @app.on_event("startup")
    def on_startup() -> None:
        create_schema()

    return app


app = create_app()
