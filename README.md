# ToDoList Sample (React + Django + FastAPI + SQLite)

学習用サンプルとして、以下構成の ToDo 管理 Web アプリです。

- **React + Vite + TypeScript**: ダッシュボード / ログイン / ユーザ登録 / 編集画面
- **Django**: 認証API（SSOプロバイダ種別付きのログイン・登録）
- **FastAPI**: ToDo CRUD API + WebSocketでリアルタイム通知
- **SQLite**: Django / FastAPI の各サービスで使用

## 主要機能

- 未ログイン: ダッシュボードで ToDo 一覧閲覧のみ可能
- ログイン済み: ToDo の追加・更新・削除が可能
- WebSocket で更新イベントを配信し、ダッシュボードを即時再取得
- ToDo項目: タスクタイトル、記入日(created_at)、最終更新日(updated_at)、完了予定日(due_date)、期限オーバーフラグ(is_overdue)、タスク内容(description)、優先度(priority)、担当者(assignee)、記入者(creator)

## 起動

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- FastAPI: http://localhost:8000/docs
- Django auth API: http://localhost:8001/api/login

## Azure / Cloudflare Tunnel 想定

- Azure Linux VM 上で `docker compose` 常駐
- Cloudflare Tunnel 経由で Frontend のみ公開
- API は VM 内部ネットワークまたは Cloudflare Access で保護

## CI/CD

GitHub Actions により次を実行:
- FastAPIコンパイルチェック
- Django `manage.py check`
- Frontend build
