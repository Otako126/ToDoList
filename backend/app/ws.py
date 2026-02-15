import json
from fastapi import WebSocket


class WsManager:
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.clients.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.clients.discard(websocket)

    async def broadcast(self, event: str, payload: dict) -> None:
        stale: list[WebSocket] = []
        message = json.dumps({"event": event, "payload": payload}, default=str)
        for client in self.clients:
            try:
                await client.send_text(message)
            except Exception:
                stale.append(client)
        for client in stale:
            self.disconnect(client)


ws_manager = WsManager()
