from datetime import datetime, timezone

from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import decode_access_token, require_auth
from .config import settings
from .database import Base, engine, get_db
from .models import Todo
from .schemas import TodoCreate, TodoRead, TodoUpdate
from .ws import ws_manager


app = FastAPI(title="Todo API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def enrich(todo: Todo) -> Todo:
    if todo.due_date:
        todo.is_overdue = todo.due_date.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc)
    else:
        todo.is_overdue = False
    return todo


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/todos", response_model=list[TodoRead])
async def list_todos(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Todo).order_by(Todo.priority, Todo.due_date))).scalars().all()
    return [enrich(todo) for todo in rows]


@app.post("/todos", response_model=TodoRead)
async def create_todo(
    data: TodoCreate,
    claims: dict | None = Depends(decode_access_token),
    db: AsyncSession = Depends(get_db),
):
    require_auth(claims)
    todo = enrich(Todo(**data.model_dump()))
    db.add(todo)
    await db.commit()
    await db.refresh(todo)
    await ws_manager.broadcast("created", TodoRead.model_validate(todo).model_dump())
    return todo


@app.put("/todos/{todo_id}", response_model=TodoRead)
async def update_todo(
    todo_id: int,
    data: TodoUpdate,
    claims: dict | None = Depends(decode_access_token),
    db: AsyncSession = Depends(get_db),
):
    require_auth(claims)
    todo = await db.get(Todo, todo_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(todo, key, value)
    enrich(todo)
    await db.commit()
    await db.refresh(todo)
    await ws_manager.broadcast("updated", TodoRead.model_validate(todo).model_dump())
    return todo


@app.delete("/todos/{todo_id}")
async def delete_todo(
    todo_id: int,
    claims: dict | None = Depends(decode_access_token),
    db: AsyncSession = Depends(get_db),
):
    require_auth(claims)
    todo = await db.get(Todo, todo_id)
    await db.delete(todo)
    await db.commit()
    await ws_manager.broadcast("deleted", {"id": todo_id})
    return {"ok": True}


@app.websocket("/ws/todos")
async def todos_ws(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
